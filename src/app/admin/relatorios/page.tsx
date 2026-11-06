import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;
type Bucket = { day: string; total: number; completed: number; cancelled: number };
type ChartBucket = Bucket & { label: string };
type Rank = { name: string; total: number };
type Report = { total: number; completed: number; cancelled: number; no_show: number; attendance_rate: number; timeline: Bucket[]; services: Rank[]; professionals: Rank[] };
const dayFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
function validDay(value: string | undefined) { const parsed = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null; return parsed && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : undefined; }
function groupTimeline(rows: Bucket[]): ChartBucket[] {
  if (rows.length <= 14) return rows.map((value) => ({ ...value, label: dayFmt.format(new Date(`${value.day}T00:00:00Z`)) }));
  const groupSize = Math.ceil(rows.length / 14);
  return Array.from({ length: Math.ceil(rows.length / groupSize) }, (_, index) => {
    const values = rows.slice(index * groupSize, (index + 1) * groupSize);
    return { day: values[0]?.day ?? "", total: values.reduce((sum, value) => sum + value.total, 0), completed: values.reduce((sum, value) => sum + value.completed, 0), cancelled: values.reduce((sum, value) => sum + value.cancelled, 0), label: values.length > 1 ? `${dayFmt.format(new Date(`${values[0].day}T00:00:00Z`))}–${dayFmt.format(new Date(`${values.at(-1)?.day}T00:00:00Z`))}` : dayFmt.format(new Date(`${values[0].day}T00:00:00Z`)) };
  });
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const supabase = await createSupabaseServerClient(); if (!supabase) return <main className="admin-shell"><h1>Configure o Supabase</h1><p>Conecte o banco para consultar relatórios.</p></main>;
  const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/admin/login");
  const { data: staff } = await supabase.from("staff_profiles").select("full_name,role,active").eq("user_id", user.id).maybeSingle();
  if (!staff?.active) redirect("/admin/login"); if (staff.role !== "admin") redirect("/admin");
  const params = await searchParams; const now = new Date(); const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; const monthStart = `${today.slice(0, 7)}-01`;
  const from = validDay(params.from) ?? monthStart; const to = validDay(params.to) ?? today;
  const { data, error } = await supabase.rpc("clinic_premium_report", { p_from: from, p_to: to });
  const report = (data ?? { total: 0, completed: 0, cancelled: 0, no_show: 0, attendance_rate: 0, timeline: [], services: [], professionals: [] }) as Report;
  const bars = groupTimeline(report.timeline ?? []); const largest = Math.max(1, ...bars.map((item) => item.total));
  const rangeInvalid = to < from || (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 > 365;
  return <main className="admin-shell"><header className="admin-header"><Link className="brand" href="/admin"><span className="brand-mark">v</span><span>clínica<span className="brand-light">vita</span><small>PAINEL DA CLÍNICA</small></span></Link><div><span>{staff.full_name}</span><form action="/auth/signout" method="post"><button className="admin-logout">Sair</button></form></div></header><section className="admin-content"><div className="admin-welcome"><div><div className="section-kicker">GESTÃO E INDICADORES</div><h1>Relatórios</h1><p>Visão agregada do movimento da clínica no período escolhido.</p></div><Link href="/admin" className="booking-back">← Painel</Link></div>
    <form className="admin-filter-form"><label>De<input type="date" name="from" value={from}/></label><label>Até<input type="date" name="to" value={to}/></label><button>Aplicar período</button>{!rangeInvalid && !error && <a className="admin-export-link" href={`/api/admin/relatorios?from=${from}&to=${to}&format=csv`}>Exportar CSV ↗</a>}</form>
    {rangeInvalid && <p className="patient-feedback">Escolha um intervalo válido de até 366 dias.</p>}{error && <p className="patient-feedback">Não foi possível montar os relatórios. Confira se a migração Premium já foi executada no Supabase.</p>}
    {!rangeInvalid && !error && <><div className="admin-report-summary"><article><small>AGENDAMENTOS</small><b>{report.total}</b></article><article><small>CONCLUÍDOS</small><b>{report.completed}</b></article><article><small>CANCELADOS</small><b>{report.cancelled}</b></article><article><small>TAXA DE COMPARECIMENTO</small><b>{report.attendance_rate}%</b></article></div>
      <div className="admin-report-grid"><section className="admin-table-card"><div className="admin-table-head"><div><h2>Movimento do período</h2><p>Quantidade de consultas por dia (agrupada quando o período é longo)</p></div></div>{bars.length ? <div className="admin-chart" role="img" aria-label="Gráfico de agendamentos por período">{bars.map((item, index) => <div className="admin-chart-column" key={`${item.day}-${index}`} title={`${item.total} agendamento(s)`}><b>{item.total || ""}</b><i style={{ height: `${Math.max(item.total ? 7 : 2, item.total / largest * 100)}%` }}/><small>{item.label}</small></div>)}</div> : <p className="admin-empty">Não há agendamentos neste período.</p>}</section>
      <section className="admin-table-card"><div className="admin-table-head"><div><h2>Serviços mais procurados</h2><p>Com base no número de consultas</p></div></div>{report.services?.length ? <div className="admin-rank-list">{report.services.map((item) => <div key={item.name}><span>{item.name}</span><b>{item.total}</b></div>)}</div> : <p className="admin-empty">Sem dados no período.</p>}</section>
      <section className="admin-table-card"><div className="admin-table-head"><div><h2>Atendimentos por profissional</h2><p>Volume no período selecionado</p></div></div>{report.professionals?.length ? <div className="admin-rank-list">{report.professionals.map((item) => <div key={item.name}><span>{item.name}</span><b>{item.total}</b></div>)}</div> : <p className="admin-empty">Sem dados no período.</p>}</section>
      </div><p className="patient-privacy-note">Os relatórios mostram somente contagens agregadas. Nenhum nome, telefone, e-mail ou dado clínico é incluído na exportação.</p></>}
    </section></main>;
}
