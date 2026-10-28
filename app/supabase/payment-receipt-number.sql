-- Número de comprobante corto y numérico (ZCAPP-77).
-- Ejecutar en SQL Editor de Supabase (QA y prod) ANTES de desplegar la app y la función
-- pagomedios-payment que lo muestran. Idempotente.
--
-- El id (uuid) sigue siendo la llave técnica; receipt_number es lo que se muestra
-- (000123). Lo da una secuencia: nunca se repite ni se reutiliza, aunque el pago se
-- rechace o se borre. Los pagos existentes se numeran por fecha de creación.

create sequence if not exists public.payment_receipt_seq;

alter table public.payments add column if not exists receipt_number bigint;

with numbered as (
  select
    id,
    row_number() over (order by created_at, id)
      + coalesce((select max(receipt_number) from public.payments), 0) as n
  from public.payments
  where receipt_number is null
)
update public.payments p
set receipt_number = numbered.n
from numbered
where p.id = numbered.id;

select setval(
  'public.payment_receipt_seq',
  greatest(coalesce((select max(receipt_number) from public.payments), 0), 1),
  (select count(*) > 0 from public.payments)
);

alter table public.payments
  alter column receipt_number set default nextval('public.payment_receipt_seq');
alter table public.payments alter column receipt_number set not null;
alter sequence public.payment_receipt_seq owned by public.payments.receipt_number;

create unique index if not exists payments_receipt_number_key on public.payments (receipt_number);

notify pgrst, 'reload schema';
