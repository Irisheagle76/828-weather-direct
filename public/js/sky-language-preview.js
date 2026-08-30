import { buildSkyState } from "./intel/sky-state.js";
import { generateSkyLanguage } from "./intel/sky-language.js";

const PRESETS = {
  "fair-cumulus": { skyColor: "blue", coverage: 24, cloudType: "fair_weather_cumulus", typeConfidence: 90, texture: "puffy", arrangement: "scattered_patches", sunVisibility: "mostly_unobstructed", cameraQuality: "good", confidence: 88, trend: "little_change", eastCoverage: 24, westCoverage: 24, ridgeVisibility: "good", valleyVisibility: "good", undercast: "none" },
  clear: { skyColor: "deep_blue", coverage: 2, cloudType: "", typeConfidence: 30, texture: "", arrangement: "", sunVisibility: "mostly_unobstructed", cameraQuality: "good", confidence: 94, trend: "little_change", eastCoverage: 3, westCoverage: 1, ridgeVisibility: "good", valleyVisibility: "good", undercast: "none" },
  cirrus: { skyColor: "blue", coverage: 22, cloudType: "cirrus", typeConfidence: 88, texture: "wispy", arrangement: "thin_bands", sunVisibility: "mostly_unobstructed", cameraQuality: "good", confidence: 87, trend: "little_change", eastCoverage: 24, westCoverage: 20, ridgeVisibility: "good", valleyVisibility: "good", undercast: "none" },
  cirrostratus: { skyColor: "milky", coverage: 56, cloudType: "cirrostratus", typeConfidence: 86, texture: "thin", arrangement: "broad_sheet", sunVisibility: "filtered", cameraQuality: "good", confidence: 84, trend: "clouds_increasing", eastCoverage: 48, westCoverage: 61, ridgeVisibility: "good", valleyVisibility: "good", undercast: "none" },
  stratocumulus: { skyColor: "blue_gray", coverage: 70, cloudType: "stratocumulus", typeConfidence: 84, texture: "lumpy", arrangement: "broken_layers", sunVisibility: "occasionally_filtered", cameraQuality: "good", confidence: 82, trend: "little_change", eastCoverage: 68, westCoverage: 72, ridgeVisibility: "good", valleyVisibility: "good", undercast: "none" },
  overcast: { skyColor: "gray", coverage: 98, cloudType: "stratus", typeConfidence: 80, texture: "flat", arrangement: "broad_sheet", sunVisibility: "mostly_hidden", cameraQuality: "good", confidence: 90, trend: "little_change", eastCoverage: 98, westCoverage: 98, ridgeVisibility: "moderate", valleyVisibility: "moderate", undercast: "none" },
  towering: { skyColor: "blue", coverage: 46, cloudType: "towering_cumulus", typeConfidence: 91, texture: "towering", arrangement: "over_mountains", sunVisibility: "mostly_unobstructed", cameraQuality: "good", confidence: 87, trend: "clouds_increasing", eastCoverage: 42, westCoverage: 50, ridgeVisibility: "good", valleyVisibility: "good", undercast: "none" },
  "clearer-west": { skyColor: "blue", coverage: 48, cloudType: "cumulus", typeConfidence: 68, texture: "puffy", arrangement: "scattered_patches", sunVisibility: "mostly_unobstructed", cameraQuality: "good", confidence: 86, trend: "clearing", eastCoverage: 82, westCoverage: 12, ridgeVisibility: "good", valleyVisibility: "good", undercast: "none" },
  "cloudier-west": { skyColor: "blue", coverage: 52, cloudType: "stratocumulus", typeConfidence: 72, texture: "broken", arrangement: "along_horizon", sunVisibility: "occasionally_filtered", cameraQuality: "good", confidence: 83, trend: "clouds_increasing", eastCoverage: 20, westCoverage: 84, ridgeVisibility: "good", valleyVisibility: "good", undercast: "none" },
  undercast: { skyColor: "bright_gray", coverage: 62, cloudType: "stratus", typeConfidence: 62, texture: "layered", arrangement: "broad_sheet", sunVisibility: "mostly_unobstructed", cameraQuality: "good", confidence: 70, trend: "little_change", eastCoverage: 60, westCoverage: 64, ridgeVisibility: "good", valleyVisibility: "poor", undercast: "possible" },
  "valley-fog": { skyColor: "bright_gray", coverage: 64, cloudType: "stratus", typeConfidence: 78, texture: "layered", arrangement: "broad_sheet", sunVisibility: "occasionally_filtered", cameraQuality: "good", confidence: 88, trend: "clearing", eastCoverage: 60, westCoverage: 68, ridgeVisibility: "good", valleyVisibility: "poor", undercast: "possible", satValleyPattern: "likely", satBroadDeck: "possible", satTrend: "dissipating", humidity: 96 },
  "low-overcast": { skyColor: "gray", coverage: 98, cloudType: "stratus", typeConfidence: 88, texture: "flat", arrangement: "broad_sheet", sunVisibility: "mostly_hidden", cameraQuality: "good", confidence: 90, trend: "little_change", eastCoverage: 98, westCoverage: 98, ridgeVisibility: "poor", valleyVisibility: "poor", undercast: "none", satValleyPattern: "none", satBroadDeck: "likely", satTrend: "little_change", humidity: 94 },
  offline: { skyColor: "blue_gray", coverage: 58, cloudType: "", typeConfidence: 0, texture: "", arrangement: "", sunVisibility: "uncertain", cameraQuality: "offline", confidence: 0, trend: "little_change", eastCoverage: 58, westCoverage: 58, ridgeVisibility: "moderate", valleyVisibility: "moderate", undercast: "none" }
};

