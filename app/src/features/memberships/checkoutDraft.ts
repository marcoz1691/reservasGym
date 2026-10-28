import { BILLING_DOCUMENT_TYPES, type BillingDocumentType } from '@/domain/rules/billing'

export const CHECKOUT_METHODS = ['card', 'recurring', 'cash', 'transfer', 'deuna'] as const
export type CheckoutMethod = (typeof CHECKOUT_METHODS)[number]
export type CheckoutDraft = {
  userId: string
  planId: string
  documentType: BillingDocumentType
  document: string
  phone: string
  address: string
  acceptedPrivacy?: boolean
  privacyVersion?: string
  acceptedTerms: boolean
  termsDocumentKey?: string
  method: CheckoutMethod
  paymentId: string
}

const KEY = 'zonacero.checkoutDraft'
const TTL = 60 * 60 * 1000

/** Solo la pestaña actual; no guarda datos de tarjeta ni mantiene datos indefinidamente. */
export function saveCheckoutDraft(draft: CheckoutDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: Date.now() }))
  } catch {
    // El pago sigue disponible si el navegador bloquea el almacenamiento.
  }
}

export function clearCheckoutDraft(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Almacenamiento bloqueado.
  }
}

export function readCheckoutDraft(userId: string | undefined, planId: string | null): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const draft = JSON.parse(raw)
    const age = Date.now() - draft.savedAt
    if (!Number.isFinite(age) || age < 0 || age >= TTL) {
      clearCheckoutDraft()
      return null
    }
    if (!userId || !planId || draft.userId !== userId || draft.planId !== planId) return null
    if (
      !BILLING_DOCUMENT_TYPES.some((type) => type.value === draft.documentType) ||
      !CHECKOUT_METHODS.includes(draft.method) ||
      !['document', 'phone', 'address', 'paymentId'].every((field) => typeof draft[field] === 'string') ||
      typeof draft.acceptedTerms !== 'boolean'
    ) return null
    return draft
  } catch {
    clearCheckoutDraft()
    return null
  }
}
