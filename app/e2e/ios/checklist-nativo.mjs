// ZCAPP-63: checklist de dispositivos (columna iOS) sobre la app nativa (Capacitor) en el
// simulador, con Appium XCUITest por W3C WebDriver. Base de QA + función desplegada + sandbox.
// Cómo prepararlo y correrlo: docs/tecnico/qa-dispositivos-appium.md
// Uso: E2E_PASSWORD=… node e2e/ios/checklist-nativo.mjs <carpeta-capturas>
import fs from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const A = process.env.APPIUM_URL ?? 'http://localhost:4723'
const OUT = process.argv[2]
const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const UDID = process.env.IOS_UDID
const WDA_URL = process.env.WDA_URL ?? 'http://localhost:8100'
const QA_REF = 'kqhmclbexnnsbzbgerbx'
const SOCIO = 'socio.staging@zonacero.test'
const PLAN = 'c1000000-0000-4000-8000-000000000030' // Zero Start Mensual $15
const ELEM = 'element-6066-11e4-a52e-4f735466cecf'
if (!process.env.E2E_PASSWORD) throw new Error('Falta E2E_PASSWORD (contraseña del socio staging)')
if (!UDID) throw new Error('Falta IOS_UDID (xcrun simctl list devices booted)')
if (!OUT) throw new Error('Uso: node e2e/ios/checklist-nativo.mjs <carpeta-capturas>')
fs.mkdirSync(OUT, { recursive: true })

