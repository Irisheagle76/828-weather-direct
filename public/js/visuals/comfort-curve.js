import { calculateComfort, FEELSCORE_CALIBRATION } from "../intel/comfort.js";

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_HOURS = 18;

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function scoreHour(hour) {
  const raw = calculateComfort(hour)?.score;
  if (!Number.isFinite(raw)) return null;
  return Math.round(raw <= 10 ? raw * 10 : raw);
}

function timestampOf(hour = {}) {
  const value = hour.timestamp ?? hour.time ?? hour.ts;
  if (Number.isFinite(value)) return value < 1e12 ? value * 1000 : value;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function localDateKey(timestamp) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/New_York"
  }).format(new Date(timestamp));
}

function localHour(timestamp) {
  return Number(new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: "America/New_York"
  }).format(new Date(timestamp))) % 24;
}

function dailyBounds(timestamp, daily = []) {
  const key = localDateKey(timestamp);
  const day = daily.find((item) => {
    const value = item?.timestamp ?? item?.time ?? item?.date;
    const parsed = Number.isFinite(value) ? value : new Date(value).getTime();
    return Number.isFinite(parsed) && localDateKey(parsed) === key;
  });
  return {
    sunrise: timestampOf({ timestamp: day?.sunrise }),
    sunset: timestampOf({ timestamp: day?.sunset })
  };
}

function isNight(timestamp, daily = []) {
  const { sunrise, sunset } = dailyBounds(timestamp, daily);
  if (Number.isFinite(sunrise) && Number.isFinite(sunset)) {
    return timestamp < sunrise || timestamp >= sunset;
  }
  const hour = localHour(timestamp);
  return hour < 6 || hour >= 20;
}

function formatHour(timestamp) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    timeZone: "America/New_York"
  }).format(new Date(timestamp));
}

function formatRange(start, end) {
  return `${formatHour(start)}–${formatHour(end)}`;
}

function labelForScore(score) {
  const bands = FEELSCORE_CALIBRATION.scoreBands;
  if (score >= bands.ideal) return "Excellent";
  if (score >= bands.pleasant) return "Pleasant";
  if (score >= bands.noticeable) return "Noticeable";
  return "Challenging";
}

function trendFor(points) {
  if (points.length < 2) return { direction: "steady", label: "Holding steady", delta: 0 };
  const start = points.slice(0, Math.min(3, points.length));
  const end = points.slice(-Math.min(3, points.length));
  const average = (items) => items.reduce((sum, point) => sum + point.score, 0) / items.length;
  const delta = Math.round(average(end) - average(start));
  if (delta >= 5) return { direction: "rising", label: "Feeling better", delta };
  if (delta <= -5) return { direction: "falling", label: "Comfort easing", delta };
  return { direction: "steady", label: "Holding steady", delta };
}

function bestWindow(points, size = 3) {
  if (!points.length) return null;
  const windowSize = Math.min(size, points.length);
  let best = null;

  for (let index = 0; index <= points.length - windowSize; index += 1) {
    const slice = points.slice(index, index + windowSize);
    const consecutive = slice.every((point, pointIndex) => (
      pointIndex === 0 || point.timestamp - slice[pointIndex - 1].timestamp <= 90 * 60 * 1000
    ));
    if (!consecutive) continue;
    const average = slice.reduce((sum, point) => sum + point.score, 0) / slice.length;
    const peak = Math.max(...slice.map((point) => point.score));
    if (!best || average > best.average) {
      best = {
        start: slice[0].timestamp,
        end: slice.at(-1).timestamp,
        average,
        peak,
        pointIndex: index + slice.findIndex((point) => point.score === peak)
      };
    }
  }
  return best;
}

