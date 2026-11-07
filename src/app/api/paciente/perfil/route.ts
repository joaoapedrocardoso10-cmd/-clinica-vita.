import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PATIENT_PHONE_PATTERN } from "@/lib/phone";

const schema = z.object({ fullName: z.string().trim().min(2).max(120), phone: z.string().trim().regex(PATIENT_PHONE_PATTERN, "Informe somente 10 a 13 números, incluindo DDD.") });
export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "O portal não está conectado ao Supabase." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  const { data: linked, error: linkError } = await supabase.rpc("ensure_my_patient_profile");
  if (linkError || linked !== true) return NextResponse.json({ error: "Confirme seu e-mail para usar o portal." }, { status: 409 });
  const { data: profile, error } = await supabase.from("patients").select("full_name,email,phone").eq("auth_user_id", user.id).maybeSingle();
  if (error || !profile) return NextResponse.json({ error: "Não foi possível carregar seu perfil." }, { status: 404 });
  return NextResponse.json({ profile });
}
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
