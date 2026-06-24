import { GifReader } from "omggif";
import jpeg from "jpeg-js";
import https from "node:https";

const CACHE_MS = 10 * 60 * 1000;
const OBSERVATION_MAX_AGE_MS = 30 * 60 * 1000;
let memoryCache = null;

const SITES = [
  {
    id: "mitchell",
    name: "Mount Mitchell",
    elevationFt: 6684,
    chartUrl: "https://www.cleardarksky.com/c/MtMtchllNCcsk.gif",
    rows: {
      cloud: 85,
      transparency: 100,
      darkness: 145,
      humidity: 115,
      smoke: 130,
      wind: 175
    },
    columns: { start: 180, endPad: 80, step: 22 },
    camera: {
      url: "https://nchighpeaks.org/cam11/up/image.jpg",
      roi: { x0: 0.06, y0: 0.06, x1: 0.94, y1: 0.46 }
    }
  },
  {
    id: "pisgah",
    name: "Mount Pisgah",
    elevationFt: 5721,
    chartUrl: "https://www.cleardarksky.com/c/MtPisgah1NCcsk.gif",
    rows: {
      cloud: 85,
      transparency: 100,
      darkness: 130,
      humidity: 115,
      smoke: 115,
      wind: 175
    },
    columns: { start: 180, endPad: 80, step: 22 },
    camera: {
      url: "https://streamer5.brownrice.com/cam-images/pisgahinn1.jpg",
      roi: { x0: 0.04, y0: 0.05, x1: 0.96, y1: 0.72 }
    }
  },
  {
    id: "grassland",
    name: "Grassland Mountain Observatory",
    elevationFt: 4130,
    chartUrl: "https://www.cleardarksky.com/c/GssMtnObNCcsk.gif",
    rows: {
      cloud: 85,
      transparency: 100,
      darkness: 145,
      humidity: 115,
      smoke: 130,
      wind: 175
    },
    columns: { start: 180, endPad: 80, step: 22 },
    camera: {
      url: "https://cameraftpapi.drivehq.com/api/Camera/GetCameraThumbnail.ashx?parentID=361818469&shareID=17333090",
      roi: { x0: 0.04, y0: 0.05, x1: 0.96, y1: 0.70 }
    }
  },
  {
    id: "maxpatch",
    name: "Max Patch North",
    elevationFt: 4420,
    chartUrl: "https://www.cleardarksky.com/c/WntHwkObTNcsk.gif",
    rows: {
      cloud: 85,
      transparency: 100,
      darkness: 145,
      humidity: 115,
      smoke: 130,
      wind: 175
    },
    columns: { start: 180, endPad: 80, step: 22 },
    camera: {
      url: "https://assets2.webcam.io/w/9W1ZRz/latest.jpg",
      roi: { x0: 0.04, y0: 0.05, x1: 0.96, y1: 0.72 }
    }
  }
];

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function roundScore(value) {
  return Math.round(clamp(Number.isFinite(value) ? value : 0));
}

function average(values = []) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function brightness(pixel) {
  if (!pixel) return null;
  return (pixel.r + pixel.g + pixel.b) / 3 / 255;
}

function isBlack(pixel) {
  return pixel && pixel.r < 8 && pixel.g < 8 && pixel.b < 8;
}

function pixelAt(rgba, width, x, y) {
  const i = (y * width + x) * 4;
  return {
    r: rgba[i],
    g: rgba[i + 1],
    b: rgba[i + 2],
    a: rgba[i + 3]
  };
}

function rowSamples(rgba, width, height, site, rowKey) {
  const y = site.rows[rowKey];
  if (!Number.isFinite(y) || y < 0 || y >= height) return [];
  const { start, endPad, step } = site.columns;
  const end = Math.max(start, width - endPad);
  const samples = [];
  for (let x = start; x <= end; x += step) {
    const pixel = pixelAt(rgba, width, x, y);
    if (pixel.a > 0 && !isBlack(pixel)) samples.push(pixel);
  }
  return samples;
}

function estimateCloudCover(samples) {
  const values = samples.map((pixel) => {
    const b = brightness(pixel);
    if (!Number.isFinite(b)) return null;
    return clamp(b * 115 - 10);
  });
  return average(values);
}

