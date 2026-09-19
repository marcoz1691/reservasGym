---
name: manual-qa-zona-cero
description: >-
  Runs manual QA on Zona Cero / reservasGym flows in staging (browser, roles,
  checklists, Jira evidence). Use when the user asks for manual testing, QA
  staging, validar flujo, probar como admin/socio/staff, checklist Listo para
  pruebas, or acceptance testing before closing a Jira ticket.
---

# Manual QA — Zona Cero

## When to use

- Validating a Jira ticket before **Listo para pruebas** or **Finalizado**
- Reproducing a bug reported by William / recepción
- End-to-end flow checks after code changes (membresías, cobros, reservas, auth)

**Do not use for:** writing Vitest tests → use skill `automated-tests-zona-cero`.

## Environment setup

```powershell
cd app
npm run dev:staging
```

| Item | Value |
|------|-------|
| URL | `http://localhost:5190` |
| Local (no Supabase) | `npm run dev` → port **5180** |
| Staging accounts | see [accounts.md](accounts.md) |

**Pre-flight (agent must verify):**
1. Port 5190 free — if busy, reuse running server or kill old process
2. `.env.staging` has valid `VITE_SUPABASE_*`
3. Hard refresh (`Ctrl+Shift+R`) after layout fixes

## Workflow

Copy and track:

```
Manual QA progress:
- [ ] 1. Identify ticket + checklist
- [ ] 2. Pick role(s) and route(s)
- [ ] 3. Execute steps; note pass/fail
- [ ] 4. Capture evidence (screenshot path or short note)
- [ ] 5. Update checklist file + Jira comment if requested
```

### Step 1 — Ticket and checklist

1. Read ticket scope (Jira key e.g. `ZCAPP-16`)
2. Open matching checklist: `docs/tecnico/qa-checklists/<TICKET>-*.md`
3. If no checklist exists, derive steps from `docs/tecnico/plan-avanzada.md` or ticket description

### Step 2 — Role matrix

| Rol | Email | Password | Typical routes |
|-----|-------|----------|----------------|
| Socio | `socio.staging@zonacero.test` | `ZonaCero2026!` | `/`, `/agenda`, `/membresia`, `/explorar` |
| Staff | `staff.staging@zonacero.test` | `ZonaCero2026!` | `/admin/cobros`, `/check-in`, `/agenda` |
| Admin | `admin.staging@zonacero.test` | `ZonaCero2026!` | `/admin/planes`, `/admin/marca`, all staff routes |

Logout between roles (sidebar / header → Cerrar sesión).

### Step 3 — Execute flows

Follow the checklist line by line. For common flows see [flows.md](flows.md).

**Report each item as:** PASS | FAIL | BLOCKED (with reason).

On FAIL: URL, role, steps to reproduce, expected vs actual, screenshot if possible.

### Step 4 — Evidence

Minimum for **Listo para pruebas** (see `docs/tecnico/jira-board-workflow.md`):

- Command: `cd app && npm run dev:staging`
- User/password used
- Checklist with checked items
- Screenshot or short screen recording for critical paths

### Step 5 — Close loop

- Mark checklist in `docs/tecnico/qa-checklists/` (checkboxes)
- If user asks: Jira comment using template in `docs/tecnico/jira-board-workflow.md`
- **Finalizado** only after PM/client validation — dev marks **Listo para pruebas**

## Rules

- Prefer **staging + Supabase** over LocalRepository for ticket sign-off
- Admin plan catalog can be loaded via `/admin/planes` **or** SQL — UI is valid for QA
- Mobile: bottom tab bar is in layout flow; scroll main content to see full pages
- Do not mark Finalizado without explicit user/PM request

## References

- Staging setup: `docs/tecnico/staging-setup.md`
- Plan loading: `docs/tecnico/planes-zona-cero-carga.md`
- Flow scripts: [flows.md](flows.md)
- Test accounts: [accounts.md](accounts.md)
