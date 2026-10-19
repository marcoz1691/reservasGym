import { describe, expect, it, vi } from 'vitest'
import { UNIQUE_VIOLATION, writeWithAuthCode } from '../../supabase/functions/pagomedios-payment/authCode'

// ZCAPP-72: el banco repite códigos de autorización entre transacciones. Con el índice
// único de mp_payment_id (antes de quitar-mercadopago-datafast.sql), aprobar un segundo
// pago con el mismo código fallaba y el pago cobrado quedaba pendiente y sin membresía.
const duplicated = { code: UNIQUE_VIOLATION, message: 'duplicate key value violates unique constraint "idx_payments_mp_payment_id"' }
const approved = { data: [{ id: 'pago-b' }], error: null }

describe('pagomedios-payment: código de autorización repetido (ZCAPP-72)', () => {
  it('si el código ya lo tiene otro pago, aprueba sin guardarlo', async () => {
    const write = vi.fn(async (code: string) => (code ? { data: null, error: duplicated } : approved))
    const onRepeated = vi.fn()

    const result = await writeWithAuthCode(write, '123456', onRepeated)

    expect(result).toEqual(approved)
    expect(write.mock.calls.map(([code]) => code)).toEqual(['123456', ''])
    expect(onRepeated).toHaveBeenCalledWith('123456')
  })

  it('con un código nuevo escribe una sola vez y lo guarda', async () => {
    const write = vi.fn(async () => approved)

    const result = await writeWithAuthCode(write, '654321')

    expect(result).toEqual(approved)
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith('654321')
  })

  it('otros errores de la base no se reintentan', async () => {
    const other = { data: null, error: { code: '42501', message: 'permission denied' } }
    const write = vi.fn(async () => other)

    const result = await writeWithAuthCode(write, '123456')

    expect(result).toBe(other)
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('sin código no hay nada que quitar: devuelve el error tal cual', async () => {
    const failed = { data: null, error: duplicated }
    const write = vi.fn(async () => failed)

    const result = await writeWithAuthCode(write, '')

    expect(result).toBe(failed)
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('si el reintento sin código también falla, devuelve ese error', async () => {
    const retryError = { data: null, error: { code: '40001', message: 'could not serialize access' } }
    const write = vi.fn(async (code: string) => (code ? { data: null, error: duplicated } : retryError))

    const result = await writeWithAuthCode(write, '123456')

    expect(result).toBe(retryError)
    expect(write).toHaveBeenCalledTimes(2)
  })
})
