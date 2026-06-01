// MACU OKR — Web Push service worker
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Notification", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "MACU OKR";
  const options = {
    body: data.body || "",
    icon: "/logo.png",
    badge: "/favicon.png",
    data: { url: data.url || "/" },
    requireInteraction: true,
    tag: data.tag || undefined,
    renotify: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            client.focus();
            if ("navigate" in client) return client.navigate(targetUrl);
            return;
          }
        } catch (e) {}
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
