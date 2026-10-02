-- ReservasGym Avanzada — schema completo + RLS
-- Zona Cero Performance Center
-- Ejecutar en el SQL editor de Supabase.

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABLAS PRINCIPALES
-- ============================================================================

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('member', 'staff', 'admin')) default 'member',
  birth_date date,
  residence text,
  height_cm numeric(5,1),
  initial_weight_kg numeric(5,2),
  goals text,
  health_notes text,
  created_at timestamptz not null default now()
);

create table if not exists gym_settings (
  id int primary key default 1 check (id = 1),
  name text not null,
  logo_url text,
  primary_color text not null default '#0B3D2E',
  accent_color text not null default '#2DD4A8',
  booking_window_hours int not null default 168,
  cancel_window_hours int not null default 2,
  check_in_window_minutes int not null default 15,
  -- Interruptores del admin (feature-flags.sql)
  online_payments_enabled boolean not null default false,
  waitlist_enabled boolean not null default true,
  measurements_enabled boolean not null default true,
  day_passes_enabled boolean not null default true
);

create table if not exists trainers (
  id text primary key,
  full_name text not null,
  specialties text[] not null default '{}'
);

create table if not exists zones (
  id text primary key,
  name text not null,
  type text not null,
  description text,
  default_capacity int not null,
  image_hint text
);

create table if not exists class_templates (
  id text primary key,
  zone_id text not null references zones(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('class', 'preparation', 'open')),
  duration_minutes int not null,
  capacity int not null,
  trainer_id text references trainers(id)
);

create table if not exists sessions (
  id text primary key,
  template_id text not null references class_templates(id) on delete cascade,
  zone_id text not null references zones(id) on delete cascade,
  title text not null,
  kind text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity int not null,
  trainer_id text references trainers(id),
  booked_count int not null default 0
);

create table if not exists bookings (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check_in_code text not null
);

-- El socio no puede UPDATE sessions (RLS staff-only). El cupo se sincroniza aquí.
create or replace function public.sync_session_booked_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sid text;
begin
  sid := coalesce(NEW.session_id, OLD.session_id);
  update public.sessions
  set booked_count = (
    select count(*)::int
    from public.bookings
    where session_id = sid and status in ('confirmed', 'pending', 'attended')
  )
  where id = sid;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists bookings_sync_booked_count on bookings;
create trigger bookings_sync_booked_count
after insert or update of status or delete on bookings
for each row execute function public.sync_session_booked_count();

-- Crear y cancelar reservas (cupo, lista de espera y promoción) va por las funciones
-- book_session / cancel_booking / reschedule_booking de booking-rpc.sql, que se ejecuta después de este archivo.

create table if not exists waitlist_entries (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  position int not null,
  created_at timestamptz not null default now()
);

create table if not exists check_ins (
  id text primary key,
  booking_id text not null references bookings(id) on delete cascade,
  session_id text not null references sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  checked_in_at timestamptz not null default now()
);

create table if not exists body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  recorded_by uuid references profiles(id) on delete set null,
  weight_kg numeric(6,2) not null,
  height_cm numeric(5,1),
  bmi numeric(4,1),
  waist_cm numeric(5,1),
  hip_cm numeric(5,1),
  chest_cm numeric(5,1),
  arm_cm numeric(5,1),
  thigh_cm numeric(5,1),
  measured_at timestamptz not null,
  notes text
);

create table if not exists body_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  target_weight_kg numeric(6,2) not null,
  target_bmi numeric(4,1),
  target_date date not null,
  status text not null default 'active' check (status in ('active', 'achieved', 'cancelled')),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 2. TABLAS AVANZADA (MEMBRESÍAS Y PAGOS)
-- ============================================================================

