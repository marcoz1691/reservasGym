// Supabase Edge Function: Mercado Pago webhook → approve payment + extend membership.
// Secrets: MP_ACCESS_TOKEN (required). verify_jwt must be false (MP has no Supabase JWT).
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const GRACE_PERIOD_DAYS = 3

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

    if (payment.status === "approved") {
      await admin
        .from("payments")
        .update({ mp_payment_id: mpPaymentId })
        .eq("id", payment.id)
      return new Response("ok", { status: 200 })
    }

    const { data: plan, error: planError } = await admin
      .from("membership_plans")
      .select("id, duration_days, visit_quota")
      .eq("id", payment.plan_id)
      .single()

    if (planError || !plan) {
      console.error("Plan missing", payment.plan_id)
      return new Response("ok", { status: 200 })
    }

    const { data: memberships } = await admin
      .from("memberships")
      .select("*")
      .eq("user_id", payment.user_id)
      .order("ends_at", { ascending: false })
      .limit(5)

    const current =
      (memberships ?? []).find((m) => m.status === "active" || m.status === "grace") ??
      (memberships ?? [])[0] ??
      null

    const paidAt = new Date()
    const dates = extendMembership(current, plan, paidAt)

    const membershipPayload: Record<string, unknown> = {
      user_id: payment.user_id,
      plan_id: plan.id,
      starts_at: dates.startsAt,
      ends_at: dates.endsAt,
      grace_ends_at: dates.graceEndsAt,
      status: dates.status,
      visits_left: dates.visitsLeft,
    }
    if (current?.id) membershipPayload.id = current.id

    const { data: mem, error: memError } = await admin
      .from("memberships")
      .upsert(membershipPayload)
      .select("id")
      .single()

    if (memError) {
      console.error("Membership upsert failed", memError)
      return new Response("ok", { status: 200 })
    }

    await admin
      .from("payments")
      .update({
        status: "approved",
        approved_at: paidAt.toISOString(),
        membership_id: mem.id,
        mp_payment_id: mpPaymentId,
        provider: "mercadopago",
      })
      .eq("id", payment.id)

    return new Response("ok", { status: 200 })
  } catch (err) {
    console.error(err)
    return new Response("ok", { status: 200 })
  }
})

function extendMembership(
  current: {
    ends_at: string
    status: string
    visits_left: number | null
  } | null,
  plan: { duration_days: number; visit_quota: number | null },
  paidAt: Date,
) {
  const paidMs = paidAt.getTime()
  const isCurrentActive =
    Boolean(current) &&
    current!.status !== "cancelled" &&
    new Date(current!.ends_at).getTime() > paidMs

  const baseDate = isCurrentActive ? new Date(current!.ends_at) : paidAt
  const startsAtDate = isCurrentActive ? new Date(current!.ends_at) : paidAt
  const endDate = new Date(
    baseDate.getTime() + plan.duration_days * 24 * 60 * 60 * 1000,
  )
  const graceEndDate = new Date(
    endDate.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
  )

  let visitsLeft: number | null = null
  if (plan.visit_quota !== null && plan.visit_quota !== undefined) {
    if (
      isCurrentActive &&
      current?.visits_left !== null &&
      current?.visits_left !== undefined
    ) {
      visitsLeft = current.visits_left + plan.visit_quota
    } else {
      visitsLeft = plan.visit_quota
    }
  }

  return {
    startsAt: startsAtDate.toISOString(),
    endsAt: endDate.toISOString(),
    graceEndsAt: graceEndDate.toISOString(),
    status: "active" as const,
    visitsLeft,
  }
}
