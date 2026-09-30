import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowUpRight,
  Check,
  CreditCard,
  Infinity as InfinityIcon,
  Loader2,
  Ticket,
} from 'lucide-react'
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

/**
 * Chip carbón con la cifra en ámbar: el contraste lo hace saltar sin recurrir
 * a un bloque de color plano. Los estados del plan (actual / recomendado) usan
 * otro lenguaje para que nunca se confundan con una promoción.
 */
const CHIP_CLASSES =
  'relative inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-ink px-2.5 py-1.5 leading-none shadow-[0_8px_18px_-10px_rgba(28,25,23,0.55)] ring-1 ring-inset ring-white/10'

/** Filo superior: simula el brillo de un canto metálico. */
function ChipSheen() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-acc/70 to-transparent"
    />
  )
}

function OfferBadge({ badge }: { badge: string }) {
  const discount = badge.match(/^(.+?)\s*·\s*(\d+)\s*%\s*off$/i)
  if (discount) {
    const [, period = '', percent = ''] = discount
    return (
      <span aria-label={badge} className={CHIP_CLASSES}>
        <ChipSheen />
        <span className="font-display text-xs font-extrabold tabular-nums tracking-tight text-acc">
          −{percent}%
        </span>
        <span aria-hidden className="h-2.5 w-px bg-white/20" />
        <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/70">
          {period.trim()}
        </span>
      </span>
    )
  }

  return (
    <span className={CHIP_CLASSES}>
      <ChipSheen />
      {/* Punto sólido en vez de pictograma: a 12px cualquier icono se ve garabato */}
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-acc" />
      <span className="text-[11px] font-semibold tracking-wide text-white">{badge}</span>
    </span>
  )
}

