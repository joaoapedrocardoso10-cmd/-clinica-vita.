import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import TeamManager from "./team-manager";

export const instant = false;
export default async function TeamPage() {
  const supabase = await createSupabaseServerClient(); if (!supabase) return <main className="admin-shell"><h1>Configure o Supabase</h1><p>Conecte o banco para gerenciar equipe.</p></main>;
  const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/admin/login"); const { data: current } = await supabase.from("staff_profiles").select("full_name,role,active").eq("user_id", user.id).maybeSingle();
  if (!current?.active) redirect("/admin/login"); if (current.role !== "admin") redirect("/admin");
  const [staffResult, professionalsResult, specialtiesResult, availabilityResult] = await Promise.all([
    supabase.from("staff_profiles").select("user_id,full_name,role,professional_id,active").order("full_name"),
    supabase.from("professionals").select("id,display_name,bio,specialty_id,whatsapp_phone,active").order("display_name"),
    supabase.from("specialties").select("id,name").eq("active", true).order("name"),
    supabase.from("professional_availability").select("id,professional_id,weekday,starts_at,ends_at,active").order("weekday").order("starts_at"),
  ]);
  return <main className="admin-shell"><header className="admin-header"><Link className="brand" href="/admin"><span className="brand-mark">v</span><span>clínica<span className="brand-light">vita</span><small>PAINEL DA CLÍNICA</small></span></Link><div><span>{current.full_name}</span><form action="/auth/signout" method="post"><button className="admin-logout">Sair</button></form></div></header><section className="admin-content"><div className="admin-welcome"><div><div className="section-kicker">CONFIGURAÇÃO E ACESSOS</div><h1>Equipe</h1><p>Profissionais, agenda semanal e permissões de acesso.</p></div><Link href="/admin" className="booking-back">← Painel</Link></div><TeamManager specialties={specialtiesResult.data ?? []} professionals={professionalsResult.data ?? []} staff={staffResult.data ?? []} availability={availabilityResult.data ?? []}/></section></main>;
}
