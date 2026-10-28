import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { LocalRepository } from '@/data/localRepository'
import { DEMO_PASSWORD } from '@/data/seed'
import { resetRepositoryForTests } from '@/data/repository'
import { ProfilePage } from './ProfilePage'

async function renderProfile() {
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
  return repo
}

describe('Perfil · celular del socio (ZCAPP-83)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  it('no guarda un celular inválido y explica el formato', async () => {
    const user = userEvent.setup()
    const repo = await renderProfile()
    await user.click(await screen.findByRole('button', { name: /Editar datos/i }))

    const phone = screen.getByLabelText(/Celular/i)
    await user.clear(phone)
    await user.type(phone, '022345678')
    await user.click(screen.getByRole('button', { name: /Guardar cambios/i }))

    expect(await screen.findByText(/Ingresa un celular válido/i)).toBeInTheDocument()
    expect(screen.queryByText(/Perfil actualizado correctamente/i)).not.toBeInTheDocument()
    expect((await repo.getCurrentUser())?.phone ?? '').not.toBe('022345678')
  })

  it('guarda un celular de Ecuador válido', async () => {
    const user = userEvent.setup()
    const repo = await renderProfile()
    await user.click(await screen.findByRole('button', { name: /Editar datos/i }))

    const phone = screen.getByLabelText(/Celular/i)
    await user.clear(phone)
    await user.type(phone, '0991234567')
    await user.click(screen.getByRole('button', { name: /Guardar cambios/i }))

    expect(await screen.findByText(/Perfil actualizado correctamente/i)).toBeInTheDocument()
    expect((await repo.getCurrentUser())?.phone).toBe('0991234567')
  })
})
