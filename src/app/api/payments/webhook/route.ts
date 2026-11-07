import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";


function secureSignature(secret: string, signature: string | null, requestId: string | null, paymentId: string | null) {
  if (!signature || !requestId || !paymentId) return false;
  const values = Object.fromEntries(signature.split(",").map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? ["", ""] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }));
  const timestamp = values.ts;
  const received = values.v1;
  if (!timestamp || !received || !/^[a-f0-9]{64}$/i.test(received)) return false;
  const manifest = "id:" + paymentId.toLowerCase() + ";request-id:" + requestId + ";ts:" + timestamp + ";";
  const expected = createHmac("sha256", secret).update(manifest).digest();
  const supplied = Buffer.from(received, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function POST(request: Request) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const admin = createSupabaseAdminClient();
  if (!secret || !accessToken || !admin) return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });
  const url = new URL(request.url);
  const paymentId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  if (!secureSignature(secret, request.headers.get("x-signature"), request.headers.get("x-request-id"), paymentId)) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  let payment: { id?: number | string; status?: string; external_reference?: string; currency_id?: string; transaction_amount?: number };
  try {
    const response = await fetch("https://api.mercadopago.com/v1/payments/" + encodeURIComponent(paymentId!), {
      headers: { Authorization: "Bearer " + accessToken }, cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "Não foi possível validar o pagamento." }, { status: 502 });
    payment = await response.json() as typeof payment;
  } catch {
    return NextResponse.json({ error: "Não foi possível validar o pagamento." }, { status: 502 });
  }
  if (String(payment.id) !== paymentId) return NextResponse.json({ error: "Identificador de pagamento divergente." }, { status: 400 });

  const appointmentId = payment.external_reference;
  if (!appointmentId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(appointmentId)) {
    return NextResponse.json({ error: "Referência de consulta inválida." }, { status: 400 });
  }
  const { data: appointment, error } = await admin.from("appointments")
    .select("id,status,payment_status,payment_expires_at,payment_amount_cents")
    .eq("id", appointmentId).eq("payment_method", "online").maybeSingle();
  if (error || !appointment) return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 });

  const status = payment.status ?? "";
  const approved = status === "approved";
  if (approved && (payment.currency_id !== "BRL" || Math.round((payment.transaction_amount ?? -1) * 100) !== appointment.payment_amount_cents)) {
    return NextResponse.json({ error: "Valor ou moeda não conferem." }, { status: 400 });
  }
  const mappedStatus = status === "approved" ? "approved" : status === "refunded" || status === "charged_back" ? "refunded" : status === "cancelled" ? "cancelled" : status === "rejected" ? "rejected" : "pending";
  const stillReserved = appointment.status === "pending" && (!appointment.payment_expires_at || new Date(appointment.payment_expires_at).getTime() > Date.now());
  const update: Record<string, unknown> = {
    payment_status: mappedStatus,
    payment_provider_payment_id: String(payment.id),
    updated_at: new Date().toISOString(),
  };
  if (approved && stillReserved) update.status = "confirmed";
  else if (approved && appointment.status === "pending") update.status = "cancelled";
  if (approved || mappedStatus === "refunded" || mappedStatus === "cancelled") update.payment_expires_at = null;
  const { error: updateError } = await admin.from("appointments").update(update).eq("id", appointmentId);
  if (updateError) return NextResponse.json({ error: "Não foi possível registrar o estado do pagamento." }, { status: 500 });
  return NextResponse.json({ received: true });
}
