import { useEffect, useMemo, useState } from 'react'
import {
  useAppData,
  useCurrentUser,
  useRefresh,
  useRepo,
} from '@/data/RepositoryProvider'
import type { BodyGoal, BodyMeasurement, User } from '@/domain/models'
import { PageHeader, Select, Spinner } from '@/ui/primitives'
import { WeightHeroCard } from './components/WeightHeroCard'
import { ProgressChart } from './components/ProgressChart'
import { MeasurementModal } from './components/MeasurementModal'
import { GoalModal } from './components/GoalModal'
import { MeasurementHistory } from './components/MeasurementHistory'
import {
  Scale,
  Users,
  Plus,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

export function WeightPage() {
  const user = useCurrentUser()
  const data = useAppData()
  const repo = useRepo()
  const refresh = useRefresh()

  const isStaff = user ? user.role === 'staff' || user.role === 'admin' : false
  const [members, setMembers] = useState<User[]>([])
  const [targetId, setTargetId] = useState<string | null>(() => user?.id ?? null)

  // Modals state
  const [isMeasurementModalOpen, setIsMeasurementModalOpen] = useState(false)
  const [editingMeasurement, setEditingMeasurement] =
    useState<BodyMeasurement | null>(null)
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false)

  // Notification message
  const [toast, setToast] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  // Load members if staff
  useEffect(() => {
    if (!isStaff) return
    void repo.listMembers().then((list) => {
      setMembers(list)
      setTargetId((current) => {
        if (current && list.some((member) => member.id === current)) return current
        return list[0]?.id ?? current
      })
    })
  }, [isStaff, repo])

  const effectiveId = isStaff && targetId ? targetId : user?.id ?? ''

  // Target member profile
  const targetMember = useMemo(() => {
    if (!user) return null
    if (effectiveId === user.id) return user
    return (
      data.users.find((u) => u.id === effectiveId) ??
      members.find((u) => u.id === effectiveId) ??
      user
    )
  }, [effectiveId, user, data.users, members])

  // Measurement history for the active subject
  const history = useMemo(() => {
    return data.measurements
      .filter((m) => m.userId === effectiveId)
      .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
  }, [data.measurements, effectiveId])

  const latestMeasurement = history[0] ?? null

  // Active goal for the subject
  const currentGoal = useMemo(() => {
    const goals = (data.bodyGoals ?? []).filter((g) => g.userId === effectiveId)
    if (goals.length === 0) return null
    const active = goals.find((g) => g.status === 'active')
    return active ?? (goals[0] ?? null)
  }, [data.bodyGoals, effectiveId])

  if (!user || !targetMember) {
    return <Spinner />
  }

  // Save measurement handler
  async function handleSaveMeasurement(measurementData: {
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
  }) {
    if (!user) return
    if (editingMeasurement) {
      await repo.updateMeasurement(editingMeasurement.id, {
        weightKg: measurementData.weightKg,
        heightCm: measurementData.heightCm,
        bmi: measurementData.bmi,
        waistCm: measurementData.waistCm,
        hipCm: measurementData.hipCm,
        chestCm: measurementData.chestCm,
        armCm: measurementData.armCm,
        thighCm: measurementData.thighCm,
        measuredAt: measurementData.measuredAt,
        notes: measurementData.notes,
      })
      showToast('success', 'Medición actualizada correctamente')
    } else {
      await repo.createMeasurement({
        userId: effectiveId,
        recordedBy: user.id,
        weightKg: measurementData.weightKg,
        heightCm: measurementData.heightCm,
        bmi: measurementData.bmi,
        waistCm: measurementData.waistCm,
        hipCm: measurementData.hipCm,
        chestCm: measurementData.chestCm,
        armCm: measurementData.armCm,
        thighCm: measurementData.thighCm,
        measuredAt: measurementData.measuredAt,
        notes: measurementData.notes,
      })
      showToast('success', 'Nueva medición registrada con éxito')
    }
    setEditingMeasurement(null)
    await refresh()
  }

  // Delete measurement handler
  async function handleDeleteMeasurement(id: string) {
    try {
      await repo.deleteMeasurement(id)
      await refresh()
      showToast('success', 'Registro eliminado')
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  // Save goal handler
  async function handleSaveGoal(goalData: {
    id?: string
    targetWeightKg: number
    targetBmi?: number
    targetDate: string
    status: BodyGoal['status']
  }) {
    await repo.upsertBodyGoal({
      id: goalData.id,
      userId: effectiveId,
      targetWeightKg: goalData.targetWeightKg,
      targetBmi: goalData.targetBmi,
      targetDate: goalData.targetDate,
      status: goalData.status,
    })
    await refresh()
    showToast('success', 'Meta corporal guardada correctamente')
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Control Antropométrico & Progreso"
        subtitle="Seguimiento de peso, índice de masa corporal (IMC), circunferencias y metas físicas"
      />

      {/* Toast message */}
      {toast && (
        <div
          className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-bold transition-all shadow-lg animate-in fade-in ${
            toast.type === 'success'
              ? 'border-success/25 bg-success-soft text-success'
              : 'border-danger/30 bg-danger-soft text-danger'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Staff View Bar: Member selector */}
      {isStaff && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-acc/15 text-acc">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-ink-3">
                Panel de Entrenador / Staff
              </span>
              <p className="text-xs font-semibold text-ink-2">
                Visualizando a: <strong className="text-acc">{targetMember.fullName}</strong>
              </p>
            </div>
          </div>

          <div className="w-full sm:w-72">
            <Select
              label="Seleccionar Socio"
              value={effectiveId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              {(members.length > 0
                ? members
                : data.users.filter((u) => u.role === 'member')
              ).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} ({m.email})
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {/* Hero BMI & Weight Card */}
      <WeightHeroCard
        currentMeasurement={latestMeasurement}
        initialWeightKg={targetMember.initialWeightKg}
        heightCm={targetMember.heightCm}
        goal={currentGoal}
        onOpenMeasurementModal={() => {
          setEditingMeasurement(null)
          setIsMeasurementModalOpen(true)
        }}
        onOpenGoalModal={() => setIsGoalModalOpen(true)}
        isStaff={isStaff}
      />

      {/* Interactive Progress Chart */}
      <ProgressChart
        measurements={history}
        goal={currentGoal}
        heightCm={targetMember.heightCm}
      />

      {/* History section */}
      <div>
        <div className="mb-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-acc" />
            <h3 className="text-base font-extrabold text-ink">
              Historial de Mediciones
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingMeasurement(null)
              setIsMeasurementModalOpen(true)
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-acc hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar registro
          </button>
        </div>

        <MeasurementHistory
          history={history}
          onEdit={(m) => {
            setEditingMeasurement(m)
            setIsMeasurementModalOpen(true)
          }}
          onDelete={handleDeleteMeasurement}
        />
      </div>

      {/* Measurement Modal (New / Edit) */}
      <MeasurementModal
        isOpen={isMeasurementModalOpen}
        onClose={() => {
          setIsMeasurementModalOpen(false)
          setEditingMeasurement(null)
        }}
        onSave={handleSaveMeasurement}
        initialData={editingMeasurement}
        userHeightCm={targetMember.heightCm}
        memberName={targetMember.fullName}
        isStaffLogging={isStaff}
      />

      {/* Goal Modal */}
      <GoalModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        onSave={handleSaveGoal}
        existingGoal={currentGoal}
        currentWeightKg={latestMeasurement?.weightKg ?? targetMember.initialWeightKg}
        userHeightCm={targetMember.heightCm}
        memberName={targetMember.fullName}
      />
    </div>
  )
}
