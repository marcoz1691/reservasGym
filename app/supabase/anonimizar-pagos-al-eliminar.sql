-- Al eliminar la cuenta, los cobros se conservan anonimizados en vez de borrarse
-- (LOPDP: se borran los datos del socio; normativa contable/tributaria: se conserva el cobro).
-- Ejecutar en SQL Editor de Supabase DESPUÉS de schema.sql. Idempotente.
--
-- Aprobados y reembolsados: quedan sin socio, sin membresía y sin la cédula de la nota,
-- con monto, plan, medio, fecha y referencia. Pendientes y rechazados: se borran.
-- Misma regla que src/domain/rules/accountDeletion.ts.

alter table public.payments alter column user_id drop not null;
alter table public.payments drop constraint if exists payments_user_id_fkey;
alter table public.payments
  add constraint payments_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.payments
  where user_id = v_user_id and status not in ('approved', 'refunded');
  update public.payments set
    membership_id = null,
    notes = regexp_replace(notes, '\(ID [^)]*\)', '(ID eliminado)', 'g')
  where user_id = v_user_id;

  -- Eliminar de auth.users (cascada a profiles y sus datos; los pagos quedan con user_id nulo)
  delete from auth.users where id = v_user_id;

  -- Fallback en caso de que auth.users no propague inmediatamente
  delete from public.profiles where id = v_user_id;
end;
$$;

revoke all on function public.delete_user_account() from public;
revoke all on function public.delete_user_account() from anon;
grant execute on function public.delete_user_account() to authenticated;
