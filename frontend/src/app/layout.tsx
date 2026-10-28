import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SecOps Manager | Centro de operações",
  description:
    "Gestão de atividades de segurança, infraestrutura e governança.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body>{children}</body>
    </html>
  );
}
