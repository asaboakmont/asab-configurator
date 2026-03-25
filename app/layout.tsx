import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kitchen Configurator | ASAB Design",
  description: "Design your perfect kitchen with ASAB Design's 3D configurator",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      <body className="min-h-screen bg-asab-cream">{children}</body>
    </html>
  );
}
