import type { BillingDocumentType } from '@/domain/rules/billing'

export type CheckoutMethod = 'card' | 'recurring' | 'cash' | 'transfer' | 'deuna'
export type CheckoutDraft = {
  userId: string
  planId: string
  documentType: BillingDocumentType
  document: string
  phone: string
  address: string
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
      !['04', '05', '06', '08'].includes(draft.documentType) ||
      !['card', 'recurring', 'cash', 'transfer', 'deuna'].includes(draft.method) ||
      !['document', 'phone', 'address', 'paymentId'].every((field) => typeof draft[field] === 'string') ||
      typeof draft.acceptedTerms !== 'boolean'
    ) return null
    return draft
  } catch {
    clearCheckoutDraft()
    return null
  }
}
