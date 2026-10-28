import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { LocalRepository } from '@/data/localRepository'
import { resetRepositoryForTests } from '@/data/repository'
import { ForgotPasswordPage } from './ForgotPasswordPage'

const SOCIO = 'socio@gym.local'
const NUEVA = 'ZonaCero2026'

function renderPage(repo = new LocalRepository()) {
  resetRepositoryForTests(repo)
  render(
    <MemoryRouter initialEntries={[{ pathname: '/recuperar', state: { email: SOCIO } }]}>
      <RepositoryProvider>
        <Routes>
          <Route path="/recuperar" element={<ForgotPasswordPage />} />
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </RepositoryProvider>
    </MemoryRouter>,
  )
  return repo
}

async function goToPassword(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /continuar/i }))
  return screen.findByLabelText(/nueva contraseña/i)
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('sin correo previo, el campo empieza vacío', async () => {
    resetRepositoryForTests(new LocalRepository())
    render(
      <MemoryRouter initialEntries={['/recuperar']}>
        <RepositoryProvider>
          <ForgotPasswordPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )
    const campo = await screen.findByLabelText(/correo electrónico/i)
    expect(campo).toHaveValue('')
  })

  it('si las contraseñas no coinciden no envía el código', async () => {
    const user = userEvent.setup()
    const repo = renderPage()
    const send = vi.spyOn(repo, 'resetPassword')

    await user.type(await goToPassword(user), NUEVA)
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'OtraCosa2026')
    await user.click(screen.getByRole('button', { name: /enviar código/i }))

    expect(await screen.findByText(/no coinciden/i)).toBeInTheDocument()
    expect(send).not.toHaveBeenCalled()
  })

  it('si la contraseña es demasiado corta no envía el código', async () => {
    const user = userEvent.setup()
    const repo = renderPage()
    const send = vi.spyOn(repo, 'resetPassword')

    await user.type(await goToPassword(user), 'abc1')
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'abc1')
    await user.click(screen.getByRole('button', { name: /enviar código/i }))

    expect(await screen.findByRole('listitem')).toHaveTextContent(/al menos 8/i)
    expect(send).not.toHaveBeenCalled()
  })

  it('el ojo muestra y oculta cada contraseña por separado', async () => {
    const user = userEvent.setup()
    renderPage()
    const nueva = await goToPassword(user)
    const confirmar = screen.getByLabelText(/confirmar contraseña/i)
    expect(nueva).toHaveAttribute('type', 'password')
    expect(confirmar).toHaveAttribute('type', 'password')

    await user.click(screen.getAllByRole('button', { name: /mostrar contraseña/i })[0]!)
    expect(nueva).toHaveAttribute('type', 'text')
    expect(confirmar).toHaveAttribute('type', 'password')
  })

  it('el código solo acepta 6 dígitos y reenviar espera 60 s', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(await goToPassword(user), NUEVA)
    await user.type(screen.getByLabelText(/confirmar contraseña/i), NUEVA)
    await user.click(screen.getByRole('button', { name: /enviar código/i }))

    const campo = await screen.findByLabelText(/código/i)
    await user.type(campo, '12ab34567')
    expect(campo).toHaveValue('123456')

    const reenviar = screen.getByRole('button', { name: /reenviar código \(\d+ s\)/i })
    expect(reenviar).toBeDisabled()
  })

  it('con un código incorrecto avisa y se queda en el paso del código', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(await goToPassword(user), NUEVA)
    await user.type(screen.getByLabelText(/confirmar contraseña/i), NUEVA)
    await user.click(screen.getByRole('button', { name: /enviar código/i }))

    const aviso = await screen.findByText(/modo demo/i)
    const real = aviso.textContent!.match(/\d{6}/)![0]
    const wrong = real === '000000' ? '111111' : '000000'
    await user.type(screen.getByLabelText(/código/i), wrong)
    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }))

    expect(await screen.findByText(/código no es válido/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/código/i)).toBeInTheDocument()

    // La contraseña original sigue sirviendo
    const socio = await new LocalRepository().signIn({ email: SOCIO, password: 'demo1234' })
    expect(socio.email).toBe(SOCIO)
  })

  it('muestra el error del backend al enviar el código', async () => {
    const user = userEvent.setup()
    const repo = new LocalRepository()
    vi.spyOn(repo, 'resetPassword').mockRejectedValue(new Error('rate limit exceeded'))
    renderPage(repo)

    await user.type(await goToPassword(user), NUEVA)
    await user.type(screen.getByLabelText(/confirmar contraseña/i), NUEVA)
    await user.click(screen.getByRole('button', { name: /enviar código/i }))

    expect(await screen.findByText(/demasiados correos/i)).toBeInTheDocument()
  })
})
