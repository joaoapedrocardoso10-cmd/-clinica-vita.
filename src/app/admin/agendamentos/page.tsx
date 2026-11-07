import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AppointmentActions from "./appointment-actions";

export const instant = false;
type AppointmentView = { id: string; starts_at: string; status: string; payment_method: string; payment_status: string; payment_amount_cents: number | null; patients: { full_name: string; phone: string; email: string } | null; professionals: { display_name: string } | null; services: { name: string } | null };
const states = ["pending", "confirmed", "cancelled", "completed", "no_show"];
const labels: Record<string, string> = { pending: "Pendente", confirmed: "Confirmada", cancelled: "Cancelada", completed: "Concluída", no_show: "Não compareceu" };
function validDate(value: string | undefined) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value ? value : undefined; }

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; status?: string; professional?: string }> }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <main className="admin-shell"><section className="patient-empty-state"><h1>Configure o Supabase</h1><p>Siga SUPABASE-SETUP.md para ativar a agenda.</p></section></main>;
  const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/admin/login");
  const { data: staff } = await supabase.from("staff_profiles").select("full_name,role,professional_id,active").eq("user_id", user.id).maybeSingle(); if (!staff?.active) redirect("/admin/login");
  const params = await searchParams; const from = validDate(params.from); const to = validDate(params.to); const status = params.status && states.includes(params.status) ? params.status : ""; const professionalId = params.professional ?? "";
  let query = supabase.from("appointments").select("id,starts_at,ends_at,status,payment_method,payment_status,payment_amount_cents,patients(full_name,phone,email),professionals(display_name),services(name)").order("starts_at", { ascending: false }).limit(200);
  if (from) query = query.gte("starts_at", new Date(`${from}T00:00:00-03:00`).toISOString());
  if (to) query = query.lt("starts_at", new Date(new Date(`${to}T00:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000).toISOString());
  if (status) query = query.eq("status", status);
  if (staff.role === "professional" && staff.professional_id) query = query.eq("professional_id", staff.professional_id);
  else if (professionalId && ["admin", "receptionist"].includes(staff.role)) query = query.eq("professional_id", professionalId);
  const [{ data, error }, professionalsResult] = await Promise.all([
    query,
    ["admin", "receptionist"].includes(staff.role) ? supabase.from("professionals").select("id,display_name").order("display_name") : Promise.resolve({ data: [] }),
  ]);
  const rows = (data ?? []) as unknown as AppointmentView[];
  return <main className="admin-shell"><header className="admin-header"><Link className="brand" href="/admin"><span className="brand-mark">v</span><span>clínica<span className="brand-light">vita</span><small>PAINEL DA CLÍNICA</small></span></Link><div><span>{staff.full_name}</span><form action="/auth/signout" method="post"><button className="admin-logout">Sair</button></form></div></header>
    <section className="admin-content"><div className="admin-welcome"><div><div className="section-kicker">AGENDA DA CLÍNICA</div><h1>Agendamentos</h1><p>Consulte a agenda, filtre por período e atualize os status.</p></div><Link href="/admin" className="booking-back">← Painel</Link></div>
      <div className="admin-table-card"><form className="admin-filter-form"><label>De<input type="date" name="from" value={from ?? ""}/></label><label>Até<input type="date" name="to" value={to ?? ""}/></label><label>Status<select name="status" value={status}><option value="">Todos</option>{states.map((state) => <option key={state} value={state}>{labels[state]}</option>)}</select></label>{["admin", "receptionist"].includes(staff.role) && <label>Profissional<select name="professional" value={professionalId}><option value="">Todos</option>{(professionalsResult.data ?? []).map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label>}<button>Filtrar agenda</button><Link className="admin-export-link" href="/admin/agendamentos">Limpar</Link></form>
        <div className="admin-table-head"><div><h2>Consultas</h2><p>Exibindo até 200 resultados conforme os filtros selecionados.</p></div></div>{error ? <p className="admin-empty">Falha ao carregar agenda. Verifique a configuração do banco.</p> : !rows.length ? <p className="admin-empty">Nenhum agendamento encontrado para estes filtros.</p> : <div className="admin-table-wrap"><table><thead><tr><th>DATA E HORA</th><th>PACIENTE</th><th>PROFISSIONAL</th><th>SERVIÇO</th><th>STATUS</th><th>PAGAMENTO</th><th>AÇÕES</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(row.starts_at))}</td><td>{row.patients?.full_name}<small>{row.patients?.email}<br/>{row.patients?.phone}</small></td><td>{row.professionals?.display_name}</td><td>{row.services?.name}</td><td><span className={`status-pill ${row.status}`}>{labels[row.status] ?? row.status}</span></td><td>{row.payment_method === "online" ? <><span className={`status-pill ${row.payment_status}`}>{row.payment_status === "approved" ? "Pago" : row.payment_status === "pending" ? "Aguardando" : row.payment_status === "expired" ? "Expirado" : row.payment_status}</span>{row.payment_amount_cents != null && <small>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(row.payment_amount_cents / 100)}</small>}</> : <span className="status-pill">WhatsApp</span>}</td><td><AppointmentActions id={row.id} status={row.status}/></td></tr>)}</tbody></table></div>}
      </div>
    </section>
  </main>;
}
