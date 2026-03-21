// /js/pulse-render.js
// ============================================================
// 828 WEATHER PULSE — Fetch + Inject + Expand/Collapse
// ============================================================

// Clean HTML
function cleanHtml(html) {
  return (html || "")
    .replace(/<span[^>]*>/g, "")
    .replace(/<\/span>/g, "")
    .replace(/&nbsp;/g, " ");
}

// Hybrid preview
function createHybridPreview(html) {
  const textOnly = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const sentences = textOnly.split(/(?<=[.!?])\s+/);

  if (sentences.length === 0) return textOnly.slice(0, 280) + "…";

  const first = sentences[0];

  if (first.split(" ").length >= 20) return first + "…";

  if (sentences.length > 1) {
    const combined = first + " " + sentences[1];
    if (combined.split(" ").length >= 35) return combined + "…";
  }

  const words = textOnly.split(" ");
  return words.slice(0, 50).join(" ") + "…";
}

// ============================================================
// MAIN LOADER
// ============================================================

async function loadPulse() {
  try {
    const res = await fetch("/api/tidbits/pulse-latest");
    const data = await res.json();

    const card = document.getElementById("pulse-card");
    const timestampEl = document.getElementById("pulse-timestamp");
    const thumbEl = document.getElementById("pulse-thumb");
    const previewEl = document.getElementById("pulse-preview");
    const toggleBtn = document.getElementById("pulse-toggle");

    // Fallback
    if (!data || data.fallback) {
      timestampEl.textContent = "No Weather Pulse update yet";
      previewEl.textContent = "Stay tuned for the next quick update.";
      thumbEl.innerHTML = "";
      toggleBtn.style.display = "none";
      return;
    }

    // Timestamp
    const ts = data.timestamp ? new Date(data.timestamp) : null;
    timestampEl.textContent = ts ? formatTimeAgo(ts) : "Just now";

    // Image
    const thumbSrc = data.imageUrl || "/828-brand-card.png";

    // 🔥 Cloudinary optimization
    const optimizedSrc = thumbSrc.includes("/upload/")
      ? thumbSrc.replace("/upload/", "/upload/w_900,q_auto,f_auto/")
      : thumbSrc;

    // Thumbnail (collapsed view only)
    thumbEl.innerHTML = `
      <img src="${optimizedSrc}" alt="Pulse image" />
    `;

    // Text
    const fullText = cleanHtml(data.text || "");
    const shortText = createHybridPreview(fullText);

    previewEl.innerHTML = shortText;

// ============================================================
// TOGGLE
// ============================================================

let expanded = false;

// Central toggle function (clean + reusable)
function handleToggle() {
  expanded = !expanded;

  if (expanded) {
    card.classList.add("pulse-expanded");

    // Hide thumbnail
    thumbEl.style.display = "none";

    // Headline extraction
    const firstSentence = fullText.split('. ')[0] + '.';
    const rest = fullText.replace(firstSentence, '');

    // Expanded layout
    previewEl.innerHTML = `
      <div class="pulse-expanded-content">
        <img src="${optimizedSrc}" class="pulse-expanded-img" />
        <div class="pulse-full-text">
          <strong>${firstSentence}</strong> ${rest}
        </div>
      </div>
    `;

    toggleBtn.textContent = "Show less";
    toggleBtn.setAttribute("aria-expanded", "true");

  } else {
    card.classList.remove("pulse-expanded");

    // Show thumbnail again
    thumbEl.style.display = "block";

    previewEl.innerHTML = shortText;

    toggleBtn.textContent = "Read full update";
    toggleBtn.setAttribute("aria-expanded", "false");
  }
}

// Button click (prevent double trigger)
toggleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  handleToggle();
});

// ============================================================
// TAP ANYWHERE TO EXPAND (SMART VERSION)
// ============================================================

card.addEventListener("click", (e) => {
  // Ignore clicks on button or links
  if (
    e.target.closest("#pulse-toggle") ||
    e.target.closest("a")
  ) {
    return;
  }

  handleToggle();
});

// ============================================================
// TIME AGO
// ============================================================

function formatTimeAgo(date) {
  const now = new Date();
  const diff = (now - date) / 1000;

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

document.addEventListener("DOMContentLoaded", loadPulse);
