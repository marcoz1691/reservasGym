import { describe, it, expect } from 'vitest'
import {
  calculateBmi,
  getBmiCategory,
  calculateWeightDelta,
  calculateGoalProgress,
  calculateCircumferenceDelta,
  canManageGoals,
} from './anthropometrics'

describe('Anthropometrics & BMI Rules', () => {
  describe('calculateBmi', () => {
    it('calculates BMI correctly with weight and height', () => {
      // 70 kg, 175 cm -> 70 / (1.75^2) = 22.857... -> 22.9
      expect(calculateBmi(70, 175)).toBe(22.9)
      // 68.4 kg, 165 cm -> 68.4 / (1.65^2) = 25.12... -> 25.1
      expect(calculateBmi(68.4, 165)).toBe(25.1)
      // 95 kg, 180 cm -> 95 / (1.80^2) = 29.32... -> 29.3
      expect(calculateBmi(95, 180)).toBe(29.3)
      // 100 kg, 170 cm -> 100 / (1.70^2) = 34.60... -> 34.6
      expect(calculateBmi(100, 170)).toBe(34.6)
    })

    it('returns null for missing, non-positive, or non-finite inputs', () => {
      expect(calculateBmi(null, 175)).toBeNull()
      expect(calculateBmi(70, null)).toBeNull()
      expect(calculateBmi(0, 175)).toBeNull()
      expect(calculateBmi(70, 0)).toBeNull()
      expect(calculateBmi(-70, 175)).toBeNull()
      expect(calculateBmi(70, -175)).toBeNull()
      expect(calculateBmi(NaN, 175)).toBeNull()
      expect(calculateBmi(70, Infinity)).toBeNull()
    })
  })

  describe('getBmiCategory', () => {
    it('categorizes Bajo peso (< 18.5) in blue', () => {
      const cat = getBmiCategory(17.8)
      expect(cat).not.toBeNull()
      expect(cat?.key).toBe('underweight')
      expect(cat?.label).toBe('Bajo peso')
      expect(cat?.color).toBe('#3B82F6')
      expect(cat?.badgeVariant).toBe('info')
    })

    it('categorizes Normal (18.5 - 24.9) in green', () => {
      const cat = getBmiCategory(22.5)
      expect(cat).not.toBeNull()
      expect(cat?.key).toBe('normal')
      expect(cat?.label).toBe('Normal')
      expect(cat?.color).toBe('#22C55E')
      expect(cat?.badgeVariant).toBe('success')
    })

    it('categorizes Sobrepeso (25.0 - 29.9) in amber', () => {
      const cat = getBmiCategory(27.4)
      expect(cat).not.toBeNull()
      expect(cat?.key).toBe('overweight')
      expect(cat?.label).toBe('Sobrepeso')
      expect(cat?.color).toBe('#F59E0B')
      expect(cat?.badgeVariant).toBe('warning')
    })

    it('categorizes Obesidad (≥ 30.0) in red', () => {
      const cat = getBmiCategory(32.1)
      expect(cat).not.toBeNull()
      expect(cat?.key).toBe('obese')
      expect(cat?.label).toBe('Obesidad')
      expect(cat?.color).toBe('#EF4444')
      expect(cat?.badgeVariant).toBe('danger')
    })

    it('returns null for invalid BMI', () => {
      expect(getBmiCategory(null)).toBeNull()
      expect(getBmiCategory(0)).toBeNull()
      expect(getBmiCategory(-5)).toBeNull()
    })
  })

  describe('calculateWeightDelta', () => {
    it('calculates weight loss delta with negative sign', () => {
      const delta = calculateWeightDelta(67.2, 68.4)
      expect(delta).not.toBeNull()
      expect(delta?.deltaKg).toBe(-1.2)
      expect(delta?.isLoss).toBe(true)
      expect(delta?.isGain).toBe(false)
      expect(delta?.formatted).toBe('-1.2 kg')
    })

    it('calculates weight gain delta with positive sign', () => {
      const delta = calculateWeightDelta(72.5, 70.0)
      expect(delta).not.toBeNull()
      expect(delta?.deltaKg).toBe(2.5)
      expect(delta?.isLoss).toBe(false)
      expect(delta?.isGain).toBe(true)
      expect(delta?.formatted).toBe('+2.5 kg')
    })

    it('calculates neutral delta', () => {
      const delta = calculateWeightDelta(65.0, 65.0)
      expect(delta).not.toBeNull()
      expect(delta?.deltaKg).toBe(0)
      expect(delta?.isNeutral).toBe(true)
      expect(delta?.formatted).toBe('0.0 kg')
    })

    it('returns null if previous weight is not provided', () => {
      expect(calculateWeightDelta(70, null)).toBeNull()
      expect(calculateWeightDelta(70, undefined)).toBeNull()
    })
  })

  describe('calculateGoalProgress', () => {
    it('calculates progress for weight reduction goal', () => {
      // Started at 70kg, currently 68kg, target is 65kg -> 2kg lost out of 5kg total = 40%
      const progress = calculateGoalProgress(70, 68, 65)
      expect(progress.isLossGoal).toBe(true)
      expect(progress.progressPercent).toBe(40)
      expect(progress.remainingKg).toBe(3)
      expect(progress.isAchieved).toBe(false)
    })

    it('calculates progress for muscle gain goal', () => {
      // Started at 60kg, currently 63kg, target is 65kg -> 3kg gained out of 5kg total = 60%
      const progress = calculateGoalProgress(60, 63, 65)
      expect(progress.isGainGoal).toBe(true)
      expect(progress.progressPercent).toBe(60)
      expect(progress.remainingKg).toBe(2)
      expect(progress.isAchieved).toBe(false)
    })

    it('marks goal as achieved when target is reached or surpassed', () => {
      // Reduction goal: started 80kg, now 74kg, target 75kg
      const achievedLoss = calculateGoalProgress(80, 74, 75)
      expect(achievedLoss.isAchieved).toBe(true)
      expect(achievedLoss.progressPercent).toBe(100)

      // Gain goal: started 60kg, now 66kg, target 65kg
      const achievedGain = calculateGoalProgress(60, 66, 65)
      expect(achievedGain.isAchieved).toBe(true)
      expect(achievedGain.progressPercent).toBe(100)
    })
  })

  describe('calculateCircumferenceDelta', () => {
    it('calculates circumference delta and formatting', () => {
      expect(calculateCircumferenceDelta(76, 78)).toEqual({
        deltaCm: -2,
        formatted: '-2.0 cm',
      })
      expect(calculateCircumferenceDelta(34.5, 32)).toEqual({
        deltaCm: 2.5,
        formatted: '+2.5 cm',
      })
      expect(calculateCircumferenceDelta(null, 70)).toBeNull()
    })
  })

  describe('canManageGoals', () => {
    it('allows staff and admin to manage any user goals', () => {
      expect(canManageGoals('staff', 'staff_1', 'user_2')).toBe(true)
      expect(canManageGoals('admin', 'admin_1', 'user_2')).toBe(true)
    })

    it('allows member to manage only own goals', () => {
      expect(canManageGoals('member', 'user_1', 'user_1')).toBe(true)
      expect(canManageGoals('member', 'user_1', 'user_2')).toBe(false)
    })
  })
})
