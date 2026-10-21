-- Evidencia de aceptación de términos y condiciones en cada pago o solicitud de plan.
-- terms_version la envía la app (versión que el socio vio al marcar la casilla).
-- terms_accepted_at lo fija la base con now(): el cliente no puede adelantarlo ni cambiarlo.
-- Los pagos anteriores (y los que registra recepción en caja) quedan en null.
-- Ejecutar en el proyecto de destino (QA / prod). Es idempotente.
begin;

alter table public.payments
  add column if not exists terms_version text check (terms_version is null or char_length(terms_version) <= 40),
  add column if not exists terms_accepted_at timestamptz;

create or replace function public.stamp_payment_terms()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.terms_version is null then
    new.terms_accepted_at := null;
  elsif tg_op = 'INSERT' then
    new.terms_accepted_at := now();
  elsif new.terms_version is distinct from old.terms_version then
    new.terms_accepted_at := now();
  else
    new.terms_accepted_at := old.terms_accepted_at;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_stamp_terms on public.payments;
create trigger payments_stamp_terms
  before insert or update on public.payments
  for each row execute function public.stamp_payment_terms();

commit;
