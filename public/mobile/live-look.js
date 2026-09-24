// Existing website camera sources; no autoplay or additional camera-analysis calls.
export const CAMERAS = [
  { id: "west", name: "Asheville · Western sky", context: "Watch the western horizon and approaching cloud cover.", image: "https://i.ytimg.com/vi/UxUU3Fc1vBw/maxresdefault_live.jpg", href: "https://www.youtube.com/watch?v=UxUU3Fc1vBw", mountain: false },
  { id: "chamber", name: "Asheville Chamber of Commerce", context: "A wide southwest-facing view toward Mount Pisgah.", embed: "https://plyhearst.videstra.live/?id=674b5cf0-55b3-49e2-a8da-bb57ce2ece92_8UIJMXTyGjrwwXziaJUoFLf9hWifZbKVtWF5D_&token=kswZPhLz4beUpNJK7w4Fgl8eu", href: "https://plyhearst.videstra.live/?id=674b5cf0-55b3-49e2-a8da-bb57ce2ece92_8UIJMXTyGjrwwXziaJUoFLf9hWifZbKVtWF5D_&token=kswZPhLz4beUpNJK7w4Fgl8eu", mountain: false },
  { id: "tower", name: "UNC Asheville Tower", context: "The latest south-facing view from the UNC Asheville Weather Tower.", image: "https://res.cloudinary.com/dz45rrije/image/upload/f_auto,q_auto:good/avlweather_towercam_latest.jpg", href: "https://res.cloudinary.com/dz45rrije/image/upload/f_auto,q_auto:good/avlweather_towercam_latest.jpg", mountain: false },
  { id: "mitchell", name: "Mount Mitchell", context: "A summit-level check on visibility and low cloud.", image: "https://nchighpeaks.org/cam11/up/image.jpg", href: "https://nchighpeaks.org/cam11/cam11view.php", mountain: true },
  { id: "pisgah", name: "Pisgah Inn", context: "Check the cloud deck along the Blue Ridge Parkway.", image: "https://streamer5.brownrice.com/cam-images/pisgahinn1.jpg", href: "https://streamer5.brownrice.com/cam-images/pisgahinn1.jpg", mountain: true }
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
    ? `<section class="panel live-look-card"><div class="live-look-image"><button class="load-camera snapshot-camera" type="button" data-camera-id="${camera.id}" aria-label="Play Asheville Chamber of Commerce live camera"><img src="/mobile-preview/chamber.jpg" alt="Captured still from the Asheville Chamber of Commerce camera" /><span class="snapshot-fallback" hidden>Still unavailable · tap to watch live</span><span class="snapshot-play" aria-hidden="true">▶</span></button></div><div class="live-look-copy"><p class="kicker">Camera still · tap to watch live</p><h2>${camera.name}</h2><p>${camera.context}</p><small class="snapshot-time">Checking capture time…</small><a class="product-link" href="${camera.href}" target="_blank" rel="noopener noreferrer">Open camera source ↗</a><p class="body-copy">If the player is offline, try the source directly.</p></div></section>`
    : `<a class="panel live-look-card" href="${camera.href}" target="_blank" rel="noopener noreferrer"><div class="live-look-image"><img loading="lazy" decoding="async" src="${camera.image}" alt="${camera.name} camera view" /><span class="camera-unavailable" hidden>Camera preview unavailable · tap to check source</span></div><div class="live-look-copy"><p class="kicker">Camera view</p><h2>${camera.name}</h2><p>${camera.context}</p><span class="product-link">Open camera source ↗</span></div></a>`).join("")}</div>`;
}

export function bindCameraFailures(root) {
  root.querySelectorAll("[data-camera-id]").forEach(button => {
    button.setAttribute("aria-label", "Open Asheville Chamber of Commerce live camera in a new tab");
    button.title = "Watch live in a new tab";
  });
  const captureTime = root.querySelector(".snapshot-time");
  if (captureTime) fetch("/mobile-preview/chamber-status.json", { cache: "no-store" }).then(response => {
    if (!response.ok) throw new Error("Unavailable");
    return response.json();
  }).then(status => {
    const captured = Date.parse(status.capturedAt);
    captureTime.textContent = Number.isFinite(captured) ? `Frame captured ${new Date(captured).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}${Date.now() - captured > 10 * 60000 || status.refreshFailed ? " · latest refresh unavailable; still may be old" : " · refreshed every 5 minutes"}` : "Still capture unavailable · tap to watch live";
  }).catch(() => { captureTime.textContent = "Still capture unavailable · tap to watch live"; });
  root.querySelectorAll("[data-camera-id]").forEach(button => button.addEventListener("click", () => {
    const camera = CAMERAS.find(entry => entry.id === button.dataset.cameraId);
    window.open(camera.href, "_blank", "noopener,noreferrer");
  }));
  root.querySelectorAll(".live-look-image img").forEach(image => {
    const unavailable = () => { image.hidden = true; image.nextElementSibling.hidden = false; };
    image.addEventListener("error", unavailable, { once: true });
    if (image.complete && image.naturalWidth === 0) unavailable();
  });
}
