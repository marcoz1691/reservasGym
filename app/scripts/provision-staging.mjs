#!/usr/bin/env node
/**
 * Provisiona Supabase staging vía Management API.
 *
 * Requisitos (una vez):
 *   1. Token: https://supabase.com/dashboard/account/tokens
 *      Scopes: Database (Read+Write), Project Settings (Read)
 *   2. Project ref: Settings → General → Reference ID
 *
 * Uso:
 *   set SUPABASE_ACCESS_TOKEN=sbp_...
 *   set SUPABASE_PROJECT_REF=tu-ref
 *   node scripts/provision-staging.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appRoot = join(__dirname, '..')
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
const projectRef = process.env.SUPABASE_PROJECT_REF?.trim()

if (!token || !projectRef) {
  console.error(`
Faltan variables de entorno:

  SUPABASE_ACCESS_TOKEN  → Personal Access Token (supabase.com/dashboard/account/tokens)
  SUPABASE_PROJECT_REF   → Reference ID del proyecto (Settings → General)

Ejemplo PowerShell:
  $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
  $env:SUPABASE_PROJECT_REF = "abcdefghijklmnop"
  node scripts/provision-staging.mjs
`)
  process.exit(1)
}

const API = 'https://api.supabase.com/v1'

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  const text = await res.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!res.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} → ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`)
  }
  return body
}

async function runSql(name, filePath) {
  const query = readFileSync(filePath, 'utf8')
  console.log(`\n▶ Ejecutando ${name} (${filePath})...`)
  await api(`/projects/${projectRef}/database/query`, {
    method: 'POST',
    body: JSON.stringify({ query }),
  })
  console.log(`✓ ${name} OK`)
}

async function main() {
  console.log(`Proyecto: ${projectRef}`)

  await runSql('schema', join(appRoot, 'supabase', 'schema.sql'))
  await runSql('seed', join(appRoot, 'supabase', 'seed.sql'))

  console.log('\n▶ Verificando tablas...')
  const zones = await api(`/projects/${projectRef}/database/query`, {
    method: 'POST',
    body: JSON.stringify({ query: 'select count(*)::int as n from zones;' }),
  })
  const plans = await api(`/projects/${projectRef}/database/query`, {
    method: 'POST',
    body: JSON.stringify({ query: 'select count(*)::int as n from membership_plans;' }),
  })
  console.log(`  zonas: ${zones?.[0]?.n ?? '?'} | planes: ${plans?.[0]?.n ?? '?'}`)

  console.log('\n▶ Obteniendo API keys...')
  const keys = await api(`/projects/${projectRef}/api-keys`)
  const anon = keys?.find((k) => k.name === 'anon' || k.name === 'anon key')?.api_key
    ?? keys?.find((k) => k.type === 'legacy' && k.name?.includes('anon'))?.api_key
  const url = `https://${projectRef}.supabase.co`

  if (!anon) {
    console.warn('⚠ No se encontró anon key automáticamente. Copia manual desde Settings → API.')
  } else {
    const envPath = join(appRoot, '.env.staging')
    const content = `# Generado por provision-staging.mjs
VITE_SUPABASE_URL=${url}
VITE_SUPABASE_ANON_KEY=${anon}
`
    writeFileSync(envPath, content, 'utf8')
    console.log(`✓ Escrito ${envPath}`)
  }

  console.log(`
══════════════════════════════════════════════════════════
  SQL listo. Falta crear usuarios Auth (no vía SQL):

  Authentication → Users → Add user (Auto Confirm):
    socio.staging@zonacero.test   / ZonaCero2026!
    staff.staging@zonacero.test   / ZonaCero2026!
    admin.staging@zonacero.test   / ZonaCero2026!

  Luego ejecuta staging-users.sql (o vuelve a correr este script
  con RUN_STAGING_USERS=1 después de crear usuarios).

  Probar app: npm run dev:staging
══════════════════════════════════════════════════════════
`)

  if (process.env.RUN_STAGING_USERS === '1') {
    await runSql('staging-users', join(appRoot, 'supabase', 'staging-users.sql'))
  }
}

main().catch((err) => {
  console.error('\n✗ Error:', err.message)
  process.exit(1)
})
