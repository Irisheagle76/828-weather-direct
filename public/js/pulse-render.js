// /js/pulse-render.js
// ============================================================
// 828 WEATHER PULSE — Fetch + Inject + Expand/Collapse
// ============================================================

async function loadPulse() {
  try {
    const res = await fetch("/api/tidbits/pulse-latest");
    const data = await res.json();

    // Elements
    const card = document.getElementById("pulse-card");
    const timestampEl = document.getElementById("pulse-timestamp");
    const thumbEl = document.getElementById("pulse-thumb");
    const previewEl = document.getElementById("pulse-preview");
    const toggleBtn = document.getElementById("pulse-toggle");

    // Fallback state
    if (!data || data.fallback) {
      timestampEl.textContent = "No Weather Pulse update yet";
      previewEl.textContent = "Stay tuned for the next quick update.";
      thumbEl.innerHTML = "";
      toggleBtn.style.display = "none";
      return;
    }

    // Timestamp
    const ts = data.timestamp ? new Date(data.timestamp) : null;
    timestampEl.textContent = ts
      ? formatTimeAgo(ts)
      : "Just now";

    // Thumbnail (with fallback + thumbnail styling)
const thumbSrc = data.imageUrl || "/828-brand-card.png";

thumbEl.innerHTML = `
  <img 
    src="${thumbSrc}" 
    alt="Pulse image" 
    class="pulse-thumb"
  />
`;
    // Preview text (shortened)
    const fullText = data.text || "";
    const shortText =
      fullText.length > 160 ? fullText.slice(0, 160) + "…" : fullText;

    previewEl.textContent = shortText;

    // Expand/Collapse
    let expanded = false;

    toggleBtn.addEventListener("click", () => {
      expanded = !expanded;

      if (expanded) {
        card.classList.add("pulse-expanded");
        previewEl.textContent = fullText;
        toggleBtn.textContent = "Show less";
        toggleBtn.setAttribute("aria-expanded", "true");
      } else {
        card.classList.remove("pulse-expanded");
        previewEl.textContent = shortText;
        toggleBtn.textContent = "Read full update";
        toggleBtn.setAttribute("aria-expanded", "false");
      }
    });
  } catch (err) {
    console.error("Pulse load error:", err);

    const timestampEl = document.getElementById("pulse-timestamp");
    const previewEl = document.getElementById("pulse-preview");

    timestampEl.textContent = "Unable to load Weather Pulse";
    previewEl.textContent = "Please try again later.";
  }
}

// Utility — matches your Substack module
function formatTimeAgo(date) {
  const now = new Date();
  const diff = (now - date) / 1000;

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

// Run on load
document.addEventListener("DOMContentLoaded", loadPulse);
