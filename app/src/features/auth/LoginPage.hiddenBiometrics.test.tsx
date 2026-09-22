import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { resetRepositoryForTests } from '@/data/repository'
import { LoginPage } from './LoginPage'

describe('Login · biometría fuera del contrato', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
    localStorage.setItem('reservasgym_biometric_enabled', 'true')
    localStorage.setItem(
      'reservasgym_biometric_user',
      JSON.stringify({
        userId: 'user_member',
        email: 'socio@gym.local',
        fullName: 'Ana Socio',
        savedAt: '2026-01-01T00:00:00.000Z',
      }),
    )
  })

  it('no muestra Face ID ni huella aunque el teléfono ya lo tenga guardado', async () => {
    render(
      <MemoryRouter>
        <RepositoryProvider>
          <LoginPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('button', { name: /^entrar$/i })).toBeInTheDocument()
    expect(screen.queryByText(/Hola, Ana/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /face id|huella/i }),
    ).not.toBeInTheDocument()
  })
})
