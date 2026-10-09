import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, AlertCircle, Clock, X, ArrowRight } from 'lucide-react'
import { useAppData, useCurrentUser } from '@/data/RepositoryProvider'
import { selectMyMembership, selectMyQueuedMembership } from '@/app/store'
import {
  computeMembershipStatus,
  daysRemaining,
  isInGracePeriod,
  isNearExpiration,
  GRACE_PERIOD_DAYS,
} from '@/domain/rules/membership'

interface ExpiryBannerProps {
  className?: string
  /** Override date for deterministic testing */
  now?: Date
}

export function ExpiryBanner({ className = '', now = new Date() }: ExpiryBannerProps) {
  const user = useCurrentUser()
  const data = useAppData()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)

  // Only display banner for logged-in members
  if (!user || user.role !== 'member') {
    return null
  }

  const membership = selectMyMembership(data, user.id)

  // If dismissed and not in critical status (wireframe: dismissible only if warning > 3 days)
  if (dismissed) {
    return null
  }

  // Sin membresía: Inicio muestra la bienvenida (WelcomeNoPlanCard); acá no va aviso.
  if (!membership) {
    return null
  }

  const status = computeMembershipStatus(membership, now)

  if (status === 'expired' || status === 'cancelled') {
    return (
      <div
        data-testid="expiry-banner"
        data-banner-type="expired"
        className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-danger/40 bg-danger/15 p-3.5 text-ink shadow-md ${className}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-danger/25 text-danger">
            <AlertCircle className="h-4 w-4" />
          </div>
          <p className="text-xs sm:text-sm font-medium text-ink-1">
            Membresía vencida. Tus reservas están pausadas. Acércate a recepción para renovar tu plan.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/membresia')}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-danger px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 active:scale-95"
        >
          <span>Ver planes</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  // 2. Urgent Grace Period Banner
  if (isInGracePeriod(membership, now) || status === 'grace') {
    const graceEnd = membership.graceEndsAt
      ? new Date(membership.graceEndsAt)
      : new Date(
          new Date(membership.endsAt).getTime() +
            GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
        )
    // Días de calendario en Guayaquil (alineado a fechas en pantalla)
    const graceDays = Math.max(
      1,
      daysRemaining({ ...membership, endsAt: graceEnd.toISOString() }, now),
    )

    return (
      <div
        data-testid="expiry-banner"
        data-banner-type="grace"
        className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-warn/50 bg-gradient-to-r from-warn-soft to-danger/15 p-3.5 text-ink shadow-md ${className}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-warn/20 text-warn animate-pulse">
            <Clock className="h-4 w-4" />
          </div>
          <p className="text-xs sm:text-sm font-medium text-ink-1">
            <strong className="text-warn font-bold">Período de gracia:</strong> Tu membresía venció.{' '}
            Te {graceDays === 1 ? 'queda 1 día' : `quedan ${graceDays} días`} de gracia para renovar en recepción antes de que se bloqueen tus reservas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/membresia')}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-cta px-3.5 py-1.5 text-xs font-bold text-cta-contrast transition hover:brightness-110 active:scale-95"
        >
          <span>Renovar ahora</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  // 3. Warning Banner (<= 7 days remaining). Con un plan en espera no hay interrupción.
  if (isNearExpiration(membership, 7, now) && !selectMyQueuedMembership(data, user.id, now)) {
    const days = daysRemaining(membership, now)

    return (
      <div
        data-testid="expiry-banner"
        data-banner-type="warning"
        className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-warn/40 bg-warn/15 p-3.5 text-ink shadow-sm ${className}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-warn/25 text-warn">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <p className="text-xs sm:text-sm font-medium text-ink-1">
            Tu membresía vence en {days} {days === 1 ? 'día' : 'días'}. Renueva en recepción para evitar interrupciones.
          </p>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => navigate('/membresia')}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-warn/50 bg-warn/20 px-3 py-1.5 text-xs font-bold text-warn transition hover:bg-warn/30 active:scale-95"
          >
            <span>Ver mi plan</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          {days > 3 ? (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-lg p-1 text-ink-3 hover:bg-surface hover:text-ink transition"
              aria-label="Cerrar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  // Active with > 7 days remaining: no banner
  return null
}
