import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MiPlanPage } from '@/features/memberships/MiPlanPage'
import { ExpiryBanner } from '@/features/memberships/components/ExpiryBanner'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { LocalRepository } from '@/data/localRepository'
import { resetRepositoryForTests } from '@/data/repository'
import { DEMO_PASSWORD, createSeedState } from '@/data/seed'
import { formatDateSpanish } from '@/lib/format'
import type { GymState } from '@/domain/models'

const STORAGE_KEY = 'reservasgym.intermedia.v2'
const DAY_MS = 24 * 60 * 60 * 1000

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString()
}

function seedState(mutate: (state: GymState) => void): void {
  const state = createSeedState()
  mutate(state)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

async function signInAsMember(): Promise<LocalRepository> {
  const repo = new LocalRepository()
  resetRepositoryForTests(repo)
  await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })
  return repo
}

function renderMiPlan() {
  return render(
    <MemoryRouter>
      <RepositoryProvider>
        <MiPlanPage />
      </RepositoryProvider>
    </MemoryRouter>,
  )
}

/**
 * QA ZCAPP-18 — Pantalla Socio «Mi Plan» e Historial de Pagos
 * DoD: plan visible, fecha fin, días restantes, historial de pagos, banner de vencimiento.
 */
describe('QA ZCAPP-18 — Mi Plan e Historial de Pagos', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  describe('Estados de la membresía en la tarjeta', () => {
    it('[ZC18-01] Membresía activa muestra plan, fecha de vencimiento y días restantes', async () => {
      const endsAt = daysFromNow(20)
      seedState((state) => {
        state.memberships[0]!.endsAt = endsAt
        state.memberships[0]!.graceEndsAt = daysFromNow(23)
      })
      await signInAsMember()

      renderMiPlan()

      expect(await screen.findByText('Mi Plan')).toBeInTheDocument()
      expect(
        screen.getByRole('heading', { level: 2, name: 'Plan Mensual Ilimitado' }),
      ).toBeInTheDocument()
      expect(screen.getByText('Membresía activa')).toBeInTheDocument()
      expect(screen.getByText('Fecha de vencimiento')).toBeInTheDocument()
      expect(screen.getByText(formatDateSpanish(endsAt))).toBeInTheDocument()
      // La vigencia vive solo en el anillo, sin duplicar el dato en texto
      expect(screen.getByLabelText('20 días restantes')).toBeInTheDocument()
    })

    it('[ZC18-02] Último día de vigencia se comunica como "Último día de acceso"', async () => {
      seedState((state) => {
        state.memberships[0]!.endsAt = daysFromNow(0.5)
        state.memberships[0]!.graceEndsAt = daysFromNow(3.5)
      })
      await signInAsMember()

      renderMiPlan()

      expect(await screen.findByLabelText('Último día de acceso')).toBeInTheDocument()
      expect(screen.getByText('Membresía activa')).toBeInTheDocument()
    })

    it('[ZC18-03] Período de gracia muestra badge y la fecha límite para renovar', async () => {
      const graceEndsAt = daysFromNow(2)
      seedState((state) => {
        state.memberships[0]!.endsAt = daysFromNow(-1)
        state.memberships[0]!.graceEndsAt = graceEndsAt
      })
      await signInAsMember()

      renderMiPlan()

      // Badge de estado en texto; el anillo cuenta los días de gracia
      expect((await screen.findAllByText('En período de gracia')).length).toBe(1)
      expect(screen.getByLabelText(/en período de gracia/i)).toBeInTheDocument()
      expect(
        screen.getByText(/Tu plan venció pero estás en período de gracia/i),
      ).toBeInTheDocument()
      expect(screen.getByText(formatDateSpanish(graceEndsAt))).toBeInTheDocument()
    })

    it('[ZC18-04] Membresía vencida muestra aviso rojo y deja de marcar el plan como actual', async () => {
      seedState((state) => {
        state.memberships[0]!.endsAt = daysFromNow(-10)
        state.memberships[0]!.graceEndsAt = daysFromNow(-7)
      })
      await signInAsMember()

      renderMiPlan()

      expect(await screen.findByText('Membresía vencida')).toBeInTheDocument()
      expect(screen.getByLabelText('Sin días restantes')).toBeInTheDocument()
      expect(screen.getByText(/Tu membresía ha expirado/i)).toBeInTheDocument()
      expect(screen.queryByText('Tu plan actual')).not.toBeInTheDocument()
    })

    it('[ZC18-05] Membresía cancelada se identifica como "Cancelada" aunque la fecha siga vigente', async () => {
      seedState((state) => {
        state.memberships[0]!.status = 'cancelled'
        state.memberships[0]!.endsAt = daysFromNow(20)
        state.memberships[0]!.graceEndsAt = daysFromNow(23)
      })
      await signInAsMember()

      renderMiPlan()

      expect(await screen.findByText('Cancelada')).toBeInTheDocument()
    })

    it('[ZC18-06] Plan con cupo de visitas muestra los pases disponibles', async () => {
      seedState((state) => {
        state.memberships[0]!.planId = 'plan-10-visitas'
        state.memberships[0]!.visitsLeft = 6
      })
      await signInAsMember()

      renderMiPlan()

      expect(await screen.findByText('Visitas disponibles')).toBeInTheDocument()
      expect(screen.getByText('6 de 10 pases')).toBeInTheDocument()
    })

    it('[ZC18-07] Socio sin membresía ve el instructivo de activación y el historial vacío', async () => {
      seedState((state) => {
        state.memberships = []
        state.payments = []
      })
      await signInAsMember()

      renderMiPlan()

      expect(await screen.findByText('Sin membresía activa')).toBeInTheDocument()
      expect(
        screen.getByRole('heading', { name: /Elige tu plan y empieza a entrenar/i }),
      ).toBeInTheDocument()
      expect(screen.queryByText(/1. Elige tu plan/i)).not.toBeInTheDocument()
      expect(
        screen.getByText(/Pagas en recepción. En cuanto registramos el pago/i),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ver planes' })).toBeInTheDocument()
      // ZC18-O1: no confundir “sin plan” con “membresía vencida”
      expect(screen.queryByText(/Membresía vencida/i)).not.toBeInTheDocument()
      expect(screen.getByText(/Sin registros de pago/i)).toBeInTheDocument()
    })
  })

  describe('Historial de pagos', () => {
    it('[ZC18-08] Lista los pagos del socio del más reciente al más antiguo', async () => {
      seedState((state) => {
        state.payments = [
          {
            id: 'pay_old',
            userId: 'user_member',
            planId: 'plan-mensual-full',
            membershipId: 'mem_demo_1',
            amountCents: 4500,
            status: 'approved',
            provider: 'manual',
            manualMethod: 'cash',
            reference: 'CAJA-ANTIGUO',
            createdAt: daysFromNow(-60),
            approvedAt: daysFromNow(-60),
          },
          {
            id: 'pay_new',
            userId: 'user_member',
            planId: 'plan-trimestral',
            membershipId: 'mem_demo_1',
            amountCents: 12000,
            status: 'approved',
            provider: 'manual',
            manualMethod: 'card_pos',
            reference: 'POS-RECIENTE',
            createdAt: daysFromNow(-1),
            approvedAt: daysFromNow(-1),
          },
        ]
      })
      await signInAsMember()

      renderMiPlan()

      const table = await screen.findByRole('table')
      const rows = within(table).getAllByRole('row').slice(1)
      expect(within(rows[0]!).getByText('POS-RECIENTE')).toBeInTheDocument()
      expect(within(rows[1]!).getByText('CAJA-ANTIGUO')).toBeInTheDocument()
    })

    it('[ZC18-09] Muestra monto, método y estado de cada comprobante', async () => {
      seedState((state) => {
        state.payments = [
          {
            id: 'pay_pending',
            userId: 'user_member',
            planId: 'plan-mensual-full',
            membershipId: 'mem_demo_1',
            amountCents: 4500,
            status: 'pending',
            provider: 'manual',
            manualMethod: 'transfer',
            reference: 'TRANSF-PEND',
            createdAt: daysFromNow(-2),
            approvedAt: null,
          },
          {
            id: 'pay_rejected',
            userId: 'user_member',
            planId: 'plan-mensual-full',
            membershipId: null,
            amountCents: 3500,
            status: 'rejected',
            provider: 'manual',
            manualMethod: 'card_pos',
            reference: 'POS-RECHAZO',
            createdAt: daysFromNow(-3),
            approvedAt: null,
          },
        ]
      })
      await signInAsMember()

      renderMiPlan()

      const table = await screen.findByRole('table')
      expect(within(table).getByText('Pendiente')).toBeInTheDocument()
      expect(within(table).getByText('Rechazado')).toBeInTheDocument()
      expect(within(table).getByText('Transferencia')).toBeInTheDocument()
      expect(within(table).getByText('Datáfono POS')).toBeInTheDocument()
      expect(within(table).getByText('$45.00')).toBeInTheDocument()
      expect(within(table).getByText('$35.00')).toBeInTheDocument()
    })

    it('[ZC18-10] El socio no ve comprobantes de otros socios', async () => {
      seedState((state) => {
        state.payments.push({
          id: 'pay_otro_socio',
          userId: 'user_member_2',
          planId: 'plan-mensual-full',
          membershipId: null,
          amountCents: 9999,
          status: 'approved',
          provider: 'manual',
          manualMethod: 'cash',
          reference: 'AJENO-0001',
          createdAt: daysFromNow(-1),
          approvedAt: daysFromNow(-1),
        })
      })
      await signInAsMember()

      renderMiPlan()

      await screen.findByText('Historial de pagos')
      expect(screen.queryByText('AJENO-0001')).not.toBeInTheDocument()
      expect(screen.queryByText('$99.99')).not.toBeInTheDocument()
    })
  })

  describe('Banner de vencimiento', () => {
    it('[ZC18-11] En gracia, el banner global avisa los días restantes para renovar', async () => {
      seedState((state) => {
        state.memberships[0]!.endsAt = daysFromNow(-1)
        state.memberships[0]!.graceEndsAt = daysFromNow(2)
      })
      await signInAsMember()

      render(
        <MemoryRouter>
          <RepositoryProvider>
            <ExpiryBanner />
            <MiPlanPage />
          </RepositoryProvider>
        </MemoryRouter>,
      )

      const banner = await screen.findByTestId('expiry-banner')
      expect(banner).toHaveAttribute('data-banner-type', 'grace')
      expect(screen.getByText(/Período de gracia:/i)).toBeInTheDocument()
    })

    /**
     * ZC18-12 / ZC18-D1 — banner y tarjeta deben usar la misma membresía vigente.
     */
    it('[ZC18-12] Con una membresía vencida antigua y otra vigente, banner y tarjeta coinciden', async () => {
      seedState((state) => {
        state.memberships = [
          {
            id: 'mem_old_expired',
            userId: 'user_member',
            planId: 'plan-mensual-full',
            status: 'expired',
            startsAt: daysFromNow(-90),
            endsAt: daysFromNow(-60),
            graceEndsAt: daysFromNow(-57),
            visitsLeft: null,
          },
          {
            id: 'mem_current_active',
            userId: 'user_member',
            planId: 'plan-mensual-full',
            status: 'active',
            startsAt: daysFromNow(-5),
            endsAt: daysFromNow(25),
            graceEndsAt: daysFromNow(28),
            visitsLeft: null,
          },
        ]
      })
      await signInAsMember()

      const { container } = render(
        <MemoryRouter>
          <RepositoryProvider>
            <ExpiryBanner />
            <MiPlanPage />
          </RepositoryProvider>
        </MemoryRouter>,
      )

      // La tarjeta reconoce la membresía vigente
      expect(await screen.findByText('Membresía activa')).toBeInTheDocument()

      // El banner global no debe contradecirla anunciando una membresía vencida
      expect(container.querySelector('[data-testid="expiry-banner"]')).toBeNull()
    })
  })
})
