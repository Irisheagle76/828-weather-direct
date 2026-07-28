const DISPLAY_TIME_ZONE = "America/New_York";

export function buildTomorrowSummary(hours = [], day = null, fallback = {}, options = {}) {
  const scoreHour = typeof options.scoreHour === "function"
    ? options.scoreHour
    : (hour) => Number(hour?.comfortScore);
  const localHour = typeof options.localHour === "function"
    ? options.localHour
    : easternHour;

  const rows = hours
    .map((hour) => ({ ...hour, localHour: localHour(hour.timestamp) }))
    .filter((hour) => Number.isFinite(hour.localHour));
  const active = windowRows(rows, 8, 20);
  const morning = windowRows(rows, 6, 10);
  const afternoon = windowRows(rows, 13, 18);
  const evening = windowRows(rows, 19, 23);
  const representative = active.length ? active : rows;

  const temps = values(rows, "temperatureF");
  const scores = representative.map(scoreHour).filter(Number.isFinite);
  const daytimeDew = average(values(representative, "dewpointF"));
  const morningDew = average(values(morning, "dewpointF"));
  const afternoonDew = average(values(afternoon, "dewpointF"));
  const eveningDew = average(values(evening, "dewpointF"));
  const activeWind = values(representative, "windSpeed");
  const cloudAvg = average(values(representative, "cloudCover"));
  const rainValues = values(rows, "precipProbability");
  const activeRainValues = values(representative, "precipProbability");

  const low = finite(day?.tempMin) ?? minimum(temps);
  const high = finite(day?.tempMax) ?? maximum(temps);
  const score = scores.length
    ? Math.round(average(scores))
    : Math.round(Number(fallback.score));
  const rainChance = maximum(activeRainValues)
    ?? maximum(rainValues)
    ?? finite(day?.precipProbability);
  const avgWind = average(activeWind);
  const maxWind = maximum(activeWind);
  const dryingAmount = Number.isFinite(morningDew) && Number.isFinite(afternoonDew)
    ? morningDew - afternoonDew
    : 0;

  const representativeDew = afternoonDew ?? daytimeDew;
  const humidity = {
    daytimeDew,
    morningDew,
    afternoonDew,
    eveningDew,
    dryingAmount,
    drying: dryingAmount >= 4 && Number.isFinite(afternoonDew) && afternoonDew < 65,
    muggy: Number.isFinite(representativeDew) && representativeDew >= 67,
    noticeable: Number.isFinite(representativeDew) && representativeDew >= 60
  };
  const wind = { avg: avgWind, max: maxWind };

  return {
    score,
    high,
    low,
    rainChance,
    headline: buildHeadline({ score, high, rainChance, humidity, wind }),
    narrative: [
      describeTemperature(low, high),
      describeHumidity(humidity),
      describeWeather({ rainChance, cloudAvg, wind })
    ].filter(Boolean).join(" "),
    diagnostics: {
      scoreWindow: "8 AM-8 PM",
      daytimeDew,
      morningDew,
      afternoonDew,
      eveningDew,
      dryingAmount,
      avgWind,
      maxWind
    }
  };
}

function buildHeadline({ score, high, rainChance, humidity, wind }) {
  if (Number.isFinite(rainChance) && rainChance >= 0.5) {
    return "Showers may interrupt tomorrow's comfort.";
  }
  if (Number.isFinite(high) && high >= 90) {
    return "Heat becomes tomorrow's main comfort challenge.";
  }
  if (humidity.drying) {
    return Number.isFinite(wind.avg) && wind.avg >= 9
      ? "Humidity backs off as a breezy afternoon takes shape."
      : "A fresher afternoon takes over tomorrow.";
  }
  if (humidity.muggy) {
    return Number.isFinite(high) && high >= 85
      ? "Warm, muggy air keeps comfort in check tomorrow."
      : "Muggy air lingers through tomorrow.";
  }
  if (Number.isFinite(high) && high >= 86) {
    return "Afternoon warmth becomes tomorrow's main comfort challenge.";
  }
  if (Number.isFinite(wind.avg) && wind.avg >= 12) {
    return "A lively breeze shapes tomorrow's feel.";
  }
  if (Number.isFinite(score) && score >= 80) {
    return "Tomorrow brings an easy, comfortable feel.";
  }
  return "Tomorrow looks pleasant with a few subtle tradeoffs.";
}

