-- Solicitud de plan del socio: el monto y los campos de servidor no los decide el socio
-- (auditoría appsec 2026-10-01: AC-005 / BL-007).
-- Ejecutar en SQL Editor de Supabase DESPUÉS de pago-recurrente-manual.sql y security-hardening.sql. Idempotente.
--
-- Las políticas "payments insert/update own plan request" dejan al socio escribir su
-- solicitud pendiente; este trigger fija lo que recepción luego ve al cobrar:
-- monto = precio del plan, sin aprobación, sin notas ni id de pasarela.
-- Staff, admin y service_role (Edge Functions) no pasan por aquí. Tampoco las filas que no son
-- una solicitud pendiente: la RLS no deja al socio escribirlas, así que solo llegan desde
-- funciones SECURITY DEFINER como delete_user_account(), que anonimiza cobros aprobados y no
-- debe tocar su monto ni su fecha de aprobación.

create or replace function public.guard_member_plan_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_staff() then
    return new;
  end if;
  if not (new.status = 'pending' and new.provider = 'manual' and new.membership_id is null) then
    return new;
  end if;
  select price_cents into new.amount_cents from membership_plans where id = new.plan_id;
  if new.amount_cents is null then
    raise exception 'Plan no encontrado';
  end if;
  new.approved_at := null;
  new.mp_payment_id := null;
  new.notes := null;
  return new;
end;
$$;
revoke all on function public.guard_member_plan_request() from public, anon, authenticated;

drop trigger if exists payments_guard_member_request on payments;
create trigger payments_guard_member_request
before insert or update on payments
for each row execute function public.guard_member_plan_request();
