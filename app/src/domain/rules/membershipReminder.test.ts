import { describe, expect, it } from 'vitest'
import { buildMembershipReminderUrl } from './membershipReminder'

const base = {
  phone: '0991234567',
  memberName: 'Ana Pérez',
  gymName: 'Zona Cero',
  planName: 'Mensual',
  endsOn: '20 oct 2026',
  status: 'active' as const,
}

function textOf(url: string | null): string {
  return decodeURIComponent((url ?? '').split('?text=')[1] ?? '')
}

describe('buildMembershipReminderUrl', () => {
  it('arma el enlace con el celular en formato internacional', () => {
    const url = buildMembershipReminderUrl(base)
    expect(url?.startsWith('https://wa.me/593991234567?text=')).toBe(true)
  })

  it('saluda por el primer nombre e indica plan, fecha y cómo renovar en la app', () => {
    const text = textOf(buildMembershipReminderUrl(base))
    expect(text).toContain('Hola Ana')
    expect(text).toContain('Zona Cero')
    expect(text).toContain('tu membresía Mensual vence el 20 oct 2026')
    expect(text).toContain('entra a la app')
    expect(text).not.toContain('http')
  })

  it('distingue gracia y vencida', () => {
    expect(textOf(buildMembershipReminderUrl({ ...base, status: 'grace' }))).toContain(
      'periodo de gracia',
    )
    expect(textOf(buildMembershipReminderUrl({ ...base, status: 'expired' }))).toContain(
      'venció el 20 oct 2026.',
    )
  })

  it('devuelve null si no hay celular válido', () => {
    expect(buildMembershipReminderUrl({ ...base, phone: undefined })).toBeNull()
    expect(buildMembershipReminderUrl({ ...base, phone: '123' })).toBeNull()
  })
})
