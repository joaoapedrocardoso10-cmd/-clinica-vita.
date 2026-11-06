import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid(),
  startsAt: z.string().datetime().optional(),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(2).max(6).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  patient: z.object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().min(8).max(30),
  }),
}).refine((data) => Boolean(data.startsAt) !== Boolean(data.dates?.length && data.time), {
  message: "Informe um horário único ou uma série recorrente válida.",
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "O agendamento online ainda está sendo configurado. Entre em contato com a clínica." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Não foi possível ler os dados do agendamento." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Confira o profissional, serviço, horário e seus dados." }, { status: 400 });

  const { serviceId, professionalId, startsAt, dates, time, patient } = parsed.data;
  const { data: service } = await supabase.from("services").select("id,duration_minutes,active").eq("id", serviceId).maybeSingle();
  if (!service?.active) return NextResponse.json({ error: "Esse serviço não está disponível." }, { status: 400 });

  const { data, error } = dates?.length
    ? await supabase.rpc("book_recurring_appointments", {
      p_service_id: serviceId,
      p_professional_id: professionalId,
      p_dates: dates,
      p_time: time,
      p_patient_name: patient.fullName,
      p_patient_email: patient.email,
      p_patient_phone: patient.phone,
    })
    : await supabase.rpc("book_appointment", {
      p_service_id: serviceId,
      p_professional_id: professionalId,
      p_starts_at: startsAt,
      p_patient_name: patient.fullName,
      p_patient_email: patient.email,
      p_patient_phone: patient.phone,
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
