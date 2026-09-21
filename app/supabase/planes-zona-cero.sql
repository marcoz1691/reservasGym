-- =============================================================================
-- Catálogo comercial Zona Cero (documento: INFORMACION DE PLANES)
-- Proyecto: zona-cero STAGING / QA
-- Ejecutar en: Supabase SQL Editor  o  MCP execute_sql
--
-- price_cents = USD × 100
-- allowed_zone_ids = '{}'  → todas las áreas
-- visit_quota = NULL       → ilimitado dentro de la vigencia
--
-- Lo que este catálogo SÍ cubre: nombre, precio, vigencia, áreas.
-- Lo que el Word pide y el modelo aún no tiene: horario L/M/V 05:30,
-- cupo de “1 vs 3 clases grupales”, citas de nutri/fisio, bebida semanal.
--
-- Zero Start Trimestral: el Word pone $63.75; el resto de planes usa
-- mensual × 3 × 15% off. Aquí se carga $38.25 (misma fórmula).
-- Semestral = 7 meses (6 pagados + 1 gratis). Anual = 14 meses (12 + 2).
-- =============================================================================

insert into membership_plans (id, name, price_cents, duration_days, visit_quota, allowed_zone_ids, active)
values
  -- ZERO START: clases funcionales (Gimnasio)
  ('c1000000-0000-4000-8000-000000000030', 'Zero Start Mensual',     1500,  30, null, array['zone-gimnasio'], true),
  ('c1000000-0000-4000-8000-000000000090', 'Zero Start Trimestral',  3825,  90, null, array['zone-gimnasio'], true),
  ('c1000000-0000-4000-8000-000000000210', 'Zero Start Semestral',   9000, 210, null, array['zone-gimnasio'], true),
  ('c1000000-0000-4000-8000-000000000420', 'Zero Start Anual',      18000, 420, null, array['zone-gimnasio'], true),

  -- ZERO ACTIVE: Start + musculación ilimitada + bailoterapia
  ('c2000000-0000-4000-8000-000000000030', 'Zero Active Mensual',     3500,  30, null, array['zone-gimnasio','zone-muscu','zone-bailo'], true),
  ('c2000000-0000-4000-8000-000000000090', 'Zero Active Trimestral',  8925,  90, null, array['zone-gimnasio','zone-muscu','zone-bailo'], true),
  ('c2000000-0000-4000-8000-000000000210', 'Zero Active Semestral',  21000, 210, null, array['zone-gimnasio','zone-muscu','zone-bailo'], true),
  ('c2000000-0000-4000-8000-000000000420', 'Zero Active Anual',      42000, 420, null, array['zone-gimnasio','zone-muscu','zone-bailo'], true),

  -- ZERO PRO: Active + Hyrox + 1 clase grupal (Dragon Fit como zona de grupales)
  ('c3000000-0000-4000-8000-000000000030', 'Zero Pro Mensual',     5500,  30, null, array['zone-gimnasio','zone-muscu','zone-bailo','zone-hyrox','zone-dragon-fit'], true),
  ('c3000000-0000-4000-8000-000000000090', 'Zero Pro Trimestral', 14025,  90, null, array['zone-gimnasio','zone-muscu','zone-bailo','zone-hyrox','zone-dragon-fit'], true),
  ('c3000000-0000-4000-8000-000000000210', 'Zero Pro Semestral',  33000, 210, null, array['zone-gimnasio','zone-muscu','zone-bailo','zone-hyrox','zone-dragon-fit'], true),
  ('c3000000-0000-4000-8000-000000000420', 'Zero Pro Anual',      66000, 420, null, array['zone-gimnasio','zone-muscu','zone-bailo','zone-hyrox','zone-dragon-fit'], true),

  -- ZERO ELITE: complejo completo (nutrición, fisio, recovery/comunes)
  ('c4000000-0000-4000-8000-000000000030', 'Zero Elite Mensual',     7500,  30, null, '{}', true),
  ('c4000000-0000-4000-8000-000000000090', 'Zero Elite Trimestral', 19125,  90, null, '{}', true),
  ('c4000000-0000-4000-8000-000000000210', 'Zero Elite Semestral',  45000, 210, null, '{}', true),
  ('c4000000-0000-4000-8000-000000000420', 'Zero Elite Anual',      90000, 420, null, '{}', true),

  -- PLAN DIARIO
  ('c5000000-0000-4000-8000-000000000001', 'Zona Day Musculación',  200, 1, null, array['zone-muscu'], true),
  ('c5000000-0000-4000-8000-000000000002', 'Zona Day Recovery',     500, 1, null, array['zone-comunes'], true),
  ('c5000000-0000-4000-8000-000000000003', 'Zona Day Full',        1000, 1, null, '{}', true)
on conflict (id) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  duration_days = excluded.duration_days,
  visit_quota = excluded.visit_quota,
  allowed_zone_ids = excluded.allowed_zone_ids,
  active = excluded.active;

-- Desactivar catálogo de ejemplo (Gold / Silver / Plata / Dragon Fit / Pase 10).
-- No se borran: socio.staging puede seguir ligado a Silver.
update membership_plans
set active = false
where id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
);

select name, price_cents / 100.0 as usd, duration_days, allowed_zone_ids, active
from membership_plans
order by active desc, price_cents, duration_days, name;