export function buildComfortCurveModel({
  hourly = [],
  daily = [],
  currentHour = null,
  now = Date.now(),
  hours = DEFAULT_HOURS,
  score = scoreHour
} = {}) {
  const end = now + Math.max(12, Math.min(24, hours)) * HOUR_MS;
  const candidates = [
    ...(currentHour ? [{ hour: currentHour, isCurrent: true }] : []),
    ...hourly.filter(Boolean).map((hour) => ({ hour, isCurrent: false }))
  ]
    .map(({ hour, isCurrent }) => ({ hour, isCurrent, timestamp: timestampOf(hour) }))
    .filter(({ hour, timestamp }) => (
      Number.isFinite(timestamp) &&
      timestamp >= now - 45 * 60 * 1000 &&
      timestamp <= end &&
      finite(hour.temperatureF ?? hour.temp) != null
    ))
    .sort((a, b) => a.timestamp - b.timestamp);

  const points = [];
  for (const candidate of candidates) {
    const pointScore = score(candidate.hour);
    if (!Number.isFinite(pointScore)) continue;
    const previous = points.at(-1);
    const point = {
      timestamp: candidate.timestamp,
      score: Math.max(0, Math.min(100, Math.round(pointScore))),
      temperatureF: finite(candidate.hour.temperatureF ?? candidate.hour.temp),
      night: isNight(candidate.timestamp, daily),
      isCurrent: candidate.isCurrent
    };
    if (previous && Math.abs(previous.timestamp - candidate.timestamp) < 20 * 60 * 1000) {
      if (candidate.isCurrent && !previous.isCurrent) points[points.length - 1] = point;
      continue;
    }
    points.push(point);
  }

  if (points.length < 2) return null;
  const scores = points.map((point) => point.score);
  const currentIndex = points.reduce((best, point, index) => (
    Math.abs(point.timestamp - now) < Math.abs(points[best].timestamp - now) ? index : best
  ), 0);
  const best = bestWindow(points);

  return {
    points,
    currentIndex,
    current: points[currentIndex],
    best,
    bestLabel: best ? formatRange(best.start, best.end) : null,
    minimum: Math.min(...scores),
    maximum: Math.max(...scores),
    trend: trendFor(points),
    accessibleSummary: points
      .map((point, index) => `${index === currentIndex ? "Now, " : ""}${formatHour(point.timestamp)}: FeelScore ${point.score}, ${labelForScore(point.score)}`)
      .join(". ")
  };
}

function smoothPath(points) {
  if (points.length < 2) return "";
  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midpoint = (previous.x + current.x) / 2;
    path += ` C ${midpoint.toFixed(1)} ${previous.y.toFixed(1)}, ${midpoint.toFixed(1)} ${current.y.toFixed(1)}, ${current.x.toFixed(1)} ${current.y.toFixed(1)}`;
  }
  return path;
}

function nightBands(points, xFor, plotTop, plotHeight) {
  const bands = [];
  let start = null;
  points.forEach((point, index) => {
    if (point.night && start == null) start = index;
    const closes = start != null && (!point.night || index === points.length - 1);
    if (!closes) return;
    const endIndex = point.night && index === points.length - 1 ? index : index - 1;
    const left = start === 0 ? xFor(points[start].timestamp) : (xFor(points[start - 1].timestamp) + xFor(points[start].timestamp)) / 2;
    const right = endIndex === points.length - 1 ? xFor(points[endIndex].timestamp) : (xFor(points[endIndex].timestamp) + xFor(points[endIndex + 1].timestamp)) / 2;
    bands.push(`<rect class="comfort-curve-night" x="${left.toFixed(1)}" y="${plotTop}" width="${Math.max(0, right - left).toFixed(1)}" height="${plotHeight}" rx="8" />`);
    start = null;
  });
  return bands.join("");
}

