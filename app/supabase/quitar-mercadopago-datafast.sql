-- Se retiran las pasarelas en línea MercadoPago y Datafast Dataweb: el pago en línea es
-- solo Pagomedios. El datáfono físico Datafast de recepción NO cambia (es un pago
-- 'manual' con manual_method 'card_pos'). Idempotente.
-- Antes de aplicarla, confirmar que no hay pagos con provider 'datafast' o 'mercadopago':
--   select provider, count(*) from payments group by provider;

-- 1. Solo pagos manuales y de Pagomedios.
alter table payments drop constraint if exists payments_provider_check;
alter table payments
  add constraint payments_provider_check
  check (provider in ('manual', 'pagomedios'));

-- 2. mp_payment_id era único para no duplicar los avisos de MercadoPago. Pagomedios guarda
--    ahí el código de autorización del banco (6 dígitos), que se repite entre
--    transacciones: el índice único podía impedir aprobar un pago ya cobrado.
drop index if exists idx_payments_mp_payment_id;
