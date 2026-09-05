-- Fix urgente: recursión RLS en profiles tras login
-- Ejecutar en SQL Editor de Supabase (proyecto zona-cero)

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role in ('staff', 'admin')
  );
$$;
