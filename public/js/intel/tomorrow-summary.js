import { ashevilleDailyNormals } from "./asheville-normals.js";

const DISPLAY_TIME_ZONE = "America/New_York";
const TEMPERATURE_CONTEXT_THRESHOLD_F = 10;

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
  const apparentHigh = maximum(representative.map(heatIndexF).filter(Number.isFinite));
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
  const forecastDate = day?.date ?? day?.timestamp ?? day?.time ?? rows[0]?.timestamp;
  const normals = options.normals || ashevilleDailyNormals(forecastDate);
  const highDeparture = departure(high, normals?.high);
  const lowDeparture = departure(low, normals?.low);

  return {
    score,
    high,
    low,
    rainChance,
    headline: buildHeadline({ score, high, apparentHigh, rainChance, humidity, wind, cloudAvg }),
    narrative: [
      describeTemperature(low, high, { highDeparture, lowDeparture }),
      describeHumidity(humidity, { high, apparentHigh }),
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
      maxWind,
      normalHigh: finite(normals?.high),
      normalLow: finite(normals?.low),
      highDeparture,
      lowDeparture,
      apparentHigh,
      normalsPeriod: normals?.period || null
    }
  };
}

function buildHeadline({ score, high, apparentHigh, rainChance, humidity, wind, cloudAvg }) {
  if (Number.isFinite(rainChance) && rainChance >= 0.5) {
    return "Scattered showers may pop up at times tomorrow.";
  }
  if ((Number.isFinite(apparentHigh) && apparentHigh >= 90) ||
      (Number.isFinite(high) && high >= 85 && (humidity.muggy || humidity.noticeable))) {
    return "Hot and humid tomorrow—take it easier during the afternoon.";
  }
  if (Number.isFinite(high) && high >= 90) {
    return "The heat builds again tomorrow afternoon.";
  }
  if (Number.isFinite(high) && high >= 88) {
    return "A hot afternoon is ahead tomorrow.";
  }
  if (humidity.drying) {
    return "A humid start, then some welcome relief by afternoon.";
  }
  if (humidity.muggy) {
    return Number.isFinite(high) && high >= 85
      ? "Warm and muggy again tomorrow."
      : "Another muggy day is ahead.";
  }
  if (Number.isFinite(high) && high >= 86) {
    return "Another warm afternoon is on the way.";
  }
  if (Number.isFinite(high) && high >= 82 && humidity.noticeable) {
    return "A warm and humid afternoon is ahead.";
  }
  if (Number.isFinite(rainChance) && rainChance >= 0.25) {
    return "Not a washout, but keep an eye out for a passing shower.";
  }
  if (Number.isFinite(wind.avg) && wind.avg >= 12) {
    return "Breezy at times tomorrow.";
  }
  if (Number.isFinite(score) && score >= 80) {
    return "A pretty comfortable day is ahead.";
  }
  return "No major weather disruptions stand out tomorrow.";
}

function describeTemperature(low, high, context = {}) {
  if (!Number.isFinite(low) || !Number.isFinite(high)) {
    return "Tomorrow's temperature range is still coming into focus.";
  }

  const base = `Starting near ${Math.round(low)}°, then warming to around ${Math.round(high)}° by afternoon`;
  const highDeparture = meaningfulDeparture(context.highDeparture);
  const lowDeparture = meaningfulDeparture(context.lowDeparture);

  if (highDeparture && lowDeparture && Math.sign(highDeparture) === Math.sign(lowDeparture)) {
    return `${base}, with both ends of the day running at least 10° ${departureDirection(highDeparture)} average.`;
  }
  if (highDeparture) {
    return `${base}, about ${Math.round(Math.abs(highDeparture))}° ${departureDirection(highDeparture)} average for the date.`;
  }
  if (lowDeparture) {
    return `Starting near ${Math.round(low)}°—about ${Math.round(Math.abs(lowDeparture))}° ${departureDirection(lowDeparture)} average—then warming to around ${Math.round(high)}° by afternoon.`;
  }
  return `${base}.`;
}

