import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isBiometricsAvailable,
  isBiometricsEnabled,
  getSavedBiometricUser,
  registerBiometrics,
  authenticateWithBiometrics,
  disableBiometrics,
} from './biometrics'

function stubWebAuthn(result: Credential | null | Error) {
  vi.stubGlobal(
    'PublicKeyCredential',
    class {
      static async isUserVerifyingPlatformAuthenticatorAvailable() {
        return true
      }
    },
  )
  const get =
    result instanceof Error
      ? vi.fn().mockRejectedValue(result)
      : vi.fn().mockResolvedValue(result)
  vi.stubGlobal('navigator', {
    ...navigator,
    credentials: {
      get,
      create: vi.fn().mockResolvedValue({ type: 'public-key' }),
    },
  })
}

describe('Biometrics Authentication Helper', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports biometrics unavailable when the platform authenticator is missing', async () => {
    const available = await isBiometricsAvailable()
    expect(available).toBe(false)
  })

  it('does not enable biometrics when the device does not confirm', async () => {
    const registered = await registerBiometrics({
      id: 'user_123',
      email: 'socio.nuevo@zonacero.ec',
      fullName: 'Carlos Proaño',
    })

    expect(registered).toBe(false)
    expect(isBiometricsEnabled()).toBe(false)
    expect(getSavedBiometricUser()).toBeNull()
  })

  it('registers and retrieves biometric user credential after the device confirms', async () => {
    expect(isBiometricsEnabled()).toBe(false)
    expect(getSavedBiometricUser()).toBeNull()
    stubWebAuthn({ type: 'public-key' } as Credential)

    const mockUser = {
      id: 'user_123',
      email: 'socio.nuevo@zonacero.ec',
      fullName: 'Carlos Proaño',
    }

    const registered = await registerBiometrics(mockUser)
    expect(registered).toBe(true)
    expect(isBiometricsEnabled()).toBe(true)

    const saved = getSavedBiometricUser()
    expect(saved).not.toBeNull()
    expect(saved?.email).toBe('socio.nuevo@zonacero.ec')
    expect(saved?.fullName).toBe('Carlos Proaño')
    expect(saved?.userId).toBe('user_123')
  })

  it('authenticates with saved biometric user', async () => {
    const mockUser = {
      id: 'user_456',
      email: 'mariana.fit@zonacero.ec',
      fullName: 'Mariana Fit',
    }

    stubWebAuthn({ type: 'public-key' } as Credential)
    await registerBiometrics(mockUser)
    const authenticated = await authenticateWithBiometrics()
    expect(authenticated.userId).toBe('user_456')
    expect(authenticated.email).toBe('mariana.fit@zonacero.ec')
  })

  it('rejects biometric login when the authenticator does not confirm', async () => {
    stubWebAuthn(new Error('NotAllowedError'))
    await registerBiometrics({
      id: 'user_456',
      email: 'mariana.fit@zonacero.ec',
      fullName: 'Mariana Fit',
    })
    await expect(authenticateWithBiometrics()).rejects.toThrow(
      /no confirmó la biometría/i,
    )
  })

  it('throws error if authenticating with biometrics when not configured', async () => {
    await expect(authenticateWithBiometrics()).rejects.toThrow(
      /No hay una cuenta asociada con biometría/i,
    )
  })

  it('disables biometrics correctly', async () => {
    stubWebAuthn({ type: 'public-key' } as Credential)
    await registerBiometrics({
      id: 'user_789',
      email: 'test@zonacero.ec',
      fullName: 'Test User',
    })
    expect(isBiometricsEnabled()).toBe(true)

    disableBiometrics()
    expect(isBiometricsEnabled()).toBe(false)
    expect(getSavedBiometricUser()).toBeNull()
  })
})
