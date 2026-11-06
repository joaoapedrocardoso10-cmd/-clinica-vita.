import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function validDay(value: string | null) { const parsed = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null; return parsed && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null; }
function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient(); if (!supabase) return NextResponse.json({ error: "Supabase não está conectado." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "Entre no painel para continuar." }, { status: 401 });
  const { data: staff } = await supabase.from("staff_profiles").select("role,active").eq("user_id", user.id).maybeSingle();
  if (!staff?.active || staff.role !== "admin") return NextResponse.json({ error: "Acesso restrito à administração." }, { status: 403 });
  const params = new URL(request.url).searchParams; const from = validDay(params.get("from")); const to = validDay(params.get("to"));
  if (!from || !to || to < from || (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 > 365) return NextResponse.json({ error: "Selecione um intervalo válido de até 366 dias." }, { status: 400 });
  const { data, error } = await supabase.rpc("clinic_premium_report", { p_from: from, p_to: to });
  if (error || !data) return NextResponse.json({ error: "Não foi possível gerar a exportação." }, { status: 400 });
  const report = data as { timeline: Array<{ day: string; total: number; completed: number; cancelled: number }>; services: Array<{ name: string; total: number }>; professionals: Array<{ name: string; total: number }> };
  const lines = [["Categoria", "Item", "Data", "Quantidade"], ...report.timeline.map((row) => ["Dia", "Agendamentos", row.day, row.total]), ...report.services.map((row) => ["Serviço", row.name, `${from} a ${to}`, row.total]), ...report.professionals.map((row) => ["Profissional", row.name, `${from} a ${to}`, row.total])];
  const csv = `\uFEFF${lines.map((line) => line.map(csvCell).join(";")).join("\r\n")}`;
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="clinica-vita-relatorio-${from}-${to}.csv"`, "Cache-Control": "no-store" } });
}
