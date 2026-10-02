-- Interruptores de la app que el admin prende y apaga sin volver a publicar
-- (Partes C y D del plan de pagos). Ejecutar en SQL Editor de Supabase DESPUÉS de
-- security-hardening.sql. Idempotente: se puede correr más de una vez.
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
