import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
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

const frauncesDisplay = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  title: "SiriusAI",
  description: "SiriusAI supervised dietitian messaging assistant",
  applicationName: "SiriusAI",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SiriusAI",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} ${frauncesDisplay.variable} h-full antialiased`}
    >
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