function chartMarkup(model) {
  const width = 680;
  const height = 270;
  const left = 42;
  const right = 18;
  const top = 24;
  const bottom = 48;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const firstTime = model.points[0].timestamp;
  const lastTime = model.points.at(-1).timestamp;
  const span = Math.max(HOUR_MS, lastTime - firstTime);
  const xFor = (timestamp) => left + ((timestamp - firstTime) / span) * plotWidth;
  const yFor = (score) => top + ((100 - score) / 70) * plotHeight;
  const chartPoints = model.points.map((point) => ({ ...point, x: xFor(point.timestamp), y: yFor(point.score) }));
  const path = smoothPath(chartPoints);
  const bestPoint = chartPoints[model.best?.pointIndex ?? 0];
  const currentPoint = chartPoints[model.currentIndex];
  const labelEvery = model.points.length > 14 ? 4 : 2;
  const labelIndexes = [];
  chartPoints.forEach((point, index) => {
    const isCandidate = index === 0 || index === chartPoints.length - 1 || index % labelEvery === 0;
    if (!isCandidate) return;
    const previousIndex = labelIndexes.at(-1);
    if (previousIndex != null && point.x - chartPoints[previousIndex].x < 70) {
      if (index === chartPoints.length - 1 && labelIndexes.length > 1) labelIndexes[labelIndexes.length - 1] = index;
      return;
    }
    labelIndexes.push(index);
  });
  const timeLabels = chartPoints.map((point, index) => {
    if (!labelIndexes.includes(index)) return "";
    return `<text class="comfort-curve-time" x="${point.x.toFixed(1)}" y="${height - 18}" text-anchor="middle">${formatHour(point.timestamp)}</text>`;
  }).join("");

  return `
    <svg class="comfort-curve-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="comfortCurveTitle comfortCurveDesc">
      <title id="comfortCurveTitle">FeelScore Comfort Curve</title>
      <desc id="comfortCurveDesc">${model.accessibleSummary}</desc>
      <defs>
        <linearGradient id="comfortCurveStroke" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="var(--comfort-curve-cool)" />
          <stop offset="0.55" stop-color="var(--comfort-curve-good)" />
          <stop offset="1" stop-color="var(--comfort-curve-warm)" />
        </linearGradient>
        <linearGradient id="comfortCurveFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="var(--comfort-curve-good)" stop-opacity=".28" />
          <stop offset="1" stop-color="var(--comfort-curve-good)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <rect class="comfort-curve-zone excellent" x="${left}" y="${yFor(100)}" width="${plotWidth}" height="${yFor(90) - yFor(100)}" />
      <rect class="comfort-curve-zone pleasant" x="${left}" y="${yFor(90)}" width="${plotWidth}" height="${yFor(70) - yFor(90)}" />
      <rect class="comfort-curve-zone fair" x="${left}" y="${yFor(70)}" width="${plotWidth}" height="${yFor(55) - yFor(70)}" />
      <rect class="comfort-curve-zone challenging" x="${left}" y="${yFor(55)}" width="${plotWidth}" height="${yFor(30) - yFor(55)}" />
      ${nightBands(model.points, xFor, top, plotHeight)}
      <rect class="comfort-curve-frame" x="${left}" y="${top}" width="${plotWidth}" height="${plotHeight}" rx="8" />
      <text class="comfort-curve-zone-label" x="${left + plotWidth - 8}" y="${((yFor(100) + yFor(90)) / 2 + 4).toFixed(1)}" text-anchor="end">EXCELLENT</text>
      <text class="comfort-curve-zone-label" x="${left + plotWidth - 8}" y="${((yFor(90) + yFor(70)) / 2 + 4).toFixed(1)}" text-anchor="end">PLEASANT</text>
      <text class="comfort-curve-zone-label" x="${left + plotWidth - 8}" y="${((yFor(70) + yFor(55)) / 2 + 4).toFixed(1)}" text-anchor="end">NOTICEABLE</text>
      <path class="comfort-curve-area" d="${path} L ${chartPoints.at(-1).x.toFixed(1)} ${top + plotHeight} L ${chartPoints[0].x.toFixed(1)} ${top + plotHeight} Z" />
      <path class="comfort-curve-line" d="${path}" />
      <line class="comfort-curve-now-line" x1="${currentPoint.x.toFixed(1)}" x2="${currentPoint.x.toFixed(1)}" y1="${top}" y2="${top + plotHeight}" />
      <circle class="comfort-curve-now-dot" cx="${currentPoint.x.toFixed(1)}" cy="${currentPoint.y.toFixed(1)}" r="5" />
      <text class="comfort-curve-now-label" x="${(currentPoint.x + 10).toFixed(1)}" y="${Math.max(top + 12, currentPoint.y - 12).toFixed(1)}" text-anchor="start">NOW · ${currentPoint.score}</text>
      ${model.best ? `
        <circle class="comfort-curve-best-halo" cx="${bestPoint.x.toFixed(1)}" cy="${bestPoint.y.toFixed(1)}" r="11" />
        <circle class="comfort-curve-best-dot" cx="${bestPoint.x.toFixed(1)}" cy="${bestPoint.y.toFixed(1)}" r="5" />
        <text class="comfort-curve-best-star" x="${bestPoint.x.toFixed(1)}" y="${Math.max(top + 11, bestPoint.y - 15).toFixed(1)}" text-anchor="middle">★</text>
      ` : ""}
      ${timeLabels}
    </svg>`;
}

export function renderComfortCurve(target, options = {}) {
  const container = typeof target === "string" ? document.querySelector(target) : target;
  if (!container) return null;
  const model = buildComfortCurveModel(options);
  if (!model) {
    container.innerHTML = "";
    container.hidden = true;
    return null;
  }

  container.hidden = false;
  container.innerHTML = `
    <section class="comfort-curve-card" aria-label="When it will feel best outside">
      <header class="comfort-curve-header">
        <div>
          <div class="comfort-curve-kicker">FeelScore · next ${Math.max(12, Math.min(24, options.hours ?? DEFAULT_HOURS))} hours</div>
          <h2>Comfort Curve</h2>
          <p>${model.trend.label}. Scores range from ${model.minimum} to ${model.maximum}.</p>
        </div>
        ${model.best ? `<div class="comfort-curve-best"><span>Best</span><strong>${model.bestLabel}</strong><small>Peak ${model.best.peak}</small></div>` : ""}
      </header>
      <div class="comfort-curve-chart">${chartMarkup(model)}</div>
      <div class="comfort-curve-legend" aria-hidden="true">
        <span><i class="day"></i>Day</span><span><i class="night"></i>Night</span><span>Higher = easier outside</span>
      </div>
      <p class="visually-hidden">${model.accessibleSummary}</p>
    </section>
  `;
  return model;
}