function describeTemperature(low, high) {
  if (!Number.isFinite(low) || !Number.isFinite(high)) {
    return "Tomorrow's temperature range is still coming into focus.";
  }
  return `After a start near ${Math.round(low)}°, temperatures climb to around ${Math.round(high)}° during the afternoon.`;
}

function describeHumidity(humidity) {
  const { morningDew, afternoonDew, eveningDew, drying, muggy, noticeable } = humidity;

  if (drying) {
    const laterDew = Number.isFinite(eveningDew) && eveningDew < afternoonDew
      ? ` and into the upper ${dewDecade(eveningDew)}s by evening`
      : "";
    return `The humid start should not last: dew points ease from near ${Math.round(morningDew)}° in the morning to around ${Math.round(afternoonDew)}° during the afternoon${laterDew}.`;
  }
  if (muggy) {
    return `Afternoon dew points hold near ${Math.round(afternoonDew)}°, keeping a distinctly muggy edge in the air.`;
  }
  if (noticeable) {
    return `Afternoon dew points settle near ${Math.round(afternoonDew)}°, leaving some humidity without making it the day's defining feature.`;
  }
  if (Number.isFinite(afternoonDew)) {
    return `Afternoon dew points near ${Math.round(afternoonDew)}° should keep the air feeling relatively light.`;
  }
  return "The humidity trend is still being resolved from the hourly forecast.";
}

function describeWeather({ rainChance, cloudAvg, wind }) {
  const pieces = [];

  if (Number.isFinite(wind.avg) && wind.avg >= 9) {
    const speed = Number.isFinite(wind.max) ? Math.round(wind.max) : Math.round(wind.avg);
    pieces.push(`a steady breeze occasionally near ${speed} mph keeps the air moving`);
  } else if (Number.isFinite(wind.avg) && wind.avg >= 5) {
    pieces.push("a light breeze adds a little movement");
  }

  if (Number.isFinite(cloudAvg)) {
    if (cloudAvg < 0.3) pieces.push("sunshine has plenty of room");
    else if (cloudAvg < 0.65) pieces.push("sun and clouds trade places");
    else pieces.push("clouds hold onto much of the sky");
  }

  if (Number.isFinite(rainChance)) {
    if (rainChance >= 0.5) pieces.push("showers remain a meaningful interruption");
    else if (rainChance >= 0.25) pieces.push("a passing shower cannot be ruled out");
    else pieces.push("rain offers little interference");
  }

  if (!pieces.length) return "";
  const sentence = joinNatural(pieces);
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

function windowRows(rows, start, end) {
  return rows.filter((hour) => hour.localHour >= start && hour.localHour <= end);
}

function easternHour(timestamp) {
  if (!Number.isFinite(Number(timestamp))) return null;
  return Number(new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: DISPLAY_TIME_ZONE
  }).format(new Date(Number(timestamp))));
}

function values(rows, key) {
  return rows.map((row) => finite(row?.[key])).filter(Number.isFinite);
}

function average(items) {
  return items.length ? items.reduce((sum, value) => sum + value, 0) / items.length : null;
}

function minimum(items) {
  return items.length ? Math.min(...items) : null;
}

function maximum(items) {
  return items.length ? Math.max(...items) : null;
}

function finite(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dewDecade(value) {
  return Math.floor(Number(value) / 10) * 10;
}

function joinNatural(items) {
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return `${items[0]}, while ${items[1]}`;
  return `${items[0]}, while ${items.slice(1).join(" and ")}`;
}
