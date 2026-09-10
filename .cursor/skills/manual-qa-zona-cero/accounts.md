# Staging test accounts — Zona Cero

| Rol | Email | Password |
|-----|-------|----------|
| Socio (member) | `socio.staging@zonacero.test` | `ZonaCero2026!` |
| Recepción (staff) | `staff.staging@zonacero.test` | `ZonaCero2026!` |
| Administrador | `admin.staging@zonacero.test` | `ZonaCero2026!` |

Created via Supabase Auth + `app/supabase/staging-users.sql`.

If login fails: verify user exists in Auth, profile role in `profiles`, and run `fix-is-staff-rls.sql` if RLS errors appear.
