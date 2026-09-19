// create-datafast-checkout — COPYandPay (Dataweb Ecuador)
// Secrets: DATAFAST_ENTITY_ID, DATAFAST_ACCESS_TOKEN, DATAFAST_MID, DATAFAST_TID,
//          DATAFAST_BASE_URL (default https://test.oppwa.com), APP_URL
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const entityId = Deno.env.get("DATAFAST_ENTITY_ID")?.trim()
    const accessToken = Deno.env.get("DATAFAST_ACCESS_TOKEN")?.trim()
    const mid = Deno.env.get("DATAFAST_MID")?.trim()
    const tid = Deno.env.get("DATAFAST_TID")?.trim()
    const baseUrl = (
      Deno.env.get("DATAFAST_BASE_URL") ?? "https://test.oppwa.com"
    ).replace(/\/$/, "")
    const appUrl = (
      Deno.env.get("APP_URL") ?? "https://zona-cero-qa.vercel.app"
    ).replace(/\/$/, "")

    if (!entityId || !accessToken || !mid || !tid) {
      return json(
        {
          error:
            "Datafast no configurado. Faltan secrets DATAFAST_ENTITY_ID / ACCESS_TOKEN / MID / TID.",
          code: "DATAFAST_NOT_CONFIGURED",
        },
        503,
      )
    }

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ error: "No autorizado" }, 401)

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) return json({ error: "Sesión inválida" }, 401)

    const body = (await req.json()) as {
      planId?: string
      phone?: string
      identification?: string
      street?: string
      givenName?: string
      surname?: string
    }

    const planId = body.planId?.trim()
    const phone = (body.phone ?? "").replace(/\D/g, "")
    const identification = (body.identification ?? "").replace(/\D/g, "")
    const street = (body.street ?? "Quito").trim() || "Quito"

    if (!planId) return json({ error: "planId requerido" }, 400)
    if (phone.length < 9) {
      return json({ error: "Teléfono inválido (mín. 9 dígitos)" }, 400)
    }
    if (identification.length < 10) {
      return json({ error: "Cédula/RUC inválido (mín. 10 dígitos)" }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle()

    const fullName =
      (body.givenName && body.surname
        ? `${body.givenName} ${body.surname}`
        : profile?.full_name) ||
      user.email?.split("@")[0] ||
      "Socio"
    const parts = fullName.trim().split(/\s+/)
    const givenName = (body.givenName ?? parts[0] ?? "Socio").slice(0, 40)
    const surname = (
      body.surname ?? (parts.length > 1 ? parts.slice(1).join(" ") : parts[0]) ??
      "ZonaCero"
    ).slice(0, 40)

    const { data: plan, error: planError } = await admin
      .from("membership_plans")
      .select("id, name, price_cents, duration_days, active")
      .eq("id", planId)
      .single()

    if (planError || !plan || !plan.active) {
      return json({ error: "Plan no encontrado o inactivo" }, 404)
    }
    if (!plan.price_cents || plan.price_cents < 100) {
      return json({ error: "Monto mínimo $1.00" }, 400)
    }

    const amount = (plan.price_cents / 100).toFixed(2)
    const merchantTxId = `zc_${user.id.slice(0, 8)}_${Date.now()}`

    const { data: payment, error: payError } = await admin
      .from("payments")
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        membership_id: null,
        amount_cents: plan.price_cents,
        status: "pending",
        provider: "datafast",
        manual_method: null,
        reference: merchantTxId,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (payError || !payment) {
      return json({ error: payError?.message ?? "No se pudo crear el pago" }, 500)
    }

    const form = new URLSearchParams()
    form.set("entityId", entityId)
    form.set("amount", amount)
    form.set("currency", "USD")
    form.set("paymentType", "DB")
    form.set("merchantTransactionId", merchantTxId)
    form.set("customer.email", user.email ?? profile?.email ?? "")
    form.set("customer.givenName", givenName)
    form.set("customer.surname", surname)
    form.set("customer.merchantCustomerId", user.id.replace(/-/g, "").slice(0, 48))
    form.set("customer.identificationDocType", "IDCARD")
    form.set("customer.identificationDocId", identification.slice(0, 13))
    form.set("customer.phone", phone.slice(0, 15))
    form.set("billing.street1", street.slice(0, 50))
    form.set("billing.country", "EC")
    form.set("shipping.street1", street.slice(0, 50))
    form.set("shipping.country", "EC")
    form.set("customParameters[SHOPPER_MID]", mid)
    form.set("customParameters[SHOPPER_TID]", tid)
    // Solo en test (fase 2); en prod no enviar testMode
    if (baseUrl.includes("test.")) {
      form.set("testMode", "EXTERNAL")
    }

    const dfRes = await fetch(`${baseUrl}/v1/checkouts`, {
      method: "POST",
      headers: {
        Authorization: accessToken.startsWith("Bearer ")
          ? accessToken
          : `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    })

    const dfBody = await dfRes.json()
    if (!dfRes.ok || !dfBody?.id) {
      await admin.from("payments").update({ status: "rejected" }).eq("id", payment.id)
      return json(
        {
          error: "Datafast rechazó la creación del checkout",
          detail: dfBody,
        },
        502,
      )
    }

    const checkoutId = String(dfBody.id)
    await admin
      .from("payments")
      .update({ reference: `${merchantTxId}|${checkoutId}` })
      .eq("id", payment.id)

    return json({
      checkoutId,
      paymentId: payment.id,
      widgetScriptUrl: `${baseUrl}/v1/paymentWidgets.js?checkoutId=${checkoutId}`,
      shopperResultUrl: `${appUrl}/membresia/pago?paymentId=${payment.id}`,
      amount,
      planName: plan.name,
    })
  } catch (err) {
    console.error(err)
    return json(
      { error: err instanceof Error ? err.message : "Error interno" },
      500,
    )
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}
