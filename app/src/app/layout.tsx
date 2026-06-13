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

const devServiceWorkerCleanupScript =
  process.env.NODE_ENV === "development"
    ? `if("serviceWorker"in navigator){navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(x){x.unregister()})});}if("caches"in window){caches.keys().then(function(k){k.forEach(function(n){caches.delete(n)})});}`
    : null;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        {devServiceWorkerCleanupScript ? (
          <script dangerouslySetInnerHTML={{ __html: devServiceWorkerCleanupScript }} />
        ) : null}
        <PwaRuntime />
        {children}
      </body>
    </html>
  );
}
