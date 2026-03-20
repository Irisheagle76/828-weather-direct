// /js/pulse-render.js
// ============================================================
// 828 WEATHER PULSE — Fetch + Inject + Expand/Collapse
// ============================================================

// Remove garbage spans + nbsp
function cleanHtml(html) {
  return (html || "")
    .replace(/<span[^>]*>/g, "")
    .replace(/<\/span>/g, "")
    .replace(/&nbsp;/g, " ");
}

// Hybrid preview: sentence-based + fallback (longer)
function createHybridPreview(html) {
  const textOnly = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const sentences = textOnly.split(/(?<=[.!?])\s+/);

  if (sentences.length === 0) {
    return textOnly.slice(0, 280) + "…";
  }

  const first = sentences[0];

  // First sentence must be at least 20 words
  if (first.split(" ").length >= 20) {
    return first + "…";
  }

  // Combine first + second if needed
  if (sentences.length > 1) {
    const combined = first + " " + sentences[1];
    if (combined.split(" ").length >= 35) {
      return combined + "…";
    }
  }

  // Fallback: 50-word preview
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
    timestampEl.textContent = ts ? formatTimeAgo(ts) : "Just now";

    // Thumbnail (with fallback)
    const thumbSrc = data.imageUrl || "/828-brand-card.png";
    thumbEl.innerHTML = `
      <img 
        src="${thumbSrc}" 
        alt="Pulse image"
      />
    `;

    // Clean + preview text
    const fullText = cleanHtml(data.text || "");
    const shortText = createHybridPreview(fullText);

    previewEl.innerHTML = shortText;

    // Expand/Collapse
    let expanded = false;

    toggleBtn.addEventListener("click", () => {
      expanded = !expanded;

      if (expanded) {
        card.classList.add("pulse-expanded");

        // HERO IMAGE + FULL TEXT
        previewEl.innerHTML = `
          <div class="pulse-hero">
            <img src="${thumbSrc}" alt="Pulse image" />
          </div>
          <div class="pulse-full-text">
            ${fullText}
          </div>
        `;

        toggleBtn.textContent = "Show less";
        toggleBtn.setAttribute("aria-expanded", "true");

      } else {
        card.classList.remove("pulse-expanded");
        previewEl.innerHTML = shortText;
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

// ============================================================
// TIME AGO UTILITY
// ============================================================

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
