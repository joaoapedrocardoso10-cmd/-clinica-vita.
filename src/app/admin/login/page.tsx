"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function AdminLogin() {
  const router=useRouter(); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setError("");setBusy(true);try{const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)throw new Error("O painel ainda não está configurado. Conecte o Supabase seguindo SUPABASE-SETUP.md.");const supabase=createBrowserClient(url,key);const {error:authError}=await supabase.auth.signInWithPassword({email,password});if(authError)throw authError;router.push("/admin");}catch(e){setError(e instanceof Error?e.message:"Não foi possível entrar.");}finally{setBusy(false);}}
  return <main className="admin-login-page"><Link className="brand" href="/"><span className="brand-mark">v</span><span>clínica<span className="brand-light">vita</span><small>SAÚDE COM PRESENÇA</small></span></Link><form className="admin-login-card" onSubmit={submit}><div className="section-kicker">ÁREA DA CLÍNICA</div><h1>Acesse seu painel.</h1><p>Entre com a conta da equipe autorizada.</p><label htmlFor="staff-email">E-mail</label><input id="staff-email" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/><label htmlFor="staff-password">Senha</label><input id="staff-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/><button className="button booking-submit" disabled={busy}>{busy?"Entrando…":"Entrar no painel"}<span>↗</span></button>{error&&<p className="booking-notice" role="alert">{error}</p>}<small>Acesso restrito a usuários cadastrados pela administração.</small></form><Link href="/" className="booking-back">← Voltar ao site</Link></main>;
}
