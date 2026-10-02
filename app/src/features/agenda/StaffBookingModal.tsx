import { useState, useMemo } from 'react'
import {
  Search,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  QrCode,
  Calendar,
  Clock,
  MapPin,
  ShieldAlert,
  Copy,
  Check,
} from 'lucide-react'
import type { Booking, Session, User, WaitlistEntry } from '@/domain/models'
import { useAppData, useRefresh, useRepo } from '@/data/RepositoryProvider'
import { selectMyDayPassPlans, selectMyMembership } from '@/app/store'
import { canBookMembership, canBookZone } from '@/domain/rules'
import { getDisciplineMeta } from '@/domain/disciplines'
import { formatEcuadorSessionWhen, formatEcuadorTime } from '@/lib/format'
import { Badge, Button, Card, Input } from '@/ui/primitives'

export interface StaffBookingModalProps {
  isOpen: boolean
  onClose: () => void
  session: Session | null
  onSuccess?: (booking: Booking | WaitlistEntry, member: User) => void
}

export function StaffBookingModal({
  isOpen,
  onClose,
  session,
  onSuccess,
}: StaffBookingModalProps) {
  const data = useAppData()
  const repo = useRepo()
  const refresh = useRefresh()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMember, setSelectedMember] = useState<User | null>(null)
  const [overrideWarningConfirmed, setOverrideWarningConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [bookingResult, setBookingResult] = useState<{
    booking: Booking | WaitlistEntry
    member: User
  } | null>(null)

  // Filter members by search query
  const members = useMemo(() => {
    const list = data.users.filter((u) => u.role === 'member')
    if (!searchQuery.trim()) return list.slice(0, 8)
    const q = searchQuery.toLowerCase()
    return list.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.residence && m.residence.toLowerCase().includes(q)),
    )
  }, [data.users, searchQuery])

  // Check selected member membership & zone access
  const memberAssessment = useMemo(() => {
    if (!selectedMember || !session) return null

    const membership = selectMyMembership(data, selectedMember.id)
    const memCheck = canBookMembership(membership)
    const plan = membership
      ? (data.membershipPlans ?? []).find((p) => p.id === membership.planId)
      : null
    const zoneCheck = canBookZone(plan, session.zoneId)
    const passOpens = selectMyDayPassPlans(data, selectedMember.id, new Date(), session.startsAt)
      .some((pass) => canBookZone(pass, session.zoneId).allowed)

    const isExpired = !passOpens && memCheck.status === 'expired'
    const isGrace = !passOpens && memCheck.status === 'grace'
    const isNoMembership = !passOpens && memCheck.status === 'none'
    const isZoneRestricted = !passOpens && !zoneCheck.allowed

    const hasWarning =
      (!passOpens && !memCheck.allowed) || isGrace || isExpired || isNoMembership || isZoneRestricted

    let warningMessage = ''
    if (isNoMembership) {
      warningMessage = 'El socio no cuenta con un plan de membresía registrado.'
    } else if (isExpired) {
      warningMessage = 'La membresía del socio se encuentra vencida.'
    } else if (isGrace) {
      warningMessage = 'El socio se encuentra en período de gracia de pago.'
    } else if (isZoneRestricted) {
      const zone = data.zones.find((z) => z.id === session.zoneId)
      warningMessage = `El plan actual (${plan?.name ?? 'Plan'}) no incluye acceso al área ${zone?.name ?? 'esta área'}.`
    }

    return {
      membership,
      plan,
      memCheck,
      zoneCheck,
      hasWarning,
      warningMessage,
      statusLabel: passOpens && !memCheck.allowed
        ? 'Pase del día activo'
        : memCheck.status === 'active'
          ? 'Membresía Activa'
          : memCheck.status === 'grace'
            ? 'En Período de Gracia'
            : memCheck.status === 'expired'
              ? 'Membresía Vencida'
              : 'Sin Membresía',
      tone:
        passOpens || (memCheck.status === 'active' && zoneCheck.allowed)
          ? ('ok' as const)
          : memCheck.status === 'grace'
            ? ('warn' as const)
            : ('danger' as const),
    }
  }, [selectedMember, session, data])

  if (!isOpen || !session) return null

  const zone = data.zones.find((z) => z.id === session.zoneId)
  const meta = getDisciplineMeta(zone?.type ?? session.zoneId)
  const IconComponent = meta.icon

  const handleSelectMember = (member: User) => {
    setSelectedMember(member)
    setOverrideWarningConfirmed(false)
    setError(null)
  }

  const handleReset = () => {
    setSelectedMember(null)
    setSearchQuery('')
    setOverrideWarningConfirmed(false)
    setError(null)
    setBookingResult(null)
  }

  const handleClose = () => {
    handleReset()
    onClose()
  }

  const handleCopyCode = (code: string) => {
    void navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleConfirmBooking = async () => {
    if (!selectedMember || !session) return
    setError(null)
    setSubmitting(true)

    try {
      const result = await repo.createBooking(session.id, selectedMember.id)
      await refresh()
      setBookingResult({ booking: result, member: selectedMember })
      if (onSuccess) {
        onSuccess(result, selectedMember)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar la reserva')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-line bg-bg-2 p-6 shadow-2xl space-y-5">
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-ink-3 hover:bg-surface hover:text-ink transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-acc/15 text-acc">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-ink">
                Reserva por Recepción
              </h2>
              <Badge tone="ok">Staff / Admin</Badge>
            </div>
            <p className="text-xs text-ink-3">
              Registra una reserva presencial o telefónica en nombre de un socio
            </p>
          </div>
        </div>

        {/* Session Summary Card */}
        <div className="rounded-2xl border border-line bg-surface/50 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-xl ${meta.bgLightClass} ${meta.colorClass}`}
              >
                <IconComponent className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-ink">{session.title}</span>
            </div>
            <Badge tone={meta.tone}>{meta.name}</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-acc" />
              {formatEcuadorSessionWhen(session.startsAt)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-acc" />
              {formatEcuadorTime(session.startsAt)} - {formatEcuadorTime(session.endsAt)}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-acc" />
              {zone?.name ?? 'Zona Cero'}
            </span>
          </div>
        </div>

        {/* SUCCESS CONFIRMATION VIEW */}
        {bookingResult ? (
          <div className="space-y-4 text-center py-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-acc/20 text-acc">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-lg font-black text-ink">
                {'position' in bookingResult.booking
                  ? 'Socio Añadido a Lista de Espera'
                  : '¡Reserva Confirmada Exitosamente!'}
              </h3>
              <p className="mt-1 text-xs text-ink-3">
                Reserva registrada en recepción para{' '}
                <strong className="text-ink">{bookingResult.member.fullName}</strong>
              </p>
            </div>

            {/* Check-In Code Card (if confirmed) */}
            {'checkInCode' in bookingResult.booking && (
              <Card className="border border-acc/40 bg-gradient-to-br from-bg-2 to-surface p-4 text-center space-y-3">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-acc">
                  <QrCode className="h-4 w-4" />
                  Código de Check-in para el Socio
                </div>

                <div className="flex items-center justify-center gap-3">
                  <span className="font-mono text-2xl font-black tracking-widest text-ink">
                    {bookingResult.booking.checkInCode}
                  </span>
                  <Button
                    variant="secondary"
                    className="h-8 px-2.5 text-xs gap-1"
                    onClick={() =>
                      handleCopyCode(
                        (bookingResult.booking as Booking).checkInCode,
                      )
                    }
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-acc" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-[11px] text-ink-3">
                  Proporciona este código o el QR al socio para validar su ingreso
                  en el escáner de recepción.
                </p>
              </Card>
            )}

            <div className="flex justify-center gap-3 pt-2">
              <Button variant="secondary" onClick={handleReset}>
                Reservar a otro socio
              </Button>
              <Button onClick={handleClose}>Listo / Cerrar</Button>
            </div>
          </div>
        ) : (
          /* BOOKING FLOW */
          <div className="space-y-4">
            {/* Step 1: Search and Select Member */}
            {!selectedMember ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-ink-3" />
                  <Input
                    placeholder="Buscar socio por nombre, correo o residencia..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-ink-3 px-1">
                    Selecciona un socio ({members.length})
                  </div>

                  {members.length === 0 ? (
                    <div className="rounded-2xl border border-line p-4 text-center text-xs text-ink-3">
                      No se encontraron socios que coincidan con la búsqueda.
                    </div>
                  ) : (
                    members.map((member) => {
                      const mem = selectMyMembership(data, member.id)
                      const memCheck = canBookMembership(mem)
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => handleSelectMember(member)}
                          className="w-full flex items-center justify-between rounded-2xl border border-line bg-surface/50 p-2.5 text-left transition hover:border-acc/50 hover:bg-surface"
                        >
                          <div>
                            <div className="text-xs font-bold text-ink">
                              {member.fullName}
                            </div>
                            <div className="text-[11px] text-ink-3">
                              {member.email}
                              {member.residence ? ` · ${member.residence}` : ''}
                            </div>
                          </div>
                          <Badge
                            tone={
                              memCheck.status === 'active'
                                ? 'ok'
                                : memCheck.status === 'grace'
                                  ? 'warn'
                                  : 'danger'
                            }
                          >
                            {memCheck.status === 'active'
                              ? 'Activo'
                              : memCheck.status === 'grace'
                                ? 'Gracia'
                                : 'Vencido / Sin plan'}
                          </Badge>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            ) : (
              /* Step 2: Member Selected & Status Verification */
              <div className="space-y-4">
                <div className="flex items-start justify-between rounded-2xl border border-line bg-surface p-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
                      Socio Seleccionado
                    </span>
                    <h4 className="text-sm font-bold text-ink">
                      {selectedMember.fullName}
                    </h4>
                    <p className="text-xs text-ink-3">{selectedMember.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedMember(null)}
                    className="text-xs py-1 px-2.5 h-7 text-acc"
                  >
                    Cambiar
                  </Button>
                </div>

                {/* Membership Assessment Details */}
                {memberAssessment && (
                  <div className="rounded-2xl border border-line bg-bg p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ink-3">Estado de Membresía:</span>
                      <Badge tone={memberAssessment.tone}>
                        {memberAssessment.statusLabel}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ink-3">Plan Actual:</span>
                      <span className="font-bold text-ink">
                        {memberAssessment.plan?.name ?? 'Sin plan registrado'}
                      </span>
                    </div>

                    {/* Warning Box for Staff */}
                    {memberAssessment.hasWarning && (
                      <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 space-y-2 text-xs">
                        <div className="flex items-start gap-2 text-warn">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block">
                              Advertencia de Acceso
                            </span>
                            <span className="text-ink-2">
                              {memberAssessment.warningMessage}
                            </span>
                          </div>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-ink pt-1 border-t border-warn/20">
                          <input
                            type="checkbox"
                            checked={overrideWarningConfirmed}
                            onChange={(e) =>
                              setOverrideWarningConfirmed(e.target.checked)
                            }
                            className="accent-acc h-4 w-4"
                          />
                          <span>
                            ¿Deseas proceder y autorizar esta reserva desde recepción?
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {error ? (
                  <div className="rounded-2xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger font-medium flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                ) : null}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleClose}
                    disabled={submitting}
                  >
                    Cancelar
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleConfirmBooking}
                    disabled={
                      submitting ||
                      (memberAssessment?.hasWarning && !overrideWarningConfirmed)
                    }
                    className="gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {submitting
                      ? 'Confirmando...'
                      : session.bookedCount >= session.capacity
                        ? 'Registrar en Lista de Espera'
                        : 'Confirmar Reserva en Recepción'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
