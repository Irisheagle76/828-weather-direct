const previousById = new Map();

export function evaluateObservationHealth(observation, station, { now = Date.now(), previous = previousById.get(station.id) } = {}) {
  const issues = [];
  const observedAt = Date.parse(observation?.observedAt);
  const ageMinutes = Number.isFinite(observedAt) ? (now - observedAt) / 60000 : Infinity;
  if (!Number.isFinite(observedAt)) issues.push(issue("missing-time", "blocking"));
  else if (ageMinutes < -5) issues.push(issue("future-time", "blocking"));
  else if (ageMinutes > station.maxAgeMinutes) issues.push(issue("stale", "blocking"));

  range(issues, observation?.temperatureF, -40, 110, "temperature");
  range(issues, observation?.humidityPct, 0, 100, "humidity", false);
  range(issues, observation?.windMph, 0, 150, "wind", false);
  range(issues, observation?.gustMph, 0, 180, "gust", false);
  if (finite(observation?.dewPointF) != null && finite(observation?.temperatureF) != null && observation.dewPointF > observation.temperatureF + 3) issues.push(issue("dewpoint-above-temperature", "suspect"));

  if (previous && Number.isFinite(observedAt)) {
    const priorAt = Date.parse(previous.observedAt);
    const elapsedMinutes = (observedAt - priorAt) / 60000;
    if (elapsedMinutes > 0 && elapsedMinutes <= 45) {
      if (delta(observation.temperatureF, previous.temperatureF) > 15) issues.push(issue("temperature-jump", "suspect"));
      if (delta(observation.humidityPct, previous.humidityPct) > 45) issues.push(issue("humidity-jump", "suspect"));
    }
  }

  const blocking = issues.some((item) => item.severity === "blocking");
  const suspect = issues.some((item) => item.severity === "suspect");
  const status = blocking ? (issues.some((item) => item.code === "stale") ? "stale" : "invalid") : suspect ? "suspect" : "healthy";
  const score = blocking ? 0 : suspect ? 60 : 100;
  const health = { status, score, usable: !blocking, ageMinutes: Number.isFinite(ageMinutes) ? Math.round(ageMinutes) : null, maxAgeMinutes: station.maxAgeMinutes, issues };
  if (health.usable) previousById.set(station.id, observation);
  return health;
}

export function resetObservationHealthHistory() {
  previousById.clear();
}

function range(issues, value, min, max, label, required = true) {
  const number = finite(value);
  if (number == null) {
    if (required) issues.push(issue(`${label}-missing`, "blocking"));
  } else if (number < min || number > max) {
    issues.push(issue(`${label}-range`, "blocking"));
  }
}

function delta(a, b) {
  const first = finite(a);
  const second = finite(b);
  return first == null || second == null ? 0 : Math.abs(first - second);
}

function finite(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function issue(code, severity) { return { code, severity }; }
