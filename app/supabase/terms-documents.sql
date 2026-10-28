-- PDF de TyC: lectura pública de documentos legales, publicación exclusiva de admin.
-- Ejecutar en el proyecto de destino antes de usar la carga desde Personalización.
begin;

alter table public.gym_settings
  add column if not exists terms_pdf_url text,
  add column if not exists terms_version text,
  add column if not exists terms_updated_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('legal-documents', 'legal-documents', true, 5242880, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "terms upload admin" on storage.objects;
create policy "terms upload admin" on storage.objects for insert to authenticated
with check (
  bucket_id = 'legal-documents'
  and name ~ '^terms/[0-9a-f-]+\.pdf$'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "terms read admin" on storage.objects;
create policy "terms read admin" on storage.objects for select to authenticated
using (
  bucket_id = 'legal-documents'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "terms delete admin" on storage.objects;
create policy "terms delete admin" on storage.objects for delete to authenticated
using (
  bucket_id = 'legal-documents'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- No se concede UPDATE: cada publicación tiene un archivo distinto.
-- gym_settings ya restringe sus escrituras al rol admin mediante sus políticas existentes.
commit;
