import type { Metadata, Viewport } from "next";
import { PwaRuntime } from "@/components/pwa-runtime";
import { resolveClientCompatibilityVersion } from "@/lib/release-identity";
import "./globals.css";

const appVersion = resolveClientCompatibilityVersion();

export const metadata: Metadata = {
  metadataBase: new URL("https://aiyaworkspace.com"),
  title: "SiriusAI",
  description: "SiriusAI supervised dietitian messaging assistant",
  applicationName: "SiriusAI",
  alternates: {
    canonical: "/",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SiriusAI",
  },
  manifest: "/manifest.webmanifest",
  other: {
    "siriusai-app-version": appVersion,
  },
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
    <html lang="tr" className="h-full antialiased">
      <head>
        <meta name="siriusai-app-version" content={appVersion} />
      </head>
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
