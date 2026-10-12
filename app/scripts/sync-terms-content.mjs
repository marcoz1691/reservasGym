import { readFile, writeFile } from 'node:fs/promises'

const source = await readFile('reports/Terminos-Condiciones-Zona-Cero.md', 'utf8')
const sections = source.split(/^## /m).slice(1).map((block) => {
  const [title, ...lines] = block.trim().split('\n')
  return { title, paragraphs: lines.join('\n').trim().split(/\n\s*\n/).map((text) => text.replace(/\n/g, ' ').replace(/\*\*/g, '')) }
})
if (sections.length !== 25) throw new Error('El documento aprobado debe tener 25 secciones.')
const terms = { title: 'Términos y condiciones', version: '1.0', sections }
await writeFile('src/features/legal/termsContent.ts', `/** Generado desde el documento de TyC: node scripts/sync-terms-content.mjs */\nexport const TERMS = ${JSON.stringify(terms, null, 2)}\n\nexport const termsArePublished = () => TERMS.sections.length > 0\n`)
console.log('Contenido de TyC sincronizado con el documento aprobado.')
