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

  it('renders step 1 (Anthropometrics & Live BMI) and navigates across all steps', async () => {
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

    // Step 1: Weight & Height
    expect(await screen.findByText('Ficha Técnica Inicial de Ingreso')).toBeInTheDocument()
    expect(screen.getByText('Estatura (cm) *')).toBeInTheDocument()
    expect(screen.getByText('Peso Actual (kg) *')).toBeInTheDocument()
    expect(screen.getByText('Índice de Masa Corporal (IMC)')).toBeInTheDocument()

    // Navigate to Step 2
    const nextBtn = screen.getByRole('button', { name: /Siguiente/i })
    await user.click(nextBtn)

    // Step 2: Personal details
    expect(screen.getByText('Fecha de Nacimiento *')).toBeInTheDocument()
    expect(screen.getByText('Sector / Ciudad de Residencia *')).toBeInTheDocument()

    // Navigate to Step 3
    await user.click(screen.getByRole('button', { name: /Siguiente/i }))

    // Step 3: Health & Goals
    expect(screen.getByText('Objetivos Principales de Entrenamiento')).toBeInTheDocument()
    expect(
      screen.getByText('Antecedentes Médicos, Lesiones o Dolencias'),
    ).toBeInTheDocument()

    // Navigate to Step 4
    await user.click(screen.getByRole('button', { name: /Siguiente/i }))

    // Step 4: Biometrics
    expect(screen.getByText('Acceso Rápido con Biometría')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Guardar Ficha Técnica/i }),
    ).toBeInTheDocument()
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

    // Advance to Step 4
    await user.click(screen.getByRole('button', { name: /Siguiente/i }))
    await user.click(screen.getByRole('button', { name: /Siguiente/i }))
    await user.click(screen.getByRole('button', { name: /Siguiente/i }))

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Guardar Ficha Técnica/i })
    await user.click(saveBtn)

    // Verify success banner appears
    await waitFor(() => {
      expect(screen.getByText('¡Ficha Técnica Guardada!')).toBeInTheDocument()
    })

    // Verify biometrics was registered
    expect(isBiometricsEnabled()).toBe(true)
  })
})
