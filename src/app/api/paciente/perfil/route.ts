import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ fullName: z.string().trim().min(2).max(120), phone: z.string().trim().min(8).max(30) });
export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "O portal não está conectado ao Supabase." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
  const parsed = schema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: "Confira seu nome e telefone." }, { status: 400 });
  const { data, error } = await supabase.rpc("update_my_patient_profile", { p_full_name: parsed.data.fullName, p_phone: parsed.data.phone });
  if (error || !data) return NextResponse.json({ error: "Não foi possível atualizar seu perfil." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
