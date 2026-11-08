import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  message: z.string().trim().min(5).max(3000),
  website: z.string().max(0).optional(),
});

const recentSubmissions = new Map<string, number>();

function getClientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;
  const fromEmail = process.env.CONTACT_FROM_EMAIL;

  if (!apiKey || !toEmail || !fromEmail) {
    return NextResponse.json(
      { error: "O envio de e-mail ainda não está configurado. Tente novamente mais tarde ou fale conosco pelo WhatsApp." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Não foi possível ler o formulário." }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Confira seu nome, e-mail e mensagem antes de enviar." }, { status: 400 });
  }

  if (parsed.data.website) {
    return NextResponse.json({ ok: true });
  }

  const now = Date.now();
  const clientKey = getClientKey(request);
  const lastSubmission = recentSubmissions.get(clientKey);
  if (lastSubmission && now - lastSubmission < 30_000) {
    return NextResponse.json({ error: "Aguarde um pouco antes de enviar outra mensagem." }, { status: 429 });
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: [toEmail],
    replyTo: parsed.data.email,
    subject: `Contato pelo site da Clínica Vita Estética — ${parsed.data.name}`,
    text: `Nome: ${parsed.data.name}\nE-mail: ${parsed.data.email}\n\nMensagem:\n${parsed.data.message}`,
  });

  if (error) {
    console.error("Resend contact email error:", error.name, error.message);
    if (/only send testing emails to your own email address/i.test(error.message)) {
      return NextResponse.json(
        { error: "A Resend está em modo de teste e só permite enviar para o e-mail da sua conta. Use esse endereço em CONTACT_TO_EMAIL ou valide um domínio na Resend para enviar para outros destinatários." },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: "Não foi possível enviar sua mensagem agora. Tente novamente mais tarde." }, { status: 502 });
  }

  recentSubmissions.set(clientKey, now);
  return NextResponse.json({ ok: true });
}
