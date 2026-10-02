-- Reservas atómicas y promoción segura desde la lista de espera.
-- Origen: ZCAPP-53 (sobrecupo por reservas simultáneas) y ZCAPP-54 (la promoción
-- no revisaba solapamiento ni membresía). Ejecutar en SQL Editor de Supabase
-- (proyecto zona-cero). Es idempotente: se puede correr más de una vez.
--
-- El cupo lo decide la base. book_session y cancel_booking bloquean la fila de la
-- sesión (`for update`), así que dos reservas simultáneas sobre el último lugar se
-- atienden una tras otra y la segunda cae en lista de espera. Orden de bloqueo en
-- todas las funciones: sesión → perfil del socio, para no provocar deadlocks.
--
-- Además la promoción corre como SECURITY DEFINER: antes la hacía el cliente del
-- socio que cancelaba, y RLS no le deja leer la cola ni tocar reservas ajenas.

-- Código de check-in con el mismo formato que la app (uid('QR') en los repositorios):
-- 'QR-' + 8 hexadecimales en mayúscula, p. ej. QR-047CAC92. Corto para dictarlo o
-- escribirlo en recepción (ZCAPP-56). El check-in compara reserva + código, así
-- que una repetición entre reservas distintas no tiene efecto.
create or replace function public.new_check_in_code()
returns text
language sql
volatile
set search_path = public
as $$
  select 'QR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

