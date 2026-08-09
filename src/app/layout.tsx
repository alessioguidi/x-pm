import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import PWARegistration from "@/components/PWAProvider";
import { FormatProvider } from "@/components/FormatProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Property Manager",
  description: "Gestione proprietà immobiliari — prenotazioni, check-in, check-out e rendicontazione",
  manifest: "/manifest.json",
  themeColor: "#2563eb",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PMS"
  },
  icons: {
    icon: { url: "/icons/icon.svg", type: "image/svg+xml" },
    apple: "/icons/icon.svg"
  },
  openGraph: {
    title: "Property Manager",
    description: "Gestione proprietà immobiliari — prenotazioni, check-in, check-out e rendicontazione",
    type: "website",
    siteName: "Property Manager",
    images: [{ url: "/og.png", width: 1200, height: 630 }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Property Manager",
    description: "Gestione proprietà immobiliari — prenotazioni, check-in, check-out e rendicontazione",
    images: ["/og.png"]
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <Toaster position="bottom-right" reverseOrder={false} />
        <PWARegistration />
        <FormatProvider>{children}</FormatProvider>
      </body>
    </html>
  );
}
