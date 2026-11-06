"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type Mode = "login" | "signup" | "recover";

export default function PatientLoginPage({ linkError }: { linkError: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(linkError ? "Esse link expirou ou já foi usado. Solicite outro para continuar." : "");
  const [success, setSuccess] = useState(false);

  function client() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("O portal ainda não foi conectado ao Supabase.");
    return createBrowserClient(url, key);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setSuccess(false);
    try {
      const supabase = client();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/paciente`, data: { account_type: "patient", full_name: fullName.trim(), phone: phone.trim() } },
        });
        if (error) throw error;
        if (data.session) router.replace("/paciente");
        else { setSuccess(true); setMessage("Conta criada. Confira seu e-mail para confirmar o cadastro antes de entrar."); }
      } else if (mode === "recover") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/paciente/redefinir-senha` });
        if (error) throw error;
        setSuccess(true); setMessage("Se o e-mail estiver cadastrado, enviaremos um link para redefinir sua senha.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace("/paciente");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível concluir. Tente novamente."); }
    finally { setBusy(false); }
  }

  const title = mode === "signup" ? "Crie sua conta." : mode === "recover" ? "Recupere seu acesso." : "Bem-vindo de volta.";
  return <main className="patient-auth-page">
    <Link className="brand" href="/"><span className="brand-mark">v</span><span>clínica<span className="brand-light">vita</span><small>ÁREA DO PACIENTE</small></span></Link>
    <section className="patient-auth-card"><div className="section-kicker">SEU CUIDADO, SEMPRE À MÃO</div><h1>{title}</h1><p className="patient-auth-intro">Acesse seus horários, atualize seus dados e acompanhe suas solicitações com segurança.</p>
      <form onSubmit={submit}>
        {mode === "signup" && <><label htmlFor="patient-name">Nome completo</label><input id="patient-name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} maxLength={120} required/><label htmlFor="patient-phone">Telefone</label><input id="patient-phone" autoComplete="tel" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} minLength={8} maxLength={30} required/></>}
        <label htmlFor="patient-email">E-mail</label><input id="patient-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required/>
        {mode !== "recover" && <><label htmlFor="patient-password">Senha</label><input id="patient-password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required/>{mode === "signup" && <small className="patient-password-hint">Use pelo menos 8 caracteres.</small>}</>}
        <button className="button patient-auth-submit" disabled={busy}>{busy ? "Aguarde…" : mode === "signup" ? "Criar conta" : mode === "recover" ? "Enviar link de recuperação" : "Entrar"}<span>↗</span></button>
      </form>
      {message && <p className={success ? "patient-feedback success" : "patient-feedback"} role="status">{message}</p>}
      <div className="patient-auth-links">{mode === "login" ? <><button onClick={() => { setMode("recover"); setMessage(""); }}>Esqueci minha senha</button><span>Ainda não tem conta? <button onClick={() => { setMode("signup"); setMessage(""); }}>Cadastre-se</button></span></> : <button onClick={() => { setMode("login"); setMessage(""); }}>← Voltar para entrar</button>}</div>
    </section><Link className="booking-back" href="/">← Voltar ao site</Link>
  </main>;
}
