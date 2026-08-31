/** Anthropometric & Body Progress Rules and Calculations */

import type { UserRole } from '../models'

export type BmiCategoryKey = 'underweight' | 'normal' | 'overweight' | 'obese'

export interface BmiCategoryInfo {
  key: BmiCategoryKey
  label: string
  color: string
  badgeVariant: 'info' | 'success' | 'warning' | 'danger'
  description: string
  minBmi: number
  maxBmi: number
}

export const BMI_CATEGORIES: Record<BmiCategoryKey, BmiCategoryInfo> = {
  underweight: {
    key: 'underweight',
    label: 'Bajo peso',
    color: '#3B82F6', // azul
    badgeVariant: 'info',
    description: 'Por debajo del peso ideal (< 18.5)',
    minBmi: 0,
    maxBmi: 18.49,
  },
  normal: {
    key: 'normal',
    label: 'Normal',
    color: '#22C55E', // verde
    badgeVariant: 'success',
    description: 'Rango saludable (18.5 - 24.9)',
    minBmi: 18.5,
    maxBmi: 24.99,
  },
  overweight: {
    key: 'overweight',
    label: 'Sobrepeso',
    color: '#F59E0B', // ámbar
    badgeVariant: 'warning',
    description: 'Levemente por encima del rango (25.0 - 29.9)',
    minBmi: 25.0,
    maxBmi: 29.99,
  },
  obese: {
    key: 'obese',
    label: 'Obesidad',
    color: '#EF4444', // rojo
    badgeVariant: 'danger',
    description: 'Requiere atención nutricional y de entrenamiento (≥ 30.0)',
    minBmi: 30.0,
    maxBmi: 100,
  },
}

/**
 * Calculates BMI (Body Mass Index): weightKg / ((heightCm / 100) ^ 2)
 * Returns rounded to 1 decimal place, or null if inputs are invalid.
 */
export function calculateBmi(
  weightKg?: number | null,
  heightCm?: number | null,
): number | null {
  if (
    weightKg == null ||
    heightCm == null ||
    !Number.isFinite(weightKg) ||
    !Number.isFinite(heightCm) ||
    weightKg <= 0 ||
    heightCm <= 0
  ) {
    return null
  }
  const heightM = heightCm / 100
  const bmi = weightKg / (heightM * heightM)
  return Math.round(bmi * 10) / 10
}

/**
 * Returns BMI Category and presentation metadata
 */
export function getBmiCategory(bmi?: number | null): BmiCategoryInfo | null {
  if (bmi == null || !Number.isFinite(bmi) || bmi <= 0) {
    return null
  }
  if (bmi < 18.5) return BMI_CATEGORIES.underweight
  if (bmi < 25.0) return BMI_CATEGORIES.normal
  if (bmi < 30.0) return BMI_CATEGORIES.overweight
  return BMI_CATEGORIES.obese
}

export interface WeightDelta {
  deltaKg: number
  isLoss: boolean
  isGain: boolean
  isNeutral: boolean
  formatted: string
}

/**
 * Computes difference between current weight and previous weight
 */
export function calculateWeightDelta(
  currentWeightKg: number,
  previousWeightKg?: number | null,
): WeightDelta | null {
  if (
    previousWeightKg == null ||
    !Number.isFinite(previousWeightKg) ||
    previousWeightKg <= 0
  ) {
    return null
  }
  const delta = Math.round((currentWeightKg - previousWeightKg) * 10) / 10
  const isLoss = delta < 0
  const isGain = delta > 0
  const isNeutral = delta === 0

  const prefix = isGain ? '+' : ''
  return {
    deltaKg: delta,
    isLoss,
    isGain,
    isNeutral,
    formatted: `${prefix}${delta.toFixed(1)} kg`,
  }
}

export interface GoalProgressInfo {
  progressPercent: number
  remainingKg: number
  isAchieved: boolean
  isLossGoal: boolean
  isGainGoal: boolean
}

/**
 * Computes progress towards body weight goal
 */
export function calculateGoalProgress(
  initialWeightKg: number,
  currentWeightKg: number,
  targetWeightKg: number,
): GoalProgressInfo {
  const isLossGoal = targetWeightKg < initialWeightKg
  const isGainGoal = targetWeightKg > initialWeightKg
  const remainingKg = Math.round(Math.abs(currentWeightKg - targetWeightKg) * 10) / 10

  if (initialWeightKg === targetWeightKg) {
    const isAchieved = currentWeightKg === targetWeightKg
    return {
      progressPercent: isAchieved ? 100 : 0,
      remainingKg,
      isAchieved,
      isLossGoal: false,
      isGainGoal: false,
    }
  }

  const totalToChange = Math.abs(targetWeightKg - initialWeightKg)
  let changed = 0
  if (isLossGoal) {
    changed = initialWeightKg - currentWeightKg
  } else {
    changed = currentWeightKg - initialWeightKg
  }

  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round((changed / totalToChange) * 100)),
  )
  const isAchieved = isLossGoal
    ? currentWeightKg <= targetWeightKg
    : currentWeightKg >= targetWeightKg

  return {
    progressPercent: isAchieved ? 100 : progressPercent,
    remainingKg,
    isAchieved,
    isLossGoal,
    isGainGoal,
  }
}

/**
 * Helper to compute circumference deltas across two measurements
 */
export function calculateCircumferenceDelta(
  current?: number | null,
  previous?: number | null,
): { deltaCm: number; formatted: string } | null {
  if (current == null || previous == null) return null
  const delta = Math.round((current - previous) * 10) / 10
  const prefix = delta > 0 ? '+' : ''
  return {
    deltaCm: delta,
    formatted: `${prefix}${delta.toFixed(1)} cm`,
  }
}

/**
 * Checks permissions for body measurement / goal management
 */
export function canManageGoals(
  actorRole: UserRole,
  actorId: string,
  targetUserId: string,
): boolean {
  if (actorRole === 'staff' || actorRole === 'admin') return true
  return actorId === targetUserId
}