-- Lugares ocupados en la sesión. Igual que seatsTaken() en src/domain/rules:
-- 'attended' sigue ocupando lugar, si no cada check-in liberaría un cupo.
create or replace function public.session_seats_taken(p_session_id text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from bookings
  where session_id = p_session_id and status in ('confirmed', 'pending', 'attended');
$$;

-- Tipo de plan (plan-rules.sql también lo crea). Aquí para que este archivo corra solo.
alter table public.membership_plans
  add column if not exists kind text not null default 'membership';

-- Membresía vigente (misma regla que currentMembership en src/domain/rules/memberships.ts):
-- ya empezó, no está cancelada, no es pase del día y sigue activa o en gracia.
-- Si hay varias, la que termina más tarde. El plan en espera (empieza después) no cuenta.
create or replace function public.current_membership_id(p_user_id uuid, p_at timestamptz default now())
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
    and m.starts_at <= p_at
    and p_at <= coalesce(m.grace_ends_at, m.ends_at + interval '3 days')
  order by m.ends_at desc
  limit 1;
$$;

-- Motivo por el que el socio no puede reservar en la zona, o null si puede.
-- Replica assertMemberBookingAllowed (src/domain/rules) con los mismos textos.
-- Acceso = plan vigente ∪ pases del día activos; un pase solo cubre clases que
-- empiezan antes de que venza (23:59 de Guayaquil). Staff y admin no pasan por aquí.
drop function if exists public.member_booking_block_reason(uuid, text);
create or replace function public.member_booking_block_reason(
  p_user_id uuid,
  p_zone_id text,
  p_session_starts_at timestamptz default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_membership memberships%rowtype;
  v_plan membership_plans%rowtype;
  v_zone text := lower(regexp_replace(p_zone_id, '[_-]', '', 'g'));
  v_pass_names text;
  v_current uuid;
begin
  select role into v_role from profiles where id = p_user_id;
  if v_role is distinct from 'member' then
    return null;
  end if;

  if exists (
    select 1
    from memberships m
    join membership_plans p on p.id = m.plan_id
    where m.user_id = p_user_id
      and m.status <> 'cancelled'
      and p.kind = 'day_pass'
      and m.starts_at <= now() and now() <= m.ends_at
      and (p_session_starts_at is null or p_session_starts_at <= m.ends_at)
      and (
        coalesce(array_length(p.allowed_zone_ids, 1), 0) = 0
        or exists (
          select 1 from unnest(p.allowed_zone_ids) z
          where lower(regexp_replace(z, '[_-]', '', 'g')) = v_zone
        )
      )
  ) then
    return null;
  end if;

  select string_agg(p.name, ', ' order by p.name) into v_pass_names
  from memberships m
  join membership_plans p on p.id = m.plan_id
  where m.user_id = p_user_id
    and m.status <> 'cancelled'
    and p.kind = 'day_pass'
    and m.starts_at <= now() and now() <= m.ends_at
    and (p_session_starts_at is null or p_session_starts_at <= m.ends_at);

  v_current := public.current_membership_id(p_user_id);
  if v_current is not null then
    select * into v_membership from memberships where id = v_current;
  else
    -- Sin vigente: la última que ya empezó, para dar el motivo (vencida, cancelada…)
    select m.* into v_membership
    from memberships m
    join membership_plans p on p.id = m.plan_id
    where m.user_id = p_user_id and p.kind <> 'day_pass' and m.starts_at <= now()
    order by m.ends_at desc
    limit 1;
  end if;

  if v_membership.id is null
    or v_membership.status = 'cancelled'
    or now() > coalesce(v_membership.grace_ends_at, v_membership.ends_at + interval '3 days')
    or (v_membership.visits_left is not null and v_membership.visits_left <= 0)
  then
    if v_pass_names is not null then
      return format('Tu pase (%s) no incluye acceso a esta zona.', v_pass_names);
    end if;
    if v_membership.id is null then
      return 'No cuenta con una membresía activa.';
    end if;
    if v_membership.status = 'cancelled' then
      return 'La membresía ha sido cancelada.';
    end if;
    if now() > coalesce(v_membership.grace_ends_at, v_membership.ends_at + interval '3 days') then
      return 'Membresía vencida. Por favor renueva tu plan.';
    end if;
    return 'No quedan visitas disponibles en la membresía.';
  end if;

  select * into v_plan from membership_plans where id = v_membership.plan_id;
  if not found then
    return 'No se encontró un plan asociado para verificar el acceso a la zona.';
  end if;
  if coalesce(array_length(v_plan.allowed_zone_ids, 1), 0) = 0 then
    return null;
  end if;
  if exists (
    select 1 from unnest(v_plan.allowed_zone_ids) z
    where lower(regexp_replace(z, '[_-]', '', 'g')) = v_zone
  ) then
    return null;
  end if;
  return format('Tu plan (%s) no incluye acceso a esta zona.', v_plan.name);
end;
$$;

-- Interruptor del admin (gym_settings.waitlist_enabled, feature-flags.sql). Se lee
-- como jsonb para no fallar si este archivo corre antes que la migración: sin la
-- columna la lista de espera sigue encendida, como hasta ahora.
create or replace function public.waitlist_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (to_jsonb(g) ->> 'waitlist_enabled')::boolean from gym_settings g where g.id = 1),
    true
  );
$$;

-- ¿El socio ya tiene una reserva confirmada o pendiente que se cruza con la sesión?
create or replace function public.booking_overlaps(p_user_id uuid, p_session_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from bookings b
    join sessions s on s.id = b.session_id
    join sessions c on c.id = p_session_id
    where b.user_id = p_user_id
      and b.status in ('confirmed', 'pending')
      and s.starts_at < c.ends_at
      and s.ends_at > c.starts_at
  );
$$;

