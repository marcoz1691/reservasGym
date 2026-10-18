-- Celular opcional del socio: el admin lo usa para el botón "Recordar por WhatsApp" (Cobros → Vencimientos).
-- Ejecutar en el SQL Editor de QA/prod al publicar la funcionalidad. Es idempotente.
alter table profiles add column if not exists phone text;
