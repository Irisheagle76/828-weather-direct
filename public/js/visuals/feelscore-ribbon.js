function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function probability(value) {
  const number = finite(value);
  if (number == null) return null;
  return Math.max(0, Math.min(1, number > 1 ? number / 100 : number));
}

function formatHour(timestamp) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    timeZone: "America/New_York"
  }).format(new Date(timestamp));
}

function scoreBand(score) {
  if (score >= 90) return { className: "excellent", label: "Excellent" };
  if (score >= 70) return { className: "pleasant", label: "Pleasant" };
  if (score >= 55) return { className: "noticeable", label: "Noticeable" };
  if (score >= 40) return { className: "challenging", label: "Challenging" };
  return { className: "harsh", label: "Harsh" };
}

export function getAdaptiveHourContext(hour = {}) {
  const rainChance = probability(hour.precipProbability ?? hour.precipitation_probability);
  const rainAmount = finite(hour.precipAmount ?? hour.precipitation ?? hour.rain) ?? 0;
  const weatherCode = finite(hour.weatherCode ?? hour.weather_code);
  const dewPoint = finite(hour.dewpointF ?? hour.dewPoint);
  const wind = finite(hour.windSpeed ?? hour.wind);
  const gust = finite(hour.windGust ?? hour.wind_gust);
  const rainSignal = rainAmount >= 0.005 || (rainChance ?? 0) >= 0.25 || (weatherCode != null && weatherCode >= 51);

  if (rainSignal) {
    const chance = rainChance != null ? `${Math.round(rainChance * 100)}%` : "possible";
    return { type: "rain", label: `Rain ${chance}`, ariaLabel: `rain ${chance}` };
  }
  if (Number.isFinite(dewPoint) && dewPoint >= 62) {
    return { type: "moisture", label: `Dew ${Math.round(dewPoint)}°`, ariaLabel: `dew point ${Math.round(dewPoint)} degrees` };
  }
  if ((gust ?? 0) >= 20 || (wind ?? 0) >= 12) {
    const value = Math.round(Math.max(gust ?? 0, wind ?? 0));
    return { type: "wind", label: `Wind ${value} mph`, ariaLabel: `wind up to ${value} miles per hour` };
  }
  return null;
}

export function buildFeelscoreRibbon(scored = []) {
  return scored
    .filter(({ hour, score }) => hour && Number.isFinite(Number(score)))
    .map(({ hour, score }) => {
      const numericScore = Math.round(Number(score));
      const band = scoreBand(numericScore);
      return {
        timestamp: Number(hour.timestamp),
        timeLabel: formatHour(hour.timestamp),
        score: numericScore,
        ...band
      };
    });
}

export function renderFeelscoreRibbon(target, scored = []) {
  const container = typeof target === "string" ? document.querySelector(target) : target;
  if (!container) return [];
  const segments = buildFeelscoreRibbon(scored);
  if (!segments.length) {
    container.hidden = true;
    container.innerHTML = "";
    return segments;
  }

  container.hidden = false;
  container.innerHTML = `
    <div class="feelscore-ribbon" style="--ribbon-count:${segments.length}" role="img" aria-label="${segments.map((segment) => `${segment.timeLabel}: FeelScore ${segment.score}, ${segment.label}`).join(". ")}">
      ${segments.map((segment) => `
        <div class="feelscore-ribbon-segment ${segment.className}" title="${segment.timeLabel}: ${segment.label}">
          <b>${segment.score}</b><span>${segment.timeLabel}</span>
        </div>
      `).join("")}
    </div>
  `;
  return segments;
}