function describeHumidity(humidity, context = {}) {
  const { morningDew, afternoonDew, eveningDew, drying, muggy, noticeable } = humidity;
  const heatStress = (Number.isFinite(context.apparentHigh) && context.apparentHigh >= 90) ||
    (Number.isFinite(context.high) && context.high >= 85 && (muggy || noticeable));

  if (drying) {
    const laterDew = Number.isFinite(eveningDew) && eveningDew < afternoonDew
      ? ` and into the upper ${dewDecade(eveningDew)}s by evening`
      : "";
    return `It starts humid, but drier air works in during the afternoon as dew points fall from around ${Math.round(morningDew)}° to ${Math.round(afternoonDew)}°${laterDew}.`;
  }
  if (muggy) {
    return heatStress
      ? `It stays muggy through the afternoon with dew points near ${Math.round(afternoonDew)}°; plan a slower pace during the hottest part of the day.`
      : `It stays muggy through the afternoon with dew points near ${Math.round(afternoonDew)}°.`;
  }
  if (noticeable) {
    return heatStress
      ? `You will notice the humidity during the afternoon, with dew points near ${Math.round(afternoonDew)}°; take it easier during the hottest part of the day.`
      : `You will notice some humidity during the afternoon, with dew points near ${Math.round(afternoonDew)}°.`;
  }
  if (Number.isFinite(afternoonDew)) {
    return "Humidity should not be much of a factor.";
  }
  return "The humidity forecast is still coming into focus.";
}

function describeWeather({ rainChance, cloudAvg, wind }) {
  const sentences = [];
  let sky = "";
  const breezy = Number.isFinite(wind.avg) && wind.avg >= 9;
  const lightBreeze = Number.isFinite(wind.avg) && wind.avg >= 5 && !breezy;

  if (Number.isFinite(cloudAvg)) {
    if (cloudAvg < 0.3) sky = "mostly sunny";
    else if (cloudAvg < 0.65) sky = "a mix of sun and clouds";
    else sky = "mostly cloudy";
  }

  if (sky && breezy) {
    const speed = Number.isFinite(wind.max) ? Math.round(wind.max) : Math.round(wind.avg);
    sentences.push(`${sky.charAt(0).toUpperCase()}${sky.slice(1)} and breezy at times, with winds near ${speed} mph.`);
  } else if (sky && lightBreeze) {
    sentences.push(`Expect ${sky} with a light breeze.`);
  } else if (sky) {
    sentences.push(`${sky.charAt(0).toUpperCase()}${sky.slice(1)}.`);
  } else if (lightBreeze) {
    sentences.push("A light breeze at times.");
  }

  if (breezy && !sky) {
    const speed = Number.isFinite(wind.max) ? Math.round(wind.max) : Math.round(wind.avg);
    sentences.push(`Breezy at times with winds near ${speed} mph.`);
  }

  if (Number.isFinite(rainChance)) {
    if (rainChance >= 0.5) sentences.push("A few showers may pop up at times.");
    else if (rainChance >= 0.25) sentences.push("Most of the day should stay dry, though a passing shower is possible.");
    else sentences.push("Rain is unlikely.");
  }

  return sentences.join(" ");
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

function departure(value, normal) {
  const forecast = finite(value);
  const baseline = finite(normal);
  return Number.isFinite(forecast) && Number.isFinite(baseline)
    ? Math.round((forecast - baseline) * 10) / 10
    : null;
}

function meaningfulDeparture(value) {
  return Number.isFinite(value) && Math.abs(value) >= TEMPERATURE_CONTEXT_THRESHOLD_F
    ? value
    : null;
}

function departureDirection(value) {
  return value > 0 ? "above" : "below";
}

function heatIndexF(hour = {}) {
  const temperature = finite(hour.temperatureF);
  const humidity = finite(hour.relativeHumidity);
  if (!Number.isFinite(temperature) || !Number.isFinite(humidity) || temperature < 80 || humidity < 40) {
    return temperature;
  }

  const simple = 0.5 * (
    temperature + 61 + ((temperature - 68) * 1.2) + (humidity * 0.094)
  );
  const adjustedTemperature = (simple + temperature) / 2;
  if (adjustedTemperature < 80) return adjustedTemperature;

  return -42.379 +
    2.04901523 * temperature +
    10.14333127 * humidity -
    0.22475541 * temperature * humidity -
    0.00683783 * temperature * temperature -
    0.05481717 * humidity * humidity +
    0.00122874 * temperature * temperature * humidity +
    0.00085282 * temperature * humidity * humidity -
    0.00000199 * temperature * temperature * humidity * humidity;
}
