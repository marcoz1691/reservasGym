# Avanzada Membresías Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add membership plans, payments (Mercado Pago + manual), member renewal UI, admin billing panel, and booking gate on top of the Intermedia ReservasGym app.

**Architecture:** Extend `domain/models.ts` and `domain/rules/` with pure membership logic; add tables to `schema.sql`; extend `GymRepository` in Local + Supabase repos; new `features/memberships` and admin pages; Mercado Pago via Supabase Edge Functions only.

**Tech Stack:** React 19, Vite, Tailwind v4, React Router 7, Supabase, Capacitor, Vitest, Mercado Pago Checkout Pro (Ecuador USD).

## Global Constraints

- Payment provider: **Mercado Pago only** (Ecuador). No Stripe/PayPal.
- Hybrid billing: member self-renew (MP) + staff manual (cash/transfer/card_pos).
- Grace period: **3 days** after `endsAt` before `expired`.
- Expired/cancelled: block **new** bookings only; existing bookings unchanged.
- `MP_ACCESS_TOKEN` only in Edge secrets; never in Vite env.
- UI: run UI UX Pro Max before new screens; extend `app/src/ui/primitives.tsx`; respect `GymSettings` accent.
- Reference GYM-One for domain UX only; do not port PHP.
- Out of scope: SRI invoicing, product e-commerce, wallet balance, multi-site.
- Commits only when user requests.

---

### Task 1: Domain models

**Files:**
- Modify: `app/src/domain/models.ts`
- Test: (types only, no test file)

**Interfaces:**
- Consumes: nothing
- Produces: `MembershipPlan`, `Membership`, `Payment`, status/provider enums exported from models

- [ ] **Step 1: Add types to models.ts**

Add after existing exports:

```typescript
export type MembershipStatus = 'active' | 'grace' | 'expired' | 'cancelled'
export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'refunded'
export type PaymentProvider = 'manual' | 'mercadopago'
export type ManualPaymentMethod = 'cash' | 'transfer' | 'card_pos'

export interface MembershipPlan {
  id: string
  name: string
  priceCents: number
  durationDays: number
  visitQuota: number | null
  active: boolean
}

export interface Membership {
  id: string
  userId: string
  planId: string
  status: MembershipStatus
  startsAt: string
  endsAt: string
  visitsLeft: number | null
  graceEndsAt: string | null
}

export interface Payment {
  id: string
  userId: string
  planId: string
  membershipId: string | null
  amountCents: number
  status: PaymentStatus
  provider: PaymentProvider
  manualMethod: ManualPaymentMethod | null
  mpPreferenceId: string | null
  mpPaymentId: string | null
  createdAt: string
  approvedAt: string | null
}
```

- [ ] **Step 2: Extend GymState**

In `models.ts`, add to `GymState`:

```typescript
membershipPlans: MembershipPlan[]
memberships: Membership[]
payments: Payment[]
```

---

### Task 2: Membership domain rules (TDD)

**Files:**
- Create: `app/src/domain/rules/membership.ts`
- Create: `app/src/domain/rules/membership.test.ts`
- Modify: `app/src/domain/rules/index.ts`

**Interfaces:**
- Consumes: `Membership`, `MembershipPlan` from models
- Produces: `resolveMembershipStatus`, `isMembershipValid`, `canBookWithMembership`, `extendMembership`, `GRACE_DAYS = 3`

- [ ] **Step 1: Write failing tests**

