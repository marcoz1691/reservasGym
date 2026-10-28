/**
 * Reglas de contraseña — ZCAPP-46.
 *
 * El mínimo de 8 caracteres lo impone Supabase Auth; el resto son reglas
 * nuestras para que el socio no cree una contraseña trivial en el gimnasio.
 * Se validan en cliente para dar feedback inmediato; Supabase vuelve a
 * validar el mínimo del lado del servidor.
 */

export const PASSWORD_MIN_LENGTH = 8

/** Largo del código de recuperación que llega por correo (OTP de Supabase). */
export const RECOVERY_CODE_LENGTH = 6
/** Vigencia del código: igual que `mailer_otp_exp` (3600 s) en Supabase. */
export const RECOVERY_CODE_TTL_MS = 60 * 60 * 1000
export const RECOVERY_CODE_INVALID =
  'El código no es válido o ya venció. Pide uno nuevo.'

export type PasswordIssue =
  | 'too_short'
  | 'no_letter'
  | 'no_number'
  | 'mismatch'
  | 'empty'

export interface PasswordCheck {
  ok: boolean
  issues: PasswordIssue[]
}

const MESSAGES: Record<PasswordIssue, string> = {
  empty: 'Escribe una contraseña',
  too_short: `Usa al menos ${PASSWORD_MIN_LENGTH} caracteres`,
  no_letter: 'Incluye al menos una letra',
  no_number: 'Incluye al menos un número',
  mismatch: 'Las contraseñas no coinciden',
}

/** Mensaje en español para mostrar al usuario. */
export function passwordIssueMessage(issue: PasswordIssue): string {
  return MESSAGES[issue]
}

/**
 * Valida una contraseña nueva. Si se pasa `confirmation`, además verifica
 * que ambas coincidan.
 */
export function checkNewPassword(
  password: string,
  confirmation?: string,
): PasswordCheck {
  const issues: PasswordIssue[] = []

  if (!password) {
    issues.push('empty')
    return { ok: false, issues }
  }

  if (password.length < PASSWORD_MIN_LENGTH) issues.push('too_short')
  if (!/\p{L}/u.test(password)) issues.push('no_letter')
  if (!/\d/.test(password)) issues.push('no_number')

  if (confirmation !== undefined && password !== confirmation) {
    issues.push('mismatch')
  }

  return { ok: issues.length === 0, issues }
}

/**
 * Fuerza aproximada, solo para la barra visual. No bloquea el envío:
 * las reglas duras las decide `checkNewPassword`.
 */
export type PasswordStrength = 'debil' | 'media' | 'fuerte'

export function passwordStrength(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN_LENGTH) return 'debil'

  let score = 0
  if (password.length >= 12) score++
  if (/\p{Ll}/u.test(password) && /\p{Lu}/u.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^\p{L}\d]/u.test(password)) score++

  if (score >= 3) return 'fuerte'
  if (score >= 2) return 'media'
  return 'debil'
}
