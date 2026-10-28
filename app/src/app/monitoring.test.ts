import { describe, expect, it, vi } from 'vitest'
import type { ErrorEvent } from '@sentry/react'

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
}))
vi.mock('@sentry/capacitor', () => sentry)
vi.mock('@sentry/react', () => ({ init: vi.fn() }))

import { initMonitoring, isMonitoringActive, reportError, scrubEvent } from './monitoring'

describe('monitoreo de errores', () => {
  it('sin VITE_SENTRY_DSN no inicia Sentry ni reporta', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '')
    await initMonitoring()
    reportError(new Error('boom'))

    expect(isMonitoringActive()).toBe(false)
    expect(sentry.init).not.toHaveBeenCalled()
    expect(sentry.captureException).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it('quita cookies, cabeceras y correo del evento', () => {
    const event = {
      type: undefined,
      request: { url: 'https://x', cookies: { a: '1' }, headers: { Authorization: 't' } },
      user: { id: 'u1', email: 'socio@example.com', ip_address: '1.2.3.4' },
    } as ErrorEvent

    const out = scrubEvent(event)
    expect(out.request).toEqual({ url: 'https://x' })
    expect(out.user).toEqual({ id: 'u1' })
  })
})
