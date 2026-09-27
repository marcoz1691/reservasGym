import { useEffect, useMemo, useState } from 'react'
import { Check, CreditCard, Dumbbell, Loader2, Sparkles, Ticket } from 'lucide-react'
import type { MembershipPlan, Zone } from '@/domain/models'
import { ZONE_LABELS } from '@/domain/models'
import {
  groupPlansByFamily,
  planFamilyId,
  selectUpgradePlan,
  type PlanFamilyId,
} from '@/domain/rules/membershipPlan'
import { formatCurrency } from '@/lib/format'

interface PlansShowcaseProps {
  plans: MembershipPlan[]
  currentPlanId?: string | null
  zones: Zone[]
  onPayOnline?: (planId: string) => void | Promise<void>
  onChoosePlan?: (planId: string) => void
  payingPlanId?: string | null
  onlinePayEnabled?: boolean
}

function periodTitle(name: string, durationLabel: string) {
  const match = name.match(/(Mensual|Trimestral|Semestral|Anual|Day\s+\w+)$/i)
  return match?.[1] ?? durationLabel
}

function OfferBadge({ badge }: { badge: string }) {
  const discount = badge.match(/^(.+?)\s*·\s*(\d+)\s*%\s*off$/i)
  if (discount) {
    return (
      <span
        aria-label={badge}
        className="mb-3 inline-flex w-fit items-stretch overflow-hidden rounded-full bg-ink shadow-[0_10px_22px_-12px_var(--color-acc-glow)]"
      >
        <span className="bg-gradient-to-br from-acc to-acc-hi px-3 py-1.5 font-display text-sm font-black tabular-nums leading-none tracking-tight text-[var(--color-acc-contrast)]">
          −{discount[2]}%
        </span>
        <span className="px-3 py-1.5 text-xs font-semibold leading-none tracking-wide text-white">
          {discount[1].trim()}
        </span>
      </span>
    )
  }

  return (
    <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full border border-acc/25 bg-acc/10 px-2.5 py-1 text-[11px] font-bold text-acc">
      <Sparkles className="h-3 w-3" />
      {badge}
    </span>
  )
}

