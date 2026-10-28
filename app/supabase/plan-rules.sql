-- =============================================================================
-- Reglas de planes: membresía vigente, plan en espera, pase del día,
-- cambio de plan y reembolso. Idempotente: se puede correr más de una vez.
--
-- Orden: correr DESPUÉS de booking-rpc.sql (define current_membership_id y
-- member_booking_block_reason con pases del día).
--
-- Mismas reglas que src/domain/rules/memberships.ts (planPurchaseOutcome):
--   - pase del día            → fila aparte válida hasta las 23:59:59 de Guayaquil;
--   - mismo plan que el vigente o el que está en espera → suma días a esa fila
--     (conserva starts_at; si había plan en espera detrás del vigente, se corre);
--   - otro plan con uno vigente activo → queda en espera desde que termina;
--   - ya hay un plan en espera distinto → se rechaza;
--   - sin plan vigente (o en gracia) → membresía nueva desde hoy.
-- =============================================================================

-- 1. Tipo de plan -------------------------------------------------------------
alter table public.membership_plans
  add column if not exists kind text not null default 'membership';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'membership_plans_kind_check'
  ) then
    alter table public.membership_plans
      add constraint membership_plans_kind_check check (kind in ('membership', 'day_pass'));
  end if;
end $$;

-- Zona Day Musculación / Recovery / Full (planes-zona-cero.sql)
update public.membership_plans
set kind = 'day_pass'
where id in (
  'c5000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000002',
  'c5000000-0000-4000-8000-000000000003'
)
and kind <> 'day_pass';

-- Un plan descontinuado (active = false) sigue siendo legible para quien lo
-- tiene asignado; si no, la app no conoce sus áreas y bloquea las reservas.
drop policy if exists "membership_plans read active or staff" on public.membership_plans;
create policy "membership_plans read active or staff" on public.membership_plans for select using (
  active = true
  or public.is_staff()
  or exists (
    select 1 from public.memberships m
    where m.plan_id = membership_plans.id and m.user_id = auth.uid()
  )
);

-- 2. Notas del pago (crédito de un cambio de plan) e índice por fechas ----------
alter table public.payments add column if not exists notes text;

create index if not exists idx_memberships_user_dates
  on public.memberships (user_id, starts_at, ends_at);

-- 3. Helpers ------------------------------------------------------------------
-- 23:59:59 del día de p_at en America/Guayaquil.
create or replace function public.gym_end_of_day(p_at timestamptz default now())
returns timestamptz
language sql
stable
set search_path = public
as $$
  select (((p_at at time zone 'America/Guayaquil')::date + 1)::timestamp - interval '1 second')
    at time zone 'America/Guayaquil';
$$;

-- Plan en espera: la fila (no pase) que todavía no empieza.
create or replace function public.queued_membership_id(p_user_id uuid, p_at timestamptz default now())
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.id
  from memberships m
  join membership_plans p on p.id = m.plan_id
  where m.user_id = p_user_id
    and m.status <> 'cancelled'
    and p.kind <> 'day_pass'
    and m.starts_at > p_at
  order by m.starts_at
  limit 1;
$$;

