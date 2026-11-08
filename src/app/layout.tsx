import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clínica Vita Estética | Cuidado e bem-estar",
  description: "Um espaço de estética e bem-estar com escuta, avaliação individual e orientação profissional.",
  openGraph: {
    title: "Clínica Vita Estética | Cuidado e bem-estar",
    description: "Conheça os cuidados estéticos, a equipe e as opções de atendimento da Clínica Vita Estética.",
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
