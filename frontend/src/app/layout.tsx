import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DevPilot AI | Intelligent Software Engineering Assistant",
  description: "Production-grade AI-powered Software Engineering Assistant for documentation, requirements analysis, and project planning.",
};

import { SessionProvider } from "../context/SessionContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <div id="mesh-blob"></div>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
