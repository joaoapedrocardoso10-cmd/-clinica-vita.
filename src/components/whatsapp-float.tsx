import { clinicWhatsAppUrl } from "@/lib/clinic-contact";

type WhatsAppFloatProps = {
  message?: string;
};

export default function WhatsAppFloat({
  message = "Olá! Gostaria de falar com a equipe da Clínica Vita.",
}: WhatsAppFloatProps) {
  return (
    <a
      className="whatsapp-float"
      href={clinicWhatsAppUrl(message)}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar com a clínica pelo WhatsApp"
    >
      <span className="whatsapp-float-icon" aria-hidden="true">
        <svg viewBox="0 0 32 32" focusable="false">
          <path d="M16.02 3.2a12.63 12.63 0 0 0-10.8 19.18L3.5 28.8l6.57-1.72A12.65 12.65 0 1 0 16.02 3.2Zm0 22.98c-1.94 0-3.84-.52-5.5-1.5l-.4-.24-3.9 1.02 1.04-3.8-.26-.4a10.25 10.25 0 1 1 9.02 4.92Zm5.63-7.68c-.31-.16-1.83-.9-2.11-1-.28-.1-.49-.16-.7.16-.2.31-.8 1-.98 1.2-.18.21-.36.24-.67.08-.31-.15-1.3-.48-2.48-1.53-.92-.82-1.54-1.83-1.72-2.14-.18-.31-.02-.48.14-.64.14-.14.31-.36.46-.54.15-.18.2-.3.31-.52.1-.2.05-.39-.03-.54-.08-.16-.7-1.68-.96-2.3-.25-.6-.51-.52-.7-.53h-.6c-.2 0-.54.08-.82.39-.28.31-1.08 1.05-1.08 2.57s1.1 2.98 1.25 3.19c.15.2 2.17 3.31 5.25 4.64.73.31 1.3.5 1.75.64.74.23 1.41.2 1.94.12.6-.09 1.83-.75 2.09-1.48.26-.72.26-1.34.18-1.47-.08-.13-.28-.2-.59-.36Z" />
        </svg>
      </span>
      <span className="whatsapp-float-label">Fale com a clínica</span>
    </a>
  );
}
