import { Check, CreditCard, Dumbbell, Loader2, Sparkles, Ticket } from 'lucide-react'
import type { MembershipPlan, Zone } from '@/domain/models'
import { ZONE_LABELS } from '@/domain/models'
import { formatCurrency } from '@/lib/format'

interface PlansShowcaseProps {
  plans: MembershipPlan[]
  currentPlanId?: string | null
  zones: Zone[]
  /** When set, shows online pay CTA per plan */
  onPayOnline?: (planId: string) => void | Promise<void>
  payingPlanId?: string | null
  onlinePayEnabled?: boolean
}

export function PlansShowcase({
  plans,
  currentPlanId,
  zones,
  onPayOnline,
  payingPlanId = null,
  onlinePayEnabled = false,
}: PlansShowcaseProps) {
  const activePlans = plans.filter((p) => p.active)

  if (activePlans.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h3 className="text-xl font-extrabold text-ink">Planes disponibles</h3>
          <p className="text-xs text-ink-3 mt-0.5">
            Tarifas y planes de membresía vigentes en Zona Cero Performance
          </p>
        </div>
        <span className="text-xs font-semibold text-ink-3">
          Valores en USD incluidos impuestos
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activePlans.map((plan) => {
          const isCurrent = plan.id === currentPlanId
          const hasQuota = plan.visitQuota !== null && plan.visitQuota !== undefined
          const isPaying = payingPlanId === plan.id

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col justify-between rounded-3xl border p-5 transition-all ${
                isCurrent
                  ? 'border-acc/60 bg-gradient-to-b from-acc/10 via-bg-2 to-bg-2 shadow-lg shadow-acc/5'
                  : 'border-line bg-bg-2/80 hover:border-line/90 hover:bg-bg-2'
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 right-5 inline-flex items-center gap-1 rounded-full bg-acc px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--color-acc-contrast)] shadow-md">
                  <Check className="h-3 w-3" />
                  Tu plan actual
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <h4 className="text-lg font-black text-ink">{plan.name}</h4>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black tracking-tight text-ink">
                      {formatCurrency(plan.priceCents)}
                    </span>
                    <span className="text-xs font-bold text-ink-3">
                      / {plan.durationDays} días
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5 border-t border-line/60 pt-3 text-xs text-ink-2">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-acc shrink-0" />
                    <span>
                      Vigencia de <strong>{plan.durationDays} días</strong>
                    </span>
                  </div>

                  {hasQuota ? (
                    <div className="flex items-center gap-2">
                      <Ticket className="h-4 w-4 text-acc shrink-0" />
                      <span>
                        Pase de <strong>{plan.visitQuota} visitas</strong>
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-acc shrink-0" />
                      <span>Acceso ilimitado dentro del periodo</span>
                    </div>
                  )}

                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3 block">
                      Disciplinas incluidas:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {!plan.allowedZoneIds || plan.allowedZoneIds.length === 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-acc/10 px-2 py-0.5 text-[11px] font-bold text-acc">
                          <Sparkles className="h-3 w-3" />
                          Acceso Total
                        </span>
                      ) : (
                        plan.allowedZoneIds.map((zid) => {
                          const zone = zones.find((z) => z.id === zid)
                          const label =
                            zone?.name ?? ZONE_LABELS[zid as keyof typeof ZONE_LABELS] ?? zid
                          return (
                            <span
                              key={zid}
                              className="inline-flex items-center gap-1 rounded-lg bg-surface border border-line px-2 py-0.5 text-[11px] font-semibold text-ink-2"
                            >
                              <Dumbbell className="h-2.5 w-2.5 text-acc" />
                              {label}
                            </span>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-line/60 pt-3 space-y-2">
                {onlinePayEnabled && onPayOnline ? (
                  <button
                    type="button"
                    disabled={Boolean(payingPlanId)}
                    onClick={() => void onPayOnline(plan.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-acc px-4 py-2.5 text-sm font-bold text-[var(--color-acc-contrast)] transition hover:brightness-110 disabled:opacity-60 active:scale-[0.98]"
                  >
                    {isPaying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Redirigiendo…
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4" />
                        {isCurrent ? 'Renovar en línea' : 'Pagar en línea'}
                      </>
                    )}
                  </button>
                ) : null}
                <p className="text-[11px] text-ink-3 text-center">
                  {onlinePayEnabled
                    ? 'También puedes pagar en recepción (efectivo, transferencia o Datafast)'
                    : 'Adquiérelo o renuévalo en recepción'}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