function estimateTransparency(samples) {
  const values = samples.map((pixel) => {
    const b = brightness(pixel);
    if (!Number.isFinite(b)) return null;
    const blueBias = (pixel.b - Math.max(pixel.r, pixel.g)) / 255;
    return clamp(100 - b * 55 + blueBias * 30);
  });
  return average(values);
}

function estimateDarkness(samples) {
  const values = samples.map((pixel) => {
    const b = brightness(pixel);
    if (!Number.isFinite(b)) return null;
    return clamp(100 - b * 110);
  });
  return average(values);
}

function estimatePenalty(samples) {
  const values = samples.map((pixel) => {
    const b = brightness(pixel);
    if (!Number.isFinite(b)) return null;
    return clamp(b * 100);
  });
  return average(values);
}

function estimateWindComfort(samples) {
  const values = samples.map((pixel) => {
    const b = brightness(pixel);
    if (!Number.isFinite(b)) return null;
    return clamp(100 - b * 70);
  });
  return average(values);
}

function cloudTextureScore(cloudCover) {
  if (!Number.isFinite(cloudCover)) return 55;
  if (cloudCover >= 20 && cloudCover <= 50) return 95;
  if (cloudCover > 50 && cloudCover <= 70) return 78;
  if (cloudCover >= 8 && cloudCover < 20) return 68;
  if (cloudCover > 70 && cloudCover <= 85) return 48;
  if (cloudCover < 8) return 48;
  return 24;
}

function cloudViewScore(cloudCover) {
  if (!Number.isFinite(cloudCover)) return 58;
  if (cloudCover <= 20) return 96;
  if (cloudCover <= 45) return 88;
  if (cloudCover <= 65) return 72;
  if (cloudCover <= 82) return 66;
  if (cloudCover <= 94) return 58;
  return 34;
}

function ratingFor(score) {
  if (score >= 90) return "Exceptional";
  if (score >= 75) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  if (score >= 20) return "Poor";
  return "Very Poor";
}

function n(value) {
  const parsed = Number.parseFloat(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function easternWallClockAgeMs(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const observedWallClock = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] || 0)
  );
  const nowParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());
  const now = Object.fromEntries(nowParts.map((part) => [part.type, part.value]));
  const nowWallClock = Date.UTC(
    Number(now.year),
    Number(now.month) - 1,
    Number(now.day),
    Number(now.hour),
    Number(now.minute),
    Number(now.second)
  );
  return nowWallClock - observedWallClock;
}

async function fetchMitchellEconetObservation() {
  const response = await fetch("https://products.climate.ncsu.edu/oper/cardinal/scout/panels/php/ajax_currentConditions.php", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "828 Weather Direct sky index/1.0"
    },
    body: "station=MITC"
  });
  if (!response.ok) throw new Error(`MITC observation fetch failed: ${response.status}`);

  const data = await response.json();
  const latest = data?.latest;
  const ageMs = easternWallClockAgeMs(latest?.ob);
  if (!latest?.ob || !Number.isFinite(ageMs) || ageMs < -5 * 60 * 1000 || ageMs > OBSERVATION_MAX_AGE_MS) {
    throw new Error("MITC observation is stale or missing");
  }

  return {
    source: "NC ECONet MITC",
    sourceUrl: "https://econet.climate.ncsu.edu/m/?id=MITC",
    observedAt: latest.ob,
    ageMinutes: Math.max(0, Math.round(ageMs / 60000)),
    temperatureF: n(latest.air_temp),
    dewPointF: n(latest.dew),
    humidityPct: n(latest.rh),
    windMph: n(latest.wind_speed)
  };
}

async function fetchMitchellObservation() {
  return fetchMitchellEconetObservation();
}

