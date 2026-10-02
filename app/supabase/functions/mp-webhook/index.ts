// Supabase Edge Function: Mercado Pago webhook → approve payment + extend membership.
// Secrets: MP_ACCESS_TOKEN (required). verify_jwt must be false (MP has no Supabase JWT).
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

Deno.serve(async (req: Request) => {
  // Always acknowledge quickly after processing to avoid MP retry storms.
  try {
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN")?.trim()
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    if (!mpToken) {
      console.error("MP_ACCESS_TOKEN missing")
      return new Response("ok", { status: 200 })
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const url = new URL(req.url)

    let topic = url.searchParams.get("topic") ?? url.searchParams.get("type")
    let mpId = url.searchParams.get("id") ?? url.searchParams.get("data.id")

    if (req.method === "POST") {
      try {
        const body = await req.json()
        topic = topic ?? body?.type ?? body?.topic ?? body?.action
        mpId =
          mpId ??
          body?.data?.id?.toString?.() ??
          body?.id?.toString?.() ??
          body?.resource?.split?.("/")?.pop?.()
        if (typeof topic === "string" && topic.includes("payment")) {
          topic = "payment"
        }
      } catch {
        // query-only notifications are fine
      }
    }

    if (!mpId || (topic && !String(topic).includes("payment") && topic !== "payment")) {
      // Ignore merchant_order etc. unless it's payment
      if (topic && !String(topic).toLowerCase().includes("payment")) {
        return new Response("ok", { status: 200 })
      }
      if (!mpId) return new Response("ok", { status: 200 })
    }

    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    })
    if (!payRes.ok) {
      console.error("MP payment fetch failed", await payRes.text())
      return new Response("ok", { status: 200 })
    }

    const mpPayment = await payRes.json()
    const externalRef = String(mpPayment.external_reference ?? "")
    const status = String(mpPayment.status ?? "")
    const mpPaymentId = String(mpPayment.id)

    if (!externalRef) {
      return new Response("ok", { status: 200 })
    }

    // Idempotency: already processed this MP payment
    const { data: byMp } = await admin
      .from("payments")
      .select("id, status")
      .eq("mp_payment_id", mpPaymentId)
      .maybeSingle()

    if (byMp?.status === "approved") {
      return new Response("ok", { status: 200 })
    }

    const { data: payment, error: payErr } = await admin
      .from("payments")
      .select("id, user_id, plan_id, status, amount_cents")
      .eq("id", externalRef)
      .maybeSingle()

    if (payErr || !payment) {
      console.error("Payment row not found", externalRef, payErr)
      return new Response("ok", { status: 200 })
    }

    if (status === "rejected" || status === "cancelled") {
      await admin
        .from("payments")
        .update({ status: "rejected", mp_payment_id: mpPaymentId })
        .eq("id", payment.id)
      return new Response("ok", { status: 200 })
    }

    if (status !== "approved") {
      // pending / in_process — keep pending
      await admin
        .from("payments")
        .update({ mp_payment_id: mpPaymentId })
        .eq("id", payment.id)
      return new Response("ok", { status: 200 })
    }

    if (payment.status === "approved" || payment.status === "refunded") {
      await admin
        .from("payments")
        .update({ mp_payment_id: mpPaymentId })
        .eq("id", payment.id)
      return new Response("ok", { status: 200 })
    }

    // Misma regla que recepción y Pagomedios (plan-rules.sql)
    const paidAt = new Date()
    const { data: mem, error: memError } = await admin.rpc("apply_plan_purchase", {
      p_user_id: payment.user_id,
      p_plan_id: payment.plan_id,
      p_paid_at: paidAt.toISOString(),
    })
    const queueConflict = memError && /plan en espera/i.test(memError.message)
    if (memError && !queueConflict) {
      console.error("apply_plan_purchase failed", memError)
      return new Response("ok", { status: 200 })
    }

    await admin
      .from("payments")
      .update({
        status: "approved",
        approved_at: paidAt.toISOString(),
        membership_id: mem?.id ?? null,
        mp_payment_id: mpPaymentId,
        provider: "mercadopago",
        ...(queueConflict
          ? { notes: "Requiere revisión: ya había otro plan en espera al aprobar el pago." }
          : {}),
      })
      .eq("id", payment.id)

    return new Response("ok", { status: 200 })
  } catch (err) {
    console.error(err)
    return new Response("ok", { status: 200 })
  }
})
