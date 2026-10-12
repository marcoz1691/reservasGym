import { describe, expect, it } from 'vitest'
import { isSafeTermsPdfUrl, resolveTermsDocument, validateTermsPdf } from './termsDocument'

describe('documento de términos', () => {
  it('usa el PDF incluido cuando no hay documento publicado o la dirección es insegura', () => {
    expect(resolveTermsDocument().url).toBe('/legal/terminos-zona-cero-v1.pdf')
    expect(resolveTermsDocument({ termsPdfUrl: 'javascript:alert(1)', termsVersion: '2' }).custom).toBe(false)
    expect(resolveTermsDocument({}, '/app/').url).toBe('/app/legal/terminos-zona-cero-v1.pdf')
    expect(resolveTermsDocument({}, './').url).toBe('/legal/terminos-zona-cero-v1.pdf')
    expect(isSafeTermsPdfUrl('https://user:password@example.com/terms.pdf')).toBe(false)
    expect(isSafeTermsPdfUrl('https://example.com/terms.html')).toBe(false)
  })

  it('vincula el documento y la versión a su identificador de aceptación', () => {
    const first = resolveTermsDocument({ termsPdfUrl: 'https://example.com/v1.pdf', termsVersion: '1' })
    const second = resolveTermsDocument({ termsPdfUrl: 'https://example.com/v2.pdf', termsVersion: '2' })
    expect(first.key).not.toBe(second.key)
    expect(second).toMatchObject({ custom: true, version: '2', url: 'https://example.com/v2.pdf' })
  })

  it('acepta un PDF con cabecera válida', async () => {
    await expect(validateTermsPdf(new File(['%PDF-1.7\n'], 'terms.pdf', { type: 'application/pdf' }), '1.1')).resolves.toBeUndefined()
  })

  it('rechaza archivos renombrados a PDF, vacíos, grandes o sin versión', async () => {
    await expect(validateTermsPdf(new File(['<html>'], 'terms.pdf', { type: 'application/pdf' }), '1')).rejects.toThrow('PDF válido')
    await expect(validateTermsPdf(new File([], 'terms.pdf'), '1')).rejects.toThrow('no estar vacío')
    await expect(validateTermsPdf(new File(['%PDF-', new Uint8Array(5 * 1024 * 1024)], 'terms.pdf'), '1')).rejects.toThrow('5 MB')
    await expect(validateTermsPdf(new File(['%PDF-'], 'terms.pdf'), '')).rejects.toThrow('versión')
    await expect(validateTermsPdf(new File(['%PDF-'], 'terms.txt'), '1')).rejects.toThrow('Selecciona')
  })
})
