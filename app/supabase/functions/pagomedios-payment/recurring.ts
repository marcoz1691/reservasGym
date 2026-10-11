/**
 * Pago recurrente con Pagomedios (Adenda N.º 1): el socio registra su tarjeta y la
 * app cobra el primer mes con ese token. Los meses siguientes los cobra el gimnasio
 * desde el panel de Pagomedios; la app no se entera de esos cobros.
 *
 * Comprobado en el sandbox (11-oct-2026):
 *   - POST /cards/register ignora el monto: crea un "Registro de tarjeta" de $1,15
 *     que Pagomedios autoriza y reversa solo (estado 3 con código de autorización).
 *   - GET /cards?document= devuelve las tarjetas del documento; la nueva trae created_at.
 *   - POST /cards/charge responde al instante (1 autorizada, 2 rechazada) y ese cobro
 *     no aparece en GET /payment-requests: la respuesta es la única constancia.
 *
 * La app no guarda el token ni datos de la tarjeta: el estado vive en payments.notes
 * (texto legible para recepción) y la identificación del pagador va en esa misma nota
 * porque GET /cards la exige.
 */

/** Solo planes mensuales: el débito cobra el mismo valor cada mes. */
export const RECURRING_MIN_DAYS = 28
export const RECURRING_MAX_DAYS = 31

export function isRecurringEligiblePlan(plan: {
  duration_days?: number | null
  durationDays?: number | null
  kind?: string | null
}): boolean {
  if (plan.kind === "day_pass") return false
  const days = Number(plan.duration_days ?? plan.durationDays ?? 0)
  return days >= RECURRING_MIN_DAYS && days <= RECURRING_MAX_DAYS
}

export type RecurringStage = "registering" | "charging" | "charged" | "rejected" | "review"

const PREFIX = "Pago recurrente"
const STAGE_TEXT: Record<RecurringStage, string> = {
  registering: "registro de tarjeta en curso",
  charging: "cobrando el primer mes",
  charged: "tarjeta registrada en Pagomedios y primer mes cobrado. Los meses siguientes se cobran desde el panel de Pagomedios",
  rejected: "el primer mes no se cobró",
  review: "Requiere revisión: no se pudo confirmar el cobro del primer mes en Pagomedios",
}

/** Nota del pago: "Pago recurrente (ID 1723358400): cobrando el primer mes." */
export function recurringNote(stage: RecurringStage, document: string): string {
  return `${PREFIX} (ID ${document}): ${STAGE_TEXT[stage]}.`
}

export function parseRecurringNote(
  notes: string | null | undefined,
): { stage: RecurringStage; document: string } | null {
  const match = notes?.match(/^Pago recurrente \(ID ([0-9A-Za-z]+)\): (.+)\.$/)
  if (!match) return null
  const stage = (Object.keys(STAGE_TEXT) as RecurringStage[]).find(
    (key) => STAGE_TEXT[key] === match[2],
  )
  return stage ? { stage, document: match[1]! } : null
}

export type PaymentRequestRow = {
  status?: number | string
  created_at?: string
  transactions?: { status?: number | string; auth_code?: string | null; display_number?: string | null }[]
}

/**
 * Resultado del registro de tarjeta según GET /payment-requests?uuid=.
 * El $1,15 de validación se autoriza y se reversa: 1 o 3 con código de autorización
 * significa tarjeta registrada; 0 sigue pendiente; lo demás es rechazo.
 */
export function registrationOutcome(request: PaymentRequestRow | null): "registered" | "pending" | "rejected" {
  if (!request) return "pending"
  const status = Number(request.status)
  if (status === 0) return "pending"
  const authorized = (request.transactions ?? []).some((t) => Boolean(t?.auth_code))
  return (status === 1 || status === 3) && authorized ? "registered" : "rejected"
}

export type CardRow = { token: string; number?: string; created_at?: string }

/**
 * Tarjeta recién registrada entre las del documento. Si llega el token del notify,
 * solo se usa si Pagomedios lo lista para ese documento (no se confía en el body).
 * Si no, la más reciente creada desde la solicitud, con los mismos últimos 4 dígitos
 * que la transacción cuando se conocen.
 */
export function pickRegisteredCard(
  cards: CardRow[],
  request: PaymentRequestRow,
  hintToken?: string | null,
): CardRow | null {
  if (hintToken) {
    const hinted = cards.find((card) => card.token === hintToken)
    if (hinted) return hinted
  }
  const since = request.created_at ?? ""
  const last4 = lastFour(
    (request.transactions ?? []).find((t) => t?.display_number)?.display_number ?? null,
  )
  const fresh = cards
    .filter((card) => (card.created_at ?? "") >= since)
    .filter((card) => !last4 || lastFour(card.number ?? null) === last4)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
  return fresh[0] ?? null
}

function lastFour(value: string | null): string | null {
  const digits = value?.replace(/\D/g, "") ?? ""
  return digits.length >= 4 ? digits.slice(-4) : null
}

/** Referencia del cobro (máx. 20 alfanuméricos), fija por pago: un reintento no la cambia. */
export function chargeReference(paymentId: string): string {
  return `ZC${paymentId.replace(/[^0-9a-zA-Z]/g, "").slice(0, 18)}`.toUpperCase()
}
