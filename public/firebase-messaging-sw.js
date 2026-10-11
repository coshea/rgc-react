// App service worker: offline app shell, static asset cache and push notifications.
//
// The filename is kept for continuity: existing installs are registered at
// /firebase-messaging-sw.js, and renaming it would orphan those registrations.
// It no longer loads the Firebase SDK. Push payloads are handled directly so
// that every push displays exactly one notification. iOS revokes push
// subscriptions that receive pushes without a visible notification.
//
// Payload formats handled:
//   1. Declarative Web Push ({ web_push: 8030, notification: {...} }), sent
//      directly by the dispatch_push_notification Cloud Function. Safari 18.4+
//      displays these itself; other browsers render them here.
//   2. Legacy FCM data messages ({ data: { title, body, link, ... } }) for
//      devices that have not yet migrated off their FCM token.
const APP_SHELL_CACHE = "rgc-app-shell-v2";
const STATIC_ASSET_CACHE = "rgc-static-v2";
const APP_SHELL_URLS = [
  "/",
  "/apple-touch-icon.png",
  "/pwa-192.png",
  "/pwa-512.png",
  "/rgc_fav.png",
];
const DEFAULT_TITLE = "Ridgefield Golf Club";
const DEFAULT_ICON = "/rgc_fav.png";

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isCacheableAssetRequest(request) {
  return ["font", "image", "manifest"].includes(request.destination);
}

async function applyBadgeCount(count) {
  if (typeof navigator.setAppBadge !== "function") return;
  const normalized =
    Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;

  try {
    if (normalized > 0) {
      await navigator.setAppBadge(normalized);
    } else if (typeof navigator.clearAppBadge === "function") {
      await navigator.clearAppBadge();
    } else {
      await navigator.setAppBadge(0);
    }
  } catch {
    // Unsupported or permission-restricted badging should not break push.
  }
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

// ---------------------------------------------------------------------------
// Push subscription helpers
// ---------------------------------------------------------------------------

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function keysEqual(buffer, expected) {
  if (!buffer) return false;
  const actual = new Uint8Array(buffer);
  if (actual.length !== expected.length) return false;
  for (let i = 0; i < actual.length; i += 1) {
    if (actual[i] !== expected[i]) return false;
  }
  return true;
}

/**
 * Returns a push subscription for the given VAPID public key, replacing any
 * subscription made with a different key (e.g. the legacy FCM key).
 *
 * Subscribing from the worker does not need a user gesture once permission is
 * granted, which lets existing iOS installs migrate without any taps.
 */
async function ensurePushSubscription(applicationServerKey) {
  const key = urlBase64ToUint8Array(applicationServerKey);
  const pushManager = self.registration.pushManager;
  const existing = await pushManager.getSubscription();

  if (existing && keysEqual(existing.options?.applicationServerKey, key)) {
    return existing;
  }
  if (existing) {
    await existing.unsubscribe();
  }
  return pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });
}

// ---------------------------------------------------------------------------
// Push rendering
// ---------------------------------------------------------------------------

function parseBadge(value) {
  const count = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(count) ? count : undefined;
}

/** Normalizes declarative and legacy FCM payloads into one shape. */
function parsePushPayload(eventData) {
  let payload = null;
  try {
    payload = eventData ? eventData.json() : null;
  } catch {
    payload = null;
  }

  if (payload && payload.web_push === 8030 && payload.notification) {
    const n = payload.notification;
    return {
      declarative: true,
      title: n.title || DEFAULT_TITLE,
      body: n.body || "",
      tag: n.tag,
      link: n.navigate,
      badge: parseBadge(n.app_badge),
      data: { ...(n.data || {}), link: n.data?.link || n.navigate },
    };
  }

  const data = (payload && payload.data) || {};
  const fcmNotification = (payload && payload.notification) || {};
  return {
    declarative: false,
    title: fcmNotification.title || data.title || DEFAULT_TITLE,
    body: fcmNotification.body || data.body || "",
    tag: data.notificationId,
    link: data.link,
    badge: parseBadge(data.badge),
    data,
  };
}

/**
 * Chromium does not penalize a push without a notification while one of the
 * site's windows is focused, so skip the banner there (the in-app bell already
 * updates live). Safari and Firefox always get a notification.
 */
async function isChromiumWithFocusedClient() {
  const ua = self.navigator.userAgent || "";
  const isChromium =
    /\b(Chrome|Chromium|Edg)\//.test(ua) && !/\b(iPhone|iPad|iPod)\b/.test(ua);
  if (!isChromium) return false;

  const windowClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  return windowClients.some((client) => client.focused);
}

async function handlePush(event) {
  const message = parsePushPayload(event.data);

  // Browsers with Declarative Web Push expose the proposed notification on
  // the event and display it themselves if the worker shows nothing.
  if (message.declarative && event.notification) return;

  if (await isChromiumWithFocusedClient()) return;

  // Show the notification before any other work so nothing can prevent it.
  await self.registration.showNotification(message.title, {
    body: message.body,
    icon: DEFAULT_ICON,
    tag: message.tag,
    data: message.data,
  });

  if (message.badge !== undefined) {
    await applyBadgeCount(message.badge);
  }
}

// ---------------------------------------------------------------------------
// Lifecycle and event listeners
// ---------------------------------------------------------------------------

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

self.addEventListener("message", (event) => {
  const payload = event.data;

  if (payload?.type === "BADGE_SYNC") {
    const count = Number(payload.count);
    if (!Number.isFinite(count)) return;
    event.waitUntil(applyBadgeCount(count));
    return;
  }

  // Page asks the worker to (re)subscribe; replies on the transferred port.
  if (payload?.type === "PUSH_SUBSCRIBE") {
    const port = event.ports?.[0];
    if (!port || typeof payload.applicationServerKey !== "string") return;
    event.waitUntil(
      ensurePushSubscription(payload.applicationServerKey).then(
        (subscription) =>
          port.postMessage({ ok: true, subscription: subscription.toJSON() }),
        (error) =>
          port.postMessage({
            ok: false,
            error: String(error?.message || error),
          }),
      ),
    );
  }
});

self.addEventListener("push", (event) => {
  event.waitUntil(handlePush(event));
});

// Keep the device subscribed if the push service rotates the subscription.
// The page records the new endpoint in Firestore on its next launch.
self.addEventListener("pushsubscriptionchange", (event) => {
  const applicationServerKey =
    event.oldSubscription?.options?.applicationServerKey;
  if (!applicationServerKey) return;
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey })
      .catch(() => undefined),
  );
});

// Opens or focuses the correct page when the user taps an OS-level notification.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link;
  const url = link
    ? new URL(link, self.location.origin).href
    : self.location.origin + "/";

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      const exactMatch = windowClients.find((client) => client.url === url);
      if (exactMatch && "focus" in exactMatch) {
        return exactMatch.focus();
      }

      // Reuse an open app window rather than spawning a second one.
      const appWindow = windowClients.find((client) =>
        client.url.startsWith(self.location.origin),
      );
      if (appWindow && "navigate" in appWindow) {
        try {
          const focused = await appWindow.focus();
          return await (focused || appWindow).navigate(url);
        } catch {
          // Uncontrolled clients cannot be navigated; open a window instead.
        }
      }

      return self.clients.openWindow(url);
    })(),
  );
});
