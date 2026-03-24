// ------------------------------------------------------------
// REQUIRED FOR iOS SAFARI
// ------------------------------------------------------------
self.addEventListener("install", event => {
  console.log("SW INSTALL");
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  console.log("SW ACTIVATE");
  event.waitUntil(clients.claim());
});

// iOS requires a REAL fetch handler (not empty)
self.addEventListener("fetch", event => {
  // Minimal pass-through fetch handler
  event.respondWith(fetch(event.request));
});

// ------------------------------------------------------------
// DEBUG
// ------------------------------------------------------------
console.log("SW LOADED");

self.clients.matchAll().then(clients => {
  clients.forEach(client => client.postMessage("SW is active"));
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