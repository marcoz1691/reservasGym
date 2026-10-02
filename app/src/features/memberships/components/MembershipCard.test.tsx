import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MembershipCard } from './MembershipCard'
import type { Membership, MembershipPlan, Zone } from '@/domain/models'

const mockZones: Zone[] = [
  {
    id: 'zone_gimnasio',
    name: 'Gimnasio',
    type: 'gimnasio',
    description: 'Sala de pesas y musculación',
    defaultCapacity: 30,
    imageHint: 'floor',
  },
  {
    id: 'zone-dragon-fit',
    name: 'Dragon Fit',
    type: 'dragon_fit',
    description: 'Entrenamiento funcional de alta intensidad',
    defaultCapacity: 20,
    imageHint: 'dragon-fit',
  },
]

// Fechas relativas a hoy: con fechas fijas la membresía "activa" vence sola.
const DAY = 24 * 60 * 60 * 1000
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY).toISOString()

describe('MembershipCard', () => {
  it('renders active membership with full access chip and price', () => {
    const membership: Membership = {
      id: 'mem_1',
      userId: 'user_1',
      planId: 'plan_full',
      status: 'active',
      startsAt: daysFromNow(-30),
      endsAt: daysFromNow(30),
      visitsLeft: null,
      graceEndsAt: daysFromNow(33),
    }

    const plan: MembershipPlan = {
      id: 'plan_full',
      name: 'Plan Mensual Ilimitado',
      priceCents: 4500,
      durationDays: 30,
      visitQuota: null,
      allowedZoneIds: [],
      active: true,
    }

    render(<MembershipCard membership={membership} plan={plan} zones={mockZones} />)

    expect(screen.getByText('Plan Mensual Ilimitado')).toBeInTheDocument()
    expect(screen.getByText('Membresía activa')).toBeInTheDocument()
    expect(screen.getByText(/Acceso Total a todas las áreas y disciplinas/i)).toBeInTheDocument()
    expect(screen.getByText('$45.00')).toBeInTheDocument()
  })

  it('muestra el próximo plan con su fecha de inicio y los pases del día activos', () => {
    const membership: Membership = {
      id: 'mem_1',
      userId: 'user_1',
      planId: 'plan_full',
      status: 'active',
      startsAt: daysFromNow(-25),
      endsAt: daysFromNow(5),
      visitsLeft: null,
      graceEndsAt: daysFromNow(8),
    }
    const plan: MembershipPlan = {
      id: 'plan_full',
      name: 'Zero Start Mensual',
      priceCents: 3000,
      durationDays: 30,
      visitQuota: null,
      allowedZoneIds: [],
      active: true,
    }
    const nextPlan: MembershipPlan = { ...plan, id: 'plan_next', name: 'Zero Pro Mensual' }
    const passPlan: MembershipPlan = {
      ...plan,
      id: 'plan_day',
      name: 'Zona Day Full',
      durationDays: 1,
      kind: 'day_pass',
    }

    render(
      <MembershipCard
        membership={membership}
        plan={plan}
        zones={mockZones}
        onRenew={() => undefined}
        queued={{
          membership: { ...membership, id: 'mem_2', planId: 'plan_next', startsAt: membership.endsAt },
          plan: nextPlan,
        }}
        dayPasses={[
          {
            membership: {
              ...membership,
              id: 'mem_3',
              planId: 'plan_day',
              endsAt: '2026-10-15T23:59:59.000-05:00',
            },
            plan: passPlan,
          },
        ]}
      />,
    )

    expect(screen.getByText(/Próximo plan:/).parentElement).toHaveTextContent(
      /Zero Pro Mensual, empieza el/,
    )
    expect(screen.getByText(/Pase del día activo:/).parentElement).toHaveTextContent(
      'Pase del día activo: Zona Day Full, válido hasta las 23:59',
    )
    // Con el próximo plan ya pagado no se insiste en renovar
    expect(screen.queryByRole('button', { name: /Renovar plan/ })).not.toBeInTheDocument()
  })

  it('renders grace period status with warning notice', () => {
    const membership: Membership = {
      id: 'mem_grace',
      userId: 'user_1',
      planId: 'plan_full',
      status: 'active',
      startsAt: daysFromNow(-35),
      endsAt: daysFromNow(-1),
      visitsLeft: null,
      graceEndsAt: daysFromNow(2)
    }

    const plan: MembershipPlan = {
      id: 'plan_full',
      name: 'Plan Mensual Ilimitado',
      priceCents: 4500,
      durationDays: 30,
      visitQuota: null,
      allowedZoneIds: [],
      active: true,
    }

    render(<MembershipCard membership={membership} plan={plan} zones={mockZones} />)

    expect(screen.getAllByText('En período de gracia').length).toBeGreaterThan(0)
    expect(
      screen.getByText(/Tu plan venció pero estás en período de gracia/i),
    ).toBeInTheDocument()
  })

  it('renders visits left quota and specific zone chips', () => {
    const membership: Membership = {
      id: 'mem_quota',
      userId: 'user_1',
      planId: 'plan_df',
      status: 'active',
      startsAt: daysFromNow(-30),
      endsAt: daysFromNow(30),
      visitsLeft: 7,
      graceEndsAt: daysFromNow(33),
    }

    const plan: MembershipPlan = {
      id: 'plan_df',
      name: 'Dragon Fit 10 Pases',
      priceCents: 5000,
      durationDays: 60,
      visitQuota: 10,
      allowedZoneIds: ['zone-dragon-fit', 'zone_gimnasio'],
      active: true,
    }

    render(<MembershipCard membership={membership} plan={plan} zones={mockZones} />)

    expect(screen.getByText('Dragon Fit 10 Pases')).toBeInTheDocument()
    expect(screen.getByText('7 de 10 pases')).toBeInTheDocument()
    expect(screen.getByText('Dragon Fit')).toBeInTheDocument()
    expect(screen.getByText('Gimnasio')).toBeInTheDocument()
  })
})