-- Motivo para no vender p_plan_id al socio (plan en espera distinto), o null.
-- Lo usan la Edge Function de Pagomedios y la app antes de cobrar.
create or replace function public.plan_purchase_block_reason(p_user_id uuid, p_plan_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_current memberships%rowtype;
  v_queued memberships%rowtype;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id and not public.is_staff() then
    raise exception 'Sin permiso';
  end if;
  select kind into v_kind from membership_plans where id = p_plan_id;
  if v_kind is null then
    return 'Plan no encontrado';
  end if;
  if v_kind = 'day_pass' then
    return null;
  end if;
  select * into v_current from memberships where id = public.current_membership_id(p_user_id);
  select * into v_queued from memberships where id = public.queued_membership_id(p_user_id);
  if v_queued.id is null
    or v_queued.plan_id = p_plan_id
    or v_current.plan_id is not distinct from p_plan_id
  then
    return null;
  end if;
  return 'Ya tienes un plan en espera. Podrás comprar otro cuando empiece.';
end;
$$;

-- 4. Aplicar una compra ---------------------------------------------------------
-- Solo staff (registerManualPayment) o service_role (Edge Functions de pago).
-- Bloquea el perfil y las membresías del socio: dos compras simultáneas se
-- atienden una tras otra. Si hay un plan en espera distinto, lanza excepción.
create or replace function public.apply_plan_purchase(
  p_user_id uuid,
  p_plan_id uuid,
  p_paid_at timestamptz default now()
)
returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan membership_plans%rowtype;
  v_current memberships%rowtype;
  v_queued memberships%rowtype;
  v_target memberships%rowtype;
  v_row memberships%rowtype;
  v_ends timestamptz;
  v_length interval;
begin
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'Sin permiso';
  end if;

  select * into v_plan from membership_plans where id = p_plan_id;
  if not found then
    raise exception 'Plan no encontrado';
  end if;
  perform 1 from profiles where id = p_user_id for update;
  if not found then
    raise exception 'Socio no encontrado';
  end if;
  perform 1 from memberships where user_id = p_user_id for update;

  if v_plan.kind = 'day_pass' then
    insert into memberships (user_id, plan_id, status, starts_at, ends_at, grace_ends_at, visits_left)
    values (
      p_user_id, p_plan_id, 'active', p_paid_at,
      public.gym_end_of_day(p_paid_at), public.gym_end_of_day(p_paid_at), v_plan.visit_quota
    )
    returning * into v_row;
    return v_row;
  end if;

  select * into v_current from memberships where id = public.current_membership_id(p_user_id, p_paid_at);
  select * into v_queued from memberships where id = public.queued_membership_id(p_user_id, p_paid_at);

  if v_queued.id is not null and v_queued.plan_id = p_plan_id then
    v_target := v_queued;
  elsif v_current.id is not null and v_current.plan_id = p_plan_id then
    v_target := v_current;
  elsif v_queued.id is not null then
    raise exception 'Ya tienes un plan en espera. Podrás comprar otro cuando empiece.';
  end if;

  if v_target.id is not null then
    v_ends := greatest(v_target.ends_at, p_paid_at) + make_interval(days => v_plan.duration_days);
    update memberships set
      starts_at = case
        when coalesce(grace_ends_at, ends_at + interval '3 days') >= p_paid_at then starts_at
        else p_paid_at
      end,
      ends_at = v_ends,
      grace_ends_at = v_ends + interval '3 days',
      status = 'active',
      visits_left = case
        when v_plan.visit_quota is null then null
        when ends_at > p_paid_at and visits_left is not null then visits_left + v_plan.visit_quota
        else v_plan.visit_quota
      end
    where id = v_target.id
    returning * into v_row;

    if v_target.id = v_current.id and v_queued.id is not null then
      v_length := v_queued.ends_at - v_queued.starts_at;
      update memberships set
        starts_at = v_ends,
        ends_at = v_ends + v_length,
        grace_ends_at = v_ends + v_length + interval '3 days'
      where id = v_queued.id;
    end if;
    return v_row;
  end if;

  if v_current.id is not null and v_current.ends_at >= p_paid_at then
    v_ends := v_current.ends_at + make_interval(days => v_plan.duration_days);
    insert into memberships (user_id, plan_id, status, starts_at, ends_at, grace_ends_at, visits_left)
    values (
      p_user_id, p_plan_id, 'active', v_current.ends_at, v_ends, v_ends + interval '3 days',
      v_plan.visit_quota
    )
    returning * into v_row;
  else
    v_ends := p_paid_at + make_interval(days => v_plan.duration_days);
    insert into memberships (user_id, plan_id, status, starts_at, ends_at, grace_ends_at, visits_left)
    values (
      p_user_id, p_plan_id, 'active', p_paid_at, v_ends, v_ends + interval '3 days',
      v_plan.visit_quota
    )
    returning * into v_row;
  end if;
  return v_row;
end;
$$;

-- 5. Cambiar plan hoy (recepción) ---------------------------------------------
-- Cierra el vigente ahora, abre el nuevo con período completo desde ahora, corre
-- el plan en espera y registra el pago. El crédito (planChangeCredit) queda en
-- notes: precio × días restantes / días del período, en calendario Guayaquil.
-- p_amount_cents es lo que cobró recepción (precio nuevo − crédito, editable).
create or replace function public.change_plan_now(
  p_user_id uuid,
  p_plan_id uuid,
  p_amount_cents int,
  p_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_plan membership_plans%rowtype;
  v_current_plan membership_plans%rowtype;
  v_current memberships%rowtype;
  v_queued memberships%rowtype;
  v_row memberships%rowtype;
  v_payment payments%rowtype;
  v_total int;
  v_remaining int;
  v_credit int := 0;
  v_ends timestamptz;
  v_length interval;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Sin permiso';
  end if;
  select * into v_plan from membership_plans where id = p_plan_id;
  if not found then
    raise exception 'Plan no encontrado';
  end if;
  if v_plan.kind = 'day_pass' then
    raise exception 'Un pase del día no reemplaza al plan.';
  end if;

  perform 1 from profiles where id = p_user_id for update;
  perform 1 from memberships where user_id = p_user_id for update;

  select * into v_current from memberships where id = public.current_membership_id(p_user_id, v_now);
  if v_current.id is null then
    raise exception 'El socio no tiene un plan vigente para cambiar.';
  end if;
  if v_current.plan_id = p_plan_id then
    raise exception 'El socio ya tiene ese plan. Usa Renovar.';
  end if;
  select * into v_queued from memberships where id = public.queued_membership_id(p_user_id, v_now);
  select * into v_current_plan from membership_plans where id = v_current.plan_id;

  v_total := (v_current.ends_at at time zone 'America/Guayaquil')::date
    - (v_current.starts_at at time zone 'America/Guayaquil')::date;
  if v_total > 0 then
    v_remaining := greatest(0, least(
      v_total,
      (v_current.ends_at at time zone 'America/Guayaquil')::date
        - (v_now at time zone 'America/Guayaquil')::date
    ));
    v_credit := round(v_current_plan.price_cents::numeric * v_remaining / v_total);
  end if;

  update memberships set ends_at = v_now, grace_ends_at = v_now where id = v_current.id;

  v_ends := v_now + make_interval(days => v_plan.duration_days);
  insert into memberships (user_id, plan_id, status, starts_at, ends_at, grace_ends_at, visits_left)
  values (p_user_id, p_plan_id, 'active', v_now, v_ends, v_ends + interval '3 days', v_plan.visit_quota)
  returning * into v_row;

  if v_queued.id is not null then
    v_length := v_queued.ends_at - v_queued.starts_at;
    update memberships set
      starts_at = v_ends,
      ends_at = v_ends + v_length,
      grace_ends_at = v_ends + v_length + interval '3 days'
    where id = v_queued.id;
  end if;

  insert into payments (
    user_id, plan_id, membership_id, amount_cents, status, provider, manual_method,
    notes, approved_at
  )
  values (
    p_user_id, p_plan_id, v_row.id, p_amount_cents, 'approved', 'manual', p_method,
    format(
      'Cambio de plan: %s → %s. Crédito por días no usados: $%s.',
      v_current_plan.name, v_plan.name, to_char(v_credit / 100.0, 'FM999999990.00')
    ),
    v_now
  )
  returning * into v_payment;

  return jsonb_build_object('membership', to_jsonb(v_row), 'payment', to_jsonb(v_payment));
end;
$$;

-- 6. Marcar reembolsado (recepción) -------------------------------------------
-- Solo pagos aprobados. Con p_cancel_membership cancela la fila ligada al pago
-- (membresía, plan en espera o pase). El notify de Pagomedios no re-aprueba un
-- pago reembolsado (pagomedios-payment/index.ts).
create or replace function public.refund_payment(
  p_payment_id uuid,
  p_cancel_membership boolean default false
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment payments%rowtype;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Sin permiso';
  end if;
  select * into v_payment from payments where id = p_payment_id for update;
  if not found then
    raise exception 'Pago no encontrado';
  end if;
  if v_payment.status <> 'approved' then
    raise exception 'Solo se pueden reembolsar pagos aprobados.';
  end if;

  update payments set status = 'refunded' where id = p_payment_id returning * into v_payment;
  if p_cancel_membership and v_payment.membership_id is not null then
    update memberships set status = 'cancelled' where id = v_payment.membership_id;
  end if;
  return v_payment;
end;
$$;

-- 7. Permisos -----------------------------------------------------------------
revoke all on function public.gym_end_of_day(timestamptz) from public, anon, authenticated;
revoke all on function public.queued_membership_id(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.plan_purchase_block_reason(uuid, uuid) from public, anon;
grant execute on function public.plan_purchase_block_reason(uuid, uuid) to authenticated, service_role;
revoke all on function public.apply_plan_purchase(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.apply_plan_purchase(uuid, uuid, timestamptz) to authenticated, service_role;
revoke all on function public.change_plan_now(uuid, uuid, int, text) from public, anon;
grant execute on function public.change_plan_now(uuid, uuid, int, text) to authenticated;
revoke all on function public.refund_payment(uuid, boolean) from public, anon;
grant execute on function public.refund_payment(uuid, boolean) to authenticated;
grant execute on function public.current_membership_id(uuid, timestamptz) to service_role;
grant execute on function public.queued_membership_id(uuid, timestamptz) to service_role;
grant execute on function public.gym_end_of_day(timestamptz) to service_role;
