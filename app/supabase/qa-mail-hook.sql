-- ============================================================================
-- Send Email hook — SOLO PARA QA / STAGING (proyecto zona-cero)
-- ============================================================================
-- Intercepta los correos de Supabase Auth y en vez de enviarlos guarda el enlace
-- en qa_mail.sent. Consultar con:  select * from qa_mail.enlaces;
--
-- Motivo: el servicio de correo integrado de Supabase permite 2 correos por hora
-- por proyecto, compartidos entre todos los tipos. Probar recuperación de
-- contraseña agota el cupo al instante (429 over_email_send_rate_limit).
--
-- ¡¡ NO APLICAR EN PRODUCCIÓN !!
-- Con el hook activo Supabase deja de enviar correos por completo y falla en
-- silencio: la app sigue diciendo «enlace enviado». En producción no se activa el
-- hook y se configura SMTP propio. Por eso este archivo NO forma parte de
-- schema.sql: así zona-cero-prod no hereda ni la función.
--
-- Diseño: docs/superpowers/specs/2026-09-19-qa-mail-hook-design.md
-- ============================================================================

-- Fuera de `public` a propósito: PostgREST expone `public` en /rest/v1/ y esta
-- tabla guarda tokens de un solo uso que permiten fijar la contraseña de una
-- cuenta. Un schema no expuesto no es alcanzable con la anon key.
create schema if not exists qa_mail;

create table if not exists qa_mail.sent (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  email_action_type text not null,
  recipient text,
  token text,
  token_hash text,
  redirect_to text,
  site_url text,
  payload jsonb not null
);

create index if not exists idx_qa_mail_sent_created_at
  on qa_mail.sent (created_at desc);

-- La tabla guarda hechos crudos; la vista arma la URL. Así el formato del enlace
-- vive en un solo lugar y la tabla no queda atada a él.
-- La base es la del servidor de Auth del proyecto, NO el `site_url` del payload:
-- ese campo es la Site URL de la app (a dónde vuelve el socio), no de dónde se
-- valida el token. Este archivo es exclusivo del proyecto QA, así que el ref va
-- literal.
create or replace view qa_mail.enlaces as
select
  s.created_at              as fecha,
  s.email_action_type       as tipo,
  s.recipient               as correo,
  'https://kqhmclbexnnsbzbgerbx.supabase.co/auth/v1/verify'
    || '?token=' || s.token_hash
    || '&type=' || s.email_action_type
    || '&redirect_to=' || s.redirect_to
                            as enlace,
  s.token                   as codigo_otp
from qa_mail.sent s
order by s.created_at desc;

-- Sin `security definer`: los Auth Hooks recomiendan otorgar privilegios
-- explícitos a supabase_auth_admin en lugar de heredar los del dueño.
-- `search_path = ''` porque todas las referencias van calificadas (`qa_mail.sent`);
-- pg_catalog se busca siempre, así que `now()` sigue resolviendo.
create or replace function qa_mail.send_email_hook(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  insert into qa_mail.sent (
    email_action_type,
    recipient,
    token,
    token_hash,
    redirect_to,
    site_url,
    payload
  )
  values (
    event -> 'email_data' ->> 'email_action_type',
    event -> 'user' ->> 'email',
    event -> 'email_data' ->> 'token',
    event -> 'email_data' ->> 'token_hash',
    event -> 'email_data' ->> 'redirect_to',
    event -> 'email_data' ->> 'site_url',
    event
  );

  -- Retención: los tokens no deben acumularse indefinidamente.
  delete from qa_mail.sent where created_at < now() - interval '7 days';

  -- Respuesta vacía sin error = «ya lo envié yo», Supabase no manda nada.
  return '{}'::jsonb;
end;
$$;

-- El rol con el que Supabase Auth consulta la base.
grant usage on schema qa_mail to supabase_auth_admin;
grant execute on function qa_mail.send_email_hook(jsonb) to supabase_auth_admin;
grant select, insert, delete on qa_mail.sent to supabase_auth_admin;

-- Un schema nuevo no otorga usage a PUBLIC, pero se deja explícito.
revoke all on schema qa_mail from public;
revoke all on function qa_mail.send_email_hook(jsonb) from public;
revoke all on function qa_mail.send_email_hook(jsonb) from anon;
revoke all on function qa_mail.send_email_hook(jsonb) from authenticated;

-- ============================================================================
-- Después de aplicar esto, en el dashboard de Supabase:
--   1. Authentication → Hooks → Send Email → Postgres function
--      schema `qa_mail`, función `send_email_hook`
--   2. Authentication → Rate Limits → subir `rate_limit_email_sent`
--      (se vuelve configurable al existir el hook)
-- ============================================================================
