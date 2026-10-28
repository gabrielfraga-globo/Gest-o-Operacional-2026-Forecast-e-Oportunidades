import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "../styles/tokens.css";
import "./globals.css";
import { AlternadorTema } from "@/components/alternador-tema";
import { NavPilula } from "@/components/nav-pilula";
import { obterUsuarioAtual } from "@/server/sessao";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Forecast Opex 2026",
  description: "Acompanhamento do Opex 2026: orçamento, realizado e saldo.",
};

// Aplica o tema salvo antes da primeira pintura; padrão escuro.
const scriptTema = `(function(){try{document.documentElement.dataset.theme=localStorage.getItem('tema')==='light'?'light':'dark';}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const usuario = await obterUsuarioAtual();

  return (
    <html lang="pt-BR" className={plusJakarta.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body>
        {usuario && <NavPilula nome={usuario.nome} />}
        <main className="conteudo">{children}</main>
        <AlternadorTema />
      </body>
    </html>
  );
}