create table if not exists membership_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_cents int not null,
  duration_days int not null,
  visit_quota int,
  allowed_zone_ids text[] not null default '{}',
  active boolean not null default true,
  -- 'day_pass': pase del día (fila aparte hasta las 23:59 de Guayaquil). Ver plan-rules.sql.
  kind text not null default 'membership' check (kind in ('membership', 'day_pass')),
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  plan_id uuid references membership_plans(id) not null,
  status text not null check (status in ('active', 'grace', 'expired', 'cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  visits_left int,
  grace_ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  plan_id uuid references membership_plans(id) not null,
  membership_id uuid references memberships(id) on delete set null,
  amount_cents int not null,
  status text not null check (status in ('pending', 'approved', 'rejected', 'refunded')),
  provider text not null check (provider in ('manual', 'datafast', 'mercadopago', 'pagomedios')),
  manual_method text check (manual_method in ('cash', 'transfer', 'card_pos')),
  reference text,
  mp_payment_id text,
  notes text,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

-- Índices de optimización
create index if not exists idx_memberships_user_id on memberships(user_id);
create index if not exists idx_memberships_user_dates on memberships(user_id, starts_at, ends_at);
create index if not exists idx_memberships_status on memberships(status);
create index if not exists idx_payments_user_id on payments(user_id);
create index if not exists idx_payments_status on payments(status);
create unique index if not exists idx_payments_mp_payment_id on payments (mp_payment_id) where mp_payment_id is not null;

-- ============================================================================
-- 3. FUNCIONES Y PROCEDURES
-- ============================================================================

-- Helper para verificar si el usuario es staff o admin (SECURITY DEFINER evita recursión RLS)
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

-- Vive en `public`, así que PostgREST la expone como /rest/v1/rpc/is_staff. Se cierra
-- el acceso anónimo; `authenticated` la conserva porque las políticas RLS de abajo se
-- evalúan con los privilegios del rol que consulta y sin EXECUTE fallarían todas.
revoke all on function public.is_staff() from public;
revoke all on function public.is_staff() from anon;
grant execute on function public.is_staff() to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Solo admin asigna o cambia roles. Sin sesión (auth.uid() null) es SQL Editor,
-- service_role o el alta de usuario.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' and new.role is distinct from 'member' then
    raise exception 'Solo un admin puede asignar roles';
  end if;
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    raise exception 'Solo un admin puede cambiar roles';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_profile_role() from public, anon, authenticated;

drop trigger if exists profiles_guard_role on profiles;
create trigger profiles_guard_role
before insert or update of role on profiles
for each row execute function public.guard_profile_role();

-- Soporte de eliminación de cuenta (Apple App Store Guideline 5.1.1(v))
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

  -- Eliminar de auth.users (cascada a profiles y todos los datos asociados)
  delete from auth.users where id = v_user_id;

  -- Fallback en caso de que auth.users no propague inmediatamente
  delete from public.profiles where id = v_user_id;
end;
$$;

-- El revoke a `anon` es necesario aparte: los default privileges de Supabase otorgan
-- EXECUTE explícito a anon/authenticated/service_role al crear la función.
revoke all on function public.delete_user_account() from public;
revoke all on function public.delete_user_account() from anon;
grant execute on function public.delete_user_account() to authenticated;

-- Manejo de creación de perfil al registrar nuevo usuario en auth.users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    birth_date,
    residence,
    height_cm,
    initial_weight_kg,
    goals,
    health_notes
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'member',
    (new.raw_user_meta_data->>'birth_date')::date,
    new.raw_user_meta_data->>'residence',
    (new.raw_user_meta_data->>'height_cm')::numeric,
    (new.raw_user_meta_data->>'initial_weight_kg')::numeric,
    new.raw_user_meta_data->>'goals',
    new.raw_user_meta_data->>'health_notes'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Solo la debe ejecutar el trigger. GoTrue inserta en auth.users como
-- supabase_auth_admin, que no es superusuario: necesita el grant explícito, porque
-- al revocar PUBLIC se queda sin el permiso heredado y el registro no crearía perfil.
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) Y POLÍTICAS
-- ============================================================================

alter table profiles enable row level security;
alter table gym_settings enable row level security;
alter table trainers enable row level security;
alter table zones enable row level security;
alter table class_templates enable row level security;
alter table sessions enable row level security;
alter table bookings enable row level security;
alter table waitlist_entries enable row level security;
alter table check_ins enable row level security;
alter table body_measurements enable row level security;
alter table body_goals enable row level security;
alter table membership_plans enable row level security;
alter table memberships enable row level security;
alter table payments enable row level security;

-- Profiles: miembros leen/actualizan su propio perfil; staff lee/gestiona todos
create policy "profiles read self or staff" on profiles for select using (
  id = auth.uid() or public.is_staff()
);

create policy "profiles update self or staff" on profiles for update
  using (id = auth.uid() or public.is_staff())
  with check (
    (id = auth.uid() and role = (select p.role from profiles p where p.id = auth.uid()))
    or public.is_staff()
  );

-- Settings: todos leen (incluye los interruptores de la app); solo admin escribe
create policy "settings read all auth" on gym_settings for select to authenticated using (true);
create policy "settings write admin" on gym_settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Catálogo (Zonas, Plantillas, Sesiones, Entrenadores)
create policy "catalog read" on zones for select to authenticated using (true);
create policy "catalog write" on zones for all using (public.is_staff());
create policy "templates read" on class_templates for select to authenticated using (true);
create policy "templates write" on class_templates for all using (public.is_staff());
create policy "sessions read" on sessions for select to authenticated using (true);
create policy "sessions write" on sessions for all using (public.is_staff());
create policy "trainers read" on trainers for select to authenticated using (true);
create policy "trainers write" on trainers for all using (public.is_staff());

-- Reservas, lista de espera y check-ins: el socio solo lee. Escribe vía RPC
-- (book_session, cancel_booking, reschedule_booking, check_in_booking en booking-rpc.sql).
create policy "bookings own or staff" on bookings for select using (
  user_id = auth.uid() or public.is_staff()
);
create policy "bookings insert staff" on bookings for insert to authenticated
  with check (public.is_staff());
create policy "bookings update staff" on bookings for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "waitlist own or staff" on waitlist_entries for select using (
  user_id = auth.uid() or public.is_staff()
);
create policy "waitlist write staff" on waitlist_entries for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "checkins own or staff" on check_ins for select using (
  user_id = auth.uid() or public.is_staff()
);
create policy "checkins write staff" on check_ins for insert to authenticated
  with check (public.is_staff());

-- Mediciones de peso y antropometría
create policy "weight own or staff" on body_measurements for select using (
  user_id = auth.uid() or public.is_staff()
);
create policy "weight insert" on body_measurements for insert with check (
  user_id = auth.uid() or public.is_staff()
);
create policy "weight update" on body_measurements for update using (
  user_id = auth.uid() or public.is_staff()
);
create policy "weight delete" on body_measurements for delete using (
  user_id = auth.uid() or public.is_staff()
);

-- Metas corporales (Body Goals)
create policy "body_goals own or staff" on body_goals for select using (
  user_id = auth.uid() or public.is_staff()
);
create policy "body_goals insert" on body_goals for insert with check (
  user_id = auth.uid() or public.is_staff()
);
create policy "body_goals update" on body_goals for update using (
  user_id = auth.uid() or public.is_staff()
);
create policy "body_goals delete" on body_goals for delete using (
  user_id = auth.uid() or public.is_staff()
);

-- Planes de membresía: lectura de planes activos; escritura solo admin
create policy "membership_plans read active or staff" on membership_plans for select using (
  active = true or public.is_staff()
);
create policy "membership_plans write admin" on membership_plans for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Membresías: socio ve la suya; staff ve y gestiona todas
create policy "memberships select own or staff" on memberships for select using (
  user_id = auth.uid() or public.is_staff()
);
create policy "memberships write staff" on memberships for all using (
  public.is_staff()
);

-- Pagos: socio ve sus pagos; staff ve y gestiona todos
create policy "payments select own or staff" on payments for select using (
  user_id = auth.uid() or public.is_staff()
);
create policy "payments write staff" on payments for all using (
  public.is_staff()
);
-- plan_sellable_in_app (feature-flags.sql) y plan_purchase_block_reason (plan-rules.sql)
-- se agregan al aplicar esas migraciones.
create policy "payments insert own plan request" on payments for insert with check (
  user_id = auth.uid()
  and status = 'pending'
  and provider = 'manual'
  and membership_id is null
);
create policy "payments update own plan request" on payments for update using (
  user_id = auth.uid() and status = 'pending' and provider = 'manual'
) with check (
  user_id = auth.uid()
  and status = 'pending'
  and provider = 'manual'
  and membership_id is null
);
