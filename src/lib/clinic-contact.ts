const digitsOnly = (process.env.NEXT_PUBLIC_CLINIC_WHATSAPP ?? "5511999999999").replace(/\D/g, "");
const nationalNumber = digitsOnly.startsWith("55") ? digitsOnly.slice(2) : digitsOnly;

export function clinicWhatsAppUrl(message: string) {
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
}

export function professionalWhatsAppUrl(phone: string, message: string) {
  const phoneDigits = phone.replace(/\D/g, "");
  const internationalPhone = phoneDigits.startsWith("55") || phoneDigits.length > 11 ? phoneDigits : `55${phoneDigits}`;
  return `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`;
}

export const clinicWhatsAppDisplay = nationalNumber.length === 11
  ? `(${nationalNumber.slice(0, 2)}) ${nationalNumber.slice(2, 7)}-${nationalNumber.slice(7)}`
  : nationalNumber;
