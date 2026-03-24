export async function subscribeUserToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported" };
  }

  const registration = await navigator.serviceWorker.register("/sw.js");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "denied" };
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: window.VAPID_PUBLIC_KEY
  });

  await fetch("/api/notifications/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription)
  });
  // ------------------------------------------------------------
// DEBUGGING SUBSCRIPTION NOTIFICATION
// ------------------------------------------------------------

export async function subscribeUserToPush() {
  try {
    console.log("SW READY WAITING...");
    const reg = await navigator.serviceWorker.ready;
    console.log("SW READY:", reg);

    console.log("Attempting push subscription...");
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
    });

    console.log("SUB SUCCESS:", sub);

    // TODO: send subscription to your backend
    return { ok: true };

  } catch (err) {
    alert("SUB ERROR: " + err.name + " — " + err.message);
    console.error("Push subscription error:", err);
    return { ok: false, error: err };
  }
}