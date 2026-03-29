// /js/pulse-render.js
// ============================================================
// MODERNIZED PULSE RENDERER — MATCHES pulse.css EXACTLY
// ============================================================

// Clean HTML of unwanted tags
function cleanHtml(html) {
  return (html || "")
    .replace(/<span[^>]*>/g, "")
    .replace(/<\/span>/g, "")
    .replace(/&nbsp;/g, " ");
}

// Hybrid preview builder
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

// Time-ago formatter
function formatTimeAgo(date) {
  const now = new Date();
  const diff = (now - date) / 1000;

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

// ============================================================
// MAIN RENDERER — MATCHES pulse.css STRUCTURE
// ============================================================

export function renderPulse(pulse) {
  const card = document.getElementById("pulse-card");
  const timestampEl = document.getElementById("pulse-timestamp");
  const mediaEl = document.getElementById("pulse-media");
  const previewEl = document.getElementById("pulse-preview");
  const fullTextEl = document.getElementById("pulse-full-text");
  const toggleBtn = document.getElementById("pulse-toggle");

  if (!pulse) {
    timestampEl.textContent = "No Weather Pulse update yet";
    previewEl.textContent = "Stay tuned for the next quick update.";
    mediaEl.innerHTML = "";
    toggleBtn.style.display = "none";
    return;
  }

  // TIMESTAMP
  const ts = pulse.timestamp ? new Date(pulse.timestamp) : null;
  timestampEl.textContent = ts ? formatTimeAgo(ts) : "Just now";

  // MEDIA HANDLING
  const rawSrc = pulse.mediaUrl || "/828-brand-card.png";
  const isVideo = rawSrc.includes("/video/upload") || rawSrc.endsWith(".mp4");

  const optimizedSrc = rawSrc.includes("/upload/")
    ? rawSrc.replace(
        "/upload/",
        isVideo
          ? "/upload/q_auto/"
          : "/upload/w_900,q_auto,f_auto/"
      )
    : rawSrc;

  mediaEl.innerHTML = isVideo
    ? `
      <video autoplay loop muted playsinline class="pulse-thumbnail pulse-thumb-video">
        <source src="${optimizedSrc}" type="video/mp4">
      </video>
    `
    : `
      <img src="${optimizedSrc}" alt="Pulse image" class="pulse-thumbnail" />
    `;

  // PREVIEW
  const fullText = cleanHtml(pulse.text || "");
  const shortText = createHybridPreview(fullText);

  previewEl.innerHTML = shortText;

  // Default collapsed state
  fullTextEl.innerHTML = "";
  let expanded = false;

  // ============================================================
  // EXPAND / COLLAPSE HANDLER — MATCHES pulse.css EXACTLY
  // ============================================================

  function handleToggle() {
    expanded = !expanded;

    if (expanded) {
      // Expanded mode
      card.classList.add("pulse-expanded");
      mediaEl.style.display = "none";

      const firstSentence = fullText.split(". ")[0] + ".";
      const rest = fullText.replace(firstSentence, "");

      const expandedMedia = isVideo
        ? `
          <div class="pulse-media">
            <video autoplay loop muted playsinline>
              <source src="${optimizedSrc}" type="video/mp4">
            </video>
          </div>
        `
        : `
          <div class="pulse-media">
            <img src="${optimizedSrc}" />
          </div>
        `;

      fullTextEl.innerHTML = `
        <div class="pulse-expanded-content">
          ${expandedMedia}
          <div class="pulse-full-text">
            <strong>${firstSentence}</strong> ${rest}
          </div>
        </div>
      `;

      toggleBtn.textContent = "Show less";
      toggleBtn.setAttribute("aria-expanded", "true");

    } else {
      // Collapsed mode
      card.classList.remove("pulse-expanded");
      mediaEl.style.display = "block";
      previewEl.innerHTML = shortText;
      fullTextEl.innerHTML = "";
      toggleBtn.textContent = "Read full update";
      toggleBtn.setAttribute("aria-expanded", "false");
    }
  }

  toggleBtn.onclick = handleToggle;

  // Clicking the card toggles too (except links + button)
  card.onclick = (e) => {
    if (e.target.closest("#pulse-toggle") || e.target.closest("a")) return;
    handleToggle();
  };
}