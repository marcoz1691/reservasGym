import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TermsDialog } from './TermsDialog'

describe('consulta de términos', () => {
  it('muestra el documento aprobado y permite abrir el PDF para imprimir', () => {
    render(<TermsDialog onClose={vi.fn()} />)
    expect(screen.getByRole('heading', { name: '16. Seguridad de la información' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir PDF para imprimir' })).toHaveAttribute('href', '/legal/terminos-zona-cero-v1.pdf')
    expect(screen.getByRole('link', { name: 'Descargar PDF' })).toHaveAttribute('download')
    expect(screen.queryByText(/está preparando/)).not.toBeInTheDocument()
  })

  it('muestra el PDF del administrador sin mezclarlo con el texto de otra versión', () => {
    render(<TermsDialog onClose={vi.fn()} settings={{ termsPdfUrl: 'https://example.com/legal/v2.pdf', termsVersion: '2.0' }} />)
    expect(screen.getByText('Versión 2.0')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir PDF para imprimir' })).toHaveAttribute('href', 'https://example.com/legal/v2.pdf')
    expect(screen.queryByRole('heading', { name: '16. Seguridad de la información' })).not.toBeInTheDocument()
  })
})
