"use client";

import { useEffect, useState } from "react";

const services = [
  { name: "Cuidados faciais", detail: "Opções para a pele escolhidas após uma conversa e avaliação individual.", image: "photo-1570172619644-dfd03ed5d881", label: "01 / ROSTO", size: "care-card-featured" },
  { name: "Cuidados corporais", detail: "Conheça alternativas de cuidado corporal com orientação profissional.", image: "photo-1616394584738-fc6e612e71b9", label: "02 / CORPO", size: "" },
  { name: "Tecnologias estéticas", detail: "Recursos apresentados com clareza e indicados caso a caso.", image: "photo-1515377905703-c4788e51af15", label: "03 / TECNOLOGIA", size: "" },
  { name: "Rituais de bem-estar", detail: "Um momento para desacelerar e reservar um tempo para você.", image: "photo-1600334129128-685c5582fd35", label: "04 / BEM-ESTAR", size: "care-card-wide" },
];

const professionals = [
  { name: "Profissional de estética", area: "Avaliação e cuidados faciais", image: "photo-1559839734-2b71ea197ec2" },
  { name: "Especialista em bem-estar", area: "Cuidados corporais", image: "photo-1594824476967-48c8b964273f" },
  { name: "Profissional responsável", area: "Tecnologias estéticas", image: "photo-1612349317150-e413f6a5b16d" },
];

