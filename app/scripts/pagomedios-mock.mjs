// Simulador local de Pagomedios API v2 para probar pagomedios-payment sin credenciales.
// Uso: npm run pagomedios:mock   (puerto 4010, o PORT=xxxx)
// Contrato: https://docs.abitmedia.cloud/pagomedios-referencia-api-v2/
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'

const PORT = Number(process.env.PORT ?? 4010)
// Latencia de la consulta de estado: fuerza que verificaciones concurrentes se crucen.
const STATUS_DELAY_MS = Number(process.env.STATUS_DELAY_MS ?? 0)
const BASE = `http://localhost:${PORT}`
const requests = new Map()

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => resolve(raw))
  })

const cents = (n) => Math.round(Number(n) * 100)

function validate(body) {
  const errors = []
  const required = [
    'integration', 'third', 'generate_invoice', 'description', 'amount',
    'amount_with_tax', 'amount_without_tax', 'tax_value', 'has_cards',
  ]
  for (const key of required) if (body[key] === undefined) errors.push(`${key} es requerido`)
  for (const key of ['document', 'document_type', 'name', 'email', 'phones', 'address', 'type']) {
    if (!body.third?.[key]) errors.push(`third.${key} es requerido`)
  }
  if (body.third && !['04', '05', '06', '08'].includes(body.third.document_type)) {
    errors.push('third.document_type inválido')
  }
  const sum = cents(body.amount_with_tax) + cents(body.amount_without_tax) + cents(body.tax_value)
  if (sum !== cents(body.amount)) {
    errors.push(`amount (${body.amount}) != amount_with_tax + amount_without_tax + tax_value (${sum / 100})`)
  }
  return errors
}

function payPage(token, pr) {
  const t = pr.body.third
  return `<!doctype html><html lang="es"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pagomedios (simulador)</title>
<style>
  body{font-family:system-ui;background:#f4f5f7;margin:0;padding:24px;color:#111}
  .card{max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:24px;box-shadow:0 4px 20px #0001}
  .tag{display:inline-block;background:#fff3cd;color:#8a6d00;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700}
  h1{font-size:20px;margin:12px 0 4px} .amount{font-size:32px;font-weight:800;margin:8px 0 16px}
  dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:13px;color:#555;margin:0 0 20px}
  button{display:block;width:100%;border:0;border-radius:12px;padding:12px;font-size:15px;font-weight:700;margin-top:10px;cursor:pointer}
  .ok{background:#16a34a;color:#fff} .ko{background:#dc2626;color:#fff} .silent{background:#e5e7eb;color:#111}
  small{display:block;color:#777;margin-top:4px}
</style>
<div class="card">
  <span class="tag">SIMULADOR LOCAL · no es Pagomedios real</span>
  <h1>${pr.body.description}</h1>
  <div class="amount">$${Number(pr.body.amount).toFixed(2)}</div>
  <dl>
    <dt>Cliente</dt><dd>${t.name}</dd>
    <dt>Identificación</dt><dd>${t.document_type} · ${t.document}</dd>
    <dt>Email</dt><dd>${t.email}</dd>
    <dt>Base IVA</dt><dd>$${pr.body.amount_with_tax} + IVA $${pr.body.tax_value}</dd>
    <dt>Sin IVA</dt><dd>$${pr.body.amount_without_tax}</dd>
  </dl>
  <form method="post" action="/pay/${token}/approve"><button class="ok">Pagar (tarjeta aprobada)</button></form>
  <form method="post" action="/pay/${token}/reject"><button class="ko">Tarjeta rechazada</button></form>
  <form method="post" action="/pay/${token}/approve-silent"><button class="silent">Aprobar sin notificar</button>
    <small>Simula que no llega el notify: el socio vuelve y usa «Volver a verificar».</small></form>
</div></html>`
}

