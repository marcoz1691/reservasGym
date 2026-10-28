import { expect, type Page } from '@playwright/test'

/** Proyecto Supabase de QA. Nunca se apunta a producción desde estas pruebas. */
export const QA_REF = 'kqhmclbexnnsbzbgerbx'
const PROD_REF = 'gvgqlmoulgcickxognto'

export const PASSWORD = process.env.E2E_PASSWORD ?? 'ZonaCero2026!'
export const ACCOUNTS = {
  socio: 'socio.staging@zonacero.test',
  staff: 'staff.staging@zonacero.test',
  admin: 'admin.staging@zonacero.test',
} as const

const ref = process.env.E2E_SUPABASE_REF ?? QA_REF
if (ref === PROD_REF) {
  throw new Error('Las pruebas E2E crean y borran datos: no se pueden correr contra producción.')
}

/**
 * SQL contra la base de QA con la API de gestión de Supabase. Se usa para
 * preparar escenarios (clases temporales), verificar lo que la UI guardó y
 * limpiar. Requiere SUPABASE_ACCESS_TOKEN (el mismo de provision-staging).
 */
export async function sql<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) throw new Error('Falta SUPABASE_ACCESS_TOKEN (ver e2e/README.md)')
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = await res.json()
  if (!Array.isArray(body)) throw new Error(`SQL falló: ${JSON.stringify(body)}`)
  return body as T[]
}

/** Ejecuta SQL como si lo hiciera ese usuario (auth.uid() = userId). */
export function sqlAs(userId: string, query: string) {
  return sql(`begin;
    select set_config('request.jwt.claims', '{"sub":"${userId}","role":"authenticated"}', true);
    ${query};
    commit;`)
}

export async function userId(email: string): Promise<string> {
  const [row] = await sql<{ id: string }>(`select id from profiles where email = '${email}'`)
  if (!row) throw new Error(`No existe el usuario ${email} en QA`)
  return row.id
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login')
  await page.getByLabel(/correo electrónico/i).fill(email)
  await page.getByLabel(/^contraseña$/i).fill(password)
  await page.getByRole('button', { name: /^entrar$/i }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 })
}
