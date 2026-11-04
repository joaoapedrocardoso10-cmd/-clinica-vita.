import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clínica Vita | Saúde com presença",
  description: "Um cuidado completo, próximo e humano. Conheça a Clínica Vita e fale com nossa equipe.",
  openGraph: {
    title: "Clínica Vita | Saúde com presença",
    description: "Uma clínica completa, com profissionais que escutam, acolhem e acompanham você.",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
