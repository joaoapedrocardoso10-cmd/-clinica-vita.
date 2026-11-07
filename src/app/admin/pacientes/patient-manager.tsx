"use client";

import { FormEvent, useEffect, useState } from "react";
import { normalizePatientPhone } from "@/lib/phone";

type Patient = { id: string; full_name: string; email: string; phone: string; created_at: string };
const emptyForm = { fullName: "", email: "", phone: "" };

export default function PatientManager({ initialPatients }: { initialPatients: Patient[] }) {
  const [patients, setPatients] = useState(initialPatients); const [query, setQuery] = useState(""); const [form, setForm] = useState(emptyForm); const [editing, setEditing] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { const timer = window.setTimeout(async () => { try { const response = await fetch(`/api/admin/pacientes?q=${encodeURIComponent(query)}`); const result = await response.json(); if (response.ok) setPatients(result.patients); } catch { /* mantém a última lista já carregada */ } }, 220); return () => window.clearTimeout(timer); }, [query]);
  function edit(patient: Patient) { setEditing(patient.id); setForm({ fullName: patient.full_name, email: patient.email, phone: patient.phone }); setMessage(""); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try { const response = await fetch("/api/admin/pacientes", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing ? { id: editing, fullName: form.fullName, phone: form.phone } : form) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setMessage(editing ? "Cadastro atualizado." : "Paciente cadastrado."); setForm(emptyForm); setEditing(""); if (result.patient) setPatients((current) => [result.patient, ...current]); else { const refreshed = await fetch(`/api/admin/pacientes?q=${encodeURIComponent(query)}`).then((r) => r.json()); setPatients(refreshed.patients ?? []); } }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Não foi possível salvar o cadastro."); }
    finally { setBusy(false); }
  }
  return <><form className="admin-simple-form" onSubmit={submit}><label>Nome completo<input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} maxLength={120} required/></label><label>E-mail<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} maxLength={254} required disabled={Boolean(editing)}/></label><label>Telefone<input type="tel" inputMode="numeric" pattern="[0-9]{10,13}" title="Informe 10 a 13 dígitos, incluindo DDD." value={form.phone} onChange={(event) => setForm({ ...form, phone: normalizePatientPhone(event.target.value) })} minLength={10} maxLength={13} required/></label><button disabled={busy}>{busy ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar paciente"}</button>{editing && <button type="button" onClick={() => { setEditing(""); setForm(emptyForm); }}>Cancelar edição</button>}{message && <p role="status">{message}</p>}</form>
    <div className="admin-filter-form"><label>Buscar paciente<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, e-mail ou telefone"/></label><span>{patients.length} cadastro(s) nesta lista</span></div>
    <div className="admin-table-card"><div className="admin-table-head"><div><h2>Pacientes</h2><p>Dados cadastrais e contato · sem prontuários clínicos</p></div></div>{!patients.length ? <p className="admin-empty">Nenhum cadastro encontrado.</p> : <div className="admin-table-wrap"><table><thead><tr><th>NOME</th><th>E-MAIL</th><th>TELEFONE</th><th>CADASTRADO</th><th>AÇÕES</th></tr></thead><tbody>{patients.map((patient) => <tr key={patient.id}><td>{patient.full_name}</td><td>{patient.email}</td><td>{patient.phone}</td><td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(patient.created_at))}</td><td><button className="admin-record-actions" onClick={() => edit(patient)}>Editar</button></td></tr>)}</tbody></table></div>}</div></>;
}