```typescript
// app/src/domain/rules/membership.test.ts
import { describe, expect, it } from 'vitest'
import {
  GRACE_DAYS,
  canBookWithMembership,
  extendMembership,
  resolveMembershipStatus,
} from './membership'
import type { Membership, MembershipPlan } from '@/domain/models'

const plan: MembershipPlan = {
  id: 'p1',
  name: 'Mensual',
  priceCents: 4500,
  durationDays: 30,
  visitQuota: null,
  active: true,
}

function m(partial: Partial<Membership>): Membership {
  return {
    id: 'm1',
    userId: 'u1',
    planId: 'p1',
    status: 'active',
    startsAt: '2026-08-01T00:00:00.000Z',
    endsAt: '2026-08-31T23:59:59.999Z',
    visitsLeft: null,
    graceEndsAt: null,
    ...partial,
  }
}

describe('resolveMembershipStatus', () => {
  it('returns active before endsAt', () => {
    expect(resolveMembershipStatus(m({}), new Date('2026-08-15'))).toBe('active')
  })

  it('returns grace within GRACE_DAYS after endsAt', () => {
    const status = resolveMembershipStatus(
      m({ endsAt: '2026-08-01T23:59:59.999Z' }),
      new Date('2026-08-03'),
    )
    expect(status).toBe('grace')
  })

  it('returns expired after grace', () => {
    const status = resolveMembershipStatus(
      m({ endsAt: '2026-08-01T23:59:59.999Z' }),
      new Date('2026-08-01T23:59:59.999Z').getTime() +
        (GRACE_DAYS + 1) * 86400000,
    )
    expect(status).toBe('expired')
  })
})

describe('canBookWithMembership', () => {
  it('allows active and grace', () => {
    expect(canBookWithMembership(m({}), new Date('2026-08-15'))).toBe(true)
  })

  it('blocks expired', () => {
    expect(
      canBookWithMembership(
        m({ status: 'expired', endsAt: '2026-01-01T00:00:00.000Z' }),
        new Date('2026-08-15'),
      ),
    ).toBe(false)
  })
})

describe('extendMembership', () => {
  it('adds durationDays from max(endsAt, paidAt)', () => {
    const current = m({ endsAt: '2026-08-31T23:59:59.999Z' })
    const next = extendMembership(current, plan, new Date('2026-08-20'))
    expect(new Date(next.endsAt).getTime()).toBeGreaterThan(
      new Date('2026-08-31T23:59:59.999Z').getTime(),
    )
    expect(next.status).toBe('active')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd app && npm test -- src/domain/rules/membership.test.ts`
Expected: FAIL module not found

- [ ] **Step 3: Implement membership.ts**

```typescript
// app/src/domain/rules/membership.ts
import type { Membership, MembershipPlan, MembershipStatus } from '@/domain/models'

export const GRACE_DAYS = 3

export function resolveMembershipStatus(
  membership: Membership,
  now: Date = new Date(),
): MembershipStatus {
  if (membership.status === 'cancelled') return 'cancelled'
  const ends = new Date(membership.endsAt).getTime()
  const nowMs = now.getTime()
  if (nowMs <= ends) return 'active'
  const graceEnd = ends + GRACE_DAYS * 86400000
  if (nowMs <= graceEnd) return 'grace'
  return 'expired'
}

export function isMembershipValid(membership: Membership, now?: Date): boolean {
  const s = resolveMembershipStatus(membership, now)
  return s === 'active' || s === 'grace'
}

export function canBookWithMembership(
  membership: Membership | null,
  now?: Date,
): boolean {
  if (!membership) return false
  const s = resolveMembershipStatus(membership, now)
  return s === 'active' || s === 'grace'
}

export function extendMembership(
  current: Membership | null,
  plan: MembershipPlan,
  paidAt: Date = new Date(),
): Membership {
  const baseEnd = current
    ? Math.max(new Date(current.endsAt).getTime(), paidAt.getTime())
    : paidAt.getTime()
  const endsAt = new Date(baseEnd + plan.durationDays * 86400000).toISOString()
  const graceEndsAt = new Date(
    new Date(endsAt).getTime() + GRACE_DAYS * 86400000,
  ).toISOString()
  return {
    id: current?.id ?? crypto.randomUUID(),
    userId: current?.userId ?? '',
    planId: plan.id,
    status: 'active',
    startsAt: current?.startsAt ?? paidAt.toISOString(),
    endsAt,
    visitsLeft: plan.visitQuota,
    graceEndsAt,
  }
}
```

- [ ] **Step 4: Export from index and run tests**

Run: `cd app && npm test -- src/domain/rules/membership.test.ts`
Expected: PASS

---

### Task 3: Schema SQL + seed

