-- Usuarios de prueba STAGING (Zona Cero)
-- Ejecutar DESPUÉS de crear las cuentas en Supabase Auth (Authentication → Users)
-- y de haber corrido schema.sql + seed.sql
--
-- Crear en el dashboard con "Auto Confirm User" activado:
--   socio.staging@zonacero.test   / ZonaCero2026!
--   staff.staging@zonacero.test   / ZonaCero2026!
--   admin.staging@zonacero.test   / ZonaCero2026!
--
-- El trigger handle_new_user() crea el perfil como 'member'.
-- Este script eleva roles de staff y admin.

update public.profiles
set role = 'staff', full_name = 'Recepción Staging'
where email = 'staff.staging@zonacero.test';

update public.profiles
set role = 'admin', full_name = 'Admin Staging'
where email = 'admin.staging@zonacero.test';

update public.profiles
set full_name = 'Socio Demo Staging'
where email = 'socio.staging@zonacero.test';

-- Verificación rápida
select email, role, full_name from public.profiles
where email like '%staging@zonacero.test'
order by role;
