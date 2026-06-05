import { GifReader } from "omggif";

const CACHE_MS = 45 * 60 * 1000;
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
    columns: { start: 180, endPad: 80, step: 22 }
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
    columns: { start: 180, endPad: 80, step: 22 }
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

function ratingFor(score) {
  if (score >= 90) return "Exceptional";
  if (score >= 75) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  if (score >= 20) return "Poor";
  return "Very Poor";
}

function buildScores(metrics) {
  const cloudScore = 100 - (metrics.cloudCover ?? 60);
  const transparency = metrics.transparency ?? 55;
  const darkness = metrics.darkness ?? 45;
  const wind = metrics.windComfort ?? 70;
  const hazePenalty = ((metrics.humidityPenalty ?? 45) + (metrics.smokePenalty ?? 35)) / 2;
  const summitView = cloudScore * 0.55 + transparency * 0.3 + wind * 0.1 + (100 - hazePenalty) * 0.05;
  const sunriseSunset = cloudTextureScore(metrics.cloudCover) * 0.55 + transparency * 0.3 + wind * 0.15;
  const nightSky = cloudScore * 0.45 + transparency * 0.3 + darkness * 0.2 + wind * 0.05;
  const undercast = (
    (metrics.humidityPenalty ?? 45) * 0.35 +
    cloudScore * 0.25 +
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

function buildLanguage(site, scores, metrics, degraded = false) {
  const rating = ratingFor(scores.summitView);
  const cloud = Number.isFinite(metrics.cloudCover) ? Math.round(metrics.cloudCover) : null;
  const visibilityPhrase = scores.summitView >= 75
    ? "Strong summit-view signal if the chart verifies on arrival."
    : scores.summitView >= 60
      ? "Worth a look, but check the chart before making a special drive."
      : scores.summitView >= 40
        ? "Mixed view potential; clouds or haze may soften distant ridges."
        : "Not worth a special drive for long-range views right now.";
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
      : `${rating} summit-view signal for ${site.name}${cloud != null ? ` with about ${cloud}% cloud cover sampled` : ""}.`,
    bullets: [
      visibilityPhrase,
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

async function parseSite(site) {
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
  const scores = usable ? buildScores(metrics) : buildScores({});
  const language = buildLanguage(site, scores, metrics, !usable);

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
    status: usable ? "ok" : "degraded"
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
  const sites = await Promise.all(SITES.map(async (site) => {
    try {
      return await parseSite(site);
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

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=1800");
    return res.status(200).json(memoryCache.payload);
  } catch (error) {
    return res.status(200).json({
      updated: new Date().toISOString(),
      sites: SITES.map((site) => unavailableSite(site, error))
    });
  }
}
