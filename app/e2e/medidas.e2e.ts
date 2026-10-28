import { test, expect } from '@playwright/test'
import { ACCOUNTS, login, sql, userId } from './support/qa'

/**
 * ZCAPP-22 medidas, ZCAPP-23 IMC y gráfica, ZCAPP-52 coma decimal y
 * ZCAPP-62 hora de Ecuador. Guarda el estado del socio al empezar y lo
 * restaura al final: no quedan medidas ni metas de prueba en QA.
 */
test.describe.configure({ mode: 'serial' })

let socioId = ''
let staffId = ''
let idsBefore: string[] = []
let goalsBefore = '[]'

const newRows = () =>
  idsBefore.length ? `and id not in (${idsBefore.map((i) => `'${i}'`).join(',')})` : ''

test.beforeAll(async () => {
  socioId = await userId(ACCOUNTS.socio)
  staffId = await userId(ACCOUNTS.staff)
  const [m] = await sql<{ j: string[] }>(
    `select coalesce(json_agg(id), '[]') j from body_measurements where user_id = '${socioId}'`,
  )
  idsBefore = m!.j
  const [g] = await sql<{ j: unknown }>(
    `select coalesce(json_agg(g), '[]') j from body_goals g where user_id = '${socioId}'`,
  )
  goalsBefore = JSON.stringify(g!.j)
})

test.afterAll(async () => {
  await sql(`delete from body_measurements where user_id = '${socioId}' ${newRows()}`)
  await sql(`delete from body_goals where user_id = '${socioId}'`)
  if (goalsBefore !== '[]') {
    await sql(`insert into body_goals select * from json_populate_recordset(null::body_goals,
      '${goalsBefore.replace(/'/g, "''")}')`)
  }
})

test('socio registra una medición con coma decimal; IMC, gráfica e historial', async ({ page }) => {
  await login(page, ACCOUNTS.socio)
  await page.goto('/peso')

  await test.step('peso vacío no se guarda', async () => {
    await page.getByRole('button', { name: /nueva medición/i }).first().click()
    const weight = page.getByLabel(/peso \(kg\) \*/i)
    await weight.fill('')
    await page.getByRole('button', { name: /guardar medición/i }).click()
    expect(await weight.evaluate((e: HTMLInputElement) => e.checkValidity())).toBe(false)
  })

  await test.step('ZCAPP-52: "70,5" escrito con coma queda 70.5', async () => {
    const weight = page.getByLabel(/peso \(kg\) \*/i)
    await weight.pressSequentially('70,5')
    await expect(weight).toHaveValue('70.5')
  })

  await test.step('ZCAPP-62: la fecha propuesta es la hora actual de Ecuador', async () => {
    const now = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
    await expect(page.getByLabel(/fecha y hora/i)).toHaveValue(new RegExp(`^${now}T`))
  })

  await test.step('ZCAPP-23: IMC en vivo 70.5 kg / 175 cm = 23.0 Normal', async () => {
    const height = page.getByLabel(/estatura \(cm\)/i)
    await height.fill('')
    await height.pressSequentially('175')
    const preview = page.getByText(/IMC estimado/i).locator('xpath=ancestor::div[2]')
    await expect(preview).toContainText('23.0')
    await expect(preview).toContainText(/normal/i)
  })

  await test.step('cintura "80,5" con coma queda 80.5', async () => {
    await page.getByRole('button', { name: /2\. Circunferencias/i }).click()
    const waist = page.getByLabel(/cintura \(cm\)/i)
    await waist.pressSequentially('80,5')
    await expect(waist).toHaveValue('80.5')
  })

  await test.step('guardar: la base tiene los valores y la hora correcta', async () => {
    await page.getByRole('button', { name: /guardar medición/i }).click()
    await expect(page.getByText(/nueva medición corporal/i)).toBeHidden()
    const [row] = await sql<Record<string, string>>(
      `select weight_kg, height_cm, bmi, waist_cm, recorded_by,
              abs(extract(epoch from (measured_at - now())))::int as desfase_s
       from body_measurements where user_id = '${socioId}' ${newRows()}`,
    )
    expect(row).toBeTruthy()
    expect(Number(row!.weight_kg)).toBe(70.5)
    expect(Number(row!.height_cm)).toBe(175)
    expect(Number(row!.bmi)).toBe(23)
    expect(Number(row!.waist_cm)).toBe(80.5)
    expect(row!.recorded_by).toBe(socioId)
    // ZCAPP-62: antes quedaba 5 h (18 000 s) en el futuro
    expect(Number(row!.desfase_s)).toBeLessThan(180)
  })

  await test.step('peso actual, IMC e historial reflejan la medición', async () => {
    await expect(page.getByText(/peso actual/i).first().locator('..')).toContainText('70.5')
    await expect(page.locator('main')).toContainText('23.0')
    await expect(page.locator('main')).toContainText('80.5')
  })

  await test.step('ZCAPP-23: la gráfica cambia de rango y de métrica', async () => {
    for (const range of ['1M', '3M', '6M', 'Todo']) {
      await page.getByRole('button', { name: range, exact: true }).click()
    }
    for (const metric of ['IMC', 'Cintura', 'Peso (kg)']) {
      await page.getByRole('button', { name: metric, exact: true }).click()
    }
    await expect(page.getByText(/evolución en el tiempo/i)).toBeVisible()
  })

  await test.step('ZCAPP-52: meta "65,5" con coma se guarda 65.5', async () => {
    await page.getByRole('button', { name: /definir meta|ajustar meta/i }).first().click()
    const target = page.getByLabel(/peso objetivo \(kg\) \*/i)
    await target.fill('')
    await target.pressSequentially('65,5')
    await expect(target).toHaveValue('65.5')
    await page.getByRole('button', { name: /^(fijar meta|actualizar meta)$/i }).last().click()
    await expect(page.getByText('65.5').first()).toBeVisible()
    const [goal] = await sql<{ target_weight_kg: string }>(
      `select target_weight_kg from body_goals where user_id = '${socioId}' order by created_at desc limit 1`,
    )
    expect(Number(goal!.target_weight_kg)).toBe(65.5)
  })
})

test('staff registra medidas de un socio', async ({ page }) => {
  await login(page, ACCOUNTS.staff)
  await page.goto('/peso')
  const member = page.locator('select').first()
  const option = await member.locator('option', { hasText: 'socio.staging' }).first().getAttribute('value')
  await member.selectOption(option!)
  await page.getByRole('button', { name: /registrar medidas/i }).first().click()
  const weight = page.getByLabel(/peso \(kg\) \*/i)
  await weight.fill('')
  await weight.pressSequentially('71,2')
  await page.getByRole('button', { name: /guardar medición/i }).click()
  await expect(page.getByText(/nueva medición corporal/i)).toBeHidden()

  const [row] = await sql<{ weight_kg: string }>(
    `select weight_kg from body_measurements
     where user_id = '${socioId}' and recorded_by = '${staffId}' ${newRows()}`,
  )
  expect(Number(row!.weight_kg)).toBe(71.2)
})