const faqs = [
  { q: "Como descubro qual cuidado combina comigo?", a: "Converse com a equipe e agende uma avaliação. Um profissional habilitado poderá entender suas necessidades, explicar as opções e orientar você sem pressa." },
  { q: "Preciso agendar uma avaliação antes?", a: "A avaliação individual é recomendada para conhecer as alternativas e receber orientações adequadas antes de decidir por qualquer cuidado." },
  { q: "Posso tirar dúvidas pelo WhatsApp?", a: "Sim. Use o botão de WhatsApp nesta página para conversar com a clínica. A equipe poderá orientar você sobre informações gerais e atendimento." },
  { q: "Como funcionam valores e pagamentos?", a: "Valores, formas de pagamento e disponibilidade são informados diretamente pela clínica, depois que você explicar o que procura." },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const whatsappNumber = (process.env.NEXT_PUBLIC_CLINIC_WHATSAPP ?? "").replace(/\D/g, "");
  const whatsappUrl = whatsappNumber ? "https://wa.me/" + whatsappNumber + "?text=" + encodeURIComponent("Olá! Gostaria de tirar uma dúvida sobre a clínica estética.") : "#contato";
  const clinicEmail = process.env.NEXT_PUBLIC_CLINIC_EMAIL?.trim() ?? "";
  const mapsQuery = process.env.NEXT_PUBLIC_CLINIC_MAPS_QUERY?.trim() ?? "";
  const mapsUrl = mapsQuery ? "https://maps.google.com/?q=" + encodeURIComponent(mapsQuery) : "#localizacao";

  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -32px 0px" });
    targets.forEach((target, index) => {
      target.style.setProperty("--reveal-delay", (index % 4) * 80 + "ms");
      target.classList.add("will-reveal");
      observer.observe(target);
    });
    return () => observer.disconnect();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSubmitted(false);
    if (sending) return;
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setFormError("Preencha seu nome, e-mail e mensagem para continuar.");
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
        setFormError(result.error ?? "Não foi possível enviar sua mensagem agora. Tente novamente mais tarde.");
        return;
      }
      setSubmitted(true);
      setFormError("Mensagem enviada. A equipe recebeu seu contato e responderá pelo e-mail informado.");
      setForm({ name: "", email: "", message: "" });
    } catch {
      setFormError("Não foi possível conectar ao serviço de envio. Tente novamente mais tarde.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main>
      <div className="topline"><span><i aria-hidden="true" /> CUIDADO ESTÉTICO COM ESCUTA E ORIENTAÇÃO</span><a href="#duvidas">Tem dúvidas? A gente pode ajudar <span aria-hidden="true">↗</span></a></div>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Clínica Vita Estética, início"><span className="brand-mark">V</span><span className="brand-type">CLÍNICA VITA<small>ESTÉTICA &amp; BEM-ESTAR</small></span></a>
        <button className="menu-toggle" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? "×" : "☰"}</button>
        <nav className={menuOpen ? "main-nav nav-open" : "main-nav"} aria-label="Navegação principal">
          <a href="#sobre" onClick={() => setMenuOpen(false)}>A clínica</a><a href="#cuidados" onClick={() => setMenuOpen(false)}>Cuidados</a><a href="#equipe" onClick={() => setMenuOpen(false)}>Profissionais</a><a href="#duvidas" onClick={() => setMenuOpen(false)}>Dúvidas</a><a className="nav-cta" href="#contato" onClick={() => setMenuOpen(false)}>Fale com a clínica <span>↗</span></a>
        </nav>
      </header>

      <section className="hero-scene" id="inicio">
        <div className="hero-backdrop" role="img" aria-label="Atendimento facial em um espaço de estética" />
        <div className="hero-vignette" />
        <div className="hero-content"><div className="eyebrow eyebrow-light" data-reveal><span /> UM NOVO JEITO DE CUIDAR DE VOCÊ</div><h1 data-reveal>Seu cuidado.<br /><em>Seu tempo.</em></h1><p data-reveal>Um espaço para se sentir bem, conhecer suas opções e escolher com tranquilidade.</p><div className="hero-actions" data-reveal><a className="button button-pink" href="#contato">Agende sua avaliação <span>↗</span></a><a className="hero-link" href="#cuidados">Conheça nossos cuidados <span>↓</span></a></div><div className="hero-assurance" data-reveal><span className="assurance-star">✳</span><span><b>Primeiro, uma conversa.</b><small>Orientação individual e sem pressa.</small></span></div></div>
        <div className="hero-note-card" data-reveal><span className="note-icon">✦</span><div><small>CLÍNICA VITA ESTÉTICA</small><b>Um momento só seu</b><span>Escuta · cuidado · bem-estar</span></div></div>
        <a className="scroll-cue" href="#sobre" aria-label="Rolar para conhecer a clínica"><span>DESCUBRA</span><i>↓</i></a>
      </section>

      <div className="service-ribbon" aria-label="Áreas de cuidado"><span>ROSTO</span><i>✳</i><span>CORPO</span><i>✳</i><span>BEM-ESTAR</span><i>✳</i><span>TECNOLOGIA</span><i>✳</i><span>VOCÊ</span></div>

      <section className="intro-section section-shell" id="sobre">
        <div className="intro-copy" data-reveal><div className="eyebrow"><span /> CONHEÇA A CLÍNICA</div><h2>O melhor cuidado<br />começa em <em>você.</em></h2><p className="intro-lead">Cada pessoa tem uma história, um ritmo e uma ideia própria de bem-estar.</p><p>Por isso, a gente começa ouvindo. Nossa equipe conversa com você, apresenta possibilidades e explica os próximos passos com clareza. Sem pressa e sem prometer resultados iguais para todo mundo.</p><a className="underlined-link" href="#equipe">Conheça quem cuida de você <span>↗</span></a></div>
        <div className="intro-picture" role="img" aria-label="Ambiente sereno para cuidado e bem-estar" data-reveal><span className="picture-label">UM ESPAÇO FEITO PARA PAUSAR</span><span className="picture-number">01</span></div>
        <div className="intro-seal" aria-hidden="true"><span>V</span><small>VITA<br />ESTÉTICA</small></div>
      </section>

      <section className="care-section section-shell" id="cuidados">
        <div className="section-topline"><div data-reveal><div className="eyebrow"><span /> POSSIBILIDADES DE CUIDADO</div><h2>Encontre o que<br /><em>faz sentido para você.</em></h2></div><div className="section-side-copy" data-reveal><p>Veja algumas áreas de atendimento. A indicação adequada depende de conversa e avaliação individual com profissional habilitado.</p><a className="underlined-link" href="#contato">Peça ajuda para escolher <span>↗</span></a></div></div>
        <div className="care-grid">{services.map((item, index) => <a href="#contato" className={"care-card " + item.size} key={item.name} data-reveal><div className="care-photo" style={{ backgroundImage: "url(https://images.unsplash.com/" + item.image + "?auto=format&fit=crop&w=1100&q=85)" }} role="img" aria-label={"Imagem ilustrativa: " + item.name}><span className="care-label">{item.label}</span><span className="care-open">↗</span></div><div className="care-caption"><span className="care-index">0{index + 1}</span><div><h3>{item.name}</h3><p>{item.detail}</p></div></div></a>)}</div>
        <p className="care-disclaimer" data-reveal><span>i</span> Cada indicação, procedimento e resultado deve ser avaliado individualmente por profissional qualificado.</p>
      </section>

      <section className="care-quote">
        <div className="quote-image" role="img" aria-label="Detalhe de um atendimento de estética cuidadoso" />
        <div className="quote-content" data-reveal><span className="quote-mark">“</span><p>Você não precisa ter todas as respostas antes de chegar.</p><em>A conversa pode ser o começo.</em><a className="light-link" href="#duvidas">Veja como podemos ajudar <span>↗</span></a></div>
      </section>

      <section className="journey-section section-shell">
        <div className="journey-heading" data-reveal><div className="eyebrow"><span /> UMA EXPERIÊNCIA SEM COMPLICAÇÃO</div><h2>Do primeiro contato<br />ao próximo passo.</h2><p>Você decide com informação e no seu próprio tempo.</p></div>
        <div className="journey-steps"><article data-reveal><span className="step-no">01</span><span className="step-symbol">✳</span><h3>Conte o que procura</h3><p>Fale sobre suas dúvidas, preferências e o que gostaria de entender.</p></article><article data-reveal><span className="step-no">02</span><span className="step-symbol">◌</span><h3>Converse com a equipe</h3><p>Receba orientação e conheça as opções disponíveis para avaliação.</p></article><article data-reveal><span className="step-no">03</span><span className="step-symbol">↗</span><h3>Escolha com tranquilidade</h3><p>Entenda os próximos passos e decida quando se sentir pronta.</p></article></div>
      </section>

      <section className="team-section section-shell" id="equipe">
        <div className="team-heading" data-reveal><div><div className="eyebrow"><span /> QUEM VAI CUIDAR DE VOCÊ</div><h2>Gente que cuida<br /><em>com presença.</em></h2></div><div><p>Conheça os profissionais, tire suas dúvidas e entenda as opções com quem pode orientar você.</p><a className="underlined-link" href="#contato">Fale com a clínica <span>↗</span></a></div></div>
        <div className="team-grid">{professionals.map((person, index) => <article className="person-card" key={person.name} data-reveal><div className={"person-image person-image-" + index} style={{ backgroundImage: "url(https://images.unsplash.com/" + person.image + "?auto=format&fit=crop&w=1000&q=85)" }} role="img" aria-label="Foto ilustrativa de profissional" /><div className="person-details"><span>PERFIL ILUSTRATIVO</span><h3>{person.name}</h3><p>{person.area}</p><a href="#contato" aria-label={"Conversar com a clínica sobre " + person.area}>Saiba mais <b>↗</b></a></div></article>)}</div>
        <p className="demo-note">Os nomes, perfis e fotografias são ilustrativos. Personalize com informações verdadeiras e autorizadas antes de usar para uma clínica.</p>
      </section>

      <section className="faq-section section-shell" id="duvidas">
        <div className="faq-intro" data-reveal><div className="eyebrow"><span /> DÚVIDAS? A GENTE PODE AJUDAR</div><h2>Informação clara<br /><em>faz bem.</em></h2><p>Quer entender como funciona, conversar antes de agendar ou perguntar sobre atendimento? Veja respostas rápidas ou chame a clínica.</p><a className="button button-plum" href="#contato">Ainda tenho uma dúvida <span>↗</span></a></div>
        <div className="faq-list">{faqs.map((item, index) => <details key={item.q} data-reveal><summary><span className="faq-number">0{index + 1}</span><span>{item.q}</span><b>+</b></summary><p>{item.a}</p></details>)}</div>
      </section>

      <section className="contact-section" id="contato">
        <div className="contact-backdrop" aria-hidden="true" />
        <div className="contact-copy" data-reveal><div className="eyebrow eyebrow-light"><span /> VAMOS CONVERSAR?</div><h2>Seu próximo passo<br /><em>começa com uma conversa.</em></h2><p>Conte o que você procura. A equipe da Clínica Vita Estética pode ajudar com informações sobre cuidados, horários e atendimento.</p><div className="contact-promise"><span>✳</span><b>Sem pressa, sem compromisso.<small>Você escolhe como prefere conversar.</small></b></div></div>
        <div className="contact-card" data-reveal><div className="form-kicker">FALE COM A CLÍNICA</div><h3>Como podemos ajudar?</h3><p>Envie uma mensagem e a equipe responderá pelo e-mail informado.</p><form className="contact-form" onSubmit={handleSubmit} noValidate><label htmlFor="name">Seu nome</label><input id="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Como podemos chamar você?" autoComplete="name" required /><label htmlFor="email">Seu e-mail</label><input id="email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="voce@email.com" autoComplete="email" required /><label htmlFor="message">Sua mensagem</label><textarea id="message" rows={3} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Escreva sua dúvida ou solicitação..." required /><button type="submit" className="button button-plum form-submit" disabled={sending}>{sending ? "Enviando…" : "Enviar mensagem"}<span>{sending ? "…" : "↗"}</span></button>{formError && <p className={submitted ? "form-feedback success" : "form-feedback"} role="status">{formError}</p>}<small className="form-privacy">Não inclua informações de saúde pessoais neste formulário.</small></form><div className="contact-divider"><span>OU FALE DIRETAMENTE</span></div><a className="whatsapp-cta" href={whatsappUrl} target={whatsappNumber ? "_blank" : undefined} rel={whatsappNumber ? "noreferrer" : undefined}><span className="whatsapp-icon">◉</span><span><small>RESPOSTA DIRETO COM A CLÍNICA</small><b>{whatsappNumber ? "Conversar pelo WhatsApp" : "WhatsApp — número a configurar"}</b></span><span className="whatsapp-arrow">↗</span></a>{!whatsappNumber && <p className="config-note">Para ativar, configure o número da clínica no site.</p>}</div>
      </section>

      <section className="location-section" id="localizacao"><div className="location-heading"><div className="eyebrow"><span /> COMO CHEGAR</div><h2>Seu momento começa<br /><em>na chegada.</em></h2><p>Veja a localização e planeje sua visita com tranquilidade.</p></div><div className="map-frame">{mapsQuery ? <iframe title="Mapa da Clínica Vita Estética" src={"https://maps.google.com/maps?q=" + encodeURIComponent(mapsQuery) + "&z=14&output=embed"} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : <div className="map-placeholder"><span>⌖</span><b>Localização da clínica</b><small>O endereço será exibido aqui após a personalização do modelo.</small></div>}<div className="location-card"><span className="location-pin">⌖</span><div><small>VISITE A CLÍNICA</small><b>{mapsQuery || "Endereço a configurar para a clínica"}</b>{mapsQuery && <a href={mapsUrl} target="_blank" rel="noreferrer">Abrir no Google Maps ↗</a>}</div></div></div></section>

      <footer className="site-footer"><div className="footer-top"><div className="footer-brand"><a className="brand brand-footer" href="#inicio"><span className="brand-mark">V</span><span className="brand-type">CLÍNICA VITA<small>ESTÉTICA &amp; BEM-ESTAR</small></span></a><p>Cuidado que começa com escuta<br />e continua no seu tempo.</p></div><div className="footer-links"><small>EXPLORE</small><a href="#sobre">A clínica</a><a href="#cuidados">Cuidados</a><a href="#equipe">Profissionais</a><a href="#duvidas">Dúvidas frequentes</a></div><div className="footer-contact"><small>FALE COM A GENTE</small><a className="footer-contact-item" href={whatsappUrl} target={whatsappNumber ? "_blank" : undefined} rel={whatsappNumber ? "noreferrer" : undefined}><span>◉</span><div><b>WhatsApp</b><em>{whatsappNumber ? "Conversar com a clínica ↗" : "Número a configurar"}</em></div></a><a className="footer-contact-item" href={clinicEmail ? "mailto:" + clinicEmail : "#contato"}><span>@</span><div><b>E-mail</b><em>{clinicEmail || "Endereço a configurar"}</em></div></a><a className="footer-contact-item" href={mapsQuery ? mapsUrl : "#localizacao"}><span>⌖</span><div><b>Localização</b><em>{mapsQuery || "Endereço a configurar"}</em></div></a></div><a className="back-top" href="#inicio">Voltar ao topo <span>↑</span></a></div><div className="footer-bottom"><span>Clínica Vita Estética · modelo demonstrativo</span><span>Conteúdo e contatos precisam ser revisados antes de publicar.</span><a href="#contato">Entre em contato ↗</a></div></footer>
      <a className="floating-whatsapp" href={whatsappUrl} target={whatsappNumber ? "_blank" : undefined} rel={whatsappNumber ? "noreferrer" : undefined} aria-label={whatsappNumber ? "Fale com a clínica pelo WhatsApp" : "Configure o WhatsApp da clínica"}><span>◉</span><b>WhatsApp</b></a>
    </main>
  );
}
