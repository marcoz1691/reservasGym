# Vitest file index — reservasGym/app

## Domain rules (`src/domain/rules/`)

| File | Covers |
|------|--------|
| `membership.test.ts` | Status active/grace/expired, canBook, extendMembership |
| `membershipPlan.test.ts` | validateMembershipPlanInput |
| `zoneAccess.test.ts` | Plan zone restrictions |
| `capacity.test.ts` | Session capacity |
| `waitlist.test.ts` | Waitlist position/promotion |
| `overlap.test.ts` | Booking overlaps |
| `anthropometrics.test.ts` | BMI, measurements |
| `rules.test.ts` | General rules |
| `rules.unit.test.ts` | Unit helpers |

## Data layer (`src/data/`)

| File | Covers |
|------|--------|
| `localRepository.memberships.test.ts` | Plan CRUD permissions, payments |
| `localRepository.security.test.ts` | Auth boundaries |
| `authAndProfile.test.ts` | Profile fields, signup |
| `scopeGymState.test.ts` | Member-scoped state |
| `selectRepositoryBackend.test.ts` | Local vs Supabase selection |

## Features (`src/features/`)

| File | Covers |
|------|--------|
| `admin/adminBilling.test.tsx` | Cobros panel |
| `admin/sessionsManagement.test.tsx` | Sessions admin |
| `memberships/MiPlanPage.test.tsx` | Mi plan page |
| `memberships/components/MembershipCard.test.tsx` | Card states |
| `memberships/components/ExpiryBanner.test.tsx` | Expiry banners |
| `memberships/components/BookingGate.test.tsx` | Booking gate modal |
| `agenda/multizoneAgenda.test.tsx` | Agenda multizone |
| `agenda/StaffBooking.test.tsx` | Staff booking |
| `bookings/CheckInPage.test.tsx` | Check-in |
| `weight/WeightPage.test.tsx` | Weight module |
| `profile/FichaTecnicaModal.test.tsx` | Profile modal |

## Integration / exploratory (`src/test/`)

| File | Covers |
|------|--------|
| `e2eFlows.test.ts` | Cross-module flows (repository) |
| `seniorQaExploratory.test.ts` | Capacity, waitlist, edge cases |
| `securityAudit.test.ts` | Security scenarios |

## Lib

| File | Covers |
|------|--------|
| `lib/biometrics.test.ts` | Biometric helpers |

## Quick commands by sprint

**Sprint 2 — Membresías:**
```powershell
npm test -- --run src/domain/rules/membership.test.ts src/domain/rules/membershipPlan.test.ts src/data/localRepository.memberships.test.ts src/features/admin/adminBilling.test.tsx
```

**Sprint 1 — Auth:**
```powershell
npm test -- --run src/data/authAndProfile.test.ts src/data/localRepository.security.test.ts
```

**Full regression:**
```powershell
npm test
```
