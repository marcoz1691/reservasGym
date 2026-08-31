-- Seed datos para ReservasGym Avanzada (Zona Cero Performance Center)
-- Ejecutar después de schema.sql

-- 1. Configuración del gimnasio
insert into gym_settings (id, name, logo_url, primary_color, accent_color, booking_window_hours, cancel_window_hours, check_in_window_minutes)
values (1, 'Zona Cero Performance Center', null, '#0B3D2E', '#2DD4A8', 168, 2, 15)
on conflict (id) do update set
  name = excluded.name,
  primary_color = excluded.primary_color,
  accent_color = excluded.accent_color;

-- 2. Entrenadores
insert into trainers (id, full_name, specialties) values
  ('tr-1', 'Diana Coach', array['crossfit','hyrox','musculacion','dragon_fit']),
  ('tr-2', 'Pedro Fisio', array['fisioterapia','nutricion']),
  ('tr-3', 'Lucía Dance', array['bailoterapia'])
on conflict (id) do update set
  full_name = excluded.full_name,
  specialties = excluded.specialties;

-- 3. Zonas / Disciplinas (8 oficiales + Dragon Fit)
insert into zones (id, name, type, description, default_capacity, image_hint) values
  ('zone-gimnasio', 'Gimnasio', 'gimnasio', 'Áreas con mayor seguimiento y reserva libre.', 40, 'floor'),
  ('zone-fisio', 'Fisioterapia', 'fisioterapia', 'Consultas y sesiones de rehabilitación.', 4, 'rehab'),
  ('zone-nutri', 'Nutrición', 'nutricion', 'Citas y asesorías con nutricionista.', 3, 'nutrition'),
  ('zone-bailo', 'Bailoterapia', 'bailoterapia', 'Clases grupales de baile terapéutico.', 20, 'dance'),
  ('zone-dragon-fit', 'Dragon Fit', 'dragon_fit', 'Clases y entrenamiento funcional de alta intensidad Dragon Fit.', 20, 'fight'),
  ('zone-comunes', 'Áreas comunes', 'comunes', 'Sauna, duchas y espacios compartidos.', 15, 'common'),
  ('zone-hyrox', 'Hyrox', 'hyrox', 'Clases y preparación Hyrox.', 16, 'hyrox'),
  ('zone-muscu', 'Musculación', 'musculacion', 'Sala de pesas y máquinas.', 30, 'weights'),
  ('zone-crossfit', 'CrossFit', 'crossfit', 'Clases y preparación CrossFit.', 18, 'box')
on conflict (id) do update set
  name = excluded.name,
  type = excluded.type,
  description = excluded.description,
  default_capacity = excluded.default_capacity,
  image_hint = excluded.image_hint;

-- 4. Plantillas de clases
insert into class_templates (id, zone_id, title, kind, duration_minutes, capacity, trainer_id) values
  ('tpl-gym-open', 'zone-gimnasio', 'Acceso libre gimnasio', 'open', 60, 40, null),
  ('tpl-fisio', 'zone-fisio', 'Sesión fisioterapia', 'class', 45, 1, 'tr-2'),
  ('tpl-nutri', 'zone-nutri', 'Consulta nutrición', 'class', 40, 1, 'tr-2'),
  ('tpl-bailo', 'zone-bailo', 'Bailoterapia', 'class', 55, 20, 'tr-3'),
  ('tpl-dragon-fit', 'zone-dragon-fit', 'Dragon Fit — sesión grupal', 'class', 50, 20, 'tr-1'),
  ('tpl-comunes', 'zone-comunes', 'Reserva área común', 'open', 45, 15, null),
  ('tpl-hyrox-class', 'zone-hyrox', 'Hyrox — clase', 'class', 60, 16, 'tr-1'),
  ('tpl-hyrox-prep', 'zone-hyrox', 'Hyrox — preparación', 'preparation', 45, 12, 'tr-1'),
  ('tpl-muscu', 'zone-muscu', 'Bloque musculación', 'open', 90, 30, null),
  ('tpl-cf-class', 'zone-crossfit', 'CrossFit — clase', 'class', 60, 18, 'tr-1'),
  ('tpl-cf-prep', 'zone-crossfit', 'CrossFit — preparación', 'preparation', 45, 12, 'tr-1')
on conflict (id) do update set
  zone_id = excluded.zone_id,
  title = excluded.title,
  kind = excluded.kind,
  duration_minutes = excluded.duration_minutes,
  capacity = excluded.capacity,
  trainer_id = excluded.trainer_id;

-- 5. Planes de membresía semilla para Zona Cero
insert into membership_plans (id, name, price_cents, duration_days, visit_quota, allowed_zone_ids, active) values
  ('11111111-1111-4111-8111-111111111111', 'Plan Mensual Ilimitado', 4500, 30, null, '{}', true),
  ('22222222-2222-4222-8222-222222222222', 'Plan Trimestral', 12000, 90, null, '{}', true),
  ('33333333-3333-4333-8333-333333333333', 'Pase 10 Visitas', 3500, 60, 10, '{}', true),
  ('44444444-4444-4444-8444-444444444444', 'Dragon Fit Mensual', 5000, 30, null, array['zone-dragon-fit', 'zone-gimnasio', 'zone-muscu'], true)
on conflict (id) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  duration_days = excluded.duration_days,
  visit_quota = excluded.visit_quota,
  allowed_zone_ids = excluded.allowed_zone_ids,
  active = excluded.active;
