-- Habilita 'pagomedios' como proveedor de pago (pago único en línea).
-- Idempotente: correr en QA y prod antes de desplegar la Edge Function pagomedios-payment.
alter table payments drop constraint if exists payments_provider_check;
alter table payments
  add constraint payments_provider_check
  check (provider in ('manual', 'pagomedios'));
-- Desde quitar-mercadopago-datafast.sql ya no se aceptan 'datafast' ni 'mercadopago'.
