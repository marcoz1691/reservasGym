/**
 * Generates plain HTML pages (one per .dc.html) for Figma html-to-design capture.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(DIR, '_plain')

const IMG_FILES = ['logo-color.png', 'mark-color.png', 'logo-white.png', 'mark-white.png']
const images = {}
for (const f of IMG_FILES) {
  const fromAssets = path.join(DIR, 'assets', f)
  const fromRoot = path.join(DIR, f)
  const filePath = fs.existsSync(fromAssets) ? fromAssets : fromRoot
  images[f] = 'data:image/png;base64,' + fs.readFileSync(filePath).toString('base64')
}

function toPlainHtml(file) {
  let s = fs.readFileSync(file, 'utf8')
  const helmet = (s.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ''])[1]
  let body = (s.match(/<x-dc>([\s\S]*?)<\/x-dc>/) || [, ''])[1]
  body = body.replace(/<helmet>[\s\S]*?<\/helmet>/, '')
  for (const [name, uri] of Object.entries(images)) {
    body = body.split(`src="${name}"`).join(`src="${uri}"`)
  }
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
${helmet}
<style>html,body{margin:0;overflow:hidden;background:transparent}</style>
<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>
</head>
<body>${body}</body>
</html>`
}

fs.mkdirSync(OUT, { recursive: true })
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.dc.html'))
for (const f of files) {
  const id = f.replace(/\.dc\.html$/, '')
  fs.writeFileSync(path.join(OUT, `${id}.html`), toPlainHtml(path.join(DIR, f)))
}
console.log(`Wrote ${files.length} plain pages to _plain/`)
