import { useState, useMemo, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Edit2,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  Users,
  X,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import {
  useAppData,
  useCurrentUser,
  useRefresh,
  useRepo,
} from '@/data/RepositoryProvider'
import type { Session, SessionKind } from '@/domain/models'
import { getDisciplineMeta } from '@/domain/disciplines'
import {
  formatEcuadorSessionWhen,
  formatEcuadorTime,
} from '@/lib/format'
import { createId } from '@/lib/id'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from '@/ui/primitives'
import { StaffBookingModal } from '@/features/agenda/StaffBookingModal'

interface SessionFormData {
  id?: string
  title: string
  zoneId: string
  kind: SessionKind
  trainerId: string
  date: string
  startTime: string
  durationMinutes: number
  capacity: number
}

const DEFAULT_FORM: SessionFormData = {
  title: '',
  zoneId: 'zone-gimnasio',
  kind: 'class',
  trainerId: '',
  date: new Date().toISOString().slice(0, 10),
  startTime: '07:00',
  durationMinutes: 60,
  capacity: 20,
}

export function SessionsPage() {
  const data = useAppData()
  const user = useCurrentUser()
  const repo = useRepo()
  const refresh = useRefresh()

  const isStaffOrAdmin = user?.role === 'staff' || user?.role === 'admin'

  const [searchQuery, setSearchQuery] = useState('')
  const [zoneFilter, setZoneFilter] = useState('all')
  const [selectedDateFilter, setSelectedDateFilter] = useState('')

  // Modal Create/Edit State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<SessionFormData>(DEFAULT_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Delete Confirmation State
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Staff Booking Modal
  const [staffBookingSession, setStaffBookingSession] = useState<Session | null>(null)

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return data.sessions
      .filter((s) => {
        if (zoneFilter !== 'all') {
          const z = data.zones.find((x) => x.id === s.zoneId)
          const match =
            s.zoneId === zoneFilter ||
            z?.type === zoneFilter ||
            s.zoneId.replace(/[_-]/g, '').toLowerCase() ===
              zoneFilter.replace(/[_-]/g, '').toLowerCase()
          if (!match) return false
        }
        if (selectedDateFilter && !s.startsAt.startsWith(selectedDateFilter)) {
          return false
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const trainer = data.trainers.find((t) => t.id === s.trainerId)
          const matchTitle = s.title.toLowerCase().includes(q)
          const matchTrainer = trainer?.fullName.toLowerCase().includes(q)
          if (!matchTitle && !matchTrainer) return false
        }
        return true
      })
      .sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      )
  }, [data.sessions, data.zones, data.trainers, zoneFilter, selectedDateFilter, searchQuery])

  // Open Create Modal
  const handleOpenCreate = () => {
    setIsEditing(false)
    const initialZone = data.zones[0]?.id ?? 'zone-gimnasio'
    const zoneObj = data.zones.find((z) => z.id === initialZone)
    setFormData({
      ...DEFAULT_FORM,
      zoneId: initialZone,
      capacity: zoneObj?.defaultCapacity ?? 20,
      date: new Date().toISOString().slice(0, 10),
    })
    setFormError(null)
    setIsModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEdit = (session: Session) => {
    setIsEditing(true)
    const start = new Date(session.startsAt)
    const end = new Date(session.endsAt)
    const durationMin = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60),
    )

    // Format hours and minutes in Ecuador local / ISO slice
    const hours = String(start.getHours()).padStart(2, '0')
    const minutes = String(start.getMinutes()).padStart(2, '0')

    setFormData({
      id: session.id,
      title: session.title,
      zoneId: session.zoneId,
      kind: session.kind,
      trainerId: session.trainerId ?? '',
      date: session.startsAt.slice(0, 10),
      startTime: `${hours}:${minutes}`,
      durationMinutes: durationMin > 0 ? durationMin : 60,
      capacity: session.capacity,
    })
    setFormError(null)
    setIsModalOpen(true)
  }

  // Handle Zone Change in Form -> auto update default capacity
  const handleZoneChange = (zoneId: string) => {
    const zone = data.zones.find((z) => z.id === zoneId)
    setFormData((prev) => ({
      ...prev,
      zoneId,
      capacity: zone ? zone.defaultCapacity : prev.capacity,
    }))
  }

  // Handle Submit Form
  const handleSubmitSession = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formData.title.trim()) {
      setFormError('El título de la sesión es requerido.')
      return
    }

    if (!formData.date || !formData.startTime) {
      setFormError('La fecha y hora de inicio son requeridas.')
      return
    }

    if (formData.capacity <= 0) {
      setFormError('La capacidad debe ser mayor a 0.')
      return
    }

    // Build start and end ISO dates (Ecuador UTC-5)
    const [hours, minutes] = formData.startTime.split(':').map(Number)
    const startDate = new Date(formData.date)
    startDate.setHours(hours ?? 7, minutes ?? 0, 0, 0)
    const endDate = new Date(
      startDate.getTime() + formData.durationMinutes * 60 * 1000,
    )

    setSubmitting(true)

    try {
      const sessionId = formData.id || createId('ses')
      const existingSession = data.sessions.find((s) => s.id === sessionId)

      const sessionPayload: Session = {
        id: sessionId,
        templateId: existingSession?.templateId ?? `tpl_custom_${sessionId}`,
        zoneId: formData.zoneId,
        title: formData.title.trim(),
        kind: formData.kind,
        startsAt: startDate.toISOString(),
        endsAt: endDate.toISOString(),
        capacity: Number(formData.capacity),
        trainerId: formData.trainerId ? formData.trainerId : null,
        bookedCount: existingSession?.bookedCount ?? 0,
      }

      await repo.upsertSession(sessionPayload)
      await refresh()
      setIsModalOpen(false)
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Error al guardar la sesión.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Delete Session
  const handleDeleteSession = async () => {
    if (!sessionToDelete) return
    setDeleting(true)
    try {
      await repo.deleteSession(sessionToDelete.id)
      await refresh()
      setSessionToDelete(null)
    } catch (err) {
      console.error('Error deleting session:', err)
    } finally {
      setDeleting(false)
    }
  }

  // Restriction check
  if (user && !isStaffOrAdmin) {
    return (
      <div className="py-12 text-center">
        <EmptyState
          title="Acceso exclusivo para Staff y Administradores"
          description="La gestión de clases y programación de sesiones está reservada para el equipo de administración y recepción."
          action={
            <Link to="/agenda">
              <Button>Ver Agenda de Clases</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión de Sesiones y Clases"
        subtitle="Programa horarios, instructores, cupos y disciplinas en Zona Cero sin tocar código"
        action={
          <div className="flex flex-wrap items-center gap-2">
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
              Programar Nueva Clase
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-bg-2">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-ink-3" />
            <Input
              placeholder="Buscar por clase o instructor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            label="Filtrar por Área / Disciplina"
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
          >
            <option value="all">Todas las disciplinas ({data.zones.length})</option>
            {data.zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </Select>

          <Input
            label="Filtrar por Fecha"
            type="date"
            value={selectedDateFilter}
            onChange={(e) => setSelectedDateFilter(e.target.value)}
          />
        </div>
      </Card>

      {/* Sessions Count and Reset Filter */}
      <div className="flex items-center justify-between text-xs text-ink-3">
        <span>
          Mostrando <strong>{filteredSessions.length}</strong> de{' '}
          <strong>{data.sessions.length}</strong> sesiones programadas
        </span>

        {(searchQuery || zoneFilter !== 'all' || selectedDateFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setZoneFilter('all')
              setSelectedDateFilter('')
            }}
            className="text-acc font-bold hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Sessions List */}
      {filteredSessions.length === 0 ? (
        <EmptyState
          title="No se encontraron sesiones"
          description="Crea una nueva clase programada o modifica los filtros de búsqueda."
          action={
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Programar Nueva Clase
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSessions.map((session) => {
            const zone = data.zones.find((z) => z.id === session.zoneId)
            const meta = getDisciplineMeta(zone?.type ?? session.zoneId)
            const Icon = meta.icon
            const trainer = data.trainers.find(
              (t) => t.id === session.trainerId,
            )
            const isFull = session.bookedCount >= session.capacity

            return (
              <Card
                key={session.id}
                className="flex flex-col justify-between p-4 border border-line bg-bg-2 space-y-3 transition hover:border-acc/40"
              >
                <div className="space-y-2.5">
                  {/* Card Header: Icon + Title + Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-xl ${meta.bgLightClass} ${meta.colorClass}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-black text-ink text-sm">
                          {session.title}
                        </h3>
                        <span className="text-[11px] text-ink-3">
                          {zone?.name ?? meta.name}
                        </span>
                      </div>
                    </div>
                    <Badge tone={meta.tone}>{meta.shortName}</Badge>
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 rounded-2xl bg-bg p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-ink-3 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-acc" />
                        Fecha:
                      </span>
                      <span className="font-bold text-ink">
                        {formatEcuadorSessionWhen(session.startsAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-ink-3 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-acc" />
                        Horario:
                      </span>
                      <span className="font-bold text-ink">
                        {formatEcuadorTime(session.startsAt)} -{' '}
                        {formatEcuadorTime(session.endsAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-ink-3 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-acc" />
                        Instructor:
                      </span>
                      <span className="font-bold text-ink">
                        {trainer ? trainer.fullName : 'Sin instructor'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-line/60 pt-1.5">
                      <span className="text-ink-3">Ocupación / Capacidad:</span>
                      <Badge tone={isFull ? 'danger' : 'ok'}>
                        {session.bookedCount} / {session.capacity} inscritos
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="border-t border-line pt-2.5 flex flex-wrap items-center justify-between gap-2">
                  <Button
                    variant="secondary"
                    className="text-xs py-1 px-2.5 h-7 gap-1 text-acc border-acc/30 hover:bg-acc/10"
                    onClick={() => setStaffBookingSession(session)}
                    title="Reservar en nombre de un socio"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>Reservar socio</span>
                  </Button>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      onClick={() => handleOpenEdit(session)}
                      className="text-xs py-1 px-2.5 h-7 gap-1"
                    >
                      <Edit2 className="h-3 w-3" />
                      Editar
                    </Button>

                    <Button
                      variant="danger"
                      onClick={() => setSessionToDelete(session)}
                      className="text-xs py-1 px-2 h-7"
                      title="Eliminar sesión"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* CREATE / EDIT SESSION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-line bg-bg-2 p-6 shadow-2xl space-y-5">
            <button
              type="button"
              onClick={() => !submitting && setIsModalOpen(false)}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-ink-3 hover:bg-surface hover:text-ink transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-acc/10 text-acc">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-ink">
                  {isEditing ? 'Editar Clase Programada' : 'Nueva Clase / Sesión'}
                </h2>
                <p className="text-xs text-ink-3">
                  Configura horarios, cupos e instructores (Hora Ecuador UTC-5)
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitSession} className="space-y-4">
              {/* Title */}
              <Input
                label="Título de la Clase / Sesión"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Ej. CrossFit WOD Matutino, Hyrox Pro, Bailoterapia"
                required
              />

              {/* Zone and Kind */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Disciplina / Área"
                  value={formData.zoneId}
                  onChange={(e) => handleZoneChange(e.target.value)}
                  required
                >
                  {data.zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Tipo de Sesión"
                  value={formData.kind}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      kind: e.target.value as SessionKind,
                    })
                  }
                >
                  <option value="class">Clase Grupal</option>
                  <option value="preparation">Preparación / Competencia</option>
                  <option value="open">Acceso Libre / Open Gym</option>
                </Select>
              </div>

              {/* Trainer */}
              <Select
                label="Instructor / Coach"
                value={formData.trainerId}
                onChange={(e) =>
                  setFormData({ ...formData, trainerId: e.target.value })
                }
              >
                <option value="">Sin instructor asignado</option>
                {data.trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName} ({t.specialties.join(', ')})
                  </option>
                ))}
              </Select>

              {/* Date & Start Time */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Fecha (YYYY-MM-DD)"
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  required
                />

                <Input
                  label="Hora de Inicio (Ecuador UTC-5)"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                  required
                />
              </div>

              {/* Duration and Capacity */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Duración (Minutos)"
                  type="number"
                  min="15"
                  step="5"
                  value={formData.durationMinutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      durationMinutes: Number(e.target.value),
                    })
                  }
                  required
                />

                <Input
                  label="Capacidad / Cupos Máximos"
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      capacity: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>

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
                  {submitting
                    ? 'Guardando...'
                    : isEditing
                      ? 'Guardar Cambios'
                      : 'Programar Clase'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-3xl border border-danger/40 bg-bg-2 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-danger">
              <ShieldAlert className="h-6 w-6" />
              <h3 className="text-lg font-extrabold text-ink">
                ¿Eliminar Clase Programada?
              </h3>
            </div>

            <p className="text-sm text-ink-3">
              ¿Estás seguro de que deseas eliminar permanentemente la sesión{' '}
              <strong className="text-ink font-bold">
                {sessionToDelete.title}
              </strong>{' '}
              ({formatEcuadorSessionWhen(sessionToDelete.startsAt)})?
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setSessionToDelete(null)}
                disabled={deleting}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteSession}
                disabled={deleting}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? 'Eliminando...' : 'Sí, Eliminar Clase'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Booking Modal */}
      {staffBookingSession && (
        <StaffBookingModal
          isOpen={Boolean(staffBookingSession)}
          onClose={() => setStaffBookingSession(null)}
          session={staffBookingSession}
          onSuccess={() => {
            void refresh()
          }}
        />
      )}
    </div>
  )
}
