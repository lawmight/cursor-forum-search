import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const canela = localFont({
  src: "../public/fonts/Canela-Regular-Trial.otf",
  variable: "--font-canela",
  display: "swap",
});

const siteUrl = "https://cursor-forum.trynia.ai";
const title = "Cursor Forum & Docs Search – AI-Powered Knowledge Base";
const description =
  "Search the Cursor community forum with AI. Find feature discussions, troubleshooting threads, tips, and community knowledge instantly. Powered by Nia.";

export const metadata: Metadata = {
  title: {
    default: title,
    template: "%s | Cursor Forum & Docs Search",
  },
  description,
  keywords: [
    "Cursor",
    "Cursor IDE",
    "Cursor forum",
    "Cursor community",
    "AI code editor",
    "Cursor tips",
    "Cursor troubleshooting",
    "Cursor features",
    "AI search",
    "forum search",
    "Nia",
  ],
  authors: [{ name: "Nozomio Labs", url: "https://github.com/nozomio-labs" }],
  creator: "Nozomio Labs",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "Cursor Forum & Docs Search",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    creator: "@trynia_ai",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/cursor.png", type: "image/png", sizes: "32x32" },
    ],
    apple: "/cursor.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${canela.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
