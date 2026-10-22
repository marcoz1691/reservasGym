import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { LocalRepository } from '@/data/localRepository'
import { resetRepositoryForTests } from '@/data/repository'
import { LoginPage } from './LoginPage'
import { PRIVACY, TERMS_DOCUMENT } from '@/features/legal/legalDocuments'

beforeEach(() => { localStorage.clear(); resetRepositoryForTests() })

it('bloquea registro sin ambas casillas y envía versiones por separado', async () => {
  const repo = new LocalRepository()
  const signUp = vi.spyOn(repo, 'signUp')
  resetRepositoryForTests(repo)
  render(<MemoryRouter><RepositoryProvider><LoginPage /></RepositoryProvider></MemoryRouter>)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: /crear cuenta/i }))
  await user.type(screen.getByLabelText('Nombre completo'), 'Socio Legal')
  await user.type(screen.getByLabelText('Correo electrónico'), 'legal@example.com')
  await user.type(screen.getByLabelText('Contraseña (mínimo 8 caracteres)'), 'password123')
  await user.type(screen.getByLabelText('Confirmar contraseña'), 'password123')
  const submit = screen.getAllByRole('button', { name: /crear cuenta/i }).at(-1)!
  await user.click(submit)
  expect(signUp).not.toHaveBeenCalled()
  await user.click(screen.getByRole('checkbox', { name: /Acepto los términos/ }))
  await user.click(submit)
  expect(signUp).not.toHaveBeenCalled()
  await user.click(screen.getByRole('checkbox', { name: /Autorizo el tratamiento/ }))
  await user.click(submit)
  await waitFor(() => expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
    consents: [
      { document: 'terms', version: TERMS_DOCUMENT.version },
      { document: 'privacy', version: PRIVACY.version },
    ],
  })))
})
