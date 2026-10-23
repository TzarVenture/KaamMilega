import type { Metadata } from "next";
import localFont from "next/font/local";
import { NotificationProvider } from "@/lib/notifications";
import AppToaster from "@/components/km/AppToaster";
import { FEATURES } from "@/config/features";
import { THEME_INIT_SCRIPT } from "@/lib/themeScript";
import "./globals.css";

// Fonts are self-hosted from ./fonts (SIL OFL, see the OFL-*.txt files there). next/font/google
// downloads them during the build, and Google sometimes answers build servers with
// /l/font?kit=...&skey=... URLs that Turbopack can't resolve, which failed the production build.
const poppins = localFont({
  src: [
    { path: "./fonts/poppins-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/poppins-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

const notoSansDevanagari = localFont({
  src: "./fonts/noto-sans-devanagari-devanagari-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-devanagari",
  display: "swap",
  // Only Hindi text uses this face, so it isn't preloaded on every page
  preload: false,
  fallback: ["Nirmala UI", "Mangal", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://kaammilega.com'),
  title: "KaamMilega™ — Har Kaam, Har Mauka",
  description: "Find jobs, instant gigs, skills training, expert mentorship, P2P services, and local events across India. India's #1 direct candidate-to-recruiter hiring portal.",
  keywords: ["jobs in India", "blue collar jobs", "white collar jobs", "instant hire", "skill development", "KaamMilega", "recruiter platform"],
  authors: [{ name: "KaamMilega Team" }],
  openGraph: {
    title: "KaamMilega™ — Har Kaam, Har Mauka",
    description: "Direct candidate-to-recruiter hiring with 1-click apply, verified profiles, instant gigs, and skill development.",
    url: "https://kaammilega.com",
    siteName: "KaamMilega",
    images: [
      {
        url: "/kaammilega-logo-text.png",
        width: 1200,
        height: 630,
        alt: "KaamMilega Logo",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/kaammilega-logo-icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/kaammilega-logo-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${poppins.variable} ${inter.variable} ${notoSansDevanagari.variable}`}>
      {/* Applies the saved theme before first paint so there is no light/dark flash */}
      {FEATURES.DARK_MODE && (
        <head>
          <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        </head>
      )}
      <body className="font-poppins antialiased bg-km-surface text-km-text-primary">
        <NotificationProvider>
          {children}
        </NotificationProvider>
        <AppToaster />
      </body>
    </html>
  );
}
