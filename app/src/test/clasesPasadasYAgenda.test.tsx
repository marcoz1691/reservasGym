import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { resetRepositoryForTests } from '@/data/repository'
import { createMockRepo } from '@/test/mockRepo'
import type { Booking, Membership, MembershipPlan, Session, User, Zone } from '@/domain/models'
import {
  bookingStatusLabel,
  isActiveBooking,
  selectActiveBookings,
} from '@/domain/rules'
import { ecuadorTodayYmd } from '@/lib/format'
import { MyBookingsPage } from '@/features/bookings/MyBookingsPage'
import { HomePage } from '@/features/catalog/HomePage'
import { AgendaPage } from '@/features/agenda/AgendaPage'

/**
 * ZCAPP-57: las clases pasadas no cuentan como reservas activas, no se cancelan
 * ni reagendan, y los estados se muestran en español.
 * ZCAPP-58: tocar una sesión en Inicio abre la agenda en su día y la resalta.
 */

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()

const member: User = {
  id: 'user_member_1',
  email: 'socio@gym.local',
  fullName: 'Ana Socio',
  role: 'member',
  createdAt: '2026-01-01T00:00:00.000Z',
}
const zone: Zone = {
  id: 'zone-gimnasio',
  name: 'Gimnasio',
  type: 'gimnasio',
  description: '',
  defaultCapacity: 20,
  imageHint: 'floor',
} as Zone
const plan: MembershipPlan = {
  id: 'plan_1',
  name: 'Plan Mensual',
  priceCents: 4500,
  durationDays: 30,
  visitQuota: null,
  allowedZoneIds: [],
  active: true,
} as MembershipPlan
const membership: Membership = {
  id: 'mem_1',
  userId: member.id,
  planId: plan.id,
  status: 'active',
  startsAt: at(-5 * DAY),
  endsAt: at(20 * DAY),
  graceEndsAt: at(23 * DAY),
  visitsLeft: null,
}

function session(id: string, title: string, startOffset: number, capacity = 10): Session {
  return {
    id,
    templateId: 'tpl',
    zoneId: zone.id,
    title,
    kind: 'class',
    startsAt: at(startOffset),
    endsAt: at(startOffset + HOUR),
    capacity,
    trainerId: null,
    bookedCount: 1,
  }
}
function booking(id: string, sessionId: string, status: Booking['status']): Booking {
  return {
    id,
    sessionId,
    userId: member.id,
    status,
    createdAt: at(-10 * DAY),
    cancelledAt: null,
    checkInCode: `QR-${id.toUpperCase().padEnd(8, '0').slice(0, 8)}`,
  }
}

const past = session('s_past', 'Hyrox pasada', -3 * DAY)
const attendedSession = session('s_att', 'CrossFit asistida', -2 * DAY)
const inProgress = session('s_now', 'Clase en curso', -30 * 60 * 1000)
const upcoming = session('s_next', 'Musculación próxima', 2 * DAY)

const bookings = [
  booking('bk_past', past.id, 'confirmed'),
  booking('bk_att', attendedSession.id, 'attended'),
  booking('bk_now', inProgress.id, 'confirmed'),
  booking('bk_next', upcoming.id, 'confirmed'),
]

function setup(extra: Partial<Parameters<typeof createMockRepo>[1]> = {}) {
  resetRepositoryForTests(
    createMockRepo(member, {
      zones: [zone],
      sessions: [past, attendedSession, inProgress, upcoming],
      bookings,
      memberships: [membership],
      membershipPlans: [plan],
      ...extra,
    }),
  )
}

describe('ZCAPP-57 · regla de reserva activa', () => {
  const now = new Date()

  it('una clase futura o en curso está activa; una que ya terminó, no', () => {
    expect(isActiveBooking(bookings[3]!, upcoming, now)).toBe(true)
    expect(isActiveBooking(bookings[2]!, inProgress, now)).toBe(true)
    expect(isActiveBooking(bookings[0]!, past, now)).toBe(false)
  })

  it('cancelada, asistida o sin sesión no cuentan como activas', () => {
    expect(isActiveBooking(booking('x', upcoming.id, 'cancelled'), upcoming, now)).toBe(false)
    expect(isActiveBooking(bookings[1]!, attendedSession, now)).toBe(false)
    expect(isActiveBooking(bookings[3]!, undefined, now)).toBe(false)
  })

  it('selectActiveBookings filtra por socio y por fecha', () => {
    const other = { ...bookings[3]!, id: 'bk_other', userId: 'otro' }
    const active = selectActiveBookings(
      [...bookings, other],
      [past, attendedSession, inProgress, upcoming],
      member.id,
      now,
    )
    expect(active.map((b) => b.id).sort()).toEqual(['bk_next', 'bk_now'])
  })

  it.each([
    ['confirmed', upcoming, 'Confirmada'],
    ['waitlisted', upcoming, 'En espera'],
    ['pending', upcoming, 'Pendiente'],
    ['confirmed', past, 'No asististe'],
    ['waitlisted', past, 'Sin cupo'],
    ['attended', past, 'Asististe'],
    ['no_show', past, 'No asististe'],
    ['cancelled', upcoming, 'Cancelada'],
  ] as const)('estado %s → "%s" en español', (status, s, label) => {
    expect(bookingStatusLabel({ status }, s, now)).toBe(label)
  })
})