function FeatureRow({
  icon,
  children,
}: {
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <li className="flex items-start gap-2.5 text-sm leading-snug text-ink-2">
      <span className="mt-0.5 shrink-0 text-ink-3">{icon}</span>
      <span>{children}</span>
    </li>
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
  // Precio de lista: la tarifa mensual de la misma familia por los meses que
  // cubre la oferta. Sin plan mensual no hay referencia y no se tacha nada.
  const monthlyCents =
    activeGroup.offers.find((offer) => offer.plan.durationDays === 30)?.plan.priceCents ??
    null

  return (
    <div id="planes-catalogo" className="scroll-mt-4 space-y-6">
      <div>
        <h3 className="font-display text-xl font-bold tracking-tight text-ink">
          Planes disponibles
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">
          {currentPlan
            ? 'Renueva el tuyo o sube de nivel. Semestral y anual traen meses gratis.'
            : 'Elige qué incluye y cuánto dura. Semestral y anual traen meses gratis.'}
        </p>
      </div>

      {/* Selector de familia — control segmentado, sin relleno naranja */}
      <div className="space-y-3">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div
            role="tablist"
            aria-label="Familias de plan"
            className="inline-flex gap-1 rounded-2xl border border-line bg-surface-elevated p-1"
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
                  className={`shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition duration-[250ms] ease-[var(--ease-out)] active:scale-[0.98] ${
                    selected
                      ? 'bg-surface text-ink shadow-[var(--shadow-card)]'
                      : 'text-ink-3 hover:text-ink-2'
                  }`}
                >
                  {group.family.label}
                </button>
              )
            })}
          </div>
        </div>
        <p className="text-sm text-ink-2">{activeGroup.family.benefit}</p>
      </div>

      {upgrade ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-acc-soft text-acc"
            >
              <ArrowUpRight className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                {currentPlan ? 'Mejorar plan' : 'Plan superior'}
              </p>
              <p className="mt-0.5 font-display text-lg font-bold tracking-tight text-ink">
                {upgrade.name}
              </p>
              <p className="mt-0.5 text-sm text-ink-2">
                {currentPlan
                  ? `Un nivel arriba de ${currentPlan.name}.`
                  : 'Es el plan más completo del catálogo.'}{' '}
                {formatCurrency(upgrade.priceCents)}
              </p>
            </div>
          </div>
          {!upgradeInView ? (
            <button
              type="button"
              onClick={() => setFamilyId(planFamilyId(upgrade.name))}
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-elevated active:scale-[0.98]"
            >
              Ver este nivel
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        key={activeGroup.family.id}
        className="stagger-in flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-4"
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
          const openZones = !plan.allowedZoneIds || plan.allowedZoneIds.length === 0
          const listCents =
            monthlyCents && offer.months && offer.months > 1
              ? monthlyCents * offer.months
              : null
          const savingsCents =
            listCents && listCents > plan.priceCents ? listCents - plan.priceCents : null

          return (
            <div
              key={plan.id}
              className={`relative flex min-w-[80%] max-w-[92%] snap-start flex-col overflow-hidden rounded-2xl border p-5 transition duration-[250ms] ease-[var(--ease-out)] md:min-w-0 md:max-w-none ${
                isUpgrade
                  ? 'border-acc/40 bg-gradient-to-b from-acc/[0.07] via-surface to-surface shadow-[var(--shadow-card)] ring-1 ring-inset ring-acc/10 md:-translate-y-1'
                  : isCurrent
                    ? 'border-ink/25 bg-gradient-to-b from-ink/[0.045] via-surface to-surface'
                    : 'border-line bg-gradient-to-b from-surface to-surface-elevated/70 hover:border-line-strong'
              }`}
            >
              {/* Riel superior: naranja = el que te conviene, carbón = el que ya tienes */}
              {isUpgrade || isCurrent ? (
                <span
                  aria-hidden
                  className={`absolute inset-x-0 top-0 h-[3px] ${
                    isUpgrade ? 'bg-acc' : 'bg-ink'
                  }`}
                />
              ) : null}

              {/* Fila de etiquetas: altura fija para que los precios se alineen */}
              <div className="flex min-h-[28px] flex-wrap items-center gap-1.5">
                {isUpgrade ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-acc/35 bg-acc-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-acc">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-acc" />
                    <span>{currentPlan ? 'Mejorar' : 'Recomendado'}</span>
                  </span>
                ) : null}
                {isCurrent ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                    <Check className="h-3 w-3" />
                    <span>Tu plan actual</span>
                  </span>
                ) : null}
                {offer.badge ? <OfferBadge badge={offer.badge} /> : null}
                {offer.featured ? (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                    Más ahorro
                  </span>
                ) : null}
              </div>

              <div className="mt-3 space-y-1">
                <p className="font-display text-base font-semibold tracking-tight text-ink">
                  {title}
                </p>
                {title !== plan.name ? (
                  <p className="text-xs text-ink-3">{plan.name}</p>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {savingsCents && listCents ? (
                  <span
                    className="text-sm tabular-nums text-ink-3 line-through decoration-ink-3/60"
                    title="Precio sin descuento"
                  >
                    {formatCurrency(listCents)}
                  </span>
                ) : null}
                <span className="font-display text-[2rem] font-bold leading-none tabular-nums tracking-tight text-ink">
                  {formatCurrency(plan.priceCents)}
                </span>
                <span className="text-sm text-ink-3">/ {offer.durationLabel}</span>
              </div>
              {/* Altura fija: mantiene los botones alineados entre tarjetas */}
              <div className="mt-1.5 min-h-[42px] space-y-1">
                {offer.equivalentPerMonthCents ? (
                  <p className="text-sm text-ink-2">
                    equivale a {formatCurrency(offer.equivalentPerMonthCents)}/mes
                  </p>
                ) : null}
                {savingsCents ? (
                  <p className="inline-flex items-center rounded-lg border border-acc/25 bg-acc-soft px-2 py-0.5 text-[13px] font-semibold tabular-nums text-acc">
                    Ahorras {formatCurrency(savingsCents)}
                  </p>
                ) : null}
              </div>

              <div className="mt-4 space-y-2">
                {onlinePayEnabled && onPayOnline ? (
                  <button
                    type="button"
                    disabled={Boolean(payingPlanId)}
                    onClick={() => void onPayOnline(plan.id)}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 active:scale-[0.98] ${
                      isUpgrade
                        ? 'bg-acc text-[var(--color-acc-contrast)] shadow-[var(--shadow-acc)] hover:bg-acc-hi'
                        : isCurrent
                          ? 'bg-ink text-white hover:bg-ink/90'
                          : 'border border-line-strong bg-surface text-ink hover:bg-surface-elevated'
                    }`}
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
                {onlinePayEnabled && onPayOnline ? (
                  <p className="text-center text-xs text-ink-3">
                    Pago único con tarjeta · sin cobros recurrentes
                  </p>
                ) : null}
                {onChoosePlan && !onlinePayEnabled && !isCurrent ? (
                  <button
                    type="button"
                    onClick={() => onChoosePlan(plan.id)}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
                      isUpgrade
                        ? 'bg-acc text-[var(--color-acc-contrast)] shadow-[var(--shadow-acc)] hover:bg-acc-hi'
                        : 'border border-line-strong bg-surface text-ink hover:bg-surface-elevated'
                    }`}
                  >
                    {isUpgrade && currentPlan ? 'Mejorar plan' : 'Elegir este plan'}
                  </button>
                ) : null}
                {isCurrent && onChoosePlan && !onlinePayEnabled ? (
                  <button
                    type="button"
                    disabled
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink/20 bg-ink/[0.06] px-4 py-2.5 text-sm font-semibold text-ink-2"
                  >
                    <Check className="h-4 w-4" aria-hidden />
                    Plan actual
                  </button>
                ) : null}
              </div>

              <ul className="mt-5 space-y-2.5 border-t border-line pt-4">
                <FeatureRow icon={<Check className="h-4 w-4" />}>
                  Vigencia de <strong className="font-semibold text-ink">{offer.durationLabel}</strong>
                </FeatureRow>
                {hasQuota ? (
                  <FeatureRow icon={<Ticket className="h-4 w-4" />}>
                    Pase de{' '}
                    <strong className="font-semibold text-ink">
                      {plan.visitQuota} visitas
                    </strong>
                  </FeatureRow>
                ) : (
                  <FeatureRow icon={<InfinityIcon className="h-4 w-4" />}>
                    Acceso ilimitado dentro del periodo
                  </FeatureRow>
                )}
                <FeatureRow icon={<Check className="h-4 w-4" />}>
                  {openZones ? (
                    <span className="font-semibold text-ink">
                      Acceso Total a todas las áreas
                    </span>
                  ) : (
                    <>
                      <span className="block text-ink-2">Disciplinas incluidas</span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {plan.allowedZoneIds.map((zid) => {
                          const zone = zones.find((item) => item.id === zid)
                          const label =
                            zone?.name ?? ZONE_LABELS[zid as keyof typeof ZONE_LABELS] ?? zid
                          return (
                            <span
                              key={zid}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-elevated px-2 py-0.5 text-[11px] font-medium text-ink-2"
                            >
                              <span
                                aria-hidden
                                className="h-1.5 w-1.5 rounded-full bg-acc/60"
                              />
                              {label}
                            </span>
                          )
                        })}
                      </span>
                    </>
                  )}
                </FeatureRow>
              </ul>
            </div>
          )
        })}
      </div>

      <p className="text-sm leading-relaxed text-ink-3">
        Todos los planes incluyen reserva de clases desde la app, check-in con código y
        seguimiento de tu progreso.{' '}
        {onlinePayEnabled
          ? 'Puedes pagar en línea con tarjeta (pago único) o en recepción (efectivo, transferencia o Datafast).'
          : currentPlanId
            ? 'Elige el plan y cómo vas a pagar: recepción activa el cambio al registrar el cobro.'
            : 'Elige el plan y cómo vas a pagar: el cobro se completa en recepción.'}
      </p>
    </div>
  )
}
