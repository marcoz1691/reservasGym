import { describe, expect, it } from 'vitest'
import {
  buildReceiptWhatsAppUrl,
  generatePaymentReference,
  isPaymentReference,
  normalizeWhatsAppPhone,
  resolveRequestReference,
} from './paymentReceipt'

const receipt = {
  phone: '0991234567',
  memberName: 'Ana Pérez',
  planName: 'Zero Pro Mensual',
  amountCents: 3500,
  method: 'deuna' as const,
  reference: 'ZC-4F7A2C',
}

describe('normalizeWhatsAppPhone', () => {
  it.each([
    ['0991234567', '593991234567'],
    ['099 123 4567', '593991234567'],
    ['991234567', '593991234567'],
    ['+593 99 123 4567', '593991234567'],
    ['593991234567', '593991234567'],
    ['00593991234567', '593991234567'],
  ])('%s pasa a %s', (raw, expected) => {
    expect(normalizeWhatsAppPhone(raw)).toBe(expected)
  })

  it.each([null, undefined, '', '   ', 'sin número', '0991'])('"%s" no es un número válido', (raw) => {
    expect(normalizeWhatsAppPhone(raw)).toBeNull()
  })
})

describe('buildReceiptWhatsAppUrl', () => {
  it('arma el enlace wa.me con el número internacional', () => {
    const url = buildReceiptWhatsAppUrl(receipt)
    expect(url).toMatch(/^https:\/\/wa\.me\/593991234567\?text=/)
  })

  it('el mensaje lleva nombre, plan, monto, medio y referencia, codificado', () => {
    const url = buildReceiptWhatsAppUrl(receipt)!
    const text = new URL(url).searchParams.get('text')!
    expect(text).toContain('Ana Pérez')
    expect(text).toContain('Zero Pro Mensual')
    expect(text).toContain('$35.00')
    expect(text).toContain('Deuna')
    expect(text).toContain('ZC-4F7A2C')
    expect(url).not.toContain(' ')
    expect(url).toContain(encodeURIComponent('Ana Pérez'))
  })

  it('con transferencia nombra el medio', () => {
    const url = buildReceiptWhatsAppUrl({ ...receipt, method: 'transfer' })!
    expect(new URL(url).searchParams.get('text')).toContain('Transferencia')
  })

  it('sin referencia no deja una línea vacía', () => {
    const url = buildReceiptWhatsAppUrl({ ...receipt, reference: null })!
    expect(new URL(url).searchParams.get('text')).not.toContain('Referencia')
  })

  it.each([null, undefined, '', 'abc'])('sin número configurado ("%s") no hay enlace', (phone) => {
    expect(buildReceiptWhatsAppUrl({ ...receipt, phone })).toBeNull()
  })
})

describe('referencia corta del pago', () => {
  it('tiene el formato ZC-XXXXXX en hexadecimal', () => {
    for (let i = 0; i < 20; i++) {
      expect(generatePaymentReference()).toMatch(/^ZC-[0-9A-F]{6}$/)
    }
  })

  it('usa la fuente de bytes que recibe', () => {
    expect(generatePaymentReference(() => new Uint8Array([0x4f, 0x7a, 0x2c]))).toBe('ZC-4F7A2C')
  })

  it('reconoce solo referencias con el formato', () => {
    expect(isPaymentReference('ZC-4F7A2C')).toBe(true)
    expect(isPaymentReference('zc-4f7a2c')).toBe(false)
    expect(isPaymentReference('ZC-4F7A2')).toBe(false)
    expect(isPaymentReference('TRANSF-00129')).toBe(false)
    expect(isPaymentReference(null)).toBe(false)
  })

  it('una solicitud conserva su referencia, si no usa la del checkout, si no crea una', () => {
    expect(resolveRequestReference('ZC-AAAAAA', 'ZC-BBBBBB')).toBe('ZC-AAAAAA')
    expect(resolveRequestReference(null, 'ZC-BBBBBB')).toBe('ZC-BBBBBB')
    expect(resolveRequestReference('TRANSF-1', 'cualquier cosa')).toMatch(/^ZC-[0-9A-F]{6}$/)
    expect(resolveRequestReference(undefined)).toMatch(/^ZC-[0-9A-F]{6}$/)
  })
})
