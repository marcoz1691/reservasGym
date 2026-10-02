-- Pago con Deuna y transferencia, con comprobante por WhatsApp (Parte B del plan de pagos).
-- Ejecutar en SQL Editor de Supabase DESPUÉS de feature-flags.sql. Idempotente.
--
-- Datos de pago que el admin carga en Marca del gym → Datos de pago. Todos opcionales:
-- la app no muestra lo que esté vacío (sin whatsapp_payments no hay botón de WhatsApp;
-- sin deuna_code ni deuna_qr_url no se ofrece Deuna). Los lee cualquier usuario con
-- sesión y solo admin los cambia (políticas de gym_settings en feature-flags.sql).

alter table gym_settings add column if not exists whatsapp_payments text;
alter table gym_settings add column if not exists bank_name text;
alter table gym_settings add column if not exists bank_account_type text;
alter table gym_settings add column if not exists bank_account_number text;
alter table gym_settings add column if not exists bank_account_holder text;
alter table gym_settings add column if not exists bank_account_id text;
alter table gym_settings add column if not exists deuna_code text;
alter table gym_settings add column if not exists deuna_qr_url text;

-- 'deuna' como medio manual: el socio paga con el QR o el código y recepción valida.
alter table payments drop constraint if exists payments_manual_method_check;
alter table payments
  add constraint payments_manual_method_check
  check (manual_method in ('cash', 'transfer', 'card_pos', 'deuna'));
