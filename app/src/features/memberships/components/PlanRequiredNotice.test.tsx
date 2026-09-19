import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PlanRequiredNotice } from './PlanRequiredNotice'

describe('PlanRequiredNotice', () => {
  it('explica que está explorando y enlaza a planes', () => {
    render(
      <MemoryRouter>
        <PlanRequiredNotice />
      </MemoryRouter>,
    )

    expect(
      screen.getByText(/Estás explorando la agenda\. Activa tu plan para reservar\./i),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver planes/i })).toHaveAttribute(
      'href',
      '/membresia',
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
