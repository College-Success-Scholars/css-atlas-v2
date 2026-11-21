/**
 * @file layout.tsx
 * @module frontend/app
 *
 * Root Next.js layout — wraps the entire application.
 * Registers global fonts (Geist, Geist_Mono), theme provider, toaster,
 * and the InviteFromHashRedirect handler for magic-link email invites.
 *
 * ## What belongs here
 * - App-wide providers, fonts, and metadata
 * - Components that must wrap every page (Toaster)
 *
 * ## What does NOT belong here
 * - Page-specific layout (use route-specific layout.tsx files)
 * - Auth guards (those go in each protected page)
 */
import type { Metadata } from "next";
import { InviteFromHashRedirect } from "@/components/auth/invite-from-hash-redirect";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { ThemedToaster } from "@/components/layout/themed-toaster";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Railway sets RAILWAY_PUBLIC_DOMAIN on services with a public domain.
const defaultUrl = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : "http://localhost:3000";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "CSS Atlas",
  description: "View your engagement metrics and stats in one place",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <InviteFromHashRedirect />
          {children}
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
