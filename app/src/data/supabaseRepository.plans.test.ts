import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseRepository } from './supabaseRepository'

const staffProfile = {
  id: 'staff_1',
  email: 'staff@gym.local',
  full_name: 'Recepción',
  role: 'staff',
  created_at: '2026-01-01T00:00:00.000Z',
}

const queuedRow = {
  id: 'mem_next',
  user_id: 'user_member',
  plan_id: 'plan-pro',
  status: 'active',
  starts_at: '2099-10-31T05:00:00.000Z',
  ends_at: '2099-11-30T05:00:00.000Z',
  visits_left: null,
  grace_ends_at: '2099-12-03T05:00:00.000Z',
}

const paymentRow = {
  id: 'pay_1',
  user_id: 'user_member',
  plan_id: 'plan-pro',
  membership_id: 'mem_next',
  amount_cents: 5500,
  status: 'approved',
  provider: 'manual',
  manual_method: 'cash',
  reference: null,
  notes: null,
  created_at: '2026-10-15T15:00:00.000Z',
  approved_at: '2026-10-15T15:00:00.000Z',
}

function client(rpc: ReturnType<typeof vi.fn>) {
  const writes: Array<{ table: string; op: string; payload: unknown }> = []
  const from = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {}
    const ret = () => chain
    chain.select = vi.fn(ret)
    chain.eq = vi.fn(ret)
    chain.is = vi.fn(ret)
    chain.order = vi.fn(ret)
    chain.insert = vi.fn((payload: unknown) => {
      writes.push({ table, op: 'insert', payload })
      return chain
    })
    chain.update = vi.fn((payload: unknown) => {
      writes.push({ table, op: 'update', payload })
      return chain
    })
    chain.maybeSingle = vi.fn().mockResolvedValue({
      data: table === 'profiles' ? staffProfile : null,
      error: null,
    })
    chain.single = vi.fn().mockResolvedValue({ data: paymentRow, error: null })
    return chain
  })
  const c = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: staffProfile.id } } },
        error: null,
      }),
    },
    from,
    rpc,
  } as unknown as SupabaseClient
  return { client: c, writes, from }
}

describe('SupabaseRepository reglas de planes vía RPC', () => {
  it('registerManualPayment aplica la compra con apply_plan_purchase y liga el pago', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: queuedRow, error: null })
    const { client: c, writes, from } = client(rpc)
    const repo = new SupabaseRepository(c)

    const { membership, payment } = await repo.registerManualPayment({
      userId: 'user_member',
      planId: 'plan-pro',
      amountCents: 5500,
      manualMethod: 'cash',
    })

    expect(rpc).toHaveBeenCalledWith('apply_plan_purchase', {
      p_user_id: 'user_member',
      p_plan_id: 'plan-pro',
    })
    expect(from).not.toHaveBeenCalledWith('memberships')
    expect(membership.id).toBe('mem_next')
    expect(membership.status).toBe('scheduled')
    expect(writes).toContainEqual(
      expect.objectContaining({
        table: 'payments',
        op: 'insert',
        payload: expect.objectContaining({ membership_id: 'mem_next', status: 'approved' }),
      }),
    )
    expect(payment.membershipId).toBe('mem_next')
  })

  it('si la base rechaza (plan en espera) no registra el pago', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'Ya tienes un plan en espera. Podrás comprar otro cuando empiece.' },
    })
    const { client: c, writes } = client(rpc)
    const repo = new SupabaseRepository(c)

    await expect(
      repo.registerManualPayment({
        userId: 'user_member',
        planId: 'plan-elite',
        amountCents: 7500,
        manualMethod: 'cash',
      }),
    ).rejects.toThrow(/plan en espera/)
    expect(writes).toHaveLength(0)
  })

  it('changePlanNow y refundPayment usan sus RPC', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'change_plan_now') {
        return {
          data: {
            membership: { ...queuedRow, starts_at: '2026-10-15T15:00:00.000Z' },
            payment: { ...paymentRow, notes: 'Crédito por días no usados: $16.00.' },
          },
          error: null,
        }
      }
      return { data: { ...paymentRow, status: 'refunded' }, error: null }
    })
    const { client: c } = client(rpc)
    const repo = new SupabaseRepository(c)

    const changed = await repo.changePlanNow({
      userId: 'user_member',
      planId: 'plan-pro',
      amountCents: 3900,
      manualMethod: 'card_pos',
    })
    expect(rpc).toHaveBeenCalledWith('change_plan_now', {
      p_user_id: 'user_member',
      p_plan_id: 'plan-pro',
      p_amount_cents: 3900,
      p_method: 'card_pos',
    })
    expect(changed.payment.notes).toContain('$16.00')

    const refunded = await repo.refundPayment({ paymentId: 'pay_1', cancelMembership: true })
    expect(rpc).toHaveBeenCalledWith('refund_payment', {
      p_payment_id: 'pay_1',
      p_cancel_membership: true,
    })
    expect(refunded.status).toBe('refunded')
  })
})
