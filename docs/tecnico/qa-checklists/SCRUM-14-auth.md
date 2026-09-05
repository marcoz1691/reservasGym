# SCRUM-14 — Checklist «Listo para pruebas»

**Ticket Jira:** SCRUM-14 · Autenticación Segura (JWT, Login, Recuperación)

**Dependencia:** SCRUM-15 staging operativo.

## Cómo probar

```bash
cd app
npm run dev:staging
```

Usuarios: ver `app/supabase/staging-users.sql` (credenciales solo en repo, no en Jira).

## Criterios de aceptación

- [ ] Registro crea perfil vía trigger `handle_new_user`
- [ ] Login email/contraseña contra Supabase Auth
- [ ] Recuperación de contraseña (SMTP Supabase)
- [ ] Sesión persiste al recargar
- [ ] Socio no accede a rutas admin/staff
- [ ] Staff/admin acceden al panel
- [ ] `npm test` pasa

## Evidencia

- Video o screenshots de login/registro/recuperación
- PR o commit hash
