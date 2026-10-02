// pagomedios-payment — pago único con Pagomedios API v2 (Abitmedia)
// https://docs.abitmedia.cloud/pagomedios-referencia-api-v2/
//
// Secrets: PAGOMEDIOS_TOKEN, APP_URL, PAGOMEDIOS_TAX_RATE (default 0.15; 0 = sin IVA)
// Solo prueba local (scripts/pagomedios-mock.mjs): PAGOMEDIOS_API_URL, FUNCTION_PUBLIC_URL
// Desplegar SIN verificación JWT del gateway, porque Pagomedios llama a notify sin sesión:
//   supabase functions deploy pagomedios-payment --no-verify-jwt
// create/verify validan la sesión del socio manualmente.
//
// Acciones:
//   POST { action: "create", planId, document, documentType, phone, address, native? } (JWT)
//     → crea payments(pending) + solicitud Pagomedios y devuelve { url, paymentId }
//   POST { action: "verify", paymentId } (JWT)
//     → consulta Pagomedios y, si está autorizado, activa/extiende la membresía
//   POST|GET ?action=notify&paymentId=  (Pagomedios, sin JWT)
//     → nunca confía en el body: re-consulta Pagomedios con el token y redirige a la app
//       (con &native=1 muestra "cierra esta ventana": la app nativa verifica al cerrar el navegador)
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2"
import { splitTax } from "./tax.ts"

const PAGOMEDIOS_API = (
  Deno.env.get("PAGOMEDIOS_API_URL") ?? "https://api.abitmedia.cloud/pagomedios/v2"
).replace(/\/$/, "")
const DOCUMENT_TYPES = ["04", "05", "06", "08"] as const

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

type Env = {
  token: string
  appUrl: string
  taxRate: number
  supabaseUrl: string
  admin: SupabaseClient
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const token = Deno.env.get("PAGOMEDIOS_TOKEN")?.trim()
    const appUrl = (
      Deno.env.get("APP_URL") ?? "https://zona-cero-qa.vercel.app"
    ).replace(/\/$/, "")
    const taxRate = Number(Deno.env.get("PAGOMEDIOS_TAX_RATE") ?? "0.15")
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const admin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    const url = new URL(req.url)
    const queryAction = url.searchParams.get("action")

    if (!token) {
      if (queryAction === "notify") {
        return redirectToApp(appUrl, url.searchParams.get("paymentId"))
      }
      return json(
        {
          error: "Pagomedios no configurado. Falta el secret PAGOMEDIOS_TOKEN.",
          code: "PAGOMEDIOS_NOT_CONFIGURED",
        },
        503,
      )
    }

    const env: Env = { token, appUrl, taxRate, supabaseUrl, admin }

    if (queryAction === "notify") {
      return await handleNotify(req, url, env)
    }

    if (req.method !== "POST") return json({ error: "Método no permitido" }, 405)

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ error: "No autorizado" }, 401)
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) return json({ error: "Sesión inválida" }, 401)

    const body = (await req.json()) as Record<string, unknown>
    if (body.action === "create") {
      return await handleCreate(body, { id: user.id, email: user.email }, env)
    }
    if (body.action === "verify") {
      const paymentId = String(body.paymentId ?? "").trim()
      if (!paymentId) return json({ error: "paymentId requerido" }, 400)
      const { data: payment } = await admin
        .from("payments")
        .select("user_id")
        .eq("id", paymentId)
        .maybeSingle()
      if (!payment) return json({ error: "Pago no encontrado" }, 404)
      if (payment.user_id !== user.id) return json({ error: "Sin permiso" }, 403)
      return json(await verifyPayment(paymentId, env))
    }
    return json({ error: "Acción inválida" }, 400)
  } catch (err) {
    console.error(err)
    return json(
      { error: err instanceof Error ? err.message : "Error interno" },
      500,
    )
  }
})

