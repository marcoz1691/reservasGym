-- Interruptor del pago recurrente mensual con Pagomedios (Adenda N.º 1).
-- Ejecutar en SQL Editor de Supabase DESPUÉS de feature-flags.sql. Idempotente.
--
-- recurring_payments_enabled: nace apagado. El admin lo enciende en Marca & Config →
--   Funciones de la app cuando el gimnasio contrata la recurrencia con Pagomedios.
--   Solo se ofrece con el pago en línea también encendido. pagomedios-payment (create
--   con recurring) lo revisa con service role; verify y notify no, para no perder
--   un registro de tarjeta en curso. Las políticas de gym_settings (feature-flags.sql)
--   ya dejan que solo el admin lo cambie.

alter table gym_settings add column if not exists recurring_payments_enabled boolean not null default false;
