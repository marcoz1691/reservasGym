import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { LocalRepository } from '@/data/localRepository'
import { DEMO_PASSWORD } from '@/data/seed'
import { resetRepositoryForTests } from '@/data/repository'
import { ProfilePage } from './ProfilePage'

describe('Perfil · biometría fuera del contrato', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  it('no muestra Face ID ni huella en el perfil', async () => {
    const repo = new LocalRepository()
    await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })
    resetRepositoryForTests(repo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <ProfilePage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /Mi Perfil/i })).toBeInTheDocument()
    expect(screen.getByText(/Información de cuenta y ficha antropométrica/i)).toBeInTheDocument()
    expect(screen.queryByText(/Seguridad Biométrica/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /face id|huella|biometr/i }),
    ).not.toBeInTheDocument()
  })
})
