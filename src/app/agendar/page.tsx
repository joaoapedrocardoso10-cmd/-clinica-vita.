import type { Metadata } from "next";
import Link from "next/link";
import BookingForm from "./booking-form";
import WhatsAppFloat from "@/components/whatsapp-float";

export const metadata: Metadata = { title: "Agendar consulta | Clínica Vita", description: "Escolha um serviço, profissional e horário para solicitar sua consulta." };

export default function BookingPage() {
  return <main className="booking-page"><header className="booking-top"><Link className="brand" href="/"><span className="brand-mark">v</span><span>clínica<span className="brand-light">vita</span><small>SAÚDE COM PRESENÇA</small></span></Link><Link className="booking-back" href="/">← Voltar ao site</Link></header><section className="booking-layout"><div className="booking-aside"><div className="section-kicker">AGENDE COM TRANQUILIDADE</div><h1>Um horário<br/>para <em>cuidar de você.</em></h1><p>Escolha o atendimento que precisa. Nossa equipe acompanha cada etapa do seu agendamento.</p><div className="booking-assurances"><div><span>01</span><p><b>Escolha com clareza</b><small>Serviços e profissionais disponíveis.</small></p></div><div><span>02</span><p><b>Horários atualizados</b><small>A disponibilidade vem do sistema da clínica.</small></p></div><div><span>03</span><p><b>Seus dados protegidos</b><small>Usados para organizar seu atendimento.</small></p></div></div><small className="demo-indicator">Sistema demonstrativo · dados fictícios</small></div><BookingForm/></section><footer className="booking-footer">Clínica Vita · Atendimento demonstrativo. Em caso de urgência, procure um serviço de emergência.</footer><WhatsAppFloat message="Olá! Estou na página de agendamento e gostaria de falar com a Clínica Vita." /></main>;
}