const envFile = Object.fromEntries(fs.readFileSync(`${APP_DIR}/.env.pagomedios.local`, 'utf8')
  .split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
const card = (() => {
  const t = fs.readFileSync(`${APP_DIR}/.env.local`, 'utf8').replace(/^#\s*/gm, '')
  const b = t.split(/^Visa:/m)[1] ?? ''
  const exp = b.match(/(?:Expira|Fecha de expiracion):\s*(\d\d)\/(\d\d)/)
  return { number: b.match(/Numero de tarjeta:\s*([\d ]+)/)?.[1]?.replace(/\s/g, ''), holder: b.match(/Nombre tarjeta:\s*(.+)/)?.[1]?.trim() ?? 'Prueba', month: exp?.[1], year: exp?.[2], cvv: b.match(/CVV:\s*(\d+)/)?.[1] }
})()
void envFile
const SB_TOKEN = fs.readFileSync(`${process.env.HOME}/.supabase-token`, 'utf8').trim()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
const results = []
const record = (id, ok, detail = '') => { results.push({ id, result: ok === null ? 'BLOCKED' : ok ? 'PASS' : 'FAIL', detail }); log(id, ok === null ? 'BLOCKED' : ok ? 'PASS' : 'FAIL', detail) }

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${QA_REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${SB_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
  })
  return r.json()
}
async function wd(method, path, body) {
  const r = await fetch(A + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const j = await r.json()
  if (j.value && j.value.error) throw new Error(`${path}: ${j.value.error} ${String(j.value.message).slice(0, 160)}`)
  return j.value
}

// ---------- datos de QA: foto antes, restauración después ----------
const [{ id: socioId }] = await sql(`select id from auth.users where email = '${SOCIO}'`)
const startedAt = (await sql('select now() as t'))[0].t
const snapshot = await sql(`select id, plan_id, status, starts_at, ends_at, grace_ends_at, visits_left from memberships where user_id = '${socioId}'`)

const s = await wd('POST', '/session', { capabilities: { alwaysMatch: {
  platformName: 'iOS', 'appium:automationName': 'XCUITest',
  'appium:udid': UDID,
  'appium:bundleId': 'com.reservasgym.zonacero', 'appium:webDriverAgentUrl': WDA_URL,
  'appium:waitForQuiescence': false, 'appium:waitForIdleTimeout': 0,
  'appium:autoWebview': true, 'appium:webviewConnectTimeout': 30000,
  'appium:newCommandTimeout': 600, 'appium:autoFillPasswords': false,
} } })
const S = `/session/${s.sessionId}`
log('sesión app nativa', s.sessionId)

const js = (script, args = []) => wd('POST', `${S}/execute/sync`, { script, args })
const url = () => js('return location.pathname + location.search')
const shot = async (name) => fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(await wd('GET', `${S}/screenshot`), 'base64'))
const text = () => js('return document.body.innerText')
async function waitFor(fn, ms, label) {
  const end = Date.now() + ms
  while (Date.now() < end) { if (await fn().catch(() => false)) return true; await sleep(700) }
  throw new Error(`timeout: ${label}`)
}
const go = (path) => js('history.pushState(null, "", arguments[0]); dispatchEvent(new PopStateEvent("popstate"))', [path])
async function click(script, args = []) {
  const el = await js(script, args)
  if (!el) throw new Error('no encontrado: ' + script.slice(0, 90))
  await wd('POST', `${S}/element/${el[ELEM]}/click`, {})
}
const byLabelJs = `const l=[...document.querySelectorAll('label')].find(l=>l.textContent.trim().toLowerCase().includes(arguments[0].toLowerCase())); return l ? (l.control || l.querySelector('input,textarea,select')) : null`
async function type(label, value) {
  for (let i = 0; ; i++) {
    try {
      const el = await js(byLabelJs, [label]); if (!el) throw new Error(`no encontré "${label}"`)
      // Vaciar con el setter nativo + evento input: React se entera (clear() no dispara onChange).
      await js(`const el=arguments[0]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,''); el.dispatchEvent(new Event('input',{bubbles:true}))`, [el])
      await wd('POST', `${S}/element/${el[ELEM]}/value`, { text: value }); return
    } catch (e) { if (i >= 3) throw e; await sleep(800) }
  }
}
const btn = (re) => `return [...document.querySelectorAll('button,a,[role=button]')].find(b=>${re}.test(((b.getAttribute('aria-label')||'')+' '+b.textContent).trim())) || null`
const webCtx = async () => (await wd('GET', `${S}/contexts`)).filter((c) => String(c).startsWith('WEBVIEW'))
async function toApp() { const ctx = await webCtx(); await wd('POST', `${S}/context`, { name: ctx[0] }) }
// El checkout recupera el borrador: la casilla puede venir marcada; solo se marca si no lo está.
async function acceptTerms() {
  const checked = await js(`const c=document.querySelector('input[aria-label^="Acepto los términos"]'); return c ? c.checked : null`)
  if (checked === false) await click(`return document.querySelector('input[aria-label^="Acepto los términos"]')`)
}
const step = async (id, fn) => { try { await fn() } catch (e) { record(id, false, e.message.slice(0, 200)); await shot(`err-${id}`).catch(() => {}) } }
const errors = []
const hookErrors = () => js(`if(!window.__qaErr){window.__qaErr=[];addEventListener('error',e=>__qaErr.push(String(e.message)));addEventListener('unhandledrejection',e=>__qaErr.push('rejection: '+String(e.reason&&e.reason.message||e.reason)))}`)
const collectErrors = async () => { const e = await js('return window.__qaErr||[]').catch(() => []); errors.push(...e); await js('window.__qaErr=[]').catch(() => {}) }

try {
  // ---------- 1. Arranque y navegación ----------
  await step('1.1', async () => {
    await waitFor(async () => /iniciar sesión|entrar/i.test(await text()) || !(await url()).includes('/login'), 30000, 'pantalla inicial')
    await hookErrors()
    if (!(await url()).includes('/login')) { await click(btn('/cerrar sesión|salir/i')).catch(() => {}); await go('/login') }
    await waitFor(async () => !!(await js(byLabelJs, ['correo'])), 20000, 'login')
    await shot('1.1-login'); record('1.1', true, 'login visible')
  })
  await step('1.2', async () => {
    await type('correo', SOCIO); await type('contraseña', process.env.E2E_PASSWORD)
    await click(`return [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Entrar')`)
    await waitFor(async () => !(await url()).includes('/login'), 30000, 'entrar')
    await waitFor(async () => /Plan/.test(await text()), 15000, 'inicio con plan')
    await hookErrors(); await shot('1.2-inicio')
    const t = await text(); record('1.2', /Buen[oa]s|Hola/.test(t) && /Plan/.test(t), 'inicio con saludo y plan')
  })
  await step('1.3', async () => {
    const tabs = ['Inicio', 'Reservar', 'Mis clases', 'Mi Plan', 'Medidas']; const bad = []
    for (const tab of tabs) {
      await click(`const n=[...document.querySelectorAll('nav')].filter(n=>n.getBoundingClientRect().height>0).pop(); return n ? [...n.querySelectorAll('a,button')].find(a=>a.textContent.trim()===arguments[0]) || null : null`, [tab])
      await sleep(1500)
      const t = await text(); if (t.trim().length < 40 || /algo salió mal|error inesperado/i.test(t)) bad.push(tab)
      await shot(`1.3-${tab.replace(' ', '-')}`)
    }
    record('1.3', bad.length === 0, bad.length ? `vacías/error: ${bad.join(', ')}` : '5 pestañas cargan')
  })
  await step('1.4', async () => {
    const r = await js(`const n=[...document.querySelectorAll('nav')].filter(n=>n.getBoundingClientRect().height>0).pop(); const b=n?n.getBoundingClientRect():null; const h=document.querySelector('header'); const hb=h?h.getBoundingClientRect():null;
      const pad=getComputedStyle(document.documentElement).getPropertyValue('--sat')||'';
      return {vh:innerHeight, navBottom:b&&b.bottom, navTop:b&&b.top, headerTop:hb&&hb.top, safeBottom:getComputedStyle(n).paddingBottom}`)
    record('1.4', r.navBottom !== null && r.navBottom <= r.vh + 1 && (r.headerTop ?? 0) >= 0, `nav ${Math.round(r.navTop)}–${Math.round(r.navBottom)} de ${r.vh}px, padding inferior ${r.safeBottom} (ver capturas 1.3)`)
  })

  // ---------- 2. Checkout ----------
  await step('2.1', async () => {
    await go(`/membresia/pago?planId=${PLAN}`)
    await waitFor(async () => !!(await js(byLabelJs, ['Número de identificación'])), 30000, 'checkout')
    const navVisible = await js(`return [...document.querySelectorAll('nav')].some(n=>{const r=n.getBoundingClientRect(); return r.height>0 && r.bottom>innerHeight-120})`)
    await shot('2.1-checkout'); record('2.1', !navVisible, navVisible ? 'se ve el menú inferior' : 'pantalla completa, sin menú inferior')
  })
  await step('2.2', async () => {
    const doc = await js(byLabelJs, ['Número de identificación']); const cel = await js(byLabelJs, ['Celular'])
    const im = await js('return [arguments[0].inputMode, arguments[1].inputMode]', [doc, cel])
    await type('Número de identificación', 'abc'); await type('Celular', 'xyz')
    const vals = await js('return [arguments[0].value, arguments[1].value]', [doc, cel])
    record('2.2', im[0] === 'numeric' && im[1] === 'numeric' && vals[0] === '' && vals[1] === '', `inputmode ${im.join('/')}; con letras queda "${vals[0]}" / "${vals[1]}"`)
  })
  await step('2.3', async () => {
    await type('Número de identificación', '1710034066'); await type('Celular', '0812345678'); await type('Dirección', 'Av. Amazonas N34-120, Quito')
    await type('Número de identificación', '1710034066'); await sleep(800)
    const t = await text(); await shot('2.3-errores')
    record('2.3', /cédula no es válida/i.test(t) && /celular empieza con 09/i.test(t), 'mensajes de cédula y celular en español')
  })
  await step('2.5', async () => {
    await type('Número de identificación', '1710034065'); await type('Celular', '0987569852')
    const disabledNoTerms = await js(`const b=${btn('/^Pagar/').replace('return ', '')}; return b ? b.disabled : null`)
    await acceptTerms()
    const enabled = await js(`const b=${btn('/^Pagar/').replace('return ', '')}; return b ? !b.disabled : null`)
    record('2.5', disabledNoTerms === true && enabled === true, `sin términos: ${disabledNoTerms ? 'deshabilitado' : 'habilitado'}; con términos: ${enabled ? 'habilitado' : 'deshabilitado'}`)
  })
  await step('2.4', async () => {
    const v = await js('return arguments[0].value', [await js(byLabelJs, ['Número de identificación'])])
    record('2.4', v === '1710034065', `cédula válida conservada (${v})`)
  })
  await step('2.6', async () => {
    await click(btn('/términos y condiciones/i'))
    await waitFor(async () => /Versión/.test(await text()), 10000, 'diálogo de términos')
    const pdf = await js(`const a=[...document.querySelectorAll('a')].find(a=>/Abrir PDF para imprimir/.test(a.textContent)); return a ? a.href : null`)
    await shot('2.6-terminos')
    await click(btn('/^cerrar|entendido|^✕|close/i')).catch(async () => { await js('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))') })
    await sleep(800)
    const kept = await js('return arguments[0] ? arguments[0].value : null', [await js(byLabelJs, ['Número de identificación'])])
    record('2.6', kept === '1710034065' && !!pdf, `diálogo con PDF (${pdf ? 'enlace ok' : 'sin enlace'}); al cerrar se conserva la cédula`)
  })
  await step('2.7', async () => {
    await click(`return [...document.querySelectorAll('[role=radio]')].find(r=>/Efectivo en recepción/.test(r.textContent)) || null`)
    await sleep(800)
    const t = await text(); const noPayer = !(await js(byLabelJs, ['Número de identificación']))
    await shot('2.7-efectivo')
    record('2.7', /Confirmar solicitud/.test(t) && noPayer, `efectivo: ${noPayer ? 'sin' : 'con'} datos del pagador, botón Confirmar solicitud`)
    await click(`return [...document.querySelectorAll('[role=radio]')].find(r=>/Tarjeta/.test(r.textContent) && !/recurrente/i.test(r.textContent)) || null`).catch(() => {})
  })

  // ---------- 3. Salir del pago ----------
  await step('3.1', async () => {
    await click(btn('/Salir del pago/'))
    await waitFor(async () => /Quieres salir del/.test(await text()), 8000, 'hoja de salida')
    await shot('3.1-hoja'); record('3.1', true, 'hoja «¿Quieres salir del pago?»')
  })
  await step('3.2', async () => {
    await click(btn('/Continuar con el pago/'))
    await sleep(800)
    const still = (await url()).includes('/membresia/pago') && !/Quieres salir del/.test(await text())
    record('3.2', still, 'se cierra la hoja y sigue en el pago')
  })
  record('3.3', null, 'n/a en iOS (no hay botón atrás del sistema)')
  await step('3.4', async () => {
    await click(btn('/Salir del pago/'))
    await waitFor(async () => /Quieres salir del/.test(await text()), 8000, 'hoja de salida')
    const sheetBtns = await js(`return [...document.querySelectorAll('button')].filter(b=>/Salir del pago/.test(b.textContent)).length`)
    await js(`const bs=[...document.querySelectorAll('button')].filter(b=>/Salir del pago/.test(b.textContent)); bs[bs.length-1].click()`)
    await waitFor(async () => (await url()).startsWith('/membresia') && !(await url()).includes('/pago'), 10000, 'Mi Plan')
    await js('history.back()'); await sleep(1500)
    const back = await url()
    record('3.4', !back.includes('/pago'), `vuelve a Mi Plan; «atrás» queda en ${back} (${sheetBtns} botones «Salir»)`)
  })

  // ---------- 4. Pago con tarjeta en la pantalla dentro de la app ----------
  let payBefore = (await sql(`select count(*)::int c from payments where user_id = '${socioId}' and provider = 'pagomedios'`))[0].c
  await step('4.1', async () => {
    await go(`/membresia/pago?planId=${PLAN}`)
    await waitFor(async () => !!(await js(byLabelJs, ['Número de identificación'])), 30000, 'checkout')
    await type('Número de identificación', '1710034065'); await type('Celular', '0987569852'); await type('Dirección', 'Av. Amazonas N34-120, Quito')
    await acceptTerms()
    // E-03 del 12-oct: doble toque = un solo pago.
    await js(`const b=${btn('/^Pagar/').replace('return ', '')}; b.click(); b.click()`)
    await sleep(6000)
    await wd('POST', `${S}/context`, { name: 'NATIVE_APP' })
    const src = await wd('GET', `${S}/source`)
    fs.writeFileSync(`${OUT}/4.1-source.xml`, src)
    await shot('4.1-pantalla-pago')
    const inApp = /Pagomedios|payurl|Pago seguro/i.test(src)
    record('4.1', inApp, inApp ? 'formulario de Pagomedios dentro de la app' : 'no se ve la pantalla de pago')
    const payAfter = (await sql(`select count(*)::int c from payments where user_id = '${socioId}' and provider = 'pagomedios'`))[0].c
    record('E-03', payAfter - payBefore === 1, `doble toque en Pagar → ${payAfter - payBefore} pago(s)`)
    payBefore = payAfter
  })
  await step('4.2', async () => {
    if (!card.number) { record('4.2', null, 'falta la Visa de prueba en .env.pagomedios.local'); return }
    const find = (using, value) => wd('POST', `${S}/element`, { using, value })
    const tap = async (el) => wd('POST', `${S}/element/${el[ELEM]}/click`, {})
    const typeEl = async (el, v) => wd('POST', `${S}/element/${el[ELEM]}/value`, { text: v })
    const visa = await find('-ios predicate string', "type == 'XCUIElementTypeSwitch' AND label ==[c] 'Visa' AND visible == 1").catch(() => null)
    if (!visa) { record('4.2', null, 'no ubiqué el botón Visa en el árbol nativo (ver 4.1-source.xml)'); return }
    await tap(visa); await sleep(2500)
    fs.writeFileSync(`${OUT}/4.2-source.xml`, await wd('GET', `${S}/source`))
    const other = await find('-ios predicate string', "label CONTAINS[c] 'otra tarjeta' AND visible == 1").catch(() => null)
    if (other) { await tap(other); await sleep(1500) }
    // Solo los campos visibles: los del checkout de la app quedan detrás (visible = false).
    const fields = async () => (await wd('POST', `${S}/elements`, { using: '-ios predicate string', value: "type IN {'XCUIElementTypeTextField','XCUIElementTypeSecureTextField'} AND visible == 1" }))
    let f = await fields()
    const labels = []
    for (const el of f) labels.push(await wd('GET', `${S}/element/${el[ELEM]}/attribute/label`).catch(() => '') + '|' + await wd('GET', `${S}/element/${el[ELEM]}/attribute/placeholderValue`).catch(() => ''))
    log('campos nativos', JSON.stringify(labels))
    const pick = (re) => f[labels.findIndex((l) => re.test(l))]
    const num = pick(/n[uú]mero|card number|0000/i) ?? f[0]
    await tap(num); await typeEl(num, card.number); await sleep(500)
    f = await fields()
    const holder = pick(/nombre/i); if (holder) { await tap(holder); await typeEl(holder, card.holder) }
    const exp = pick(/expira|mm/i); if (exp) { await tap(exp); await typeEl(exp, `${card.month}${card.year}`) }
    const cvv = pick(/cvv|cvc/i) ?? f[f.length - 1]; await tap(cvv); await typeEl(cvv, card.cvv)
    await shot('4.2-tarjeta')
    // El teclado tapa el botón: se cierra con «Done» y se desliza hasta «Pagar».
    const done = await find('-ios predicate string', "type == 'XCUIElementTypeButton' AND label == 'Done' AND visible == 1").catch(() => null)
    if (done) { await tap(done); await sleep(800) }
    const payQuery = { using: '-ios predicate string', value: "type == 'XCUIElementTypeButton' AND label BEGINSWITH 'Pagar' AND visible == 1" }
    let pay = (await wd('POST', `${S}/elements`, payQuery)).pop()
    for (let i = 0; !pay && i < 4; i++) {
      await wd('POST', `${S}/execute/sync`, { script: 'mobile: swipe', args: [{ direction: 'up' }] }); await sleep(800)
      pay = (await wd('POST', `${S}/elements`, payQuery)).pop()
    }
    if (!pay) throw new Error('no encontré el botón Pagar de Pagomedios')
    await shot('4.2-antes-de-pagar')
    await tap(pay); await sleep(3000)
    const proceed = await find('-ios predicate string', "label == 'Continuar con el pago' AND visible == 1").catch(() => null)
    if (proceed) await tap(proceed)
    await sleep(12000)
    const [row] = await sql(`select status, mp_payment_id from payments where user_id = '${socioId}' and provider = 'pagomedios' order by created_at desc limit 1`)
    await shot('4.2-despues')
    record('4.2', row?.status === 'approved', `pago ${row?.status ?? '—'}${row?.mp_payment_id ? ', autorización ' + row.mp_payment_id : ''}`)
  })
  await step('4.3', async () => {
    await toApp()
    await waitFor(async () => /comprobante|aprobado|pago exitoso/i.test(await text()), 20000, 'comprobante')
    const t = await text(); await shot('4.3-comprobante')
    record('4.3', /\$15/.test(t) && /autorizaci/i.test(t), 'la pantalla se cerró sola y muestra el comprobante')
  })
  await step('4.4', async () => {
    await click(btn('/Ir a Mi Plan/'))
    await waitFor(async () => (await url()) === '/membresia' && /Historial de pagos/i.test(await text()), 20000, 'Mi Plan')
    const t = await text(); await shot('4.4-mi-plan')
    record('4.4', /Zero Start Mensual/.test(t) && /Tarjeta en línea/i.test(t) && /Aprobado/i.test(t), 'plan nuevo (o en cola) e historial «Tarjeta en línea · Aprobado»')
  })
  await step('4.5', async () => {
    await go(`/membresia/pago?planId=${PLAN}`)
    await waitFor(async () => !!(await js(byLabelJs, ['Número de identificación'])), 30000, 'checkout')
    await type('Número de identificación', '1710034065'); await type('Celular', '0987569852'); await type('Dirección', 'Av. Amazonas N34-120, Quito')
    await acceptTerms()
    await click(btn('/^Pagar/')); await sleep(6000)
    await wd('POST', `${S}/context`, { name: 'NATIVE_APP' })
    const close = await wd('POST', `${S}/element`, { using: '-ios predicate string', value: "type == 'XCUIElementTypeButton' AND (label ==[c] 'Cerrar' OR label ==[c] 'Close' OR label ==[c] 'Done' OR label ==[c] 'Listo' OR name ==[c] 'close')" }).catch(() => null)
    if (!close) throw new Error('no encontré el botón para cerrar la pantalla de pago')
    await wd('POST', `${S}/element/${close[ELEM]}/click`, {}); await sleep(3000)
    await toApp()
    const t = await text(); await shot('4.5-cerrar')
    record('4.5', /pendiente/i.test(t) && /Volver a verificar/.test(t), 'vuelve a la app con el pago pendiente y «Volver a verificar»')
  })

  // ---------- 5. Pago en recepción ----------
  await step('5.1', async () => {
    await go(`/membresia/pago?planId=${PLAN}`)
    await waitFor(async () => /Efectivo en recepción/.test(await text()), 30000, 'checkout')
    await click(`return [...document.querySelectorAll('[role=radio]')].find(r=>/Efectivo en recepción/.test(r.textContent)) || null`)
    await acceptTerms()
    await click(btn('/Confirmar solicitud/'))
    await waitFor(async () => /Solicitud enviada/i.test(await text()), 15000, 'solicitud enviada')
    await shot('5.1-solicitud'); record('5.1', true, '«Solicitud enviada · Paga en recepción»')
  })
  await step('5.2', async () => {
    await go('/membresia'); await sleep(2500)
    const t = await text(); await shot('5.2-mi-plan')
    record('5.2', /Solicitud enviada/i.test(t) && /Efectivo/.test(t), 'Mi Plan muestra la solicitud en efectivo')
  })

  // ---------- 6. Estabilidad ----------
  await collectErrors()
  record('6.1', errors.length === 0, errors.length ? errors.slice(0, 3).join(' | ') : 'sin errores de JavaScript capturados')
  const state = await wd('POST', `${S}/execute/sync`, { script: 'mobile: queryAppState', args: [{ bundleId: 'com.reservasgym.zonacero' }] }).catch(() => null)
  record('6.2', state === 4, `estado de la app: ${state} (4 = en primer plano)`)
} catch (e) {
  log('ERROR general', e.message)
  await shot('99-error').catch(() => {})
} finally {
  await wd('DELETE', S).catch(() => {})
  // QA como estaba: pagos del socio creados en esta corrida y membresías.
  const del = await sql(`delete from payments where user_id = '${socioId}' and created_at >= '${startedAt}' returning id`)
  await sql(`delete from memberships where user_id = '${socioId}' and id not in (${snapshot.map((m) => `'${m.id}'`).join(',') || `''`})`)
  for (const m of snapshot) {
    await sql(`update memberships set plan_id = '${m.plan_id}', status = '${m.status}', starts_at = '${m.starts_at}', ends_at = '${m.ends_at}',
      grace_ends_at = ${m.grace_ends_at ? `'${m.grace_ends_at}'` : 'null'}, visits_left = ${m.visits_left ?? 'null'} where id = '${m.id}'`)
  }
  log('limpieza QA:', Array.isArray(del) ? `${del.length} pagos borrados` : JSON.stringify(del).slice(0, 120), `${snapshot.length} membresías restauradas`)
  fs.writeFileSync(`${OUT}/resultados.json`, JSON.stringify(results, null, 2))
  console.log('RESUMEN', results.map((r) => `${r.id}:${r.result}`).join(' '))
}
