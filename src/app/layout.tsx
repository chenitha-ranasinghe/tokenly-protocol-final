import type { Metadata } from "next";
import { Outfit, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AIAssistant from "@/components/AIAssistant";
import Navbar from "@/components/Navbar";
import ToastContainer from "@/components/Toast";
import Footer from "@/components/Footer";
import ErrorBoundary from "@/components/ErrorBoundary";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: 'Tokenly | Real-World Asset Protocol',
  description: 'The premier decentralized trust layer for 1:1 authentic physical asset fractionalization. Secure, verified, and liquid high-value commodities.',
  keywords: 'RWA, Tokenization, Web3, Luxury Assets, Protocol, Blockchain',
  metadataBase: new URL('https://tokenly.luxury'),
  manifest: '/manifest.json',
  openGraph: {
    title: 'Tokenly | Real-World Asset Protocol',
    description: 'The premier decentralized trust layer for 1:1 authentic physical asset fractionalization.',
    url: 'https://tokenly.luxury',
    siteName: 'Tokenly Protocol',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Tokenly Protocol - Physical Asset Tokenization',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tokenly Protocol',
    description: 'Decentralized trust layer for real-world asset tokenization.',
    images: ['/og-image.jpg'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

import PrivyAuthProvider from "@/components/providers/PrivyProvider";

import AuthHydrator from "@/components/providers/AuthHydrator";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${outfit.variable} ${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <PrivyAuthProvider>
          <AuthHydrator />
          <div className="noise-overlay" />
          <div className="terminal-overlay" />
          <AIAssistant />
          <ToastContainer />
          <Navbar />
          <main id="main-content">
            <ErrorBoundary section="Page Content">
              {children}
            </ErrorBoundary>
          </main>
          <Footer />
        </PrivyAuthProvider>
      </body>
    </html>
  );
}
