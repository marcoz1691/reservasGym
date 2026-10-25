import { describe, expect, it } from 'vitest'
import {
  buildReceiptWhatsAppUrl,
  formatReceiptNumber,
  generatePaymentReference,
  matchesReceiptNumber,
  isPaymentReference,
  memberPhoneError,
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

describe('número de comprobante (ZCAPP-77)', () => {
  it.each([
    [1, '000001'],
    [123, '000123'],
    [999999, '999999'],
    [1234567, '1234567'],
  ])('%s se muestra como %s', (n, expected) => {
    expect(formatReceiptNumber(n)).toBe(expected)
  })

  it.each([null, undefined, 0, -3, 1.5])('sin número válido (%s) no se muestra', (n) => {
    expect(formatReceiptNumber(n)).toBeNull()
  })

  it.each([
    ['000123', 123],
    ['123', 123],
    [' 0123 ', 123],
    ['N.º 000123', 123],
  ])('la búsqueda "%s" encuentra el comprobante %s', (query, n) => {
    expect(matchesReceiptNumber(query, n)).toBe(true)
  })

  it.each([
    ['000124', 123],
    ['ana', 123],
    ['ZC-4F7A2C', 472],
    ['Ana 2', 2],
    ['', 123],
    ['123', null],
  ])('la búsqueda "%s" no encuentra el comprobante %s', (query, n) => {
    expect(matchesReceiptNumber(query, n)).toBe(false)
  })
})

describe('memberPhoneError (ZCAPP-83)', () => {
  it.each(['', '   ', null, undefined])('vacío es válido porque el celular es opcional: "%s"', (raw) => {
    expect(memberPhoneError(raw)).toBeNull()
  })

  it.each(['0991234567', '099 123 4567', '+593 99 123 4567', '593991234567', '+1 305 555 0123', '+34 612 345 678'])(
    '%s es un celular válido',
    (raw) => {
      expect(memberPhoneError(raw)).toBeNull()
    },
  )

  it.each([
    ['sin número'],
    ['0991'],
    ['022345678'],
    ['02 234 5678'],
    ['09912345678'],
    ['+593 2 234 5678'],
    ['0991234567 ext 2'],
  ])('%s no es un celular válido', (raw) => {
    expect(memberPhoneError(raw)).toMatch(/celular/i)
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
