// /js/pulse-render.js

function cleanHtml(html) {
  return (html || "")
    .replace(/<span[^>]*>/g, "")
    .replace(/<\/span>/g, "")
    .replace(/&nbsp;/g, " ");
}

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

    if (!data || data.fallback) {
      timestampEl.textContent = "No Weather Pulse update yet";
      previewEl.textContent = "Stay tuned for the next quick update.";
      thumbEl.innerHTML = "";
      toggleBtn.style.display = "none";
      return;
    }

    const ts = data.timestamp ? new Date(data.timestamp) : null;
    timestampEl.textContent = ts ? formatTimeAgo(ts) : "Just now";

    const thumbSrc = data.imageUrl || "/828-brand-card.png";

    const optimizedSrc = thumbSrc.includes("/upload/")
      ? thumbSrc.replace("/upload/", "/upload/w_900,q_auto,f_auto/")
      : thumbSrc;

    const isVideo =
  optimizedSrc.includes('/video/upload') ||
  optimizedSrc.endsWith('.mp4');

if (isVideo) {
  thumbEl.innerHTML = `
    <video autoplay loop muted playsinline class="pulse-thumb-video">
      <source src="${optimizedSrc}" type="video/mp4">
    </video>
  `;
} else {
  thumbEl.innerHTML = `
    <img src="${optimizedSrc}" alt="Pulse image" />
  `;
}

    const fullText = cleanHtml(data.text || "");
    const shortText = createHybridPreview(fullText);

    previewEl.innerHTML = shortText;

    // ============================================================
    // TOGGLE
    // ============================================================

    let expanded = false;

    function handleToggle() {
      expanded = !expanded;

      if (expanded) {
        card.classList.add("pulse-expanded");
        thumbEl.style.display = "none";

        const firstSentence = fullText.split('. ')[0] + '.';
        const rest = fullText.replace(firstSentence, '');

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
        thumbEl.style.display = "block";

        previewEl.innerHTML = shortText;

        toggleBtn.textContent = "Read full update";
        toggleBtn.setAttribute("aria-expanded", "false");
      }
    }

    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleToggle();
    });

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
// TIME AGO (OUTSIDE loadPulse)
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
