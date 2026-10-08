import type { Metadata } from "next";
import { Inter, Cairo } from "next/font/google";
import "./app.css";
import Navbar from "./components/layout/Navbar/Navbar";
import TitleBar from "./components/layout/TitleBar/TitleBar";
import { AuthProvider } from "./lib/auth";
import { DownloadProvider } from "./lib/DownloadContext";
import AntiResize from "./components/layout/AntiResize";
import ThemeManager from "./components/layout/ThemeManager";
import LanguageManager from "./components/layout/LanguageManager";
// Client wrapper handles the dynamic import with ssr:false (not allowed in Server Components)
import ParticlesWrapper from "./components/layout/ParticlesWrapper";
import SuspendedBlock from "./components/layout/SuspendedBlock";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: "OB Store",
  description: "FiveM Mods and Resources",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${cairo.variable}`}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased">
        <ThemeManager />
        <AntiResize />
        <ParticlesWrapper />
        <AuthProvider>
          <LanguageManager />
          <DownloadProvider>
            <SuspendedBlock />
            <TitleBar />
            <Navbar />
            <main className="relative flex-grow">
              {children}
            </main>
          </DownloadProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
