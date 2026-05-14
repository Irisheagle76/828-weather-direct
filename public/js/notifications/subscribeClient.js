function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export async function subscribeUserToPush() {
  try {
    if (!("serviceWorker" in navigator)) {
      return { ok: false, message: "Notifications are not supported in this browser." };
    }

    const keyRes = await fetch("/api/notifications/public-key", { cache: "no-store" });
    const keyData = await keyRes.json().catch(() => ({}));
    const publicKey = keyData.publicKey || window.VAPID_PUBLIC_KEY;

    if (!publicKey) {
      return { ok: false, message: "Notifications are not configured yet." };
    }

    const reg = await navigator.serviceWorker.ready;

    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone;

    if (isIOS && !isStandalone) {
      return {
        ok: false,
        message: "On iPhone/iPad, add this site to your Home Screen first, then open it from there to enable notifications."
      };
    }

    if (!("PushManager" in window) || !reg.pushManager) {
      return { ok: false, message: "Push notifications are not supported on this device/browser." };
    }

    if (Notification.permission === "denied") {
      return { ok: false, message: "Notifications are blocked for this site. Re-enable them in browser settings." };
    }

    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      await saveSubscription(existing);
      return { ok: true, existing: true };
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    await saveSubscription(sub);
    return { ok: true };
  } catch (err) {
    console.error("Push subscription error:", err);
    return {
      ok: false,
      error: err,
      message: `${err.name || "Error"}: ${err.message || "Unable to subscribe."}`
    };
  }
}

async function saveSubscription(sub) {
  const response = await fetch("/api/notifications/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub)
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Unable to save notification subscription.");
  }
}