**Files:**
- Modify: `app/supabase/schema.sql`
- Modify: `app/src/data/seed.ts`

**Interfaces:**
- Produces: tables `membership_plans`, `memberships`, `payments` with RLS policies

- [ ] **Step 1: Add SQL tables** (membership_plans, memberships, payments per plan-avanzada.md)
- [ ] **Step 2: Add RLS** — member read own; staff/admin read/write all; admin CRUD plans
- [ ] **Step 3: Seed 2–3 demo plans** in seed.ts (Mensual $45, Trimestral $120)

---

### Task 4: Extend GymRepository

**Files:**
- Modify: `app/src/data/types.ts`
- Modify: `app/src/data/localRepository.ts`
- Modify: `app/src/data/supabaseRepository.ts`

**Interfaces:**
- Produces:
  - `listMembershipPlans(): Promise<MembershipPlan[]>`
  - `upsertMembershipPlan(plan): Promise<MembershipPlan>`
  - `getMembershipForUser(userId): Promise<Membership | null>`
  - `listPaymentsForUser(userId): Promise<Payment[]>`
  - `recordManualPayment(input): Promise<{ payment, membership }>`
  - `listMembersWithMembershipStatus(): Promise<...>` for admin vencidos

- [ ] **Step 1: Add methods to GymRepository interface**
- [ ] **Step 2: Implement LocalRepository** with demo membership for member user
- [ ] **Step 3: Implement SupabaseRepository** mirroring SQL

---

### Task 5: Member UI — Mi plan

**Files:**
- Create: `app/src/features/memberships/MembershipPage.tsx`
- Create: `app/src/features/memberships/MembershipBanner.tsx`
- Create: `app/src/features/memberships/PaymentHistory.tsx`
- Modify: `app/src/app/router.tsx`
- Modify: `app/src/app/AppLayout.tsx`

**Before coding:** read `docs/design-systems/reservasgym-avanzada.md` and wireframes-socio.md.

- [ ] **Step 1: MembershipPage** — card, badge, days left bar, Renew button (manual works; MP stub)
- [ ] **Step 2: MembershipBanner** — show if daysLeft <= 7 or grace
- [ ] **Step 3: Add route `/membresia` and nav tab**

---

### Task 6: Admin UI — Planes + Cobros

**Files:**
- Create: `app/src/features/admin/PlansPage.tsx`
- Create: `app/src/features/admin/CobrosPage.tsx`
- Modify: `app/src/features/admin/AdminPage.tsx`

- [ ] **Step 1: PlansPage CRUD**
- [ ] **Step 2: CobrosPage** search member, manual payment form, vencidos tab
- [ ] **Step 3: Routes `/admin/planes`, `/admin/cobros`**

---

### Task 7: Booking gate

**Files:**
- Modify: `app/src/features/catalog/ExplorePage.tsx`
- Modify: `app/src/features/agenda/AgendaPage.tsx`

- [ ] **Step 1: Before createBooking, call canBookWithMembership**
- [ ] **Step 2: Modal redirect to /membresia if blocked**

---

### Task 8: Mercado Pago Edge Functions

**Files:**
- Create: `app/supabase/functions/create-mp-preference/index.ts`
- Create: `app/supabase/functions/mp-webhook/index.ts`
- Modify: `app/src/features/memberships/MembershipPage.tsx` — call Edge on Renew

See `docs/tecnico/mercadopago-setup.md`.

- [ ] **Step 1: create-mp-preference** — pending payment + MP preference + return init_point
- [ ] **Step 2: mp-webhook** — approve + extendMembership via service role
- [ ] **Step 3: Wire Renew button** with Capacitor Browser.open for checkout

---

### Task 9: Verification

- [ ] Run: `cd app && npm test`
- [ ] Manual: demo user renew via admin cobros → can book
- [ ] Manual: expire demo membership → booking blocked
- [ ] Checklist: `docs/tecnico/checklist-avanzada.md`

---

## Execution Handoff

Plan saved. Options:

1. **Subagent-Driven (recommended)** — fresh subagent per task
2. **Inline Execution** — batch in this session with checkpoints

Which approach?
