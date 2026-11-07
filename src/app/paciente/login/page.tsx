import PatientLoginPage from "./login-form";
import { Suspense } from "react";

async function PatientLoginContent({ searchParams }: { searchParams: Promise<{ erro?: string; modo?: string }> }) {
  const params = await searchParams;
  return <PatientLoginPage linkError={params.erro === "link"} profileError={params.erro === "perfil"} defaultSignup={params.modo === "cadastro"} />;
}

export default function PatientLoginRoute({ searchParams }: { searchParams: Promise<{ erro?: string; modo?: string }> }) {
  return <Suspense fallback={<main className="patient-auth-page"><p>Carregando acesso seguro…</p></main>}><PatientLoginContent searchParams={searchParams}/></Suspense>;
}
