import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { WeightPage } from './WeightPage'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { LocalRepository } from '@/data/localRepository'
import { DEMO_PASSWORD } from '@/data/seed'
import { resetRepositoryForTests } from '@/data/repository'

describe('WeightPage (Anthropometric & Body Progress Module)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  it('renders Hero BMI Card, progress chart, and measurement history for member', async () => {
    const repo = new LocalRepository()
    await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <WeightPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    // Verify Title and Subtitle
    expect(
      await screen.findByText('Control Antropométrico & Progreso'),
    ).toBeInTheDocument()

    // Verify Hero Card Metrics
    expect(screen.getByText('Antropometría & Progreso Físico')).toBeInTheDocument()
    expect(screen.getByText('Peso Actual')).toBeInTheDocument()
    expect(screen.getByText('Peso Inicial')).toBeInTheDocument()
    expect(screen.getByText('Índice de Masa Corporal')).toBeInTheDocument()

    // Verify Chart controls
    expect(screen.getByText('Evolución en el Tiempo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Peso \(kg\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /IMC/i })).toBeInTheDocument()

    // Verify History items
    expect(screen.getByText('Historial de Mediciones')).toBeInTheDocument()
    expect(screen.getAllByText('67.2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('67.9').length).toBeGreaterThan(0)
    expect(screen.getAllByText('68.4').length).toBeGreaterThan(0)
  })

  it('allows logging a new measurement with circumferences and updates history', async () => {
    const repo = new LocalRepository()
    await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <WeightPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    // Wait for page to load
    expect(await screen.findByText('Control Antropométrico & Progreso')).toBeInTheDocument()

    // Click "Nueva medición" button
    const newBtn = screen.getByRole('button', { name: /Nueva medición/i })
    await userEvent.click(newBtn)

    // Verify modal is visible
    expect(screen.getByText('Nueva Medición Corporal')).toBeInTheDocument()

    // Input weight
    const weightInput = screen.getByLabelText(/Peso \(kg\) \*/i)
    await userEvent.clear(weightInput)
    await userEvent.type(weightInput, '66.5')

    // Click circumferences tab and add waist
    const circumTab = screen.getByRole('button', { name: /2\. Circunferencias/i })
    await userEvent.click(circumTab)

    const waistInput = screen.getByLabelText(/Cintura \(cm\)/i)
    await userEvent.type(waistInput, '73.5')

    // Save
    const submitBtn = screen.getByRole('button', { name: /Guardar Medición/i })
    await userEvent.click(submitBtn)

    // Verify new record appears in History & Hero
    await waitFor(() => {
      expect(screen.getAllByText('66.5').length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText(/Cintura:/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/73\.5/).length).toBeGreaterThan(0)
  })

  it('allows setting and updating a body goal', async () => {
    const repo = new LocalRepository()
    await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <WeightPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Control Antropométrico & Progreso')).toBeInTheDocument()

    // Click Ajustar meta button
    const goalBtn = screen.getByRole('button', { name: /Ajustar meta|Definir meta/i })
    await userEvent.click(goalBtn)

    // Verify goal modal
    expect(screen.getByText(/Meta Corporal/i)).toBeInTheDocument()

    const targetWeightInput = screen.getByLabelText(/Peso Objetivo \(kg\) \*/i)
    await userEvent.clear(targetWeightInput)
    await userEvent.type(targetWeightInput, '63.5')

    const saveGoalBtn = screen.getByRole('button', { name: /Actualizar Meta|Fijar Meta/i })
    await userEvent.click(saveGoalBtn)

    // Verify goal is updated in UI
    await waitFor(() => {
      expect(screen.getByText('63.5')).toBeInTheDocument()
    })
  })

  it('acepta coma decimal en peso objetivo y peso (ZCAPP-52)', async () => {
    const repo = new LocalRepository()
    await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <WeightPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Control Antropométrico & Progreso')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Ajustar meta|Definir meta/i }))
    const targetWeightInput = screen.getByLabelText(/Peso Objetivo \(kg\) \*/i)
    await userEvent.clear(targetWeightInput)
    await userEvent.type(targetWeightInput, '62,5')
    expect(targetWeightInput).toHaveValue('62.5')
    await userEvent.click(screen.getByRole('button', { name: /Actualizar Meta|Fijar Meta/i }))
    await waitFor(() => {
      expect(screen.getByText('62.5')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: /Nueva medición/i }))
    const weightInput = screen.getByLabelText(/Peso \(kg\) \*/i)
    await userEvent.clear(weightInput)
    await userEvent.type(weightInput, '66,8')
    expect(weightInput).toHaveValue('66.8')
  })

  it('renders staff panel and allows selecting members when logged in as staff', async () => {
    const repo = new LocalRepository()
    await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <WeightPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    // Verify staff panel
    expect(await screen.findByText('Panel de Entrenador / Staff')).toBeInTheDocument()
    expect(screen.getByLabelText(/Seleccionar Socio/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Registrar medidas/i })).toBeInTheDocument()
  })
})
