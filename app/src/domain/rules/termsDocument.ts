import type { GymSettings } from '../models'

export const DEFAULT_TERMS_VERSION = '1.0'
export const DEFAULT_TERMS_PDF = 'legal/terminos-zona-cero-v1.pdf'
export const TERMS_PDF_MAX_BYTES = 5 * 1024 * 1024
export const TERMS_BUCKET = 'legal-documents'

export function isSafeTermsPdfUrl(url: string): boolean {
  if (/^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/.test(url)) return true
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && /\.pdf$/i.test(parsed.pathname)
  } catch {
    return false
  }
}

export function resolveTermsDocument(settings?: Pick<GymSettings, 'termsPdfUrl' | 'termsVersion' | 'termsUpdatedAt'>, base = '/') {
  const custom = settings?.termsPdfUrl && isSafeTermsPdfUrl(settings.termsPdfUrl)
  // En Capacitor BASE_URL es "./": el PDF debe partir de la raíz, no de la ruta del checkout.
  const prefix = base === './' ? '/' : base
  const url = custom ? settings.termsPdfUrl! : `${prefix}${DEFAULT_TERMS_PDF}`
  const version = custom ? settings.termsVersion || DEFAULT_TERMS_VERSION : DEFAULT_TERMS_VERSION
  return { url, version, updatedAt: custom ? settings.termsUpdatedAt : null, custom: Boolean(custom), key: `${version}:${url}` }
}

export function readPdfDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('No se pudo leer el PDF.'))
    reader.readAsDataURL(new Blob([file], { type: 'application/pdf' }))
  })
}

export async function validateTermsPdf(file: File, version: string): Promise<void> {
  if (!version.trim() || version.trim().length > 40 || /[\r\n\t]/.test(version)) {
    throw new Error('Ingresa una versión de hasta 40 caracteres.')
  }
  if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf')) {
    throw new Error('Selecciona un archivo PDF.')
  }
  if (!file.size || file.size > TERMS_PDF_MAX_BYTES) throw new Error('El PDF debe pesar como máximo 5 MB y no estar vacío.')
  const header = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('No se pudo leer el PDF.'))
    reader.readAsText(file.slice(0, 5))
  })
  if (header !== '%PDF-') throw new Error('El archivo no contiene un PDF válido.')
}
