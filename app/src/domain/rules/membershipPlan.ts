/** Input for creating/updating a membership plan (admin UI / repository). */
export interface MembershipPlanInput {
  name: string
  priceCents: number
  durationDays: number
  visitQuota?: number | null
  allowedZoneIds?: string[]
  active?: boolean
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
