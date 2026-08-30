const CLOUD_LANGUAGE = {
  cirrus: { formal: "thin cirrus", casual: ["wispy high clouds", "thin high-cloud streaks"], texture: "wispy" },
  cirrostratus: { formal: "cirrostratus", casual: ["a thin high cloud veil", "milky high clouds"], texture: "thin" },
  altocumulus: { formal: "altocumulus", casual: ["rippled mid-level clouds", "patches of small clouds"], texture: "rippled" },
  altostratus: { formal: "altostratus", casual: ["a broad mid-level sheet", "layered clouds"], texture: "layered" },
  fair_weather_cumulus: { formal: "fair-weather cumulus", casual: ["small puffy clouds", "scattered puffy clouds"], texture: "puffy" },
  cumulus: { formal: "cumulus", casual: ["puffy clouds", "chunky clouds"], texture: "puffy" },
  towering_cumulus: { formal: "towering cumulus", casual: ["growing vertical clouds", "taller clouds building over the mountains"], texture: "towering" },
  stratocumulus: { formal: "stratocumulus", casual: ["lumpy low clouds", "a broken low cloud deck"], texture: "lumpy" },
  stratus: { formal: "stratus", casual: ["a flat gray cloud layer", "a low cloud deck"], texture: "flat" },
  cumulonimbus: { formal: "cumulonimbus", casual: ["distant thunderheads", "tall storm clouds"], texture: "towering" }
};

const recentBySurface = new Map();

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}

function choose(options, seed, recent = []) {
  const available = options.filter((option) => !recent.includes(option));
  const pool = available.length ? available : options;
  return pool[hash(seed) % pool.length];
}

function directionalPhrase(state) {
  const east = state.directional?.east?.coverageFraction;
  const west = state.directional?.west?.coverageFraction;
  if (!Number.isFinite(east) || !Number.isFinite(west) || Math.abs(east - west) < 0.18) return "";
  return east > west
    ? "with more clouds east of Asheville and clearer sky to the west"
    : "with thicker clouds west of Asheville and more blue toward the east";
}

function cloudDescription(state, seed, explicitAllowed) {
  const type = state.dominantCloudType;
  const family = CLOUD_LANGUAGE[type];
  if (family) {
    const confidence = state.cloudTypeConfidence?.[type] || 0;
    const useFormal = explicitAllowed && confidence >= 0.72 && hash(`${seed}:formal`) % 100 < 32;
    return useFormal ? family.formal : choose(family.casual, `${seed}:casual`);
  }
  const texture = state.texture?.[0];
  if (texture && state.cloudCoverageFraction >= 0.18) return `${texture} clouds`;
  const descriptions = {
    clear: "an almost cloudless sky", few: "a few clouds", scattered: "scattered clouds",
    broken: "broken clouds", mostly_cloudy: "plenty of clouds", overcast: "a solid cloud deck", unknown: "clouds"
  };
  return descriptions[state.cloudCoverage] || "clouds";
}

function baseShort(state, seed) {
  const directional = directionalPhrase(state);
  const fog = state.fogState || {};
  if (fog.type === "valley_fog" && fog.likelihood === "possible") return "Possible fog lingering in the Asheville valleys";
  if (fog.type === "valley_fog" && fog.trend === "dissipating") return "Valley fog is thinning around Asheville";
  if (fog.type === "valley_fog" && ["likely", "confirmed"].includes(fog.likelihood)) return "Fog filling the French Broad and Swannanoa valleys";
  if (fog.type === "low_overcast" && fog.likelihood === "possible") return "A possible low cloud deck over Asheville";
  if (fog.type === "low_overcast" && fog.trend === "dissipating") return "Low overcast is beginning to lift around Asheville";
  if (fog.type === "low_overcast" && ["likely", "confirmed"].includes(fog.likelihood)) return "Low overcast is keeping Asheville gray";
  if (state.undercast === "confirmed" || state.undercast === "likely") return "Low clouds filling parts of the Asheville basin";
  if (state.undercast === "possible") return "Signs of low clouds pooling in the Asheville basin";
  if (state.overall === "obscured") return "Low cloud is obscuring the Asheville view";
  if (directional) {
    const opening = state.skyColor === "blue" ? "Blue sky around Asheville" : "A mixed sky over Asheville";
    return `${opening}, ${directional}`;
  }
  const cloud = cloudDescription(state, seed, true);
  if (state.overall === "clear") return choose(["Clear blue sky over Asheville", "Bright blue and almost cloudless"], seed);
  if (state.overall === "mostly_clear") return state.skyColor === "blue" ? `Mostly blue with ${cloud}` : `Mostly clear with ${cloud}`;
  if (state.sunVisibility === "filtered" || state.sunVisibility === "occasionally_filtered") return `${cloud[0].toUpperCase()}${cloud.slice(1)} with filtered sunshine`;
  if (state.overall === "partly_cloudy") return `${cloud[0].toUpperCase()}${cloud.slice(1)} with pockets of blue`;
  if (state.overall === "mostly_cloudy") return `Mostly cloudy with ${state.lightQuality === "filtered" ? "soft filtered light" : "a few brighter openings"}`;
  if (state.overall === "overcast") return state.depth === "flat" ? "A flat gray overcast over Asheville" : "Gray and overcast with muted light";
  return "Current sky conditions are only partly resolved";
}

