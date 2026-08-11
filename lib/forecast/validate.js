export const BANNED_PHRASES = [
  "residents should remain weather aware",
  "outdoor enthusiasts should exercise caution",
  "conditions will be conducive",
  "dynamic weather pattern",
  "it is important to note",
  "mother nature",
  "stay tuned for updates",
  "the atmosphere is primed",
  "mixed bag of weather",
  "unsettled conditions persist",
  "rain cannot be ruled out",
  "umbrella may be your best friend"
];

const STRICT_REQUIRED_FIELDS = [
  "headline",
  "narrative",
  "condition",
  "mainIssue",
  "bestWindow",
  "sky",
  "humidity"
];

const MANUAL_REQUIRED_FIELDS = [];

export function validateForecast(
  forecast,
  {
    now = new Date(),
    sourceTimestamps = {},
    mode = "strict"
  } = {}
) {
  const errors = [];
  const warnings = [];
  const entries = Object.entries(forecast?.days || {});
  const isManual = mode === "manual";
  const requiredFields = isManual ? MANUAL_REQUIRED_FIELDS : STRICT_REQUIRED_FIELDS;

  if (entries.length !== 4) errors.push("Exactly four forecast days are required");

  const keys = entries.map(([key]) => key);
  if (new Set(keys).size !== keys.length || keys.some((key, index) => index && key <= keys[index - 1])) {
    errors.push("Forecast dates must be unique and ordered");
  }

  const headlines = new Set();
  const narratives = [];

  for (const [key, day = {}] of entries) {
    const headline = textValue(day.headline);
    const narrative = textValue(day.narrative);
    const timelineText = Object.values(day.timeline || {}).map(textValue).join(" ");
    const searchableText = `${headline} ${narrative} ${timelineText}`.toLowerCase();

    if (day.date !== key || weekday(day.date) !== weekday(key)) {
      errors.push(`Incorrect date pairing: ${key}`);
    }

    for (const field of requiredFields) {
      if (!textValue(day[field])) errors.push(`${key}: missing ${field}`);
    }

    if (!isManual && (!Number.isFinite(day.high) || !Number.isFinite(day.low))) {
      errors.push(`${key}: missing temperatures`);
    }

    if (day.low > day.high + 5) errors.push(`${key}: low is implausibly above high`);

    if (day.rainChance != null &&
        (!Number.isFinite(day.rainChance) || day.rainChance < 0 || day.rainChance > 100)) {
      errors.push(`${key}: rain chance must be between 0 and 100`);
    }

    if (!isManual && malformedWind(day.wind)) errors.push(`${key}: malformed wind`);

    for (const phrase of BANNED_PHRASES) {
      if (searchableText.includes(phrase)) errors.push(`${key}: banned phrase: ${phrase}`);
    }

    if (/<[^>]+>|\[[^\]]+\]\(|\b(undefined|null|todo|tbd)\b/i.test(searchableText)) {
      errors.push(`${key}: placeholder, HTML, or markdown found`);
    }

    if (/\bsevere\b/i.test(searchableText) && !day.needsReview) {
      errors.push(`${key}: unsupported severe terminology`);
    }

    if (headline) {
      if (headlines.has(headline)) errors.push("Duplicate daily headlines");
      headlines.add(headline);
    }

    if (narrative) {
      narratives.push({ key, text: normalize(narrative) });
      if (narrative.length > 420) errors.push(`${key}: narrative too long`);
    }

    if (/\bno rain\b/i.test(searchableText) && day.stormRisk !== "none") {
      errors.push(`${key}: unsupported no-rain absolute`);
    }
  }

  for (let i = 0; i < narratives.length; i += 1) {
    for (let j = i + 1; j < narratives.length; j += 1) {
      if (similarity(narratives[i].text, narratives[j].text) > 0.72) {
        errors.push(`${narratives[j].key}: narrative is substantially identical to ${narratives[i].key}`);
      }
    }
  }

  const openings = narratives.map(item => item.text.split(" ").slice(0, 4).join(" "));
  if (new Set(openings).size < Math.min(3, openings.length)) {
    errors.push("Daily narratives repeat too many sentence openings");
  }

  const afd = Date.parse(sourceTimestamps.afdIssued || "");
  if (sourceTimestamps.afdIssued && now - afd > 18 * 3600000) {
    warnings.push("Area Forecast Discussion is stale");
  }

  return { valid: errors.length === 0, errors, warnings, validDays: entries.length };
}

function malformedWind(wind) {
  return !wind ||
    (!wind.calm && (!Number.isFinite(wind.speedMin) || !Number.isFinite(wind.speedMax)));
}

function textValue(value) {
  return String(value ?? "").trim();
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a, b) {
  const left = new Set(a.split(" ").filter(word => word.length > 3));
  const right = new Set(b.split(" ").filter(word => word.length > 3));
  const shared = [...left].filter(word => right.has(word)).length;
  return shared / Math.max(1, Math.min(left.size, right.size));
}

function weekday(key) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long"
  }).format(new Date(`${key}T12:00:00-04:00`));
}
