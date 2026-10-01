import { beforeEach, describe, expect, it, vi } from 'vitest'

const platform = vi.hoisted(() => ({ value: 'android' }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => platform.value },
}))

const app = vi.hoisted(() => ({
  listener: null as null | ((e: { canGoBack: boolean }) => void),
  exitApp: vi.fn(async () => undefined),
}))
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (_event: string, cb: (e: { canGoBack: boolean }) => void) => {
      app.listener = cb
      return { remove: vi.fn() }
    }),
    exitApp: app.exitApp,
  },
}))

import { installAndroidBackButton } from './androidBackButton'

describe('botón atrás de Android', () => {
  beforeEach(() => {
    app.listener = null
    app.exitApp.mockClear()
    platform.value = 'android'
  })

  it('con historial navega hacia atrás (no cierra la app)', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
    await installAndroidBackButton()
    app.listener?.({ canGoBack: true })
    expect(back).toHaveBeenCalledTimes(1)
    expect(app.exitApp).not.toHaveBeenCalled()
    back.mockRestore()
  })

  it('sin historial sale de la app', async () => {
    await installAndroidBackButton()
    app.listener?.({ canGoBack: false })
    expect(app.exitApp).toHaveBeenCalledTimes(1)
  })

  it('en iOS y en la web no hace nada', async () => {
    for (const p of ['ios', 'web']) {
      platform.value = p
      await installAndroidBackButton()
    }
    expect(app.listener).toBeNull()
  })
})
