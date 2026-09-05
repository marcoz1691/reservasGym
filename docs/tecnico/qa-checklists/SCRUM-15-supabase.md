# SCRUM-15 — Checklist «Listo para pruebas»

**Ticket Jira:** SCRUM-15 · Provisionamiento Supabase (PostgreSQL + RLS)

## Cómo probar

```bash
cd app
copy .env.staging.example .env.staging   # completar credenciales
npm run dev:staging
```

Guía: [staging-setup.md](../staging-setup.md)

## Criterios de aceptación

- [ ] Proyecto `zona-cero-staging` creado en Supabase
- [ ] `app/supabase/schema.sql` aplicado sin errores
- [ ] `app/supabase/seed.sql` aplicado (8 zonas + planes demo)
- [ ] RLS habilitado en todas las tablas
- [ ] Políticas: socio solo ve lo suyo; staff/admin gestionan catálogo
- [ ] Usuarios staging creados + `staging-users.sql` ejecutado
- [ ] `npm run dev:staging` conecta a Supabase (no LocalRepository)

## Evidencia

- Screenshot SQL Editor con tablas
- Query: `select email, role from profiles where email like '%staging@%'`
