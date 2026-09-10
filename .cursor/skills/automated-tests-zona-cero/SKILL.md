---
name: automated-tests-zona-cero
description: >-
  Runs and extends automated tests for reservasGym (Vitest, Testing Library,
  domain TDD). Use when the user asks to run tests, add unit/integration tests,
  fix failing tests, test coverage for a feature, or TDD for domain rules before
  manual QA.
---

# Automated tests — Zona Cero

## Stack

| Tool | Purpose |
|------|---------|
| **Vitest** | Runner (`app/package.json`) |
| **@testing-library/react** | Component tests |
| **LocalRepository** | In-memory backend in tests (no Supabase required) |

Config: `app/vite.config.ts` (vitest section).

## When to use

- Before PR: run affected tests
- TDD for `app/src/domain/rules/*` (membership, plans, zone access, capacity)
- Component tests for gates, banners, admin billing
- After bug fix: add regression test

**Do not use for:** browser staging validation → use skill `manual-qa-zona-cero`.

## Commands

All from `app/`:

```powershell
# Full suite
npm test

# Watch mode (dev)
npm run test:watch

# Single file
npm test -- --run src/domain/rules/membership.test.ts

# Pattern / directory
npm test -- --run src/domain/rules/
npm test -- --run src/features/memberships/
npm test -- --run src/features/admin/adminBilling.test.tsx
```

On failure: read stack trace, fix code or test, re-run **same command** until green.

## Test layers (where to put tests)

| Layer | Path | What to test |
|-------|------|--------------|
| Domain rules | `src/domain/rules/*.test.ts` | Pure logic: dates, grace, canBook, validatePlan |
| Repository | `src/data/localRepository.*.test.ts` | CRUD, permissions, payment extension |
| Components | `src/features/**/*.test.tsx` | UI + user events (mock repo) |
| Flows | `src/test/e2eFlows.test.ts`, `seniorQaExploratory.test.ts` | Multi-step repository flows |

**Prefer domain tests** for business rules (TDD requirement in Sprint 2).

## Workflow for a new feature

```
Automated test progress:
- [ ] 1. Identify rule or behavior
- [ ] 2. Write failing test (domain first)
- [ ] 3. Implement minimal code
- [ ] 4. Run targeted npm test -- --run ...
- [ ] 5. Run related suite before PR
```

### Domain TDD example

File: `src/domain/rules/membershipPlan.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { validateMembershipPlanInput } from './membershipPlan'

it('rejects empty name', () => {
  const res = validateMembershipPlanInput({ name: '', priceCents: 100, durationDays: 30 })
  expect(res.ok).toBe(false)
})
```

Run: `npm test -- --run src/domain/rules/membershipPlan.test.ts`

### Component test pattern

- Mock `useRepo` / `RepositoryProvider` like `BookingGate.test.tsx`
- Use `@testing-library/react` + `userEvent`
- Assert visible text and ARIA, not implementation details

## Ticket → test mapping

| Ticket / area | Primary tests |
|---------------|---------------|
| ZCAPP-16 planes | `membershipPlan.test.ts`, `membership.test.ts`, `localRepository.memberships.test.ts` |
| Membresía UI | `MembershipCard.test.tsx`, `ExpiryBanner.test.tsx`, `MiPlanPage.test.tsx` |
| Gate reservas | `BookingGate.test.tsx`, `membership.test.ts` |
| Cobros | `adminBilling.test.tsx` |
| Zona acceso | `zoneAccess.test.ts` |
| Auth / profile | `authAndProfile.test.ts`, `localRepository.security.test.ts` |
| Agenda | `multizoneAgenda.test.tsx`, `StaffBooking.test.tsx` |

Full index: [test-index.md](test-index.md)

## Rules

- Run tests yourself; do not claim green without command output
- New domain rule → test in same PR as rule file
- Avoid testing Supabase in unit tests; use `LocalRepository` or mocks
- Keep tests focused; one behavior per `it()`
- Match existing Vitest + describe/it style in neighboring files

## Before manual QA

Run ticket-related automated suite, then hand off to `manual-qa-zona-cero` for staging checklist.

## References

- QA checklists (manual follow-up): `docs/tecnico/qa-checklists/`
- Test file index: [test-index.md](test-index.md)
