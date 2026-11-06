import PatientLoginPage from "./login-form";
import { Suspense } from "react";

async function PatientLoginContent({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const params = await searchParams;
  return <PatientLoginPage linkError={params.erro === "link"}/>;
}

export default function PatientLoginRoute({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  return <Suspense fallback={<main className="patient-auth-page"><p>Carregando acesso seguro…</p></main>}><PatientLoginContent searchParams={searchParams}/></Suspense>;
}
