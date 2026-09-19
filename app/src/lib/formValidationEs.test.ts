import { describe, expect, it } from 'vitest'
import {
  applyDecimalRangeValidity,
  isBlockedNumberKey,
  sanitizeDecimalInput,
  spanishValidityMessage,
} from './formValidationEs'

function mockInput(
  partial: Partial<ValidityState> & {
    type?: string
    min?: string
    max?: string
    minLength?: number
    maxLength?: number
  },
): HTMLInputElement {
  const {
    type = 'text',
    min = '',
    max = '',
    minLength = -1,
    maxLength = -1,
    ...validity
  } = partial
  return {
    type,
    min,
    max,
    minLength,
    maxLength,
    validity: {
      valid: false,
      valueMissing: false,
      typeMismatch: false,
      patternMismatch: false,
      tooShort: false,
      tooLong: false,
      rangeUnderflow: false,
      rangeOverflow: false,
      stepMismatch: false,
      badInput: false,
      customError: false,
      ...validity,
    },
  } as HTMLInputElement
}

describe('spanishValidityMessage', () => {
  it('traduce badInput (Please enter a number)', () => {
    expect(spanishValidityMessage(mockInput({ badInput: true }))).toBe(
      'Ingresa un número válido.',
    )
  })

  it('traduce valueMissing', () => {
    expect(spanishValidityMessage(mockInput({ valueMissing: true }))).toBe(
      'Completa este campo.',
    )
  })

  it('traduce email typeMismatch', () => {
    expect(
      spanishValidityMessage(mockInput({ type: 'email', typeMismatch: true })),
    ).toBe('Ingresa un correo electrónico válido.')
  })

  it('traduce rangeUnderflow con min', () => {
    expect(
      spanishValidityMessage(mockInput({ rangeUnderflow: true, min: '20' })),
    ).toBe('El valor mínimo es 20.')
  })

  it('traduce rangeOverflow con max', () => {
    expect(
      spanishValidityMessage(mockInput({ rangeOverflow: true, max: '250' })),
    ).toBe('El valor máximo es 250.')
  })
})

describe('bloqueo de teclas en type=number', () => {
  it('bloquea e E + -', () => {
    expect(isBlockedNumberKey('e')).toBe(true)
    expect(isBlockedNumberKey('E')).toBe(true)
    expect(isBlockedNumberKey('+')).toBe(true)
    expect(isBlockedNumberKey('-')).toBe(true)
  })

  it('permite dígitos y punto', () => {
    expect(isBlockedNumberKey('5')).toBe(false)
    expect(isBlockedNumberKey('.')).toBe(false)
    expect(isBlockedNumberKey('Backspace')).toBe(false)
  })

  it('sanitizeDecimalInput quita e y signos', () => {
    expect(sanitizeDecimalInput('12e3')).toBe('123')
    expect(sanitizeDecimalInput('68.5')).toBe('68.5')
    expect(sanitizeDecimalInput('1.2.3')).toBe('1.23')
    expect(sanitizeDecimalInput('-40')).toBe('40')
  })
})

describe('applyDecimalRangeValidity', () => {
  it('marca error si está bajo el mínimo', () => {
    let msg = ''
    const input = {
      value: '10',
      setCustomValidity(m: string) {
        msg = m
      },
    } as HTMLInputElement
    applyDecimalRangeValidity(input, '20', '350')
    expect(msg).toBe('El valor mínimo es 20.')
  })

  it('marca error si está sobre el máximo', () => {
    let msg = ''
    const input = {
      value: '400',
      setCustomValidity(m: string) {
        msg = m
      },
    } as HTMLInputElement
    applyDecimalRangeValidity(input, '20', '350')
    expect(msg).toBe('El valor máximo es 350.')
  })

  it('limpia si el valor es válido', () => {
    let msg = 'prev'
    const input = {
      value: '68.5',
      setCustomValidity(m: string) {
        msg = m
      },
    } as HTMLInputElement
    applyDecimalRangeValidity(input, '20', '350')
    expect(msg).toBe('')
  })
})