function liveSignalFor(site, observations = {}) {
  if (site.id !== "mitchell") return null;
  const observation = observations.mitchell;
  if (!observation) return null;

  const dewSpread = observation.temperatureF != null && observation.dewPointF != null
    ? Math.abs(observation.temperatureF - observation.dewPointF)
    : null;
  const saturated = observation.humidityPct >= 98 || (dewSpread != null && dewSpread <= 2);

  if (!saturated) {
    return {
      type: "clear",
      observation,
      dewSpread
    };
  }

  return {
    type: "summit-fog",
    observation,
    dewSpread,
    summary: "Mount Mitchell's live station is saturated, which usually means fog, low cloud, or an inside-the-cloud summit view.",
    scoreCaps: {
      summitView: 22,
      sunriseSunset: 40,
      nightSky: 28,
      undercast: 62
    }
  };
}

function applyLiveSignal(scores, signal) {
  if (!signal) return scores;
  if (signal.type === "camera-usable" || signal.type === "camera-clear") {
    const clarityScore = signal.camera?.clarityScore;
    if (signal.camera?.condition !== "clear_view" || !Number.isFinite(clarityScore)) return scores;
    const liveViewFloor = roundScore(60 + clarityScore * 0.3);
    return {
      ...scores,
      summitView: Math.max(scores.summitView, liveViewFloor)
    };
  }
  if (signal.type === "camera-fog") {
    return {
      summitView: Math.min(scores.summitView, signal.scoreCaps.summitView),
      sunriseSunset: Math.min(scores.sunriseSunset, signal.scoreCaps.sunriseSunset),
      nightSky: Math.min(scores.nightSky, signal.scoreCaps.nightSky),
      undercast: Math.min(scores.undercast, signal.scoreCaps.undercast)
    };
  }
  if (signal.type === "camera-limited") {
    return {
      summitView: Math.min(scores.summitView, signal.scoreCaps.summitView),
      sunriseSunset: Math.min(scores.sunriseSunset, signal.scoreCaps.sunriseSunset),
      nightSky: Math.min(scores.nightSky, signal.scoreCaps.nightSky),
      undercast: scores.undercast
    };
  }
  if (signal.type !== "summit-fog") return scores;
  return {
    summitView: Math.min(scores.summitView, signal.scoreCaps.summitView),
    sunriseSunset: Math.min(scores.sunriseSunset, signal.scoreCaps.sunriseSunset),
    nightSky: Math.min(scores.nightSky, signal.scoreCaps.nightSky),
    undercast: Math.min(scores.undercast, signal.scoreCaps.undercast)
  };
}

async function fetchCameraObservation(site) {
  if (!site.camera?.url) return null;
  const url = site.camera.url.includes("?")
    ? `${site.camera.url}&t=${Date.now()}`
    : `${site.camera.url}?t=${Date.now()}`;
  const buffer = await fetchCameraBuffer(url, site.name);
  const decoded = jpeg.decode(buffer, { useTArray: true });
  const metrics = analyzeCameraFrame(decoded, site.camera.roi);
  return {
    url: site.camera.url,
    observedAt: new Date().toISOString(),
    width: decoded.width,
    height: decoded.height,
    ...metrics
  };
}

