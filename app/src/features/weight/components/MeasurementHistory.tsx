import { useState } from 'react'
import type { BodyMeasurement } from '@/domain/models'
import { calculateWeightDelta, getBmiCategory } from '@/domain/rules'
import { formatDateShort } from '@/lib/format'
import {
  Calendar,
  Trash2,
  Edit3,
  TrendingDown,
  TrendingUp,
  Minus,
  Ruler,
  FileText,
} from 'lucide-react'

interface MeasurementHistoryProps {
  history: BodyMeasurement[]
  onEdit: (m: BodyMeasurement) => void
  onDelete: (id: string) => Promise<void>
}

export function MeasurementHistory({
  history,
  onEdit,
  onDelete,
}: MeasurementHistoryProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  if (history.length === 0) {
    return (
      <div className="rounded-3xl border border-line bg-surface/80 p-8 text-center shadow-lg">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-elevated text-ink-3">
          <Calendar className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-base font-bold text-ink">Sin mediciones registradas</h3>
        <p className="mt-1 text-xs text-ink-3">
          Comienza registrando tu primer peso para ver el historial y análisis antropométrico.
        </p>
      </div>
    )
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await onDelete(id)
      setConfirmDeleteId(null)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {history.map((m, index) => {
        // Find previous chronological measurement (the one recorded earlier in time)
        const previous = index < history.length - 1 ? history[index + 1] : null
        const delta = previous
          ? calculateWeightDelta(m.weightKg, previous.weightKg)
          : null
        const bmiCategory = getBmiCategory(m.bmi)

        const hasCircumferences =
          m.waistCm != null ||
          m.hipCm != null ||
          m.chestCm != null ||
          m.armCm != null ||
          m.thighCm != null

        const isConfirming = confirmDeleteId === m.id

        return (
          <div
            key={m.id}
            className="group relative overflow-hidden rounded-2xl border border-line bg-surface/90 p-4 transition-all duration-200 hover:border-line hover:bg-surface shadow-md"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Left: Date, Weight, Delta, BMI */}
              <div className="flex flex-wrap items-center gap-4">
                {/* Weight Big */}
                <div className="min-w-[90px]">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-ink">
                      {m.weightKg.toFixed(1)}
                    </span>
                    <span className="text-xs font-bold text-ink-3">kg</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-ink-3">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDateShort(m.measuredAt)}</span>
                  </div>
                </div>

                {/* Delta Pill */}
                {delta ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                      delta.isLoss
                        ? 'bg-success-soft text-success border border-success/25'
                        : delta.isGain
                          ? 'bg-warn-soft text-warn border border-warn/25'
                          : 'bg-surface text-ink-3'
                    }`}
                  >
                    {delta.isLoss ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : delta.isGain ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                    {delta.formatted}
                  </span>
                ) : (
                  <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink-3">
                    Primer registro
                  </span>
                )}

                {/* BMI Badge */}
                {m.bmi != null && bmiCategory != null && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border"
                    style={{
                      backgroundColor: `${bmiCategory.color}15`,
                      color: bmiCategory.color,
                      borderColor: `${bmiCategory.color}30`,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: bmiCategory.color }}
                    />
                    IMC {m.bmi.toFixed(1)} · {bmiCategory.label}
                  </span>
                )}
              </div>

              {/* Right Actions: Edit & Delete */}
              <div className="flex items-center gap-1.5">
                {isConfirming ? (
                  <div className="flex items-center gap-1.5 animate-in fade-in">
                    <button
                      type="button"
                      disabled={deletingId === m.id}
                      onClick={() => void handleDelete(m.id)}
                      className="rounded-xl bg-danger px-3 py-1.5 text-xs font-bold text-white hover:brightness-110 disabled:opacity-50"
                    >
                      {deletingId === m.id ? 'Eliminando...' : 'Confirmar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-xl border border-line bg-transparent px-2.5 py-1.5 text-xs text-ink-2 hover:bg-surface-elevated"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onEdit(m)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-3 transition hover:bg-surface-elevated hover:text-ink"
                      title="Editar registro"
                      aria-label={`Editar registro del ${formatDateShort(m.measuredAt)}`}
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(m.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-3 transition hover:bg-danger-soft hover:text-danger"
                      title="Eliminar registro"
                      aria-label={`Eliminar registro del ${formatDateShort(m.measuredAt)}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Circumference detail pills (if recorded) */}
            {hasCircumferences && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/60 pt-2.5 text-xs text-ink-2">
                <span className="flex items-center gap-1 text-xs font-bold text-ink-3 uppercase tracking-wider">
                  <Ruler className="h-3 w-3 text-acc-dark" />
                  Medidas:
                </span>
                {m.waistCm != null && (
                  <span className="rounded-lg bg-bg px-2 py-0.5 border border-line text-xs">
                    Cintura: <strong className="text-ink">{m.waistCm} cm</strong>
                  </span>
                )}
                {m.hipCm != null && (
                  <span className="rounded-lg bg-bg px-2 py-0.5 border border-line text-xs">
                    Cadera: <strong className="text-ink">{m.hipCm} cm</strong>
                  </span>
                )}
                {m.chestCm != null && (
                  <span className="rounded-lg bg-bg px-2 py-0.5 border border-line text-xs">
                    Pecho: <strong className="text-ink">{m.chestCm} cm</strong>
                  </span>
                )}
                {m.armCm != null && (
                  <span className="rounded-lg bg-bg px-2 py-0.5 border border-line text-xs">
                    Brazo: <strong className="text-ink">{m.armCm} cm</strong>
                  </span>
                )}
                {m.thighCm != null && (
                  <span className="rounded-lg bg-bg px-2 py-0.5 border border-line text-xs">
                    Muslo: <strong className="text-ink">{m.thighCm} cm</strong>
                  </span>
                )}
              </div>
            )}

            {/* Notes */}
            {m.notes && (
              <div className="mt-2 flex items-start gap-1.5 text-xs text-ink-3">
                <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5 text-ink-3/70" />
                <p className="italic">{m.notes}</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
