import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import {
  Activity,
  Calendar,
  Check,
  ChevronRight,
  Fingerprint,
  HeartPulse,
  Ruler,
  Scale,
  Sparkles,
  X,
} from 'lucide-react'
import { useCurrentUser, useGym, useRefresh } from '@/data/RepositoryProvider'
import { calculateBmi, getBmiCategory } from '@/domain/rules/anthropometrics'
import { registerBiometrics } from '@/lib/biometrics'
import { Badge, Button, Card, Input } from '@/ui/primitives'

interface FichaTecnicaModalProps {
  open: boolean
  onClose: () => void
  isInitialOnboarding?: boolean
  /** Solo en onboarding: permite entrar a la app y llenar la ficha después */
  onSkip?: () => void
}

const PRESET_GOALS = [
  'Ganancia muscular y fuerza',
  'Pérdida de grasa y definición',
  'Acondicionamiento Hyrox / CrossFit',
  'Salud cardiovascular y movilidad',
  'Rehabilitación y fisioterapia',
  'Rendimiento atlético de alto nivel',
]

export function FichaTecnicaModal({
  open,
  onClose,
  isInitialOnboarding = false,
  onSkip,
}: FichaTecnicaModalProps) {
  const user = useCurrentUser()
  const { repo } = useGym()
  const refresh = useRefresh()

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [nowMs] = useState(() => Date.now())
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [bioWarning, setBioWarning] = useState('')
  const [formError, setFormError] = useState('')
  const hydratedUserId = useRef<string | null>(null)

  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [waistCm, setWaistCm] = useState('')
  const [hipCm, setHipCm] = useState('')
  const [chestCm, setChestCm] = useState('')
  const [armCm, setArmCm] = useState('')
  const [thighCm, setThighCm] = useState('')

  const [birthDate, setBirthDate] = useState('')
  const [residence, setResidence] = useState('')

  const [selectedGoals, setSelectedGoals] = useState<string[]>([])
  const [customGoal, setCustomGoal] = useState('')
  const [healthNotes, setHealthNotes] = useState('')

  const [enableBiometrics, setEnableBiometrics] = useState(false)

  useEffect(() => {
    if (!user || hydratedUserId.current === user.id) return
    hydratedUserId.current = user.id
    setHeightCm(user.heightCm != null ? String(user.heightCm) : '')
    setWeightKg(user.initialWeightKg != null ? String(user.initialWeightKg) : '')
    setBirthDate(user.birthDate ?? '')
    setResidence(user.residence ?? '')
    setHealthNotes(user.healthNotes ?? '')
    setSelectedGoals(
      user.goals
        ? user.goals
            .split(', ')
            .map((goal) => goal.trim())
            .filter(Boolean)
        : [],
    )
  }, [user])

  const hNum = Number(heightCm) || 0
  const wNum = Number(weightKg) || 0
  const bmiVal = calculateBmi(wNum, hNum)
  const bmiCategory = bmiVal ? getBmiCategory(bmiVal) : null

  // Calculate age if birthDate is set (nowMs estable entre renders)
  const age = birthDate
    ? Math.floor(
        (nowMs - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000),
      )
    : null

  function toggleGoal(g: string) {
    if (selectedGoals.includes(g)) {
      setSelectedGoals(selectedGoals.filter((x) => x !== g))
    } else {
      setSelectedGoals([...selectedGoals, g])
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (isInitialOnboarding && (hNum <= 0 || wNum <= 0)) {
      setStep(3)
      setFormError('Ingresa tu estatura y masa corporal para terminar la ficha.')
      return
    }
    setFormError('')
    setSaving(true)

    try {
      const finalGoals = [
        ...selectedGoals,
        ...(customGoal.trim() ? [customGoal.trim()] : []),
      ].join(', ')

      // 1. Update user profile
      if (repo.updateProfile) {
        await repo.updateProfile({
          heightCm: hNum || undefined,
          initialWeightKg: wNum || undefined,
          birthDate: birthDate.trim() || undefined,
          residence: residence.trim() || undefined,
          goals: finalGoals || undefined,
          healthNotes: healthNotes.trim() || undefined,
        })
      }

      // 2. Log initial body measurement if weight provided
      if (wNum > 0 && repo.createMeasurement) {
        await repo.createMeasurement({
          userId: user.id,
          recordedBy: user.id,
          weightKg: wNum,
          heightCm: hNum || undefined,
          bmi: bmiVal ?? undefined,
          waistCm: waistCm ? Number(waistCm) : undefined,
          hipCm: hipCm ? Number(hipCm) : undefined,
          chestCm: chestCm ? Number(chestCm) : undefined,
          armCm: armCm ? Number(armCm) : undefined,
          thighCm: thighCm ? Number(thighCm) : undefined,
          measuredAt: new Date().toISOString(),
          notes: 'Ficha técnica inicial de ingreso',
        })
      }

      // 3. Register biometrics if enabled
      if (enableBiometrics) {
        const paired = await registerBiometrics({
          id: user.id,
          email: user.email,
          fullName: user.fullName,
        })
        if (!paired) {
          setBioWarning(
            'No se activó la biometría: este dispositivo no la confirmó.',
          )
        }
      }

      if (isInitialOnboarding) {
        // Keep the socio pending until after the success pause so RequireAuth
        // does not bounce /bienvenida → / before the banner paints.
        setSavedSuccess(true)
        setTimeout(() => {
          void (async () => {
            await refresh()
            onClose()
          })()
        }, 1500)
      } else {
        await refresh()
        setSavedSuccess(true)
        setTimeout(() => {
          onClose()
        }, 1500)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const birthDateId = useId()
  const residenceId = useId()
  const heightId = useId()
  const weightId = useId()
  const waistId = useId()
  const hipId = useId()
  const chestId = useId()
  const armId = useId()
  const thighId = useId()
  const customGoalId = useId()
  const healthNotesId = useId()
  const bioSwitchId = useId()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <Card className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden border border-line bg-surface p-0 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line bg-surface p-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-acc/20 text-acc">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink sm:text-xl">
                {isInitialOnboarding
                  ? 'Ficha Técnica Inicial de Ingreso'
                  : 'Ficha Técnica Antropométrica'}
              </h2>
              <p className="text-xs text-ink-3">
                Zona Cero Performance Center • Registro de salud y rendimiento
              </p>
            </div>
          </div>
          {!isInitialOnboarding && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-ink-3 hover:bg-surface-elevated hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Progress Stepper */}
        <div className="grid grid-cols-4 border-b border-line bg-bg/80 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex items-center justify-center gap-2 py-3 transition-colors ${
              step === 1
                ? 'border-b-2 border-acc text-acc'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">1. Datos personales</span>
            <span className="sm:hidden">1. Datos</span>
          </button>
          <button
            type="button"
            onClick={() => setStep(2)}
            className={`flex items-center justify-center gap-2 py-3 transition-colors ${
              step === 2
                ? 'border-b-2 border-acc text-acc'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            <HeartPulse className="h-4 w-4" />
            <span className="hidden sm:inline">2. Salud</span>
            <span className="sm:hidden">2. Salud</span>
          </button>
          <button
            type="button"
            onClick={() => setStep(3)}
            className={`flex items-center justify-center gap-2 py-3 transition-colors ${
              step === 3
                ? 'border-b-2 border-acc text-acc'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            <Scale className="h-4 w-4" />
            <span className="hidden sm:inline">3. Medidas corporales</span>
            <span className="sm:hidden">3. Medidas</span>
          </button>
          <button
            type="button"
            onClick={() => setStep(4)}
            className={`flex items-center justify-center gap-2 py-3 transition-colors ${
              step === 4
                ? 'border-b-2 border-acc text-acc'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            <Fingerprint className="h-4 w-4" />
            <span className="hidden sm:inline">4. Biometría</span>
            <span className="sm:hidden">4. Acceso</span>
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto p-6">
          {savedSuccess ? (
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
                <Check className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-ink">¡Ficha Técnica Guardada!</h3>
              <p className="mt-2 text-sm text-ink-3">
                Tus medidas corporales y metas han sido registradas con éxito.
                {bioWarning ? ` ${bioWarning}` : ''}
              </p>
            </div>
          ) : (
            <>
              {formError ? (
                <p className="mb-4 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
                  {formError}
                </p>
              ) : null}
              {/* STEP 3: Medidas corporales */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-acc/20 bg-acc/5 p-4 text-xs text-ink-2">
                    <p className="font-semibold text-acc">
                      Evaluación inicial de composición corporal
                    </p>
                    <p className="mt-1 text-ink-3">
                      Ingresa tu estatura y masa corporal para calcular tu Índice de Masa
                      Corporal (IMC) y monitorear tu evolución atlética.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor={heightId} className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-3">
                        Estatura (cm) *
                      </label>
                      <div className="relative">
                        <Input
                          id={heightId}
                          type="number"
                          min="100"
                          max="250"
                          required
                          value={heightCm}
                          onChange={(e) => setHeightCm(e.target.value)}
                          placeholder="Ej. 175"
                          className="pl-9 font-mono text-base font-bold"
                        />
                        <Ruler className="absolute left-3 top-3 h-4 w-4 text-ink-3" />
                      </div>
                    </div>

                    <div>
                      <label htmlFor={weightId} className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-3">
                        Masa corporal (kg) *
                      </label>
                      <div className="relative">
                        <Input
                          id={weightId}
                          type="number"
                          step="0.1"
                          min="30"
                          max="300"
                          required
                          value={weightKg}
                          onChange={(e) => setWeightKg(e.target.value)}
                          placeholder="Ej. 75.5"
                          className="pl-9 font-mono text-base font-bold text-acc"
                        />
                        <Scale className="absolute left-3 top-3 h-4 w-4 text-ink-3" />
                      </div>
                    </div>
                  </div>

                  {/* Real-time BMI Display Card */}
                  {bmiVal && bmiCategory ? (
                    <div className="rounded-2xl border border-line bg-surface p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-ink-3">
                            Índice de Masa Corporal (IMC)
                          </span>
                          <div className="mt-1 flex items-baseline gap-2">
                            <span className="font-mono text-3xl font-extrabold text-ink">
                              {bmiVal}
                            </span>
                            <span className="text-xs text-ink-3">kg/m²</span>
                          </div>
                        </div>
                        <Badge
                          tone={
                            bmiCategory.key === 'normal'
                              ? 'ok'
                              : bmiCategory.key === 'underweight'
                                ? 'neutral'
                                : bmiCategory.key === 'overweight'
                                  ? 'warn'
                                  : 'danger'
                          }
                          className="px-3 py-1 text-sm font-bold"
                        >
                          {bmiCategory.label}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-ink-3">{bmiCategory.description}</p>
                    </div>
                  ) : null}

                  {/* Optional Body Circumferences */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-ink-3">
                        Medidas de Circunferencia (cm) — Opcionales
                      </span>
                      <Badge tone="neutral" className="text-[10px]">
                        Detalle corporal
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      <div>
                        <label htmlFor={waistId} className="text-[11px] text-ink-3">Cintura</label>
                        <Input
                          id={waistId}
                          type="number"
                          step="0.5"
                          value={waistCm}
                          onChange={(e) => setWaistCm(e.target.value)}
                          placeholder="cm"
                          className="mt-1 h-9 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label htmlFor={hipId} className="text-[11px] text-ink-3">Cadera</label>
                        <Input
                          id={hipId}
                          type="number"
                          step="0.5"
                          value={hipCm}
                          onChange={(e) => setHipCm(e.target.value)}
                          placeholder="cm"
                          className="mt-1 h-9 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label htmlFor={chestId} className="text-[11px] text-ink-3">Pecho</label>
                        <Input
                          id={chestId}
                          type="number"
                          step="0.5"
                          value={chestCm}
                          onChange={(e) => setChestCm(e.target.value)}
                          placeholder="cm"
                          className="mt-1 h-9 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label htmlFor={armId} className="text-[11px] text-ink-3">Brazo</label>
                        <Input
                          id={armId}
                          type="number"
                          step="0.5"
                          value={armCm}
                          onChange={(e) => setArmCm(e.target.value)}
                          placeholder="cm"
                          className="mt-1 h-9 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label htmlFor={thighId} className="text-[11px] text-ink-3">Muslo</label>
                        <Input
                          id={thighId}
                          type="number"
                          step="0.5"
                          value={thighCm}
                          onChange={(e) => setThighCm(e.target.value)}
                          placeholder="cm"
                          className="mt-1 h-9 font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 1: Datos personales */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor={birthDateId} className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-3">
                        Fecha de Nacimiento *
                      </label>
                      <div className="relative">
                        <Input
                          id={birthDateId}
                          type="date"
                          required
                          value={birthDate}
                          onChange={(e) => setBirthDate(e.target.value)}
                          className="pl-9 font-mono text-sm"
                        />
                        <Calendar className="absolute left-3 top-3 h-4 w-4 text-ink-3" />
                      </div>
                      {age !== null && !isNaN(age) && (
                        <p className="mt-1 text-xs text-acc">
                          Edad calculada: <strong>{age} años</strong>
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor={residenceId} className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-3">
                        Sector / Ciudad de Residencia *
                      </label>
                      <Input
                        id={residenceId}
                        type="text"
                        required
                        value={residence}
                        onChange={(e) => setResidence(e.target.value)}
                        placeholder="Ej. Quito - Pomasqui, Tumbaco, etc."
                        className="text-sm"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-line bg-surface p-4 text-xs text-ink-3">
                    <p className="font-semibold text-ink">
                      🔒 Privacidad y protección de datos (LOPDP Ecuador)
                    </p>
                    <p className="mt-1">
                      Tus datos personales son de uso exclusivo para tu ficha de entrenamiento
                      y no son compartidos con terceros ni comercializados.
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 2: Salud */}
              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-3">
                      Objetivos Principales de Entrenamiento
                    </label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {PRESET_GOALS.map((goal) => {
                        const selected = selectedGoals.includes(goal)
                        return (
                          <button
                            key={goal}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleGoal(goal)}
                            className={`flex items-center gap-2 rounded-xl border p-3 text-left text-xs font-semibold transition-all ${
                              selected
                                ? 'border-acc bg-acc/15 text-acc'
                                : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink'
                            }`}
                          >
                            <div
                              className={`flex h-4 w-4 items-center justify-center rounded-md border ${
                                selected ? 'border-acc bg-acc text-[var(--color-acc-contrast)]' : 'border-line-strong'
                              }`}
                            >
                              {selected && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                            <span>{goal}</span>
                          </button>
                        )
                      })}
                    </div>
                    <div className="mt-3">
                      <Input
                        id={customGoalId}
                        type="text"
                        value={customGoal}
                        onChange={(e) => setCustomGoal(e.target.value)}
                        placeholder="Otro objetivo específico..."
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor={healthNotesId} className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-3">
                      Antecedentes Médicos, Lesiones o Dolencias
                    </label>
                    <textarea
                      id={healthNotesId}
                      value={healthNotes}
                      onChange={(e) => setHealthNotes(e.target.value)}
                      rows={3}
                      placeholder="Ej. Lesión previa de rodilla derecha, molestia lumbar en sentadilla, ninguna, etc."
                      className="w-full rounded-2xl border border-line bg-surface-elevated p-3 text-xs text-ink placeholder:text-ink-4 focus-visible:border-acc focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acc/20"
                    />
                    <p className="mt-1 text-[11px] text-ink-4">
                      Esta información permite a los entrenadores adaptar las cargas y
                      ejercicios en tus clases.
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 4: Biometrics Setup */}
              {step === 4 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 rounded-2xl border border-acc/30 bg-acc/10 p-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-acc/20 text-acc">
                      <Fingerprint className="h-8 w-8" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-ink">
                        Acceso Rápido con Biometría
                      </h4>
                      <p className="mt-1 text-xs text-ink-3">
                        Inicia sesión de forma instantánea usando <strong>Face ID</strong>,{' '}
                        <strong>Touch ID</strong> o tu huella dactilar en este dispositivo.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4">
                    <div>
                      <span className="text-sm font-bold text-ink">
                        Habilitar Face ID / Huella en este teléfono
                      </span>
                      <p className="text-xs text-ink-3">
                        Tus datos biométricos permanecen seguros en tu dispositivo
                      </p>
                    </div>
                    <label htmlFor={bioSwitchId} className="relative inline-flex cursor-pointer items-center">
                      <input
                        id={bioSwitchId}
                        type="checkbox"
                        aria-label="Habilitar Face ID / Huella en este teléfono"
                        checked={enableBiometrics}
                        onChange={(e) => setEnableBiometrics(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="peer h-6 w-11 rounded-full bg-line-strong after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-acc peer-checked:after:translate-x-full peer-focus:outline-none" />
                    </label>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
                {step > 1 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setStep((s) => (s - 1) as any)}
                  >
                    Atrás
                  </Button>
                ) : (
                  <div>
                    {!isInitialOnboarding ? (
                      <Button type="button" variant="ghost" onClick={onClose}>
                        Cancelar
                      </Button>
                    ) : onSkip ? (
                      <button
                        type="button"
                        onClick={onSkip}
                        className="text-xs font-semibold text-ink-3 underline-offset-2 transition hover:text-ink hover:underline"
                      >
                        Completarla después
                      </button>
                    ) : null}
                  </div>
                )}

                {step < 4 ? (
                  <Button
                    type="button"
                    onClick={() => setStep((s) => (s + 1) as any)}
                    className="flex items-center gap-2"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 font-bold"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{saving ? 'Guardando...' : 'Guardar Ficha Técnica'}</span>
                  </Button>
                )}
              </div>
            </>
          )}
        </form>
      </Card>
    </div>
  )
}
