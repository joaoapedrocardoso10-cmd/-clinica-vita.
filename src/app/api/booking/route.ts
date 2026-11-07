import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PATIENT_PHONE_PATTERN } from "@/lib/phone";

const schema = z.object({
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid(),
  bookingMethod: z.enum(["whatsapp", "online"]).default("whatsapp"),
  startsAt: z.string().datetime().optional(),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(2).max(6).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  patient: z.object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().regex(PATIENT_PHONE_PATTERN, "Informe somente 10 a 13 números, incluindo DDD."),
  }),
}).refine((data) => Boolean(data.startsAt) !== Boolean(data.dates?.length && data.time), {
  message: "Informe um horário único ou uma série recorrente válida.",
});

function siteOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  try { return new URL(configured || request.url).origin; } catch { return new URL(request.url).origin; }
}
function validCheckoutUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const allowed = host === "mercadopago.com.br" || host.endsWith(".mercadopago.com.br") || host === "mercadopago.com" || host.endsWith(".mercadopago.com");
    return url.protocol === "https:" && allowed ? url.toString() : null;
  } catch { return null; }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "O agendamento online ainda está sendo configurado. Entre em contato com a clínica." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Não foi possível ler os dados do agendamento." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Confira o profissional, serviço, horário e seus dados." }, { status: 400 });

  const { serviceId, professionalId, startsAt, dates, time } = parsed.data;
  const bookingMethod = parsed.data.bookingMethod;
  let patient = parsed.data.patient;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: linked, error: linkError } = await supabase.rpc("ensure_my_patient_profile");
    if (linkError || linked !== true) return NextResponse.json({ error: "Confirme o e-mail da sua conta antes de agendar." }, { status: 403 });
    const { data: profile, error: profileError } = await supabase.from("patients").select("full_name,email,phone").eq("auth_user_id", user.id).maybeSingle();
    if (profileError || !profile || !user.email) return NextResponse.json({ error: "Não foi possível carregar o perfil da sua conta." }, { status: 403 });
    patient = { fullName: profile.full_name, email: user.email, phone: parsed.data.patient.phone };
  }

  const { data: service } = await supabase.from("services").select("id,name,duration_minutes,price_cents,active").eq("id", serviceId).maybeSingle();
  if (!service?.active) return NextResponse.json({ error: "Esse serviço não está disponível." }, { status: 400 });
  if (bookingMethod === "online" && dates?.length) return NextResponse.json({ error: "O checkout online está disponível para uma consulta por vez. Para séries, escolha WhatsApp." }, { status: 400 });

  const paymentAdmin = bookingMethod === "online" ? createSupabaseAdminClient() : null;
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (bookingMethod === "online" && (!accessToken || !webhookSecret || !paymentAdmin)) {
    return NextResponse.json({ error: "O pagamento online ainda não foi conectado pela clínica. Escolha WhatsApp ou peça à clínica para configurar o checkout." }, { status: 503 });
  }
  if (bookingMethod === "online" && (service.price_cents == null || service.price_cents <= 0)) {
    return NextResponse.json({ error: "Este serviço ainda não tem um preço configurado para pagamento online." }, { status: 400 });
  }

  if (user && patient.phone !== parsed.data.patient.phone) {
    const { error } = await supabase.rpc("update_my_patient_profile", { p_full_name: patient.fullName, p_phone: parsed.data.patient.phone });
    if (error) return NextResponse.json({ error: "Atualize seu telefone e tente novamente." }, { status: 400 });
  }

  if (bookingMethod === "online") {
    const { data: appointmentId, error } = await supabase.rpc("book_appointment_with_payment", {
      p_service_id: serviceId, p_professional_id: professionalId, p_starts_at: startsAt,
      p_patient_name: patient.fullName, p_patient_email: patient.email, p_patient_phone: patient.phone,
    });
    if (error || typeof appointmentId !== "string") {
      if (error && (error.code === "23505" || error.code === "23P01" || error.message.toLowerCase().includes("slot_unavailable"))) {
        return NextResponse.json({ error: "Esse horário acabou de ser reservado. Escolha outro horário disponível." }, { status: 409 });
      }
      console.error("Online appointment reservation failed:", error?.code ?? "unknown");
      return NextResponse.json({ error: "Não foi possível reservar o horário. Tente novamente." }, { status: 500 });
    }

    const origin = siteOrigin(request);
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    const preference = {
      items: [{ id: service.id, title: service.name, quantity: 1, currency_id: "BRL", unit_price: service.price_cents! / 100 }],
      payer: { email: patient.email, name: patient.fullName },
      external_reference: appointmentId,
      statement_descriptor: "CLINICAVITA",
      notification_url: origin + "/api/payments/webhook",
      back_urls: {
        success: origin + "/agendar/retorno?appointment=" + appointmentId,
        pending: origin + "/agendar/retorno?appointment=" + appointmentId,
        failure: origin + "/agendar/retorno?appointment=" + appointmentId,
      },
      auto_return: "approved",
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: expiresAt,
    };
    let paymentResponse: Response;
    try {
      paymentResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify(preference),
        cache: "no-store",
      });
    } catch {
      await paymentAdmin!.from("appointments").update({ status: "cancelled", payment_status: "cancelled" }).eq("id", appointmentId);
      return NextResponse.json({ error: "O checkout está temporariamente indisponível. O horário foi liberado; tente novamente ou escolha WhatsApp." }, { status: 502 });
    }
    const checkout = await paymentResponse.json().catch(() => ({})) as { init_point?: unknown; id?: string };
    const checkoutUrl = paymentResponse.ok ? validCheckoutUrl(checkout.init_point) : null;
    if (!checkoutUrl) {
      await paymentAdmin!.from("appointments").update({ status: "cancelled", payment_status: "cancelled" }).eq("id", appointmentId);
      console.error("Mercado Pago preference creation failed:", paymentResponse.status);
      return NextResponse.json({ error: "Não foi possível abrir o checkout. O horário foi liberado; tente novamente ou escolha WhatsApp." }, { status: 502 });
    }
    await paymentAdmin!.from("appointments").update({ payment_provider_preference_id: checkout.id ?? null }).eq("id", appointmentId);
    return NextResponse.json({ ok: true, appointmentId, checkoutUrl });
  }

  const { data, error } = dates?.length
    ? await supabase.rpc("book_recurring_appointments", {
      p_service_id: serviceId, p_professional_id: professionalId, p_dates: dates, p_time: time,
      p_patient_name: patient.fullName, p_patient_email: patient.email, p_patient_phone: patient.phone,
    })
    : await supabase.rpc("book_appointment", {
      p_service_id: serviceId, p_professional_id: professionalId, p_starts_at: startsAt,
      p_patient_name: patient.fullName, p_patient_email: patient.email, p_patient_phone: patient.phone,
    });
  if (error) {
    if (error.code === "23505" || error.code === "23P01" || error.message.toLowerCase().includes("slot_unavailable")) {
      return NextResponse.json({ error: "Esse horário acabou de ser reservado. Escolha outro horário disponível." }, { status: 409 });
    }
    console.error("Appointment creation failed:", error.code, error.message);
    return NextResponse.json({ error: "Não foi possível confirmar agora. Tente novamente mais tarde." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, appointmentId: data, appointmentIds: dates?.length ? data : [data], recurringCount: dates?.length ?? 1 });
}
