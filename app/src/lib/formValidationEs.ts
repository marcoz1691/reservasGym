/**
 * Mensajes nativos HTML5 de validación en español.
 * El navegador muestra "Please enter a number." según su idioma de UI;
 * con setCustomValidity forzamos español en toda la app (lang=es).
 */

type ValidityTarget =
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement

export function spanishValidityMessage(el: ValidityTarget): string {
  const v = el.validity
  if (v.valid) return ''

  if (v.valueMissing) return 'Completa este campo.'
  if (v.badInput) return 'Ingresa un número válido.'
  if (v.typeMismatch) {
    const inputType =
      'type' in el && typeof el.type === 'string' ? el.type : ''
    if (inputType === 'email') {
      return 'Ingresa un correo electrónico válido.'
    }
    if (inputType === 'url') {
      return 'Ingresa una URL válida.'
    }
    return 'El formato del valor no es correcto.'
  }
  if (v.patternMismatch) return 'El formato no es válido.'
  if (v.tooShort) {
    const minLength = 'minLength' in el ? el.minLength : 0
    return `Usa al menos ${minLength} caracteres.`
  }
  if (v.tooLong) {
    const maxLength = 'maxLength' in el ? el.maxLength : 0
    return `Usa como máximo ${maxLength} caracteres.`
  }
  if (v.rangeUnderflow) {
    const min =
      'min' in el && typeof el.min === 'string' && el.min !== ''
        ? el.min
        : ''
    return min ? `El valor mínimo es ${min}.` : 'El valor es demasiado bajo.'
  }
  if (v.rangeOverflow) {
    const max =
      'max' in el && typeof el.max === 'string' && el.max !== ''
        ? el.max
        : ''
    return max ? `El valor máximo es ${max}.` : 'El valor es demasiado alto.'
  }
  if (v.stepMismatch) return 'Ingresa un valor válido.'
  return 'Revisa este campo.'
}

/** type=number permite "e" (1e3). Bloqueamos e/E/+/- en teclado. */
const BLOCKED_NUMBER_KEYS = new Set(['e', 'E', '+', '-'])

export function isBlockedNumberKey(key: string): boolean {
  return BLOCKED_NUMBER_KEYS.has(key)
}

/**
 * Quita notación científica y signos de un valor pegado/escrito.
 * Acepta coma decimal (teclado es-EC) y la normaliza a punto.
 */
export function sanitizeDecimalInput(raw: string): string {
  const cleaned = raw.replace(/,/g, '.').replace(/[^\d.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot === -1) return cleaned
  return (
    cleaned.slice(0, firstDot + 1) +
    cleaned.slice(firstDot + 1).replace(/\./g, '')
  )
}

/**
 * Valida min/max en inputs decimales renderizados como text
 * (evita que Chrome acepte "e" en type=number).
 */
export function applyDecimalRangeValidity(
  el: HTMLInputElement,
  min?: string | number,
  max?: string | number,
): void {
  el.setCustomValidity('')
  if (el.value.trim() === '') return
  const n = Number(el.value)
  if (Number.isNaN(n)) {
    el.setCustomValidity('Ingresa un número válido.')
    return
  }
  const minN = min !== undefined && min !== '' ? Number(min) : NaN
  const maxN = max !== undefined && max !== '' ? Number(max) : NaN
  if (!Number.isNaN(minN) && n < minN) {
    el.setCustomValidity(`El valor mínimo es ${min}.`)
    return
  }
  if (!Number.isNaN(maxN) && n > maxN) {
    el.setCustomValidity(`El valor máximo es ${max}.`)
  }
}

/** Asigna mensaje ES y limpia al editar. Compatible con handlers existentes. */
export function withSpanishValidityHandlers<
  T extends ValidityTarget,
  E extends { currentTarget: EventTarget & T },
>(handlers?: {
  onInvalid?: (e: E) => void
  onInput?: (e: E) => void
}) {
  return {
    onInvalid: (e: E) => {
      const el = e.currentTarget
      el.setCustomValidity(spanishValidityMessage(el))
      handlers?.onInvalid?.(e)
    },
    onInput: (e: E) => {
      e.currentTarget.setCustomValidity('')
      handlers?.onInput?.(e)
    },
  }
}

function isValidityTarget(el: EventTarget | null): el is ValidityTarget {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  )
}

/**
 * Cubre inputs nativos fuera de `<Input>`.
 * Llamar una vez al arrancar la app.
 */
export function installSpanishFormValidation(): void {
  if (typeof document === 'undefined') return
  if ((window as unknown as { __zcEsValidation?: boolean }).__zcEsValidation) {
    return
  }
  ;(window as unknown as { __zcEsValidation?: boolean }).__zcEsValidation = true

  document.addEventListener(
    'invalid',
    (e) => {
      if (!isValidityTarget(e.target)) return
      e.target.setCustomValidity(spanishValidityMessage(e.target))
    },
    true,
  )
  document.addEventListener(
    'input',
    (e) => {
      if (!isValidityTarget(e.target)) return
      e.target.setCustomValidity('')
    },
    true,
  )
  // Bloquear e/E/+/- en type=number nativos y en data-zc-decimal
  document.addEventListener(
    'keydown',
    (e) => {
      const t = e.target
      if (!(t instanceof HTMLInputElement)) return
      const isDecimal =
        t.type === 'number' || t.dataset.zcDecimal === 'true'
      if (!isDecimal) return
      if (isBlockedNumberKey(e.key)) e.preventDefault()
    },
    true,
  )
  document.addEventListener(
    'beforeinput',
    (e) => {
      const t = e.target
      if (!(t instanceof HTMLInputElement)) return
      const isDecimal =
        t.type === 'number' || t.dataset.zcDecimal === 'true'
      if (!isDecimal) return
      if (typeof e.data === 'string' && /[eE+\-]/.test(e.data)) {
        e.preventDefault()
      }
    },
    true,
  )
}
