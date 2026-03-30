// /js/pulse-render.js
// ============================================================
// 828 WEATHER PULSE — FINAL RENDERER (2026 Edition)
// Matches pulse.css exactly and supports image/video + hybrid preview
// ============================================================

// ------------------------------------------------------------
// CLEAN HTML
// ------------------------------------------------------------
function cleanHtml(html) {
  return (html || "")
    .replace(/<span[^>]*>/g, "")
    .replace(/<\/span>/g, "")
    .replace(/&nbsp;/g, " ");
}

// ------------------------------------------------------------
// HYBRID PREVIEW BUILDER
// ------------------------------------------------------------
function createHybridPreview(html) {
  const textOnly = (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!textOnly) return "";

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

// ------------------------------------------------------------
// TIME AGO FORMATTER
// ------------------------------------------------------------
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

  if (!card || !timestampEl || !mediaEl || !previewEl || !fullTextEl || !toggleBtn) {
    console.warn("Pulse DOM elements missing — cannot render Pulse.");
    return;
  }

  // ------------------------------------------------------------
  // NO PULSE AVAILABLE
  // ------------------------------------------------------------
  if (!pulse) {
    timestampEl.textContent = "No Weather Pulse update yet";
    previewEl.textContent = "Stay tuned for the next quick update.";
    mediaEl.innerHTML = "";
    fullTextEl.innerHTML = "";
    toggleBtn.style.display = "none";
    return;
  }

  toggleBtn.style.display = "inline-flex";

  // ------------------------------------------------------------
  // TIMESTAMP
  // ------------------------------------------------------------
  const ts = pulse.timestamp ? new Date(pulse.timestamp) : null;
  timestampEl.textContent = ts ? formatTimeAgo(ts) : "Just now";

  // ------------------------------------------------------------
  // MEDIA HANDLING
  // ------------------------------------------------------------
  const rawSrc = pulse.mediaUrl || pulse.image || "/828-brand-card.png";
  const isVideo =
    rawSrc.endsWith(".mp4") ||
    rawSrc.includes("/video/upload") ||
    rawSrc.toLowerCase().includes(".mov");

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

  // ------------------------------------------------------------
  // PREVIEW TEXT
  // ------------------------------------------------------------
  const fullText = cleanHtml(pulse.text || pulse.body || pulse.content || "");
  const shortText = createHybridPreview(fullText);

  previewEl.innerHTML = shortText;

  // ------------------------------------------------------------
  // DEFAULT COLLAPSED STATE
  // ------------------------------------------------------------
  fullTextEl.innerHTML = "";
  let expanded = false;

  // ============================================================
  // EXPAND / COLLAPSE HANDLER — MATCHES pulse.css EXACTLY
  // ============================================================
  function handleToggle() {
    expanded = !expanded;

    if (expanded) {
      // EXPANDED MODE
      card.classList.add("pulse-expanded");
      mediaEl.style.display = "none";

      let firstSentence = fullText;
      let rest = "";

      if (fullText.includes(". ")) {
        firstSentence = fullText.split(". ")[0] + ".";
        rest = fullText.slice(firstSentence.length).trim();
      }

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
            <strong>${firstSentence}</strong>${rest ? " " + rest : ""}
          </div>
        </div>
      `;

      toggleBtn.textContent = "Show less";
      toggleBtn.setAttribute("aria-expanded", "true");
    } else {
      // COLLAPSED MODE
      card.classList.remove("pulse-expanded");
      mediaEl.style.display = "block";
      previewEl.innerHTML = shortText;
      fullTextEl.innerHTML = "";
      toggleBtn.textContent = "Read full update";
      toggleBtn.setAttribute("aria-expanded", "false");
    }
  }

  // BUTTON CLICK
  toggleBtn.onclick = handleToggle;

  // CARD CLICK (EXCEPT BUTTON + LINKS)
  card.onclick = (e) => {
    if (e.target.closest("#pulse-toggle") || e.target.closest("a")) return;
    handleToggle();
  };
}