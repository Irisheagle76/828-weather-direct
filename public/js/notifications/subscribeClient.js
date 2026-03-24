export async function subscribeUserToPush() {
  try {
    console.log("SW READY WAITING...");
    const reg = await navigator.serviceWorker.ready;
    console.log("SW READY:", reg);

    // ✅ ADD IT RIGHT HERE
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

if (isIOS && !isStandalone) {

    if (isIOS && !window.navigator.standalone) {
      alert("To enable notifications:\nTap Share → Add to Home Screen → Open app");
      return { ok: false };
    }

    // Optional but still good
    if (!("PushManager" in window) || !reg.pushManager) {
      alert("Push not supported on this device/browser.");
      return { ok: false };
    }

    console.log("Attempting push subscription...");
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(window.VAPID_PUBLIC_KEY)
    });

    console.log("SUB SUCCESS:", sub);

    await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub)
    });

    return { ok: true };

  } catch (err) {
    alert("SUB ERROR: " + err.name + " — " + err.message);
    console.error("Push subscription error:", err);
    return { ok: false, error: err };
  }
}