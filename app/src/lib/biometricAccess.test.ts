import { describe, expect, it } from 'vitest'
import { isBiometricAccessEnabled } from './biometricAccess'

describe('isBiometricAccessEnabled', () => {
  it('queda apagada por defecto (contrato y QA)', () => {
    expect(isBiometricAccessEnabled()).toBe(false)
  })

  it('queda apagada en staging aunque el extra esté encendido', () => {
    expect(
      isBiometricAccessEnabled({ MODE: 'staging', VITE_BIOMETRICS: '1' }),
    ).toBe(false)
  })

  it('solo se enciende con VITE_BIOMETRICS=1 fuera de QA', () => {
    expect(
      isBiometricAccessEnabled({ MODE: 'production', VITE_BIOMETRICS: '1' }),
    ).toBe(true)
  })
})
