-- mp_payment_id es único para MercadoPago y Datafast (sus ids de pago no se repiten y
-- mp-webhook los usa para no duplicar). En Pagomedios guarda el código de autorización
-- del banco (6 dígitos), que sí se repite entre transacciones: con el índice único, un
-- código repetido impedía aprobar un pago ya cobrado. Se excluye Pagomedios del índice.
-- Idempotente. pagomedios-payment ya tolera el código repetido (aprueba sin guardarlo);
-- con esta migración el código se conserva siempre.

drop index if exists idx_payments_mp_payment_id;
create unique index if not exists idx_payments_mp_payment_id on payments (mp_payment_id)
  where mp_payment_id is not null and provider <> 'pagomedios';
