import { describe, expect, it } from 'vitest'
import { ZONA_CERO_DISCIPLINES } from './disciplines'

describe('ZONA_CERO_DISCIPLINES visual', () => {
  it('usa solo tono de marca, no paleta arcoíris por disciplina', () => {
    for (const meta of Object.values(ZONA_CERO_DISCIPLINES)) {
      expect(meta.colorClass).toMatch(/text-(acc|ink)/)
      expect(meta.colorClass).not.toMatch(
        /emerald|pink|cyan|lime|orange|amber|teal|red-400|slate-400/,
      )
      expect(meta.bgLightClass).toMatch(/bg-(acc|surface|bg)/)
      expect(meta.tone).toBe('neutral')
    }
  })
})
