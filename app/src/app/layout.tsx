import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRuntime } from "@/components/pwa-runtime";
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
  title: "MANU-AI",
  description: "Local MANU-AI dietitian operations prototype",
  applicationName: "MANU-AI",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MANU-AI",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <PwaRuntime />
        {children}
      </body>
    </html>
  );
}
