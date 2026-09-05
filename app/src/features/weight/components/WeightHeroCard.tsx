import { useMemo } from 'react'
import type { BodyGoal, BodyMeasurement } from '@/domain/models'
import {
  calculateBmi,
  calculateGoalProgress,
  calculateWeightDelta,
} from '@/domain/rules'
import { formatDateShort } from '@/lib/format'
import { BmiGauge } from './BmiGauge'
import {
  Scale,
  Target,
  Plus,
  TrendingDown,
  TrendingUp,
  Minus,
  Sparkles,
  Calendar,
  Ruler,
} from 'lucide-react'

interface WeightHeroCardProps {
  currentMeasurement?: BodyMeasurement | null
  initialWeightKg?: number | null
  heightCm?: number | null
  goal?: BodyGoal | null
  onOpenMeasurementModal: () => void
  onOpenGoalModal: () => void
  isStaff?: boolean
}

export function WeightHeroCard({
  currentMeasurement,
  initialWeightKg,
  heightCm,
  goal,
  onOpenMeasurementModal,
  onOpenGoalModal,
  isStaff = false,
}: WeightHeroCardProps) {
  const currentWeight = currentMeasurement?.weightKg ?? initialWeightKg ?? null
  const effectiveHeight = currentMeasurement?.heightCm ?? heightCm ?? null

  const bmi = useMemo(() => {
    if (currentMeasurement?.bmi) return currentMeasurement.bmi
    if (currentWeight && effectiveHeight) {
      return calculateBmi(currentWeight, effectiveHeight)
    }
    return null
  }, [currentMeasurement, currentWeight, effectiveHeight])

  const totalDelta = useMemo(() => {
    if (currentWeight == null || initialWeightKg == null) return null
    return calculateWeightDelta(currentWeight, initialWeightKg)
  }, [currentWeight, initialWeightKg])

  const goalProgress = useMemo(() => {
    if (!goal || currentWeight == null || initialWeightKg == null) return null
    return calculateGoalProgress(initialWeightKg, currentWeight, goal.targetWeightKg)
  }, [goal, currentWeight, initialWeightKg])

  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-surface-elevated via-surface to-bg p-5 md:p-6 shadow-[var(--shadow-pop)]">
      {/* Background Accent Glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-acc/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

      {/* Header row with actions */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-line/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-acc/15 text-acc border border-acc/20 shadow-[0_0_15px_rgba(201,255,61,0.2)]">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-ink md:text-xl">
              Antropometría & Progreso Físico
            </h2>
            <p className="text-xs text-ink-3">
              {currentMeasurement
                ? `Último registro: ${formatDateShort(currentMeasurement.measuredAt)}`
                : 'Sin registros recientes'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenGoalModal}
            className="focus-ring inline-flex items-center gap-1.5 rounded-2xl border border-line bg-surface-elevated/80 px-3.5 py-2 text-xs font-bold text-ink-2 transition hover:border-acc/40 hover:text-ink hover:bg-surface-elevated"
          >
            <Target className="h-4 w-4 text-acc" />
            {goal ? 'Ajustar meta' : 'Definir meta'}
          </button>
          <button
            type="button"
            onClick={onOpenMeasurementModal}
            className="focus-ring inline-flex items-center gap-1.5 rounded-2xl bg-acc px-4 py-2 text-xs font-black text-[#0A0D06] shadow-[0_4px_20px_rgba(201,255,61,0.3)] transition hover:brightness-110 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            {isStaff ? 'Registrar medidas' : 'Nueva medición'}
          </button>
        </div>
      </div>

      {/* Main Grid: Metrics summary + BMI Gauge */}
      <div className="relative mt-5 grid gap-5 lg:grid-cols-12 items-stretch">
        {/* Left Column: 3 Metric Cards (Current, Initial, Goal) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Current Weight */}
            <div className="col-span-2 sm:col-span-1 rounded-2xl border border-line bg-bg/80 p-4 transition hover:border-acc/30">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
                Peso Actual
              </span>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-3xl font-black tracking-tight text-ink">
                  {currentWeight != null ? currentWeight.toFixed(1) : '—'}
                </span>
                <span className="text-xs font-bold text-ink-3">kg</span>
              </div>
              {effectiveHeight ? (
                <div className="mt-2 flex items-center gap-1 text-[11px] text-ink-3">
                  <Ruler className="h-3 w-3" />
                  <span>Estatura: {effectiveHeight} cm</span>
                </div>
              ) : null}
            </div>

            {/* Initial Weight & Change */}
            <div className="rounded-2xl border border-line bg-bg/80 p-4 transition hover:border-line">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
                Peso Inicial
              </span>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-ink-2">
                  {initialWeightKg != null ? initialWeightKg.toFixed(1) : '—'}
                </span>
                <span className="text-xs text-ink-3">kg</span>
              </div>
              {totalDelta ? (
                <div
                  className={`mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                    totalDelta.isLoss
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : totalDelta.isGain
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-surface text-ink-3'
                  }`}
                >
                  {totalDelta.isLoss ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : totalDelta.isGain ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                  <span>{totalDelta.formatted} total</span>
                </div>
              ) : null}
            </div>

            {/* Goal Weight */}
            <div className="rounded-2xl border border-line bg-bg/80 p-4 transition hover:border-line">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
                Meta
              </span>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-acc">
                  {goal?.targetWeightKg != null ? goal.targetWeightKg.toFixed(1) : '—'}
                </span>
                <span className="text-xs text-ink-3">kg</span>
              </div>
              {goal ? (
                <div className="mt-2 flex items-center gap-1 text-[11px] text-ink-3">
                  <Calendar className="h-3 w-3 text-acc/70" />
                  <span>{formatDateShort(goal.targetDate)}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenGoalModal}
                  className="mt-2 text-[11px] font-bold text-acc hover:underline"
                >
                  + Fijar meta
                </button>
              )}
            </div>
          </div>

          {/* Goal Progress Bar Card (if goal is set) */}
          {goal && goalProgress && (
            <div className="rounded-2xl border border-line bg-bg/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-ink-2 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-acc" />
                  Progreso hacia la meta ({goal.targetWeightKg} kg)
                </span>
                <span className="font-extrabold text-acc">
                  {goalProgress.isAchieved
                    ? '¡Meta alcanzada! 🎉'
                    : `${goalProgress.progressPercent}% completado`}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-surface p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-acc/80 to-acc transition-all duration-700 ease-out shadow-[0_0_12px_rgba(201,255,61,0.5)]"
                  style={{ width: `${goalProgress.progressPercent}%` }}
                />
              </div>

              <div className="mt-2 flex justify-between text-[11px] text-ink-3">
                <span>
                  {goalProgress.isAchieved
                    ? 'Objetivo logrado con éxito'
                    : `Faltan ${goalProgress.remainingKg.toFixed(1)} kg para alcanzar tu objetivo`}
                </span>
                <span>Estado: <strong className="capitalize text-ink-2">{goal.status === 'active' ? 'Activo' : goal.status === 'achieved' ? 'Alcanzado' : 'Cancelado'}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: BMI Gauge */}
        <div className="lg:col-span-5 flex flex-col justify-center">
          <BmiGauge bmi={bmi} heightCm={effectiveHeight} />
        </div>
      </div>
    </div>
  )
}
