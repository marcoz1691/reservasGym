/**
 * Sequentially open Figma capture URLs in Chromium so the injected
 * capture.js can submit each page. One page at a time (background tabs
 * often never fire the capture).
 *
 * Usage: node _run-captures.mjs
 * Reads captures.json: [{ "page": "Login", "captureId": "..." }, ...]
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const list = JSON.parse(fs.readFileSync(path.join(DIR, 'captures.json'), 'utf8'))
const PORT = 8765
const DELAY_MS = 5000

const browser = await chromium.launch({
  headless: false,
  channel: 'chrome',
})
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
const page = await context.newPage()

for (const item of list) {
  const { page: name, captureId } = item
  const ep = encodeURIComponent(
    `https://mcp.figma.com/mcp/capture/${captureId}/submit?bindVariables=true`,
  )
  const url =
    `http://localhost:${PORT}/${name}.html` +
    `#figmacapture=${captureId}&figmaendpoint=${ep}&figmadelay=${DELAY_MS}`
  console.log(`Capturing ${name} (${captureId})…`)
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    // Wait for capture script delay + serialization
    await page.waitForTimeout(DELAY_MS + 8000)
    console.log(`  submitted window for ${name}`)
  } catch (err) {
    console.error(`  FAILED ${name}:`, err.message)
  }
}

await browser.close()
console.log('Done opening all capture URLs.')
