const NCAR_ORIGIN = "https://weather.rap.ucar.edu";
export const NCAR_PAGE_URL = `${NCAR_ORIGIN}/satellite/displaySat.php?region=CLT&itype=color&duration=2`;

// Fixed pixel calibration for the NCAR CLT sector (canonical 1220 x 1346).
// Asheville is near 506,622. These centerlines follow the greater French
// Broad valley and its eastward Swannanoa branch. Coordinates scale with the
// image so the mask remains stable if NCAR changes output dimensions.
export const VALLEY_MASK = {
  canonicalWidth: 1220,
  canonicalHeight: 1346,
  asheville: [506, 622],
  frenchBroad: [[491, 660], [497, 646], [501, 634], [506, 622], [502, 609], [497, 596], [491, 583]],
  swannanoa: [[506, 622], [515, 622], [525, 620], [535, 617], [544, 613]],
  radius: 8,
  flankOffset: 18,
  localBounds: [462, 565, 565, 681]
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export function parseVisibleImages(html = "") {
  const matches = [...String(html).matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)];
  const urls = matches.flatMap((match) => {
    const imageUrl = new URL(match[1], NCAR_PAGE_URL);
    const valid = imageUrl.origin === NCAR_ORIGIN && /^\/data\/satellite\/\d{8}\/CLT\/color\/\d{8}_\d{6}_CLT\.jpg$/i.test(imageUrl.pathname);
    return valid ? [imageUrl.href] : [];
  });
  return [...new Set(urls)].sort((a, b) => Date.parse(getObservedAt(a) || 0) - Date.parse(getObservedAt(b) || 0));
}

export function parseVisibleImage(html = "") {
  return parseVisibleImages(html).at(-1) || null;
}

export function getObservedAt(imageUrl = "") {
  const match = String(imageUrl).match(/\/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_CLT\.jpg$/i);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second)).toISOString();
}

function scaledPoint([x, y], width, height) {
  return [x * width / VALLEY_MASK.canonicalWidth, y * height / VALLEY_MASK.canonicalHeight];
}