async function handleCreate(
  body: Record<string, unknown>,
  user: { id: string; email?: string },
  env: Env,
) {
  const planId = String(body.planId ?? "").trim()
  const documentType = String(body.documentType ?? "05")
  const document = String(body.document ?? "").replace(/[^0-9A-Za-z]/g, "")
  const phone = String(body.phone ?? "").replace(/\D/g, "")
  const address = String(body.address ?? "").trim() || "Quito"
  const native = body.native === true

  if (!planId) return json({ error: "planId requerido" }, 400)
  if (!DOCUMENT_TYPES.includes(documentType as typeof DOCUMENT_TYPES[number])) {
    return json({ error: "Tipo de identificación inválido" }, 400)
  }
  if (documentType === "05" && document.length !== 10) {
    return json({ error: "La cédula debe tener 10 dígitos" }, 400)
  }
  if (documentType === "04" && document.length !== 13) {
    return json({ error: "El RUC debe tener 13 dígitos" }, 400)
  }
  if (document.length < 5) return json({ error: "Identificación inválida" }, 400)
  if (phone.length < 9) {
    return json({ error: "Teléfono inválido (mín. 9 dígitos)" }, 400)
  }

  const { admin } = env
  const { data: plan, error: planError } = await admin
    .from("membership_plans")
    .select("id, name, price_cents, active")
    .eq("id", planId)
    .single()
  if (planError || !plan || !plan.active) {
    return json({ error: "Plan no encontrado o inactivo" }, 404)
  }
  if (!plan.price_cents || plan.price_cents < 100) {
    return json({ error: "Monto mínimo $1.00" }, 400)
  }
  // Un solo plan en espera: no se cobra un segundo plan distinto (plan-rules.sql)
  const { data: blockReason, error: blockError } = await admin.rpc(
    "plan_purchase_block_reason",
    { p_user_id: user.id, p_plan_id: plan.id },
  )
  if (blockError) return json({ error: blockError.message }, 500)
  if (blockReason) return json({ error: blockReason, code: "PLAN_QUEUE_LIMIT" }, 409)

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle()
  const email = user.email ?? profile?.email ?? ""
  const name =
    profile?.full_name?.trim() || email.split("@")[0] || "Socio Zona Cero"

  const { data: payment, error: payError } = await admin
    .from("payments")
    .insert({
      user_id: user.id,
      plan_id: plan.id,
      membership_id: null,
      amount_cents: plan.price_cents,
      status: "pending",
      provider: "pagomedios",
      manual_method: null,
      reference: null,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single()
  if (payError || !payment) {
    return json({ error: payError?.message ?? "No se pudo crear el pago" }, 500)
  }

  const amounts = splitTax(plan.price_cents, env.taxRate)
  const functionUrl = (
    Deno.env.get("FUNCTION_PUBLIC_URL") ?? `${env.supabaseUrl}/functions/v1/pagomedios-payment`
  ).replace(/\/$/, "")
  const notifyUrl =
    `${functionUrl}?action=notify&paymentId=${payment.id}` + (native ? "&native=1" : "")

  const pmRes = await fetch(`${PAGOMEDIOS_API}/payment-requests`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      integration: true,
      third: {
        document,
        document_type: documentType,
        name: name.slice(0, 100),
        email,
        phones: phone.slice(0, 15),
        address: address.slice(0, 150),
        type: documentType === "04" ? "Company" : "Individual",
      },
      generate_invoice: 0,
      description: `Zona Cero - ${plan.name}`.slice(0, 150),
      ...amounts,
      settings: [],
      notify_url: notifyUrl,
      custom_value: payment.id,
      has_cards: 1,
    }),
  })
  const pmBody = await pmRes.json().catch(() => null)
  const pmToken = pmBody?.data?.token
  const pmUrl = pmBody?.data?.url
  if (!pmRes.ok || !pmBody?.success || !pmToken || !pmUrl) {
    await admin.from("payments").update({ status: "rejected" }).eq("id", payment.id)
    return json(
      {
        error: pmBody?.message ?? "Pagomedios rechazó la solicitud de pago",
        detail: pmBody,
      },
      502,
    )
  }

  await admin
    .from("payments")
    .update({ reference: String(pmToken) })
    .eq("id", payment.id)

  return json({ url: String(pmUrl), paymentId: payment.id })
}

