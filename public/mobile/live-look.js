const localPreview = ["127.0.0.1", "localhost"].includes(typeof location === "undefined" ? "" : location.hostname);
const chamberPublished = "https://raw.githubusercontent.com/Irisheagle76/828-weather-direct/main/public/sky-camera-observations/";
// Existing website camera sources; no autoplay or additional camera-analysis calls.
export const CAMERAS = [
  { id: "west", name: "Asheville · Western sky", context: "Watch the western horizon and approaching cloud cover.", image: "https://i.ytimg.com/vi/UxUU3Fc1vBw/maxresdefault_live.jpg", href: "https://www.youtube.com/watch?v=UxUU3Fc1vBw", mountain: false },
  { id: "chamber", name: "Asheville Chamber of Commerce", context: "A wide southwest-facing view toward Mount Pisgah.", embed: "https://plyhearst.videstra.live/?id=674b5cf0-55b3-49e2-a8da-bb57ce2ece92_8UIJMXTyGjrwwXziaJUoFLf9hWifZbKVtWF5D_&token=kswZPhLz4beUpNJK7w4Fgl8eu", href: "https://plyhearst.videstra.live/?id=674b5cf0-55b3-49e2-a8da-bb57ce2ece92_8UIJMXTyGjrwwXziaJUoFLf9hWifZbKVtWF5D_&token=kswZPhLz4beUpNJK7w4Fgl8eu", mountain: false },
  { id: "tower", name: "UNC Asheville Tower", context: "The latest south-facing view from the UNC Asheville Weather Tower.", image: "https://www.atms.unca.edu/currwx/towercam.jpg", href: "https://www.atms.unca.edu/currwx/towercam.jpg", mountain: false },
  { id: "mitchell", name: "Mount Mitchell", context: "A summit-level check on visibility and low cloud.", image: "https://nchighpeaks.org/cam11/up/image.jpg", href: "https://nchighpeaks.org/cam11/cam11view.php", mountain: true },
  { id: "waynesville", name: "Waynesville mountain camera", context: "Haywood County valley and ridge view for checking cloud base, mountain visibility, precipitation, and seasonal hiking conditions.", image: "https://images.ambientweather.net/083A8DFB4D15/latest.jpg", href: "https://www.wunderground.com/dashboard/pws/KNCWAYNE276", label: "4,009 ft · Forest-framed mountain view", linkLabel: "Open current weather ↗", mountain: true }
];

export function cameraCards(cameras = CAMERAS.filter(camera => !camera.mountain)) {
  // Match the desktop Tower cache bucket; use one identical URL for preview/link.
  const towerBucket = Math.floor(Date.now() / (15 * 60 * 1000));
  cameras = cameras.map(camera => {
    if (camera.id !== "tower") return camera;
    const image = `${camera.image}${camera.image.includes("?") ? "&" : "?"}v=${towerBucket}`;
    return { ...camera, image, href: image };
  });
  return `<div class="live-look-grid">${cameras.map(camera => camera.embed
    ? `<section class="panel live-look-card"><div class="live-look-image"><button class="load-camera snapshot-camera" type="button" data-camera-id="${camera.id}" aria-label="Play Asheville Chamber of Commerce live camera"><img src="${localPreview ? "/mobile-preview/chamber.jpg" : `${chamberPublished}chamber-southwest.jpg?t=${Math.floor(Date.now()/600000)}`}" alt="Captured still from the Asheville Chamber of Commerce camera" /><span class="snapshot-fallback" hidden>Still unavailable · tap to watch live</span><span class="snapshot-play" aria-hidden="true">▶</span></button></div><div class="live-look-copy"><p class="kicker">Camera still · tap to watch live</p><h2>${camera.name}</h2><p>${camera.context}</p><small class="snapshot-time">Checking capture time…</small><a class="product-link" href="${camera.href}" target="_blank" rel="noopener noreferrer">Open camera source ↗</a><p class="body-copy">If the player is offline, try the source directly.</p></div></section>`
    : `<a class="panel live-look-card" href="${camera.href}" target="_blank" rel="noopener noreferrer"><div class="live-look-image"><img loading="lazy" decoding="async" src="${camera.image}" alt="${camera.name} camera view" /><span class="camera-unavailable" hidden>Camera preview unavailable · tap to check source</span></div><div class="live-look-copy"><p class="kicker">${camera.label || "Camera view"}</p><h2>${camera.name}</h2><p>${camera.context}</p><span class="product-link">${camera.linkLabel || "Open camera source ↗"}</span></div></a>`).join("")}</div>`;
}

