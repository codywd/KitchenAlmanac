const CACHE_VERSION = "v1";
const STATIC_CACHE = `kitchen-almanac-static-${CACHE_VERSION}`;
const SHOPPING_CACHE = `kitchen-almanac-shopping-${CACHE_VERSION}`;
const STATIC_ASSETS = [
  "/offline.html",
  "/icons/kitchen-almanac-icon.svg",
  "/icons/kitchen-almanac-maskable.svg",
  "/brand/kitchen-almanac-still-life.svg",
];

function isShoppingPage(pathname) {
  return /^\/weeks\/[^/]+\/shopping\/?$/.test(pathname);
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname === "/favicon.ico" ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName.startsWith("kitchen-almanac-") &&
                ![STATIC_CACHE, SHOPPING_CACHE].includes(cacheName),
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request));
  }
});

async function handleNavigation(request, url) {
  try {
    const response = await fetch(request);

    if (response.ok && isShoppingPage(url.pathname)) {
      const cache = await caches.open(SHOPPING_CACHE);

      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cachedShoppingPage = await caches.match(request);

    if (cachedShoppingPage) {
      return cachedShoppingPage;
    }

    const offlineFallback = await caches.match("/offline.html");

    return (
      offlineFallback ??
      new Response("KitchenAlmanac is offline.", {
        headers: { "content-type": "text/plain; charset=utf-8" },
        status: 503,
      })
    );
  }
}

async function handleStaticAsset(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);

    await cache.put(request, response.clone());
  }

  return response;
}
