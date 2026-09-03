// Firebase Cloud Messaging service worker
// Handles background push notifications when the app is not in focus.
// Uses the Firebase compat SDK because service workers cannot use ES module imports.
// The version should broadly match the firebase npm package installed in the app.
const APP_SHELL_CACHE = "rgc-app-shell-v1";
const STATIC_ASSET_CACHE = "rgc-static-v1";
const APP_SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/apple-touch-icon.png",
  "/pwa-192.png",
  "/pwa-512.png",
  "/rgc_fav.png",
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isCacheableAssetRequest(request) {
  return ["font", "image", "manifest", "script", "style"].includes(
    request.destination,
  );
}

async function handleNavigationRequest(request) {
  const cache = await caches.open(APP_SHELL_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put("/", response.clone());
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    const appShell = await cache.match("/");
    if (appShell) return appShell;

    return Response.error();
  }
}

async function handleStaticAssetRequest(request) {
  const cache = await caches.open(STATIC_ASSET_CACHE);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) return cachedResponse;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) =>
        cache.addAll(
          APP_SHELL_URLS.map((url) => new Request(url, { cache: "reload" })),
        ),
      )
      .catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter(
            (key) => key !== APP_SHELL_CACHE && key !== STATIC_ASSET_CACHE,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (isCacheableAssetRequest(request)) {
    event.respondWith(handleStaticAssetRequest(request));
  }
});

importScripts(
  "https://www.gstatic.com/firebasejs/12.10.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/12.10.0/firebase-messaging-compat.js",
);

firebase.initializeApp({
  apiKey: "AIzaSyCdj-5oF0d92kfoseQFENIdw7E4Ft7A_7w",
  authDomain: "ridgefieldgolfclub.org",
  projectId: "ridgefield-golf-club",
  storageBucket: "ridgefield-golf-club.firebasestorage.app",
  messagingSenderId: "210348651103",
  appId: "1:210348651103:web:b2102bd7200cc7be1121ea",
});

const messaging = firebase.messaging();

// Handle background messages - displayed as OS-level notifications when the app is not focused.
// We always call showNotification manually to ensure payload.data is attached,
// which is required for our notificationclick deep-linking logic. By using a
// consistent 'tag', we handle potential duplicates on browsers that also
// auto-show notifications when the 'notification' property is present.
messaging.onBackgroundMessage((payload) => {
  const title =
    payload.notification?.title ||
    payload.data?.title ||
    "Ridgefield Golf Club";
  const body = payload.notification?.body || payload.data?.body || "";
  const icon = payload.notification?.icon || "/rgc_fav.png";

  return self.registration.showNotification(title, {
    body,
    icon,
    tag: payload.notification?.tag || payload.data?.notificationId,
    // Critical for deep-linking in the notificationclick handler
    data: payload.data ?? {},
    ...payload.notification,
  });
});

// Opens or focuses the correct page when the user taps an OS-level notification.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link;
  const url = link
    ? new URL(link, self.location.origin).href
    : self.location.origin;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url === url && "focus" in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      }),
  );
});
