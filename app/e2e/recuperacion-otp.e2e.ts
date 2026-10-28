import { test, expect } from '@playwright/test'
import { ACCOUNTS, PASSWORD, QA_REF, sql } from './support/qa'

/**
 * ZCAPP-61 — Recuperar contraseña con código de 6 dígitos.
 * En QA los correos no se envían: el hook los guarda en qa_mail.enlaces, de donde
 * se lee el código. Se cambia a una contraseña temporal (Supabase no acepta la
 * misma que ya tiene) y al final se restaura la documentada para las demás pruebas.
 */
test.describe.configure({ mode: 'serial' })

const EMAIL = ACCOUNTS.socio
const TEMP_PASSWORD = `QaE2e${Date.now()}x`

test.afterAll(async () => {
  await sql(`update auth.users set encrypted_password = extensions.crypt('${PASSWORD}', extensions.gen_salt('bf'))
    where email = '${EMAIL}'`)
})

async function latestCode(after: string): Promise<string | undefined> {
  for (let i = 0; i < 10; i++) {
    const [row] = await sql<{ codigo_otp: string }>(
      `select codigo_otp from qa_mail.enlaces where tipo = 'recovery' and correo = '${EMAIL}'
       and fecha > '${after}' order by fecha desc limit 1`,
    )
    if (row) return row.codigo_otp
    await new Promise((r) => setTimeout(r, 1500))
  }
  return undefined
}

test('recuperación con código: de "olvidé" a entrar con la contraseña nueva', async ({ page }) => {
  let code = ''

  await test.step('"¿Olvidaste tu contraseña?" lleva el correo del login a /recuperar', async () => {
    await page.goto('/login')
    await page.getByLabel(/correo electrónico/i).fill(EMAIL)
    await page.getByRole('button', { name: /olvidaste tu contraseña/i }).click()
    await expect(page).toHaveURL(/\/recuperar/)
    await expect(page.getByLabel(/correo electrónico/i)).toHaveValue(EMAIL)
    await page.getByRole('button', { name: /continuar/i }).click()
  })

  await test.step('contraseñas distintas: avisa y no envía código', async () => {
    await page.getByLabel(/nueva contraseña/i).fill(TEMP_PASSWORD)
    await page.getByLabel(/confirmar contraseña/i).fill('OtraCosa2026!')
    await page.getByRole('button', { name: /enviar código/i }).click()
    await expect(page.getByText(/no coinciden/i)).toBeVisible()
    await expect(page.getByLabel(/código/i)).toHaveCount(0)
  })

  const t0 = new Date().toISOString()
  await test.step('envía el código y bloquea el reenvío 60 s', async () => {
    await page.getByLabel(/confirmar contraseña/i).fill(TEMP_PASSWORD)
    await page.getByRole('button', { name: /enviar código/i }).click()
    await expect(page.getByText(/enviamos un código de 6 dígitos/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /reenviar código \(\d+ s\)/i })).toBeDisabled()
  })

  await test.step('el correo trae un código de 6 dígitos', async () => {
    code = (await latestCode(t0)) ?? ''
    expect(code).toMatch(/^\d{6}$/)
  })

  await test.step('código incorrecto: mensaje claro y no cambia nada', async () => {
    await page.getByLabel(/código/i).fill(code === '000000' ? '111111' : '000000')
    await page.getByRole('button', { name: /cambiar contraseña/i }).click()
    await expect(page.getByText(/código no es válido o ya venció/i)).toBeVisible()
  })

  await test.step('el campo solo acepta 6 dígitos', async () => {
    const field = page.getByLabel(/código/i)
    await field.fill('')
    await field.pressSequentially('12ab34-5678')
    await expect(field).toHaveValue('123456')
  })

  await test.step('código correcto → contraseña actualizada → login prellenado', async () => {
    await page.getByLabel(/código/i).fill(code)
    await page.getByRole('button', { name: /cambiar contraseña/i }).click()
    await expect(page.getByText(/contraseña actualizada/i).first()).toBeVisible()
    await page.getByRole('button', { name: /ir a iniciar sesión/i }).click()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText(/tu contraseña se actualizó/i)).toBeVisible()
    await expect(page.getByLabel(/correo electrónico/i)).toHaveValue(EMAIL)
  })

  await test.step('entra con la contraseña nueva', async () => {
    await page.getByLabel(/^contraseña$/i).fill(TEMP_PASSWORD)
    await page.getByRole('button', { name: /^entrar$/i }).click()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 })
  })

  await test.step('el mismo código no se puede reutilizar', async () => {
    const anon = process.env.E2E_SUPABASE_ANON_KEY
    test.skip(!anon, 'Falta E2E_SUPABASE_ANON_KEY')
    const res = await fetch(`https://${QA_REF}.supabase.co/auth/v1/verify`, {
      method: 'POST',
      headers: { apikey: anon!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, token: code, type: 'recovery' }),
    })
    expect(res.status).not.toBe(200)
  })
})
