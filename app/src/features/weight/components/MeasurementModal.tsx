import { useState, useMemo, type FormEvent } from 'react'
import type { BodyMeasurement } from '@/domain/models'
import { calculateBmi, getBmiCategory } from '@/domain/rules'
import { Input } from '@/ui/primitives'
import {
  Scale,
  X,
  Sparkles,
} from 'lucide-react'

interface MeasurementModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    weightKg: number
    heightCm?: number
    bmi?: number
    waistCm?: number
    hipCm?: number
    chestCm?: number
    armCm?: number
    thighCm?: number
    measuredAt: string
    notes: string
  }) => Promise<void>
  initialData?: BodyMeasurement | null
  userHeightCm?: number | null
  memberName?: string
  isStaffLogging?: boolean
}

export function MeasurementModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  userHeightCm,
  memberName,
  isStaffLogging = false,
}: MeasurementModalProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'circumferences'>('basic')

  const [weightKg, setWeightKg] = useState(() =>
    initialData ? String(initialData.weightKg) : '',
  )
  const [heightCm, setHeightCm] = useState(() =>
    initialData?.heightCm
      ? String(initialData.heightCm)
      : userHeightCm
        ? String(userHeightCm)
        : '',
  )
  const [waistCm, setWaistCm] = useState(() =>
    initialData?.waistCm ? String(initialData.waistCm) : '',
  )
  const [hipCm, setHipCm] = useState(() =>
    initialData?.hipCm ? String(initialData.hipCm) : '',
  )
  const [chestCm, setChestCm] = useState(() =>
    initialData?.chestCm ? String(initialData.chestCm) : '',
  )
  const [armCm, setArmCm] = useState(() =>
    initialData?.armCm ? String(initialData.armCm) : '',
  )
  const [thighCm, setThighCm] = useState(() =>
    initialData?.thighCm ? String(initialData.thighCm) : '',
  )
  const [measuredAt, setMeasuredAt] = useState(() =>
    initialData
      ? initialData.measuredAt.slice(0, 16)
      : new Date().toISOString().slice(0, 16),
  )
  const [notes, setNotes] = useState(() => initialData?.notes ?? '')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Live BMI computation
  const liveBmi = useMemo(() => {
    const w = Number(weightKg)
    const h = Number(heightCm)
    if (w > 0 && h > 0) {
      return calculateBmi(w, h)
    }
    return null
  }, [weightKg, heightCm])

  const liveCategory = useMemo(() => getBmiCategory(liveBmi), [liveBmi])

  if (!isOpen) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const w = Number(weightKg)
    if (!Number.isFinite(w) || w <= 0) {
      setError('Por favor ingresa un peso válido en kg')
      return
    }

    const h = heightCm ? Number(heightCm) : undefined
    const waist = waistCm ? Number(waistCm) : undefined
    const hip = hipCm ? Number(hipCm) : undefined
    const chest = chestCm ? Number(chestCm) : undefined
    const arm = armCm ? Number(armCm) : undefined
    const thigh = thighCm ? Number(thighCm) : undefined

    setSaving(true)
    try {
      await onSave({
        weightKg: w,
        heightCm: h,
        bmi: liveBmi ?? undefined,
        waistCm: waist,
        hipCm: hip,
        chestCm: chest,
        armCm: arm,
        thighCm: thigh,
        measuredAt: new Date(measuredAt).toISOString(),
        notes: notes.trim(),
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-[#232B36] bg-[#161C24] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#232B36] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-acc/15 text-acc">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-ink">
                {initialData ? 'Editar Medición' : 'Nueva Medición Corporal'}
              </h2>
              <p className="text-xs text-ink-3">
                {isStaffLogging && memberName
                  ? `Registrando datos para ${memberName}`
                  : 'Registra peso y medidas antropométricas'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-ink-3 transition hover:bg-[#1E2530] hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex rounded-2xl bg-[#0E1117] p-1 border border-[#232B36]">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
              activeTab === 'basic'
                ? 'bg-[#1E2530] text-acc shadow'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            1. Peso & Altura
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('circumferences')}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
              activeTab === 'circumferences'
                ? 'bg-[#1E2530] text-acc shadow'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            2. Circunferencias (cm)
          </button>
        </div>

        {/* Live Preview Box */}
        {liveBmi != null && liveCategory != null && (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-[#0E1117]/90 px-4 py-2.5 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-acc" />
              <span className="text-ink-3">IMC estimado:</span>
              <span className="font-extrabold text-ink">{liveBmi.toFixed(1)}</span>
            </div>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold"
              style={{
                backgroundColor: `${liveCategory.color}20`,
                color: liveCategory.color,
              }}
            >
              {liveCategory.label}
            </span>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/15 p-2.5 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          {activeTab === 'basic' ? (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Peso (kg) *"
                  type="number"
                  step="0.1"
                  min="20"
                  max="350"
                  placeholder="Ej. 68.5"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  required
                  autoFocus
                />
                <Input
                  label="Estatura (cm)"
                  type="number"
                  step="0.5"
                  min="100"
                  max="250"
                  placeholder="Ej. 170"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                />
              </div>

              <Input
                label="Fecha y hora"
                type="datetime-local"
                value={measuredAt}
                onChange={(e) => setMeasuredAt(e.target.value)}
                required
              />

              <Input
                label="Notas de la sesión"
                type="text"
                placeholder="Ej. Medición en ayunas, post entrenamiento..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-ink-3">
                Medidas antropométricas opcionales para control de composición:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Cintura (cm)"
                  type="number"
                  step="0.1"
                  placeholder="Ej. 78.0"
                  value={waistCm}
                  onChange={(e) => setWaistCm(e.target.value)}
                />
                <Input
                  label="Cadera (cm)"
                  type="number"
                  step="0.1"
                  placeholder="Ej. 98.5"
                  value={hipCm}
                  onChange={(e) => setHipCm(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <Input
                  label="Pecho (cm)"
                  type="number"
                  step="0.1"
                  placeholder="Ej. 95"
                  value={chestCm}
                  onChange={(e) => setChestCm(e.target.value)}
                />
                <Input
                  label="Brazo (cm)"
                  type="number"
                  step="0.1"
                  placeholder="Ej. 32"
                  value={armCm}
                  onChange={(e) => setArmCm(e.target.value)}
                />
                <Input
                  label="Muslo (cm)"
                  type="number"
                  step="0.1"
                  placeholder="Ej. 56"
                  value={thighCm}
                  onChange={(e) => setThighCm(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex items-center justify-end gap-2 border-t border-[#232B36] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-2xl border border-line bg-transparent px-4 py-2.5 text-xs font-bold text-ink-2 hover:bg-[#1E2530]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-acc px-5 py-2.5 text-xs font-black text-[#0A0D06] shadow-[0_4px_20px_rgba(201,255,61,0.25)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : initialData ? 'Actualizar' : 'Guardar Medición'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