const SIMULATION_DEFAULTS = { satValleyPattern: "none", satBroadDeck: "none", satTrend: "little_change", humidity: 55 };
const ids = ["skyColor", "coverage", "cloudType", "typeConfidence", "texture", "arrangement", "sunVisibility", "cameraQuality", "confidence", "trend", "eastCoverage", "westCoverage", "ridgeVisibility", "valleyVisibility", "undercast", "satValleyPattern", "satBroadDeck", "satTrend", "humidity"];
const elements = Object.fromEntries(ids.map((id) => [id, document.querySelector(`#${id}`)]));
const outputs = {
  coverage: document.querySelector("#coverageValue"),
  typeConfidence: document.querySelector("#typeConfidenceValue"),
  confidence: document.querySelector("#confidenceValue"),
  eastCoverage: document.querySelector("#eastValue"),
  westCoverage: document.querySelector("#westValue"),
  humidity: document.querySelector("#humidityValue")
};
let variation = 1;

function values() {
  return {
    ...Object.fromEntries(ids.map((id) => [id, elements[id].value])),
    coverage: Number(elements.coverage.value),
    typeConfidence: Number(elements.typeConfidence.value),
    confidence: Number(elements.confidence.value),
    eastCoverage: Number(elements.eastCoverage.value),
    westCoverage: Number(elements.westCoverage.value),
    humidity: Number(elements.humidity.value)
  };
}

