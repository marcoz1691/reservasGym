import { useMemo, useState } from 'react'
import {
  Calendar,
  Clock,
  Dumbbell,
  Sparkles,
  Ticket,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import type { Membership, MembershipPlan, MembershipStatus, Zone } from '@/domain/models'
import { ZONE_LABELS } from '@/domain/models'
import { computeMembershipStatus, daysRemaining } from '@/domain/rules/membership'
import { formatCurrency, formatDateSpanish } from '@/lib/format'

interface MembershipCardProps {
  membership: Membership
  plan?: MembershipPlan | null
  zones: Zone[]
}

function getStatusBadge(status: MembershipStatus) {
  switch (status) {
    case 'active':
      return {
        label: 'Membresía activa',
        className: 'bg-success/15 text-success border border-success/30',
        dotClass: 'bg-success',
      }
    case 'grace':
      return {
        label: 'En período de gracia',
        className: 'bg-warn/15 text-warn border border-warn/30',
        dotClass: 'bg-warn animate-pulse',
      }
    case 'expired':
      return {
        label: 'Membresía vencida',
        className: 'bg-danger/15 text-danger border border-danger/30',
        dotClass: 'bg-danger',
      }
    case 'cancelled':
    default:
      return {
        label: 'Cancelada',
        className: 'bg-surface text-ink-3 border border-line',
        dotClass: 'bg-ink-3',
      }
  }
}

export function MembershipCard({ membership, plan, zones }: MembershipCardProps) {
  // Instante de montaje, estable entre renders (evita impureza en render).
  const [nowMs] = useState(() => Date.now())
  const status = useMemo(
    () => computeMembershipStatus(membership),
    [membership],
  )
  const remainingDays = useMemo(
    () => daysRemaining(membership),
    [membership],
  )
  const statusBadge = getStatusBadge(status)

  // Calculate percentage of duration remaining
  const progressPercent = useMemo(() => {
    if (status === 'expired' || status === 'cancelled') return 0
    const start = new Date(membership.startsAt).getTime()
    const end = new Date(membership.endsAt).getTime()
    const total = Math.max(1, end - start)
    const remaining = Math.max(0, end - nowMs)
    return Math.min(100, Math.max(0, Math.round((remaining / total) * 100)))
  }, [membership, status, nowMs])

  const planName = plan?.name ?? 'Plan de Membresía'
  const hasQuota = plan?.visitQuota !== null && plan?.visitQuota !== undefined
  const visitsLeft = membership.visitsLeft ?? plan?.visitQuota ?? 0

  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-bg-2 via-bg-2 to-surface/60 p-6 shadow-2xl transition-all">
      {/* Decorative background glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-acc/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-success/10 blur-3xl" />

      <div className="relative z-10 space-y-6">
        {/* Header: Plan Name & Status Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-acc">
              <ShieldCheck className="h-4 w-4" />
              <span>Zona Cero Performance</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-ink md:text-3xl">
              {planName}
            </h2>
          </div>

          <div
            className={`inline-flex items-center gap-2 self-start rounded-full px-3.5 py-1.5 text-xs font-bold ${statusBadge.className}`}
          >
            <span className={`h-2 w-2 rounded-full ${statusBadge.dotClass}`} />
            <span>{statusBadge.label}</span>
          </div>
        </div>

        {/* Price & Expiry Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-line/60 bg-bg/40 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc/10 text-acc">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3 block">
                Fecha de vencimiento
              </span>
              <p className="text-sm font-bold text-ink">
                {formatDateSpanish(membership.endsAt)}
              </p>
            </div>
          </div>

          {plan?.priceCents ? (
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-success/10 text-success">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3 block">
                  Inversión del plan
                </span>
                <p className="text-sm font-bold text-ink">
                  {formatCurrency(plan.priceCents)}{' '}
                  <span className="text-xs font-normal text-ink-3">
                    / {plan.durationDays} días
                  </span>
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc/10 text-acc">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3 block">
                  Vigencia
                </span>
                <p className="text-sm font-bold text-ink">
                  {plan?.durationDays ?? 30} días
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Days Remaining / Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wide text-ink-3 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-acc" />
              Tiempo de vigencia
            </span>
            <span className="font-extrabold text-ink">
              {status === 'active'
                ? remainingDays === 1
                  ? 'Último día de acceso'
                  : `${remainingDays} días restantes`
                : status === 'grace'
                  ? 'En período de gracia'
                  : 'Vencida'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface border border-line/40">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out)] ${
                status === 'active'
                  ? remainingDays <= 5
                    ? 'bg-warn'
                    : 'bg-acc'
                  : status === 'grace'
                    ? 'bg-warn'
                    : 'bg-danger'
              }`}
              style={{
                width: status === 'active' ? `${progressPercent}%` : status === 'grace' ? '15%' : '0%',
              }}
            />
          </div>
        </div>

        {/* Quota counter (if plan has limited visits) */}
        {hasQuota && (
          <div className="flex items-center justify-between rounded-2xl border border-line/70 bg-surface/50 p-3.5 text-xs">
            <div className="flex items-center gap-2.5">
              <Ticket className="h-4 w-4 text-acc" />
              <span className="font-bold text-ink">Visitas disponibles</span>
            </div>
            <span className="font-extrabold text-acc text-sm">
              {visitsLeft} de {plan?.visitQuota} pases
            </span>
          </div>
        )}

        {/* Grace Period Warning Box */}
        {status === 'grace' && membership.graceEndsAt && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-300">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
            <div className="space-y-1">
              <p className="font-bold text-amber-200">
                Tu plan venció pero estás en período de gracia
              </p>
              <p className="text-[11px] leading-relaxed text-amber-300/90">
                Puedes continuar ingresando y reservando hasta el{' '}
                <span className="font-bold underline">
                  {formatDateSpanish(membership.graceEndsAt)}
                </span>
                . Renueva en recepción para no perder tu cupo.
              </p>
            </div>
          </div>
        )}

        {/* Expired Warning Box */}
        {status === 'expired' && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-300">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
            <div className="space-y-1">
              <p className="font-bold text-rose-200">
                Tu membresía ha expirado
              </p>
              <p className="text-[11px] leading-relaxed text-rose-300/90">
                Para seguir reservando clases y asistiendo a los entrenamientos, por favor acércate a recepción para renovar tu plan.
              </p>
            </div>
          </div>
        )}

        {/* Allowed Zones / Disciplines Chips */}
        <div className="space-y-2 border-t border-line/60 pt-4">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-3 block">
            Disciplinas y áreas incluidas:
          </span>

          <div className="flex flex-wrap gap-2">
            {!plan?.allowedZoneIds || plan.allowedZoneIds.length === 0 ? (
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-acc/30 bg-acc/10 px-3 py-1.5 text-xs font-bold text-acc">
                <CheckCircle2 className="h-3.5 w-3.5 text-acc" />
                <span>Acceso Total a todas las áreas y disciplinas</span>
              </div>
            ) : (
              plan.allowedZoneIds.map((zid) => {
                const zone = zones.find((z) => z.id === zid)
                const label = zone?.name ?? ZONE_LABELS[zid as keyof typeof ZONE_LABELS] ?? zid
                return (
                  <span
                    key={zid}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink"
                  >
                    <Dumbbell className="h-3.5 w-3.5 text-acc" />
                    <span>{label}</span>
                  </span>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
