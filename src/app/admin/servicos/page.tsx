import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ServiceManager from "./service-manager";

export const instant = false;
type Service = { id: string; specialty_id: string | null; name: string; description: string; duration_minutes: number; price_cents: number | null; active: boolean };
export default async function ServicesPage() {
  const supabase = await createSupabaseServerClient(); if (!supabase) return <main className="admin-shell"><h1>Configure o Supabase</h1><p>Conecte o banco para gerenciar serviços.</p></main>;
  const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/admin/login"); const { data: staff } = await supabase.from("staff_profiles").select("full_name,role,active").eq("user_id", user.id).maybeSingle();
  if (!staff?.active) redirect("/admin/login"); if (staff.role !== "admin") redirect("/admin");
  const [servicesResult, specialtiesResult, professionalsResult, assignmentsResult] = await Promise.all([
    supabase.from("services").select("id,specialty_id,name,description,duration_minutes,price_cents,active").order("name"),
    supabase.from("specialties").select("id,name").eq("active", true).order("name"),
    supabase.from("professionals").select("id,display_name,active").order("display_name"),
    supabase.from("service_professionals").select("service_id,professional_id"),
  ]);
  const assignments = assignmentsResult.data ?? [];
  const services = ((servicesResult.data ?? []) as Service[]).map((item) => ({ ...item, assigned: assignments.filter((row) => row.service_id === item.id).map((row) => row.professional_id) }));
  return <main className="admin-shell"><header className="admin-header"><Link className="brand" href="/admin"><span className="brand-mark">v</span><span>clínica<span className="brand-light">vita</span><small>PAINEL DA CLÍNICA</small></span></Link><div><span>{staff.full_name}</span><form action="/auth/signout" method="post"><button className="admin-logout">Sair</button></form></div></header><section className="admin-content"><div className="admin-welcome"><div><div className="section-kicker">CONFIGURAÇÃO DA CLÍNICA</div><h1>Serviços</h1><p>Gerencie o catálogo, duração, valor e profissionais associados.</p></div><Link href="/admin" className="booking-back">← Painel</Link></div><ServiceManager specialties={specialtiesResult.data ?? []} professionals={professionalsResult.data ?? []} services={services}/></section></main>;
}
