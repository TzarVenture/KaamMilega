import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL('https://kaammilega.com'),
  title: "KaamMilega™ — Kaam Bhi. Skill Bhi. Kamaai Bhi.",
  description: "Find jobs, instant gigs, skills training, expert mentorship, P2P services, and local events across India. India's #1 direct candidate-to-recruiter hiring portal.",
  keywords: ["jobs in India", "blue collar jobs", "white collar jobs", "instant hire", "skill development", "KaamMilega", "recruiter platform"],
  authors: [{ name: "KaamMilega Team" }],
  openGraph: {
    title: "KaamMilega™ — Kaam Bhi. Skill Bhi. Kamaai Bhi.",
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
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased bg-[#F8FAFC]">
        {children}
      </body>
    </html>
  );
}
