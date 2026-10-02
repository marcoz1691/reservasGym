// verify-datafast-payment — consulta resourcePath y extiende membresía
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
    const baseUrl = (
      Deno.env.get("DATAFAST_BASE_URL") ?? "https://test.oppwa.com"
    ).replace(/\/$/, "")

    if (!entityId || !accessToken) {
      return json({ error: "Datafast no configurado", code: "DATAFAST_NOT_CONFIGURED" }, 503)
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
      paymentId?: string
      resourcePath?: string
    }
    const paymentId = body.paymentId?.trim()
    let resourcePath = body.resourcePath?.trim()
    if (!paymentId || !resourcePath) {
      return json({ error: "paymentId y resourcePath requeridos" }, 400)
    }
    if (!resourcePath.startsWith("/")) resourcePath = `/${resourcePath}`

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: payment, error: payErr } = await admin
      .from("payments")
      .select("id, user_id, plan_id, status, amount_cents, provider")
      .eq("id", paymentId)
      .maybeSingle()

    if (payErr || !payment) return json({ error: "Pago no encontrado" }, 404)
    if (payment.user_id !== user.id) return json({ error: "Sin permiso" }, 403)

    if (payment.status === "approved") {
      return json({ ok: true, alreadyApproved: true })
    }
    if (payment.status === "refunded") {
      return json({ ok: false, description: "El pago fue reembolsado." })
    }

    const url = `${baseUrl}${resourcePath}${resourcePath.includes("?") ? "&" : "?"}entityId=${encodeURIComponent(entityId)}`
    const dfRes = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: accessToken.startsWith("Bearer ")
          ? accessToken
          : `Bearer ${accessToken}`,
      },
    })
    const dfBody = await dfRes.json()
    if (!dfRes.ok) {
      return json({ error: "No se pudo verificar el pago en Datafast", detail: dfBody }, 502)
    }

    const resultCode = String(dfBody?.result?.code ?? "")
    const success =
      /^000\.000\./.test(resultCode) ||
      /^000\.100\.1/.test(resultCode) ||
      resultCode === "000.000.000"

    const dfPaymentId = String(dfBody?.id ?? dfBody?.ndc ?? resourcePath)

    if (!success) {
      await admin
        .from("payments")
        .update({
          status: "rejected",
          mp_payment_id: dfPaymentId.slice(0, 120),
        })
        .eq("id", payment.id)
      return json({
        ok: false,
        resultCode,
        description: dfBody?.result?.description ?? "Pago no aprobado",
      })
    }

    // Misma regla que recepción y Pagomedios (plan-rules.sql)
    const paidAt = new Date()
    const { data: mem, error: memError } = await admin.rpc("apply_plan_purchase", {
      p_user_id: payment.user_id,
      p_plan_id: payment.plan_id,
      p_paid_at: paidAt.toISOString(),
    })
    const queueConflict = memError && /plan en espera/i.test(memError.message)
    if (memError && !queueConflict) return json({ error: memError.message }, 500)

    await admin
      .from("payments")
      .update({
        status: "approved",
        approved_at: paidAt.toISOString(),
        membership_id: mem?.id ?? null,
        provider: "datafast",
        mp_payment_id: dfPaymentId.slice(0, 120),
        ...(queueConflict
          ? { notes: "Requiere revisión: ya había otro plan en espera al aprobar el pago." }
          : {}),
      })
      .eq("id", payment.id)

    return json({ ok: true, resultCode, membershipId: mem?.id ?? null })
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
