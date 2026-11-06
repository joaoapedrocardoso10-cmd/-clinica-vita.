import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function staffClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { response: NextResponse.json({ error: "O banco da clínica não está conectado." }, { status: 503 }) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Entre no painel para continuar." }, { status: 401 }) };
  const { data: staff } = await supabase.from("staff_profiles").select("role,active").eq("user_id", user.id).maybeSingle();
  if (!staff?.active || !["admin", "receptionist"].includes(staff.role)) return { response: NextResponse.json({ error: "Você não tem permissão para gerenciar cadastros." }, { status: 403 }) };
  return { supabase, user };
}

export async function GET(request: Request) {
  const access = await staffClient();
  if ("response" in access) return access.response;
  const term = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (!term) {
    const { data, error } = await access.supabase.from("patients").select("id,full_name,email,phone,created_at").order("created_at", { ascending: false }).limit(100);
    if (error) return NextResponse.json({ error: "Não foi possível buscar os cadastros." }, { status: 400 });
    return NextResponse.json({ patients: data ?? [] });
  }
  const pattern = `%${term}%`;
  const [byName, byPhone, byEmail] = await Promise.all([
    access.supabase.from("patients").select("id,full_name,email,phone,created_at").ilike("full_name", pattern).limit(100),
    access.supabase.from("patients").select("id,full_name,email,phone,created_at").ilike("phone", pattern).limit(100),
    access.supabase.from("patients").select("id,full_name,email,phone,created_at").ilike("email", pattern).limit(100),
  ]);
  if (byName.error || byPhone.error || byEmail.error) return NextResponse.json({ error: "Não foi possível buscar os cadastros." }, { status: 400 });
  const results = new Map([...(byName.data ?? []), ...(byPhone.data ?? []), ...(byEmail.data ?? [])].map((patient) => [patient.id, patient]));
  return NextResponse.json({ patients: [...results.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100) });
}

const createSchema = z.object({ fullName: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254), phone: z.string().trim().min(8).max(30) });
const updateSchema = z.object({ id: z.string().uuid(), fullName: z.string().trim().min(2).max(120), phone: z.string().trim().min(8).max(30) });

export async function POST(request: Request) {
  const access = await staffClient();
  if ("response" in access) return access.response;
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Informe nome, e-mail e telefone válidos." }, { status: 400 });
  const { data, error } = await access.supabase.from("patients").insert({ full_name: parsed.data.fullName, email: parsed.data.email.toLowerCase(), phone: parsed.data.phone }).select("id,full_name,email,phone,created_at").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Já existe um cadastro com esse e-mail." : "Não foi possível criar o cadastro. Confira os dados." }, { status: error.code === "23505" ? 409 : 400 });
  await access.supabase.from("admin_audit_log").insert({ actor_id: access.user.id, action: "patient_created", entity_type: "patient", entity_id: data.id });
  return NextResponse.json({ patient: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await staffClient();
  if ("response" in access) return access.response;
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Informe nome, e-mail e telefone válidos." }, { status: 400 });
  const { id, fullName, phone } = parsed.data;
  const { data, error } = await access.supabase.from("patients").update({ full_name: fullName, phone, updated_at: new Date().toISOString() }).eq("id", id).select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: error?.code === "23505" ? "Esse e-mail já está vinculado a outro cadastro." : "Não foi possível atualizar este cadastro." }, { status: error?.code === "23505" ? 409 : 400 });
  await access.supabase.from("admin_audit_log").insert({ actor_id: access.user.id, action: "patient_updated", entity_type: "patient", entity_id: id });
  return NextResponse.json({ ok: true });
}
