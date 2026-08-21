const els = {
      hikerScore: document.querySelector("#hikerScore"),
      hikerLabel: document.querySelector("#hikerLabel"),
      hikerHeadline: document.querySelector("#hikerHeadline"),
      hikerNarrativeWrap: document.querySelector("#hikerNarrativeWrap"),
      hikerNarrative: document.querySelector("#hikerNarrative"),
      hikerNarrativeToggle: document.querySelector("#hikerNarrativeToggle"),
      localSpread: document.querySelector("#localSpread"),
      mitchellDrop: document.querySelector("#mitchellDrop"),
      fogRisk: document.querySelector("#fogRisk"),
      inversionNotice: document.querySelector("#inversionNotice"),
      bestBet: document.querySelector("#bestBet"),
      useCare: document.querySelector("#useCare"),
      packMindset: document.querySelector("#packMindset"),
      elevationProfile: document.querySelector("#elevationProfile"),
      comparisonGrid: document.querySelector("#comparisonGrid"),
      hikerDataGrid: document.querySelector("#hikerDataGrid"),
      stationGrid: document.querySelector("#stationGrid"),
      updatedAt: document.querySelector("#updatedAt"),
      mountainViewsUpdated: document.querySelector("#mountainViewsUpdated"),
      mitchellCamImage: document.querySelector("#mitchellCamImage"),
      pisgahInnImage: document.querySelector("#pisgahInnImage"),
      grasslandCamImage: document.querySelector("#grasslandCamImage"),
      maxPatchCamImage: document.querySelector("#maxPatchCamImage"),
      fairviewCamImage: document.querySelector("#fairviewCamImage")
    };

    const MITCHELL_CAM_URL = "https://nchighpeaks.org/cam11/up/image.jpg";
    const PISGAH_CAM_URL = "https://streamer5.brownrice.com/cam-images/pisgahinn1.jpg";
    const GRASSLAND_CAM_URL = "https://cameraftpapi.drivehq.com/api/Camera/GetCameraThumbnail.ashx?parentID=361818469&shareID=17333090";
    const MAX_PATCH_CAM_URL = "https://assets2.webcam.io/w/9W1ZRz/latest.jpg";
    const FAIRVIEW_CAM_URL = "https://images.ambientweather.net/308398A68945/latest.jpg";
    const HIKING_GUIDANCE_RAW_URL = "https://raw.githubusercontent.com/Irisheagle76/828-weather-direct/main/public/data/hiking-guidance.json";
    const NARRATIVE_PREVIEW_CHARS = 200;
    let isNarrativeExpanded = false;
    let fullNarrative = "";

    function round(value) {
      return Number.isFinite(value) ? Math.round(value) : "--";
    }

    function temp(value) {
      return Number.isFinite(value) ? `${Math.round(value)}\u00b0` : "--";
    }

    function cleanText(value) {
      return String(value || "").replace(/degF/g, "\u00b0F");
    }

    function previewText(value, maxChars = NARRATIVE_PREVIEW_CHARS) {
      const text = cleanText(value).trim();
      if (text.length <= maxChars) return text;
      const clipped = text.slice(0, maxChars).replace(/\s+\S*$/, "").trim();
      return clipped || text.slice(0, maxChars).trim();
    }

    function renderNarrative(value) {
      fullNarrative = cleanText(value || "The latest elevation-aware hiking read will appear here.").trim();
      const shouldCollapse = fullNarrative.length > NARRATIVE_PREVIEW_CHARS;
      const visibleText = isNarrativeExpanded || !shouldCollapse
        ? fullNarrative
        : previewText(fullNarrative);

      els.hikerNarrative.textContent = visibleText;
      els.hikerNarrativeWrap?.classList.toggle("is-collapsed", shouldCollapse && !isNarrativeExpanded);
      els.hikerNarrativeWrap?.classList.toggle("is-expanded", shouldCollapse && isNarrativeExpanded);

      if (els.hikerNarrativeToggle) {
        els.hikerNarrativeToggle.hidden = !shouldCollapse;
        els.hikerNarrativeToggle.textContent = isNarrativeExpanded ? "Show less" : "Click for more";
        els.hikerNarrativeToggle.setAttribute("aria-expanded", String(isNarrativeExpanded));
      }
    }

    function scoreFromGuidance(guidance = {}) {
      if (Number.isFinite(guidance.hikerScore)) return guidance.hikerScore;
      return "--";
    }

    function labelFromScore(score) {
      if (!Number.isFinite(score)) return "Loading";
      if (score >= 86) return "Great";
      if (score >= 70) return "Good";
      if (score >= 56) return "Mixed";
      return "Use care";
    }

    function formatUpdate(value) {
      const ts = new Date(value).getTime();
      if (!Number.isFinite(ts)) return "Latest hiking data";
      return `Updated ${new Date(ts).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York"
      })}`;
    }

    function formatCameraRefresh() {
      return `Views refreshed ${new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York"
      })}`;
    }

    function refreshMountainViews() {
      if (els.mitchellCamImage) {
        els.mitchellCamImage.src = `${MITCHELL_CAM_URL}?t=${Date.now()}`;
      }
      if (els.pisgahInnImage) {
        els.pisgahInnImage.src = `${PISGAH_CAM_URL}?t=${Date.now()}`;
      }
      if (els.grasslandCamImage) {
        els.grasslandCamImage.src = `${GRASSLAND_CAM_URL}&t=${Date.now()}`;
      }
      if (els.maxPatchCamImage) {
        els.maxPatchCamImage.src = `${MAX_PATCH_CAM_URL}?t=${Date.now()}`;
      }
      if (els.fairviewCamImage) {
        els.fairviewCamImage.src = `${FAIRVIEW_CAM_URL}?t=${Date.now()}`;
      }
      if (els.mountainViewsUpdated) {
        els.mountainViewsUpdated.textContent = formatCameraRefresh();
      }
    }

    function shortName(name = "") {
      return String(name)
        .replace("High Asheville East", "High East")
        .replace("High Asheville North", "High North")
        .replace("Frying Pan / Pisgah Ridgeline", "Pisgah Ridge")
        .replace("Mount Mitchell", "Mitchell");
    }

    function profileNameLines(name = "") {
      const label = String(name || "");
      const labels = {
        "Lower Asheville": ["Lower"],
        "Mid Asheville": ["Mid"],
        "High Asheville East": ["High E"],
        "High Asheville North": ["High N"],
        "Waynesville / Haywood Valley": ["Waynesville"],
        "Black Mountain / Swannanoa Valley": ["Black Mtn"],
        "Southern Haywood / Pisgah Approach West": ["Pisgah W"],
        "Southern Haywood / Pisgah Approach East": ["Pisgah E"],
        "Mount Mitchell East Slope / Alpine Village": ["Mitchell E"],
        "Western Pisgah High Shoulder": ["W Pisgah"],
        "Barnardsville / Craggy North Flank": ["Craggy N"],
        "Max Patch": ["Max Patch"],
        "Burnsville Northern High Country": ["Burnsville"],
        "Laurel Ridge / Craggy South Flank": ["Laurel"],
        "Mountain Air Ridge Composite": ["Mt Air"],
        "Frying Pan / Pisgah Ridgeline": ["Frying Pan"],
        "Mount Mitchell": ["Mitchell"]
      };
      return labels[label] || [label];
    }

    function temperatureClass(value) {
      const temperature = Number(value);
      if (!Number.isFinite(temperature)) return "temp-unknown";
      if (temperature >= 80) return "temp-hot";
      if (temperature >= 70) return "temp-warm";
      if (temperature >= 60) return "temp-mild";
      return "temp-cool";
    }

    function inversionSignal(stations = []) {
      const ordered = stations
        .filter((station) => Number.isFinite(Number(station.elevationFt)) && Number.isFinite(Number(station.temperatureF)))
        .slice()
        .sort((a, b) => Number(a.elevationFt) - Number(b.elevationFt));
      let strongest = null;
      for (let index = 1; index < ordered.length; index += 1) {
        const lower = ordered[index - 1];
        const upper = ordered[index];
        const elevationGain = Number(upper.elevationFt) - Number(lower.elevationFt);
        const temperatureRise = Number(upper.temperatureF) - Number(lower.temperatureF);
        if (elevationGain < 300 || temperatureRise < 1.5) continue;
        if (!strongest || temperatureRise / elevationGain > strongest.temperatureRise / strongest.elevationGain) {
          strongest = { lower, upper, elevationGain, temperatureRise };
        }
      }
      return strongest;
    }

    function renderInversionNotice(stations = []) {
      if (!els.inversionNotice) return;
      const signal = inversionSignal(stations);
      if (!signal) {
        els.inversionNotice.hidden = true;
        els.inversionNotice.textContent = "";
        return;
      }
      els.inversionNotice.hidden = false;
      els.inversionNotice.innerHTML = `<strong>Possible inversion in progress</strong><span>${cleanText(signal.upper.name)} is about ${round(signal.temperatureRise)}°F warmer than ${cleanText(signal.lower.name)} despite sitting ${round(signal.elevationGain)} ft higher. Temperatures may vary sharply between sheltered valleys and exposed ridges.</span>`;
    }

    function renderElevationProfile(stations = []) {
      const ordered = stations
        .slice()
        .sort((a, b) => (a.elevationFt || 0) - (b.elevationFt || 0));
      const xSlots = ordered.map((_, index) => 145 + index * (810 / Math.max(1, ordered.length - 1)));
      const bottom = 460;
      const top = 102;
      const minElev = 1000;
      const maxElev = 7000;
      const yForElevation = (elevation) => {
        const pct = Math.max(0, Math.min(1, ((elevation || minElev) - minElev) / (maxElev - minElev)));
        return Math.round(bottom - pct * (bottom - top));
      };

      const points = ordered.map((station, index) => ({
        station,
        x: xSlots[index] || (145 + index * 150),
        y: yForElevation(station.elevationFt)
      }));
      const ridge = points.map((point) => `${point.x} ${point.y}`).join(" L ");
      const area = `M ${ridge} L 1065 ${bottom} L 55 ${bottom} Z`;
      const ticks = [7000, 6000, 5000, 4000, 3000, 2000, 1000]
        .map((value) => {
          const y = yForElevation(value);
          return `<g><line class="profile-tick" x1="88" y1="${y}" x2="94" y2="${y}" /><text class="profile-tick-label" x="78" y="${y + 6}" text-anchor="end">${value.toLocaleString()}</text></g>`;
        })
        .join("");
      const labelLanes = [68, 104, 140, 176, 212, 248];
      const leftLabelLanes = [132, 170, 208, 246, 284, 322];
      const laneEnds = labelLanes.map(() => -Infinity);
      const leftLaneEnds = leftLabelLanes.map(() => -Infinity);
      const sites = points.map(({ station, x, y }) => {
        const labelLines = profileNameLines(station.name)
          .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : 24}">${line}</tspan>`)
          .join("");
        const labelWidth = Math.max(34, labelLines.replace(/<[^>]+>/g, "").length * 7.2);
        const isAxisZone = x < 330;
        const activeLanes = isAxisZone ? leftLaneEnds : laneEnds;
        let lane = activeLanes.findIndex((end) => end < x - labelWidth / 2 - 8);
        if (lane < 0) lane = activeLanes.indexOf(Math.min(...activeLanes));
        const labelY = (isAxisZone ? leftLabelLanes : labelLanes)[lane];
        activeLanes[lane] = x + labelWidth / 2;
        const elevationY = labelY + 24;
        return `
          <g class="profile-site">
            <line class="profile-stem" x1="${x}" y1="${y + 13}" x2="${x}" y2="${bottom}" />
            <line class="profile-label-stem" x1="${x}" y1="${Math.max(46, labelY + 8)}" x2="${x}" y2="${Math.max(46, y - 15)}" />
            <circle class="profile-dot" cx="${x}" cy="${y}" r="12" />
            <text class="profile-name" x="${x}" y="${labelY}" text-anchor="middle">${labelLines}</text>
            <text class="profile-elev" x="${x}" y="${elevationY}" text-anchor="middle">${station.elevationFt || "--"} ft</text>
            <circle class="profile-base-dot" cx="${x}" cy="${bottom}" r="5" />
            <text class="profile-bottom-temp ${temperatureClass(station.temperatureF)}" x="${x}" y="${bottom + 48}" text-anchor="middle">${temp(station.temperatureF)}</text>
          </g>
        `;
      }).join("");

      els.elevationProfile.innerHTML = `
        <svg viewBox="0 0 1080 560" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="profileFill" x1="0" x2="1" y1="1" y2="0">
              <stop offset="0%" stop-color="#5bd27c" />
              <stop offset="52%" stop-color="#4eb4c8" />
              <stop offset="100%" stop-color="#357cff" />
            </linearGradient>
          </defs>
          <rect class="profile-bg" x="0" y="0" width="1080" height="560" rx="22" />
          <text class="profile-axis-title" x="96" y="82">ELEVATION (FT)</text>
          <line class="profile-axis" x1="94" y1="${yForElevation(5000)}" x2="94" y2="${bottom}" />
          ${ticks}
          <path class="profile-area" d="${area}" />
          <path class="profile-forest" d="M55 ${bottom} C110 415 158 436 205 398 C246 370 282 420 330 382 C372 350 420 396 468 360 C514 324 556 384 604 334 C650 292 704 360 750 300 C796 238 840 330 886 248 C922 176 948 220 984 118 C1020 164 1046 166 1065 182 L1065 ${bottom} Z" />
          <path class="profile-ridge" d="M ${ridge}" />
          ${sites}
        </svg>
      `;
    }

    function renderStations(stations = []) {
      els.stationGrid.innerHTML = stations
        .slice()
        .sort((a, b) => (a.elevationFt || 0) - (b.elevationFt || 0))
        .map((station) => `
          <a class="station-card" href="${station.url || "#"}">
            <div class="station-top">
              <div>
                <strong>${station.name}</strong>
                <span>${station.elevationFt || "--"} ft &middot; ${station.source || "Station"}</span>
              </div>
              <div class="station-temp">${temp(station.temperatureF)}</div>
            </div>
            <div class="station-metrics">
              <div class="metric">Dew ${temp(station.dewPointF)}</div>
              <div class="metric">RH ${round(station.humidityPct)}%</div>
              <div class="metric">Wind ${round(station.windMph)} mph</div>
              <div class="metric">Gust ${Number.isFinite(station.gustMph) ? `${round(station.gustMph)} mph` : "n/a"}</div>
            </div>
          </a>
        `)
        .join("");
    }

    function formatDegrees(value) {
      return Number.isFinite(Number(value)) ? `${round(Number(value))}\u00b0F` : "--";
    }

    function formatMph(value) {
      return Number.isFinite(Number(value)) ? `${round(Number(value))} mph` : "--";
    }

    function renderInsightSections(guidance = {}) {
      const comparisons = [
        {
          title: "Mountain vs Asheville",
          body: `Mount Mitchell is about ${formatDegrees(guidance.mitchellDrop)} cooler than the Asheville-area readings.`
        },
        {
          title: "Ridge vs Valley",
          body: Number(guidance.highStationSpread) <= 2
            ? "High Asheville readings broadly agree, but exposed ridges can still change the feel."
            : `The two high Asheville readings differ by about ${formatDegrees(guidance.highStationSpread)}, so ridge exposure matters.`
        },
        {
          title: "Sun exposure",
          body: Number(guidance.maxUv) >= 6
            ? "Sun exposure is a bigger part of the hiking comfort story today."
            : "Sun exposure is manageable now, especially under canopy."
        },
        {
          title: "Wind check",
          body: Number(guidance.maxGust) >= 20
            ? `Peak gusts near ${formatMph(guidance.maxGust)} mean exposed ridges deserve a wind check.`
            : "Wind is light at the reporting sites, so comfort is mostly about sun, shade, and layers."
        }
      ];

      const dataCards = [
        {
          label: "Local spread",
          value: formatDegrees(guidance.localTempSpread),
          body: "Temperature range across the Asheville-area readings."
        },
        {
          label: "High split",
          value: formatDegrees(guidance.highStationSpread),
          body: "Difference between the two high Asheville readings."
        },
        {
          label: "Mitchell drop",
          value: formatDegrees(guidance.mitchellDrop),
          body: "Cooling from Asheville-area readings to Mount Mitchell."
        },
        {
          label: "Fog risk",
          value: guidance.fogRisk || "--",
          body: "Based on the tightest temperature/dew point spread."
        },
        {
          label: "Highest UV",
          value: Number.isFinite(Number(guidance.maxUv)) ? round(Number(guidance.maxUv)) : "--",
          body: "Peak UV reading or estimate from the reporting sites."
        },
        {
          label: "Peak gust",
          value: formatMph(guidance.maxGust),
          body: "Highest gust among the reporting sites."
        }
      ];

      els.comparisonGrid.innerHTML = comparisons.map((item) => `
        <article class="comparison-card">
          <strong>${item.title}</strong>
          <p>${cleanText(item.body)}</p>
        </article>
      `).join("");

      els.hikerDataGrid.innerHTML = dataCards.map((item) => `
        <article class="data-card">
          <span>${item.label}</span>
          <strong>${cleanText(String(item.value))}</strong>
          <p>${cleanText(item.body)}</p>
        </article>
      `).join("");
    }

    function render(data) {
      const guidance = data?.guidance || {};
      const stations = data?.stations || [];
      const score = scoreFromGuidance(guidance);

      els.hikerScore.textContent = score;
      els.hikerLabel.textContent = guidance.hikerScoreLabel || labelFromScore(score);
      els.hikerHeadline.textContent = cleanText(guidance.bestWindow || "Trail conditions are updating.");
      renderNarrative(guidance.hikerNarrative);
      els.localSpread.textContent = `${round(guidance.localTempSpread)}\u00b0`;
      els.mitchellDrop.textContent = `${round(guidance.mitchellDrop)}\u00b0`;
      els.fogRisk.textContent = guidance.fogRisk || "--";
      els.bestBet.textContent = cleanText(guidance.overall || "Most nearby trails should feel comfortable.");
      els.useCare.textContent = guidance.fogRisk === "Elevated"
        ? "Watch for damp leaves, sheltered low cloud, and slick shaded stretches."
        : "Typical mountain exposure: changing clouds, damp pockets, and breezy gaps.";
      els.packMindset.textContent = Number(guidance.mitchellDrop) >= 10
        ? "Bring a layer for high peaks and keep water handy for lower trails."
        : "Water, basic sun protection, and normal mountain layers.";
      els.updatedAt.textContent = formatUpdate(data?.generatedAt);

      renderElevationProfile(stations);
      renderInversionNotice(stations);
      renderInsightSections(guidance);
      renderStations(stations);
    }

    async function loadHiking() {
      try {
        const productionHost = location.hostname === "avlweather.com" || location.hostname.endsWith(".vercel.app");
        const source = productionHost ? HIKING_GUIDANCE_RAW_URL : "data/hiking-guidance.json";
        const res = await fetch(`${source}?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Hiking data unavailable");
        render(await res.json());
      } catch (error) {
        console.warn("Hiking guidance unavailable", error);
      }
    }

    els.hikerNarrativeToggle?.addEventListener("click", () => {
      isNarrativeExpanded = !isNarrativeExpanded;
      renderNarrative(fullNarrative);
    });

    await loadHiking();
    refreshMountainViews();
    window.setInterval(refreshMountainViews, 3 * 60 * 1000);
  
