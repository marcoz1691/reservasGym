-- Límite de largo para los textos libres del perfil (auditoría de seguridad 2026-10-28).
-- El socio edita su perfil directo por la API: sin esto podría guardar textos de varios MB.
-- Ejecutar en el SQL Editor de QA/prod. Idempotente.
-- NOT VALID: aplica a inserciones y ediciones nuevas sin rechazar filas que ya existan.

alter table public.profiles drop constraint if exists profiles_full_name_len;
alter table public.profiles add constraint profiles_full_name_len
  check (char_length(full_name) <= 120) not valid;

alter table public.profiles drop constraint if exists profiles_residence_len;
alter table public.profiles add constraint profiles_residence_len
  check (residence is null or char_length(residence) <= 200) not valid;

alter table public.profiles drop constraint if exists profiles_phone_len;
alter table public.profiles add constraint profiles_phone_len
  check (phone is null or char_length(phone) <= 30) not valid;

alter table public.profiles drop constraint if exists profiles_goals_len;
alter table public.profiles add constraint profiles_goals_len
  check (goals is null or char_length(goals) <= 2000) not valid;

alter table public.profiles drop constraint if exists profiles_health_notes_len;
alter table public.profiles add constraint profiles_health_notes_len
  check (health_notes is null or char_length(health_notes) <= 2000) not valid;
