import { describe, expect, it } from 'vitest'
import {
  isValidCedula,
  isValidMobile,
  isValidRuc,
  sanitizeDocument,
  sanitizePhone,
  validateBilling,
  type BillingForm,
} from './billing'

const ok: BillingForm = {
  documentType: '05',
  document: '1710034065',
  phone: '0987569852',
  address: 'Av. Amazonas N34-120, Quito',
}

describe('datos de facturación', () => {
  it.each(['1710034065', '0102030400', '0923456784', '1723358402'])('cédula válida %s', (c) => {
    expect(isValidCedula(c)).toBe(true)
  })

  it.each([
    ['1723358400', 'dígito verificador incorrecto'],
    ['171003406', '9 dígitos'],
    ['2510034065', 'provincia 25 no existe'],
    ['1770034065', 'tercer dígito 7'],
    ['17100340AB', 'letras'],
  ])('cédula inválida %s (%s)', (c) => {
    expect(isValidCedula(c)).toBe(false)
  })

  it('RUC: persona natural = cédula válida + 001; sociedad con tercer dígito 9', () => {
    expect(isValidRuc('1710034065001')).toBe(true)
    expect(isValidRuc('1790012345001')).toBe(true)
    expect(isValidRuc('1710034065000')).toBe(false)
    expect(isValidRuc('1723358400001')).toBe(false)
    expect(isValidRuc('171003406500')).toBe(false)
  })

  it('celular: 09 + 8 dígitos', () => {
    expect(isValidMobile('0987569852')).toBe(true)
    expect(isValidMobile('0287569852')).toBe(false)
    expect(isValidMobile('098756985')).toBe(false)
  })

  it('cédula y RUC solo aceptan dígitos; pasaporte letras y números en mayúsculas', () => {
    expect(sanitizeDocument('05', 'fddfg34344')).toBe('34344')
    expect(sanitizeDocument('05', '171-003-4065 99')).toBe('1710034065')
    expect(sanitizeDocument('04', '1710034065001999')).toBe('1710034065001')
    expect(sanitizeDocument('06', 'ab-123 456')).toBe('AB123456')
  })

  it('el celular solo acepta dígitos y como máximo 10', () => {
    expect(sanitizePhone('kjhbiughiuhiuh')).toBe('')
    expect(sanitizePhone('+593 98 756 9852')).toBe('5939875698')
    expect(sanitizePhone('098-756-9852')).toBe('0987569852')
  })

  it('un formulario completo y válido no tiene errores', () => {
    expect(validateBilling(ok)).toEqual({})
  })

  it('campos vacíos explican qué falta', () => {
    expect(validateBilling({ ...ok, document: '', phone: '', address: ' ' })).toEqual({
      document: 'Ingresa tu número de identificación.',
      phone: 'Ingresa tu celular.',
      address: 'Ingresa tu dirección.',
    })
  })

  it('mensajes específicos por tipo de error', () => {
    expect(validateBilling({ ...ok, document: '17100' }).document).toBe('La cédula tiene 10 dígitos.')
    expect(validateBilling({ ...ok, document: '1723358400' }).document).toBe('La cédula no es válida.')
    expect(validateBilling({ ...ok, documentType: '04', document: '1710034065' }).document).toBe(
      'El RUC tiene 13 dígitos.',
    )
    expect(validateBilling({ ...ok, documentType: '06', document: 'AB12' }).document).toMatch(/5 caracteres/)
    expect(validateBilling({ ...ok, phone: '0287569852' }).phone).toMatch(/empieza con 09/)
    expect(validateBilling({ ...ok, address: 'Quito' }).address).toBe('Escribe calle y ciudad.')
  })
})
