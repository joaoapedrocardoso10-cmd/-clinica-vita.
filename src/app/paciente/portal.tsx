"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { normalizePatientPhone } from "@/lib/phone";

type Patient = { id: string; full_name: string; email: string; phone: string };
type Appointment = { id: string; starts_at: string; ends_at: string; status: string; professional_id: string; service_id: string; professionals: { id: string; display_name: string } | null; services: { id: string; name: string; duration_minutes: number } | null };
type ChangeRequest = { id: string; appointment_id: string; request_type: string; requested_starts_at: string | null; status: string; created_at: string };

export default function PatientPortal({ patient, appointments, requests, loadError }: { patient: Patient; appointments: Appointment[]; requests: ChangeRequest[]; loadError: boolean }) {
  const [fullName, setFullName] = useState(patient.full_name); const [phone, setPhone] = useState(normalizePatientPhone(patient.phone)); const [savingProfile, setSavingProfile] = useState(false); const [message, setMessage] = useState(""); const [busyId, setBusyId] = useState(""); const [rescheduleId, setRescheduleId] = useState(""); const [newTime, setNewTime] = useState("");
  const pendingFor = (appointmentId: string) => requests.find((request) => request.appointment_id === appointmentId && request.status === "pending");
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSavingProfile(true); setMessage("");
    try { const response = await fetch("/api/paciente/perfil", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName, phone }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setMessage("Seus dados foram atualizados."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível atualizar seus dados."); }
    finally { setSavingProfile(false); }
  }
  async function requestChange(appointment: Appointment, requestType: "cancel" | "reschedule") {
    setBusyId(appointment.id); setMessage("");
    try {
      const candidateStartsAt = requestType === "reschedule" && newTime ? new Date(newTime).toISOString() : undefined;
      const response = await fetch("/api/paciente/solicitacoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appointmentId: appointment.id, requestType, candidateStartsAt }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível enviar a solicitação."); }
    finally { setBusyId(""); }
  }
  const upcoming = appointments.filter((item) => new Date(item.starts_at) >= new Date() && ["pending", "confirmed"].includes(item.status));
  const history = appointments.filter((item) => !upcoming.some((next) => next.id === item.id));
  return <main className="patient-portal">
    <header className="patient-portal-header"><Link className="brand" href="/"><span className="brand-mark">v</span><span>clínica<span className="brand-light">vita</span><small>ÁREA DO PACIENTE</small></span></Link><nav><Link href="/agendar">Agendar consulta</Link><form action="/auth/signout?next=/paciente/login" method="post"><button className="admin-logout">Sair</button></form></nav></header>
    <section className="patient-portal-content"><div className="patient-welcome"><div><div className="section-kicker">SEU ESPAÇO VITA</div><h1>Olá, {patient.full_name.split(" ")[0]}.</h1><p>Seus horários e informações, organizados em um só lugar.</p></div><Link className="button" href="/agendar">Agendar consulta <span>↗</span></Link></div>
      {loadError && <p className="patient-feedback">Não foi possível carregar parte das informações. Atualize a página ou tente mais tarde.</p>}{message && <p className="patient-feedback success" role="status">{message}</p>}
      <div className="patient-summary-grid"><article><span>◷</span><small>PRÓXIMOS ATENDIMENTOS</small><b>{upcoming.length}</b></article><article><span>↗</span><small>SOLICITAÇÕES PENDENTES</small><b>{requests.filter((request) => request.status === "pending").length}</b></article><article><span>✳</span><small>CADASTRO</small><b>Atualizado</b></article></div>
      <section className="patient-panel"><div className="patient-panel-heading"><div><div className="section-kicker">AGENDA</div><h2>Seus próximos atendimentos</h2></div><Link href="/agendar">Encontrar um horário ↗</Link></div>
        {!upcoming.length ? <div className="patient-empty-inline"><span>✳</span><p>Você não tem consultas futuras no momento.</p><Link className="text-link" href="/agendar">Agendar uma consulta ↗</Link></div> : <div className="patient-appointment-list">{upcoming.map((appointment) => {
          const date = new Date(appointment.starts_at); const pending = pendingFor(appointment.id);
          return <article className="patient-appointment" key={appointment.id}><div className="patient-date-tile"><small>{new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "").toUpperCase()}</small><b>{date.getDate()}</b><span>{new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", "")}</span></div><div className="patient-appointment-info"><span className="status-pill">{appointment.status === "pending" ? "Aguardando confirmação" : appointment.status === "confirmed" ? "Confirmada" : appointment.status}</span><h3>{appointment.services?.name ?? "Consulta"}</h3><p>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" }).format(date)} · {appointment.professionals?.display_name ?? "Equipe Vita"}</p>{pending && <small className="patient-request-pending">Pedido de {pending.request_type === "cancel" ? "cancelamento" : "remarcação"} aguardando análise</small>}</div><div className="patient-appointment-actions">{pending ? <span className="patient-action-hint">Pedido enviado</span> : <><button type="button" onClick={() => { setRescheduleId(rescheduleId === appointment.id ? "" : appointment.id); setNewTime(""); }}>Pedir remarcação</button><button type="button" className="patient-cancel-link" disabled={busyId === appointment.id} onClick={() => requestChange(appointment, "cancel")}>{busyId === appointment.id ? "Enviando…" : "Pedir cancelamento"}</button></>}{rescheduleId === appointment.id && !pending && <div className="patient-reschedule"><label htmlFor={`new-time-${appointment.id}`}>Nova data e horário</label><input id={`new-time-${appointment.id}`} type="datetime-local" value={newTime} onChange={(event) => setNewTime(event.target.value)}/><button type="button" disabled={!newTime || busyId === appointment.id} onClick={() => requestChange(appointment, "reschedule")}>Enviar pedido</button></div>}</div></article>;
        })}</div>}
      </section>
      <section className="patient-panel"><div className="patient-panel-heading"><div><div className="section-kicker">SEU HISTÓRICO</div><h2>Atendimentos anteriores</h2></div><small>{history.length} {history.length === 1 ? "registro" : "registros"}</small></div>
        {!history.length ? <div className="patient-empty-inline"><span>◷</span><p>Seu histórico aparecerá aqui após um atendimento ou solicitação concluída.</p></div> : <div className="patient-history-list">{history.map((appointment) => {
          const appointmentDate = new Date(appointment.starts_at);
          const labels: Record<string, string> = { completed: "Concluída", cancelled: "Cancelada", no_show: "Não compareceu", pending: "Pendente", confirmed: "Confirmada" };
          const rebookParams = new URLSearchParams({ servico: appointment.service_id, profissional: appointment.professional_id }).toString();
          return <article className="patient-history-entry" key={appointment.id}>
            <div className="patient-history-date">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(appointmentDate)}</div>
            <div className="patient-history-details"><span className={"status-pill " + appointment.status}>{labels[appointment.status] ?? "Atendimento"}</span><h3>{appointment.services?.name ?? "Consulta"}</h3><p>{appointment.professionals?.display_name ?? "Equipe Vita"}</p></div>
            <Link className="patient-history-rebook" href={appointment.service_id && appointment.professional_id ? "/agendar?" + rebookParams : "/agendar"}>Agendar novamente <span aria-hidden="true">↗</span></Link>
          </article>;
        })}</div>}
      </section>
      <section className="patient-panel patient-profile-panel"><div className="patient-panel-heading"><div><div className="section-kicker">SEUS DADOS</div><h2>Perfil e contato</h2></div><small>O e-mail da conta não pode ser alterado aqui.</small></div><form className="patient-profile-form" onSubmit={saveProfile}><label htmlFor="profile-name">Nome completo</label><input id="profile-name" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={120} required/><label htmlFor="profile-email">E-mail</label><input id="profile-email" value={patient.email} disabled/><label htmlFor="profile-phone">Telefone</label><input id="profile-phone" type="tel" inputMode="numeric" pattern="[0-9]{10,13}" title="Informe 10 a 13 dígitos, incluindo DDD; o código do país 55 é opcional." value={phone} onChange={(event) => setPhone(normalizePatientPhone(event.target.value))} minLength={10} maxLength={13} required/><button className="button" disabled={savingProfile}>{savingProfile ? "Salvando…" : "Salvar alterações"}<span>↗</span></button></form></section>
      <p className="patient-privacy-note">Este portal não contém prontuário nem permite enviar informações clínicas. Para dúvidas, fale com a equipe da clínica.</p>
    </section>
  </main>;
}
