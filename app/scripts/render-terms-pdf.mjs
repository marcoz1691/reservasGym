import { chromium } from '@playwright/test'
import { copyFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const html = resolve('reports/Terminos-Condiciones-Zona-Cero.html')
const pdf = resolve('reports/Terminos-Condiciones-Zona-Cero.pdf')
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.goto(pathToFileURL(html).href)
  await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true })
  await mkdir('public/legal', { recursive: true })
  await copyFile(pdf, 'public/legal/terminos-zona-cero-v1.pdf')
  console.log(`PDF para impresión generado: ${pdf}`)
} finally {
  await browser.close()
}
