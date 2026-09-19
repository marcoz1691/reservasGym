// Supabase Edge Function: create Mercado Pago Checkout Pro preference.
// Secrets: MP_ACCESS_TOKEN, APP_URL (e.g. https://zona-cero-qa.vercel.app)
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
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN")?.trim()
    const appUrl = (Deno.env.get("APP_URL") ?? "https://zona-cero-qa.vercel.app").replace(
      /\/$/,
      "",
    )
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!

    if (!mpToken) {
      return json(
        {
          error:
            "Pasarela no configurada. Falta el secret MP_ACCESS_TOKEN en Supabase.",
          code: "MP_NOT_CONFIGURED",
        },
        503,
      )
    }

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return json({ error: "No autorizado" }, 401)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) {
      return json({ error: "Sesión inválida" }, 401)
    }

    const body = (await req.json()) as { planId?: string }
    const planId = body.planId?.trim()
    if (!planId) {
      return json({ error: "planId requerido" }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: plan, error: planError } = await admin
      .from("membership_plans")
      .select("id, name, price_cents, duration_days, visit_quota, active")
      .eq("id", planId)
      .single()

    if (planError || !plan || !plan.active) {
      return json({ error: "Plan no encontrado o inactivo" }, 404)
    }

    if (!plan.price_cents || plan.price_cents <= 0) {
      return json({ error: "El plan no tiene precio válido" }, 400)
    }

    const { data: payment, error: payError } = await admin
      .from("payments")
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        membership_id: null,
        amount_cents: plan.price_cents,
        status: "pending",
        provider: "mercadopago",
        manual_method: null,
        reference: null,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (payError || !payment) {
      return json({ error: payError?.message ?? "No se pudo crear el pago" }, 500)
    }

    const unitPrice = Number((plan.price_cents / 100).toFixed(2))
    const preferencePayload = {
      items: [
        {
          id: plan.id,
          title: `Membresía ${plan.name} — Zona Cero`,
          description: `Vigencia ${plan.duration_days} días`,
          quantity: 1,
          currency_id: "USD",
          unit_price: unitPrice,
        },
      ],
      payer: {
        email: user.email,
      },
      external_reference: payment.id,
      notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
      back_urls: {
        success: `${appUrl}/membresia?payment=success`,
        failure: `${appUrl}/membresia?payment=failure`,
        pending: `${appUrl}/membresia?payment=pending`,
      },
      auto_return: "approved",
      statement_descriptor: "ZONA CERO",
      metadata: {
        user_id: user.id,
        plan_id: plan.id,
        payment_id: payment.id,
      },
    }

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferencePayload),
    })

    const mpBody = await mpRes.json()
    if (!mpRes.ok) {
      await admin.from("payments").update({ status: "rejected" }).eq("id", payment.id)
      return json(
        {
          error: "Mercado Pago rechazó la preferencia",
          detail: mpBody,
        },
        502,
      )
    }

    const initPoint =
      Deno.env.get("MP_USE_SANDBOX") === "0"
        ? mpBody.init_point
        : (mpBody.sandbox_init_point ?? mpBody.init_point)

    if (!initPoint) {
      return json({ error: "MP no devolvió init_point" }, 502)
    }

    await admin
      .from("payments")
      .update({ reference: String(mpBody.id ?? "") })
      .eq("id", payment.id)

    return json({
      initPoint,
      paymentId: payment.id,
      preferenceId: mpBody.id,
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
