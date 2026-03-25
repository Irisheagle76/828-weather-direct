// ------------------------------------------------------------
// SERVICE WORKER VERSION (bump this to force iOS to reload SW)
// ------------------------------------------------------------
const SW_VERSION = "v1.0.1";
console.log("SW VERSION:", SW_VERSION);

// ------------------------------------------------------------
// INSTALL — required for iOS
// ------------------------------------------------------------
self.addEventListener("install", event => {
  console.log("SW INSTALL", SW_VERSION);
  self.skipWaiting();
});

// ------------------------------------------------------------
// ACTIVATE — required for iOS
// ------------------------------------------------------------
self.addEventListener("activate", event => {
  console.log("SW ACTIVATE", SW_VERSION);
  event.waitUntil(clients.claim());
});

// ------------------------------------------------------------
// FETCH — iOS requires a REAL fetch handler (not empty)
// ------------------------------------------------------------
self.addEventListener("fetch", event => {
  event.respondWith(fetch(event.request));
});

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