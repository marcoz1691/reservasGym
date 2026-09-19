import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { WelcomeNoPlanCard } from './WelcomeNoPlanCard'

describe('WelcomeNoPlanCard', () => {
  it('invita a activar el plan sin lenguaje de error', () => {
    render(
      <MemoryRouter>
        <WelcomeNoPlanCard />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', {
        name: /Activa tu plan y empieza a entrenar/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/actívalo en recepción/i)).toBeInTheDocument()
    expect(screen.queryByText(/vencida/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/pausadas/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('enlaza a planes y a explorar áreas', () => {
    render(
      <MemoryRouter>
        <WelcomeNoPlanCard />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /ver planes/i })).toHaveAttribute(
      'href',
      '/membresia',
    )
    expect(
      screen.getByRole('link', { name: /explorar áreas/i }),
    ).toHaveAttribute('href', '/explorar')
  })

  it('menciona el pago en línea solo cuando está habilitado', () => {
    const { unmount } = render(
      <MemoryRouter>
        <WelcomeNoPlanCard />
      </MemoryRouter>,
    )
    expect(
      screen.queryByText(/en línea con tarjeta/i),
    ).not.toBeInTheDocument()
    unmount()

    render(
      <MemoryRouter>
        <WelcomeNoPlanCard onlinePayEnabled />
      </MemoryRouter>,
    )
    expect(screen.getByText(/en línea con tarjeta/i)).toBeInTheDocument()
  })
})
