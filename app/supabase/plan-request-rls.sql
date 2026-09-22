-- Solicitud de plan del socio (pago manual pendiente).
-- Ejecutar en el proyecto Supabase de staging si el schema ya estaba aplicado.

drop policy if exists "payments insert own plan request" on payments;
create policy "payments insert own plan request" on payments for insert with check (
  user_id = auth.uid()
  and status = 'pending'
  and provider = 'manual'
  and membership_id is null
);

drop policy if exists "payments update own plan request" on payments;
create policy "payments update own plan request" on payments for update using (
  user_id = auth.uid() and status = 'pending' and provider = 'manual'
) with check (
  user_id = auth.uid()
  and status = 'pending'
  and provider = 'manual'
  and membership_id is null
);
