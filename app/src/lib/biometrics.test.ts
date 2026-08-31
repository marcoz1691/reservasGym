import { describe, it, expect, beforeEach } from 'vitest'
import {
  isBiometricsAvailable,
  isBiometricsEnabled,
  getSavedBiometricUser,
  registerBiometrics,
  authenticateWithBiometrics,
  disableBiometrics,
} from './biometrics'

describe('Biometrics Authentication Helper', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('detects biometrics capability safely', async () => {
    const available = await isBiometricsAvailable()
    expect(available).toBe(true)
  })

  it('registers and retrieves biometric user credential', async () => {
    expect(isBiometricsEnabled()).toBe(false)
    expect(getSavedBiometricUser()).toBeNull()

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

    await registerBiometrics(mockUser)
    const authenticated = await authenticateWithBiometrics()
    expect(authenticated.userId).toBe('user_456')
    expect(authenticated.email).toBe('mariana.fit@zonacero.ec')
  })

  it('throws error if authenticating with biometrics when not configured', async () => {
    await expect(authenticateWithBiometrics()).rejects.toThrow(
      /No hay una cuenta asociada con biometría/i,
    )
  })

  it('disables biometrics correctly', async () => {
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
