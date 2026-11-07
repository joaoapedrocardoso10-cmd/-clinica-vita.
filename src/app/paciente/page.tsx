import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PatientPortal from "./portal";

export const instant = false;

export default async function PatientPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <main className="patient-auth-page"><section className="patient-auth-card"><h1>Portal em configuração</h1><p>Conecte o Supabase para acessar sua área.</p><Link href="/">Voltar ao site</Link></section></main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/paciente/login");
  // Also link older verified accounts created before the patient portal migration.
  await supabase.rpc("ensure_my_patient_profile");
  const { data: patient } = await supabase.from("patients").select("id,full_name,email,phone").eq("auth_user_id", user.id).maybeSingle();
  if (!patient) return <main className="patient-portal"><header className="patient-portal-header"><Link className="brand" href="/"><span className="brand-mark">v</span><span>clínica<span className="brand-light">vita</span><small>ÁREA DO PACIENTE</small></span></Link><form action="/auth/signout?next=/paciente/login" method="post"><button className="admin-logout">Sair</button></form></header><section className="patient-empty-state"><span className="portal-symbol">✳</span><div className="section-kicker">CADASTRO EM VINCULAÇÃO</div><h1>Estamos preparando seu acesso.</h1><p>Confirme o e-mail usado no cadastro. Se continuar sem acesso, fale com a recepção da clínica.</p><Link className="button" href="/">Voltar ao site <span>↗</span></Link></section></main>;
  const [appointmentsResult, requestsResult] = await Promise.all([
    supabase.from("appointments").select("id,starts_at,ends_at,status,professional_id,service_id,professionals(id,display_name),services(id,name,duration_minutes)").eq("patient_id", patient.id).order("starts_at", { ascending: false }).limit(500),
    supabase.from("patient_appointment_requests").select("id,appointment_id,request_type,requested_starts_at,status,created_at").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(50),
  ]);
  return <PatientPortal patient={patient} appointments={(appointmentsResult.data ?? []) as unknown as Parameters<typeof PatientPortal>[0]["appointments"]} requests={requestsResult.data ?? []} loadError={Boolean(appointmentsResult.error || requestsResult.error)} />;
}
