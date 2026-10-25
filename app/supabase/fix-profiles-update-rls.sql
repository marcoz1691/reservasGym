-- El socio no podía guardar su perfil: PATCH profiles respondía 500
-- «infinite recursion detected in policy for relation "profiles"» (42P17), detectado en la QA de ZCAPP-83.
-- La política de UPDATE consultaba profiles dentro de su propio WITH CHECK para impedir que el
-- socio cambiara su rol; Postgres no admite que una política lea su misma tabla.
-- Ese control ya lo hace el trigger profiles_guard_role (security-hardening.sql): solo un admin
-- asigna o cambia roles. La política queda en «el propio perfil o staff».
-- Ejecutar en QA y prod. Idempotente.

alter policy "profiles update self or staff" on public.profiles
  using (((id = (select auth.uid())) OR (select is_staff())))
  with check (((id = (select auth.uid())) OR (select is_staff())));

notify pgrst, 'reload schema';
