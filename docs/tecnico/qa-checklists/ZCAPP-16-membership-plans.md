# ZCAPP-16 — Checklist «Listo para pruebas»

**Ticket Jira:** ZCAPP-16 · Catálogo de Planes y Reglas TDD

**Dependencia:** Sprint 1 staging operativo (ZCAPP-14/15)

## Comando

```bash
cd app && npm run dev:staging
```

**Admin:** `admin.staging@zonacero.test` / `ZonaCero2026!`  
**Socio:** `socio.staging@zonacero.test` / `ZonaCero2026!`

## Checklist DoD

- [x] `/admin/planes` — admin ve catálogo (validado staging 2026-09-10)
- [x] Crear plan nuevo (nombre, precio USD, duración, visitas ilimitadas o cupo)
- [ ] Editar plan existente — cambios persisten tras refresh
- [x] Desactivar plan (`active: false`) — badge Inactivo en admin (pendiente: confirmar oculto en socio)
- [ ] Eliminar plan — solo admin
- [ ] Socio no accede a `/admin/planes`
- [ ] Socio no ve planes inactivos en `/membresia`
- [x] Tests automatizados ZCAPP-16 — **59/59 PASS** (2026-09-10)

```powershell
npm test -- --run src/domain/rules/membership.test.ts src/domain/rules/membershipPlan.test.ts src/data/localRepository.memberships.test.ts src/features/admin/adminBilling.test.tsx
```

## Reglas dominio (TDD)

- `computeMembershipStatus` → `active` / `grace` / `expired`
- `validateMembershipPlanInput` → validación catálogo
- `extendMembership` → extensión al cobrar (Sprint 3)

## Evidencia

Screenshot o video de CRUD en staging + salida tests.
