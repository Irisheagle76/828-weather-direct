const SW_VERSION = "v1.2.0-notification-images";
console.log("SW VERSION:", SW_VERSION);

self.addEventListener("install", event => {
  console.log("SW INSTALL", SW_VERSION);
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  console.log("SW ACTIVATE", SW_VERSION);
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", event => {
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", event => {
  const data = event.data?.json() || {};

  event.waitUntil(
    self.registration.showNotification(data.title || "828 Weather Update", {
      body: data.body || "",
      icon: "/828-brand-card.png",
      badge: "/828-brand-card.png",
      image: data.image || undefined,
      tag: data.tag || "828-weather-update",
      renotify: Boolean(data.renotify),
      data: {
        url: data.url || "/",
        alertId: data.alertId || null
      }
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.openWindow(url)
  );
});
