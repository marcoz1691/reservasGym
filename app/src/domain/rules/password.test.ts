import { describe, expect, it } from 'vitest'
import {
  PASSWORD_MIN_LENGTH,
  checkNewPassword,
  passwordIssueMessage,
  passwordStrength,
} from './password'

describe('checkNewPassword', () => {
  it('acepta una contraseña con letras, números y largo suficiente', () => {
    expect(checkNewPassword('ZonaCero2026')).toEqual({ ok: true, issues: [] })
  })

  it('rechaza vacía sin acumular otros errores', () => {
    const r = checkNewPassword('')
    expect(r.ok).toBe(false)
    expect(r.issues).toEqual(['empty'])
  })

  it(`rechaza si tiene menos de ${PASSWORD_MIN_LENGTH} caracteres`, () => {
    expect(checkNewPassword('Zc2026').issues).toContain('too_short')
  })

  it('acepta exactamente el mínimo', () => {
    expect(checkNewPassword('Zona2026').ok).toBe(true)
  })

  it('rechaza si no tiene números', () => {
    expect(checkNewPassword('ZonaCeroGym').issues).toContain('no_number')
  })

  it('rechaza si no tiene letras', () => {
    expect(checkNewPassword('20262026').issues).toContain('no_letter')
  })

  it('acepta letras acentuadas y ñ como letra', () => {
    expect(checkNewPassword('contraseña1').ok).toBe(true)
  })

  it('acumula varios problemas a la vez', () => {
    const r = checkNewPassword('abc')
    expect(r.ok).toBe(false)
    expect(r.issues).toContain('too_short')
    expect(r.issues).toContain('no_number')
  })

  it('detecta que la confirmación no coincide', () => {
    const r = checkNewPassword('ZonaCero2026', 'ZonaCero2027')
    expect(r.ok).toBe(false)
    expect(r.issues).toContain('mismatch')
  })

  it('pasa cuando la confirmación coincide', () => {
    expect(checkNewPassword('ZonaCero2026', 'ZonaCero2026').ok).toBe(true)
  })

  it('sin confirmación no reporta mismatch', () => {
    expect(checkNewPassword('ZonaCero2026').issues).not.toContain('mismatch')
  })

  it('trata la confirmación vacía como distinta, no como ausente', () => {
    expect(checkNewPassword('ZonaCero2026', '').issues).toContain('mismatch')
  })
})

describe('passwordIssueMessage', () => {
  it('devuelve mensaje en español para cada problema', () => {
    expect(passwordIssueMessage('too_short')).toContain('8')
    expect(passwordIssueMessage('mismatch')).toBe('Las contraseñas no coinciden')
    expect(passwordIssueMessage('no_number')).toContain('número')
  })
})

describe('passwordStrength', () => {
  it('es débil si no llega al mínimo, aunque sea compleja', () => {
    expect(passwordStrength('aB3$')).toBe('debil')
  })

  it('es débil si solo cumple el mínimo con minúsculas', () => {
    expect(passwordStrength('zonacero')).toBe('debil')
  })

  it('sube a media al combinar mayúsculas y números', () => {
    expect(passwordStrength('ZonaCer1')).toBe('media')
  })

  it('es fuerte con largo, mezcla de mayúsculas, números y símbolo', () => {
    expect(passwordStrength('ZonaCero2026!')).toBe('fuerte')
  })
})
