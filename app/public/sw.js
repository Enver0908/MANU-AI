const CACHE_NAME = "manu-ai-shell-v2";
const SHELL_PATHS = ["/", "/dashboard", "/app-install"];
const STATIC_PREFIXES = ["/_next/static/", "/icon.svg", "/manifest.webmanifest"];

function shouldCachePath(pathname) {
  if (!pathname || pathname.startsWith("/api/")) {
    return false;
  }
  if (SHELL_PATHS.includes(pathname)) {
    return true;
  }
  return STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(["/manifest.webmanifest", "/icon.svg"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  if (!shouldCachePath(url.pathname)) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === "opaque") {
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    }),
  );
});
