with horario(tpl, dias, horas) as (values
  ('tpl-gym-open',   array[1,2,3,4,5], array['06:00','07:00','12:00','17:00','18:00','19:00']),
  ('tpl-gym-open',   array[6],         array['08:00','09:00','10:00']),
  ('tpl-muscu',      array[1,2,3,4,5], array['06:00','18:00']),
  ('tpl-cf-class',   array[1,2,3,4,5], array['06:00','19:00']),
  ('tpl-cf-class',   array[6],         array['09:00']),
  ('tpl-hyrox-class',array[2,4],       array['07:00','18:00']),
  ('tpl-hyrox-class',array[6],         array['10:00']),
  ('tpl-dragon-fit', array[1,3,5],     array['17:00']),
  ('tpl-bailo',      array[2,4],       array['19:00']),
  ('tpl-fisio',      array[1,2,3,4,5], array['10:00','16:00']),
  ('tpl-nutri',      array[1,2,3,4,5], array['10:00','16:00'])
), slots as (
  select h.tpl, (d::date + hr::time) as local_ts
  from horario h
  cross join generate_series(date '2026-11-12', date '2026-11-30', interval '1 day') d
  cross join unnest(h.horas) hr
  where extract(isodow from d)::int = any(h.dias)
), ins as (
  insert into sessions (id, template_id, zone_id, title, kind, starts_at, ends_at, capacity, trainer_id)
  select 'ses-' || replace(t.id,'tpl-','') || '-' || to_char(s.local_ts,'YYYYMMDD-HH24MI'),
         t.id, t.zone_id, t.title, t.kind,
         s.local_ts at time zone 'America/Guayaquil',
         (s.local_ts + make_interval(mins => t.duration_minutes)) at time zone 'America/Guayaquil',
         t.capacity, t.trainer_id
  from slots s join class_templates t on t.id = s.tpl
  on conflict (id) do nothing
  returning template_id, starts_at
)
select count(*) total, min(starts_at) primera, max(starts_at) ultima,
       jsonb_object_agg(template_id, n) por_tipo
from (select template_id, starts_at, count(*) over (partition by template_id) n from ins) x;
