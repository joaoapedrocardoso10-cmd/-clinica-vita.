"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function PatientPasswordPage() {
  const router = useRouter(); const [password, setPassword] = useState(""); const [repeat, setRepeat] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    if (password !== repeat) { setMessage("As senhas não correspondem."); return; }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) { setMessage("O portal ainda não foi conectado ao Supabase."); return; }
    setBusy(true); const supabase = createBrowserClient(url, key); const { error } = await supabase.auth.updateUser({ password }); setBusy(false);
    if (error) { setMessage(error.message); return; } router.replace("/paciente");
  }
  return <main className="patient-auth-page"><Link className="brand" href="/"><span className="brand-mark">v</span><span>clínica<span className="brand-light">vita</span><small>ÁREA DO PACIENTE</small></span></Link><section className="patient-auth-card"><div className="section-kicker">RECUPERAÇÃO SEGURA</div><h1>Crie uma nova senha.</h1><p className="patient-auth-intro">Escolha uma senha com pelo menos 8 caracteres.</p><form onSubmit={submit}><label htmlFor="new-password">Nova senha</label><input id="new-password" type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required/><label htmlFor="repeat-password">Confirme a nova senha</label><input id="repeat-password" type="password" minLength={8} autoComplete="new-password" value={repeat} onChange={(event) => setRepeat(event.target.value)} required/><button className="button patient-auth-submit" disabled={busy}>{busy ? "Salvando…" : "Salvar nova senha"}<span>↗</span></button></form>{message && <p className="patient-feedback" role="alert">{message}</p>}</section></main>;
}
