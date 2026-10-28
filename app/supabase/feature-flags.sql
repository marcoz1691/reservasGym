-- Interruptores de la app que el admin prende y apaga sin volver a publicar
-- (Partes C y D del plan de pagos). Ejecutar en SQL Editor de Supabase DESPUÉS de
-- security-hardening.sql, booking-rpc.sql y plan-rules.sql (usa membership_plans.kind
-- y plan_purchase_block_reason). Idempotente: se puede correr más de una vez.
--
-- online_payments_enabled: nace apagado. Al aplicarla, QA y producción quedan sin
--   pago en línea hasta que el admin lo encienda. pagomedios-payment (create) lo
--   revisa con service role; notify y verify no, para no perder pagos en curso.
-- waitlist_enabled, measurements_enabled, day_passes_enabled: nacen encendidos para
--   que nada cambie al aplicarla. book_session lee waitlist_enabled (booking-rpc.sql).

alter table gym_settings add column if not exists online_payments_enabled boolean not null default false;
alter table gym_settings add column if not exists waitlist_enabled boolean not null default true;
alter table gym_settings add column if not exists measurements_enabled boolean not null default true;
alter table gym_settings add column if not exists day_passes_enabled boolean not null default true;

-- Cualquier usuario con sesión lee la configuración (la app necesita los interruptores);
-- solo admin la cambia. Antes la escribía también staff.
drop policy if exists "settings read all auth" on gym_settings;
drop policy if exists "settings write staff" on gym_settings;
drop policy if exists "settings write admin" on gym_settings;
create policy "settings read all auth" on gym_settings for select to authenticated using (true);
create policy "settings write admin" on gym_settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Con day_passes_enabled apagado, el socio no puede pedir un pase diario aunque
-- llame a la API directo. Cobros (staff) usa "payments write staff" y no pasa por aquí.
create or replace function public.plan_sellable_in_app(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select gs.day_passes_enabled from gym_settings gs where gs.id = 1), true
  )
  or not exists (
    select 1 from membership_plans p
    where p.id = p_plan_id and p.kind = 'day_pass'
  );
$$;

revoke all on function public.plan_sellable_in_app(uuid) from public, anon;
grant execute on function public.plan_sellable_in_app(uuid) to authenticated, service_role;

drop policy if exists "payments insert own plan request" on payments;
create policy "payments insert own plan request" on payments for insert with check (
  user_id = auth.uid()
  and status = 'pending'
  and provider = 'manual'
  and membership_id is null
  and public.plan_sellable_in_app(plan_id)
  and public.plan_purchase_block_reason(user_id, plan_id) is null
);

drop policy if exists "payments update own plan request" on payments;
create policy "payments update own plan request" on payments for update using (
  user_id = auth.uid() and status = 'pending' and provider = 'manual'
) with check (
  user_id = auth.uid()
  and status = 'pending'
  and provider = 'manual'
  and membership_id is null
  and public.plan_sellable_in_app(plan_id)
  and public.plan_purchase_block_reason(user_id, plan_id) is null
);
