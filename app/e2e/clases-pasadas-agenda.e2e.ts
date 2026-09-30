import { test, expect } from '@playwright/test'
import { ACCOUNTS, login, sql, userId } from './support/qa'

/**
 * ZCAPP-57: las clases pasadas no cuentan como activas, van al historial sin
 * acciones y los estados están en español.
 * ZCAPP-58: tocar una sesión en Inicio abre la agenda en su día y la resalta.
 * Usa una reserva pasada temporal ("QA-E2E Pasada") que se borra al final.
 */
test.describe.configure({ mode: 'serial' })

const tag = Date.now()
const PAST = `qa_e2e_past_${tag}`
let socioId = ''

/** Reservas abiertas del socio cuya clase todavía no terminó (lo que debe contar la app). */
const expectedActive = async () =>
  (await sql<{ c: number }>(
    `select count(*)::int c from bookings b join sessions s on s.id = b.session_id
     where b.user_id = '${socioId}' and b.status in ('confirmed','pending','waitlisted')
       and s.ends_at > now()`,
  ))[0]!.c

test.beforeAll(async () => {
  socioId = await userId(ACCOUNTS.socio)
  // Clase de ayer, con la reserva todavía "confirmed" (sin check-in).
  await sql(`insert into sessions (id, template_id, zone_id, title, kind, starts_at, ends_at, capacity)
    values ('${PAST}', 'tpl-gym-open', 'zone-gimnasio', 'QA-E2E Pasada', 'class',
      now() - interval '1 day', now() - interval '23 hours', 5)`)
  await sql(`insert into bookings (id, session_id, user_id, status, created_at, check_in_code)
    values ('bk-${tag}', '${PAST}', '${socioId}', 'confirmed', now() - interval '2 days', 'QR-E2E${String(tag).slice(-2)}AB')`)
})

test.afterAll(async () => {
  await sql(`delete from sessions where id = '${PAST}'`)
})

test('ZCAPP-57: la clase pasada no es activa y va al historial en español', async ({ page }) => {
  await login(page, ACCOUNTS.socio)
  const active = await expectedActive()

  await test.step('"Reservas activas" en Inicio no cuenta la clase pasada', async () => {
    await page.goto('/')
    const card = page.getByText('Reservas activas').locator('xpath=ancestor::a[1]')
    await expect(card).toContainText(String(active))
  })

  await test.step('"Mis clases": la pasada está en el historial, sin botones', async () => {
    await page.goto('/reservas')
    const history = page.getByRole('region', { name: 'Historial' })
    const row = history.getByText('QA-E2E Pasada').locator('xpath=ancestor::div[2]')
    await expect(row).toContainText('No asististe')
    await expect(history.getByRole('button')).toHaveCount(0)
  })

  await test.step('las próximas conservan Cancelar y Reagendar', async () => {
    await expect(page.getByRole('button', { name: /^cancelar$/i })).toHaveCount(active)
  })

  await test.step('ningún estado se muestra en inglés', async () => {
    for (const raw of ['confirmed', 'waitlisted', 'attended', 'cancelled', 'pending', 'no_show']) {
      await expect(page.getByText(raw, { exact: true })).toHaveCount(0)
    }
  })
})

test('ZCAPP-58: una sesión de Inicio abre la agenda en su día y resaltada', async ({ page }) => {
  await login(page, ACCOUNTS.socio)
  await page.goto('/')
  const link = page.locator('a[href^="/agenda?dia="]').first()
  await expect(link).toBeVisible()
  const href = (await link.getAttribute('href'))!
  const url = new URL(href, 'https://x')
  const day = url.searchParams.get('dia')!
  const sessionId = url.searchParams.get('sesion')!
  expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/)

  await link.click()
  await expect(page).toHaveURL(new RegExp(`/agenda\\?dia=${day}&sesion=`))
  const row = page.locator(`[id="sesion-${sessionId}"]`)
  await expect(row).toBeVisible()
  await expect(row).toHaveAttribute('aria-current', 'true')
  await expect(row).toBeInViewport()
})
