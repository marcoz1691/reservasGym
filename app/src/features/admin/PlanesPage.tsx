import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Edit2,
  Layers,
  Plus,
  ShieldAlert,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import {
  useAppData,
  useCurrentUser,
  useRefresh,
  useRepo,
} from '@/data/RepositoryProvider'
import type { MembershipPlan, Zone } from '@/domain/models'
import { ZONE_LABELS } from '@/domain/models'
import { validateMembershipPlanInput } from '@/domain/rules/membershipPlan'
import { formatCurrency } from '@/lib/format'
import { Badge, Button, Card, EmptyState, Input, PageHeader } from '@/ui/primitives'

interface PlanFormData {
  id?: string
  name: string
  priceUsd: string
  durationDays: string
  isUnlimitedVisits: boolean
  visitQuota: string
  allZonesAllowed: boolean
  allowedZoneIds: string[]
  active: boolean
}

const DEFAULT_FORM_DATA: PlanFormData = {
  name: '',
  priceUsd: '',
  durationDays: '30',
  isUnlimitedVisits: true,
  visitQuota: '',
  allZonesAllowed: true,
  allowedZoneIds: [],
  active: true,
}

const DURATION_PRESETS = [
  { label: '1 Mes (30d)', days: 30 },
  { label: '3 Meses (90d)', days: 90 },
  { label: '6 Meses (180d)', days: 180 },
  { label: '1 Año (365d)', days: 365 },
]

