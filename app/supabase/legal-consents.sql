-- Registro de consentimientos (LOPDP Ecuador): quién aceptó qué documento, qué versión,
-- cuándo, dónde (registro, checkout, ficha) y desde qué navegador o app.
-- Ejecutar en SQL Editor de Supabase DESPUÉS de schema.sql. Idempotente.
--
-- El registro es de solo agregar: nadie puede editar ni borrar una aceptación (ni el
-- socio ni el admin). La fecha la pone la base, no el dispositivo. Al eliminar la cuenta
-- se borran en cascada con el perfil.

create table if not exists public.legal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document text not null check (document in ('terms', 'privacy', 'health_data', 'refund')),
  version text not null check (length(version) between 1 and 200),
  context text not null check (context in ('signup', 'checkout', 'ficha')),
  accepted_at timestamptz not null default now(),
  user_agent text check (user_agent is null or length(user_agent) <= 400)
);

create index if not exists idx_legal_consents_user on public.legal_consents(user_id, accepted_at desc);

alter table public.legal_consents enable row level security;

drop policy if exists "legal consents read own or staff" on public.legal_consents;
create policy "legal consents read own or staff" on public.legal_consents for select
using (user_id = auth.uid() or public.is_staff());
-- Sin políticas de insert/update/delete: solo se escribe con las funciones de abajo.

-- El socio registra su aceptación. La fecha y el navegador los toma el servidor.
create or replace function public.record_legal_consent(
  p_document text,
  p_version text,
  p_context text
)
returns public.legal_consents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.legal_consents;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  insert into public.legal_consents (user_id, document, version, context, user_agent)
  values (
    auth.uid(), p_document, p_version, p_context,
    left(coalesce(current_setting('request.headers', true)::json->>'user-agent', ''), 400)
  )
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.record_legal_consent(text, text, text) from public, anon;
grant execute on function public.record_legal_consent(text, text, text) to authenticated;

-- Al crear la cuenta, el perfil y las aceptaciones del registro se guardan juntos.
-- La app manda en los metadatos: consents = [{"document": "terms", "version": "1.0"}, ...]
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_consent jsonb;
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    birth_date,
    residence,
    height_cm,
    initial_weight_kg,
    goals,
    health_notes
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'member',
    (new.raw_user_meta_data->>'birth_date')::date,
    new.raw_user_meta_data->>'residence',
    (new.raw_user_meta_data->>'height_cm')::numeric,
    (new.raw_user_meta_data->>'initial_weight_kg')::numeric,
    new.raw_user_meta_data->>'goals',
    new.raw_user_meta_data->>'health_notes'
  )
  on conflict (id) do nothing;

  for v_consent in
    select value from jsonb_array_elements(coalesce(new.raw_user_meta_data->'consents', '[]'::jsonb))
  loop
    if v_consent->>'document' in ('terms', 'privacy') and coalesce(v_consent->>'version', '') <> '' then
      insert into public.legal_consents (user_id, document, version, context, user_agent)
      values (
        new.id, v_consent->>'document', left(v_consent->>'version', 200), 'signup',
        left(new.raw_user_meta_data->>'user_agent', 400)
      );
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;
