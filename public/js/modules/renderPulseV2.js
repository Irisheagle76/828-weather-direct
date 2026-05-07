// ============================================================
// 828 WEATHER — PULSE MODULE (V2 FINAL CLEAN)
// ============================================================

export function renderPulseV2(container, pulse) {
  if (!container) return;

  // ------------------------------------------------------------
  // EMPTY STATE
  // ------------------------------------------------------------
  if (!pulse || pulse.fallback) {
    container.innerHTML = `
      <div class="content-card pulse-card">
        <div class="pulse-heading">
          <div class="section-title pulse-title">
            <span class="pulse-title-dot" aria-hidden="true"></span>
            <span>828 Weather Pulse</span>
          </div>
          <div class="pulse-subtitle">Quick hits. Live conditions. 828.</div>
        </div>
        <div class="pulse-empty">No recent updates</div>
      </div>
    `;
    return;
  }

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  const time = formatTimeAgo(new Date(pulse.timestamp));
  const text = cleanText(pulse.text || pulse.body || "");
  const media = pulse.mediaUrl || pulse.image || null;

  const isVideo =
    !!media &&
    (
      pulse.mediaType === "video" ||
      media.endsWith(".mp4") ||
      media.includes("/video/")
    );

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------
  container.innerHTML = `
    <div class="content-card pulse-card">

      <div class="pulse-heading">
        <div class="section-title pulse-title">
          <span class="pulse-title-dot" aria-hidden="true"></span>
          <span>828 Weather Pulse</span>
        </div>
        <div class="pulse-subtitle">Quick hits. Live conditions. 828.</div>
      </div>

      <div class="pulse-meta">${time}</div>

      ${media ? `
        <div class="pulse-media">
          ${
            isVideo
              ? `
                <video autoplay muted loop playsinline preload="metadata">
                  <source src="${media}" type="video/mp4" />
                </video>
              `
              : `
                <img src="${media}" alt="Pulse image" />
              `
          }
        </div>
      ` : ""}

      <div class="pulse-body">
        <div class="pulse-text">
          ${text}
        </div>
        <div class="pulse-fade"></div>
      </div>

      <button class="pulse-toggle" aria-expanded="false">
        Read full update
      </button>

    </div>
  `;

  // ------------------------------------------------------------
  // ELEMENTS
  // ------------------------------------------------------------
  const card = container.querySelector(".pulse-card");
  const btn = container.querySelector(".pulse-toggle");
  const mediaEl = container.querySelector(".pulse-media");

  const lightbox = document.getElementById("pulse-lightbox");
  const lightboxContent = document.getElementById("pulse-lightbox-content");
  const closeBtn = document.querySelector(".pulse-lightbox-close");

  // ------------------------------------------------------------
  // EXPAND / COLLAPSE
  // ------------------------------------------------------------
  if (card && btn) {
    btn.onclick = () => {
      const expanded = card.classList.toggle("expanded");

      btn.textContent = expanded ? "Show less" : "Read full update";
      btn.setAttribute("aria-expanded", expanded ? "true" : "false");
    };
  }

  // ------------------------------------------------------------
  // LIGHTBOX (MEDIA EXPAND)
  // ------------------------------------------------------------
  if (mediaEl && lightbox && lightboxContent) {
    mediaEl.onclick = () => {
      lightboxContent.innerHTML = isVideo
        ? `
          <video controls autoplay>
            <source src="${media}" type="video/mp4" />
          </video>
        `
        : `
          <img src="${media}" />
        `;

      lightbox.classList.remove("hidden");
    };
  }

  // ------------------------------------------------------------
  // LIGHTBOX CLOSE (SAFE — NO DUPLICATE BINDING)
  // ------------------------------------------------------------
  if (lightbox && closeBtn && !lightbox.dataset.bound) {
    closeBtn.onclick = closeLightbox;
    lightbox.onclick = (e) => {
      if (e.target === lightbox) closeLightbox();
    };

    lightbox.dataset.bound = "true";
  }

  function closeLightbox() {
    lightbox.classList.add("hidden");
    lightboxContent.innerHTML = "";
  }
}

// ============================================================
// HELPERS
// ============================================================

function cleanText(html) {
  return (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatTimeAgo(date) {
  const diff = (Date.now() - date.getTime()) / 1000;

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;

  const days = Math.floor(diff / 86400);
  return `Last updated ${days} day${days > 1 ? "s" : ""} ago`;
}
