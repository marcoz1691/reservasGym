import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CobrosPage } from '@/features/admin/CobrosPage'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { LocalRepository } from '@/data/localRepository'
import { resetRepositoryForTests } from '@/data/repository'
import { DEMO_PASSWORD, createSeedState } from '@/data/seed'
import type { GymState } from '@/domain/models'

const STORAGE_KEY = 'reservasgym.intermedia.v2'
const DAY_MS = 24 * 60 * 60 * 1000

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString()
}

/** Writes a customised seed state so the repository boots with it. */
function seedState(mutate: (state: GymState) => void): void {
  const state = createSeedState()
  mutate(state)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function renderCobros() {
  return render(
    <RepositoryProvider>
      <MemoryRouter initialEntries={['/admin/cobros']}>
        <Routes>
          <Route path="/admin/cobros" element={<CobrosPage />} />
        </Routes>
      </MemoryRouter>
    </RepositoryProvider>,
  )
}

/**
 * QA ZCAPP-17 — Panel de Cobros Recepción (Datafast POS)
 * DoD: buscar socio, registrar cobro manual, sync offline-first.
 */
describe('QA ZCAPP-17 — Panel de Cobros Recepción', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  describe('Registro de cobro por método de pago', () => {
    it('[ZC17-01] Efectivo: staff cobra y activa membresía de un socio sin plan', async () => {
      const repo = new LocalRepository()
      resetRepositoryForTests(repo)
      await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

      const before = await repo.getMemberMembership('user_member_2')
      expect(before).toBeNull()

      const { payment, membership } = await repo.registerManualPayment({
        userId: 'user_member_2',
        planId: 'plan-mensual-full',
        amountCents: 4500,
        manualMethod: 'cash',
        reference: 'CAJA-001',
      })

      expect(payment.status).toBe('approved')
      expect(payment.provider).toBe('manual')
      expect(payment.manualMethod).toBe('cash')
      expect(payment.membershipId).toBe(membership.id)
      expect(membership.status).toBe('active')

      const endsInDays = (new Date(membership.endsAt).getTime() - Date.now()) / DAY_MS
      expect(endsInDays).toBeGreaterThan(29.9)
      expect(endsInDays).toBeLessThan(30.1)
    })

    it('[ZC17-02] Transferencia: el cobro guarda la referencia bancaria', async () => {
      const repo = new LocalRepository()
      resetRepositoryForTests(repo)
      await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

      const { payment } = await repo.registerManualPayment({
        userId: 'user_member_2',
        planId: 'plan-trimestral',
        amountCents: 12000,
        manualMethod: 'transfer',
        reference: 'TRANSF-99812',
      })

      expect(payment.manualMethod).toBe('transfer')
      expect(payment.reference).toBe('TRANSF-99812')
      expect(payment.amountCents).toBe(12000)
    })

    it('[ZC17-03] Datafast POS: el cobro guarda el voucher y queda aprobado', async () => {
      const repo = new LocalRepository()
      resetRepositoryForTests(repo)
      await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })

      const { payment } = await repo.registerManualPayment({
        userId: 'user_member_2',
        planId: 'plan-mensual-full',
        amountCents: 4500,
        manualMethod: 'card_pos',
        reference: 'POS-TX-4471',
      })

      expect(payment.manualMethod).toBe('card_pos')
      expect(payment.reference).toBe('POS-TX-4471')
      expect(payment.approvedAt).not.toBeNull()
    })

    it('[ZC17-04] Cobro sin referencia guarda referencia nula, no cadena vacía', async () => {
      const repo = new LocalRepository()
      resetRepositoryForTests(repo)
      await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

      const { payment } = await repo.registerManualPayment({
        userId: 'user_member_2',
        planId: 'plan-mensual-full',
        amountCents: 4500,
        manualMethod: 'cash',
      })

      expect(payment.reference).toBeNull()
    })
  })

  describe('Extensión de membresía al cobrar', () => {
    it('[ZC17-05] Socio vigente: la renovación acumula días desde la fecha fin, no desde el pago', async () => {
      const repo = new LocalRepository()
      resetRepositoryForTests(repo)
      await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

      // Socio demo vigente: vence en 20 días
      const current = await repo.getMemberMembership('user_member')
      const currentEndsMs = new Date(current!.endsAt).getTime()

      const { membership } = await repo.registerManualPayment({
        userId: 'user_member',
        planId: 'plan-mensual-full',
        amountCents: 4500,
        manualMethod: 'cash',
      })

      const newEndsMs = new Date(membership.endsAt).getTime()
      expect(Math.round((newEndsMs - currentEndsMs) / DAY_MS)).toBe(30)

      const graceGap = new Date(membership.graceEndsAt!).getTime() - newEndsMs
      expect(Math.round(graceGap / DAY_MS)).toBe(3)
    })

    it('[ZC17-06] Socio en gracia: la renovación reinicia la vigencia desde la fecha de pago', async () => {
      seedState((state) => {
        state.memberships.push({
          id: 'mem_grace_qa',
          userId: 'user_member_2',
          planId: 'plan-mensual-full',
          status: 'active',
          startsAt: daysFromNow(-31),
          endsAt: daysFromNow(-1),
          graceEndsAt: daysFromNow(2),
          visitsLeft: null,
        })
      })

      const repo = new LocalRepository()
      resetRepositoryForTests(repo)
      await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

      const { membership } = await repo.registerManualPayment({
        userId: 'user_member_2',
        planId: 'plan-mensual-full',
        amountCents: 4500,
        manualMethod: 'card_pos',
      })

      // No debe apilar sobre la fecha vencida: arranca desde hoy
      const endsInDays = (new Date(membership.endsAt).getTime() - Date.now()) / DAY_MS
      expect(endsInDays).toBeGreaterThan(29.9)
      expect(endsInDays).toBeLessThan(30.1)
      expect(membership.status).toBe('active')
      expect(membership.id).toBe('mem_grace_qa')
    })

    it('[ZC17-07] Plan con cupo: renovar a un socio vigente acumula los pases restantes', async () => {
      seedState((state) => {
        state.memberships.push({
          id: 'mem_quota_qa',
          userId: 'user_member_2',
          planId: 'plan-10-visitas',
          status: 'active',
          startsAt: daysFromNow(-10),
          endsAt: daysFromNow(20),
          graceEndsAt: daysFromNow(23),
          visitsLeft: 4,
        })
      })

      const repo = new LocalRepository()
      resetRepositoryForTests(repo)
      await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

      const { membership } = await repo.registerManualPayment({
        userId: 'user_member_2',
        planId: 'plan-10-visitas',
        amountCents: 3500,
        manualMethod: 'cash',
      })

      expect(membership.visitsLeft).toBe(14)
    })
  })

  describe('Permisos y validaciones de backend', () => {
    it('[ZC17-08] Un socio no puede registrar cobros', async () => {
      const repo = new LocalRepository()
      resetRepositoryForTests(repo)
      await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })

      await expect(
        repo.registerManualPayment({
          userId: 'user_member',
          planId: 'plan-mensual-full',
          amountCents: 4500,
          manualMethod: 'cash',
        }),
      ).rejects.toThrow(/sin permiso/i)
    })

    it('[ZC17-09] Cobro contra un plan inexistente es rechazado', async () => {
      const repo = new LocalRepository()
      resetRepositoryForTests(repo)
      await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

      await expect(
        repo.registerManualPayment({
          userId: 'user_member_2',
          planId: 'plan-inexistente',
          amountCents: 4500,
          manualMethod: 'cash',
        }),
      ).rejects.toThrow(/plan no encontrado/i)
    })

    it('[ZC17-10] Offline-first: el cobro sobrevive a recargar la aplicación', async () => {
      const repo = new LocalRepository()
      resetRepositoryForTests(repo)
      await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

      const { payment } = await repo.registerManualPayment({
        userId: 'user_member_2',
        planId: 'plan-mensual-full',
        amountCents: 4500,
        manualMethod: 'transfer',
        reference: 'OFFLINE-001',
      })

      // Simula refresh del navegador: nueva instancia lee de localStorage
      const reloaded = new LocalRepository()
      await reloaded.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

      const payments = await reloaded.listPayments()
      expect(payments.some((p) => p.id === payment.id)).toBe(true)

      const membership = await reloaded.getMemberMembership('user_member_2')
      expect(membership?.status).toBe('active')
    })
  })

  describe('Panel de recepción (UI)', () => {
    it('[ZC17-11] Staff cobra en efectivo y obtiene el recibo con monto y medio de cobro', async () => {
      const user = userEvent.setup()
      const repo = new LocalRepository()
      resetRepositoryForTests(repo)
      await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

      renderCobros()

      await user.click(await screen.findByText('Luis Pérez'))
      await user.click(screen.getAllByText(/Plan Mensual Ilimitado/i)[0]!)
      await user.click(screen.getByText('Efectivo'))
      await user.type(screen.getByLabelText(/Referencia \/ # Voucher/i), 'CAJA-QA-01')
      await user.click(
        screen.getByRole('button', { name: /Confirmar Cobro y Activar Membresía/i }),
      )

      expect(
        await screen.findByText(/¡Cobro Registrado y Membresía Activada!/i),
      ).toBeInTheDocument()
      expect(screen.getByText(/Ref: CAJA-QA-01/)).toBeInTheDocument()
      expect(screen.getAllByText('Efectivo').length).toBeGreaterThan(0)
      expect(screen.getAllByText(/\$45\.00 USD/i).length).toBeGreaterThan(0)
    })

    it('[ZC17-12] Renovación rápida desde "Socios por Vencer" precarga el POS y completa el cobro', async () => {
      seedState((state) => {
        state.memberships.push({
          id: 'mem_warn_qa',
          userId: 'user_member_2',
          planId: 'plan-mensual-full',
          status: 'active',
          startsAt: daysFromNow(-28),
          endsAt: daysFromNow(2),
          graceEndsAt: daysFromNow(5),
          visitsLeft: null,
        })
      })

      const user = userEvent.setup()
      const repo = new LocalRepository()
      resetRepositoryForTests(repo)
      await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

      renderCobros()

      await user.click(await screen.findByText(/Socios por Vencer y Vencidos/i))
      await user.click(await screen.findByRole('button', { name: /Cobrar Renovación/i }))

      // Vuelve al POS con socio y monto precargados
      expect(await screen.findByText(/Cambiar socio/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Monto a Cobrar \(USD\)/i)).toHaveValue('45.00')

      await user.click(
        screen.getByRole('button', { name: /Confirmar Cobro y Activar Membresía/i }),
      )

      expect(
        await screen.findByText(/¡Cobro Registrado y Membresía Activada!/i),
      ).toBeInTheDocument()
    })

    it('[ZC17-13] La búsqueda de socio por correo ignora mayúsculas y minúsculas', async () => {
      const user = userEvent.setup()
      const repo = new LocalRepository()
      resetRepositoryForTests(repo)
      await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

      renderCobros()

      await screen.findByText('Ana Socio')
      await user.type(
        screen.getByPlaceholderText(/Buscar por nombre o correo electrónico/i),
        'LUIS@GYM.LOCAL',
      )

      expect(screen.getByText('Luis Pérez')).toBeInTheDocument()
      expect(screen.queryByText('Ana Socio')).not.toBeInTheDocument()
    })

    it('[ZC17-14] No se puede cobrar sin socio, sin plan ni con monto en cero', async () => {
      const user = userEvent.setup()
      const repo = new LocalRepository()
      resetRepositoryForTests(repo)
      await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

      renderCobros()

      await screen.findByText('Luis Pérez')
      const submit = () =>
        screen.getByRole('button', { name: /Confirmar Cobro y Activar Membresía/i })

      // Sin socio ni plan el cobro no está habilitado
      expect(submit()).toBeDisabled()

      // Luis Pérez no tiene plan previo: sigue faltando elegir plan
      await user.click(screen.getByText('Luis Pérez'))
      expect(submit()).toBeDisabled()

      await user.click(screen.getAllByText(/Plan Mensual Ilimitado/i)[0]!)
      expect(submit()).toBeEnabled()

      // Monto en cero: el campo queda inválido y no se registra el cobro
      const amount = screen.getByLabelText(/Monto a Cobrar \(USD\)/i)
      await user.clear(amount)
      await user.type(amount, '0')
      await user.click(submit())

      expect(amount).toBeInvalid()
      expect(
        screen.queryByText(/¡Cobro Registrado y Membresía Activada!/i),
      ).toBeNull()
    })

    it('[ZC17-16] Elegir un socio con plan previo precarga ese plan y su precio', async () => {
      const user = userEvent.setup()
      const repo = new LocalRepository()
      resetRepositoryForTests(repo)
      await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

      renderCobros()

      // Ana Socio ya tiene Plan Mensual Ilimitado ($45.00) vigente
      await user.click(await screen.findByText('Ana Socio'))

      expect(screen.getByLabelText(/Monto a Cobrar \(USD\)/i)).toHaveValue('45.00')
      expect(
        screen.getByRole('button', { name: /Confirmar Cobro y Activar Membresía/i }),
      ).toBeEnabled()
    })

    it('[ZC17-15] El historial refleja el cobro recién registrado con su método', async () => {
      const user = userEvent.setup()
      const repo = new LocalRepository()
      resetRepositoryForTests(repo)
      await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })
      await repo.registerManualPayment({
        userId: 'user_member_2',
        planId: 'plan-trimestral',
        amountCents: 12000,
        manualMethod: 'card_pos',
        reference: 'POS-HIST-77',
      })

      renderCobros()

      await user.click(await screen.findByText(/Historial General de Cobros/i))

      expect(await screen.findByText('POS-HIST-77')).toBeInTheDocument()
      expect(screen.getAllByText(/\$120\.00/).length).toBeGreaterThan(0)
    })

    it('[ZC17-17] Una solicitud de Deuna muestra su etiqueta y su referencia, y el cobro la conserva', async () => {
      const user = userEvent.setup()
      const member = new LocalRepository()
      await member.signIn({ email: 'luis@gym.local', password: DEMO_PASSWORD })
      await member.requestPlanPayment({
        planId: 'plan-mensual-full',
        manualMethod: 'deuna',
        reference: 'ZC-4F7A2C',
      })

      const repo = new LocalRepository()
      resetRepositoryForTests(repo)
      await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })
      renderCobros()

      const request = (await screen.findByRole('heading', { name: 'Solicitudes de socios' }))
        .closest('div')!
        .querySelector('button')!
      expect(request).toHaveTextContent('Luis Pérez')
      expect(request).toHaveTextContent('Plan Mensual Ilimitado · Deuna')
      expect(request).toHaveTextContent('Ref. ZC-4F7A2C')

      await user.click(request)
      expect(screen.getByRole('button', { name: /^Deuna/ })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByLabelText(/Referencia \/ # Voucher/i)).toHaveValue('ZC-4F7A2C')
      await user.click(
        screen.getByRole('button', { name: /Confirmar Cobro y Activar Membresía/i }),
      )

      expect(
        await screen.findByText(/¡Cobro Registrado y Membresía Activada!/i),
      ).toBeInTheDocument()
      const [payment] = (await repo.listPayments()).filter((p) => p.userId === 'user_member_2')
      expect(payment).toMatchObject({
        status: 'approved',
        manualMethod: 'deuna',
        reference: 'ZC-4F7A2C',
      })
    })

    it('[ZC17-18] El historial suma Deuna aparte y la filtra', async () => {
      const user = userEvent.setup()
      const repo = new LocalRepository()
      resetRepositoryForTests(repo)
      await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })
      await repo.registerManualPayment({
        userId: 'user_member_2',
        planId: 'plan-trimestral',
        amountCents: 12000,
        manualMethod: 'deuna',
        reference: 'ZC-ABC123',
      })

      renderCobros()
      await user.click(await screen.findByText(/Historial General de Cobros/i))

      const deunaMetric = (await screen.findByText('QR o código Deuna')).parentElement!
      expect(deunaMetric).toHaveTextContent('$120.00 USD')

      await user.click(screen.getByRole('button', { name: 'Deuna' }))
      expect(screen.getByRole('button', { name: 'Deuna' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByText('ZC-ABC123')).toBeInTheDocument()
      expect(screen.queryByText('TRANSF-00129')).toBeNull()
    })
  })
})