function autoPostToNotify(pr) {
  const fields = {
    status: String(pr.status),
    reference: pr.reference,
    authorizationCode: pr.status === 1 ? pr.authCode : '',
    clientId: 'PM-SIMULADOR',
    transactionDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
    message: pr.status === 1 ? 'Transaccion aprobada' : 'Transaccion rechazada',
    amount: String(pr.body.amount),
    customValue: pr.body.custom_value ?? '',
    cardBrand: 'visa',
    cardNumber: '411111******1111',
  }
  const inputs = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${String(v).replace(/"/g, '&quot;')}">`)
    .join('')
  return `<!doctype html><meta charset="utf-8"><body onload="document.forms[0].submit()">
<p style="font-family:system-ui">Redirigiendo al comercio…</p>
<form method="post" action="${pr.body.notify_url}">${inputs}</form></body>`
}

createServer(async (req, res) => {
  const url = new URL(req.url, BASE)
  const path = url.pathname.replace(/^\/pagomedios\/v2/, '')

  if (path === '/payment-requests' || path === '/settings') {
    if (!/^Bearer \S+/.test(req.headers.authorization ?? '')) {
      return send(res, 401, { success: false, status: 401, message: 'Your request was made with invalid credentials.' })
    }
  }

  if (req.method === 'POST' && path === '/payment-requests') {
    const body = JSON.parse((await readBody(req)) || '{}')
    const errors = validate(body)
    if (errors.length) {
      console.log('✗ solicitud inválida:', errors)
      return send(res, 422, { success: false, status: 422, message: errors.join('; '), errors })
    }
    const token = `cha_${randomBytes(8).toString('hex')}`
    requests.set(token, {
      body,
      status: 0,
      reference: `PM-${Math.floor(100000 + Math.random() * 900000)}`,
      authCode: String(Math.floor(100000 + Math.random() * 900000)),
      createdAt: new Date().toISOString(),
    })
    console.log(`✓ solicitud ${token} · $${body.amount} · ${body.description} · notify=${body.notify_url}`)
    return send(res, 201, { success: true, status: 201, data: { token, url: `${BASE}/pay/${token}` } })
  }

  if (req.method === 'GET' && path === '/payment-requests') {
    if (STATUS_DELAY_MS) await new Promise((r) => setTimeout(r, STATUS_DELAY_MS))
    const pr = requests.get(url.searchParams.get('uuid') ?? '')
    if (!pr) return send(res, 200, { success: true, status: 200, data: [] })
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    return send(res, 200, {
      success: true,
      status: 200,
      data: [{
        status: pr.status,
        reference: pr.reference,
        description: pr.body.description,
        amount: String(pr.body.amount),
        livemode: 0,
        created_at: pr.createdAt,
        updated_at: now,
        transactions: pr.status === 0 ? [] : [{
          payment_date: now,
          status: pr.status,
          payment_id: '184841548',
          merchant_transaction_id: pr.reference,
          auth_code: pr.status === 1 ? pr.authCode : null,
          display_number: '411111******1111',
          cardholder: pr.body.third.name,
        }],
      }],
    })
  }

  if (req.method === 'GET' && path === '/settings') {
    return send(res, 200, { success: true, status: 200, data: [] })
  }

  const payMatch = path.match(/^\/pay\/(cha_[a-f0-9]+)(?:\/(approve|reject|approve-silent))?$/)
  if (payMatch) {
    const [, token, action] = payMatch
    const pr = requests.get(token)
    if (!pr) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      return res.end('Solicitud de pago no encontrada (¿reiniciaste el simulador?)')
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    if (!action) return res.end(payPage(token, pr))
    pr.status = action === 'reject' ? 2 : 1
    console.log(`→ ${token} ${action === 'reject' ? 'RECHAZADA' : 'AUTORIZADA'}${action === 'approve-silent' ? ' (sin notify)' : ''}`)
    if (action === 'approve-silent') {
      const back = pr.body.notify_url.replace(/[?&]action=notify.*/, '')
      return res.end(`<!doctype html><meta charset="utf-8"><p style="font-family:system-ui;padding:24px">
Pago autorizado en el simulador, pero NO se envió el notify.<br><br>
Vuelve a la app en <code>/membresia/pago?provider=pagomedios&amp;paymentId=${pr.body.custom_value}</code>
y pulsa «Volver a verificar».<br><br><small>Función: ${back}</small></p>`)
    }
    return res.end(autoPostToNotify(pr))
  }

  send(res, 404, { success: false, status: 404, message: 'Not found' })
}).listen(PORT, () => {
  console.log(`Simulador Pagomedios en ${BASE}  (PAGOMEDIOS_API_URL=${BASE})`)
})