function pointSegmentDistance(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  if (!dx && !dy) return Math.hypot(px - ax, py - ay);
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distanceToLine(x, y, points) {
  let distance = Infinity;
  for (let index = 1; index < points.length; index += 1) distance = Math.min(distance, pointSegmentDistance(x, y, points[index - 1], points[index]));
  return distance;
}

function offsetPoints(points, xOffset, yOffset) {
  return points.map(([x, y]) => [x + xOffset, y + yOffset]);
}

function pixelValue(data, width, x, y) {
  const index = (y * width + x) * 4;
  const r = data[index], g = data[index + 1], b = data[index + 2];
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  return { luminance, saturation };
}

function sampleLine(frame, canonicalPoints, canonicalRadius) {
  const { width, height, data } = frame;
  const points = canonicalPoints.map((point) => scaledPoint(point, width, height));
  const radius = canonicalRadius * Math.min(width / VALLEY_MASK.canonicalWidth, height / VALLEY_MASK.canonicalHeight);
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  const bounds = [Math.floor(Math.min(...xs) - radius), Math.ceil(Math.max(...xs) + radius), Math.floor(Math.min(...ys) - radius), Math.ceil(Math.max(...ys) + radius)];
  const samples = [];
  for (let y = bounds[2]; y <= bounds[3]; y += 2) for (let x = bounds[0]; x <= bounds[1]; x += 2) {
    if (x < 0 || y < 0 || x >= width || y >= height || distanceToLine(x, y, points) > radius) continue;
    const value = pixelValue(data, width, x, y);
    if (value.luminance > 0.08 && value.saturation < 0.42) samples.push(value.luminance);
  }
  return samples;
}

function sampleBounds(frame) {
  const { width, height, data } = frame;
  const [left, right, top, bottom] = VALLEY_MASK.localBounds;
  const x1 = Math.floor(left * width / VALLEY_MASK.canonicalWidth), x2 = Math.ceil(right * width / VALLEY_MASK.canonicalWidth);
  const y1 = Math.floor(top * height / VALLEY_MASK.canonicalHeight), y2 = Math.ceil(bottom * height / VALLEY_MASK.canonicalHeight);
  const samples = [];
  for (let y = y1; y <= y2; y += 2) for (let x = x1; x <= x2; x += 2) {
    const value = pixelValue(data, width, x, y);
    if (value.luminance > 0.08 && value.saturation < 0.42) samples.push(value.luminance);
  }
  return samples;
}

function corridorScore(values, flankValues) {
  const mean = average(values), flankMean = average(flankValues);
  const reflective = clamp((mean - 0.25) / 0.2);
  const brightShare = values.filter((value) => value >= 0.36).length / Math.max(1, values.length);
  const contrast = clamp((mean - flankMean) / 0.1);
  return { mean, flankMean, brightShare, contrast, score: clamp(reflective * 0.25 + brightShare * 0.15 + contrast * 0.6) };
}

export function analyzeVisibleSatelliteFrame(frame, { observedAt = null, now = Date.now(), previous = null } = {}) {
  const frenchBroad = VALLEY_MASK.frenchBroad;
  const swannanoa = VALLEY_MASK.swannanoa;
  const offset = VALLEY_MASK.flankOffset;
  const frenchSamples = sampleLine(frame, frenchBroad, VALLEY_MASK.radius);
  const frenchFlanks = [sampleLine(frame, offsetPoints(frenchBroad, -offset, 0), VALLEY_MASK.radius), sampleLine(frame, offsetPoints(frenchBroad, offset, 0), VALLEY_MASK.radius)].flat();
  const swannanoaSamples = sampleLine(frame, swannanoa, VALLEY_MASK.radius);
  const swannanoaFlanks = [sampleLine(frame, offsetPoints(swannanoa, 0, -offset), VALLEY_MASK.radius), sampleLine(frame, offsetPoints(swannanoa, 0, offset), VALLEY_MASK.radius)].flat();
  const localSamples = sampleBounds(frame);
  const french = corridorScore(frenchSamples, frenchFlanks);
  const swannanoaRead = corridorScore(swannanoaSamples, swannanoaFlanks);
  const branchSupport = Math.min(french.score, swannanoaRead.score);
  const valleyFogScore = clamp(Math.max(french.score, swannanoaRead.score) * 0.55 + branchSupport * 0.35 + Math.min(french.contrast, swannanoaRead.contrast) * 0.1);
  const localMean = average(localSamples);
  const localBrightShare = localSamples.filter((value) => value >= 0.39).length / Math.max(1, localSamples.length);
  const localSpread = Math.sqrt(average(localSamples.map((value) => (value - localMean) ** 2)));
  const corridorContrast = Math.max(french.mean - french.flankMean, swannanoaRead.mean - swannanoaRead.flankMean);
  const broadLowCloudScore = clamp(((localBrightShare - 0.42) / 0.45) * 0.7 + ((0.12 - localSpread) / 0.12) * 0.3) * clamp(1 - Math.max(0, corridorContrast) / 0.12);
  const ageMinutes = observedAt ? Math.max(0, (now - Date.parse(observedAt)) / 60000) : null;
  const fresh = ageMinutes == null || ageMinutes <= 20;
  const quality = !fresh ? "stale" : localMean < 0.12 ? "night" : "good";
  let trend = "unknown";
  if (previous?.valleyFogScore != null) {
    const change = valleyFogScore - previous.valleyFogScore;
    trend = change <= -0.07 ? "dissipating" : change >= 0.07 ? "expanding" : "little_change";
  }
  const recentPeak = Math.max(valleyFogScore, previous?.valleyFogScore || 0);
  // A thinning valley deck becomes only subtly brighter than the surrounding
  // ridges, so preserve a cautious "possible" signal at lower scores. Surface
  // observations and cameras decide whether that signal can be promoted.
  const valleyPattern = recentPeak >= 0.52 && valleyFogScore >= 0.25 ? "likely" : valleyFogScore >= 0.12 ? "possible" : "none";
  const broadDeck = broadLowCloudScore >= 0.62 ? "likely" : broadLowCloudScore >= 0.38 ? "possible" : "none";
  const confidence = quality === "good" ? clamp(0.48 + Math.max(valleyFogScore, broadLowCloudScore) * 0.45) : 0;
  return {
    source: "ncar-clt-visible", observedAt, ageMinutes: ageMinutes == null ? null : +ageMinutes.toFixed(1), quality,
    valleyPattern, valleyFogScore: +valleyFogScore.toFixed(2), broadDeck, broadLowCloudScore: +broadLowCloudScore.toFixed(2),
    trend, confidence: +confidence.toFixed(2), localCloudFraction: +localBrightShare.toFixed(2),
    corridors: {
      frenchBroad: { score: +french.score.toFixed(2), reflectance: +french.mean.toFixed(3), ridgeContrast: +(french.mean - french.flankMean).toFixed(3) },
      swannanoa: { score: +swannanoaRead.score.toFixed(2), reflectance: +swannanoaRead.mean.toFixed(3), ridgeContrast: +(swannanoaRead.mean - swannanoaRead.flankMean).toFixed(3) }
    }
  };
}

export function buildVisibleSatelliteObservation(analysis) {
  const usable = analysis?.quality === "good";
  return {
    kind: "satellite", source: "ncar-visible-satellite", timestamp: analysis?.observedAt || null,
    available: usable, quality: analysis?.quality || "unavailable", qualityScore: usable ? 0.88 : 0,
    confidence: analysis?.confidence || 0, coverageFraction: analysis?.localCloudFraction ?? null,
    cloudTypes: [], texture: analysis?.broadDeck !== "none" ? ["flat", "layered"] : [],
    sunVisibility: analysis?.broadDeck === "likely" ? "mostly_hidden" : "uncertain",
    ridgeVisibility: "unknown", valleyVisibility: analysis?.valleyPattern !== "none" ? "poor" : "unknown",
    undercast: analysis?.valleyPattern === "likely" ? "possible" : "none",
    satelliteLowCloud: analysis
  };
}

async function fetchImage(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { Accept: "image/jpeg,image/*", "User-Agent": "828 Weather Direct visible-satellite analyzer/1.0" } });
  if (!response.ok) throw new Error(`NCAR visible image returned ${response.status}`);
  const { default: jpeg } = await import("jpeg-js");
  return jpeg.decode(Buffer.from(await response.arrayBuffer()), { useTArray: true });
}

