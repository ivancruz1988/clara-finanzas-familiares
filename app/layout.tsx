import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clara — Finanzas familiares",
  description: "Presupuesto, gastos, cuentas y pagos en un solo lugar"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