function observationSentence(state, seed) {
  const cloud = cloudDescription(state, seed, true);
  const directional = directionalPhrase(state);
  const fog = state.fogState || {};
  if (fog.type === "valley_fog" && fog.likelihood === "possible") return "Visible satellite shows a possible low-cloud signature along the Asheville valleys, but local evidence is not definitive yet.";
  if (fog.type === "valley_fog" && fog.trend === "dissipating") return "Fog tracing the French Broad and Swannanoa valleys is becoming less extensive as daytime heating works on it.";
  if (fog.type === "valley_fog" && ["likely", "confirmed"].includes(fog.likelihood)) return "Visible satellite shows low cloud and fog tracing the French Broad and Swannanoa valleys around Asheville.";
  if (fog.type === "low_overcast" && fog.likelihood === "possible") return "Visible satellite suggests a broad low cloud deck near Asheville, though the surface evidence is still limited.";
  if (fog.type === "low_overcast" && fog.trend === "dissipating") return "The broad low cloud deck over Asheville is beginning to thin and lift.";
  if (fog.type === "low_overcast" && ["likely", "confirmed"].includes(fog.likelihood)) return "A broad low cloud deck is covering Asheville and limiting the view of the higher terrain.";
  if (state.undercast === "confirmed") return "A low cloud layer is filling the Asheville basin while higher ridges remain above it.";
  if (state.undercast === "likely") return "Low clouds appear to be pooling in parts of the Asheville basin below the higher ridges.";
  if (state.undercast === "possible") return "There are some signs of low clouds pooling in the Asheville basin, though the view is not definitive yet.";
  if (directional) return `The view includes ${cloud}, ${directional}.`;
  const arrangements = {
    clear: "The sky is broadly open over Asheville.",
    mostly_clear: `The view shows ${cloud} against plenty of open sky.`,
    partly_cloudy: `The sky has ${cloud} around Asheville, with some blue still visible.`,
    mostly_cloudy: `Most of the sky is covered by ${cloud}, though a few brighter openings remain.`,
    overcast: `The sky is broadly gray beneath ${cloud}.`,
    obscured: "Low cloud is obscuring the view and limiting a clean read on the sky."
  };
  return arrangements[state.overall] || "The available cameras and weather observations provide only a limited sky read.";
}

function lightSentence(state) {
  if (state.fogState?.type === "valley_fog" && state.fogState?.trend === "dissipating") return "The low cloud is thinning, so brighter openings should become more common as heating continues.";
  if (state.fogState?.type === "valley_fog" && ["likely", "confirmed"].includes(state.fogState?.likelihood)) return "The valley layer is muting the light locally while higher terrain may remain above it.";
  if (state.fogState?.type === "low_overcast" && ["likely", "confirmed"].includes(state.fogState?.likelihood)) return "The low deck is muting the daylight and limiting a clean view toward the western horizon.";
  const phrases = {
    mostly_unobstructed: "Sunlight is reaching the western horizon without much obstruction.",
    filtered: "The sun is filtering through the cloud layer rather than disappearing behind it.",
    occasionally_filtered: "The sun is moving through thinner and thicker patches of cloud.",
    mostly_hidden: "The sun is mostly hidden behind the thicker cloud cover.",
    obscured: "The current view cannot reliably resolve the sun or western horizon."
  };
  return phrases[state.sunVisibility] || "Sun visibility remains uncertain from the available view.";
}

function sunsetSentence(state) {
  const setup = state.sunsetStructure || {};
  if (!setup.lightCanReachHorizon || setup.westernHorizon === "blocked") return "That points to limited color potential unless openings develop closer to sunset.";
  if (setup.textureAvailable && setup.westernHorizon === "open") return "That is a good setup for some warmer color, especially just after sunset.";
  if (setup.textureAvailable) return "Some of those clouds may catch softer orange or pink light as the sun gets lower.";
  return "The open horizon favors clean light, though limited cloud texture may keep the color subtle.";
}

export function generateSkyLanguage(state, { verbosity = "short", seed = null, surface = verbosity, remember = true } = {}) {
  if (!state) return verbosity === "narrative" ? { headline: "Sky read unavailable", detail: "Current weather observations will continue to provide a fallback." } : "Sky read unavailable";
  const languageSeed = seed || `${state.timestamp}:${state.overall}:${surface}`;
  const recent = recentBySurface.get(surface) || [];
  let result;
  if (verbosity === "micro") result = state.fogState?.type === "valley_fog" && state.fogState?.likelihood !== "none"
    ? "Valley fog"
    : state.fogState?.type === "low_overcast" && state.fogState?.likelihood !== "none" ? "Low overcast" : cloudDescription(state, languageSeed, true);
  else if (verbosity === "narrative") {
    const observation = observationSentence(state, languageSeed);
    const detail = `${observation} ${lightSentence(state)} ${sunsetSentence(state)}`;
    result = { headline: baseShort(state, `${languageSeed}:headline`), detail, observation, interpretation: lightSentence(state), sunsetExpectation: sunsetSentence(state) };
  } else result = baseShort(state, languageSeed);
  const rendered = typeof result === "string" ? result : `${result.headline}|${result.detail}`;
  if (remember) recentBySurface.set(surface, [rendered, ...recent].slice(0, 4));
  return result;
}

export function resetSkyLanguageMemory() {
  recentBySurface.clear();
}