const cameraRefreshTimers = new WeakMap();

export function bindCameraFailures(root) {
  if (cameraRefreshTimers.has(root)) clearInterval(cameraRefreshTimers.get(root));
  root.querySelectorAll("[data-camera-id]").forEach(button => {
    button.setAttribute("aria-label", "Open Asheville Chamber of Commerce live camera in a new tab");
    button.title = "Watch live in a new tab";
  });
  const captureTime = root.querySelector(".snapshot-time");
  let refreshing = false;
  const refresh = async () => {
    if (!captureTime || refreshing || document.hidden || root.closest(".screen")?.hidden) return;
    refreshing = true;
    try { await fetch(localPreview ? "/mobile-preview/chamber-status.json" : `${chamberPublished}chamber-southwest.json`, { cache: "no-store" }).then(response => {
    if (!response.ok) throw new Error("Unavailable");
    return response.json();
  }).then(async status => {
    const captured = Date.parse(status.capturedAt || status.observedAt);
    const image = root.querySelector(".snapshot-camera img");
    if (image && Number.isFinite(captured) && image.dataset.capture !== String(captured)) {
      const url = localPreview ? "/mobile-preview/chamber.jpg?t=" + captured : chamberPublished + "chamber-southwest.jpg?t=" + (status.sha256 || captured);
      await new Promise((resolve, reject) => { const preview = new Image(); const timer = setTimeout(() => reject(Error("Camera refresh timed out")), 12000); preview.onload = () => { clearTimeout(timer); resolve(); }; preview.onerror = () => { clearTimeout(timer); reject(Error("Camera refresh failed")); }; preview.src = url; });
      if (!image.isConnected) return;
      image.src = url; image.hidden = false; image.dataset.capture = String(captured);
      const fallback = image.parentElement.querySelector(".snapshot-fallback");
      if (fallback) fallback.hidden = true;
    }
    captureTime.textContent = Number.isFinite(captured) ? `Captured ${new Date(captured).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}${Date.now() - captured > 10 * 60000 || status.refreshFailed || (status.status && status.status !== "ok") ? " · OLDER IMAGE — check live camera" : ` · ${Math.max(0, Math.floor((Date.now() - captured) / 60000))} min ago`}` : "Still capture unavailable · tap to watch live";
  });
    } catch { if (!captureTime.textContent.startsWith("Captured")) captureTime.textContent = "Capture time unavailable · tap to watch live"; }
    finally { refreshing = false; }
  };
  refresh();
  const timer = setInterval(() => { if (!root.isConnected) { clearInterval(timer); return; } refresh(); }, 60000);
  cameraRefreshTimers.set(root, timer);

  root.querySelectorAll("[data-camera-id]").forEach(button => button.addEventListener("click", () => {
    const camera = CAMERAS.find(entry => entry.id === button.dataset.cameraId);
    window.open(camera.href, "_blank", "noopener,noreferrer");
  }));
  root.querySelectorAll(".live-look-image img").forEach(image => {
    const unavailable = () => {
      if (image.src.includes("www.atms.unca.edu/currwx/towercam.jpg") && !image.dataset.usedFallback) {
        image.dataset.usedFallback = "true";
        image.alt = "UNC Asheville Tower saved snapshot; capture time unverified";
        image.src = "https://res.cloudinary.com/dz45rrije/image/upload/avlweather_towercam_latest.jpg";
        image.addEventListener("error", () => { image.hidden = true; image.nextElementSibling.hidden = false; }, { once: true });
        const copy = image.closest(".live-look-card")?.querySelector(".live-look-copy p:not(.kicker)");
        if (copy) copy.textContent = "Saved backup image · capture time unverified. Open the source for the latest view.";
        return;
      }
      image.hidden = true; image.nextElementSibling.hidden = false;
    };
    image.addEventListener("error", unavailable, { once: true });
    if (image.complete && image.naturalWidth === 0) unavailable();
  });
}
