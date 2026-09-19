import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { LoginPage } from './LoginPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <RepositoryProvider>
        <LoginPage />
      </RepositoryProvider>
    </MemoryRouter>,
  )
}

describe('Login · ojo para ver la contraseña', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('muestra y oculta la contraseña al iniciar sesión', async () => {
    const user = userEvent.setup()
    renderPage()

    const password = await screen.findByLabelText(/^contraseña$/i)
    expect(password).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: /mostrar contraseña/i }))
    expect(password).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: /ocultar contraseña/i }))
    expect(password).toHaveAttribute('type', 'password')
  })

  it('al crear cuenta cada campo tiene su propio ojo', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    const password = await screen.findByLabelText(/contraseña \(mínimo 8/i)
    const confirmation = screen.getByLabelText(/confirmar contraseña/i)
    expect(password).toHaveAttribute('type', 'password')
    expect(confirmation).toHaveAttribute('type', 'password')

    const ojos = screen.getAllByRole('button', { name: /mostrar contraseña/i })
    expect(ojos).toHaveLength(2)

    await user.click(ojos[0]!)
    expect(password).toHaveAttribute('type', 'text')
    expect(confirmation).toHaveAttribute('type', 'password')

    await user.click(
      screen.getByRole('button', { name: /mostrar contraseña/i }),
    )
    expect(confirmation).toHaveAttribute('type', 'text')
  })
})
