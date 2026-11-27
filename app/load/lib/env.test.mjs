// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { PROD_REF, ALLOWLIST_MAX_AGE_MS, allowlistHash, checkAllowlist, realUsersOf } from './env.mjs'

const NOW = Date.parse('2026-11-13T23:00:00Z')
const testers = [
  { id: 'bbbbbbbb-0000-4000-8000-000000000002', email: 'Tester2@Gmail.com' },
  { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'tester1@gmail.com' },
]
const loadUsers = [
  { id: 'cccccccc-0000-4000-8000-000000000003', email: 'load.0001@zonacero.test' },
  { id: 'dddddddd-0000-4000-8000-000000000004', email: 'load.staff@zonacero.test' },
]

function lista(users = testers, extra = {}) {
  return { project_ref: PROD_REF, generated_at: new Date(NOW - 60_000).toISOString(), users: realUsersOf(users), ...extra }
}
const aprobado = allowlistHash(realUsersOf(testers))
const real = (users) => realUsersOf(users)

describe('lista blanca de usuarios reales en prod', () => {
  it('realUsersOf excluye usuarios de carga y normaliza el email', () => {
    expect(realUsersOf([...testers, ...loadUsers])).toEqual([
      { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'tester1@gmail.com' },
      { id: 'bbbbbbbb-0000-4000-8000-000000000002', email: 'tester2@gmail.com' },
    ])
  })

  it('sin usuarios reales pasa aunque no haya lista', () => {
    expect(checkAllowlist({ real: [], allowlist: null, approvedHash: undefined, now: NOW })).toEqual({ ok: true })
  })

  it('pasa con la lista exacta y el hash aprobado', () => {
    const r = checkAllowlist({ real: real([...testers, ...loadUsers]), allowlist: lista(), approvedHash: aprobado, now: NOW })
    expect(r).toEqual({ ok: true })
  })

  it('aborta si hay usuarios reales y no existe la lista', () => {
    const r = checkAllowlist({ real: real(testers), allowlist: null, approvedHash: aprobado, now: NOW })
    expect(r.ok).toBe(false)
  })

  it('aborta si falta el hash aprobado o no coincide', () => {
    expect(checkAllowlist({ real: real(testers), allowlist: lista(), approvedHash: undefined, now: NOW }).ok).toBe(false)
    expect(checkAllowlist({ real: real(testers), allowlist: lista(), approvedHash: 'f'.repeat(64), now: NOW }).ok).toBe(false)
  })

  it('aborta si alguien editó la lista después de aprobarla', () => {
    const editada = lista([...testers, { id: 'eeeeeeee-0000-4000-8000-000000000005', email: 'intruso@gmail.com' }])
    const r = checkAllowlist({ real: real(testers), allowlist: editada, approvedHash: aprobado, now: NOW })
    expect(r.ok).toBe(false)
  })

  it('aborta si aparece un usuario real nuevo fuera de la lista', () => {
    const nuevo = { id: 'ffffffff-0000-4000-8000-000000000006', email: 'nuevo@gmail.com' }
    const r = checkAllowlist({ real: real([...testers, nuevo]), allowlist: lista(), approvedHash: aprobado, now: NOW })
    expect(r).toMatchObject({ ok: false })
    expect(r.reason).toContain(nuevo.id)
  })

  it('aborta si un usuario de la lista ya no existe', () => {
    const r = checkAllowlist({ real: real([testers[0]]), allowlist: lista(), approvedHash: aprobado, now: NOW })
    expect(r.ok).toBe(false)
  })

  it('aborta si cambió el email de un usuario aprobado', () => {
    const cambiado = [{ ...testers[0], email: 'otro@gmail.com' }, testers[1]]
    const r = checkAllowlist({ real: real(cambiado), allowlist: lista(), approvedHash: aprobado, now: NOW })
    expect(r.ok).toBe(false)
  })

  it('aborta si la lista es de otro proyecto o tiene más de 24 h', () => {
    expect(checkAllowlist({ real: real(testers), allowlist: lista(testers, { project_ref: 'otro' }), approvedHash: aprobado, now: NOW }).ok).toBe(false)
    const vieja = lista(testers, { generated_at: new Date(NOW - ALLOWLIST_MAX_AGE_MS - 1000).toISOString() })
    expect(checkAllowlist({ real: real(testers), allowlist: vieja, approvedHash: aprobado, now: NOW }).ok).toBe(false)
  })
})
