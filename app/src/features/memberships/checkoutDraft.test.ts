import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearCheckoutDraft, readCheckoutDraft, saveCheckoutDraft, type CheckoutDraft } from './checkoutDraft'

const draft: CheckoutDraft = {
  userId: 'u1', planId: 'p1', documentType: '05', document: '1710034065',
  phone: '0987569852', address: 'Av. Amazonas, Quito', acceptedTerms: true,
  method: 'recurring', paymentId: 'pay1',
}

describe('borrador al volver del proveedor', () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('recupera el formulario únicamente para el mismo socio y plan', () => {
    saveCheckoutDraft(draft)
    expect(readCheckoutDraft('u2', 'p1')).toBeNull()
    expect(readCheckoutDraft('u1', 'p2')).toBeNull()
    expect(readCheckoutDraft('u1', 'p1')).toMatchObject(draft)
    clearCheckoutDraft()
    expect(readCheckoutDraft('u1', 'p1')).toBeNull()
  })

  it('elimina los datos al cumplirse una hora', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000)
    saveCheckoutDraft(draft)
    clock.mockReturnValue(1000 + 60 * 60 * 1000)
    expect(readCheckoutDraft('u1', 'p1')).toBeNull()
    expect(sessionStorage.length).toBe(0)
  })

  it('descarta almacenamiento corrupto', () => {
    sessionStorage.setItem('zonacero.checkoutDraft', '{')
    expect(readCheckoutDraft('u1', 'p1')).toBeNull()
    expect(sessionStorage.length).toBe(0)
  })

  it('no interrumpe el pago si el navegador bloquea el almacenamiento', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Bloqueado') })
    expect(() => saveCheckoutDraft(draft)).not.toThrow()
  })
})
