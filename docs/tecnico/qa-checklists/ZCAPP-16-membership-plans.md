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

- [x] `/admin/planes` — admin ve catálogo (staging manual 2026-09-10)
- [x] Crear plan nuevo (staging manual + `adminBilling.test.tsx`)
- [x] Editar plan existente — persiste tras reload (`localRepository.memberships.test.ts` + UI test)
- [x] Desactivar plan (`active: false`) — oculto para socio (`MiPlanPage.test.tsx`)
- [x] Eliminar plan — solo admin (`adminBilling.test.tsx` + repo test)
- [x] Socio no accede a `/admin/planes` (`adminBilling.test.tsx` member + staff)
- [x] Socio no ve planes inactivos en `/membresia` (`MiPlanPage.test.tsx`)
- [x] Tests automatizados ZCAPP-16 — **66/66 PASS** (2026-09-10)

```powershell
npm test -- --run src/domain/rules/membership.test.ts src/domain/rules/membershipPlan.test.ts src/data/localRepository.memberships.test.ts src/features/admin/adminBilling.test.tsx src/features/memberships/MiPlanPage.test.tsx
```

**Pendiente comercial (no bloquea dev):** catálogo real de William → cargar vía `/admin/planes` o SQL.

## Reglas dominio (TDD)

- `computeMembershipStatus` → `active` / `grace` / `expired`
- `validateMembershipPlanInput` → validación catálogo
- `extendMembership` → extensión al cobrar (Sprint 3)

## Evidencia

Screenshot o video de CRUD en staging + salida tests.
