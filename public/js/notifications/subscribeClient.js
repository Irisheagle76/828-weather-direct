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

    // Send subscription to backend
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