import type { MembershipPlan } from '@/domain/models'

/** Input for creating/updating a membership plan (admin UI / repository). */
export interface MembershipPlanInput {
  name: string
  priceCents: number
  durationDays: number
  visitQuota?: number | null
  allowedZoneIds?: string[]
  active?: boolean
  kind?: MembershipPlan['kind']
}

export type MembershipPlanValidationResult =
  | { ok: true; value: Required<Pick<MembershipPlanInput, 'name' | 'priceCents' | 'durationDays'>> & MembershipPlanInput }
  | { ok: false; error: string }

/**
 * Validates plan catalog fields before persist (TDD domain rules — ZCAPP-16).
 */
export function validateMembershipPlanInput(
  input: MembershipPlanInput,
): MembershipPlanValidationResult {
  const name = input.name.trim()
  if (!name) {
    return { ok: false, error: 'El nombre del plan es requerido.' }
  }

  if (!Number.isFinite(input.priceCents) || input.priceCents < 0) {
    return { ok: false, error: 'El precio debe ser un valor válido mayor o igual a 0.' }
  }

  if (!Number.isInteger(input.durationDays) || input.durationDays <= 0) {
    return { ok: false, error: 'La duración debe ser de al menos 1 día.' }
  }

  if (input.visitQuota !== undefined && input.visitQuota !== null) {
    if (!Number.isInteger(input.visitQuota) || input.visitQuota <= 0) {
      return { ok: false, error: 'El cupo de visitas debe ser un entero positivo.' }
    }
  }

  return {
    ok: true,
    value: {
      ...input,
      name,
      allowedZoneIds: input.allowedZoneIds ?? [],
      active: input.active ?? true,
    },
  }
}

export type PlanFamilyId =
  | 'zero-start'
  | 'zero-active'
  | 'zero-pro'
  | 'zero-elite'
  | 'zona-day'
  | 'otros'

export interface PlanFamily {
  id: PlanFamilyId
  label: string
  benefit: string
}

export interface PlanOffer {
  plan: MembershipPlan
  familyId: PlanFamilyId
  durationLabel: string
  /** Meses que cubre la oferta; null en pases diarios o duraciones sueltas. */
  months: number | null
  badge: string | null
  equivalentPerMonthCents: number | null
  featured: boolean
}

export interface PlanFamilyGroup {
  family: PlanFamily
  offers: PlanOffer[]
}

const FAMILY_ORDER: PlanFamily[] = [
  {
    id: 'zero-start',
    label: 'Zero Start',
    benefit: 'Clases funcionales en gimnasio',
  },
  {
    id: 'zero-active',
    label: 'Zero Active',
    benefit: 'Gimnasio, musculación y bailoterapia',
  },
  {
    id: 'zero-pro',
    label: 'Zero Pro',
    benefit: 'Active + Hyrox y clases grupales',
  },
  {
    id: 'zero-elite',
    label: 'Zero Elite',
    benefit: 'Complejo completo, todas las áreas',
  },
  {
    id: 'zona-day',
    label: 'Pases diarios',
    benefit: 'Acceso de un día, sin mensualidad',
  },
  {
    id: 'otros',
    label: 'Otros planes',
    benefit: 'Planes vigentes fuera del catálogo Zero',
  },
]

const DURATION: Record<number, { label: string; months: number | null; badge: string | null }> = {
  1: { label: '1 día', months: null, badge: null },
  30: { label: '1 mes', months: 1, badge: null },
  90: { label: '3 meses', months: 3, badge: '3 meses · 15% off' },
  210: { label: '7 meses', months: 7, badge: '1 mes gratis' },
  420: { label: '14 meses', months: 14, badge: '2 meses gratis' },
}

/** Pase del día: manda `kind`; sin él (datos viejos) se reconoce por el nombre "Zona Day". */
export function isDayPassPlan(plan: Pick<MembershipPlan, 'name' | 'kind'>): boolean {
  if (plan.kind) return plan.kind === 'day_pass'
  return plan.name.toLowerCase().includes('zona day')
}

export function planFamilyId(plan: Pick<MembershipPlan, 'name' | 'kind'>): PlanFamilyId {
  if (isDayPassPlan(plan)) return 'zona-day'
  const n = plan.name.toLowerCase()
  if (n.includes('zero start')) return 'zero-start'
  if (n.includes('zero active')) return 'zero-active'
  if (n.includes('zero pro')) return 'zero-pro'
  if (n.includes('zero elite')) return 'zero-elite'
  return 'otros'
}

export function describePlanOffer(plan: MembershipPlan): PlanOffer {
  const known = DURATION[plan.durationDays]
  const months = known?.months ?? null
  return {
    plan,
    familyId: planFamilyId(plan),
    durationLabel: known?.label ?? `${plan.durationDays} días`,
    months,
    badge: known?.badge ?? null,
    equivalentPerMonthCents:
      months && months > 0 ? Math.round(plan.priceCents / months) : null,
    featured: plan.durationDays === 420,
  }
}

const FAMILY_RANK: Record<PlanFamilyId, number> = {
  'zona-day': 0,
  otros: 1,
  'zero-start': 2,
  'zero-active': 3,
  'zero-pro': 4,
  'zero-elite': 5,
}

/**
 * Plan superior a ofrecer. Sin membresía, el de mayor precio.
 * Con plan, el siguiente nivel de familia (misma duración si existe);
 * si ya está en la familia más alta, el siguiente precio. Nunca sugiere un pase del día.
 */
export function selectUpgradePlan(
  plans: MembershipPlan[],
  currentPlanId: string | null | undefined,
): MembershipPlan | null {
  const current = currentPlanId
    ? plans.find((plan) => plan.active && plan.id === currentPlanId)
    : undefined
  const active = plans.filter((plan) => plan.active && !isDayPassPlan(plan))
  if (active.length === 0) return null

  if (!current) {
    return [...active].sort((a, b) => b.priceCents - a.priceCents)[0] ?? null
  }

  const currentRank = FAMILY_RANK[planFamilyId(current)]
  const higherFamily = active
    .filter((plan) => plan.id !== current.id && FAMILY_RANK[planFamilyId(plan)] > currentRank)
    .sort((a, b) => {
      const rank = FAMILY_RANK[planFamilyId(a)] - FAMILY_RANK[planFamilyId(b)]
      if (rank !== 0) return rank
      const duration =
        Math.abs(a.durationDays - current.durationDays) -
        Math.abs(b.durationDays - current.durationDays)
      if (duration !== 0) return duration
      return a.priceCents - b.priceCents
    })
  if (higherFamily[0]) return higherFamily[0]

  return (
    active
      .filter((plan) => plan.id !== current.id && plan.priceCents > current.priceCents)
      .sort((a, b) => a.priceCents - b.priceCents)[0] ?? null
  )
}

export function groupPlansByFamily(plans: MembershipPlan[]): PlanFamilyGroup[] {
  const offers = plans.filter((p) => p.active).map(describePlanOffer)
  return FAMILY_ORDER.flatMap((family) => {
    const group = offers.filter((o) => o.familyId === family.id)
    if (group.length === 0) return []
    return [{ family, offers: group }]
  })
}
