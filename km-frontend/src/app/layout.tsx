import type { Metadata } from "next";
import { Poppins, Inter, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-devanagari",
  display: "swap",
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
      <body className="font-poppins antialiased bg-[#F4F7FB] text-[#111827]">
        {children}
      </body>
    </html>
  );
}
