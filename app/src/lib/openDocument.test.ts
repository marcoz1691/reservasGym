import { describe, expect, it, vi } from 'vitest'
import { absoluteDocumentUrl, openPdfDocument } from './openDocument'

describe('openPdfDocument', () => {
  it('convierte la ruta local del PDF en la URL pública para la app nativa', () => {
    expect(absoluteDocumentUrl('/legal/terminos-zona-cero-v1.pdf')).toBe(
      'https://app.zonaceroperformance.com/legal/terminos-zona-cero-v1.pdf',
    )
    expect(absoluteDocumentUrl('https://cdn.example.com/t.pdf')).toBe('https://cdn.example.com/t.pdf')
  })

  it('en la web abre el PDF en una pestaña nueva', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    await openPdfDocument('/legal/t.pdf', 'Términos')
    expect(open).toHaveBeenCalledWith('/legal/t.pdf', '_blank', 'noopener,noreferrer')
    open.mockRestore()
  })
})
