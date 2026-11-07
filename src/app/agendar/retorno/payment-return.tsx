"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PaymentInfo = { status?: string; payment_status?: string; starts_at?: string; payment_expires_at?: string };
export default function PaymentReturn({ appointmentId }: { appointmentId: string }) {
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!appointmentId) return;
    let active = true;
    let attempts = 0;
    const check = async () => {
      attempts += 1;
      try {
        const response = await fetch("/api/payments/status?appointment=" + encodeURIComponent(appointmentId), { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Não foi possível consultar o pagamento.");
        if (active) setPayment(result.appointment as PaymentInfo);
      } catch (issue) { if (active) setError(issue instanceof Error ? issue.message : "Não foi possível consultar o pagamento."); }
    };
    void check();
    const timer = window.setInterval(() => { if (attempts < 20 && active) void check(); }, 4000);
    return () => { active = false; window.clearInterval(timer); };
  }, [appointmentId]);

  const approved = payment?.payment_status === "approved" && payment.status === "confirmed";
  const lateApproval = payment?.payment_status === "approved" && payment.status !== "confirmed";
  const failed = !appointmentId || (!lateApproval && ["rejected", "cancelled", "expired"].includes(payment?.payment_status ?? ""));
  return <main className="payment-return-page">
    <Link className="brand" href="/"><span className="brand-mark">v</span><span>clínica<span className="brand-light">vita</span><small>RETORNO DO CHECKOUT</small></span></Link>
    <section className="payment-return-card">
      <span className={approved ? "payment-return-symbol approved" : failed ? "payment-return-symbol failed" : "payment-return-symbol"}>{approved ? "✓" : failed ? "!" : "◷"}</span>
      <div className="section-kicker">{approved ? "PAGAMENTO CONFIRMADO" : !appointmentId ? "CÓDIGO INVÁLIDO" : lateApproval ? "CONFIRMAÇÃO DA CLÍNICA NECESSÁRIA" : failed ? "PAGAMENTO NÃO CONCLUÍDO" : "AGUARDANDO CONFIRMAÇÃO"}</div>
      <h1>{!appointmentId ? "O link de retorno está incompleto." : approved ? "Seu horário está confirmado." : lateApproval ? "Fale com a clínica para validar o horário." : failed ? "Vamos encontrar outro caminho." : "Estamos verificando seu pagamento."}</h1>
      <p>{!appointmentId ? "Não encontramos o código desta consulta. Volte à agenda para começar novamente." : error || (approved ? "A confirmação veio diretamente do Mercado Pago e sua consulta foi reservada." : lateApproval ? "O provedor confirmou o pagamento depois que a reserva temporária expirou. Sua consulta não foi confirmada automaticamente. Entre em contato com a clínica para combinar um horário ou verificar o estorno." : failed ? "Nenhuma confirmação de pagamento foi recebida. Você pode voltar à agenda ou conversar com a clínica." : "Esta página atualiza automaticamente. O provedor ainda está confirmando a cobrança.")}</p>
      {!approved && !failed && !lateApproval && <small>O horário fica reservado por até 20 minutos enquanto o checkout está pendente.</small>}
      <div><Link className="button" href="/paciente/login">Área do paciente <span>↗</span></Link><Link className="payment-return-back" href="/agendar">Voltar à agenda</Link></div>
    </section>
  </main>;
}
