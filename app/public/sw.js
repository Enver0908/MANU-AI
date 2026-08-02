const STATIC_CACHE = "siriusai-static-v1";
const ASSET_CACHE = "siriusai-assets-v1";
const LEGACY_CACHE_PREFIX = "manu-ai-shell-";
const ALLOWED_CACHES = new Set([STATIC_CACHE, ASSET_CACHE]);

function classifyRequest(request) {
  const method = request.method.toUpperCase();
  if (method !== "GET") return "network_only";

  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname.startsWith("/api/")) return "network_only";
  if (request.mode === "navigate") return "network_only";

  if (
    pathname === "/" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/app-install" ||
    pathname.startsWith("/app-install/") ||
    pathname === "/login" ||
    pathname.startsWith("/login/")
  ) {
    return "network_only";
  }

  if (pathname.startsWith("/_next/static/")) return "cache_first_static";

  if (
    pathname === "/manifest.webmanifest" ||
    pathname === "/icon.svg" ||
    pathname.startsWith("/icons/")
  ) {
    return "stale_while_revalidate_asset";
  }

  return "network_only";
}

async function networkOnly(request) {
  return fetch(request);
}

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.status === 200 && response.type !== "opaque") {
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type !== "opaque") {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || networkPromise;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(ASSET_CACHE)
      .then((cache) => cache.addAll(["/manifest.webmanifest", "/icon.svg"]))
      // Do not skipWaiting here — waiting worker activates only after SKIP_WAITING.
      .then(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (ALLOWED_CACHES.has(key)) return undefined;
          if (key.startsWith(LEGACY_CACHE_PREFIX) || !ALLOWED_CACHES.has(key)) {
            return caches.delete(key);
          }
          return undefined;
        }),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const klass = classifyRequest(event.request);

  if (klass === "network_only") {
    event.respondWith(networkOnly(event.request));
    return;
  }

  if (klass === "cache_first_static") {
    event.respondWith(cacheFirst(STATIC_CACHE, event.request));
    return;
  }

  if (klass === "stale_while_revalidate_asset") {
    event.respondWith(staleWhileRevalidate(ASSET_CACHE, event.request));
  }
});
