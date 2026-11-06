import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ id: z.string().uuid(), decision: z.enum(["approved", "declined"]) });

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "O banco da clínica não está conectado." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre no painel para continuar." }, { status: 401 });
  const { data: staff } = await supabase.from("staff_profiles").select("role,active").eq("user_id", user.id).maybeSingle();
  if (!staff?.active || !["admin", "receptionist"].includes(staff.role)) return NextResponse.json({ error: "Você não tem permissão para revisar pedidos." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Confira a solicitação e tente novamente." }, { status: 400 });
  const { data, error } = await supabase.rpc("review_patient_appointment_request", {
    p_request_id: parsed.data.id,
    p_decision: parsed.data.decision,
    p_actor: user.id,
  });
  if (error) {
    const unavailable = error.message.includes("requested_slot_unavailable");
    return NextResponse.json({ error: unavailable ? "Esse horário deixou de estar disponível. Entre em contato com o paciente para combinar outra opção." : "Não foi possível concluir a revisão. Atualize a lista e tente novamente." }, { status: unavailable ? 409 : 400 });
  }
  if (!data) return NextResponse.json({ error: "O pedido já foi analisado ou o horário não pode mais ser alterado." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
