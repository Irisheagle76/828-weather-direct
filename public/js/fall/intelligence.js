import { CAMERAS, SEASON_MILESTONE_PREVIEW } from "./config.js";
import { leafDropRisk, ratingForScore, scoreFallHours, viewScore } from "./scoring.js";
import { buildElevationAnalysis } from "./elevation.js";

const dayKey = (timestamp) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
const hour = (timestamp) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date(timestamp))) % 24;
const formatTime = (timestamp) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));

export function buildFallIntelligence(payload, skyPayload = null) {
  const destinations = (payload.destinations || [])
    .map((site) => ({ ...site, hourly: site.hourly || [], daily: site.daily || [] }))
    .filter((site) => site.dataQuality?.available !== false && site.hourly.length);
  if (!destinations.length) throw new Error("No usable NOAA/NWS destination forecasts");
  const asheville = destinations.find((site) => site.id === "asheville") || destinations[0] || { hourly: [], daily: [] };
  const now = Date.now();
  const todayKey = dayKey(now);
  const todayHours = asheville.hourly.filter((h) => dayKey(h.timestamp) === todayKey);
  const liveScores = Object.fromEntries((skyPayload?.sites || []).map((site) => [site.id, site.scores?.summitView]));
  const todayBase = scoreFallHours(todayHours);
  const viewsScore = viewScore(todayHours, meanFinite(Object.values(liveScores)));
  const leafDrop = leafDropRisk(todayHours);
  const photoScore = todayBase.available && Number.isFinite(viewsScore) ? Math.round(todayBase.factors.light * 0.6 + viewsScore * 0.4) : null;
  const ranked = destinations.map((site) => {
    const hours = site.hourly.filter((h) => dayKey(h.timestamp) === todayKey);
    const fall = scoreFallHours(hours);
    const skyId = site.id === "black-balsam" || site.id === "graveyard" ? "pisgah" : site.id;
    const views = viewScore(hours, liveScores[skyId]);
    return { ...site, hours, fall, views, combined: fall.available && Number.isFinite(views) ? Math.round(fall.score * 0.62 + views * 0.38) : null };
  }).filter((site) => Number.isFinite(site.combined)).sort((a, b) => b.combined - a.combined);
  if (!ranked.length || !todayBase.available) throw new Error("Insufficient NOAA/NWS hours for today's Fall Explorer score");
  const best = ranked[0] || asheville;
  const worst = ranked[ranked.length - 1];
  const avoid = worst && best && best.combined - worst.combined >= 12 ? worst : null;
  const bestWindow = findBestWindow(best.hours || todayHours, now);
  const elevation = buildElevationAnalysis(destinations, { now, observations: payload.observations });
  const outlook = buildOutlook(asheville.hourly, asheville.daily);
  const bestOutlook = outlook.slice().sort((a, b) => b.score - a.score)[0];

  return {
    updated: payload.updated || new Date().toISOString(),
    source: payload.source || "828 forecast feed",
    today: {
      score: todayBase.score,
      rating: todayBase.rating,
      viewsScore,
      photoRating: Number.isFinite(photoScore) ? ratingForScore(photoScore) : "Unavailable",
      leafDropRisk: leafDrop.category,
      summary: buildTodaySummary(best, bestWindow, viewsScore, leafDrop.category)
    },
    recommendations: {
      bestBet: { name: best.name || "Asheville area", score: best.combined || todayBase.score, window: bestWindow.label, reason: recommendationReason(best) },
      photoWindow: { label: bestWindow.photoLabel, reason: photoReason(bestWindow, viewsScore) },
      bestViews: { name: (ranked.slice().sort((a, b) => b.views - a.views)[0] || best).name, score: maxFinite([...ranked.map((site) => site.views), viewsScore]) },
      avoid: avoid ? { name: avoid.name, reason: avoidReason(avoid) } : null
    },
    elevation,
    season: { elevationBands: buildSeasonProgress(elevation, SEASON_MILESTONE_PREVIEW) },
    outlook,
    bestOutlook,
    leafDropWatch: outlook.slice().sort((a, b) => riskRank(b.leafDropRisk) - riskRank(a.leafDropRisk))[0],
    cameras: CAMERAS,
    quality: {
      ...(payload.quality || {}),
      source: payload.source,
      observations: payload.observations || payload.quality?.observations || null,
      calibration: payload.calibration || null,
      lowElevationConfidence: destinations.filter((site) => site.dataQuality?.elevationConfidence === "low").map((site) => site.name)
    }
  };
}