export async function fetchVisibleSatelliteSignal({ fetchImpl = fetch, now = Date.now() } = {}) {
  const page = await fetchImpl(NCAR_PAGE_URL, { headers: { Accept: "text/html", "User-Agent": "828 Weather Direct visible-satellite analyzer/1.0" } });
  if (!page.ok) throw new Error(`NCAR satellite page returned ${page.status}`);
  const images = parseVisibleImages(await page.text());
  if (!images.length) throw new Error("No NCAR CLT visible-satellite image was found");
  const latestUrl = images.at(-1);
  const latestAt = Date.parse(getObservedAt(latestUrl) || 0);
  const priorUrl = [...images].reverse().find((url) => latestAt - Date.parse(getObservedAt(url) || 0) >= 25 * 60000) || null;
  const [latestFrame, priorFrame] = await Promise.all([fetchImage(latestUrl, fetchImpl), priorUrl ? fetchImage(priorUrl, fetchImpl) : null]);
  const priorAnalysis = priorFrame ? analyzeVisibleSatelliteFrame(priorFrame, { observedAt: getObservedAt(priorUrl), now }) : null;
  const analysis = analyzeVisibleSatelliteFrame(latestFrame, { observedAt: getObservedAt(latestUrl), now, previous: priorAnalysis });
  return { image: latestUrl, previousImage: priorUrl, observedAt: getObservedAt(latestUrl), analysis, observation: buildVisibleSatelliteObservation(analysis) };
}
