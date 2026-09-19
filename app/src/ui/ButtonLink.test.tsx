import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ButtonLink } from './ButtonLink'

describe('ButtonLink', () => {
  it('es un único elemento enfocable, no un botón dentro de un enlace', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/membresia">Ver planes</ButtonLink>
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: 'Ver planes' })
    expect(link).toHaveAttribute('href', '/membresia')
    expect(link.querySelector('button')).toBeNull()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('aplica variante, tamaño y clases propias sin perder el estilo base', () => {
    render(
      <MemoryRouter>
        <ButtonLink
          to="/agenda"
          variant="secondary"
          size="sm"
          className="shrink-0"
        >
          Explorar
        </ButtonLink>
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: 'Explorar' })
    expect(link).toHaveClass('shrink-0')
    expect(link).toHaveClass('border-line')
    expect(link).toHaveClass('px-3')
    expect(link).toHaveClass('focus-ring')
  })

  it('reenvía los atributos del enlace, como aria-label', () => {
    render(
      <MemoryRouter>
        <ButtonLink
          to="/membresia"
          aria-label="Activar plan para reservar CrossFit WOD Power"
        >
          Activar plan
        </ButtonLink>
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('link', {
        name: 'Activar plan para reservar CrossFit WOD Power',
      }),
    ).toBeInTheDocument()
  })
})