describe('ZCAPP-57 · "Mis clases"', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setup()
  })

  function renderPage() {
    return render(
      <MemoryRouter>
        <RepositoryProvider>
          <MyBookingsPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )
  }

  it('la clase pasada va al historial, en español y sin Cancelar ni Reagendar', async () => {
    renderPage()
    const history = await screen.findByRole('region', { name: 'Historial' })
    const pastRow = within(history).getByText('Hyrox pasada').closest('div')!.parentElement!
    expect(within(pastRow).getByText('No asististe')).toBeInTheDocument()
    expect(within(history).getByText('Asististe')).toBeInTheDocument()
    expect(within(history).queryByRole('button')).toBeNull()
  })

  it('las próximas y la que está en curso conservan QR y acciones, con estado en español', async () => {
    renderPage()
    await screen.findByText('Musculación próxima')
    expect(screen.getAllByText('Confirmada')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /^cancelar$/i })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /^reagendar$/i })).toHaveLength(2)
  })

  it('ningún estado aparece en inglés', async () => {
    renderPage()
    await screen.findByRole('region', { name: 'Historial' })
    for (const raw of ['confirmed', 'waitlisted', 'attended', 'cancelled', 'pending']) {
      expect(screen.queryByText(raw, { exact: true })).toBeNull()
    }
  })

  it('si solo quedan clases pasadas, invita a reservar y muestra el historial', async () => {
    setup({ bookings: [bookings[0]!, bookings[1]!] })
    renderPage()
    expect(await screen.findByText(/todavía no apartaste ninguna clase/i)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Historial' })).toBeInTheDocument()
  })
})

describe('ZCAPP-57/58 · Inicio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderHome() {
    return render(
      <MemoryRouter>
        <RepositoryProvider>
          <HomePage />
        </RepositoryProvider>
      </MemoryRouter>,
    )
  }

  it('"Reservas activas" no cuenta las clases pasadas', async () => {
    setup({ bookings: [bookings[0]!, bookings[1]!] })
    renderHome()
    const card = (await screen.findByText('Reservas activas')).closest('a')!
    expect(within(card).getByText('0')).toBeInTheDocument()
    expect(within(card).getByText(/ninguna apartada/i)).toBeInTheDocument()
  })

  it('"Reservas activas" cuenta la próxima y la que está en curso', async () => {
    setup()
    renderHome()
    const card = (await screen.findByText('Reservas activas')).closest('a')!
    expect(within(card).getByText('2')).toBeInTheDocument()
  })

  it('cada sesión de "Próximas sesiones" enlaza a la agenda en su día', async () => {
    setup()
    renderHome()
    await screen.findAllByText('Musculación próxima')
    const link = screen
      .getAllByText('Musculación próxima')
      .map((el) => el.closest('a'))
      .find((a) => a?.getAttribute('href')?.startsWith('/agenda'))
    expect(link).toHaveAttribute(
      'href',
      `/agenda?dia=${ecuadorTodayYmd(upcoming.startsAt)}&sesion=${upcoming.id}`,
    )
  })
})

describe('ZCAPP-58 · la agenda abre el día de la sesión', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setup({ bookings: [] })
  })

  it('con ?dia y ?sesion muestra ese día y resalta la clase', async () => {
    const day = ecuadorTodayYmd(upcoming.startsAt)
    render(
      <MemoryRouter initialEntries={[`/agenda?dia=${day}&sesion=${upcoming.id}`]}>
        <RepositoryProvider>
          <Routes>
            <Route path="/agenda" element={<AgendaPage />} />
          </Routes>
        </RepositoryProvider>
      </MemoryRouter>,
    )
    const title = await screen.findByText('Musculación próxima')
    const row = title.closest('[id^="sesion-"]')!
    expect(row).toHaveAttribute('aria-current', 'true')
    expect(row.className).toMatch(/border-acc/)
  })

  it('un ?dia mal formado cae en hoy', async () => {
    render(
      <MemoryRouter initialEntries={['/agenda?dia=mañana']}>
        <RepositoryProvider>
          <Routes>
            <Route path="/agenda" element={<AgendaPage />} />
          </Routes>
        </RepositoryProvider>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Reservar clase' })).toBeInTheDocument()
    expect(screen.queryByText('Musculación próxima')).toBeNull()
  })
})
