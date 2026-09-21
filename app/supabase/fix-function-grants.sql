-- Endurece los permisos de las funciones SECURITY DEFINER del schema public.
-- Origen: advisors de seguridad de Supabase (lints 0011, 0028 y 0029), 2026-09-19.
-- Todo lo que vive en `public` queda expuesto por PostgREST como /rest/v1/rpc/<fn>,
-- así que una función SECURITY DEFINER ahí es invocable por cualquiera que tenga
-- la anon key. Ejecutar en SQL Editor de Supabase (proyecto zona-cero).

-- 1. is_staff()
-- La usan ~30 políticas RLS. Las expresiones de las políticas se evalúan con los
-- privilegios del rol que consulta, así que `authenticated` DEBE conservar EXECUTE
-- o la app entera deja de poder leer. Solo se cierra el acceso anónimo.
revoke all on function public.is_staff() from public;
revoke all on function public.is_staff() from anon;
grant execute on function public.is_staff() to authenticated;

-- 2. handle_new_user()
-- Es el trigger de auth.users que crea el perfil al registrarse; nadie debe poder
-- invocarla por RPC. GoTrue inserta el usuario como supabase_auth_admin, que hoy
-- solo tiene EXECUTE heredado de PUBLIC: sin este grant explícito, revocar PUBLIC
-- deja el registro de socios sin poder crear el perfil.
alter function public.handle_new_user() set search_path = public;
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- 3. delete_user_account()
-- schema.sql ya revocaba PUBLIC, pero los default privileges de Supabase dejaron
-- un grant explícito a anon. La función aborta con 'Not authenticated' si auth.uid()
-- es null, así que no había exposición real, pero el grant no tiene razón de existir.
revoke all on function public.delete_user_account() from anon;
grant execute on function public.delete_user_account() to authenticated;