async function handleNotify(req: Request, url: URL, env: Env) {
  let paymentId = url.searchParams.get("paymentId")
  if (!paymentId && req.method === "POST") {
    const form = await req.formData().catch(() => null)
    const custom = form?.get("customValue")
    if (typeof custom === "string") paymentId = custom
  }
  if (paymentId) {
    try {
      await verifyPayment(paymentId, env)
    } catch (err) {
      console.error("notify verify failed", err)
    }
  }
  if (url.searchParams.get("native") === "1") return closeWindowPage()
  return redirectToApp(env.appUrl, paymentId)
}

/** Comprobante que ve el socio al volver: qué compró, desde cuándo y hasta cuándo. */
type Receipt = {
  planName: string | null
  amountCents: number
  authorizationCode: string | null
  membershipStartsAt: string | null
  membershipEndsAt: string | null
}

type VerifyResult =
  | { ok: true; status: "approved"; membershipId?: string; receipt?: Receipt }
  | { ok: false; status: "pending" | "rejected"; description: string }

async function verifyPayment(paymentId: string, env: Env): Promise<VerifyResult> {
  const { admin } = env
  const { data: payment } = await admin
    .from("payments")
    .select("id, user_id, plan_id, status, provider, reference")
    .eq("id", paymentId)
    .maybeSingle()
  if (!payment || payment.provider !== "pagomedios") {
    return { ok: false, status: "rejected", description: "Pago no encontrado" }
  }
  if (payment.status === "approved") {
    return { ok: true, status: "approved", receipt: await receiptFor(payment.id, admin) }
  }
  // Recepción lo marcó reembolsado: un notify tardío no lo vuelve a aprobar
  if (payment.status === "refunded") {
    return { ok: false, status: "rejected", description: "El pago fue reembolsado." }
  }
  if (!payment.reference) {
    return { ok: false, status: "rejected", description: "Pago sin solicitud Pagomedios" }
  }

  const query = new URLSearchParams({ integration: "true", uuid: payment.reference })
  const pmRes = await fetch(`${PAGOMEDIOS_API}/payment-requests?${query}`, {
    headers: { Authorization: `Bearer ${env.token}`, Accept: "application/json" },
  })
  const pmBody = await pmRes.json().catch(() => null)
  const request = Array.isArray(pmBody?.data) ? pmBody.data[0] : null
  if (!pmRes.ok || !request) {
    return {
      ok: false,
      status: "pending",
      description: "No se pudo consultar el estado en Pagomedios. Intenta de nuevo.",
    }
  }

  const pmStatus = Number(request.status)
  if (pmStatus === 0) {
    return { ok: false, status: "pending", description: "Pago pendiente de confirmación." }
  }
  if (pmStatus !== 1) {
    if (payment.status === "pending") {
      await admin
        .from("payments")
        .update({ status: "rejected" })
        .eq("id", payment.id)
        .eq("status", "pending")
    }
    return {
      ok: false,
      status: "rejected",
      description: pmStatus === 3 ? "El pago fue reversado." : "El pago fue rechazado.",
    }
  }

  const transaction = Array.isArray(request.transactions)
    ? request.transactions.find((t: { status?: number }) => Number(t?.status) === 1) ??
      request.transactions[0]
    : null
  const authCode = String(
    transaction?.auth_code ?? transaction?.merchant_transaction_id ?? request.reference ?? "",
  ).slice(0, 120)
  const paidAt = new Date()

  // Reclamo atómico: notify y verify pueden llegar a la vez; solo uno extiende la membresía.
  const { data: claimed } = await admin
    .from("payments")
    .update({
      status: "approved",
      approved_at: paidAt.toISOString(),
      mp_payment_id: authCode || null,
    })
    .eq("id", payment.id)
    .in("status", ["pending", "rejected"])
    .select("id")
  if (!claimed || claimed.length === 0) {
    return { ok: true, status: "approved", receipt: await receiptFor(payment.id, admin) }
  }

  try {
    const membershipId = await applyPlanPurchase(payment, paidAt, admin)
    if (!membershipId) {
      // Carrera: entró otro plan en espera entre el cobro y la aprobación. El dinero
      // ya se cobró: el pago queda aprobado sin membresía para que recepción lo revise.
      await admin
        .from("payments")
        .update({ notes: "Requiere revisión: ya había otro plan en espera al aprobar el pago." })
        .eq("id", payment.id)
      return { ok: true, status: "approved", receipt: await receiptFor(payment.id, admin) }
    }
    await admin
      .from("payments")
      .update({ membership_id: membershipId })
      .eq("id", payment.id)
    // Una solicitud de "pago en recepción" que seguía pendiente ya no aplica:
    // el socio pagó en línea. Sin esto Mi Plan seguiría diciendo "Solicitud enviada".
    await admin
      .from("payments")
      .delete()
      .eq("user_id", payment.user_id)
      .eq("provider", "manual")
      .eq("status", "pending")
      .is("membership_id", null)
    return {
      ok: true,
      status: "approved",
      membershipId,
      receipt: await receiptFor(payment.id, admin),
    }
  } catch (err) {
    await admin
      .from("payments")
      .update({ status: "pending", approved_at: null })
      .eq("id", payment.id)
    throw err
  }
}

