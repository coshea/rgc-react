// Firebase Cloud Messaging service worker
// Handles background push notifications when the app is not in focus.
// Uses the Firebase compat SDK because service workers cannot use ES module imports.
// The version should broadly match the firebase npm package installed in the app.
importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js",
);

firebase.initializeApp({
  apiKey: "AIzaSyCdj-5oF0d92kfoseQFENIdw7E4Ft7A_7w",
  authDomain: "ridgefield-golf-club.firebaseapp.com",
  projectId: "ridgefield-golf-club",
  storageBucket: "ridgefield-golf-club.firebasestorage.app",
  messagingSenderId: "210348651103",
  appId: "1:210348651103:web:b2102bd7200cc7be1121ea",
});

const messaging = firebase.messaging();

// Handle background messages - displayed as OS-level notifications when the app is not focused.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? "Ridgefield Golf Club";
  const body = payload.notification?.body ?? "";
  const icon = "/rgc_fav.png";

  self.registration.showNotification(title, {
    body,
    icon,
    data: payload.data ?? {},
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