-- Sube a confirmados a los primeros elegibles de la cola mientras haya cupo.
-- Quien ya no es elegible sale de la cola y su reserva en espera se cancela.
-- Deja las posiciones en 1, 2, 3… Se llama con la fila de la sesión ya bloqueada.
create or replace function public.promote_waitlist(p_session_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session sessions%rowtype;
  v_entry waitlist_entries%rowtype;
  v_now timestamptz := now();
begin
  select * into v_session from sessions where id = p_session_id;

  for v_entry in
    select * from waitlist_entries
    where session_id = p_session_id
    order by position, created_at
  loop
    exit when public.session_seats_taken(p_session_id) >= v_session.capacity;

    perform 1 from profiles where id = v_entry.user_id for update;
    delete from waitlist_entries where id = v_entry.id;

    if public.booking_overlaps(v_entry.user_id, p_session_id)
      or public.member_booking_block_reason(v_entry.user_id, v_session.zone_id, v_session.starts_at) is not null
    then
      update bookings set status = 'cancelled', cancelled_at = v_now
      where session_id = p_session_id and user_id = v_entry.user_id and status = 'waitlisted';
      continue;
    end if;

    update bookings set status = 'confirmed'
    where session_id = p_session_id and user_id = v_entry.user_id and status = 'waitlisted';
    if not found then
      insert into bookings (id, session_id, user_id, status, created_at, check_in_code)
      values (
        'bk-' || gen_random_uuid(), p_session_id, v_entry.user_id, 'confirmed', v_now,
        public.new_check_in_code()
      );
    end if;
  end loop;

  update waitlist_entries w
  set position = r.rn
  from (
    select id, row_number() over (order by position, created_at)::int as rn
    from waitlist_entries
    where session_id = p_session_id
  ) r
  where w.id = r.id and w.position <> r.rn;
end;
$$;

-- Reserva o entra en lista de espera, en un solo paso.
-- Devuelve {"booking": fila} o {"waitlist": fila}. p_user_id solo lo usa staff.
create or replace function public.book_session(p_session_id text, p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_user uuid;
  v_session sessions%rowtype;
  v_reason text;
  v_now timestamptz := now();
  v_booking bookings%rowtype;
  v_entry waitlist_entries%rowtype;
begin
  if v_actor is null then
    raise exception 'No autenticado';
  end if;
  v_user := coalesce(p_user_id, v_actor);
  if v_user <> v_actor and not public.is_staff() then
    raise exception 'No puedes reservar por otro socio';
  end if;

  select * into v_session from sessions where id = p_session_id for update;
  if not found then
    raise exception 'Sesión no encontrada';
  end if;
  perform 1 from profiles where id = v_user for update;

  if v_session.starts_at <= v_now and not public.is_staff() then
    raise exception 'Esa clase ya empezó';
  end if;
  if exists (
    select 1 from bookings
    where session_id = p_session_id and user_id = v_user
      and status in ('confirmed', 'pending', 'waitlisted')
  ) then
    raise exception 'Ya tienes reserva en esta sesión';
  end if;
  if public.booking_overlaps(v_user, p_session_id) then
    raise exception 'Se solapa con otra reserva activa';
  end if;
  v_reason := public.member_booking_block_reason(v_user, v_session.zone_id, v_session.starts_at);
  if v_reason is not null then
    raise exception '%', v_reason;
  end if;

  if public.session_seats_taken(p_session_id) < v_session.capacity then
    insert into bookings (id, session_id, user_id, status, created_at, check_in_code)
    values (
      'bk-' || gen_random_uuid(), p_session_id, v_user, 'confirmed', v_now,
      public.new_check_in_code()
    )
    returning * into v_booking;
    return jsonb_build_object('booking', to_jsonb(v_booking));
  end if;

  -- Con la lista de espera apagada no entra nadie nuevo a la cola. Quienes ya
  -- esperaban siguen: promote_waitlist no revisa el interruptor.
  if not public.waitlist_enabled() then
    raise exception 'La clase está llena';
  end if;

  insert into waitlist_entries (id, session_id, user_id, position, created_at)
  values (
    'wl-' || gen_random_uuid(), p_session_id, v_user,
    coalesce((select max(position) from waitlist_entries where session_id = p_session_id), 0) + 1,
    v_now
  )
  returning * into v_entry;
  insert into bookings (id, session_id, user_id, status, created_at, check_in_code)
  values (
    'bk-' || gen_random_uuid(), p_session_id, v_user, 'waitlisted', v_now,
    public.new_check_in_code()
  );
  return jsonb_build_object('waitlist', to_jsonb(v_entry));
end;
$$;

-- Cancela una reserva (propia, o cualquiera si es staff), saca al socio de la
-- cola y promueve al siguiente elegible. Devuelve la fila cancelada.
create or replace function public.cancel_booking(p_booking_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_booking bookings%rowtype;
begin
  if v_actor is null then
    raise exception 'No autenticado';
  end if;
  select * into v_booking from bookings where id = p_booking_id;
  if not found then
    raise exception 'Reserva no encontrada';
  end if;
  if v_booking.user_id <> v_actor and not public.is_staff() then
    raise exception 'Sin permiso';
  end if;

  perform 1 from sessions where id = v_booking.session_id for update;
  update bookings set status = 'cancelled', cancelled_at = now()
  where id = p_booking_id
  returning * into v_booking;
  delete from waitlist_entries
  where session_id = v_booking.session_id and user_id = v_booking.user_id;
  perform public.promote_waitlist(v_booking.session_id);
  return to_jsonb(v_booking);
end;
$$;

-- Mueve una reserva a otra sesión, en un solo paso. Valida todo en la sesión nueva
-- (cupo, solapamiento, membresía) ANTES de tocar nada: si falla, la reserva
-- original queda intacta. Si había cupo, la original se cancela, se crea la nueva
-- confirmada y se promueve la cola de la sesión que quedó libre.
-- Bloquea ambas sesiones en orden de id para no provocar deadlocks.
create or replace function public.reschedule_booking(p_booking_id text, p_session_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_old bookings%rowtype;
  v_new_session sessions%rowtype;
  v_reason text;
  v_now timestamptz := now();
  v_booking bookings%rowtype;
begin
  if v_actor is null then
    raise exception 'No autenticado';
  end if;
  select * into v_old from bookings where id = p_booking_id;
  if not found then
    raise exception 'Reserva no encontrada';
  end if;
  if v_old.user_id <> v_actor and not public.is_staff() then
    raise exception 'Sin permiso';
  end if;

  perform 1 from sessions
  where id in (v_old.session_id, p_session_id)
  order by id
  for update;
  select * into v_new_session from sessions where id = p_session_id;
  if not found then
    raise exception 'Sesión no encontrada';
  end if;
  perform 1 from profiles where id = v_old.user_id for update;

  -- Releer con las sesiones bloqueadas: pudo cambiar mientras tanto.
  select * into v_old from bookings where id = p_booking_id;
  if v_old.status not in ('confirmed', 'pending', 'waitlisted') then
    raise exception 'Esta reserva ya no está activa';
  end if;
  if v_new_session.starts_at <= v_now then
    raise exception 'Esa clase ya empezó';
  end if;
  if exists (
    select 1 from bookings
    where session_id = p_session_id and user_id = v_old.user_id
      and status in ('confirmed', 'pending', 'waitlisted')
  ) then
    raise exception 'Ya tienes reserva en esta sesión';
  end if;
  if exists (
    select 1
    from bookings b
    join sessions s on s.id = b.session_id
    where b.user_id = v_old.user_id
      and b.id <> p_booking_id
      and b.status in ('confirmed', 'pending')
      and s.starts_at < v_new_session.ends_at
      and s.ends_at > v_new_session.starts_at
  ) then
    raise exception 'Se solapa con otra reserva activa';
  end if;
  v_reason := public.member_booking_block_reason(v_old.user_id, v_new_session.zone_id, v_new_session.starts_at);
  if v_reason is not null then
    raise exception '%', v_reason;
  end if;
  -- Reagendar nunca deja en espera, con o sin lista de espera encendida.
  if public.session_seats_taken(p_session_id) >= v_new_session.capacity then
    raise exception 'La clase nueva está llena. Tu reserva actual no cambió.';
  end if;

  update bookings set status = 'cancelled', cancelled_at = v_now where id = p_booking_id;
  delete from waitlist_entries
  where session_id = v_old.session_id and user_id = v_old.user_id;
  insert into bookings (id, session_id, user_id, status, created_at, check_in_code)
  values (
    'bk-' || gen_random_uuid(), p_session_id, v_old.user_id, 'confirmed', v_now,
    public.new_check_in_code()
  )
  returning * into v_booking;
  perform public.promote_waitlist(v_old.session_id);
  return to_jsonb(v_booking);
end;
$$;

-- Check-in del socio (QR o código dictado) o de staff en recepción. Código, estado y
-- ventana se validan aquí: el socio ya no puede escribir check_ins ni bookings directo.
-- Ventana: desde check_in_window_minutes antes del inicio hasta 10 min después.
create or replace function public.check_in_booking(p_booking_id text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_booking bookings%rowtype;
  v_session sessions%rowtype;
  v_window int;
  v_now timestamptz := now();
  v_check_in check_ins%rowtype;
begin
  if v_actor is null then
    raise exception 'No autenticado';
  end if;
  select * into v_booking from bookings where id = p_booking_id;
  if not found then
    raise exception 'Reserva no encontrada';
  end if;
  if v_booking.user_id <> v_actor and not public.is_staff() then
    raise exception 'Sin permiso para este check-in';
  end if;

  select * into v_session from sessions where id = v_booking.session_id for update;
  select * into v_booking from bookings where id = p_booking_id for update;

  if v_booking.check_in_code is distinct from upper(trim(coalesce(p_code, ''))) then
    raise exception 'Código QR inválido';
  end if;
  if v_booking.status not in ('confirmed', 'pending') then
    raise exception 'La reserva no está activa';
  end if;
  select coalesce(check_in_window_minutes, 15) into v_window from gym_settings where id = 1;
  v_window := coalesce(v_window, 15);
  if v_now < v_session.starts_at - make_interval(mins => v_window)
    or v_now > v_session.starts_at + interval '10 minutes'
  then
    raise exception 'Fuera de la ventana de check-in';
  end if;

  insert into check_ins (id, booking_id, session_id, user_id, checked_in_at)
  values ('ci-' || gen_random_uuid(), v_booking.id, v_booking.session_id, v_booking.user_id, v_now)
  returning * into v_check_in;
  update bookings set status = 'attended' where id = v_booking.id;
  return to_jsonb(v_check_in);
end;
$$;

-- Todo lo de `public` queda expuesto como /rest/v1/rpc/<fn> (ver fix-function-grants.sql).
-- Los helpers solo los llaman las funciones de arriba, que corren como su dueño.
revoke all on function public.member_booking_block_reason(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.current_membership_id(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.booking_overlaps(uuid, text) from public, anon, authenticated;
revoke all on function public.waitlist_enabled() from public, anon, authenticated;
revoke all on function public.promote_waitlist(text) from public, anon, authenticated;
revoke all on function public.new_check_in_code() from public, anon, authenticated;
revoke all on function public.session_seats_taken(text) from public, anon, authenticated;
revoke all on function public.check_in_booking(text, text) from public, anon;
grant execute on function public.check_in_booking(text, text) to authenticated;
revoke all on function public.book_session(text, uuid) from public, anon;
grant execute on function public.book_session(text, uuid) to authenticated;
revoke all on function public.cancel_booking(text) from public, anon;
grant execute on function public.cancel_booking(text) to authenticated;
revoke all on function public.reschedule_booking(text, text) from public, anon;
grant execute on function public.reschedule_booking(text, text) to authenticated;

-- ZCAPP-56: las reservas activas creadas con el formato largo (QR_<uuid>) pasan al
-- corto. Idempotente: solo toca los códigos que aún tienen el formato viejo.
update bookings
set check_in_code = public.new_check_in_code()
where check_in_code like 'QR\_%' escape '\'
  and status in ('confirmed', 'pending', 'waitlisted');
