// ------------------------------------------------------------
// REQUIRED FOR iOS SAFARI
// ------------------------------------------------------------
self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(clients.claim());
});

// iOS requires a fetch handler, even if it's a no-op
self.addEventListener("fetch", () => {});

// ------------------------------------------------------------
// PUSH HANDLER
// ------------------------------------------------------------
self.addEventListener("push", event => {
  const data = event.data?.json() || {};

  event.waitUntil(
    self.registration.showNotification(data.title || "Update", {
      body: data.body || "",
      icon: "/icons/828.png",
      badge: "/icons/828-badge.png",
      data: data.url || "/"
    })
  );
});

// ------------------------------------------------------------
// NOTIFICATION CLICK
// ------------------------------------------------------------
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data)
  );
});