function buildOutlook(hours, daily) {
  const grouped = new Map();
  hours.forEach((h) => { const key = dayKey(h.timestamp); grouped.set(key, [...(grouped.get(key) || []), h]); });
  return [...grouped.entries()].slice(0, 5).map(([key, dayHours], index) => {
    const score = scoreFallHours(dayHours);
    const drop = leafDropRisk(dayHours);
    const dailyRow = daily[index] || {};
    return {
      key,
      day: new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(new Date(dayHours[0].timestamp)),
      score: score.score,
      rating: score.rating,
      icon: weatherIcon(score.metrics, drop.category),
      details: dayDetails(score.metrics, drop.category, dailyRow),
      leafDropRisk: drop.category,
      leafDropReason: drop.category === "Low" ? "Winds and rain look limited." : `Gusts near ${Math.round(drop.gust)} mph${drop.rain >= 0.1 ? " with rain" : ""} may stress exposed leaves.`
    };
  }).filter((day) => Number.isFinite(day.score));
}

function findBestWindow(hours, now = Date.now()) {
  const candidates = hours.filter((h) => h.timestamp >= now - 30 * 60 * 1000 && hour(h.timestamp) >= 8 && hour(h.timestamp) <= 19);
  if (!candidates.length) return { label: "Daylight window has passed", photoLabel: "Next daylight window", cloud: null };
  const ranked = candidates.map((h) => {
    const localHour = hour(h.timestamp);
    const cloud = Number(h.cloudCover) || 0;
    const lightBonus = localHour >= 16 ? 16 : localHour >= 13 ? 9 : 2;
    const score = 100 - cloud * 58 - (Number(h.precipProbability) || 0) * 50 - Math.max(0, (Number(h.windGust) || 0) - 18) * 2 + lightBonus;
    return { ...h, localHour, score };
  }).sort((a, b) => b.score - a.score);
  const start = ranked[0];
  const end = candidates.find((h) => h.timestamp >= start.timestamp + 3 * 3600000) || start;
  const sunset = Math.max(...hours.map((h) => Number(h.sunset) || 0));
  return {
    label: `${formatTime(start.timestamp)}–${formatTime(end.timestamp + 3600000)}`,
    photoLabel: sunset > Date.now() ? `${formatTime(sunset - 45 * 60000)}–${formatTime(sunset + 15 * 60000)}` : `${formatTime(start.timestamp)}–${formatTime(start.timestamp + 90 * 60000)}`,
    cloud: start.cloudCover
  };
}

function buildTodaySummary(best, window, views, drop) {
  const viewPhrase = views >= 80 ? "excellent mountain visibility" : views >= 65 ? "useful breaks for mountain views" : "changeable mountain visibility";
  const windPhrase = drop === "Low" ? "winds look manageable" : `${drop.toLowerCase()} leaf-drop risk favors sheltered stops`;
  return `Best overall viewing today: ${best.name || "the Asheville area"}, especially ${window.label}. Expect ${viewPhrase}; ${windPhrase}.`;
}

function recommendationReason(site) {
  const m = site.fall?.metrics || {};
  if ((m.pop || 0) >= 0.45) return "The best available mix of lighter rain chances, visibility and manageable wind.";
  if ((m.clouds || 0) <= 0.35) return "Drier air, more sunshine and the strongest mountain-view signal in the destination set.";
  return "The best balance of cloud breaks, comfortable temperatures and manageable ridge wind.";
}
function photoReason(window, views) { return `${views >= 75 ? "Good ridge definition" : "The best available visibility"} and ${window.cloud <= 0.6 ? "some texture around low-angle light" : "a chance for cloud breaks near low-angle light"}.`; }
function avoidReason(site) { const m = site.fall?.metrics || {}; return (m.gust || 0) >= 28 ? "Exposed-ridge gusts make this a weaker choice today." : (m.clouds || 0) >= 0.78 ? "Summit cloud and limited visibility make this a weaker choice." : "This location has the weakest weather-and-view combination in today's set."; }
function weatherIcon(metrics, drop) { if (drop === "High" || drop === "Very High") return "💨"; if (metrics.pop >= 0.55) return "🌧️"; if (metrics.clouds <= 0.25) return "☀️"; return metrics.clouds <= 0.65 ? "🌤️" : "☁️"; }
function dayDetails(m, drop) { return [m.pop < 0.25 ? "Mostly dry" : m.pop < 0.55 ? "Spotty rain chance" : "Rain may interrupt", m.clouds < 0.4 ? "Clearer views" : "More clouds", drop === "Low" ? "Light leaf stress" : `${drop} leaf-drop risk`]; }
function riskRank(risk) { return ({ Low: 0, Moderate: 1, High: 2, "Very High": 3 })[risk] || 0; }
function meanFinite(values) { const usable = values.filter(Number.isFinite); return usable.length ? usable.reduce((a, b) => a + b, 0) / usable.length : null; }
function maxFinite(values) { const usable = values.filter(Number.isFinite); return usable.length ? Math.max(...usable) : null; }

function buildSeasonProgress(elevation, milestones) {
  return elevation.bands.map((band) => {
    const stored = milestones.find((item) => item.elevationBand === band.id);
    const reached = stored?.first32;
    const approaching = !reached && Number.isFinite(band.temperatureF) && band.temperatureF <= 36;
    return { ...band, status: reached ? "Reached" : approaching ? "Approaching" : "Not Yet", date: reached || null, provisional: true };
  });
}
