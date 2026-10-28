import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MyBookingsPage } from './MyBookingsPage'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { resetRepositoryForTests } from '@/data/repository'
import { createMockRepo } from '@/test/mockRepo'
import type { User } from '@/domain/models'

const memberUser: User = {
  id: 'user_member_1',
  email: 'socio@gym.local',
  fullName: 'Ana Socio',
  role: 'member',
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('MyBookingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('vacío explica que se reserva en Reservar y no muestra un ping de carga', async () => {
    resetRepositoryForTests(createMockRepo(memberUser, { bookings: [] }))

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <MyBookingsPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Tus clases' })).toBeInTheDocument()
    expect(
      screen.getByText(/QR, cancelar o cambiar hora. Para una clase nueva, ve a Reservar./i),
    ).toBeInTheDocument()
    expect(screen.getByText(/Todavía no apartaste ninguna clase/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Reservar' })).toHaveAttribute(
      'href',
      '/agenda',
    )
    expect(document.querySelector('.animate-ping')).toBeNull()
  })

  it('mientras carga muestra Tus clases y skeleton, no el vacío', async () => {
    const repo = createMockRepo(memberUser, { bookings: [] })
    const state = await repo.load()
    repo.load = vi.fn(
      () => new Promise<typeof state>((resolve) => setTimeout(() => resolve(state), 80)),
    )
    resetRepositoryForTests(repo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <MyBookingsPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Tus clases' })).toBeInTheDocument()
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    expect(screen.queryByText(/Todavía no apartaste ninguna clase/i)).not.toBeInTheDocument()

    expect(
      await screen.findByText(/Todavía no apartaste ninguna clase/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Reservar' })).toHaveAttribute(
      'href',
      '/agenda',
    )
  })
})