export function PlanesPage() {
  const repo = useRepo()
  const user = useCurrentUser()
  const data = useAppData()
  const refresh = useRefresh()

  const [plans, setPlans] = useState<MembershipPlan[]>([])

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<PlanFormData>(DEFAULT_FORM_DATA)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Delete Confirmation State
  const [planToDelete, setPlanToDelete] = useState<MembershipPlan | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Load plans
  const loadPlans = async () => {
    try {
      const list = await repo.getMembershipPlans()
      setPlans(list)
    } catch (err) {
      console.error('Error loading plans:', err)
    }
  }

  useEffect(() => {
    void loadPlans()
  }, [])

  // Available zones from system or fallback list
  const availableZones = useMemo(() => {
    if (data.zones && data.zones.length > 0) {
      return data.zones
    }
    // Fallback zones
    return Object.entries(ZONE_LABELS).map(([key, label]) => ({
      id: `zone_${key}`,
      name: label,
      type: key as any,
      description: '',
      defaultCapacity: 20,
      imageHint: '',
    })) as Zone[]
  }, [data.zones])

  // Open Create Modal
  const handleOpenCreate = () => {
    setIsEditing(false)
    setFormData({ ...DEFAULT_FORM_DATA })
    setFormError(null)
    setIsModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEdit = (plan: MembershipPlan) => {
    setIsEditing(true)
    setFormData({
      id: plan.id,
      name: plan.name,
      priceUsd: (plan.priceCents / 100).toFixed(2),
      durationDays: String(plan.durationDays),
      isUnlimitedVisits: plan.visitQuota === null || plan.visitQuota === undefined,
      visitQuota: plan.visitQuota !== null && plan.visitQuota !== undefined ? String(plan.visitQuota) : '',
      allZonesAllowed: !plan.allowedZoneIds || plan.allowedZoneIds.length === 0,
      allowedZoneIds: plan.allowedZoneIds || [],
      active: plan.active !== false,
    })
    setFormError(null)
    setIsModalOpen(true)
  }

  // Handle Toggle Active
  const handleToggleActive = async (plan: MembershipPlan) => {
    try {
      const updated = await repo.upsertMembershipPlan({
        ...plan,
        active: !plan.active,
      })
      setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      await refresh()
    } catch (err) {
      console.error('Error toggling plan status:', err)
    }
  }

  // Handle Delete
  const handleDeletePlan = async () => {
    if (!planToDelete) return
    setDeleting(true)
    try {
      await repo.deleteMembershipPlan(planToDelete.id)
      setPlans((prev) => prev.filter((p) => p.id !== planToDelete.id))
      setPlanToDelete(null)
      await refresh()
    } catch (err) {
      console.error('Error deleting plan:', err)
    } finally {
      setDeleting(false)
    }
  }

  // Handle Zone Checkbox Toggle
  const handleToggleZone = (zoneId: string) => {
    setFormData((prev) => {
      const current = prev.allowedZoneIds
      const next = current.includes(zoneId)
        ? current.filter((id) => id !== zoneId)
        : [...current, zoneId]
      return {
        ...prev,
        allZonesAllowed: false,
        allowedZoneIds: next,
      }
    })
  }

  // Handle Form Submit
  const handleSubmitPlan = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const priceNum = parseFloat(formData.priceUsd)
    const daysNum = parseInt(formData.durationDays, 10)
    let quotaNum: number | null = null
    if (!formData.isUnlimitedVisits) {
      const parsed = parseInt(formData.visitQuota, 10)
      quotaNum = parsed
    }

    const validation = validateMembershipPlanInput({
      name: formData.name,
      priceCents: Math.round((Number.isFinite(priceNum) ? priceNum : NaN) * 100),
      durationDays: daysNum,
      visitQuota: quotaNum,
    })
    if (!validation.ok) {
      setFormError(validation.error)
      return
    }

    // Determine allowedZoneIds
    let finalZones: string[] = []
    if (!formData.allZonesAllowed && formData.allowedZoneIds.length > 0) {
      // If user selected all available zones, simplify to empty array [] (all allowed)
      if (formData.allowedZoneIds.length === availableZones.length) {
        finalZones = []
      } else {
        finalZones = formData.allowedZoneIds
      }
    }

    setSubmitting(true)

    try {
      await repo.upsertMembershipPlan({
        id: formData.id,
        name: validation.value.name,
        priceCents: validation.value.priceCents,
        durationDays: validation.value.durationDays,
        visitQuota: validation.value.visitQuota ?? null,
        allowedZoneIds: finalZones,
        active: formData.active,
      })

      setIsModalOpen(false)
      await refresh()
      await loadPlans()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar el plan.')
    } finally {
      setSubmitting(false)
    }
  }

  // Role restriction check
  if (user && user.role !== 'admin') {
    return (
      <div className="py-12 text-center">
        <EmptyState
          title="Acceso exclusivo para Administradores"
          description="La configuración de planes de membresía y tarifas está reservada para usuarios con rol de Administrador."
          action={
            <Link to="/admin">
              <Button>Volver al panel principal</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión de Planes de Membresía"
        subtitle="Configuración de planes, tarifas en USD, duraciones y control de acceso a zonas"
        action={
          <div className="flex items-center gap-2">
            <Link to="/admin">
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Panel Admin
              </Button>
            </Link>
            <Button
              variant="primary"
              onClick={handleOpenCreate}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Crear Nuevo Plan
            </Button>
          </div>
        }
      />

      {/* Plans List Grid */}
      {plans.length === 0 ? (
        <EmptyState
          title="No hay planes configurados"
          description="Crea el primer plan de membresía para comenzar a vender en recepción y cobrar a tus socios."
          action={
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Crear Nuevo Plan
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isAllZones =
              !plan.allowedZoneIds || plan.allowedZoneIds.length === 0

            return (
              <Card
                key={plan.id}
                className={`flex flex-col justify-between p-5 space-y-4 border transition ${
                  plan.active
                    ? 'border-line bg-bg-2'
                    : 'border-line/50 bg-bg-2/50 opacity-75'
                }`}
              >
                <div className="space-y-3">
                  {/* Header: Name + Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-extrabold text-ink text-base">
                      {plan.name}
                    </h3>
                    <Badge tone={plan.active ? 'ok' : 'neutral'}>
                      {plan.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>

                  {/* Price & Duration */}
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-acc">
                      {formatCurrency(plan.priceCents)}
                    </span>
                    <span className="text-xs text-ink-3">
                      / {plan.durationDays} días
                    </span>
                  </div>

                  {/* Features */}
                  <div className="space-y-2 rounded-2xl bg-bg p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-ink-3 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-acc" />
                        Duración:
                      </span>
                      <span className="font-bold text-ink">
                        {plan.durationDays} días
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-ink-3 flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 text-acc" />
                        Cupo de visitas:
                      </span>
                      <span className="font-bold text-ink">
                        {plan.visitQuota !== null
                          ? `${plan.visitQuota} visitas`
                          : 'Ilimitado'}
                      </span>
                    </div>

                    <div className="border-t border-line pt-2">
                      <span className="text-ink-3 block mb-1.5">
                        Áreas y Zonas Permitidas:
                      </span>
                      {isAllZones ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-acc/10 px-2.5 py-0.5 text-[11px] font-bold text-acc">
                          <Check className="h-3 w-3" />
                          Acceso Total a Todas las Áreas
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {plan.allowedZoneIds.map((zoneId) => {
                            const zone = availableZones.find((z) => z.id === zoneId)
                            const label = zone ? zone.name : zoneId
                            return (
                              <span
                                key={zoneId}
                                className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-2"
                              >
                                {label}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="border-t border-line pt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(plan)}
                    className={`text-xs font-bold transition hover:underline ${
                      plan.active ? 'text-warn' : 'text-acc'
                    }`}
                  >
                    {plan.active ? 'Desactivar' : 'Activar'}
                  </button>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => handleOpenEdit(plan)}
                      className="text-xs py-1 px-2.5 h-8 gap-1"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Editar
                    </Button>

                    <Button
                      variant="danger"
                      onClick={() => setPlanToDelete(plan)}
                      className="text-xs py-1 px-2.5 h-8 gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* CREATE / EDIT PLAN MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-xs">
          <div className="mx-auto flex min-h-full max-w-xl items-center justify-center py-4">
          <div className="relative w-full max-h-[90vh] min-h-0 overflow-y-auto rounded-3xl border border-line bg-bg-2 p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => !submitting && setIsModalOpen(false)}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-ink-3 hover:bg-surface hover:text-ink transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-acc/10 text-acc">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-ink">
                  {isEditing ? 'Editar Plan de Membresía' : 'Nuevo Plan de Membresía'}
                </h2>
                <p className="text-xs text-ink-3">
                  Configura los detalles comerciales y accesos del plan
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitPlan} className="space-y-5">
              {/* Plan Name */}
              <Input
                label="Nombre del Plan"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Plan Gold Anual, CrossFit Mensual, Pase Diario"
                required
              />

              {/* Price & Duration */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Precio en USD ($)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.priceUsd}
                  onChange={(e) => setFormData({ ...formData, priceUsd: e.target.value })}
                  placeholder="45.00"
                  required
                />

                <div>
                  <Input
                    label="Duración (días)"
                    type="number"
                    min="1"
                    value={formData.durationDays}
                    onChange={(e) =>
                      setFormData({ ...formData, durationDays: e.target.value })
                    }
                    placeholder="30"
                    required
                  />
                  {/* Duration presets */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {DURATION_PRESETS.map((preset) => (
                      <button
                        key={preset.days}
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            durationDays: String(preset.days),
                          })
                        }
                        className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition ${
                          formData.durationDays === String(preset.days)
                            ? 'bg-cta text-cta-contrast font-bold'
                            : 'bg-surface text-ink-3 hover:text-ink'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Visit Quota */}
              <div className="rounded-2xl border border-line bg-bg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wide text-ink-3 block">
                      Cupo de Visitas
                    </span>
                    <span className="text-xs text-ink-3">
                      Limita la cantidad de ingresos o permite visitas ilimitadas
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-ink">
                    <input
                      type="radio"
                      name="quotaType"
                      checked={formData.isUnlimitedVisits}
                      onChange={() =>
                        setFormData({
                          ...formData,
                          isUnlimitedVisits: true,
                          visitQuota: '',
                        })
                      }
                      className="accent-acc"
                    />
                    Visitas Ilimitadas
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-ink">
                    <input
                      type="radio"
                      name="quotaType"
                      checked={!formData.isUnlimitedVisits}
                      onChange={() =>
                        setFormData({
                          ...formData,
                          isUnlimitedVisits: false,
                          visitQuota: formData.visitQuota || '12',
                        })
                      }
                      className="accent-acc"
                    />
                    Cupo de Visitas Específico
                  </label>
                </div>

                {!formData.isUnlimitedVisits && (
                  <div className="pt-2">
                    <Input
                      label="Número de Visitas Permitidas"
                      type="number"
                      min="1"
                      value={formData.visitQuota}
                      onChange={(e) =>
                        setFormData({ ...formData, visitQuota: e.target.value })
                      }
                      placeholder="Ej: 12"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Multi-Zone Access Selector */}
              <div className="rounded-2xl border border-line bg-bg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wide text-ink-3 block">
                      Control de Acceso por Zonas
                    </span>
                    <span className="text-xs text-ink-3">
                      Selecciona las áreas autorizadas para este plan
                    </span>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-ink border-b border-line pb-2.5">
                  <input
                    type="checkbox"
                    checked={formData.allZonesAllowed}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        allZonesAllowed: e.target.checked,
                        allowedZoneIds: e.target.checked ? [] : formData.allowedZoneIds,
                      })
                    }
                    className="accent-acc h-4 w-4"
                  />
                  <span>Acceso Total a Todas las Áreas y Zonas del Gym</span>
                </label>

                {!formData.allZonesAllowed && (
                  <div className="grid gap-2 sm:grid-cols-2 pt-1">
                    {availableZones.map((zone) => {
                      const isChecked = formData.allowedZoneIds.includes(zone.id)
                      return (
                        <label
                          key={zone.id}
                          className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition ${
                            isChecked
                              ? 'border-acc bg-acc/10 text-ink font-bold'
                              : 'border-line bg-surface text-ink-2 hover:bg-surface/80'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleZone(zone.id)}
                            className="accent-acc h-3.5 w-3.5"
                          />
                          <span>{zone.name}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-ink">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) =>
                    setFormData({ ...formData, active: e.target.checked })
                  }
                  className="accent-acc h-4 w-4"
                />
                <span>Plan activo para venta en caja y POS</span>
              </label>

              {formError ? (
                <div className="rounded-2xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {formError}
                </div>
              ) : null}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting} className="gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {submitting ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Plan'}
                </Button>
              </div>
            </form>
          </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {planToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-3xl border border-danger/40 bg-bg-2 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-danger">
              <ShieldAlert className="h-6 w-6" />
              <h3 className="text-lg font-extrabold text-ink">
                ¿Eliminar Plan de Membresía?
              </h3>
            </div>

            <p className="text-sm text-ink-3">
              ¿Estás seguro de que deseas eliminar permanentemente el plan{' '}
              <strong className="text-ink font-bold">{planToDelete.name}</strong>? Esta
              acción no se puede deshacer.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setPlanToDelete(null)}
                disabled={deleting}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={handleDeletePlan}
                disabled={deleting}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? 'Eliminando...' : 'Sí, Eliminar Plan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
