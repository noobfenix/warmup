import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";

import "../index.css";
import Header from "@/components/header";
import Providers from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Civic Air Quality Briefing Studio | CPCB NAQI Grounded",
  description:
    "Transform ambient air quality telemetry into verifiable, audience-targeted civic briefings with strict Fact ID grounding.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}>
        <Providers>
          <div className="grid grid-rows-[auto_1fr] min-h-screen">
            <Header />
            {children}
          </div>
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
