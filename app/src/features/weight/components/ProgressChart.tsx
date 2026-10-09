import { useMemo, useState } from 'react'
import type { BodyGoal, BodyMeasurement } from '@/domain/models'
import { calculateWeightDelta } from '@/domain/rules'
import { formatDateShort } from '@/lib/format'
import {
  TrendingUp,
  Activity,
  Ruler,
  Calendar,
  Layers,
} from 'lucide-react'

interface ProgressChartProps {
  measurements: BodyMeasurement[]
  goal?: BodyGoal | null
  heightCm?: number | null
  className?: string
}

type MetricMode = 'weight' | 'bmi' | 'waistHip' | 'upperLower'
type TimeRange = '1M' | '3M' | '6M' | 'ALL'

export function ProgressChart({
  measurements,
  goal,
  className = '',
}: ProgressChartProps) {
  const [mode, setMode] = useState<MetricMode>('weight')
  const [range, setRange] = useState<TimeRange>('ALL')
  const [hoveredPoint, setHoveredPoint] = useState<{
    index: number
    date: string
    value: number
    deltaText?: string
    notes?: string
    x: number
    y: number
  } | null>(null)

  // Sort measurements chronologically (oldest to newest)
  const sorted = useMemo(() => {
    return [...measurements].sort((a, b) =>
      a.measuredAt.localeCompare(b.measuredAt),
    )
  }, [measurements])

  // Filter by time range
  const filtered = useMemo(() => {
    if (range === 'ALL' || sorted.length === 0) return sorted
    const now = new Date()
    const cutoff = new Date()
    if (range === '1M') cutoff.setMonth(now.getMonth() - 1)
    else if (range === '3M') cutoff.setMonth(now.getMonth() - 3)
    else if (range === '6M') cutoff.setMonth(now.getMonth() - 6)

    const filteredList = sorted.filter(
      (m) => new Date(m.measuredAt).getTime() >= cutoff.getTime(),
    )
    return filteredList.length >= 2 ? filteredList : sorted
  }, [sorted, range])

  // Extract series data based on mode
  const seriesData = useMemo(() => {
    return filtered.map((m, idx) => {
      const prev = idx > 0 ? filtered[idx - 1] : null
      let val = m.weightKg
      let unit = 'kg'
      let label = 'Peso'

      if (mode === 'bmi') {
        val = m.bmi ?? 0
        unit = 'kg/m²'
        label = 'IMC'
      } else if (mode === 'waistHip') {
        val = m.waistCm ?? 0
        unit = 'cm'
        label = 'Cintura'
      } else if (mode === 'upperLower') {
        val = m.chestCm ?? 0
        unit = 'cm'
        label = 'Pecho'
      }

      const prevVal =
        prev && mode === 'weight'
          ? prev.weightKg
          : prev && mode === 'bmi'
            ? prev.bmi
            : null

      const delta =
        prevVal != null ? calculateWeightDelta(val, prevVal) : null

      return {
        id: m.id,
        date: m.measuredAt,
        dateFormatted: formatDateShort(m.measuredAt),
        value: val,
        unit,
        label,
        notes: m.notes,
        deltaText: delta ? delta.formatted : undefined,
        secondaryValue:
          mode === 'waistHip'
            ? m.hipCm
            : mode === 'upperLower'
              ? m.armCm
              : undefined,
      }
    })
  }, [filtered, mode])

  // Chart dimensions & coordinates
  const width = 640
  const height = 260
  const paddingX = 40
  const paddingTop = 30
  const paddingBottom = 40

  const plotWidth = width - paddingX * 2
  const plotHeight = height - paddingTop - paddingBottom

  // Calculate Min & Max for scaling
  const values = seriesData
    .map((d) => d.value)
    .filter((v) => Number.isFinite(v) && v > 0)
  const targetWeight = mode === 'weight' && goal ? goal.targetWeightKg : null

  if (targetWeight != null) {
    values.push(targetWeight)
  }

  const rawMin = values.length > 0 ? Math.min(...values) : 50
  const rawMax = values.length > 0 ? Math.max(...values) : 80
  const valMargin = (rawMax - rawMin) * 0.15 || 2
  const minVal = Math.floor(rawMin - valMargin)
  const maxVal = Math.ceil(rawMax + valMargin)
  const valRange = maxVal - minVal || 1

  // Point coordinates
  const points = useMemo(() => {
    if (seriesData.length === 0) return []
    return seriesData.map((d, i) => {
      const x =
        seriesData.length === 1
          ? width / 2
          : paddingX + (i / (seriesData.length - 1)) * plotWidth
      const y =
        paddingTop + plotHeight - ((d.value - minVal) / valRange) * plotHeight
      return {
        ...d,
        x,
        y: Number.isFinite(y) ? y : height / 2,
      }
    })
  }, [seriesData, minVal, valRange, plotWidth, plotHeight, width, height])

  // Generate smooth cubic bezier SVG path
  const curvePath = useMemo(() => {
    if (points.length === 0) return ''
    const pFirst = points[0]
    if (!pFirst) return ''
    if (points.length === 1) return `M ${pFirst.x} ${pFirst.y}`

    let path = `M ${pFirst.x} ${pFirst.y}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)] ?? pFirst
      const p1 = points[i] ?? pFirst
      const p2 = points[i + 1] ?? p1
      const p3 = points[Math.min(points.length - 1, i + 2)] ?? p2

      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    }
    return path
  }, [points])

  // Area under curve
  const areaPath = useMemo(() => {
    if (points.length < 2) return ''
    const pFirst = points[0]
    const pLast = points[points.length - 1]
    if (!pFirst || !pLast) return ''
    const bottomY = paddingTop + plotHeight
    const firstX = pFirst.x
    const lastX = pLast.x
    return `${curvePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`
  }, [curvePath, points, paddingTop, plotHeight])

  // Target line Y coordinate
  const targetY = useMemo(() => {
    if (targetWeight == null) return null
    return (
      paddingTop +
      plotHeight -
      ((targetWeight - minVal) / valRange) * plotHeight
    )
  }, [targetWeight, minVal, valRange, plotHeight])

  return (
    <div
      className={`overflow-hidden rounded-3xl border border-line bg-surface/90 p-5 shadow-[0_10px_35px_rgba(0,0,0,0.35)] ${className}`}
    >
      {/* Header controls: Modes & Ranges */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/80 pb-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-acc/15 text-acc-dark">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-ink">
              Evolución en el Tiempo
            </h3>
            <p className="text-xs text-ink-3">
              Curva de progreso interactiva
            </p>
          </div>
        </div>

        {/* View metric tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMode('weight')}
            className={`focus-ring inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
              mode === 'weight'
                ? 'bg-cta text-cta-contrast shadow-sm'
                : 'bg-surface-elevated text-ink-3 hover:text-ink'
            }`}
          >
            <TrendingUp className="h-3 w-3" />
            Peso (kg)
          </button>
          <button
            type="button"
            onClick={() => setMode('bmi')}
            className={`focus-ring inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
              mode === 'bmi'
                ? 'bg-cta text-cta-contrast shadow-sm'
                : 'bg-surface-elevated text-ink-3 hover:text-ink'
            }`}
          >
            <Activity className="h-3 w-3" />
            IMC
          </button>
          <button
            type="button"
            onClick={() => setMode('waistHip')}
            className={`focus-ring inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
              mode === 'waistHip'
                ? 'bg-cta text-cta-contrast shadow-sm'
                : 'bg-surface-elevated text-ink-3 hover:text-ink'
            }`}
          >
            <Ruler className="h-3 w-3" />
            Cintura
          </button>

          {/* Time range selector */}
          <div className="ml-2 flex items-center rounded-xl bg-bg p-0.5 border border-line">
            {(['1M', '3M', '6M', 'ALL'] as TimeRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-lg px-2 py-0.5 text-[11px] font-bold transition ${
                  range === r
                    ? 'bg-surface-elevated text-acc-dark'
                    : 'text-ink-3 hover:text-ink'
                }`}
              >
                {r === 'ALL' ? 'Todo' : r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Chart Area */}
      {seriesData.length === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center text-center text-ink-3">
          <Layers className="h-8 w-8 text-ink-3/40 mb-2" />
          <p className="text-sm font-semibold">Sin datos suficientes</p>
          <p className="text-xs">Registra tu peso para generar la curva.</p>
        </div>
      ) : (
        <div className="relative mt-3">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible select-none"
          >
            <defs>
              {/* Curve gradient */}
              <linearGradient
                id="chartGradient"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="var(--color-acc)" stopOpacity="0.35" />
                <stop offset="60%" stopColor="var(--color-acc)" stopOpacity="0.08" />
                <stop offset="100%" stopColor="var(--color-acc)" stopOpacity="0.0" />
              </linearGradient>

              {/* Glowing stroke filter */}
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow
                  dx="0"
                  dy="2"
                  stdDeviation="3"
                  floodColor="var(--color-acc)"
                  floodOpacity="0.18"
                />
              </filter>
            </defs>

            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = paddingTop + plotHeight * ratio
              const val = maxVal - ratio * valRange
              return (
                <g key={ratio}>
                  <line
                    x1={paddingX}
                    y1={y}
                    x2={width - paddingX}
                    y2={y}
                    stroke="var(--color-line)"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={paddingX - 8}
                    y={y + 4}
                    textAnchor="end"
                    fill="var(--color-ink-3)"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {val.toFixed(mode === 'bmi' ? 1 : 0)}
                  </text>
                </g>
              )
            })}

            {/* Target Weight Dashed Reference Line */}
            {targetY != null && (
              <g>
                <line
                  x1={paddingX}
                  y1={targetY}
                  x2={width - paddingX}
                  y2={targetY}
                  stroke="var(--color-acc)"
                  strokeDasharray="6 4"
                  strokeWidth="1.5"
                  opacity="0.8"
                />
                <rect
                  x={width - paddingX - 70}
                  y={targetY - 10}
                  width="70"
                  height="18"
                  rx="4"
                  fill="var(--color-acc)"
                />
                <text
                  x={width - paddingX - 35}
                  y={targetY + 2}
                  textAnchor="middle"
                  fill="var(--color-acc-contrast)"
                  fontSize="9"
                  fontWeight="bold"
                >
                  Meta {targetWeight} kg
                </text>
              </g>
            )}

            {/* Area Fill */}
            {areaPath && <path d={areaPath} fill="url(#chartGradient)" />}

            {/* Main Smooth Line */}
            {curvePath && (
              <path
                d={curvePath}
                fill="none"
                stroke="var(--color-acc)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#glow)"
              />
            )}

            {/* Point circles & Tooltip Triggers */}
            {points.map((p, i) => (
              <g key={p.id || i}>
                {/* Outer halo */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoveredPoint?.index === i ? 7 : 4.5}
                  fill="var(--color-surface)"
                  stroke="var(--color-acc)"
                  strokeWidth={hoveredPoint?.index === i ? 3 : 2}
                  className="transition-all duration-200 cursor-pointer"
                />
                {/* Inner dot */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={2.5}
                  fill="var(--color-acc)"
                  className="pointer-events-none"
                />

                {/* X-axis date labels */}
                {(points.length <= 6 ||
                  i === 0 ||
                  i === points.length - 1 ||
                  i % Math.ceil(points.length / 5) === 0) && (
                  <text
                    x={p.x}
                    y={height - 15}
                    textAnchor="middle"
                    fill="var(--color-ink-3)"
                    fontSize="10"
                    fontWeight="500"
                  >
                    {p.dateFormatted}
                  </text>
                )}

                {/* Invisible hover area */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="18"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() =>
                    setHoveredPoint({
                      index: i,
                      date: p.dateFormatted,
                      value: p.value,
                      deltaText: p.deltaText,
                      notes: p.notes,
                      x: p.x,
                      y: p.y,
                    })
                  }
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              </g>
            ))}
          </svg>

          {/* Floating Hover Tooltip */}
          {hoveredPoint && (
            <div
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full pb-3 transition-all duration-150"
              style={{
                left: `${(hoveredPoint.x / width) * 100}%`,
                top: `${(hoveredPoint.y / height) * 100}%`,
              }}
            >
              <div className="rounded-xl border border-line bg-bg/95 px-3 py-2 text-xs shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-1.5 text-xs text-ink-3">
                  <Calendar className="h-3 w-3" />
                  <span>{hoveredPoint.date}</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-sm font-black text-ink">
                    {hoveredPoint.value.toFixed(1)}{' '}
                    {mode === 'bmi' ? 'kg/m²' : mode === 'weight' ? 'kg' : 'cm'}
                  </span>
                  {hoveredPoint.deltaText && (
                    <span className="text-[11px] font-bold text-acc-dark">
                      ({hoveredPoint.deltaText})
                    </span>
                  )}
                </div>
                {hoveredPoint.notes && (
                  <p className="mt-1 text-[11px] text-ink-2 max-w-[140px] truncate">
                    {hoveredPoint.notes}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
