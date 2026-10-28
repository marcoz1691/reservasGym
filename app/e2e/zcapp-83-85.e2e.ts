import { expect, test } from '@playwright/test'
import { ACCOUNTS, login, sql, sqlAs, userId } from './support/qa'

// ZCAPP-83 (celular), ZCAPP-84 (descartar solicitud) y ZCAPP-85 (barra de confirmar) contra QA.
// Cada prueba deja los datos como estaban. La primera también cubre el guardado del perfil
// del socio (fix-profiles-update-rls.sql).

const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const RECURRENTE = 'socio.recurrente@zonacero.test'

test.describe.configure({ mode: 'serial' })

test('ZCAPP-83: el perfil rechaza un celular inválido y guarda uno válido', async ({ page }) => {
  const uid = await userId(ACCOUNTS.socio)
  const [{ phone: original }] = await sql<{ phone: string | null }>(`select phone from profiles where id = '${uid}'`)
  try {
    await login(page, ACCOUNTS.socio)
    await page.goto('/perfil')
    await page.getByRole('button', { name: 'Editar datos' }).click()
    const field = page.getByLabel('Celular (opcional)')
    await field.fill('022345678')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText(/Ingresa un celular válido/)).toBeVisible()
    const [afterBad] = await sql<{ phone: string | null }>(`select phone from profiles where id = '${uid}'`)
    expect(afterBad.phone).toBe(original)

    await field.fill('0991234567')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect.poll(async () => (await sql<{ phone: string }>(`select phone from profiles where id = '${uid}'`))[0].phone).toBe('0991234567')
  } finally {
    await sql(`update profiles set phone = ${original ? `'${original}'` : 'null'} where id = '${uid}'`)
  }
})

test('ZCAPP-83: Cobros avisa si el celular del socio por vencer no sirve para WhatsApp', async ({ page }) => {
  test.skip(!ADMIN_PASSWORD, 'Falta E2E_ADMIN_PASSWORD')
  const uid = await userId(RECURRENTE)
  const [m] = await sql<{ id: string; ends_at: string; grace_ends_at: string; phone: string | null }>(
    `select m.id, m.ends_at, m.grace_ends_at, p.phone from memberships m join profiles p on p.id = m.user_id
     where m.user_id = '${uid}' order by m.ends_at desc limit 1`,
  )
  try {
    await sql(`update memberships set ends_at = now() + interval '3 days', grace_ends_at = now() + interval '6 days' where id = '${m.id}';
               update profiles set phone = '12345' where id = '${uid}'`)
    await login(page, ACCOUNTS.admin, ADMIN_PASSWORD)
    await page.goto('/admin/cobros')
    await page.getByRole('button', { name: /Vencimientos/ }).first().click()
    await expect(page.getByText('Celular no válido (12345): pide al socio que lo corrija en su perfil.')).toBeVisible()
  } finally {
    await sql(`update memberships set ends_at = '${m.ends_at}', grace_ends_at = '${m.grace_ends_at}' where id = '${m.id}';
               update profiles set phone = ${m.phone ? `'${m.phone}'` : 'null'} where id = '${uid}'`)
  }
})

test('ZCAPP-84: recepción descarta una solicitud y el socio ve el aviso en Mi Plan', async ({ browser }) => {
  test.skip(!ADMIN_PASSWORD, 'Falta E2E_ADMIN_PASSWORD')
  const uid = await userId(ACCOUNTS.socio)
  const [{ plan_id }] = await sql<{ plan_id: string }>(
    `select plan_id from memberships where user_id = '${uid}' order by ends_at desc limit 1`,
  )
  await sqlAs(uid, `insert into payments (user_id, plan_id, amount_cents, status, provider, manual_method, reference, terms_version)
    values ('${uid}', '${plan_id}', 1, 'pending', 'manual', 'transfer', 'ZC-E2E84', 'e2e')`)
  const [req] = await sql<{ id: string; amount_cents: number }>(
    `select id, amount_cents from payments where user_id = '${uid}' and reference = 'ZC-E2E84'`,
  )
  try {
    const admin = await browser.newPage()
    await login(admin, ACCOUNTS.admin, ADMIN_PASSWORD)
    await admin.goto('/admin/cobros')
    admin.once('dialog', (d) => d.accept())
    await admin.getByRole('button', { name: /Descartar solicitud de/ }).first().click()
    await expect.poll(async () => (await sql<{ status: string }>(`select status from payments where id = '${req.id}'`))[0].status).toBe('rejected')
    const [done] = await sql<{ notes: string }>(`select notes from payments where id = '${req.id}'`)
    expect(done.notes).toBe('Solicitud descartada por recepción.')
    await admin.close()

    const socio = await browser.newPage()
    await login(socio, ACCOUNTS.socio)
    await socio.goto('/membresia')
    await expect(socio.getByRole('status').filter({ hasText: 'Recepción descartó tu solicitud' })).toContainText('ZC-E2E84')
    await socio.close()
  } finally {
    await sql(`delete from payments where id = '${req.id}'`)
  }
})

test('ZCAPP-85: la barra de confirmar solo queda fija con un socio elegido (540×464)', async ({ page }) => {
  test.skip(!ADMIN_PASSWORD, 'Falta E2E_ADMIN_PASSWORD')
  await page.setViewportSize({ width: 540, height: 464 })
  await login(page, ACCOUNTS.admin, ADMIN_PASSWORD)
  await page.goto('/admin/cobros')
  const confirm = page.getByRole('button', { name: /Confirmar Cobro y Activar Membresía/ })
  const bar = confirm.locator('xpath=ancestor::div[contains(@class,"bg-bg/95")][1]')
  await expect(bar).toHaveCSS('position', 'static')

  // Sin socio elegido, el último de la lista se puede tocar.
  const list = page.locator('div.max-h-56')
  const last = list.locator('button').last()
  await last.scrollIntoViewIfNeeded()
  await last.click()
  await expect(bar).toHaveCSS('position', 'sticky')
})
