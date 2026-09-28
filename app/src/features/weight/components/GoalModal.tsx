import { useState, useMemo, type FormEvent } from 'react'
import type { BodyGoal, BodyGoalStatus } from '@/domain/models'
import { calculateBmi, getBmiCategory } from '@/domain/rules'
import { Input, Select } from '@/ui/primitives'
import { ecuadorTodayYmd } from '@/lib/format'
import { Target, X, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'

interface GoalModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (goal: {
    id?: string
    targetWeightKg: number
    targetBmi?: number
    targetDate: string
    status: BodyGoalStatus
  }) => Promise<void>
  existingGoal?: BodyGoal | null
  currentWeightKg?: number | null
  userHeightCm?: number | null
  memberName?: string
}

export function GoalModal({
  isOpen,
  onClose,
  onSave,
  existingGoal,
  currentWeightKg,
  userHeightCm,
  memberName,
}: GoalModalProps) {
  const [targetWeight, setTargetWeight] = useState(() =>
    existingGoal ? String(existingGoal.targetWeightKg) : '',
  )
  const [targetDate, setTargetDate] = useState(() => {
    if (existingGoal?.targetDate) return existingGoal.targetDate.slice(0, 10)
    // +60 días sobre el día de hoy en Ecuador (no en UTC: de noche ya sería mañana)
    const d = new Date(`${ecuadorTodayYmd()}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 60)
    return d.toISOString().slice(0, 10)
  })
  const [status, setStatus] = useState<BodyGoalStatus>(
    () => existingGoal?.status ?? 'active',
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Target BMI preview
  const targetBmi = useMemo(() => {
    const w = Number(targetWeight)
    if (w > 0 && userHeightCm && userHeightCm > 0) {
      return calculateBmi(w, userHeightCm)
    }
    return null
  }, [targetWeight, userHeightCm])

  const targetCategory = useMemo(() => getBmiCategory(targetBmi), [targetBmi])

  // Delta preview vs current weight
  const diffInfo = useMemo(() => {
    const target = Number(targetWeight)
    if (!currentWeightKg || !target || target <= 0) return null
    const diff = Math.round((target - currentWeightKg) * 10) / 10
    return {
      diff,
      isLoss: diff < 0,
      isGain: diff > 0,
      formatted: `${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg`,
    }
  }, [targetWeight, currentWeightKg])

  if (!isOpen) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const w = Number(targetWeight)
    if (!Number.isFinite(w) || w <= 0) {
      setError('Ingresa un peso objetivo válido')
      return
    }
    if (!targetDate) {
      setError('Selecciona una fecha límite para tu meta')
      return
    }

    setSaving(true)
    try {
      await onSave({
        id: existingGoal?.id,
        targetWeightKg: w,
        targetBmi: targetBmi ?? undefined,
        targetDate,
        status,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar la meta')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-acc/15 text-acc">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-ink">
                {existingGoal ? 'Ajustar Meta Corporal' : 'Definir Meta Corporal'}
              </h2>
              <p className="text-xs text-ink-3">
                {memberName
                  ? `Objetivo personalizado para ${memberName}`
                  : 'Establece tu peso objetivo y fecha límite'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-ink-3 transition hover:bg-surface-elevated hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Goal Summary Card */}
        {diffInfo && (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-bg/90 p-3.5 text-xs">
            <div className="flex items-center gap-2">
              {diffInfo.isLoss ? (
                <TrendingDown className="h-4 w-4 text-success" />
              ) : diffInfo.isGain ? (
                <TrendingUp className="h-4 w-4 text-warn" />
              ) : (
                <Sparkles className="h-4 w-4 text-acc" />
              )}
              <span className="text-ink-2">
                {diffInfo.isLoss
                  ? `Meta de reducción: ${Math.abs(diffInfo.diff)} kg`
                  : diffInfo.isGain
                    ? `Meta de aumento muscular: +${diffInfo.diff} kg`
                    : 'Mantener peso actual'}
              </span>
            </div>
            {targetBmi != null && targetCategory && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{
                  backgroundColor: `${targetCategory.color}20`,
                  color: targetCategory.color,
                }}
              >
                IMC {targetBmi.toFixed(1)} ({targetCategory.label})
              </span>
            )}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl border border-danger/30 bg-danger-soft p-2.5 text-xs text-danger">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <Input
            label="Peso Objetivo (kg) *"
            type="number"
            step="0.1"
            min="30"
            max="300"
            placeholder="Ej. 65.0"
            value={targetWeight}
            onChange={(e) => setTargetWeight(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Fecha límite *"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            required
          />

          <Select
            label="Estado de la meta"
            value={status}
            onChange={(e) => setStatus(e.target.value as BodyGoalStatus)}
          >
            <option value="active">Activa (En progreso)</option>
            <option value="achieved">Alcanzada 🎉</option>
            <option value="cancelled">Cancelada / Archivada</option>
          </Select>

          {/* Action buttons */}
          <div className="mt-6 flex items-center justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-2xl border border-line bg-transparent px-4 py-2.5 text-xs font-bold text-ink-2 hover:bg-surface-elevated"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-acc px-5 py-2.5 text-xs font-black text-[var(--color-acc-contrast)] shadow-[var(--shadow-acc)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : existingGoal ? 'Actualizar Meta' : 'Fijar Meta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
