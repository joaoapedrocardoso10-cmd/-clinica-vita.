import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ appointmentId: z.string().uuid(), requestType: z.enum(["cancel", "reschedule"]), candidateStartsAt: z.string().datetime().optional() }).refine((value) => value.requestType === "cancel" ? !value.candidateStartsAt : Boolean(value.candidateStartsAt), { message: "Escolha uma nova data para pedir remarcação." });
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "O portal não está conectado ao Supabase." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
  const parsed = schema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: "Confira o pedido e a nova data escolhida." }, { status: 400 });
  const { data: patient } = await supabase.from("patients").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!patient) return NextResponse.json({ error: "Não encontramos seu cadastro na clínica." }, { status: 404 });
  const { data: appointment } = await supabase.from("appointments").select("id,starts_at,status").eq("id", parsed.data.appointmentId).eq("patient_id", patient.id).maybeSingle();
  if (!appointment || !["pending", "confirmed"].includes(appointment.status)) return NextResponse.json({ error: "Este atendimento não aceita alterações pelo portal." }, { status: 404 });
  const minNoticeHours = parsed.data.requestType === "cancel" ? 4 : 24;
  if (new Date(appointment.starts_at).getTime() < Date.now() + minNoticeHours * 60 * 60 * 1000) return NextResponse.json({ error: `Solicite com pelo menos ${minNoticeHours} horas de antecedência. Fale com a clínica para ajuda.` }, { status: 400 });
  if (parsed.data.candidateStartsAt && new Date(parsed.data.candidateStartsAt).getTime() < Date.now() + 24 * 60 * 60 * 1000) return NextResponse.json({ error: "A nova data precisa ter pelo menos 24 horas de antecedência." }, { status: 400 });
  const { data, error } = await supabase.from("patient_appointment_requests").insert({ patient_id: patient.id, appointment_id: appointment.id, request_type: parsed.data.requestType, requested_starts_at: parsed.data.candidateStartsAt ?? null }).select("id").single();
  if (error?.code === "23505") return NextResponse.json({ error: "Você já tem um pedido pendente para este atendimento." }, { status: 409 });
  if (error || !data) return NextResponse.json({ error: "Não foi possível registrar o pedido. Tente novamente." }, { status: 400 });
  return NextResponse.json({ ok: true, requestId: data.id }, { status: 201 });
}