async function receiptFor(paymentId: string, admin: SupabaseClient): Promise<Receipt | undefined> {
  const { data: payment } = await admin
    .from("payments")
    .select("plan_id, membership_id, amount_cents, mp_payment_id")
    .eq("id", paymentId)
    .maybeSingle()
  if (!payment) return undefined
  const [{ data: plan }, { data: membership }] = await Promise.all([
    admin.from("membership_plans").select("name").eq("id", payment.plan_id).maybeSingle(),
    payment.membership_id
      ? admin
        .from("memberships")
        .select("starts_at, ends_at")
        .eq("id", payment.membership_id)
        .maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  return {
    planName: plan?.name ?? null,
    amountCents: payment.amount_cents,
    authorizationCode: payment.mp_payment_id ?? null,
    membershipStartsAt: membership?.starts_at ?? null,
    membershipEndsAt: membership?.ends_at ?? null,
  }
}

/**
 * Misma regla que recepción: apply_plan_purchase (plan-rules.sql) decide si suma
 * días, deja el plan en espera o crea un pase del día. Devuelve null si la base
 * lo rechaza porque ya hay otro plan en espera.
 */
async function applyPlanPurchase(
  payment: { user_id: string; plan_id: string },
  paidAt: Date,
  admin: SupabaseClient,
): Promise<string | null> {
  const { data, error } = await admin.rpc("apply_plan_purchase", {
    p_user_id: payment.user_id,
    p_plan_id: payment.plan_id,
    p_paid_at: paidAt.toISOString(),
  })
  if (error) {
    if (/plan en espera/i.test(error.message)) return null
    throw new Error(error.message)
  }
  if (!data?.id) throw new Error("No se pudo activar la membresía")
  return data.id as string
}

function redirectToApp(appUrl: string, paymentId: string | null) {
  const target = paymentId
    ? `${appUrl}/membresia/pago?provider=pagomedios&paymentId=${encodeURIComponent(paymentId)}`
    : `${appUrl}/membresia`
  return new Response(null, { status: 303, headers: { Location: target } })
}

/**
 * Fin del pago dentro de la pantalla de pago de la app nativa. Se cierra sola con
 * window.mobileApp.close() (lo inyecta @capgo/inappbrowser); si no, el socio la
 * cierra con la X. Al cerrarse, la app verifica el pago.
 */
function closeWindowPage() {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Pago recibido</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0 24px;text-align:center;color:#1c1917}
h1{font-size:1.4rem;margin:0 0 .5rem}p{color:#57534e;margin:0}</style></head>
<body><div><h1>Pago recibido</h1><p>Cierra esta ventana para volver a la app de Zona Cero.</p></div>
<script>(function(){var n=0,t=setInterval(function(){var m=window.mobileApp;if(m&&m.close){clearInterval(t);m.close()}else if(++n>50){clearInterval(t)}},100)})()</script>
</body></html>`
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}
