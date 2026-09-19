import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { LocalRepository } from '@/data/localRepository'
import { ResetPasswordPage } from './ResetPasswordPage'

const SOCIO = 'socio@gym.local'

function renderPage() {
  return render(
    <MemoryRouter>
      <RepositoryProvider>
        <ResetPasswordPage />
      </RepositoryProvider>
    </MemoryRouter>,
  )
}

describe('ZCAPP-46 · pantalla de nueva contraseña', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('rechaza el enlace si no hay sesión de recuperación', async () => {
    renderPage()
    expect(
      await screen.findByText(/enlace vencido o inválido/i),
    ).toBeInTheDocument()
  })

  it('muestra el formulario cuando el enlace es válido', async () => {
    await new LocalRepository().resetPassword(SOCIO)
    renderPage()
    expect(await screen.findByLabelText(/nueva contraseña/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/repite la contraseña/i)).toBeInTheDocument()
  })

  it('el ojo muestra y oculta cada contraseña por separado', async () => {
    await new LocalRepository().resetPassword(SOCIO)
    const user = userEvent.setup()
    renderPage()

    const nueva = await screen.findByLabelText(/nueva contraseña/i)
    const repite = screen.getByLabelText(/repite la contraseña/i)
    expect(nueva).toHaveAttribute('type', 'password')
    expect(repite).toHaveAttribute('type', 'password')

    const ojos = screen.getAllByRole('button', { name: /mostrar contraseña/i })
    await user.click(ojos[0]!)

    expect(nueva).toHaveAttribute('type', 'text')
    // el segundo campo no se destapa solo
    expect(repite).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: /ocultar contraseña/i }))
    expect(nueva).toHaveAttribute('type', 'password')
  })

  it('avisa si las contraseñas no coinciden y no la cambia', async () => {
    await new LocalRepository().resetPassword(SOCIO)
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText(/nueva contraseña/i), 'ZonaCero2026')
    await user.type(screen.getByLabelText(/repite la contraseña/i), 'ZonaCero2027')
    await user.click(screen.getByRole('button', { name: /guardar contraseña/i }))

    expect(await screen.findByText(/no coinciden/i)).toBeInTheDocument()
    // sigue en el formulario, no confirmó nada
    expect(screen.queryByText(/quedó actualizada/i)).not.toBeInTheDocument()
  })

  it('avisa si la contraseña es demasiado corta', async () => {
    await new LocalRepository().resetPassword(SOCIO)
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText(/nueva contraseña/i), 'Zc1')
    await user.type(screen.getByLabelText(/repite la contraseña/i), 'Zc1')
    await user.click(screen.getByRole('button', { name: /guardar contraseña/i }))

    // El texto instructivo también menciona los 8 caracteres, así que se
    // busca dentro de la lista de errores, no en toda la pantalla.
    const errores = await screen.findByRole('list')
    expect(errores).toHaveTextContent('Usa al menos 8 caracteres')
  })

  it('guarda la contraseña nueva y confirma', async () => {
    await new LocalRepository().resetPassword(SOCIO)
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText(/nueva contraseña/i), 'ZonaCero2026')
    await user.type(screen.getByLabelText(/repite la contraseña/i), 'ZonaCero2026')
    await user.click(screen.getByRole('button', { name: /guardar contraseña/i }))

    expect(await screen.findByText(/quedó actualizada/i)).toBeInTheDocument()

    // y la contraseña realmente cambió
    await waitFor(async () => {
      const check = new LocalRepository()
      const u = await check.signIn({ email: SOCIO, password: 'ZonaCero2026' })
      expect(u.email).toBe(SOCIO)
    })
  })
})
