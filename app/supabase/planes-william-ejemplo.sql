-- =============================================================================
-- EJEMPLO — Carga comercial de planes (simula respuesta de William)
-- Proyecto: zona-cero STAGING
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- price_cents = USD × 100  (ej. $45.00 → 4500)
-- allowed_zone_ids = '{}'  → acceso a TODAS las áreas
-- visit_quota = NULL       → visitas ilimitadas
-- =============================================================================

-- Opcional: quitar planes de prueba creados a mano en admin (descomenta si quieres limpiar)
-- delete from membership_plans
-- where id not in (
--   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
--   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
--   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
--   'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
--   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
-- );

insert into membership_plans (id, name, price_cents, duration_days, visit_quota, allowed_zone_ids, active)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Plan Gold',
    12000,
    90,
    null,
    '{}',
    true
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Plan Silver',
    4500,
    30,
    null,
    array['zone-gimnasio', 'zone-muscu', 'zone-nutri'],
    true
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'Plan Plata',
    3000,
    30,
    null,
    array['zone-muscu'],
    true
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'Pase 10 Visitas',
    3500,
    60,
    10,
    array['zone-gimnasio', 'zone-muscu', 'zone-comunes'],
    true
  ),
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'Dragon Fit Mensual',
    5000,
    30,
    null,
    array['zone-dragon-fit', 'zone-gimnasio', 'zone-muscu'],
    true
  )
on conflict (id) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  duration_days = excluded.duration_days,
  visit_quota = excluded.visit_quota,
  allowed_zone_ids = excluded.allowed_zone_ids,
  active = excluded.active;

-- Desactivar planes seed viejos (no borrar — por si hay membresías ligadas)
update membership_plans
set active = false
where id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444'
);

-- Ver resultado
select id, name, price_cents / 100.0 as price_usd, duration_days, visit_quota, allowed_zone_ids, active
from membership_plans
order by active desc, name;
