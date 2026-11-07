"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { isValidPatientPhone, normalizePatientPhone } from "@/lib/phone";

type Mode = "login" | "signup" | "recover" | "verify";
type Provider = "google" | "facebook";

export default function PatientLoginPage({ linkError, profileError, defaultSignup }: { linkError: boolean; profileError: boolean; defaultSignup: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(defaultSignup ? "signup" : "login");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const initialMessage = linkError ? "Esse link expirou ou já foi usado. Solicite outro para continuar." : profileError ? "Não conseguimos vincular esta conta ao portal. Confirme seu e-mail e tente entrar novamente." : "";
  const [message, setMessage] = useState(initialMessage);
  const [success, setSuccess] = useState(false);

  function client() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("O portal ainda não foi conectado ao Supabase.");
    return createBrowserClient(url, key);
  }

  async function socialLogin(provider: Provider) {
    setBusy(true); setMessage(""); setSuccess(false);
    try {
      const supabase = client();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin + "/auth/callback?next=/paciente",
          ...(provider === "facebook" ? { scopes: "email" } : {}),
        },
      });
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível abrir o acesso social.");
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSuccess(false);

    if (mode === "signup" && !isValidPatientPhone(phone)) {
      setMessage("Informe somente números: DDD e telefone, com 10 ou 11 dígitos. Também aceitamos o código do país 55.");
      return;
    }
    if (mode === "verify" && !/^\d{6,8}$/.test(verificationCode)) {
      setMessage("Digite o código numérico recebido por e-mail.");
      return;
    }

    setBusy(true);
    try {
      const supabase = client();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: window.location.origin + "/auth/callback?next=/paciente", data: { account_type: "patient", full_name: fullName.trim(), phone: normalizePatientPhone(phone) } },
        });
        if (error) throw error;
        if (data.session) {
          await supabase.auth.signOut();
          setMessage("O Supabase está permitindo cadastros sem confirmar o e-mail. Ative “Confirm email” nas configurações de autenticação para exigir o código. Use um e-mail novo e acessível para testar depois.");
          return;
        }
        setVerificationCode("");
        setMode("verify");
        setSuccess(true);
        setMessage("Enviamos um código para seu e-mail. Digite-o abaixo para confirmar sua conta.");
      } else if (mode === "verify") {
        const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: verificationCode, type: "signup" });
        if (error) throw new Error("Código inválido ou expirado. Confira o e-mail ou peça outro código.");
        router.replace("/paciente");
        router.refresh();
      } else if (mode === "recover") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + "/auth/callback?next=/paciente/redefinir-senha" });
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

  async function resendVerification() {
    setBusy(true); setMessage(""); setSuccess(false);
    try {
      const supabase = client();
      const { error } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: window.location.origin + "/auth/callback?next=/paciente" } });
      if (error) throw error;
      setSuccess(true); setMessage("Solicitamos outro código. Confira sua caixa de entrada e o spam.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível reenviar o código agora."); }
    finally { setBusy(false); }
  }

  const title = mode === "signup" ? "Seu cuidado começa aqui." : mode === "verify" ? "Confirme seu e-mail." : mode === "recover" ? "Recupere seu acesso." : "Bem-vindo de volta.";
  return <main className="patient-auth-page">
    <Link className="brand" href="/"><span className="brand-mark">v</span><span>clínica<span className="brand-light">vita</span><small>PORTAL DO PACIENTE</small></span></Link>
    <div className="patient-auth-layout">
      <aside className="patient-auth-aside">
        <span className="patient-auth-aside-kicker">UM ESPAÇO SEU, COM SEGURANÇA</span>
        <h1>Mais tempo para cuidar de você.</h1>
        <p>Entre ou crie sua conta para simplificar cada etapa do seu atendimento.</p>
        <div className="patient-benefit-list">
          <div><i>01</i><span><b>Agende sem preencher tudo de novo</b><small>Seu nome e e-mail acompanham você na próxima consulta.</small></span></div>
          <div><i>02</i><span><b>Acompanhe seus horários</b><small>Consulte seus próximos atendimentos em um só lugar.</small></span></div>
          <div><i>03</i><span><b>Peça alterações com facilidade</b><small>Solicite cancelamento ou remarcação pelo portal.</small></span></div>
        </div>
        <div className="patient-auth-privacy"><span>⌑</span><p>Seus dados ficam associados à sua conta e só aparecem para você e para a equipe autorizada.</p></div>
      </aside>
      <section className="patient-auth-card">
        <div className="section-kicker">{mode === "signup" ? "CADASTRO GRATUITO" : mode === "verify" ? "CONFIRMAÇÃO DE E-MAIL" : mode === "recover" ? "ACESSO SEGURO" : "ÁREA DO PACIENTE"}</div>
        <h2>{title}</h2><p className="patient-auth-intro">{mode === "signup" ? "Crie sua conta em poucos passos. Você também pode continuar com uma rede social." : mode === "verify" ? `Digite o código enviado para ${email}.` : mode === "recover" ? "Informe seu e-mail para receber as instruções de recuperação." : "Entre para ver seus agendamentos e deixar a próxima consulta mais simples."}</p>
        {mode !== "recover" && mode !== "verify" && <div className="patient-auth-socials">
          <button type="button" onClick={() => void socialLogin("google")} disabled={busy}><span className="social-google-mark">G</span> Continuar com Google</button>
          <button type="button" onClick={() => void socialLogin("facebook")} disabled={busy}><span className="social-facebook-mark">f</span> Continuar com Facebook</button>
        </div>}
        {mode !== "recover" && mode !== "verify" && <p className="patient-auth-provider-note">Google e Facebook precisam ser conectados às contas da clínica antes de ficarem ativos.</p>}
        {mode !== "recover" && mode !== "verify" && <div className="patient-auth-separator"><span/>ou use seu e-mail<span/></div>}
        <form onSubmit={submit}>
          {mode === "signup" && <><label htmlFor="patient-name">Nome completo</label><input id="patient-name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} maxLength={120} required/><label htmlFor="patient-phone">Telefone</label><input id="patient-phone" autoComplete="tel" type="tel" inputMode="numeric" pattern="[0-9]{10,13}" title="Use DDD e telefone (10 ou 11 números), ou inclua o código do país 55." value={phone} onChange={(event) => setPhone(normalizePatientPhone(event.target.value))} minLength={10} maxLength={13} required/><small className="patient-password-hint">Somente números: DDD + telefone. Se incluir o código 55, informe 12 ou 13 dígitos.</small></>}
          {mode === "verify" ? <><label htmlFor="verify-email">E-mail do cadastro</label><input id="verify-email" type="email" value={email} readOnly/><label htmlFor="verification-code">Código enviado por e-mail</label><input id="verification-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 8))} minLength={6} maxLength={8} placeholder="Digite o código" required/></> : <><label htmlFor="patient-email">E-mail</label><input id="patient-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required/>
          {mode !== "recover" && <><label htmlFor="patient-password">Senha</label><input id="patient-password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required/>{mode === "signup" && <small className="patient-password-hint">Use pelo menos 8 caracteres.</small>}</>}</>}
          <button type="submit" className="button patient-auth-submit" disabled={busy}>{busy ? "Aguarde…" : mode === "signup" ? "Criar minha conta" : mode === "verify" ? "Confirmar meu e-mail" : mode === "recover" ? "Enviar link de recuperação" : "Entrar na minha conta"}<span>↗</span></button>
        </form>
        {message && <p className={`patient-feedback${success ? " success" : ""}${mode === "verify" && success ? " verification-success" : ""}`} role="status">{message}</p>}
        <div className="patient-auth-links">
          {mode === "login" ? <><button type="button" onClick={() => { setMode("recover"); setMessage(""); }}>Esqueci minha senha</button><span>Ainda não tem conta? <button type="button" onClick={() => { setMode("signup"); setMessage(""); }}>Criar cadastro</button></span></> : mode === "verify" ? <><button type="button" onClick={() => void resendVerification()} disabled={busy}>Reenviar código</button><span>E-mail incorreto? <button type="button" onClick={() => { setMode("signup"); setVerificationCode(""); setMessage(""); }}>Voltar ao cadastro</button></span></> : <button type="button" onClick={() => { setMode("login"); setMessage(""); }}>← Voltar para entrar</button>}
        </div>
        {mode !== "verify" && <Link className="patient-guest-link" href="/agendar">Continuar sem criar conta →</Link>}
      </section>
    </div>
    <Link className="booking-back" href="/">← Voltar ao site</Link>
  </main>;
}
