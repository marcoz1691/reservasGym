-- Débito recurrente de Pagomedios como medio manual (ZCAPP-76).
-- Ejecutar en SQL Editor de Supabase DESPUÉS de manual-payments-deuna.sql, feature-flags.sql y plan-rules.sql. Idempotente.
--
-- La app cobra solo el primer mes del pago recurrente; los meses siguientes los cobra
-- Pagomedios y la app no se entera. Recepción ve el cobro en el panel de Pagomedios y
-- renueva el plan en Cobros → Registrar cobro con este método, para que cuadre en caja.

alter table payments drop constraint if exists payments_manual_method_check;
alter table payments
  add constraint payments_manual_method_check
  check (manual_method in ('cash', 'transfer', 'card_pos', 'deuna', 'pagomedios_debit'));

-- Mismas políticas que feature-flags.sql, y además el socio no puede pedir un plan con
-- este método: solo lo registra recepción.
drop policy if exists "payments insert own plan request" on payments;
create policy "payments insert own plan request" on payments for insert with check (
  user_id = auth.uid()
  and status = 'pending'
  and provider = 'manual'
  and membership_id is null
  and public.plan_sellable_in_app(plan_id)
  and public.plan_purchase_block_reason(user_id, plan_id) is null
  and manual_method is distinct from 'pagomedios_debit'
);

drop policy if exists "payments update own plan request" on payments;
create policy "payments update own plan request" on payments for update using (
  user_id = auth.uid() and status = 'pending' and provider = 'manual'
) with check (
  user_id = auth.uid()
  and status = 'pending'
  and provider = 'manual'
  and membership_id is null
  and public.plan_sellable_in_app(plan_id)
  and public.plan_purchase_block_reason(user_id, plan_id) is null
  and manual_method is distinct from 'pagomedios_debit'
);