async function fetchCameraBuffer(url, siteName) {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "828 Weather Direct sky index/1.0",
        accept: "image/jpeg,image/*"
      }
    });
    if (!response.ok) throw new Error(`${siteName} camera fetch failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    const host = new URL(url).hostname;
    if (host !== "streamer5.brownrice.com") throw error;
    return fetchPublicCameraWithLooseCert(url, siteName);
  }
}

function fetchPublicCameraWithLooseCert(url, siteName) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      rejectUnauthorized: false,
      headers: {
        "user-agent": "828 Weather Direct sky index/1.0",
        accept: "image/jpeg,image/*"
      }
    }, (response) => {
      if ((response.statusCode ?? 0) < 200 || (response.statusCode ?? 0) >= 300) {
        response.resume();
        reject(new Error(`${siteName} camera fallback failed: ${response.statusCode}`));
        return;
      }
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks)));
    });
    request.on("error", reject);
    request.setTimeout(9000, () => {
      request.destroy(new Error(`${siteName} camera fetch timed out`));
    });
  });
}

function analyzeCameraFrame(image, roi = {}) {
  const { width, height, data } = image;
  const x0 = Math.max(0, Math.floor(width * (roi.x0 ?? 0)));
  const x1 = Math.min(width - 1, Math.ceil(width * (roi.x1 ?? 1)));
  const y0 = Math.max(0, Math.floor(height * (roi.y0 ?? 0)));
  const y1 = Math.min(height - 1, Math.ceil(height * (roi.y1 ?? 1)));
  const step = Math.max(3, Math.floor(Math.min(width, height) / 90));
  const brightnessValues = [];
  const saturationValues = [];
  const blueValues = [];
  const localDiffs = [];
  let grayPixels = 0;
  let darkPixels = 0;
  let sampleCount = 0;

  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const bright = (r + g + b) / 3 / 255;
      const sat = (max - min) / 255;
      brightnessValues.push(bright);
      saturationValues.push(sat);
      blueValues.push((b - Math.max(r, g)) / 255);
      if (sat < 0.08 && bright > 0.24 && bright < 0.88) grayPixels += 1;
      if (bright < 0.18) darkPixels += 1;

      const nx = Math.min(width - 1, x + step);
      const ni = (y * width + nx) * 4;
      const neighborBright = (data[ni] + data[ni + 1] + data[ni + 2]) / 3 / 255;
      localDiffs.push(Math.abs(bright - neighborBright));
      sampleCount += 1;
    }
  }

  const meanBrightness = average(brightnessValues) ?? 0;
  const meanSaturation = average(saturationValues) ?? 0;
  const meanBlueSignal = average(blueValues) ?? 0;
  const contrast = Math.sqrt(average(brightnessValues.map((value) => (value - meanBrightness) ** 2)) ?? 0);
  const localContrast = average(localDiffs) ?? 0;
  const grayShare = sampleCount ? grayPixels / sampleCount : 0;
  const darkShare = sampleCount ? darkPixels / sampleCount : 0;
  const clarityScore = roundScore(
    contrast * 260 +
    localContrast * 420 +
    meanSaturation * 180 +
    Math.max(0, meanBlueSignal) * 80 -
    grayShare * 35 -
    darkShare * 20
  );

  let condition = "usable";
  if ((contrast < 0.105 && meanSaturation < 0.135 && grayShare > 0.34) || clarityScore < 24) {
    condition = "fog_or_low_cloud";
  } else if (clarityScore < 50 || contrast < 0.12 || (meanSaturation < 0.12 && grayShare > 0.5)) {
    condition = "limited_visibility";
  } else if (clarityScore >= 62 && contrast >= 0.18) {
    condition = "clear_view";
  }

  return {
    condition,
    clarityScore,
    contrast: Number(contrast.toFixed(3)),
    localContrast: Number(localContrast.toFixed(3)),
    saturation: Number(meanSaturation.toFixed(3)),
    grayShare: Number(grayShare.toFixed(3)),
    darkShare: Number(darkShare.toFixed(3)),
    blueSignal: Number(meanBlueSignal.toFixed(3))
  };
}

function cameraSignalFor(site, observations = {}) {
  const camera = observations.cameras?.[site.id];
  if (!camera) {
    return {
      type: "camera-unavailable",
      camera,
      summary: `${site.name} camera check is unavailable, so the index is leaning on the sky chart.`
    };
  }

  if (camera.condition === "fog_or_low_cloud") {
    return {
      type: "camera-fog",
      camera,
      summary: `${site.name} camera shows fog, low cloud, or a washed-out view right now.`,
      scoreCaps: {
        summitView: 28,
        sunriseSunset: 42,
        nightSky: 32,
        undercast: 62
      }
    };
  }

  if (camera.condition === "limited_visibility") {
    return {
      type: "camera-limited",
      camera,
      summary: `${site.name} camera shows limited visibility, so the chart-based view score is capped.`,
      scoreCaps: {
        summitView: 58,
        sunriseSunset: 65,
        nightSky: 55
      }
    };
  }

  return {
    type: "camera-usable",
    camera,
    summary: `${site.name} camera check is usable and does not currently cap the chart-based score.`
  };
}

function mergeSignals(weatherSignal, cameraSignal) {
  if (weatherSignal?.type === "summit-fog") {
    if (cameraSignal?.type === "camera-usable" && cameraSignal.camera?.condition === "clear_view") {
      return {
        ...cameraSignal,
        type: "camera-clear",
        summary: "The live camera shows a clear long-range view, so it overrides the contradictory saturated-station fog signal."
      };
    }
    return weatherSignal;
  }
  if (cameraSignal?.type === "camera-fog" || cameraSignal?.type === "camera-limited") return cameraSignal;
  return cameraSignal || weatherSignal;
}

function buildScores(metrics) {
  const cloudScore = cloudViewScore(metrics.cloudCover);
  const clearSkyScore = 100 - (metrics.cloudCover ?? 60);
  const transparency = metrics.transparency ?? 55;
  const darkness = metrics.darkness ?? 45;
  const wind = metrics.windComfort ?? 70;
  const hazePenalty = ((metrics.humidityPenalty ?? 45) + (metrics.smokePenalty ?? 35)) / 2;
  const summitView = cloudScore * 0.35 + transparency * 0.35 + wind * 0.15 + (100 - hazePenalty) * 0.15;
  const sunriseSunset = cloudTextureScore(metrics.cloudCover) * 0.55 + transparency * 0.3 + wind * 0.15;
  const nightSky = clearSkyScore * 0.45 + transparency * 0.3 + darkness * 0.2 + wind * 0.05;
  const undercast = (
    (metrics.humidityPenalty ?? 45) * 0.35 +
    clearSkyScore * 0.25 +
    wind * 0.2 +
    transparency * 0.1 +
    cloudTextureScore(metrics.cloudCover) * 0.1
  );

  return {
    summitView: roundScore(summitView),
    sunriseSunset: roundScore(sunriseSunset),
    nightSky: roundScore(nightSky),
    undercast: roundScore(undercast)
  };
}

function buildLanguage(site, scores, metrics, degraded = false, liveSignal = null) {
  const rating = ratingFor(scores.summitView);
  const cloud = Number.isFinite(metrics.cloudCover) ? Math.round(metrics.cloudCover) : null;
  if (liveSignal?.type === "summit-fog") {
    const obs = liveSignal.observation;
    const humidity = Number.isFinite(obs.humidityPct) ? `${Math.round(obs.humidityPct)}% humidity` : "saturated air";
    const dewSpread = Number.isFinite(liveSignal.dewSpread) ? `temp/dew point spread near ${Math.round(liveSignal.dewSpread)}degF` : "temp and dew point nearly matched";
    return {
      rating,
      headline: `Poor live summit-view signal for ${site.name}: the summit station is reporting ${humidity} with ${dewSpread}.`,
      bullets: [
        "Live Mount Mitchell conditions are overriding the sky chart because the summit appears to be in fog or low cloud.",
        "Long-range views are unlikely until the camera and summit humidity improve.",
        "Undercast potential exists only if the summit breaks above the cloud deck."
      ],
      windows: [
        {
          label: "Now",
          score: scores.summitView,
          summary: "Use the live summit camera first; the current station signal says visibility is poor."
        }
      ]
    };
  }
  if (liveSignal?.type === "camera-fog") {
    return {
      rating,
      headline: `${rating} live summit-view signal for ${site.name}: the camera check shows fog, low cloud, or a washed-out view.`,
      bullets: [
        "The live camera is overriding the chart because current visibility looks poor.",
        "Long-range views are unlikely until the camera shows more ridge detail or blue-sky contrast.",
        "Use the source chart for later timing, but let the live image decide the current go/no-go."
      ],
      windows: [
        {
          label: "Now",
          score: scores.summitView,
          summary: "Current camera visibility is poor, so the live view score is capped."
        }
      ]
    };
  }
  if (liveSignal?.type === "camera-limited") {
    return {
      rating,
      headline: `${rating} summit-view signal for ${site.name}: the chart is decent, but the live camera is limiting confidence.`,
      bullets: [
        "The camera check is capping the current view score until visibility improves.",
        "Some ridge detail may be possible, but this is not a clean long-range view signal.",
        "Recheck the camera before making a special drive."
      ],
      windows: [
        {
          label: "Now",
          score: scores.summitView,
          summary: "Current camera visibility is limited; use the live image before heading up."
        }
      ]
    };
  }
  if (liveSignal?.type === "camera-clear") {
    return {
      rating,
      headline: `${rating} live summit-view signal for ${site.name}: the camera shows a clear long-range view despite saturated station air.`,
      bullets: [
        "The live camera is overriding the station fog signal because distant ridges and sky detail are clearly visible.",
        "The current view score is using the camera as a conservative floor while the source chart still guides later timing.",
        "Recheck the live image before departure because high-peak visibility can change quickly."
      ],
      windows: [
        {
          label: "Now",
          score: scores.summitView,
          summary: "The live camera currently supports a clear summit view."
        }
      ]
    };
  }

  const visibilityPhrase = scores.summitView >= 75
    ? "Strong summit-view signal if the chart verifies on arrival."
    : scores.summitView >= 60
      ? "Worth a look, but check the chart before making a special drive."
      : scores.summitView >= 40
        ? "Mixed view potential; live cameras may still show useful ridge detail between clouds."
        : "Low chart-based signal for long-range views; verify with the live cameras before deciding.";
  const cameraPhrase = liveSignal?.type === "camera-usable"
    ? "Live camera check is usable and is not capping the chart-based score."
    : liveSignal?.type === "camera-unavailable"
      ? "Live camera check is unavailable, so this remains a chart-based score until the image returns."
      : visibilityPhrase;
  const sunsetPhrase = scores.sunriseSunset >= scores.nightSky
    ? "Sunrise or sunset has the better viewing signal than stargazing."
    : "Night-sky potential is the stronger signal if clouds hold off.";
  const undercastPhrase = scores.undercast >= 70
    ? "Undercast potential is worth watching, but still not a promise."
    : scores.undercast >= 45
      ? "Undercast signal is possible but limited."
      : "Undercast signal is limited right now.";

  return {
    rating,
    headline: degraded
      ? `${site.name} sky chart is reachable, but the index is using a cautious fallback read.`
      : `${rating} summit-view signal for ${site.name}${cloud != null ? ` with about ${cloud}% cloud cover in the sky chart` : ""}.`,
    bullets: [
      cameraPhrase,
      sunsetPhrase,
      undercastPhrase
    ],
    windows: [
      {
        label: "Tonight",
        score: roundScore(Math.max(scores.nightSky, scores.sunriseSunset)),
        summary: scores.nightSky >= 70
          ? "Best window favors stars if cloud cover stays limited."
          : scores.sunriseSunset >= 65
            ? "Best window favors low-angle color more than stars."
            : "Best window is uncertain; use the live chart before heading up."
      }
    ]
  };
}

async function parseSite(site, observations = {}) {
  const response = await fetch(site.chartUrl, {
    headers: {
      "user-agent": "828 Weather Direct sky index/1.0"
    }
  });
  if (!response.ok) throw new Error(`Clear Dark Sky fetch failed: ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  const reader = new GifReader(buffer);
  const rgba = new Uint8Array(reader.width * reader.height * 4);
  reader.decodeAndBlitFrameRGBA(0, rgba);

  const metrics = {
    cloudCover: estimateCloudCover(rowSamples(rgba, reader.width, reader.height, site, "cloud")),
    transparency: estimateTransparency(rowSamples(rgba, reader.width, reader.height, site, "transparency")),
    darkness: estimateDarkness(rowSamples(rgba, reader.width, reader.height, site, "darkness")),
    humidityPenalty: estimatePenalty(rowSamples(rgba, reader.width, reader.height, site, "humidity")),
    smokePenalty: estimatePenalty(rowSamples(rgba, reader.width, reader.height, site, "smoke")),
    windComfort: estimateWindComfort(rowSamples(rgba, reader.width, reader.height, site, "wind"))
  };
  const usable = Object.values(metrics).filter(Number.isFinite).length >= 3;
  const rawScores = usable ? buildScores(metrics) : buildScores({});
  const weatherSignal = liveSignalFor(site, observations);
  const cameraSignal = cameraSignalFor(site, observations);
  const liveSignal = mergeSignals(weatherSignal, cameraSignal);
  const scores = applyLiveSignal(rawScores, liveSignal);
  const language = buildLanguage(site, scores, metrics, !usable, liveSignal);
  const status = liveSignal?.type === "summit-fog"
    ? "live-fog"
    : liveSignal?.type === "camera-fog"
      ? "camera-fog"
      : liveSignal?.type === "camera-limited"
        ? "camera-limited"
        : liveSignal?.type === "camera-unavailable"
          ? "camera-unavailable"
          : usable ? "ok" : "degraded";

  return {
    id: site.id,
    name: site.name,
    elevationFt: site.elevationFt,
    chartUrl: site.chartUrl,
    scores,
    rating: language.rating,
    headline: language.headline,
    bullets: language.bullets,
    windows: language.windows,
    status,
    stationObservation: site.id === "mitchell" && observations.mitchell
      ? {
          source: observations.mitchell.source,
          sourceUrl: observations.mitchell.sourceUrl,
          observedAt: observations.mitchell.observedAt,
          ageMinutes: observations.mitchell.ageMinutes,
          temperatureF: observations.mitchell.temperatureF,
          dewPointF: observations.mitchell.dewPointF,
          humidityPct: observations.mitchell.humidityPct,
          windMph: observations.mitchell.windMph
        }
      : null,
    cameraObservation: cameraSignal?.camera
      ? {
          condition: cameraSignal.camera.condition,
          clarityScore: cameraSignal.camera.clarityScore,
          contrast: cameraSignal.camera.contrast,
          saturation: cameraSignal.camera.saturation,
          grayShare: cameraSignal.camera.grayShare,
          observedAt: cameraSignal.camera.observedAt
        }
      : null,
    liveSignal: liveSignal?.type === "summit-fog"
      ? {
          type: liveSignal.type,
          summary: liveSignal.summary,
          observedAt: liveSignal.observation.observedAt,
          temperatureF: liveSignal.observation.temperatureF,
          dewPointF: liveSignal.observation.dewPointF,
          humidityPct: liveSignal.observation.humidityPct,
          source: liveSignal.observation.source,
          sourceUrl: liveSignal.observation.sourceUrl,
          ageMinutes: liveSignal.observation.ageMinutes
        }
      : liveSignal?.type === "camera-fog" || liveSignal?.type === "camera-limited"
        ? {
            type: liveSignal.type,
            summary: liveSignal.summary,
            observedAt: liveSignal.camera.observedAt,
            clarityScore: liveSignal.camera.clarityScore,
            condition: liveSignal.camera.condition
          }
      : undefined
  };
}

