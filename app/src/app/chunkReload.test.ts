import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isChunkLoadError, reloadOnceForStaleChunk } from './chunkReload'

describe('chunks obsoletos tras un deploy', () => {
  it('reconoce los errores de carga de chunk vistos en producción', () => {
    expect(
      isChunkLoadError(
        new TypeError(
          'Failed to fetch dynamically imported module: https://app.zonaceroperformance.com/assets/WelcomeFichaPage-CscbvL9A.js',
        ),
      ),
    ).toBe(true)
    expect(
      isChunkLoadError(
        new TypeError(
          "'text/html' is not a valid JavaScript MIME type for module script 'https://app.zonaceroperformance.com/assets/LoginPage-CeylzHKL.js'.",
        ),
      ),
    ).toBe(true)
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true)
  })

  it('no confunde otros errores con chunks', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isChunkLoadError(null)).toBe(false)
  })

  describe('recarga única', () => {
    const reload = vi.fn()

    beforeEach(() => {
      reload.mockClear()
      window.sessionStorage.clear()
      vi.stubGlobal('location', { ...window.location, reload })
    })

    it('recarga la primera vez', () => {
      expect(reloadOnceForStaleChunk(1_000_000)).toBe(true)
      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('no vuelve a recargar dentro de la ventana (evita bucles)', () => {
      reloadOnceForStaleChunk(1_000_000)
      expect(reloadOnceForStaleChunk(1_010_000)).toBe(false)
      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('permite otra recarga pasada la ventana (un deploy posterior)', () => {
      reloadOnceForStaleChunk(1_000_000)
      expect(reloadOnceForStaleChunk(1_060_000)).toBe(true)
      expect(reload).toHaveBeenCalledTimes(2)
    })
  })
})
