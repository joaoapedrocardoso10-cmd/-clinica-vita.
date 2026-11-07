"use client";

import { useState } from "react";
import { clinicWhatsAppDisplay, clinicWhatsAppUrl } from "@/lib/clinic-contact";
import WhatsAppFloat from "@/components/whatsapp-float";
import AdminNavLink from "@/components/admin-nav-link";

const specialties = [
  { icon: "✳", name: "Clínica geral", detail: "Cuidado próximo em todas as fases da vida." },
  { icon: "♡", name: "Cardiologia", detail: "Prevenção e saúde para o seu coração." },
  { icon: "⌁", name: "Dermatologia", detail: "Cuidado completo com a saúde da pele." },
  { icon: "◉", name: "Pediatria", detail: "Acolhimento e atenção para os pequenos." },
];

const doctors = [
  { name: "Dra. Helena Martins", title: "Clínica geral · CRM 123456", image: "photo-1559839734-2b71ea197ec2" },
  { name: "Dr. Rafael Costa", title: "Cardiologia · CRM 234567", image: "photo-1612349317150-e413f6a5b16d" },
  { name: "Dra. Camila Nunes", title: "Dermatologia · CRM 345678", image: "photo-1594824476967-48c8b964273f" },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const mapsUrl = "https://maps.google.com/?q=Av.+Paulista,+1000,+S%C3%A3o+Paulo";
  const whatsappUrl = clinicWhatsAppUrl("Olá, gostaria de mais informações sobre a Clínica Vita.");
  const year = 2026;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSubmitted(false);
    if (sending) return;
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setFormError("Preencha todos os campos para continuar.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setFormError("Confira o formato do seu e-mail.");
      return;
    }
    setSending(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, website: "" }),
      });
      const result: { ok?: boolean; error?: string } = await response.json();
      if (!response.ok || !result.ok) {
        setFormError(result.error ?? "Não foi possível enviar sua mensagem agora. Tente novamente ou use o WhatsApp.");
        return;
      }
      setSubmitted(true);
      setFormError("Mensagem enviada. Nossa equipe recebeu seu contato e responderá pelo e-mail informado.");
      setForm({ name: "", email: "", message: "" });
    } catch {
      setFormError("Não foi possível conectar ao serviço de envio. Tente novamente ou fale conosco pelo WhatsApp.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main>
      <div className="announcement"><span>Um cuidado que acompanha você.</span><a href={whatsappUrl} target="_blank" rel="noreferrer">Fale com nossa equipe <span aria-hidden="true">↗</span></a></div>
      <header className="header">
        <a className="brand" href="#inicio" aria-label="Clínica Vita, início"><span className="brand-mark">v</span><span>clínica<span className="brand-light">vita</span><small>SAÚDE COM PRESENÇA</small></span></a>
        <button className="menu-toggle" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? "×" : "☰"}</button>
        <nav className={menuOpen ? "nav nav-open" : "nav"} aria-label="Navegação principal">
          <a href="#sobre" onClick={() => setMenuOpen(false)}>A clínica</a><a href="#especialidades" onClick={() => setMenuOpen(false)}>Especialidades</a><a href="#equipe" onClick={() => setMenuOpen(false)}>Profissionais</a><a href="#contato" onClick={() => setMenuOpen(false)}>Contato</a><AdminNavLink onClick={() => setMenuOpen(false)} /><a href="/paciente/login" onClick={() => setMenuOpen(false)}>Entrar / criar conta</a>
          <a className="button button-small" href="/agendar" onClick={() => setMenuOpen(false)}>Agendar consulta <span>↗</span></a>
        </nav>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> CUIDADO FEITO PARA VOCÊ</div><h1>Saúde é se sentir <em>bem cuidado.</em></h1><p>Uma clínica completa, com profissionais que escutam, acolhem e acompanham você em cada etapa.</p><div className="hero-actions"><a className="button" href="/agendar">Agende sua consulta <span>↗</span></a><a className="text-link" href="/paciente/login?modo=cadastro">Crie sua conta <span>↗</span></a></div><div className="hero-note"><span className="avatar-stack"><i>H</i><i>R</i><i>C</i></span><span><b>Atendimento próximo</b><small>Uma equipe ao seu lado.</small></span></div></div>
        <div className="hero-visual"><div className="hero-image" role="img" aria-label="Profissional de saúde acolhendo uma paciente"/><div className="image-tint"/><div className="hero-card"><div className="card-icon">✳</div><div><b>Seu cuidado, por inteiro.</b><small>Medicina com atenção e propósito.</small></div><span className="card-arrow">↗</span></div><div className="hero-stamp"><span>V</span><small>CLÍNICA<br/>VITA</small></div></div>
        <div className="hero-bottom"><span>01 — 04</span><span className="bottom-line"/><span>UM NOVO JEITO DE CUIDAR</span><a href="#sobre" aria-label="Rolar para conhecer a clínica">↓</a></div>
      </section>

      <section className="premium-showcase" aria-labelledby="premium-title">
        <div className="premium-showcase-head">
          <div><span className="premium-demo-label">MODELO PREMIUM · DEMONSTRAÇÃO CONFIGURÁVEL</span><h2 id="premium-title">Um site. <em>Três caminhos</em> para cuidar melhor.</h2></div>
          <p>Este template pode ser personalizado para cada clínica. Ative cadastro de pacientes, agendamento por WhatsApp, pagamento online e gestão privada.</p>
        </div>
        <div className="premium-feature-grid">
          <a href="/paciente/login?modo=cadastro" className="premium-feature-card"><span className="premium-feature-number">01</span><span className="premium-feature-icon">↗</span><h3>Portal do paciente</h3><p>Crie uma conta com Google, Facebook ou e-mail. Depois, seus dados ficam preenchidos na agenda.</p><b>Criar conta <span>↗</span></b></a>
          <a href="/agendar" className="premium-feature-card"><span className="premium-feature-number">02</span><span className="premium-feature-icon">◷</span><h3>Agende do seu jeito</h3><p>Escolha falar pelo WhatsApp do profissional ou pagar online pelo checkout da clínica.</p><b>Ver as opções <span>↗</span></b></a>
          <article className="premium-feature-card premium-private-card"><span className="premium-feature-number">03</span><span className="premium-feature-icon">⌑</span><h3>Painel administrativo privado</h3><p>Agenda, equipe, serviços e relatórios só aparecem para o dono e usuários autorizados pela clínica. Não existe cadastro público para o painel.</p><b>Acesso privado da clínica</b></article>
        </div>
        <p className="premium-template-note">Demonstração fictícia: contas sociais e pagamentos precisam ser conectados às contas da clínica antes de ativar em produção.</p>
      </section>
      <section className="trust-strip" aria-label="Diferenciais"><div><span>✳</span><p><b>Escuta de verdade</b><small>Você no centro de cada conversa</small></p></div><div><span>⌖</span><p><b>Equipe integrada</b><small>Especialidades que se conectam</small></p></div><div><span>◷</span><p><b>Tempo para você</b><small>Consultas sem pressa</small></p></div><div><span>⌂</span><p><b>Um espaço acolhedor</b><small>Feito para você se sentir bem</small></p></div></section>

      <section className="section about" id="sobre"><div className="section-kicker">01 / SOBRE A VITA</div><div className="about-grid"><div><h2>Mais do que tratar.<br/><em>Cuidar de verdade.</em></h2></div><div className="about-text"><p className="lead">Acreditamos que saúde começa quando alguém realmente escuta.</p><p>Na Clínica Vita, cada encontro é pensado para você. Com uma equipe multidisciplinar e um olhar atento à sua história, oferecemos um cuidado completo, próximo e humano.</p><a className="text-link" href="#equipe">Conheça nossa equipe <span>↗</span></a></div></div><div className="about-image" role="img" aria-label="Interior tranquilo e acolhedor da clínica"><div className="image-caption">UM ESPAÇO PENSADO PARA O SEU BEM-ESTAR <span>— SÃO PAULO, SP</span></div></div></section>

      <section className="section specialties" id="especialidades"><div className="section-heading"><div><div className="section-kicker">02 / COMO PODEMOS AJUDAR</div><h2>Cuidado em cada<br/><em>especialidade.</em></h2></div><p>Uma equipe completa para acompanhar você com atenção e conhecimento.</p></div><div className="specialty-grid">{specialties.map((item, index) => <a href="#contato" className="specialty-card" key={item.name}><span className="specialty-number">0{index + 1}</span><span className="specialty-icon">{item.icon}</span><h3>{item.name}</h3><p>{item.detail}</p><span className="specialty-arrow">↗</span></a>)}</div><div className="services-note"><span>✳</span><p>Também oferecemos <b>exames preventivos, acompanhamento e orientação em saúde.</b></p><a href="#contato">Tire suas dúvidas ↗</a></div></section>

      <section className="quote-section"><div className="quote-mark">“</div><blockquote>Um bom cuidado começa<br/>com <em>uma boa conversa.</em></blockquote><div className="quote-credit"><span/> NOSSO JEITO DE CUIDAR</div><div className="quote-decoration">V</div></section>

      <section className="section team" id="equipe"><div className="section-heading"><div><div className="section-kicker">03 / QUEM CUIDA DE VOCÊ</div><h2>Pessoas que fazem<br/><em>a diferença.</em></h2></div><p>Profissionais dedicados a entender você por inteiro, com conhecimento e acolhimento.</p></div><div className="team-grid">{doctors.map((doctor, index) => <article className="doctor-card" key={doctor.name}><div className={`doctor-photo doctor-photo-${index}`} style={{ backgroundImage: `url(https://images.unsplash.com/${doctor.image}?auto=format&fit=crop&w=900&q=85)` }} role="img" aria-label={doctor.name}/><span className="doctor-badge">CRM ativo</span><div className="doctor-info"><div><h3>{doctor.name}</h3><p>{doctor.title}</p></div><a href="#contato" aria-label={`Agendar com ${doctor.name}`}>↗</a></div></article>)}</div><p className="fiction-note">* Profissionais e registros apresentados como conteúdo demonstrativo fictício. Substitua por dados reais antes de publicar.</p></section>

      <section className="cta-band"><div className="cta-symbol">✳</div><div><div className="section-kicker">SEU PRÓXIMO PASSO</div><h2>Vamos cuidar de você?</h2><p>Estamos aqui para ajudar você a encontrar o melhor caminho.</p></div><a className="button button-light" href="#contato">Fale com nossa equipe <span>↗</span></a></section>

      <section className="section contact" id="contato"><div className="contact-info"><div className="section-kicker">04 / FALE COM A GENTE</div><h2>Estamos por<br/><em>aqui.</em></h2><p>Tem alguma dúvida ou quer saber mais? Nossa equipe está pronta para ajudar.</p><a className="contact-method" href={whatsappUrl} target="_blank" rel="noreferrer"><span className="method-icon">↗</span><span><small>WHATSAPP</small><b>{clinicWhatsAppDisplay}</b></span><span className="method-arrow">↗</span></a><a className="contact-method" href="mailto:oi@clinicavita.com.br"><span className="method-icon">@</span><span><small>E-MAIL</small><b>oi@clinicavita.com.br</b></span><span className="method-arrow">↗</span></a><div className="address"><span className="method-icon">⌖</span><span><small>ENDEREÇO</small><b>Av. Paulista, 1000 — Bela Vista</b><small>São Paulo — SP, 01310-100</small><a href={mapsUrl} target="_blank" rel="noreferrer">Como chegar ↗</a></span></div><div className="hours"><span>HORÁRIOS</span><b>Seg a Sex, 8h às 18h <i>•</i> Sáb, 8h às 12h</b></div></div>
        <form className="contact-form" onSubmit={handleSubmit} noValidate><div className="form-kicker">ENVIE UMA MENSAGEM</div><h3>Como podemos ajudar?</h3><p>Preencha os campos e nossa equipe entrará em contato.</p><label htmlFor="name">Seu nome</label><input id="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Como podemos chamar você?" autoComplete="name" required/><label htmlFor="email">Seu e-mail</label><input id="email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="voce@email.com" autoComplete="email" required/><label htmlFor="message">Sua mensagem</label><textarea id="message" rows={3} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Conte um pouco sobre o que precisa..." required/><button type="submit" className="button form-submit" disabled={sending}>{sending ? "Enviando…" : "Enviar mensagem"} <span>{sending ? "…" : "↗"}</span></button>{formError && <p className={submitted ? "form-feedback success" : "form-feedback"} role="status">{formError}</p>}<small className="form-privacy">Seus dados são enviados somente para responder à sua solicitação.</small></form>
      </section>
      <section className="map-section"><iframe title="Mapa da região da Clínica Vita" src="https://maps.google.com/maps?q=Av.%20Paulista%2C%201000%2C%20S%C3%A3o%20Paulo&t=&z=14&ie=UTF8&iwloc=&output=embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade"/><div className="map-card"><span>⌖</span><div><b>Clínica Vita</b><small>Av. Paulista, 1000 · São Paulo, SP</small></div><a href={mapsUrl} target="_blank" rel="noreferrer" aria-label="Abrir rota no Google Maps">↗</a></div></section>

      <footer className="footer"><div className="footer-main"><a className="brand brand-footer" href="#inicio"><span className="brand-mark">v</span><span>clínica<span className="brand-light">vita</span><small>SAÚDE COM PRESENÇA</small></span></a><p>Cuidado próximo, conhecimento<br/>e atenção em cada detalhe.</p><div className="footer-nav"><a href="#sobre">A clínica</a><a href="#especialidades">Especialidades</a><a href="#equipe">Profissionais</a><a href="#contato">Contato</a><a href="/paciente/login">Área do paciente</a></div><div className="footer-social"><a href="https://instagram.com" aria-label="Instagram" target="_blank" rel="noreferrer">ig ↗</a><a href="https://facebook.com" aria-label="Facebook" target="_blank" rel="noreferrer">fb ↗</a></div></div><div className="footer-bottom"><span>© {year} Clínica Vita · Conteúdo demonstrativo fictício.</span><span>Privacidade&nbsp;&nbsp;&nbsp; Acessibilidade</span><a href="#inicio">Voltar ao topo ↑</a></div></footer>
      <WhatsAppFloat />
    </main>
  );
}
