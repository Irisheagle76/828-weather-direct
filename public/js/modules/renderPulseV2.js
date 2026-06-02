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
  const html = sanitizePulseHtml(pulse.text || pulse.body || "");
  const text = htmlToText(html);
  const media = pulse.mediaUrl || pulse.image || null;
  const recent = Array.isArray(pulse.recent) ? pulse.recent.slice(0, 4) : [];

  const isVideo =
    !!media &&
    (
      pulse.mediaType === "video" ||
      media.endsWith(".mp4") ||
      media.includes("/video/")
    );

  const safeMedia = media ? escapeAttr(media) : "";
  const recentRail = createRecentRail(recent);

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
                  <source src="${safeMedia}" type="video/mp4" />
                </video>
              `
              : `
                <img src="${safeMedia}" alt="Pulse image" />
              `
          }
        </div>
      ` : ""}

      <div class="pulse-body">
        <div class="pulse-text">
          ${html}
        </div>
        <div class="pulse-fade"></div>
      </div>

      ${recentRail}

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
            <source src="${safeMedia}" type="video/mp4" />
          </video>
        `
        : `
          <img src="${safeMedia}" />
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

function createRecentRail(items) {
  if (!items.length) return "";

  const cards = items.map((item) => {
    const media = item.mediaUrl || item.image || "/828-brand-card.png";
    const isVideo = item.mediaType === "video" || media.endsWith(".mp4") || media.includes("/video/");
    const thumbnail = createThumbnailUrl(media, isVideo);
    const time = item.timestamp ? formatShortDate(new Date(item.timestamp)) : "Recent";
    const text = htmlToText(sanitizePulseHtml(item.text || item.body || item.content || ""));
    const label = text ? text.slice(0, 64) : "Weather Pulse update";
    const href = `/pulse.html${item.timestamp ? `#pulse-${item.timestamp}` : ""}`;

    return `
      <a class="pulse-rail-card" href="${escapeAttr(href)}" aria-label="Open ${escapeAttr(label)}">
        <span class="pulse-rail-media">
          <img src="${escapeAttr(thumbnail)}" alt="" loading="lazy" />
          ${isVideo ? '<span class="pulse-rail-kind">Video</span>' : ""}
        </span>
        <span class="pulse-rail-time">${escapeHTML(time)}</span>
      </a>
    `;
  }).join("");

  return `
    <div class="pulse-rail" aria-label="Recent Weather Pulse updates">
      <div class="pulse-rail-head">
        <span>Recent pulses</span>
        <a href="/pulse.html">View all</a>
      </div>
      <div class="pulse-rail-track">
        ${cards}
      </div>
    </div>
  `;
}

function createThumbnailUrl(url, isVideo) {
  if (!url || !url.includes("/upload/")) return url || "/828-brand-card.png";
  return url.replace(
    "/upload/",
    isVideo
      ? "/upload/so_0,c_fill,w_220,h_124,q_auto,f_jpg/"
      : "/upload/c_fill,w_220,h_124,q_auto,f_auto/"
  );
}

function sanitizePulseHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html || "";

  const allowedTags = new Set(["A", "B", "BR", "CODE", "EM", "I", "LI", "OL", "P", "STRONG", "U", "UL"]);
  const allowedProtocols = new Set(["http:", "https:", "mailto:", "tel:"]);

  function cleanNode(node) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) continue;

      if (child.nodeType !== Node.ELEMENT_NODE || !allowedTags.has(child.tagName)) {
        cleanNode(child);
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }

      const rawHref = child.tagName === "A" ? child.getAttribute("href") || "" : "";

      for (const attr of Array.from(child.attributes)) {
        child.removeAttribute(attr.name);
      }

      if (child.tagName === "A") {
        let href = "";

        try {
          const url = new URL(rawHref, window.location.origin);
          if (allowedProtocols.has(url.protocol)) href = url.href;
        } catch {
          href = "";
        }

        if (href) {
          child.setAttribute("href", href);
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noopener noreferrer");
        } else {
          child.replaceWith(...Array.from(child.childNodes));
          continue;
        }
      }

      cleanNode(child);
    }
  }

  cleanNode(template.content);
  return template.innerHTML.trim();
}

function htmlToText(html) {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  return (div.textContent || "").replace(/\s+/g, " ").trim();
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function escapeAttr(value) {
  return escapeHTML(value);
}

function formatShortDate(date) {
  if (!Number.isFinite(date.getTime())) return "Recent";

  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function formatTimeAgo(date) {
  const diff = (Date.now() - date.getTime()) / 1000;

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;

  const days = Math.floor(diff / 86400);
  return `Last updated ${days} day${days > 1 ? "s" : ""} ago`;
}
