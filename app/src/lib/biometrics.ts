/**
 * Biometrics helper for Face ID / Touch ID / Fingerprint authentication.
 * A login only succeeds after the platform authenticator confirms the user.
 */

const STORAGE_KEY_BIOMETRIC_USER = 'reservasgym_biometric_user'
const STORAGE_KEY_BIOMETRIC_ENABLED = 'reservasgym_biometric_enabled'
const STORAGE_KEY_BIOMETRIC_SESSION = 'reservasgym_biometric_session'

export const BIOMETRIC_SESSION_EXPIRED_MESSAGE =
  'Tu acceso rápido venció. Entra con tu contraseña.'

export type StoredBiometricSession =
  | { kind: 'local'; userId: string }
  | { kind: 'supabase'; accessToken: string; refreshToken: string }

export interface BiometricUser {
  userId: string
  email: string
  fullName: string
  savedAt: string
}

/**
 * Checks if the platform / device supports biometric authentication (Face ID / Touch ID / Windows Hello)
 */
export async function isBiometricsAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false

  try {
    if (
      window.PublicKeyCredential &&
      typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ===
        'function'
    ) {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    }
    return false
  } catch {
    return false
  }
}

/**
 * Returns saved biometric configuration
 */
export function getSavedBiometricUser(): BiometricUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BIOMETRIC_USER)
    if (!raw) return null
    return JSON.parse(raw) as BiometricUser
  } catch {
    return null
  }
}

/**
 * Checks if biometrics is active and configured for the current device
 */
export function isBiometricsEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return (
    localStorage.getItem(STORAGE_KEY_BIOMETRIC_ENABLED) === 'true' &&
    getSavedBiometricUser() !== null
  )
}

/**
 * Registers / Enables biometrics for the specified user on this device
 */
export async function registerBiometrics(
  user: { id: string; email: string; fullName: string },
): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.credentials?.create) return false

  try {
    const challenge = new Uint8Array(32)
    crypto.getRandomValues(challenge)
    const userIdBuffer = new TextEncoder().encode(user.id)

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Zona Cero Performance Center', id: window.location.hostname },
        user: {
          id: userIdBuffer,
          name: user.email,
          displayName: user.fullName,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
      },
    })
    if (!credential) return false
  } catch {
    return false
  }

  const payload: BiometricUser = {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    savedAt: new Date().toISOString(),
  }

  localStorage.setItem(STORAGE_KEY_BIOMETRIC_USER, JSON.stringify(payload))
  localStorage.setItem(STORAGE_KEY_BIOMETRIC_ENABLED, 'true')
  return true
}

/**
 * Authenticates using Face ID / Touch ID / Fingerprint
 */
export async function authenticateWithBiometrics(): Promise<BiometricUser> {
  const saved = getSavedBiometricUser()
  if (!saved) {
    throw new Error('No hay una cuenta asociada con biometría en este dispositivo.')
  }

  if (
    typeof window === 'undefined' ||
    !window.PublicKeyCredential ||
    !navigator.credentials?.get
  ) {
    throw new Error('Este dispositivo no confirmó la biometría.')
  }

  let credential: Credential | null
  try {
    const challenge = new Uint8Array(32)
    crypto.getRandomValues(challenge)
    credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required',
      },
    })
  } catch {
    throw new Error('Este dispositivo no confirmó la biometría.')
  }

  if (!credential) {
    throw new Error('Este dispositivo no confirmó la biometría.')
  }

  return saved
}

/**
 * Disables biometrics on this device
 */
export function disableBiometrics(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY_BIOMETRIC_USER)
  localStorage.removeItem(STORAGE_KEY_BIOMETRIC_ENABLED)
  clearBiometricSession()
}

export function saveBiometricSession(session: StoredBiometricSession): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY_BIOMETRIC_SESSION, JSON.stringify(session))
}

export function readBiometricSession(): StoredBiometricSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BIOMETRIC_SESSION)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const value = parsed as Record<string, unknown>
    if (value.kind === 'local' && typeof value.userId === 'string' && value.userId) {
      return { kind: 'local', userId: value.userId }
    }
    if (
      value.kind === 'supabase' &&
      typeof value.accessToken === 'string' &&
      value.accessToken &&
      typeof value.refreshToken === 'string' &&
      value.refreshToken
    ) {
      return {
        kind: 'supabase',
        accessToken: value.accessToken,
        refreshToken: value.refreshToken,
      }
    }
    return null
  } catch {
    return null
  }
}

export function clearBiometricSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY_BIOMETRIC_SESSION)
}

/** Etiqueta del botón según el dispositivo. El diálogo lo muestra el sistema. */
export function biometricLoginLabel(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'Entrar con Face ID'
  if (/android/.test(ua)) return 'Entrar con huella'
  return 'Entrar con Face ID o huella'
}
