-- Datos iniciales de PRODUCCIÓN (proyecto zona-cero-prod).
-- Ejecutar después de schema.sql y booking-rpc.sql; luego planes-zona-cero.sql
-- para el catálogo comercial real.
--
-- Diferencias con seed.sql (QA): sin entrenadores ni planes de ejemplo. Las
-- plantillas quedan sin entrenador asignado: los reales se cargan desde el panel
-- de admin. El color de acento es el de marca que se fijó en QA (#f2740d).
-- Idempotente: se puede correr más de una vez.

insert into gym_settings (id, name, logo_url, primary_color, accent_color, booking_window_hours, cancel_window_hours, check_in_window_minutes)
values (1, 'Zona Cero Performance Center', null, '#0B3D2E', '#f2740d', 168, 2, 15)
on conflict (id) do update set
  name = excluded.name,
  primary_color = excluded.primary_color,
  accent_color = excluded.accent_color;

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

insert into class_templates (id, zone_id, title, kind, duration_minutes, capacity, trainer_id) values
  ('tpl-gym-open', 'zone-gimnasio', 'Acceso libre gimnasio', 'open', 60, 40, null),
  ('tpl-fisio', 'zone-fisio', 'Sesión fisioterapia', 'class', 45, 1, null),
  ('tpl-nutri', 'zone-nutri', 'Consulta nutrición', 'class', 40, 1, null),
  ('tpl-bailo', 'zone-bailo', 'Bailoterapia', 'class', 55, 20, null),
  ('tpl-dragon-fit', 'zone-dragon-fit', 'Dragon Fit — sesión grupal', 'class', 50, 20, null),
  ('tpl-comunes', 'zone-comunes', 'Reserva área común', 'open', 45, 15, null),
  ('tpl-hyrox-class', 'zone-hyrox', 'Hyrox — clase', 'class', 60, 16, null),
  ('tpl-hyrox-prep', 'zone-hyrox', 'Hyrox — preparación', 'preparation', 45, 12, null),
  ('tpl-muscu', 'zone-muscu', 'Bloque musculación', 'open', 90, 30, null),
  ('tpl-cf-class', 'zone-crossfit', 'CrossFit — clase', 'class', 60, 18, null),
  ('tpl-cf-prep', 'zone-crossfit', 'CrossFit — preparación', 'preparation', 45, 12, null)
on conflict (id) do update set
  zone_id = excluded.zone_id,
  title = excluded.title,
  kind = excluded.kind,
  duration_minutes = excluded.duration_minutes,
  capacity = excluded.capacity;
