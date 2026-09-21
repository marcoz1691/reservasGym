# Manual QA flows — Zona Cero

## F1 — Auth (Sprint 1)

| Step | Action | Expected |
|------|--------|----------|
| 1 | `/login` → socio credentials | Redirect to home |
| 2 | Logout → staff login | Admin dashboard / cobros accessible |
| 3 | Socio → `/admin/planes` | Blocked or empty state (no admin) |

Checklist: `docs/tecnico/qa-checklists/SCRUM-14-auth.md`, `SCRUM-15-supabase.md`

**Ambiente:** https://zona-cero-qa.vercel.app

---

## F2 — Catálogo planes (ZCAPP-16)

**Admin** → `/admin/planes`

| Step | Action | Expected |
|------|--------|----------|
| 1 | View list | Active plans visible |
| 2 | Crear plan | Name, price, duration, zones save |
| 3 | Refresh page | Data persists |
| 4 | Desactivar plan | Badge Inactivo |
| 5 | **Socio** → `/membresia` | Inactive plan hidden in showcase |

Checklist: `docs/tecnico/qa-checklists/ZCAPP-16-membership-plans.md`

---

## F3 — Mi plan + estados membresía

**Socio** → `/membresia`

| Step | Expected |
|------|----------|
| Active membership | Badge activa, dates, progress |
| Payment history | Past payments listed |
| Plans showcase | Active catalog plans |

**Banners** (global in layout): warning ≤7d, grace urgent, expired blocks tone.

---

## F4 — Gate reservas

**Socio con membresía vencida** (or simulate via Cobros + expired state):

| Step | Route | Expected |
|------|-------|----------|
| 1 | `/explorar` → reservar | Modal: membresía vencida |
| 2 | `/agenda` → reservar | Same gate |

**Socio con plan restringido** (e.g. Plata = solo muscu):

| Step | Expected |
|------|----------|
| Reservar Hyrox/CrossFit | Zone restricted message |

---

## F5 — Panel cobros (Sprint 3)

**Staff/Admin** → `/admin/cobros`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Buscar socio | Member found |
| 2 | Cobro efectivo/transfer/POS | Receipt + membership extended |
| 3 | Tab Vencimientos | Grace / expired / warning lists |

---

## F6 — Reservas + check-in

| Step | Role | Route | Expected |
|------|------|-------|----------|
| 1 | Socio | `/agenda` | Book session |
| 2 | Staff | `/check-in` | QR scan / validation |
| 3 | Socio | `/reservas` | Booking listed |

---

## F7 — Control de peso

**Socio** → `/peso` — chart, measurements, goals visible.

**Staff** → same route — can record for member if UI supports.

---

## Evidence template

```markdown
### QA manual — [TICKET]
**Fecha:** YYYY-MM-DD
**Ambiente:** staging (localhost:5190)
**Rol:** admin | staff | socio

| # | Paso | Resultado |
|---|------|-----------|
| 1 | ... | PASS / FAIL |

**Notas:** ...
```
