import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { PlanRequiredNotice } from './PlanRequiredNotice'

describe('PlanRequiredNotice', () => {
  it('es un popup de recordatorio, no un banner de error', () => {
    render(
      <MemoryRouter>
        <PlanRequiredNotice />
      </MemoryRouter>,
    )

    const dialog = screen.getByTestId('plan-required-notice')
    expect(dialog).toHaveAttribute('role', 'dialog')
    expect(
      screen.getByRole('heading', { name: /Activa tu plan para reservar/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Estás explorando Zona Cero/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/pausadas/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/vencida/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(dialog.className).not.toMatch(/danger/)
    expect(screen.getByRole('link', { name: /ver planes/i })).toHaveAttribute(
      'href',
      '/membresia',
    )
  })

  it('permite cerrar el recordatorio', async () => {
    const onDismiss = vi.fn()
    render(
      <MemoryRouter>
        <PlanRequiredNotice onDismiss={onDismiss} />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /ahora no/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
