import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Dumbbell,
  Infinity as InfinityIcon,
  Ticket,
  Wallet,
} from 'lucide-react'
import type { Membership, MembershipPlan, MembershipStatus, Zone } from '@/domain/models'
import { ZONE_LABELS } from '@/domain/models'
import { computeMembershipStatus, daysRemaining } from '@/domain/rules/membership'
import { formatCurrency, formatDateSpanish } from '@/lib/format'

interface MembershipCardProps {
  membership: Membership
  plan?: MembershipPlan | null
  zones: Zone[]
  /** Nombre del socio: la tarjeta se lee como una credencial, no como un recibo. */
  memberName?: string
  /** Alta en el gimnasio (no del plan): da sensación de historial. */
  memberSince?: string
  /** Lleva al catálogo para renovar o mejorar. */
  onRenew?: () => void
}

function getStatusBadge(status: MembershipStatus) {
  switch (status) {
    case 'active':
      return {
        label: 'Membresía activa',
        className: 'bg-success-soft text-success border border-success/25',
        dotClass: 'bg-success',
      }
    case 'grace':
      return {
        label: 'En período de gracia',
        className: 'bg-warn-soft text-warn border border-warn/25',
        dotClass: 'bg-warn animate-pulse',
      }
    case 'expired':
      return {
        label: 'Membresía vencida',
        className: 'bg-danger-soft text-danger border border-danger/25',
        dotClass: 'bg-danger',
      }
    case 'cancelled':
    default:
      return {
        label: 'Cancelada',
        className: 'bg-surface-elevated text-ink-3 border border-line',
        dotClass: 'bg-ink-3',
      }
  }
}

/** Anillo de vigencia: un solo vistazo basta para saber cuánto queda. */
function RemainingRing({
  percent,
  value,
  caption,
  label,
  color,
}: {
  percent: number
  value: string
  caption: string
  /** Frase completa para lectores de pantalla; en pantalla basta el número. */
  label: string
  color: string
}) {
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const dash = (Math.max(0, Math.min(100, percent)) / 100) * circumference

  return (
    <div role="img" aria-label={label} className="relative h-32 w-32 shrink-0">
      <svg aria-hidden viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth="5"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="transition-[stroke-dasharray] duration-700 ease-[var(--ease-out)]"
        />
      </svg>
      {/* inset deja aire entre el texto y el trazo: nada toca el anillo */}
      <div
        aria-hidden
        className="absolute inset-[15%] flex flex-col items-center justify-center text-center"
      >
        <span className="font-display text-[1.75rem] font-bold leading-none tabular-nums tracking-tight text-ink">
          {value}
        </span>
        <span className="mt-1.5 max-w-full text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-ink-3">
          {caption}
        </span>
      </div>
    </div>
  )
}

function FactCell({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3.5">
      <span
        aria-hidden
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-3"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-bold text-ink">{value}</p>
        {hint ? <p className="truncate text-[11px] text-ink-3">{hint}</p> : null}
      </div>
    </div>
  )
}

