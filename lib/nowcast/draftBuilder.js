import { observationIsStale } from "./logic.js";

export function buildDraft({ observation, rainState, changes = [], alerts = [], forecast, now = Date.now(), variation = 0 }) {
  const facts = [];
  const sentences = [];
  const meaningful = changes.find(change =>
    ["moderate", "high"].includes(change.severity) &&
    !["stale-observation", "new-alert", "updated-alert", "forecast-timing"].includes(change.type)
  );

  if (observation && !observationIsStale(observation, now)) {
    const parts = [];
    if (Number.isFinite(observation.temperatureF)) parts.push(`a current temperature of ${round(observation.temperatureF)}°F`);
    if (Number.isFinite(observation.windSpeedMph)) parts.push(`winds near ${round(observation.windSpeedMph)} mph`);
    if (rainState === "Dry") parts.push("no measurable rain");
    if (parts.length) {
      const opening = !meaningful && rainState === "Dry"
        ? "Conditions remain quiet in Asheville"
        : variation % 2
          ? "The latest observation in Asheville shows"
          : "Current observations in Asheville show";
      sentences.push(`${opening}${opening.includes("shows") ? " " : ", with "}${joinNatural(parts)}.`);
      facts.push("current-observation");
      if (rainState === "Dry") facts.push("rain-state");
    }
  }

  if (meaningful) {
    sentences.push(changeSentence(meaningful));
    facts.push(meaningful.type);
  }

  if (rainState && !["Dry", "Rain data unavailable"].includes(rainState) && !meaningful?.type?.startsWith("rain")) {
    const rainText = {
      Dry: "The current Asheville observation shows no measurable rain.",
      "Rain beginning": "The current Asheville observation indicates that rain has begun.",
      "Rain ongoing": "The current Asheville observation indicates ongoing rain.",
      "Rain increasing": "The observed rain rate in Asheville is increasing.",
      "Rain decreasing": "The observed rain rate in Asheville is decreasing.",
      "Rain recently ended": "The current Asheville observation indicates that rain has recently ended."
    }[rainState];
    if (rainText) { sentences.push(rainText); facts.push("rain-state"); }
  }

  const period = forecast?.periods?.[0];
  if (period?.shortForecast) {
    const pop = Number.isFinite(period.precipProbabilityPct) ? `, with a ${round(period.precipProbabilityPct)}% chance of precipitation` : "";
    const timing = period.name ? ` ${String(period.name).toLowerCase()}` : "";
    sentences.push(`The latest NWS forecast calls for ${forecastPhrase(period.shortForecast)}${timing}${pop}.`);
    facts.push("nws-current-period");
  }

  if (alerts.length) {
    const alert = alerts[0];
    sentences.push(`The NWS has an active ${alert.event} for the Asheville area; review the official alert for details and instructions.`);
    facts.push(`alert:${alert.id}`);
  } else {
    sentences.push("No active NWS alerts are currently in effect for the city of Asheville.");
    facts.push("alerts:none");
  }

  if (!observation || observationIsStale(observation, now)) {
    sentences.push("Tempest data is stale or unavailable, so current-condition confidence is limited.");
    facts.push("tempest-stale-or-missing");
  }

  const text = trimToWords(sentences.join(" "), 100);
  return { text, facts, generatedAt: now };
}

function changeSentence(change) {
  const before = formatValue(change.previousValue, change.unit);
  const after = formatValue(change.currentValue, change.unit);
  if (before && after && change.minutes) return `${change.label} from ${before} to ${after} during the past ${change.minutes} minutes.`;
  if (after) return `${change.label}: ${after}.`;
  return `${change.label}.`;
}

function formatValue(value, unit = "") {
  if (value === null || value === undefined || value === "") return "";
  if (Number.isFinite(Number(value))) return `${round(Number(value))}${unit}`;
  return String(value);
}

function joinNatural(values) {
  if (values.length < 2) return values[0] || "";
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}

function forecastPhrase(value) {
  const phrase = String(value || "").toLowerCase();
  if (/^(mostly |partly )?(sunny|cloudy)$/.test(phrase)) return `${phrase} skies`;
  if (/^chance (of )?showers/.test(phrase)) return phrase.replace(/^chance (of )?/, "a chance of ");
  return phrase;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function trimToWords(text, maxWords) {
  const words = text.trim().split(/\s+/);
  return words.length <= maxWords ? text.trim() : `${words.slice(0, maxWords).join(" ").replace(/[.,;:]?$/, "")}…`;
}
