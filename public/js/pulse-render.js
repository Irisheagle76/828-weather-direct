// ============================================================
// CLEAN HTML
// ============================================================
function cleanHtml(html) {
  return (html || "")
    .replace(/<span[^>]*>/g, "")
    .replace(/<\/span>/g, "")
    .replace(/&nbsp;/g, " ");
}

// ============================================================
// HYBRID PREVIEW (your editorial logic preserved)
// ============================================================
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
    const thumbEl = document.getElementById("pulse-thumb"); // now an <img>
    const previewEl = document.getElementById("pulse-preview");
    const toggleBtn = document.getElementById("pulse-toggle");

    // ------------------------------------------------------------
    // FALLBACK
    // ------------------------------------------------------------
    if (!data || data.fallback) {
      timestampEl.textContent = "No Weather Pulse update yet";
      previewEl.textContent = "Stay tuned for the next quick update.";
      thumbEl.style.display = "none";
      toggleBtn.style.display = "none";
      return;
    }

    // ------------------------------------------------------------
    // TIMESTAMP
    // ------------------------------------------------------------
    const ts = data.timestamp ? new Date(data.timestamp) : null;
    timestampEl.textContent = ts ? formatTimeAgo(ts) : "Just now";

    // ------------------------------------------------------------
    // THUMBNAIL (image or video)
    // ------------------------------------------------------------
    const rawSrc = data.imageUrl || "/828-brand-card.png";

    const isVideo =
      rawSrc.includes("/video/upload") ||
      rawSrc.endsWith(".mp4");

    const optimizedSrc = rawSrc.includes("/upload/")
      ? rawSrc.replace(
          "/upload/",
          isVideo
            ? "/upload/q_auto/"               // video-safe
            : "/upload/w_900,q_auto,f_auto/"  // image optimized
        )
      : rawSrc;

    // Render thumbnail into the <img> or replace with <video>
    if (isVideo) {
      // Replace <img> with <video> for collapsed view
      thumbEl.outerHTML = `
        <video autoplay loop muted playsinline 
               id="pulse-thumb" 
               class="pulse-thumbnail pulse-thumb-video">
          <source src="${optimizedSrc}" type="video/mp4">
        </video>
      `;
    } else {
      thumbEl.src = optimizedSrc;
      thumbEl.alt = "Pulse image";
    }

    // ------------------------------------------------------------
    // PREVIEW TEXT
    // ------------------------------------------------------------
    const fullText = cleanHtml(data.text || "");
    const shortText = createHybridPreview(fullText);

    previewEl.innerHTML = shortText;

    // ------------------------------------------------------------
    // EXPAND / COLLAPSE
    // ------------------------------------------------------------
    let expanded = false;

    function handleToggle() {
      expanded = !expanded;

      if (expanded) {
        card.classList.add("pulse-expanded");

        // Hide collapsed thumbnail
        const thumbNode = document.getElementById("pulse-thumb");
        if (thumbNode) thumbNode.style.display = "none";

        // Split first sentence for bold treatment
        const firstSentence = fullText.split(". ")[0] + ".";
        const rest = fullText.replace(firstSentence, "");

        const expandedMedia = isVideo
          ? `<video autoplay loop muted playsinline class="pulse-expanded-img">
               <source src="${optimizedSrc}" type="video/mp4">
             </video>`
          : `<img src="${optimizedSrc}" class="pulse-expanded-img" />`;

        previewEl.innerHTML = `
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
        card.classList.remove("pulse-expanded");

        // Restore collapsed thumbnail
        const thumbNode = document.getElementById("pulse-thumb");
        if (thumbNode) thumbNode.style.display = "block";

        previewEl.innerHTML = shortText;

        toggleBtn.textContent = "Read full update";
        toggleBtn.setAttribute("aria-expanded", "false");
      }
    }

    // Button click
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleToggle();
    });

    // Card click (but ignore clicks on button or links)
    card.addEventListener("click", (e) => {
      if (e.target.closest("#pulse-toggle") || e.target.closest("a")) return;
      handleToggle();
    });

  } catch (err) {
    console.error("Pulse load error:", err);

    document.getElementById("pulse-timestamp").textContent =
      "Unable to load Weather Pulse";
    document.getElementById("pulse-preview").textContent =
      "Please try again later.";
  }
}

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

// Run
document.addEventListener("DOMContentLoaded", loadPulse);