function unavailableSite(site, error) {
  const scores = { summitView: 0, sunriseSunset: 0, nightSky: 0, undercast: 0 };
  return {
    id: site.id,
    name: site.name,
    elevationFt: site.elevationFt,
    chartUrl: site.chartUrl,
    scores,
    rating: "Very Poor",
    headline: "Sky index unavailable right now.",
    bullets: [
      "The Clear Dark Sky chart link is still available.",
      "Use this as a source link until the index refreshes.",
      "This guidance should not replace checking conditions before driving up."
    ],
    windows: [
      {
        label: "Chart",
        score: 0,
        summary: "Open the source chart for the latest viewing guidance."
      }
    ],
    status: "unavailable",
    error: error?.message || "Unavailable"
  };
}

async function buildPayload() {
  const observations = {};
  try {
    observations.mitchell = await fetchMitchellObservation();
  } catch {
    observations.mitchell = null;
  }
  observations.cameras = Object.fromEntries(await Promise.all(SITES.map(async (site) => {
    try {
      return [site.id, await fetchCameraObservation(site)];
    } catch {
      return [site.id, null];
    }
  })));

  const sites = await Promise.all(SITES.map(async (site) => {
    try {
      return await parseSite(site, observations);
    } catch (error) {
      return unavailableSite(site, error);
    }
  }));

  return {
    updated: new Date().toISOString(),
    sites
  };
}

export default async function handler(req, res) {
  try {
    const now = Date.now();
    if (!memoryCache || now - memoryCache.timestamp > CACHE_MS) {
      memoryCache = {
        timestamp: now,
        payload: await buildPayload()
      };
    }

    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=600");
    return res.status(200).json(memoryCache.payload);
  } catch (error) {
    return res.status(200).json({
      updated: new Date().toISOString(),
      sites: SITES.map((site) => unavailableSite(site, error))
    });
  }
}