function makeState(input) {
  const timestamp = "2026-08-28T16:00:00.000Z";
  const unavailable = ["offline", "night", "stale", "obscured"].includes(input.cameraQuality);
  const observation = {
    source: "preview-camera", timestamp,
    available: input.cameraQuality !== "offline",
    quality: input.cameraQuality,
    qualityScore: unavailable ? 0 : input.cameraQuality === "usable" ? 0.55 : 0.9,
    confidence: input.confidence / 100,
    coverageFraction: input.coverage / 100,
    skyColor: input.skyColor,
    cloudTypes: input.cloudType ? [{ type: input.cloudType, confidence: input.typeConfidence / 100 }] : [],
    texture: input.texture ? [input.texture] : [],
    arrangement: input.arrangement || null,
    sunVisibility: input.sunVisibility,
    directional: {
      east: { coverageFraction: input.eastCoverage / 100 },
      west: { coverageFraction: input.westCoverage / 100 }
    },
    ridgeVisibility: input.ridgeVisibility,
    valleyVisibility: input.valleyVisibility,
    undercast: input.undercast
  };
  const satelliteObservation = {
    kind: "satellite", source: "preview-visible-satellite", timestamp, available: true,
    quality: "good", qualityScore: 0.88, confidence: 0.86,
    coverageFraction: input.satBroadDeck === "likely" ? 0.94 : input.satBroadDeck === "possible" ? 0.65 : 0.3,
    texture: input.satBroadDeck !== "none" ? ["flat", "layered"] : [], sunVisibility: "uncertain",
    ridgeVisibility: "unknown", valleyVisibility: input.satValleyPattern !== "none" ? "poor" : "unknown", undercast: "none",
    satelliteLowCloud: {
      quality: "good", valleyPattern: input.satValleyPattern,
      valleyFogScore: input.satValleyPattern === "likely" ? 0.78 : input.satValleyPattern === "possible" ? 0.42 : 0.1,
      broadDeck: input.satBroadDeck,
      broadLowCloudScore: input.satBroadDeck === "likely" ? 0.8 : input.satBroadDeck === "possible" ? 0.46 : 0.1,
      trend: input.satTrend, confidence: 0.86
    }
  };
  const includeSatellite = input.satValleyPattern !== "none" || input.satBroadDeck !== "none";
  return buildSkyState({
    camera: { timestamp, observations: [observation, ...(includeSatellite ? [satelliteObservation] : [])], trend: { overallTrend: input.trend } },
    weatherContext: { cloudCover: input.coverage / 100, humidity: input.humidity / 100 },
    now: Date.parse(timestamp)
  });
}

function label(value) {
  return String(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderGallery(state) {
  const gallery = document.querySelector("#variationGallery");
  gallery.innerHTML = Array.from({ length: 6 }, (_, index) => {
    const seed = `gallery:${variation}:${index}:${state.overall}`;
    const short = generateSkyLanguage(state, { verbosity: "short", seed: `${seed}:short`, remember: false });
    const narrative = generateSkyLanguage(state, { verbosity: "narrative", seed: `${seed}:narrative`, remember: false });
    return `<article class="variation-item"><div><b>${short}</b><p>${narrative.detail}</p></div></article>`;
  }).join("");
}

function render({ refreshGallery = false } = {}) {
  const input = values();
  for (const [key, output] of Object.entries(outputs)) output.value = `${input[key]}%`;
  const state = makeState(input);
  const seed = `preview:${variation}:${JSON.stringify(input)}`;
  const micro = generateSkyLanguage(state, { verbosity: "micro", seed: `${seed}:micro`, remember: false });
  const short = generateSkyLanguage(state, { verbosity: "short", seed: `${seed}:short`, remember: false });
  const narrative = generateSkyLanguage(state, { verbosity: "narrative", seed: `${seed}:narrative`, remember: false });

  document.querySelector("#microOutput").textContent = micro;
  document.querySelector("#stateChip").textContent = label(state.fogState?.likelihood !== "none" ? state.fogState.type : state.overall);
  document.querySelector("#shortOutput").textContent = short;
  document.querySelector("#shortDetail").textContent = narrative.observation;
  document.querySelector("#narrativeHeadline").textContent = narrative.headline;
  document.querySelector("#narrativeObservation").textContent = narrative.observation;
  document.querySelector("#narrativeInterpretation").textContent = narrative.interpretation;
  document.querySelector("#narrativeExpectation").textContent = narrative.sunsetExpectation;
  document.querySelector("#stateOutput").textContent = JSON.stringify(state, null, 2);
  if (refreshGallery || !document.querySelector("#variationGallery").children.length) renderGallery(state);
}

function applyPreset(name) {
  const preset = PRESETS[name] || PRESETS["fair-cumulus"];
  for (const id of ids) elements[id].value = preset[id] ?? SIMULATION_DEFAULTS[id] ?? "";
  variation += 1;
  render({ refreshGallery: true });
}

for (const element of Object.values(elements)) element.addEventListener("input", () => render());
document.querySelector("#preset").addEventListener("change", (event) => applyPreset(event.target.value));
document.querySelector("#resetPreset").addEventListener("click", () => applyPreset(document.querySelector("#preset").value));
document.querySelector("#newVariation").addEventListener("click", () => { variation += 1; render({ refreshGallery: true }); });
document.querySelector("#refreshGallery").addEventListener("click", () => { variation += 1; renderGallery(makeState(values())); });

applyPreset("fair-cumulus");
