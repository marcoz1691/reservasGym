/**
 * Datos de facturación para el pago en línea (Ecuador).
 * Pagomedios exige identificación, celular y dirección del pagador.
 */
export type BillingDocumentType = '04' | '05' | '06' | '08'

export const BILLING_DOCUMENT_TYPES: { value: BillingDocumentType; label: string }[] = [
  { value: '05', label: 'Cédula' },
  { value: '04', label: 'RUC' },
  { value: '06', label: 'Pasaporte' },
  { value: '08', label: 'Identificación del exterior' },
]

export interface BillingForm {
  documentType: BillingDocumentType
  document: string
  phone: string
  address: string
}

export type BillingErrors = Partial<Record<'document' | 'phone' | 'address', string>>

const MAX_LENGTH: Record<BillingDocumentType, number> = { '05': 10, '04': 13, '06': 20, '08': 20 }

export function isNumericDocument(type: BillingDocumentType): boolean {
  return type === '05' || type === '04'
}

/** Lo que el socio escribe: cédula y RUC solo dígitos; pasaporte letras y números. */
export function sanitizeDocument(type: BillingDocumentType, value: string): string {
  const clean = isNumericDocument(type)
    ? value.replace(/\D/g, '')
    : value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase()
  return clean.slice(0, MAX_LENGTH[type])
}

/** Celular: solo dígitos, máximo 10. */
export function sanitizePhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10)
}

/** Cédula ecuatoriana: provincia 01–24 (o 30), tercer dígito < 6 y dígito verificador módulo 10. */
export function isValidCedula(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false
  const province = Number(value.slice(0, 2))
  if (!((province >= 1 && province <= 24) || province === 30)) return false
  if (Number(value[2]) >= 6) return false
  const sum = value
    .slice(0, 9)
    .split('')
    .reduce((acc, digit, i) => {
      let n = Number(digit) * (i % 2 === 0 ? 2 : 1)
      if (n > 9) n -= 9
      return acc + n
    }, 0)
  const check = (10 - (sum % 10)) % 10
  return check === Number(value[9])
}

/** RUC: 13 dígitos, provincia válida y establecimiento distinto de 000 (persona natural: cédula + 001). */
export function isValidRuc(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false
  if (value.slice(10) === '000') return false
  const third = Number(value[2])
  if (third < 6) return isValidCedula(value.slice(0, 10))
  const province = Number(value.slice(0, 2))
  return (province >= 1 && province <= 24) || province === 30
}

/** Celular de Ecuador: 09 + 8 dígitos. */
export function isValidMobile(value: string): boolean {
  return /^09\d{8}$/.test(value)
}

export function validateBilling(form: BillingForm): BillingErrors {
  const errors: BillingErrors = {}
  const doc = form.document.trim()
  if (!doc) errors.document = 'Ingresa tu número de identificación.'
  else if (form.documentType === '05' && !isValidCedula(doc)) {
    errors.document = doc.length < 10 ? 'La cédula tiene 10 dígitos.' : 'La cédula no es válida.'
  } else if (form.documentType === '04' && !isValidRuc(doc)) {
    errors.document = doc.length < 13 ? 'El RUC tiene 13 dígitos.' : 'El RUC no es válido.'
  } else if (!isNumericDocument(form.documentType) && doc.length < 5) {
    errors.document = 'La identificación debe tener al menos 5 caracteres.'
  }

  const phone = form.phone.trim()
  if (!phone) errors.phone = 'Ingresa tu celular.'
  else if (!isValidMobile(phone)) errors.phone = 'El celular empieza con 09 y tiene 10 dígitos.'

  const address = form.address.trim()
  if (!address) errors.address = 'Ingresa tu dirección.'
  else if (address.length < 6) errors.address = 'Escribe calle y ciudad.'

  return errors
}
