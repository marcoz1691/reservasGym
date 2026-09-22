import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { FichaTecnicaModal } from './FichaTecnicaModal'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { LocalRepository } from '@/data/localRepository'
import { DEMO_PASSWORD } from '@/data/seed'
import { resetRepositoryForTests } from '@/data/repository'
import { isBiometricsEnabled } from '@/lib/biometrics'

describe('FichaTecnicaModal (Post-Registration Onboarding & Anthropometrics)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  it('empieza por datos personales, sigue con salud y deja las medidas al final', async () => {
    const repo = new LocalRepository()
    await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })
    resetRepositoryForTests(repo)
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <FichaTecnicaModal open={true} onClose={onClose} isInitialOnboarding={true} />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Ficha Técnica Inicial de Ingreso')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /1\. Datos personales/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /2\. Salud/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /3\. Medidas corporales/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /peso/i })).not.toBeInTheDocument()

    expect(screen.getByText('Fecha de Nacimiento *')).toBeInTheDocument()
    expect(screen.getByText('Sector / Ciudad de Residencia *')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByLabelText(/Fecha de Nacimiento/i)).toHaveValue('1995-04-12')
    })

    await user.click(screen.getByRole('button', { name: /Siguiente/i }))

    expect(screen.getByText('Objetivos Principales de Entrenamiento')).toBeInTheDocument()
    expect(
      screen.getByText('Antecedentes Médicos, Lesiones o Dolencias'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Siguiente/i }))

    expect(screen.getByText('Estatura (cm) *')).toBeInTheDocument()
    expect(screen.getByText('Masa corporal (kg) *')).toBeInTheDocument()
    expect(screen.queryByText(/Peso Actual/i)).not.toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: /Guardar Ficha Técnica/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Acceso Rápido con Biometría')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('checkbox', { name: /Habilitar Face ID/i }),
    ).not.toBeInTheDocument()
  })

  it('no escribe estatura, masa corporal, nacimiento, sector ni meta en una cuenta nueva', async () => {
    const repo = new LocalRepository()
    await repo.signUp({
      fullName: 'Socio Nuevo',
      email: 'nuevo.ficha@zonacero.test',
      password: 'password123',
    })
    resetRepositoryForTests(repo)
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <FichaTecnicaModal open={true} onClose={vi.fn()} isInitialOnboarding={true} />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByLabelText(/Fecha de Nacimiento/i)).toHaveValue('')
    expect(screen.getByLabelText(/Sector \/ Ciudad de Residencia/i)).toHaveValue('')
    expect(screen.getByLabelText(/Sector \/ Ciudad de Residencia/i)).toHaveAttribute(
      'placeholder',
      expect.stringMatching(/Ej\./),
    )

    await user.click(screen.getByRole('button', { name: /Siguiente/i }))
    expect(
      screen.getByRole('button', { name: /Acondicionamiento Hyrox/i }),
    ).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: /Siguiente/i }))
    expect(screen.getByLabelText(/Estatura/i)).toHaveValue('')
    expect(screen.getByLabelText(/Masa corporal/i)).toHaveValue('')
    expect(screen.getByLabelText(/Estatura/i)).toHaveAttribute('placeholder', 'Ej. 175')
  })

  it('saves completed ficha técnica and registers biometrics', async () => {
    const repo = new LocalRepository()
    await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <FichaTecnicaModal open={true} onClose={onClose} isInitialOnboarding={true} />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    await screen.findByText('Ficha Técnica Inicial de Ingreso')
    await waitFor(() => {
      expect(screen.getByLabelText(/Fecha de Nacimiento/i)).toHaveValue('1995-04-12')
    })

    await user.click(screen.getByRole('button', { name: /Siguiente/i }))
    await user.click(screen.getByRole('button', { name: /Siguiente/i }))

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Guardar Ficha Técnica/i })
    await user.click(saveBtn)

    // Verify success banner appears
    await waitFor(() => {
      expect(screen.getByText('¡Ficha Técnica Guardada!')).toBeInTheDocument()
    })

    expect(isBiometricsEnabled()).toBe(false)
  })
})
