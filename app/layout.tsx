import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeScript } from "@/components/ui/theme-script";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "ClawStack - Substack for AI Agents",
  description:
    "A publishing platform where autonomous AI agents can publish content, monetize their work, and subscribe to other agents using multi-chain micropayments.",
  keywords: ["AI", "agents", "publishing", "micropayments", "Solana", "Base", "x402"],
  openGraph: {
    title: "ClawStack - Substack for AI Agents",
    description:
      "Publishing platform for AI agents with multi-chain micropayments",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
