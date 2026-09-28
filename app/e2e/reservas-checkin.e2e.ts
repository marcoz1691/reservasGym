import { test, expect, type Page } from '@playwright/test'
import { ACCOUNTS, login, sql, sqlAs, userId } from './support/qa'

/**
 * ZCAPP-21 motor de reservas, ZCAPP-24 check-in QR y ZCAPP-56 código corto.
 * Crea clases temporales "QA-E2E" en QA a horas controladas y las borra al
 * final (con sus reservas, colas y check-ins).
 */
test.describe.configure({ mode: 'serial' })

const tag = Date.now()
const S = {
  checkin: `qa_e2e_chk_${tag}`,
  overlap: `qa_e2e_ov_${tag}`,
  full: `qa_e2e_full_${tag}`,
  tomorrow: `qa_e2e_later_${tag}`,
}
let socioId = ''
let staffId = ''

const createSession = (id: string, title: string, startMin: number, capacity: number) =>
  sql(`insert into sessions (id, template_id, zone_id, title, kind, starts_at, ends_at, capacity)
    values ('${id}', 'tpl-gym-open', 'zone-gimnasio', '${title}', 'class',
      now() + interval '${startMin} minutes', now() + interval '${startMin + 60} minutes', ${capacity})`)

const bookingOf = async (sessionId: string) =>
  (await sql<{ id: string; status: string; check_in_code: string }>(
    `select id, status, check_in_code from bookings
     where session_id = '${sessionId}' and user_id = '${socioId}' order by created_at desc limit 1`,
  ))[0]

/** Fila de una clase en la agenda (los botones tienen nombre accesible largo). */
const row = (page: Page, title: string) =>
  page.getByText(title, { exact: true }).first()
    .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]')

test.beforeAll(async () => {
  socioId = await userId(ACCOUNTS.socio)
  staffId = await userId(ACCOUNTS.staff)
  await createSession(S.checkin, 'QA-E2E Check-in', 5, 5)
  await createSession(S.overlap, 'QA-E2E Solapada', 5, 5)
  await createSession(S.full, 'QA-E2E Llena', 70, 1)
  await createSession(S.tomorrow, 'QA-E2E Mañana', 26 * 60, 5)
  await sqlAs(staffId, `select public.book_session('${S.full}')`) // staff ocupa el único cupo
  await sqlAs(socioId, `select public.book_session('${S.tomorrow}')`)
})

test.afterAll(async () => {
  await sql(`delete from sessions where id in (${Object.values(S).map((s) => `'${s}'`).join(',')})`)
})

test('ZCAPP-21: reservar, solapamiento, lista de espera, promoción y cancelar', async ({ page }) => {
  page.on('dialog', (d) => d.accept())
  await login(page, ACCOUNTS.socio)
  await page.goto('/agenda')
  await expect(page.getByText('QA-E2E Check-in').first()).toBeVisible()

  await test.step('clase con cupo → confirmada', async () => {
    await row(page, 'QA-E2E Check-in').getByRole('button').first().click()
    await expect(row(page, 'QA-E2E Check-in').getByText(/reservado/i)).toBeVisible()
    expect((await bookingOf(S.checkin))?.status).toBe('confirmed')
  })

  await test.step('otra clase a la misma hora → rechazada', async () => {
    await row(page, 'QA-E2E Solapada').getByRole('button').first().click()
    await expect(row(page, 'QA-E2E Solapada').getByText(/se solapa/i)).toBeVisible()
    expect(await bookingOf(S.overlap)).toBeUndefined()
  })

  await test.step('clase llena → "Lista de espera" y queda #1, sin sobrecupo', async () => {
    await expect(row(page, 'QA-E2E Llena').getByText(/lista de espera/i)).toBeVisible()
    await row(page, 'QA-E2E Llena').getByRole('button').first().click()
    await expect(row(page, 'QA-E2E Llena').getByText(/en espera #1/i)).toBeVisible()
    expect((await bookingOf(S.full))?.status).toBe('waitlisted')
    const [c] = await sql<{ c: number }>(
      `select count(*)::int c from bookings where session_id = '${S.full}' and status = 'confirmed'`,
    )
    expect(c!.c).toBe(1)
  })

  await test.step('se libera el cupo → el socio sube a confirmado', async () => {
    const [staffBooking] = await sql<{ id: string }>(
      `select id from bookings where session_id = '${S.full}' and user_id = '${staffId}'`,
    )
    await sqlAs(staffId, `select public.cancel_booking('${staffBooking!.id}')`)
    expect((await bookingOf(S.full))?.status).toBe('confirmed')
  })

  await test.step('ZCAPP-24/56: "Mis clases" muestra QR y código corto', async () => {
    await page.goto('/reservas')
    const code = (await bookingOf(S.checkin))!.check_in_code
    expect(code).toMatch(/^QR-[0-9A-F]{8}$/)
    await expect(page.getByAltText(`QR ${code}`)).toBeVisible()
  })

  await test.step('cancelar desde "Mis clases"', async () => {
    const card = page.getByText('QA-E2E Llena').first()
      .locator('xpath=ancestor::*[.//button[normalize-space()="Cancelar"]][1]')
    await card.getByRole('button', { name: /^cancelar$/i }).click()
    await expect(page.getByText(/reserva cancelada/i)).toBeVisible()
    expect((await bookingOf(S.full))?.status).toBe('cancelled')
  })
})

test('ZCAPP-24: check-in en recepción', async ({ page }) => {
  await login(page, ACCOUNTS.staff)
  await page.goto('/check-in')
  const booking = (await bookingOf(S.checkin))!
  const pick = async (title: string) => {
    const select = page.locator('select').first()
    const value = await select.locator('option', { hasText: title }).first().getAttribute('value')
    expect(value, `la reserva "${title}" no aparece para check-in`).toBeTruthy()
    await select.selectOption(value!)
  }
  const checkIns = async (id: string) =>
    (await sql<{ c: number }>(`select count(*)::int c from check_ins where booking_id = '${id}'`))[0]!.c

  await test.step('código equivocado → "Código QR inválido"', async () => {
    await pick('QA-E2E Check-in')
    await page.getByPlaceholder(/QR-/).fill('QR-00000000')
    await page.getByRole('button', { name: /validar check-in/i }).click()
    await expect(page.getByText(/código qr inválido/i)).toBeVisible()
    expect(await checkIns(booking.id)).toBe(0)
  })

  await test.step('código correcto (en minúsculas) → asistencia registrada', async () => {
    await page.getByPlaceholder(/QR-/).fill(booking.check_in_code.toLowerCase())
    await page.getByRole('button', { name: /validar check-in/i }).click()
    await expect(page.getByText(/check-in registrado con éxito/i)).toBeVisible()
    expect(await checkIns(booking.id)).toBe(1)
    expect((await bookingOf(S.checkin))!.status).toBe('attended')
  })

  await test.step('no se puede registrar dos veces', async () => {
    await page.reload()
    await expect(page.locator('select option', { hasText: 'QA-E2E Check-in' })).toHaveCount(0)
  })

  await test.step('clase de mañana (fuera de la ventana) → rechazada', async () => {
    const later = (await bookingOf(S.tomorrow))!
    if (await page.locator('select option', { hasText: 'QA-E2E Mañana' }).count()) {
      await pick('QA-E2E Mañana')
      await page.getByPlaceholder(/QR-/).fill(later.check_in_code)
      await page.getByRole('button', { name: /validar check-in/i }).click()
      await expect(page.getByText(/fuera de la ventana/i)).toBeVisible()
    }
    expect(await checkIns(later.id)).toBe(0)
  })
})
