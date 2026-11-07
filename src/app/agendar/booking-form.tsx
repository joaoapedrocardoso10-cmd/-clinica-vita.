"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { professionalWhatsAppUrl } from "@/lib/clinic-contact";
import { normalizePatientPhone } from "@/lib/phone";

type Service = { id: string; name: string; duration_minutes: number; price_cents: number | null; specialty_id: string | null };
type Professional = { id: string; display_name: string; specialty_id: string | null; bio: string | null; whatsapp_phone: string | null };
type Slot = { starts_at: string; ends_at: string; status: "available" | "booked" | "blocked" };

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

const weekdayPlural = ["domingos", "segundas-feiras", "terças-feiras", "quartas-feiras", "quintas-feiras", "sextas-feiras", "sábados"];

export default function BookingForm() {
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState("");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [today, setToday] = useState("");
  const [viewingMonth, setViewingMonth] = useState("");
  const [weekdayFilter, setWeekdayFilter] = useState<number | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [occupancyEnabled, setOccupancyEnabled] = useState(true);
  const [slot, setSlot] = useState("");
  const [patient, setPatient] = useState({ fullName: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [notice, setNotice] = useState("");
  const [slotNotice, setSlotNotice] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [bookingMethod, setBookingMethod] = useState<"whatsapp" | "online">("whatsapp");
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountProfile, setAccountProfile] = useState<{ full_name: string; email: string; phone: string } | null>(null);
  const [successWhatsAppUrl, setSuccessWhatsAppUrl] = useState("");
  const dateScroller = useRef<HTMLDivElement>(null);

  const selectedService = services.find((item) => item.id === serviceId);
  const selectedProfessional = professionals.find((item) => item.id === professionalId);
  const matchedProfessionals = useMemo(() => professionals.filter((item) => !selectedService?.specialty_id || item.specialty_id === selectedService.specialty_id), [professionals, selectedService]);
  const professionalWhatsApp = selectedProfessional?.whatsapp_phone
    ? professionalWhatsAppUrl(selectedProfessional.whatsapp_phone, `Olá, ${selectedProfessional.display_name}! Gostaria de conversar${selectedService ? ` sobre ${selectedService.name}` : " sobre uma consulta"}.`)
    : "";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const currentDate = new Date();
      setToday(dateKey(currentDate));
      setViewingMonth(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/paciente/perfil", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        const result = await response.json();
        return result.profile as { full_name: string; email: string; phone: string } | null;
      })
      .then((profile) => {
        if (!active || !profile) return;
        setAccountProfile(profile);
        setPatient({ fullName: profile.full_name, email: profile.email, phone: normalizePatientPhone(profile.phone ?? "") });
      })
      .catch(() => undefined)
      .finally(() => { if (active) setAccountLoading(false); });
    return () => { active = false; };
  }, []);

  const monthDates = useMemo(() => {
    if (!viewingMonth) return [];
    const [year, month] = viewingMonth.split("-").map(Number);
    const count = new Date(year, month, 0).getDate();
    return Array.from({ length: count }, (_, index) => new Date(year, month - 1, index + 1, 12));
  }, [viewingMonth]);
  const visibleDates = monthDates.filter((day) => (weekdayFilter === null || day.getDay() === weekdayFilter) && dateKey(day) >= today);
  const matchingWeekdayDates = weekdayFilter === null ? [] : visibleDates.filter((day) => day.getDay() === weekdayFilter).map(dateKey);
  const isAllWeekdayDatesSelected = matchingWeekdayDates.length > 1 && matchingWeekdayDates.every((value) => selectedDates.includes(value));
  const selectedMonth = viewingMonth ? new Date(`${viewingMonth}-01T12:00:00`) : null;
  const availableCount = slots.filter((item) => item.status === "available").length;
  const bookedCount = slots.filter((item) => item.status === "booked").length;
  const blockedCount = slots.filter((item) => item.status === "blocked").length;
  const requestedDatesKey = (selectedDates.length ? selectedDates : date ? [date] : []).join(",");

  useEffect(() => {
    dateScroller.current?.scrollTo({ left: 0, behavior: "smooth" });
  }, [weekdayFilter, viewingMonth]);

  useEffect(() => {
    fetch("/api/catalog").then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setServices(result.services);
      setProfessionals(result.professionals);
      const params = new URLSearchParams(window.location.search);
      const requestedService = result.services.find((item: Service) => item.id === params.get("servico"));
      const requestedProfessional = result.professionals.find((item: Professional) => item.id === params.get("profissional"));
      if (requestedService) {
        setServiceId(requestedService.id);
        if (requestedProfessional && (!requestedService.specialty_id || requestedProfessional.specialty_id === requestedService.specialty_id)) {
          setProfessionalId(requestedProfessional.id);
        }
      }
    }).catch((error: Error) => setNotice(error.message || "Não foi possível carregar os serviços."));
  }, []);

  useEffect(() => {
    if (!serviceId || !professionalId || !requestedDatesKey) return;
    let active = true;
    let controller: AbortController | null = null;
    const datesToLoad = requestedDatesKey.split(",");
    const loadSlots = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const results = await Promise.all(datesToLoad.map(async (requestedDate) => {
          const response = await fetch(`/api/availability?serviceId=${encodeURIComponent(serviceId)}&professionalId=${encodeURIComponent(professionalId)}&date=${encodeURIComponent(requestedDate)}`, { signal: controller?.signal, cache: "no-store" });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          return result;
        }));
        if (!active) return;
        const localTime = (startsAt: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(startsAt));
        const slotsByTime = new Map<string, Slot[]>();
        for (const result of results) for (const item of (result.slots ?? []) as Slot[]) {
          const timeKey = localTime(item.starts_at);
          slotsByTime.set(timeKey, [...(slotsByTime.get(timeKey) ?? []), item]);
        }
        const updatedSlots: Slot[] = [...slotsByTime.entries()].sort(([timeA], [timeB]) => timeA.localeCompare(timeB)).map(([, occurrences]) => {
          const allDatesHaveTime = occurrences.length === datesToLoad.length;
          const status = occurrences.some((item) => item.status === "booked") ? "booked" : allDatesHaveTime && occurrences.every((item) => item.status === "available") ? "available" : "blocked";
          return { ...occurrences[0], status };
        });
        setOccupancyEnabled(results.every((result) => result.occupancyEnabled !== false));
        if (slot) {
          const chosenTime = localTime(slot);
          const chosenSlot = updatedSlots.find((item) => localTime(item.starts_at) === chosenTime);
          if (!chosenSlot || chosenSlot.status !== "available") {
            setSlot("");
            setSlotNotice("Esse horário acabou de ser solicitado por outra pessoa. Escolha outro horário livre.");
          }
        }
        setSlots(updatedSlots);
      } catch (error) {
        if (active && error instanceof Error && error.name !== "AbortError") {
          setSlots([]);
          setNotice(error.message || "Não foi possível consultar os horários.");
        }
      } finally {
        if (active) setLoadingSlots(false);
      }
    };
    const initialLoad = window.setTimeout(() => { setLoadingSlots(true); setSlots([]); void loadSlots(); }, 0);
    const refresh = window.setInterval(loadSlots, 30000);
    return () => { active = false; window.clearTimeout(initialLoad); window.clearInterval(refresh); controller?.abort(); };
  }, [serviceId, professionalId, requestedDatesKey, slot]);

  function chooseDate(value: string) {
    setDate(value);
    setSelectedDates(value ? [value] : []);
    if (value) setViewingMonth(value.slice(0, 7));
    setSlots([]);
    setLoadingSlots(false);
    setSlot("");
    setNotice("");
    setSlotNotice("");
  }

  function moveMonth(amount: number) {
    if (!viewingMonth) return;
    const [year, month] = viewingMonth.split("-").map(Number);
    const next = new Date(year, month - 1 + amount, 1, 12);
    const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    setViewingMonth(nextKey);
    setDate(""); setSelectedDates([]); setSlots([]); setSlot(""); setLoadingSlots(false); setNotice(""); setSlotNotice("");
    setWeekdayFilter(null);
  }

  function filterWeekday(day: number | null) {
    setWeekdayFilter(day);
    if (day !== null && selectedDates.some((value) => new Date(`${value}T12:00:00`).getDay() !== day)) chooseDate("");
  }

  function toggleAllWeekdayDates() {
    if (isAllWeekdayDatesSelected) { chooseDate(""); return; }
    if (matchingWeekdayDates.length < 2) return;
    setSelectedDates(matchingWeekdayDates);
    setBookingMethod("whatsapp");
    setDate(matchingWeekdayDates[0]);
    setSlots([]); setSlot(""); setLoadingSlots(false); setNotice(""); setSlotNotice("");
  }

  function scrollDates(direction: -1 | 1) {
    dateScroller.current?.scrollBy({ left: direction * 340, behavior: "smooth" });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(""); setConfirmed(false);
    if (!serviceId || !professionalId || !selectedDates.length || !slot) { setNotice("Selecione o serviço, profissional, data e horário."); return; }
    setBusy(true);
    try {
      const isRecurring = selectedDates.length > 1;
      const localTime = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(slot));
      if (accountProfile && accountProfile.phone !== patient.phone) {
        const profileResponse = await fetch("/api/paciente/perfil", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: accountProfile.full_name, phone: patient.phone }) });
        const profileResult = await profileResponse.json();
        if (!profileResponse.ok) throw new Error(profileResult.error || "Confira seu telefone para continuar.");
        setAccountProfile({ ...accountProfile, phone: patient.phone });
      }
      const booking = isRecurring
        ? { serviceId, professionalId, dates: selectedDates, time: localTime, patient, bookingMethod: "whatsapp" as const }
        : { serviceId, professionalId, startsAt: slot, patient, bookingMethod };
      const response = await fetch("/api/booking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(booking) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível concluir o pedido.");
      if (bookingMethod === "online") {
        if (!result.checkoutUrl) throw new Error("Não recebemos o link seguro para pagamento. Tente novamente ou escolha WhatsApp.");
        window.location.assign(result.checkoutUrl as string);
        return;
      }
      const selectedDay = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date(slot));
      const selectedTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(slot));
      const whatsappMessage = "Olá, " + (selectedProfessional?.display_name ?? "gostaria de falar") + "! Solicitei " + (selectedService?.name ?? "um atendimento") + " para " + selectedDay + " às " + selectedTime + ". Pode me ajudar a confirmar?";
      const confirmedWhatsAppUrl = selectedProfessional?.whatsapp_phone ? professionalWhatsAppUrl(selectedProfessional.whatsapp_phone, whatsappMessage) : "";
      setSuccessWhatsAppUrl(isRecurring ? "" : confirmedWhatsAppUrl);
      setConfirmed(true); setNotice(isRecurring ? `Solicitações recebidas para ${selectedDates.length} ${weekdayPlural[new Date(`${selectedDates[0]}T12:00:00`).getDay()]}. A clínica confirmará as datas pelos dados informados.` : "Solicitação recebida. A clínica confirmará o atendimento pelos dados informados.");
      if (!accountProfile) setPatient({ fullName: "", email: "", phone: "" }); setSlot("");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao enviar o agendamento."); }
    finally { setBusy(false); }
  }

  return <form className="booking-card" onSubmit={submit}>
    <div className="booking-card-head"><span>AGENDE SUA CONSULTA</span><div><i/> Atendimento online</div></div>
    <div className="booking-step"><span>1</span><div><h2>Escolha o atendimento</h2><small>Selecione o serviço e o profissional.</small></div></div>
    <label htmlFor="service">Serviço ou especialidade</label>
    <select id="service" value={serviceId} onChange={(e) => { setServiceId(e.target.value); setProfessionalId(""); setSlots([]); setSlot(""); setLoadingSlots(false); }} required><option value="">Selecione um serviço</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.duration_minutes} min</option>)}</select>
    <label htmlFor="professional">Profissional</label>
    <select id="professional" value={professionalId} onChange={(e) => { setProfessionalId(e.target.value); setSlots([]); setSlot(""); setLoadingSlots(false); }} disabled={!serviceId} required><option value="">Selecione um profissional</option>{matchedProfessionals.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select>
    <section className="booking-whatsapp" aria-label="WhatsApp do profissional escolhido">
      <div className="professional-contact-copy"><span className="professional-contact-icon" aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false"><path d="M16.02 3.2a12.63 12.63 0 0 0-10.8 19.18L3.5 28.8l6.57-1.72A12.65 12.65 0 1 0 16.02 3.2Zm0 22.98c-1.94 0-3.84-.52-5.5-1.5l-.4-.24-3.9 1.02 1.04-3.8-.26-.4a10.25 10.25 0 1 1 9.02 4.92Zm5.63-7.68c-.31-.16-1.83-.9-2.11-1-.28-.1-.49-.16-.7.16-.2.31-.8 1-.98 1.2-.18.21-.36.24-.67.08-.31-.15-1.3-.48-2.48-1.53-.92-.82-1.54-1.83-1.72-2.14-.18-.31-.02-.48.14-.64.14-.14.31-.36.46-.54.15-.18.2-.3.31-.52.1-.2.05-.39-.03-.54-.08-.16-.7-1.68-.96-2.3-.25-.6-.51-.52-.7-.53h-.6c-.2 0-.54.08-.82.39-.28.31-1.08 1.05-1.08 2.57s1.1 2.98 1.25 3.19c.15.2 2.17 3.31 5.25 4.64.73.31 1.3.5 1.75.64.74.23 1.41.2 1.94.12.6-.09 1.83-.75 2.09-1.48.26-.72.26-1.34.18-1.47-.08-.13-.28-.2-.59-.36Z" /></svg></span><span><b>Fale com o profissional</b><small>{selectedProfessional ? `WhatsApp de ${selectedProfessional.display_name}` : "Escolha um profissional acima para ver o contato direto."}</small></span></div>
      {professionalWhatsApp ? <a href={professionalWhatsApp} target="_blank" rel="noreferrer">Conversar pelo WhatsApp <span aria-hidden="true">↗</span></a> : <span className="professional-contact-unavailable">{selectedProfessional ? "WhatsApp direto não cadastrado" : "Selecione acima"}</span>}
    </section>
    <div className="booking-divider"/>
    <div className="booking-step"><span>2</span><div><h2>Encontre um horário</h2><small>Escolha o melhor dia e horário para você.</small></div></div>
    <div className="date-picker">
      <div className="date-picker-heading"><div><span className="booking-field-title">Escolha o dia</span><small>Role para ver todas as datas do mês</small></div><label className="date-input-wrap" htmlFor="date"><span>Outra data</span><input id="date" type="date" min={today || undefined} value={date} onChange={(e) => chooseDate(e.target.value)} aria-label="Escolher outra data" required/></label></div>
      <div className="month-navigation">
        <button type="button" onClick={() => moveMonth(-1)} disabled={!viewingMonth || Boolean(today && viewingMonth <= today.slice(0, 7))} aria-label="Mês anterior">‹</button>
        <b>{selectedMonth ? new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(selectedMonth).replace(/^./, (letter) => letter.toLocaleUpperCase("pt-BR")) : "Carregando calendário…"}</b>
        <button type="button" onClick={() => moveMonth(1)} disabled={!viewingMonth} aria-label="Próximo mês">›</button>
      </div>
      <div className="weekday-filters" role="group" aria-label="Filtrar dias da semana">
        <button type="button" className={weekdayFilter === null ? "weekday-filter active" : "weekday-filter"} onClick={() => filterWeekday(null)}>Todos os dias</button>
        {[{ label: "Dom", full: "domingo", value: 0 }, { label: "Seg", full: "segunda-feira", value: 1 }, { label: "Ter", full: "terça-feira", value: 2 }, { label: "Qua", full: "quarta-feira", value: 3 }, { label: "Qui", full: "quinta-feira", value: 4 }, { label: "Sex", full: "sexta-feira", value: 5 }, { label: "Sáb", full: "sábado", value: 6 }].map((item) => <button type="button" key={item.value} className={weekdayFilter === item.value ? "weekday-filter active" : "weekday-filter"} onClick={() => filterWeekday(item.value)} aria-label={`Ver todas as datas de ${item.full} deste mês`} title={`Ver todas as datas de ${item.full} deste mês`} aria-pressed={weekdayFilter === item.value}>{item.label}</button>)}
      </div>
      {weekdayFilter !== null && matchingWeekdayDates.length > 1 && <div className="bulk-date-action"><div><b>Quer repetir semanalmente?</b><small>Marque as {weekdayPlural[weekdayFilter]} restantes e solicite o mesmo horário para todas.</small></div><button type="button" className={isAllWeekdayDatesSelected ? "bulk-date-button active" : "bulk-date-button"} onClick={toggleAllWeekdayDates} aria-pressed={isAllWeekdayDatesSelected}>{isAllWeekdayDatesSelected ? "Desmarcar todas" : `Marcar todas as ${weekdayPlural[weekdayFilter]} deste mês`}</button></div>}
      <div className="date-scroll-shell">
        <button className="date-scroll-arrow" type="button" onClick={() => scrollDates(-1)} aria-label="Ver datas anteriores">‹</button>
        <div className="date-choice-grid" role="group" aria-label="Datas do mês" ref={dateScroller}>
        {visibleDates.map((day) => {
          const value = dateKey(day);
          return <button className={selectedDates.includes(value) ? "date-choice selected" : "date-choice"} type="button" key={value} onClick={() => chooseDate(value)} aria-pressed={selectedDates.includes(value)}>
            <span>{new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(day).replace(".", "")}</span><b>{day.getDate()}</b><small>{new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(day).replace(".", "")}</small>
          </button>;
        })}
        {!visibleDates.length && <p className="no-dates-message">Não há mais datas futuras neste mês para esse dia da semana.</p>}
        </div>
        <button className="date-scroll-arrow" type="button" onClick={() => scrollDates(1)} aria-label="Ver próximas datas">›</button>
      </div>
      {selectedDates.length > 1 ? <p className="chosen-date-label"><span aria-hidden="true">✓</span> {selectedDates.length} {weekdayPlural[new Date(`${selectedDates[0]}T12:00:00`).getDay()]} selecionadas · o mesmo horário será solicitado em todas.</p> : date && <p className="chosen-date-label"><span aria-hidden="true">✓</span> {new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`))}</p>}
      <div className="calendar-legend"><span><i className="legend-available"/>Selecionada</span><span>Os horários são atualizados automaticamente.</span></div>
    </div>
    <div className="available-times">
      <div className="times-heading"><span className="booking-field-title">{selectedDates.length > 1 ? "Horários para todas as datas" : "Horários do dia"}</span>{date && serviceId && professionalId && !loadingSlots && slots.length > 0 && <small>{selectedDates.length > 1 ? `${availableCount} livres em todas · ${slots.length - availableCount} conflitos` : `${availableCount} livres${bookedCount > 0 ? ` · ${bookedCount} ocupados` : ""}${blockedCount > 0 ? ` · ${blockedCount} indisponíveis` : ""}`}</small>}</div>
      {!occupancyEnabled && serviceId && professionalId && date && <p className="availability-upgrade-note">A atualização do banco está pendente. Horários ocupados e pedidos recorrentes serão ativados após aplicar a migração 002 no Supabase.</p>}
      {slotNotice && <p className="slot-notice" role="status">{slotNotice}</p>}
      {!serviceId || !professionalId ? <p className="slot-message">Selecione o serviço e o profissional para consultar os horários.</p>
        : !date ? <p className="slot-message">Escolha uma data para ver os horários livres.</p>
        : loadingSlots ? <p className="slot-message slot-loading"><i/> Consultando horários livres…</p>
        : slots.length ? <div className="slot-grid">{slots.map((item) => {
          const time = new Date(item.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          const unavailable = item.status !== "available";
          return <button className={`slot${slot === item.starts_at ? " selected" : ""}${item.status === "booked" ? " booked" : item.status === "blocked" ? " blocked" : ""}`} type="button" key={item.starts_at} onClick={() => { if (!unavailable) { setSlot(item.starts_at); setSlotNotice(""); } }} aria-pressed={slot === item.starts_at} aria-disabled={unavailable} disabled={unavailable} title={item.status === "booked" ? selectedDates.length > 1 ? "Este horário já foi solicitado em pelo menos uma data." : "Este horário já foi solicitado." : item.status === "blocked" ? selectedDates.length > 1 ? "Este horário não está disponível em todas as datas." : "Este horário não está disponível." : undefined}><span aria-hidden="true">◷</span>{time}<small>{item.status === "booked" ? selectedDates.length > 1 ? "Ocupado em uma data" : "Ocupado" : item.status === "blocked" ? selectedDates.length > 1 ? "Conflito na série" : "Indisponível" : slot === item.starts_at ? "Selecionado" : "Livre"}</small></button>;
        })}</div>
        : <p className="slot-message">Não encontramos horários livres para este dia. Escolha outra data.</p>}
      {slot && <div className="selected-appointment"><span className="selected-check">✓</span><span><small>{selectedDates.length > 1 ? `SÉRIE · ${selectedDates.length} DATAS` : "HORÁRIO SELECIONADO"}</small><b>{selectedDates.length > 1 ? `${selectedDates.length} ${weekdayPlural[new Date(`${selectedDates[0]}T12:00:00`).getDay()]} · todas às ` : `${new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`))} · `}{new Date(slot).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</b></span></div>}
    </div>
    <div className="booking-divider"/>
    <div className="booking-step"><span>3</span><div><h2>Seus dados</h2><small>Para a clínica retornar e confirmar.</small></div></div>
    <label htmlFor="patient-name">Nome completo</label><input id="patient-name" autoComplete="name" maxLength={120} value={patient.fullName} onChange={(e) => setPatient({ ...patient, fullName: e.target.value })} readOnly={Boolean(accountProfile)} required/>
    <div className="patient-fields"><div><label htmlFor="patient-email">E-mail</label><input id="patient-email" type="email" autoComplete="email" maxLength={254} value={patient.email} onChange={(e) => setPatient({ ...patient, email: e.target.value })} readOnly={Boolean(accountProfile)} required/></div><div><label htmlFor="patient-phone">Telefone</label><input id="patient-phone" type="tel" inputMode="numeric" pattern="[0-9]{10,13}" title="Informe 10 a 13 dígitos, incluindo DDD; o código do país 55 é opcional." autoComplete="tel" minLength={10} maxLength={13} value={patient.phone} onChange={(e) => setPatient({ ...patient, phone: normalizePatientPhone(e.target.value) })} required/></div></div>
    {accountProfile ? <div className="booking-account-note"><span>✓</span><div><b>Você está conectado à sua conta</b><small>Nome e e-mail vieram do seu perfil. Atualize o telefone somente se necessário.</small></div></div> : <div className="booking-account-note"><span>＋</span><div><b>Agende ainda mais rápido da próxima vez</b><small><Link href="/paciente/login?modo=cadastro">Crie sua conta</Link> para salvar seus dados. Você também pode continuar sem conta.</small></div></div>}
    <div className="booking-payment-choice">
      <div className="booking-payment-heading"><span>COMO PREFERE CONTINUAR?</span><small>Esta demonstração pode ser configurada para cada clínica.</small></div>
      <div className="booking-payment-options">
        <label className={bookingMethod === "whatsapp" ? "booking-payment-option chosen" : "booking-payment-option"}>
          <input type="radio" name="booking-method" value="whatsapp" checked={bookingMethod === "whatsapp"} onChange={() => setBookingMethod("whatsapp")}/>
          <span className="payment-option-icon whatsapp-option-icon">◉</span><span><b>Falar pelo WhatsApp</b><small>A equipe confirma o atendimento diretamente com você.</small></span><i>{bookingMethod === "whatsapp" ? "✓" : ""}</i>
        </label>
        <label className={bookingMethod === "online" ? "booking-payment-option chosen" : "booking-payment-option"}>
          <input type="radio" name="booking-method" value="online" checked={bookingMethod === "online"} onChange={() => setBookingMethod("online")} disabled={selectedDates.length > 1}/>
          <span className="payment-option-icon">▣</span><span><b>Pagar online</b><small>{selectedService?.price_cents != null ? "Total: " + new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(selectedService.price_cents / 100) + " · Mercado Pago (requer configuração da clínica)." : "Checkout online, se o serviço tiver valor configurado."}{selectedDates.length > 1 ? " Disponível para uma consulta por vez." : ""}</small></span><i>{bookingMethod === "online" ? "✓" : ""}</i>
        </label>
      </div>
      <p className="booking-payment-template-note">No site do cliente, a clínica escolhe se ativa WhatsApp, pagamento online ou os dois.</p>
    </div>
    <div className="booking-consent">Ao continuar, você autoriza a clínica a usar seus dados para organizar e responder sobre esta solicitação. Não informe dados clínicos neste formulário.</div>
    <button className="button booking-submit" type="submit" disabled={busy || !services.length || loadingSlots || accountLoading || (selectedDates.length > 1 && !occupancyEnabled)}>{busy ? (bookingMethod === "online" ? "Preparando pagamento…" : "Enviando solicitação…") : selectedDates.length > 1 ? "Solicitar " + selectedDates.length + " datas" : bookingMethod === "online" ? "Reservar e ir para o pagamento" : "Solicitar agendamento"}<span>↗</span></button>
    {notice && <div className={confirmed ? "booking-notice success" : "booking-notice"} role="status">{notice}{confirmed && successWhatsAppUrl && <a className="booking-confirmation-whatsapp" href={successWhatsAppUrl} target="_blank" rel="noreferrer">Abrir conversa no WhatsApp ↗</a>}</div>}
  </form>;
}
