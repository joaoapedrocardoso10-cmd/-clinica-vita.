import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function adminAccess() {
  const supabase = await createSupabaseServerClient(); if (!supabase) return { response: NextResponse.json({ error: "Supabase não está conectado." }, { status: 503 }) };
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return { response: NextResponse.json({ error: "Entre no painel para continuar." }, { status: 401 }) };
  const { data: staff } = await supabase.from("staff_profiles").select("role,active").eq("user_id", user.id).maybeSingle();
  if (!staff?.active || staff.role !== "admin") return { response: NextResponse.json({ error: "Somente a administração pode configurar serviços." }, { status: 403 }) };
  return { supabase, user };
}

const saveSchema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(3).max(100), description: z.string().trim().max(1000).default(""), specialtyId: z.string().uuid().nullable(), duration: z.number().int().min(10).max(240), priceCents: z.number().int().min(0).nullable(), professionalIds: z.array(z.string().uuid()).min(1).max(50) });

export async function POST(request: Request) {
  const access = await adminAccess(); if ("response" in access) return access.response;
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
  const parsed = saveSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: "Confira nome, duração, valor e profissional associado." }, { status: 400 });
  const { id, name, description, specialtyId, duration, priceCents, professionalIds } = parsed.data;
  const values = { name, description, specialty_id: specialtyId, duration_minutes: duration, price_cents: priceCents };
  const saved = id
    ? await access.supabase.from("services").update(values).eq("id", id).select("id").maybeSingle()
    : await access.supabase.from("services").insert(values).select("id").single();
  if (saved.error || !saved.data) return NextResponse.json({ error: "Não foi possível salvar o serviço. Verifique se o nome já está em uso e tente novamente." }, { status: 400 });
  const serviceId = saved.data.id;
  const { error: deleteError } = await access.supabase.from("service_professionals").delete().eq("service_id", serviceId);
  if (deleteError) return NextResponse.json({ error: "O serviço foi salvo, mas não foi possível atualizar os profissionais associados." }, { status: 400 });
  const { error: assignmentError } = await access.supabase.from("service_professionals").insert([...new Set(professionalIds)].map((professional_id) => ({ service_id: serviceId, professional_id })));
  if (assignmentError) return NextResponse.json({ error: "O serviço foi salvo, mas não foi possível atualizar os profissionais associados." }, { status: 400 });
  await access.supabase.from("admin_audit_log").insert({ actor_id: access.user.id, action: id ? "service_updated" : "service_created", entity_type: "service", entity_id: serviceId });
  return NextResponse.json({ ok: true, id: serviceId }, { status: id ? 200 : 201 });
}

const archiveSchema = z.object({ id: z.string().uuid(), active: z.boolean() });
export async function PATCH(request: Request) {
  const access = await adminAccess(); if ("response" in access) return access.response;
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
  const parsed = archiveSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: "Serviço inválido." }, { status: 400 });
  const { data, error } = await access.supabase.from("services").update({ active: parsed.data.active }).eq("id", parsed.data.id).select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Não foi possível alterar o status do serviço." }, { status: 400 });
  await access.supabase.from("admin_audit_log").insert({ actor_id: access.user.id, action: parsed.data.active ? "service_activated" : "service_archived", entity_type: "service", entity_id: data.id });
  return NextResponse.json({ ok: true });
}
