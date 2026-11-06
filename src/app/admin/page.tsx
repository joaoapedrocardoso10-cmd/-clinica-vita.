import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

type AppointmentView = { id:string; starts_at:string; status:string; patients:{full_name:string;phone:string}|null; professionals:{display_name:string}|null; services:{name:string}|null };

export default async function AdminDashboard() {
  const supabase=await createSupabaseServerClient();
  if(!supabase) return <main className="admin-shell"><h1>Painel em configuração</h1><p>Adicione as variáveis do Supabase e execute a migração SQL para ativar o painel.</p><Link href="/admin/login">Ir para login</Link></main>;
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/admin/login");
  const {data:staff}=await supabase.from("staff_profiles").select("full_name,role,professional_id,active").eq("user_id",user.id).maybeSingle();
  if(!staff?.active) return <main className="admin-shell"><h1>Acesso não habilitado</h1><p>Esta conta ainda não está autorizada no perfil da clínica.</p><form action="/auth/signout" method="post"><button className="button">Sair</button></form></main>;
  const today=new Date(); const start=new Date(today.getFullYear(),today.getMonth(),today.getDate()).toISOString(); const end=new Date(today.getFullYear(),today.getMonth(),today.getDate()+1).toISOString();
  let appointments=supabase.from("appointments").select("id,starts_at,ends_at,status,patients(full_name,phone,email),professionals(display_name),services(name)").gte("starts_at",start).order("starts_at").limit(100);
  if(staff.role==="professional"&&staff.professional_id) appointments=appointments.eq("professional_id",staff.professional_id);
  const [todayData,futureData,cancelledData,upcomingData]=await Promise.all([
    supabase.from("appointments").select("id",{count:"exact",head:true}).gte("starts_at",start).lt("starts_at",end).neq("status","cancelled"),
    supabase.from("appointments").select("id",{count:"exact",head:true}).gte("starts_at",end).in("status",["pending","confirmed"]),
    supabase.from("appointments").select("id",{count:"exact",head:true}).eq("status","cancelled"),
    appointments,
  ]);
  const appointmentRows=(upcomingData.data??[]) as unknown as AppointmentView[];
  return <main className="admin-shell"><header className="admin-header"><Link className="brand" href="/"><span className="brand-mark">v</span><span>clínica<span className="brand-light">vita</span><small>PAINEL DA CLÍNICA</small></span></Link><div><span>{staff.full_name} · {staff.role}</span><form action="/auth/signout" method="post"><button className="admin-logout">Sair</button></form></div></header><section className="admin-content"><div className="admin-welcome"><div><div className="section-kicker">VISÃO GERAL</div><h1>Bom dia, {staff.full_name.split(" ")[0]}.</h1><p>Acompanhe a agenda e os próximos atendimentos.</p></div><Link className="button" href="/admin/agendamentos">Ver agenda <span>↗</span></Link></div><div className="admin-stat-grid"><article><small>CONSULTAS HOJE</small><b>{todayData.count??0}</b><span>Atendimentos programados</span></article><article><small>PRÓXIMAS CONSULTAS</small><b>{futureData.count??0}</b><span>Pendentes ou confirmadas</span></article><article><small>CANCELAMENTOS</small><b>{cancelledData.count??0}</b><span>No total registrado</span></article><article><small>SEU PERFIL</small><b className="stat-role">{staff.role==="admin"?"Admin":staff.role==="receptionist"?"Recepção":"Profissional"}</b><span>Acesso verificado pelo servidor</span></article></div><section className="admin-table-card"><div className="admin-table-head"><div><h2>Próximos atendimentos</h2><p>Dados carregados do banco da clínica</p></div><Link href="/admin/agendamentos">Agenda completa ↗</Link></div>{upcomingData.error?<p className="admin-empty">Não foi possível carregar os agendamentos. Confira a migração SQL e as políticas de acesso.</p>:!upcomingData.data?.length?<p className="admin-empty">Nenhum agendamento futuro no momento.</p>:<div className="admin-table-wrap"><table><thead><tr><th>HORÁRIO</th><th>PACIENTE</th><th>PROFISSIONAL</th><th>SERVIÇO</th><th>STATUS</th></tr></thead><tbody>{appointmentRows.map((row)=><tr key={row.id}><td>{new Date(row.starts_at).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}</td><td>{row.patients?.full_name}<small>{row.patients?.phone}</small></td><td>{row.professionals?.display_name}</td><td>{row.services?.name}</td><td><span className={`status-pill ${row.status}`}>{row.status}</span></td></tr>)}</tbody></table></div>}</section></section></main>;
}
