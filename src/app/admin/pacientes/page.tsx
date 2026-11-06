import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PatientManager from "./patient-manager";

export const instant = false;
type Patient = { id: string; full_name: string; email: string; phone: string; created_at: string };

export default async function PatientsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <main className="admin-shell"><h1>Configure o Supabase</h1><p>Conecte o banco para gerenciar cadastros.</p></main>;
  const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/admin/login");
  const { data: staff } = await supabase.from("staff_profiles").select("full_name,role,active").eq("user_id", user.id).maybeSingle();
  if (!staff?.active) redirect("/admin/login"); if (!["admin", "receptionist"].includes(staff.role)) redirect("/admin");
  const { data } = await supabase.from("patients").select("id,full_name,email,phone,created_at").order("created_at", { ascending: false }).limit(100);
  return <main className="admin-shell"><header className="admin-header"><Link className="brand" href="/admin"><span className="brand-mark">v</span><span>clínica<span className="brand-light">vita</span><small>PAINEL DA CLÍNICA</small></span></Link><div><span>{staff.full_name}</span><form action="/auth/signout" method="post"><button className="admin-logout">Sair</button></form></div></header><section className="admin-content"><div className="admin-welcome"><div><div className="section-kicker">CADASTROS</div><h1>Pacientes</h1><p>Organize dados de contato e consulte cadastros da clínica.</p></div><Link href="/admin" className="booking-back">← Painel</Link></div><PatientManager initialPatients={(data ?? []) as Patient[]}/><p className="patient-privacy-note">Acesso permitido somente à administração e recepção. Use estes campos para contato e organização de consultas; não registre dados clínicos nesta área.</p></section></main>;
}
