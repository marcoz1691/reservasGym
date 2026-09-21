import { describe, expect, it } from 'vitest'
import { resolveSessionTemplateId } from './sessionTemplate'

const templates = [
  {
    id: 'tpl-cf-class',
    zoneId: 'zone-crossfit',
    kind: 'class' as const,
  },
  {
    id: 'tpl-gym-open',
    zoneId: 'zone-gimnasio',
    kind: 'open' as const,
  },
]

describe('resolveSessionTemplateId', () => {
  it('uses the existing template when editing a session', () => {
    expect(
      resolveSessionTemplateId(templates, 'zone-crossfit', 'class', 'tpl-cf-class'),
    ).toBe('tpl-cf-class')
  })

  it('picks the catalog template matching zone and kind instead of a fake id', () => {
    expect(resolveSessionTemplateId(templates, 'zone-crossfit', 'class')).toBe(
      'tpl-cf-class',
    )
  })

  it('falls back to any template of the zone when kind does not match', () => {
    expect(resolveSessionTemplateId(templates, 'zone-gimnasio', 'class')).toBe(
      'tpl-gym-open',
    )
  })

  it('throws if the catalog has no template for the zone', () => {
    expect(() =>
      resolveSessionTemplateId(templates, 'zone-hyrox', 'class'),
    ).toThrow(/plantilla/i)
  })
})