export function MembershipCard({
  membership,
  plan,
  zones,
  memberName,
  memberSince,
  onRenew,
}: MembershipCardProps) {
  // ZC18-O3: reloj vivo (1 min) para que la barra de progreso avance con la pantalla abierta
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const now = useMemo(() => new Date(nowMs), [nowMs])
  const status = useMemo(
    () => computeMembershipStatus(membership, now),
    [membership, now],
  )
  const remainingDays = useMemo(
    () => daysRemaining(membership, now),
    [membership, now],
  )
  const statusBadge = getStatusBadge(status)

  const progressPercent = useMemo(() => {
    if (status === 'expired' || status === 'cancelled') return 0
    const start = new Date(membership.startsAt).getTime()
    const end = new Date(membership.endsAt).getTime()
    const total = Math.max(1, end - start)
    const remaining = Math.max(0, end - nowMs)
    return Math.min(100, Math.max(0, Math.round((remaining / total) * 100)))
  }, [membership, status, nowMs])

  const graceDaysLeft = useMemo(() => {
    if (!membership.graceEndsAt) return 0
    const diff = new Date(membership.graceEndsAt).getTime() - nowMs
    return Math.max(0, Math.ceil(diff / 86_400_000))
  }, [membership.graceEndsAt, nowMs])

  const planName = plan?.name ?? 'Plan de Membresía'
  const hasQuota = plan?.visitQuota !== null && plan?.visitQuota !== undefined
  const visitsLeft = membership.visitsLeft ?? plan?.visitQuota ?? 0
  const nearExpiry = status === 'active' && remainingDays <= 7

  const ringColor =
    status === 'active'
      ? nearExpiry
        ? 'var(--color-warn)'
        : 'var(--color-acc)'
      : status === 'grace'
        ? 'var(--color-warn)'
        : 'var(--color-danger)'

  // El anillo solo lleva número + una palabra: la frase completa va bajo el título.
  const ringValue =
    status === 'active'
      ? String(remainingDays)
      : status === 'grace'
        ? String(graceDaysLeft)
        : '0'
  const ringCaption =
    status === 'grace'
      ? 'en gracia'
      : status === 'active' && remainingDays === 1
        ? 'día'
        : 'días'

  /**
   * Frase canónica de vigencia (QA ZCAPP-18). Vive solo en el aria-label del
   * anillo: en pantalla el dato ya lo da el anillo y repetirlo sobraba.
   */
  const validityLabel =
    status === 'active'
      ? remainingDays === 1
        ? 'Último día de acceso'
        : `${remainingDays} días restantes`
      : status === 'grace'
        ? `${graceDaysLeft} ${graceDaysLeft === 1 ? 'día' : 'días'} en período de gracia`
        : 'Sin días restantes'

  return (
    <section
      aria-label="Tu membresía"
      className="overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-card)]"
    >
      {/* Cabecera tipo credencial */}
      <div className="relative border-b border-line px-5 py-5 sm:px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-acc/50 via-acc/10 to-transparent"
        />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-2">
            {/* Rótulo de marca en Plex Sans: el mono a 10px con tracking ancho
                se veía apretado y sucio. Sans en versalitas respira mejor. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-ink-2">
                Zona Cero{' '}
                <span className="font-normal text-ink-3">Performance</span>
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBadge.className}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${statusBadge.dotClass}`} />
                <span>{statusBadge.label}</span>
              </span>
            </div>
            <h2 className="truncate font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
              {planName}
            </h2>
            {memberName ? (
              <p className="text-sm text-ink-2">
                {memberName}
                {memberSince ? (
                  <span className="text-ink-3"> · socio desde {memberSince}</span>
                ) : null}
              </p>
            ) : null}
          </div>

          <RemainingRing
            percent={status === 'grace' ? 15 : progressPercent}
            value={ringValue}
            caption={ringCaption}
            label={validityLabel}
            color={ringColor}
          />
        </div>
      </div>

      {/* Datos duros del plan */}
      <div className="grid grid-cols-1 divide-y divide-line border-b border-line bg-surface-elevated/50 sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:divide-y-0">
        <FactCell
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Inicio"
          value={formatDateSpanish(membership.startsAt)}
        />
        <FactCell
          icon={<CalendarClock className="h-4 w-4" />}
          label="Fecha de vencimiento"
          value={formatDateSpanish(membership.endsAt)}
          hint={
            status === 'grace' && membership.graceEndsAt
              ? `Gracia hasta ${formatDateSpanish(membership.graceEndsAt)}`
              : undefined
          }
        />
        <FactCell
          icon={<Wallet className="h-4 w-4" />}
          label="Inversión"
          value={plan?.priceCents ? formatCurrency(plan.priceCents) : '—'}
          hint={plan?.durationDays ? `cada ${plan.durationDays} días` : undefined}
        />
        {hasQuota ? (
          <FactCell
            icon={<Ticket className="h-4 w-4" />}
            label="Visitas disponibles"
            value={`${visitsLeft} de ${plan?.visitQuota} pases`}
            hint="disponibles en el periodo"
          />
        ) : (
          <FactCell
            icon={<InfinityIcon className="h-4 w-4" />}
            label="Acceso"
            value="Ilimitado"
            hint="dentro del periodo"
          />
        )}
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        {/* Avisos de vencimiento */}
        {status === 'grace' && membership.graceEndsAt ? (
          <div className="flex items-start gap-3 rounded-2xl border border-warn/25 bg-warn-soft p-4 text-xs text-warn">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <p className="font-bold">Tu plan venció pero estás en período de gracia</p>
              <p className="text-[11px] leading-relaxed text-warn/90">
                Puedes seguir ingresando y reservando hasta el{' '}
                <span className="font-bold underline">
                  {formatDateSpanish(membership.graceEndsAt)}
                </span>
                . Renueva para no perder tu cupo.
              </p>
            </div>
          </div>
        ) : null}

        {status === 'expired' ? (
          <div className="flex items-start gap-3 rounded-2xl border border-danger/25 bg-danger-soft p-4 text-xs text-danger">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <p className="font-bold">Tu membresía ha expirado</p>
              <p className="text-[11px] leading-relaxed text-danger/90">
                Renueva tu plan para volver a reservar clases y entrenar en el complejo.
              </p>
            </div>
          </div>
        ) : null}

        {/* Disciplinas incluidas */}
        <div className="space-y-2">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
            Tu plan incluye
          </span>
          <div className="flex flex-wrap gap-2">
            {!plan?.allowedZoneIds || plan.allowedZoneIds.length === 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-acc/25 bg-acc-soft px-3 py-1.5 text-xs font-semibold text-acc">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Acceso Total a todas las áreas y disciplinas
              </span>
            ) : (
              plan.allowedZoneIds.map((zid) => {
                const zone = zones.find((z) => z.id === zid)
                const label = zone?.name ?? ZONE_LABELS[zid as keyof typeof ZONE_LABELS] ?? zid
                return (
                  <span
                    key={zid}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface-elevated px-3 py-1.5 text-xs font-medium text-ink-2"
                  >
                    <Dumbbell className="h-3.5 w-3.5 text-ink-3" />
                    <span>{label}</span>
                  </span>
                )
              })
            )}
          </div>
        </div>

        {/* Renovación: solo aparece cuando de verdad toca */}
        {onRenew && (nearExpiry || status === 'grace' || status === 'expired') ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-elevated p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-2">
              {status === 'active'
                ? `Tu plan vence en ${remainingDays} ${remainingDays === 1 ? 'día' : 'días'}. Renuévalo y no pierdas continuidad.`
                : 'Renueva tu plan para recuperar el acceso completo.'}
            </p>
            <button
              type="button"
              onClick={onRenew}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/90 active:scale-[0.98]"
            >
              Renovar plan
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
