import { useMemo } from 'react'
import { getBmiCategory } from '@/domain/rules'
import { Activity } from 'lucide-react'

interface BmiGaugeProps {
  bmi?: number | null
  heightCm?: number | null
  compact?: boolean
  className?: string
}

export function BmiGauge({
  bmi,
  heightCm,
  compact = false,
  className = '',
}: BmiGaugeProps) {
  const category = useMemo(() => getBmiCategory(bmi), [bmi])

  // Map BMI (range 15 to 35 for visual display) to 0% - 100%
  const positionPercent = useMemo(() => {
    if (bmi == null || !Number.isFinite(bmi)) return null
    const minScale = 15
    const maxScale = 35
    const clamped = Math.max(minScale, Math.min(maxScale, bmi))
    return ((clamped - minScale) / (maxScale - minScale)) * 100
  }, [bmi])

  if (bmi == null || !category) {
    return (
      <div
        className={`rounded-2xl border border-line/60 bg-surface/80 p-4 text-center ${className}`}
      >
        <div className="flex items-center justify-center gap-2 text-ink-3">
          <Activity className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            Índice de Masa Corporal (IMC)
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-3">
          {heightCm
            ? 'Registra tu peso para calcular tu IMC automático'
            : 'Agrega tu estatura en el perfil para calcular el IMC'}
        </p>
      </div>
    )
  }

  const categoryColorStyles: Record<string, { bg: string; text: string; border: string }> = {
    underweight: {
      bg: 'bg-blue-500/15',
      text: 'text-blue-600',
      border: 'border-blue-500/30',
    },
    normal: {
      bg: 'bg-success/15',
      text: 'text-success',
      border: 'border-success/30',
    },
    overweight: {
      bg: 'bg-warn/15',
      text: 'text-warn',
      border: 'border-warn/30',
    },
    obese: {
      bg: 'bg-danger/15',
      text: 'text-danger',
      border: 'border-danger/30',
    },
  }

  const defaultBadgeStyle = {
    bg: 'bg-success/15',
    text: 'text-success',
    border: 'border-success/30',
  }
  const badgeStyle = categoryColorStyles[category.key] ?? defaultBadgeStyle

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: category.color }}
          />
          {bmi.toFixed(1)} · {category.label}
        </span>
      </div>
    )
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-line bg-surface/90 p-4.5 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.35)] ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${category.color}20` }}
          >
            <Activity className="h-4 w-4" style={{ color: category.color }} />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-ink-3">
              Índice de Masa Corporal
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black tracking-tight text-ink">
                {bmi.toFixed(1)}
              </span>
              <span className="text-xs text-ink-3">kg/m²</span>
            </div>
          </div>
        </div>

        {/* Badge */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tracking-wide ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
        >
          <span
            className="h-2 w-2 rounded-full animate-pulse"
            style={{ backgroundColor: category.color }}
          />
          {category.label}
        </span>
      </div>

      <p className="mt-2 text-xs text-ink-3">{category.description}</p>

      {/* Visual Segmented Gauge Bar */}
      <div className="mt-4 space-y-1.5">
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-bg flex">
          {/* Bajo peso (< 18.5) -> minScale 15 to 18.5: (3.5 / 20) = 17.5% */}
          <div
            className="h-full bg-blue-500/80 transition-all"
            style={{ width: '17.5%' }}
            title="Bajo peso (< 18.5)"
          />
          {/* Normal (18.5 - 25.0) -> (6.5 / 20) = 32.5% */}
          <div
            className="h-full bg-success/80 transition-all"
            style={{ width: '32.5%' }}
            title="Normal (18.5 - 24.9)"
          />
          {/* Sobrepeso (25.0 - 30.0) -> (5.0 / 20) = 25.0% */}
          <div
            className="h-full bg-warn/80 transition-all"
            style={{ width: '25%' }}
            title="Sobrepeso (25.0 - 29.9)"
          />
          {/* Obesidad (≥ 30.0) -> (5.0 / 20) = 25.0% */}
          <div
            className="h-full bg-danger/80 transition-all"
            style={{ width: '25%' }}
            title="Obesidad (≥ 30.0)"
          />
        </div>

        {/* Pointer marker */}
        {positionPercent != null && (
          <div className="relative h-3 w-full">
            <div
              className="absolute top-0 -translate-x-1/2 transition-all duration-500 ease-out flex flex-col items-center"
              style={{ left: `${positionPercent}%` }}
            >
              <div
                className="h-2.5 w-2.5 rotate-45 rounded-xs shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                style={{ backgroundColor: category.color }}
              />
            </div>
          </div>
        )}

        {/* Scale labels */}
        <div className="flex justify-between text-[10px] font-medium text-ink-3 px-0.5">
          <span>15</span>
          <span className="text-blue-600/80">18.5</span>
          <span className="text-success/80">25.0</span>
          <span className="text-warn/80">30.0</span>
          <span>35+</span>
        </div>
      </div>
    </div>
  )
}
