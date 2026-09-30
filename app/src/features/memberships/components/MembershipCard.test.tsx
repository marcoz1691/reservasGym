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
