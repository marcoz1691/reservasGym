/**
 * Fotos reales de las áreas del complejo.
 *
 * Se resuelven en build desde `src/assets/areas/`: basta con dejar ahí el
 * archivo con el nombre de la pista (`imageHint`), el tipo de zona o el id.
 * Si no existe foto, el consumidor cae a un tile de marca — por eso este
 * módulo nunca inventa una URL ni pide nada a la red.
 *
 * Van en assets y no en `public/` para que Vite les ponga hash y respete el
 * `base` relativo del build de Capacitor.
 */
const modules = import.meta.glob('../../assets/areas/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
  import: 'default',
  query: '?url',
})

const BY_NAME = new Map<string, string>()
for (const [filePath, url] of Object.entries(modules)) {
  const fileName = filePath.split('/').pop()
  const key = fileName?.replace(/\.\w+$/, '').toLowerCase()
  if (key && typeof url === 'string') BY_NAME.set(key, url)
}

/** Primera coincidencia entre las pistas dadas (hint, tipo de zona, id). */
export function areaImageUrl(
  ...hints: Array<string | null | undefined>
): string | null {
  for (const hint of hints) {
    if (!hint) continue
    const normalized = hint.toLowerCase().replace(/^zone[-_]/, '').replace(/_/g, '-')
    const match = BY_NAME.get(normalized) ?? BY_NAME.get(hint.toLowerCase())
    if (match) return match
  }
  return null
}

/** Nombres que el equipo puede usar al subir fotos (para docs y tests). */
export function availableAreaImages(): string[] {
  return [...BY_NAME.keys()].sort()
}
