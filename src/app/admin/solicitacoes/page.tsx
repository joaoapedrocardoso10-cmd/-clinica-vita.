import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import RequestActions from "./request-actions";

export const instant = false;

type RequestRow = { id: string; request_type: string; requested_starts_at: string | null; reason: string; status: string; created_at: string; patients: { full_name: string; email: string; phone: string } | null; appointments: { starts_at: string; status: string; professionals: { display_name: string } | null; services: { name: string } | null } | null };

export default async function RequestsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <main className="admin-shell"><h1>Configure o Supabase</h1><p>Conecte o banco para revisar as solicitações.</p></main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: staff } = await supabase.from("staff_profiles").select("full_name,role,active").eq("user_id", user.id).maybeSingle();
  if (!staff?.active) redirect("/admin/login");
  if (!["admin", "receptionist"].includes(staff.role)) redirect("/admin");
  const { data, error } = await supabase.from("patient_appointment_requests").select("id,request_type,requested_starts_at,reason,status,created_at,patients(full_name,email,phone),appointments(starts_at,status,professionals(display_name),services(name))").order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as unknown as RequestRow[];
  return <main className="admin-shell"><header className="admin-header"><Link className="brand" href="/admin"><span className="brand-mark">v</span><span>clínica<span className="brand-light">vita</span><small>PAINEL DA CLÍNICA</small></span></Link><div><span>{staff.full_name}</span><form action="/auth/signout" method="post"><button className="admin-logout">Sair</button></form></div></header><section className="admin-content"><div className="admin-welcome"><div><div className="section-kicker">ATENDIMENTO AO PACIENTE</div><h1>Pedidos de alteração</h1><p>Revise cancelamentos e sugestões de remarcação recebidos pelo portal.</p></div><Link href="/admin" className="booking-back">← Painel</Link></div>
    <div className="admin-table-card"><div className="admin-table-head"><div><h2>Solicitações recentes</h2><p>Pedidos pendentes são aplicados ao banco somente após aprovação.</p></div></div>{error ? <p className="admin-empty">Não foi possível carregar os pedidos. Confira se a migração Premium foi aplicada.</p> : !rows.length ? <p className="admin-empty">Nenhum pedido recebido ainda.</p> : <div className="admin-table-wrap"><table><thead><tr><th>PACIENTE</th><th>ATENDIMENTO</th><th>PEDIDO</th><th>RECEBIDO</th><th>STATUS</th><th>REVISÃO</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.patients?.full_name ?? "Paciente"}<small>{row.patients?.email}<br/>{row.patients?.phone}</small></td><td>{row.appointments?.services?.name ?? "Consulta"}<small>{row.appointments?.professionals?.display_name} · {row.appointments?.starts_at ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(row.appointments.starts_at)) : "—"}</small></td><td>{row.request_type === "cancel" ? "Cancelamento" : "Remarcação"}{row.requested_starts_at && <small>Sugestão: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(row.requested_starts_at))}</small>}</td><td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(row.created_at))}</td><td><span className={`admin-request-status ${row.status}`}>{row.status === "pending" ? "Pendente" : row.status === "approved" ? "Aprovado" : "Recusado"}</span></td><td>{row.status === "pending" ? <RequestActions id={row.id}/> : <small>Revisado</small>}</td></tr>)}</tbody></table></div>}</div>
    <p className="patient-privacy-note">A aprovação de uma remarcação só ocorre se o horário ainda estiver livre. O portal não envia e-mails nem mensagens automaticamente.</p></section></main>;
}