export function PlansShowcase({
  plans,
  currentPlanId,
  zones,
  onPayOnline,
  onChoosePlan,
  payingPlanId = null,
  onlinePayEnabled = false,
}: PlansShowcaseProps) {
  const groups = useMemo(() => groupPlansByFamily(plans), [plans])
  const [familyId, setFamilyId] = useState<PlanFamilyId>(() => {
    const currentGroup = groups.find((group) =>
      group.offers.some((offer) => offer.plan.id === currentPlanId),
    )
    return currentGroup?.family.id ?? groups[0]?.family.id ?? 'otros'
  })

  useEffect(() => {
    if (groups.some((group) => group.family.id === familyId)) return
    const currentGroup = groups.find((group) =>
      group.offers.some((offer) => offer.plan.id === currentPlanId),
    )
    setFamilyId(currentGroup?.family.id ?? groups[0]?.family.id ?? 'otros')
  }, [currentPlanId, familyId, groups])

  const activeGroup = groups.find((group) => group.family.id === familyId) ?? groups[0]
  if (!activeGroup) return null

  const currentPlan = plans.find((plan) => plan.id === currentPlanId) ?? null
  const upgrade = selectUpgradePlan(plans, currentPlanId)
  const offers = [...activeGroup.offers].sort((a, b) => {
    if (a.plan.id === upgrade?.id) return -1
    if (b.plan.id === upgrade?.id) return 1
    return a.plan.priceCents - b.plan.priceCents
  })
  const upgradeInView = offers.some((offer) => offer.plan.id === upgrade?.id)

  return (
    <div id="planes-catalogo" className="scroll-mt-4 space-y-5">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h3 className="font-display text-xl font-black tracking-tight text-ink">
            Planes disponibles
          </h3>
          <p className="mt-0.5 text-sm text-ink-2">
            Elige qué incluye y cuánto dura. Semestral y anual traen meses gratis.
          </p>
        </div>
        <span className="text-xs font-semibold text-ink-3">Valores en USD</span>
      </div>

      <div
        role="tablist"
        aria-label="Familias de plan"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {groups.map((group) => {
          const selected = group.family.id === activeGroup.family.id
          return (
            <button
              key={group.family.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setFamilyId(group.family.id)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-bold transition duration-[250ms] ease-[var(--ease-out)] active:scale-[0.98] ${
                selected
                  ? 'bg-acc text-[var(--color-acc-contrast)] shadow-acc'
                  : 'border border-line bg-surface text-ink-2 hover:border-acc/40'
              }`}
            >
              {group.family.label}
            </button>
          )
        })}
      </div>

      <p className="text-sm text-ink-2">{activeGroup.family.benefit}</p>

      {upgrade ? (
        <div className="flex flex-col gap-3 rounded-3xl border-2 border-acc bg-gradient-to-r from-acc/15 via-bg-2 to-bg-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-acc">
              {currentPlan ? 'Mejorar plan' : 'Plan superior'}
            </p>
            <p className="mt-1 font-display text-xl font-black tracking-tight text-ink">
              {upgrade.name}
            </p>
            <p className="mt-0.5 text-sm text-ink-2">
              {currentPlan
                ? `Un nivel arriba de ${currentPlan.name}.`
                : 'Es el plan más completo del catálogo.'}{' '}
              {formatCurrency(upgrade.priceCents)}
            </p>
          </div>
          {!upgradeInView ? (
            <button
              type="button"
              onClick={() => setFamilyId(planFamilyId(upgrade.name))}
              className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-acc px-4 py-2.5 text-sm font-bold text-[var(--color-acc-contrast)] transition hover:brightness-110 active:scale-[0.98]"
            >
              Ver este nivel
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        key={activeGroup.family.id}
        className="stagger-in flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-4"
      >
        {offers.map((offer) => {
          const { plan } = offer
          const isCurrent = plan.id === currentPlanId
          const isUpgrade = plan.id === upgrade?.id
          const hasQuota = plan.visitQuota !== null && plan.visitQuota !== undefined
          const isPaying = payingPlanId === plan.id
          const title =
            offer.familyId === 'otros'
              ? plan.name
              : periodTitle(plan.name, offer.durationLabel)

          return (
            <div
              key={plan.id}
              className={`relative flex min-w-[78%] snap-start flex-col justify-between rounded-3xl border p-5 transition duration-[250ms] ease-[var(--ease-out)] md:min-w-0 ${
                isUpgrade
                  ? 'border-2 border-acc bg-gradient-to-b from-acc/15 via-bg-2 to-bg-2 shadow-acc md:scale-[1.02]'
                  : isCurrent
                    ? 'border-acc/60 bg-bg-2'
                    : 'border-line bg-bg-2/80 hover:border-line/90'
              }`}
            >
              {isUpgrade ? (
                <div className="mb-2 inline-flex w-fit rounded-full bg-acc px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--color-acc-contrast)]">
                  {currentPlan ? 'Mejorar' : 'Recomendado'}
                </div>
              ) : null}
              {isCurrent ? (
                <div className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-ink px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                  <Check className="h-3 w-3" />
                  Tu plan actual
                </div>
              ) : null}
              {offer.badge ? <OfferBadge badge={offer.badge} /> : null}
              {offer.featured ? (
                <span className="mb-2 ml-1 inline-flex w-fit font-mono text-[10px] font-bold uppercase tracking-wide text-acc">
                  Más ahorro
                </span>
              ) : null}

              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="font-display text-lg font-black tracking-tight text-ink">
                    {title}
                  </p>
                  {title !== plan.name ? (
                    <p className="text-xs font-semibold text-ink-3">{plan.name}</p>
                  ) : null}
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-4xl font-extrabold tabular-nums tracking-tight text-ink">
                      {formatCurrency(plan.priceCents)}
                    </span>
                    <span className="text-xs font-bold text-ink-3">
                      / {offer.durationLabel}
                    </span>
                  </div>
                  {offer.equivalentPerMonthCents ? (
                    <p className="text-sm font-semibold text-ink-2">
                      equivale a {formatCurrency(offer.equivalentPerMonthCents)}/mes
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2.5 border-t border-line/60 pt-3 text-sm text-ink-2">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-acc" />
                    <span>
                      Vigencia de <strong>{offer.durationLabel}</strong>
                    </span>
                  </div>
                  {hasQuota ? (
                    <div className="flex items-center gap-2">
                      <Ticket className="h-4 w-4 shrink-0 text-acc" />
                      <span>
                        Pase de <strong>{plan.visitQuota} visitas</strong>
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 shrink-0 text-acc" />
                      <span>Acceso ilimitado dentro del periodo</span>
                    </div>
                  )}
                  <div className="space-y-1.5 pt-1">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-ink-3">
                      Disciplinas incluidas
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {!plan.allowedZoneIds || plan.allowedZoneIds.length === 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-acc/10 px-2 py-0.5 text-[11px] font-bold text-acc">
                          <Sparkles className="h-3 w-3" />
                          Acceso Total
                        </span>
                      ) : (
                        plan.allowedZoneIds.map((zid) => {
                          const zone = zones.find((item) => item.id === zid)
                          const label =
                            zone?.name ?? ZONE_LABELS[zid as keyof typeof ZONE_LABELS] ?? zid
                          return (
                            <span
                              key={zid}
                              className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-2"
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

              <div className="mt-5 space-y-2 border-t border-line/60 pt-3">
                {onlinePayEnabled && onPayOnline && (!currentPlanId || isCurrent || isUpgrade) ? (
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
                        {isCurrent
                          ? 'Renovar en línea'
                          : isUpgrade && currentPlan
                            ? 'Mejorar en línea'
                            : 'Pagar en línea'}
                      </>
                    )}
                  </button>
                ) : null}
                {onChoosePlan && !onlinePayEnabled && !isCurrent ? (
                  <button
                    type="button"
                    onClick={() => onChoosePlan(plan.id)}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.98] ${
                      isUpgrade
                        ? 'bg-acc text-[var(--color-acc-contrast)] hover:brightness-110'
                        : 'border border-line bg-transparent text-ink hover:border-acc/50'
                    }`}
                  >
                    {isUpgrade && currentPlan ? 'Mejorar plan' : 'Elegir este plan'}
                  </button>
                ) : null}
                {isCurrent && onChoosePlan && !onlinePayEnabled ? (
                  <button
                    type="button"
                    disabled
                    className="flex w-full items-center justify-center rounded-2xl border border-line px-4 py-2.5 text-sm font-bold text-ink-3"
                  >
                    Plan actual
                  </button>
                ) : null}
                <p className="text-center text-[11px] text-ink-3">
                  {isCurrent
                    ? onlinePayEnabled
                      ? 'También puedes renovar en recepción'
                      : 'Renuévalo en recepción'
                    : isUpgrade && currentPlan
                      ? 'Recepción activa la mejora cuando cobra.'
                    : currentPlanId
                      ? 'Para cambiar de plan, elige otro. Recepción lo activa al cobrar.'
                      : onChoosePlan && !onlinePayEnabled
                        ? 'Elige el plan y cómo vas a pagar. El cobro se completa en recepción.'
                        : onlinePayEnabled
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
