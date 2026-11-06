import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function adminAccess() {
  const supabase = await createSupabaseServerClient(); if (!supabase) return { response: NextResponse.json({ error: "Supabase não está conectado." }, { status: 503 }) };
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return { response: NextResponse.json({ error: "Entre no painel para continuar." }, { status: 401 }) };
  const { data: staff } = await supabase.from("staff_profiles").select("role,active").eq("user_id", user.id).maybeSingle();
  if (!staff?.active || staff.role !== "admin") return { response: NextResponse.json({ error: "Somente a administração pode configurar a equipe." }, { status: 403 }) };
  return { supabase, user };
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("invite_staff"), fullName: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254), role: z.enum(["admin", "receptionist", "professional"]), professionalId: z.string().uuid().nullable() }),
  z.object({ action: z.literal("set_staff_active"), userId: z.string().uuid(), active: z.boolean() }),
  z.object({ action: z.literal("save_professional"), id: z.string().uuid().optional(), displayName: z.string().trim().min(2).max(120), bio: z.string().trim().max(1000).default(""), specialtyId: z.string().uuid().nullable(), whatsappPhone: z.string().trim().max(30).nullable().optional() }).refine((value) => !value.whatsappPhone || value.whatsappPhone.replace(/\D/g, "").length >= 10 && value.whatsappPhone.replace(/\D/g, "").length <= 15, { message: "WhatsApp deve conter de 10 a 15 dígitos." }),
  z.object({ action: z.literal("set_professional_active"), id: z.string().uuid(), active: z.boolean() }),
  z.object({ action: z.literal("save_availability"), professionalId: z.string().uuid(), weekday: z.number().int().min(0).max(6), startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }),
  z.object({ action: z.literal("delete_availability"), id: z.string().uuid() }),
]);

export async function POST(request: Request) {
  const access = await adminAccess(); if ("response" in access) return access.response;
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
  const parsed = schema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: "Confira os dados informados e tente novamente." }, { status: 400 });
  const value = parsed.data;

  if (value.action === "invite_staff") {
    if (value.role === "professional" && !value.professionalId) return NextResponse.json({ error: "Associe a conta a um perfil profissional." }, { status: 400 });
    const elevated = createSupabaseAdminClient(); if (!elevated) return NextResponse.json({ error: "Para convidar funcionários, configure SUPABASE_SECRET_KEY somente no servidor e reinicie a aplicação." }, { status: 503 });
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const { data, error } = await elevated.auth.admin.inviteUserByEmail(value.email.toLowerCase(), { redirectTo: `${baseUrl}/auth/callback?next=%2Fadmin`, data: { full_name: value.fullName } });
    if (error || !data.user) return NextResponse.json({ error: error?.message.includes("already") ? "Já existe uma conta com esse e-mail." : "Não foi possível solicitar o convite. Confira o SMTP e as configurações de autenticação do Supabase." }, { status: 400 });
    const { error: profileError } = await elevated.from("staff_profiles").insert({ user_id: data.user.id, full_name: value.fullName, role: value.role, professional_id: value.role === "professional" ? value.professionalId : null, active: true });
    if (profileError) { await elevated.auth.admin.deleteUser(data.user.id); return NextResponse.json({ error: "O convite não foi concluído porque não foi possível criar o perfil. Verifique se as migrações foram aplicadas." }, { status: 400 }); }
    await access.supabase.from("admin_audit_log").insert({ actor_id: access.user.id, action: "staff_invited", entity_type: "staff_profile", entity_id: data.user.id });
    return NextResponse.json({ ok: true, message: "Convite criado. A entrega do e-mail depende do SMTP configurado no Supabase." }, { status: 201 });
  }

  if (value.action === "set_staff_active") {
    if (value.userId === access.user.id && !value.active) return NextResponse.json({ error: "Você não pode desativar a própria conta por aqui." }, { status: 400 });
    const elevated = createSupabaseAdminClient(); if (!elevated) return NextResponse.json({ error: "Configure SUPABASE_SECRET_KEY no servidor para gerenciar contas da equipe." }, { status: 503 });
    const { data, error } = await elevated.from("staff_profiles").update({ active: value.active }).eq("user_id", value.userId).select("user_id").maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Não foi possível atualizar o acesso." }, { status: 400 });
    await access.supabase.from("admin_audit_log").insert({ actor_id: access.user.id, action: value.active ? "staff_activated" : "staff_deactivated", entity_type: "staff_profile", entity_id: value.userId });
    return NextResponse.json({ ok: true });
  }

  if (value.action === "save_professional") {
    const changes = { display_name: value.displayName, bio: value.bio, specialty_id: value.specialtyId, whatsapp_phone: value.whatsappPhone || null };
    const result = value.id ? await access.supabase.from("professionals").update(changes).eq("id", value.id).select("id").maybeSingle() : await access.supabase.from("professionals").insert({ ...changes, active: true }).select("id").single();
    if (result.error || !result.data) return NextResponse.json({ error: "Não foi possível salvar o profissional." }, { status: 400 });
    await access.supabase.from("admin_audit_log").insert({ actor_id: access.user.id, action: value.id ? "professional_updated" : "professional_created", entity_type: "professional", entity_id: result.data.id });
    return NextResponse.json({ ok: true, id: result.data.id }, { status: value.id ? 200 : 201 });
  }

  if (value.action === "set_professional_active") {
    const { data, error } = await access.supabase.from("professionals").update({ active: value.active }).eq("id", value.id).select("id").maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Não foi possível alterar o status do profissional." }, { status: 400 });
    await access.supabase.from("admin_audit_log").insert({ actor_id: access.user.id, action: value.active ? "professional_activated" : "professional_deactivated", entity_type: "professional", entity_id: data.id });
    return NextResponse.json({ ok: true });
  }

  if (value.action === "save_availability") {
    if (value.endsAt <= value.startsAt) return NextResponse.json({ error: "O horário final precisa ser depois do inicial." }, { status: 400 });
    const { data: professional } = await access.supabase.from("professionals").select("id").eq("id", value.professionalId).maybeSingle();
    if (!professional) return NextResponse.json({ error: "Profissional não encontrado." }, { status: 404 });
    const { data: duplicate } = await access.supabase.from("professional_availability").select("id").eq("professional_id", value.professionalId).eq("weekday", value.weekday).eq("starts_at", `${value.startsAt}:00`).eq("ends_at", `${value.endsAt}:00`).maybeSingle();
    if (duplicate) return NextResponse.json({ error: "Esse horário semanal já está cadastrado." }, { status: 409 });
    const { data, error } = await access.supabase.from("professional_availability").insert({ professional_id: value.professionalId, weekday: value.weekday, starts_at: `${value.startsAt}:00`, ends_at: `${value.endsAt}:00`, active: true }).select("id").single();
    if (error || !data) return NextResponse.json({ error: "Não foi possível salvar a disponibilidade." }, { status: 400 });
    await access.supabase.from("admin_audit_log").insert({ actor_id: access.user.id, action: "availability_created", entity_type: "professional_availability", entity_id: data.id });
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  }

  const { data, error } = await access.supabase.from("professional_availability").delete().eq("id", value.id).select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Não foi possível remover essa faixa de horário." }, { status: 400 });
  await access.supabase.from("admin_audit_log").insert({ actor_id: access.user.id, action: "availability_removed", entity_type: "professional_availability", entity_id: data.id });
  return NextResponse.json({ ok: true });
}
