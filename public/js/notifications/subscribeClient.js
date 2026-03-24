function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
export async function subscribeUserToPush() {
  try {
    console.log("SW READY WAITING...");
    const reg = await navigator.serviceWorker.ready;
    console.log("SW READY:", reg);

    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone;

    if (isIOS && !isStandalone) {
      alert("To enable notifications:\nTap Share → Add to Home Screen → Open app");
      return { ok: false };
    }

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