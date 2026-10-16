// Presentation only. Reads forecast hours; never recalculates FEELSCORE.
const zone = "America/New_York";
export function comfortDateKey(value) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
const number = value => value == null || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const timestamp = hour => { const t = number(hour.timestamp ?? hour.ts); return t == null ? NaN : t < 1e12 ? t * 1000 : t; };
const localHourOf = time => Number(new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", hourCycle: "h23" }).format(new Date(time)));
const percent = value => { const n = number(value); return n == null || n < 0 || n > 100 ? null : n <= 1 ? n * 100 : n; };
function timeLabel(hour, now, tomorrow) {
  const time = timestamp(hour);
  const clock = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric" }).format(new Date(time));
  return !tomorrow && comfortDateKey(time) !== comfortDateKey(now) ? `${clock} tomorrow` : clock;
}

function temperatureStory(hours, now, tomorrow) {
  const first = hours[0], last = hours.at(-1);
  const start = Math.round(number(first.temperatureF)), end = Math.round(number(last.temperatureF));
  const peak = hours.reduce((a, b) => number(b.temperatureF) > number(a.temperatureF) ? b : a);
  const trough = hours.reduce((a, b) => number(b.temperatureF) < number(a.temperatureF) ? b : a);
  const high = Math.round(number(peak.temperatureF)), low = Math.round(number(trough.temperatureF));
  const at = hour => timeLabel(hour, now, tomorrow);
  const opening = tomorrow ? "Tomorrow, temperatures" : "Temperatures";
  const warmth = high >= 85 ? "Hot" : high >= 80 ? "Warm" : high >= 65 ? "Mild" : high >= 50 ? "Cool" : "Chilly";
  const eveningAhead = !tomorrow && localHourOf(now) >= 12 && localHourOf(now) < 17 && hours.some(h => localHourOf(timestamp(h)) >= 17 && comfortDateKey(timestamp(h)) === comfortDateKey(now));
  let headline, narrative;
  if (hours.length === 1) {
    headline = "Limited hourly outlook";
    narrative = `${opening} look to be near ${start}°F at ${at(first)}. More hourly detail is still coming in.`;
  } else if (peak !== first && peak !== last && high - start >= 3 && high - end >= 3) {
    headline = eveningAhead ? `${warmth} afternoon, cooler evening` : "Warming up, then cooling off";
    narrative = `${opening} rise from around ${start}°F at ${at(first)} to near ${high}°F around ${at(peak)}, then ease to ${end}°F by ${at(last)}.`;
  } else if (trough !== first && trough !== last && start - low >= 3 && end - low >= 3) {
    headline = "Cooler first, then warming up";
    narrative = `${opening} dip from around ${start}°F at ${at(first)} to ${low}°F around ${at(trough)}, then recover to ${end}°F by ${at(last)}.`;
  } else if (end - start <= -3) {
    headline = eveningAhead ? `${warmth} afternoon, cooler evening` : localHourOf(now) >= 17 && !tomorrow ? "Cooling down tonight" : "Turning cooler";
    narrative = `${opening} fall from around ${start}°F at ${at(first)} to ${end}°F by ${at(last)}.`;
  } else if (end - start >= 3) {
    headline = `${high >= 85 ? "Turning hot" : "Warming up"}${tomorrow ? " tomorrow" : ""}`;
    narrative = `${opening} climb from around ${start}°F at ${at(first)} to ${end}°F by ${at(last)}.`;
  } else {
    headline = high - low < 3 ? `${warmth} and fairly steady` : "Temperatures go up and down";
    narrative = high - low < 3
      ? `${opening} hold near ${start}°F through ${at(last)}.`
      : `${opening} vary between ${low} and ${high}°F through ${at(last)}, ending near ${end}°F.`;
  }
  const gaps = hours.some((h, i) => i > 0 && timestamp(h) - timestamp(hours[i - 1]) > 90 * 60000);
  if (gaps) narrative += " Some hourly detail is missing between these times.";
  return { headline, narrative, hot: high >= 85 };
}

function skyState(hour) {
  const code = number(hour.weatherCode ?? hour.weather_code);
  if ([95, 96, 99].includes(code)) return "storms";
  if ([56, 57, 66, 67].includes(code)) return "ice";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "rain";
  if ([45, 48].includes(code)) return "fog";
  const cloud = percent(hour.cloudCover ?? hour.cloud_cover);
  if (cloud != null) return cloud >= 80 ? "cloudy" : cloud >= 35 ? "mixed" : "clear";
  return ({ 0: "clear", 1: "clear", 2: "mixed", 3: "cloudy" })[code] || null;
}

function skyStory(hours, now, tomorrow) {
  const states = hours.map(hour => ({ hour, state: skyState(hour) }));
  const at = hour => timeLabel(hour, now, tomorrow);
  const hazards = { storms: ["Thunderstorms are possible", "⛈️"], ice: ["Freezing rain or drizzle is possible", "🌧️"], snow: ["Snow is possible", "🌨️"], rain: ["Rain is possible", "🌧️"], fog: ["Fog may limit visibility", "🌫️"] };
  // Include impactful weather even when the first and last hours are clear.
  const hazard = ["storms", "ice", "snow", "rain", "fog"].map(kind => states.find(s => s.state === kind)).find(Boolean);
  let text = "", emoji = null;
  if (hazard) {
    [text, emoji] = hazards[hazard.state];
    text += ` around ${at(hazard.hour)}.`;
  } else {
    const first = states[0], last = states.at(-1);
    const descriptions = { clear: "Mostly clear skies", mixed: "A mix of clouds and clear breaks", cloudy: "Mostly cloudy skies" };
    if (first.state && last.state) {
      if (first.state === "clear" && last.state === "cloudy") text = `Clouds build, with mostly cloudy skies by ${at(last.hour)}.`;
      else if (first.state === "cloudy" && last.state === "clear") text = `Clouds give way to mostly clear skies by ${at(last.hour)}.`;
      else if (first.state !== last.state) text = `Expect ${descriptions[first.state].toLowerCase()} at first, then ${descriptions[last.state].toLowerCase()} by ${at(last.hour)}.`;
      else if (states.every(s => s.state === first.state)) text = `${descriptions[first.state]} through ${at(last.hour)}.`;
      else text = `Cloud cover varies through ${at(last.hour)}.`;
      emoji = ({ clear: "🌤️", mixed: "⛅", cloudy: "☁️" })[last.state];
      if (last.state === "clear" && (localHourOf(timestamp(last.hour)) >= 18 || localHourOf(timestamp(last.hour)) < 6)) emoji = "🌙";
    }
  }
  const wet = hours.find(h => percent(h.precipProbability) >= 30);
  if (!hazard && wet) {
    if (states.every(s => s.state === "clear")) text = "Mostly clear skies to start.";
    text += `${text ? " " : ""}Rain ${percent(wet.precipProbability) >= 60 ? "is likely" : "is possible"} around ${at(wet)} (${Math.round(percent(wet.precipProbability))}% chance).`;
    emoji = "🌦️";
  }
  return { text, emoji };
}

export function forecastComfortCopy({ item = {}, forecast = {}, hourly = [], tomorrow = false, now = Date.now() } = {}) {
  const date = new Date(`${comfortDateKey(now)}T12:00:00Z`);
  if (tomorrow) date.setUTCDate(date.getUTCDate() + 1);
  const key = date.toISOString().slice(0, 10);
  const hours = hourly.filter(h => Number.isFinite(timestamp(h)) && (tomorrow ? comfortDateKey(timestamp(h)) === key : timestamp(h) >= now && timestamp(h) <= now + 6 * 3600000)).sort((a,b) => timestamp(a)-timestamp(b));
  const authored = forecast.days?.[key];
  const temperatureHours = hours.filter(h => number(h.temperatureF) != null);
  const localHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", hourCycle: "h23" }).format(new Date(now)));
  // Keep tomorrow's published outlook; today's rolling copy follows upcoming hours.
  const useAuthored = authored && (tomorrow || !temperatureHours.length && localHour < 17) && (authored.headline || authored.narrative);
  if (useAuthored) {
    const high = number(authored.high), low = number(authored.low);
    const hot = high != null && high >= 85;
    const note = hot ? "Plan around the afternoon heat. The hourly curve and time windows show where comfort improves or slips." : "Use the hourly curve and time windows to see how the feel changes through the day.";
    const bullets = [high != null ? `Forecast high ${Math.round(high)}°F${low != null ? ` · low ${Math.round(low)}°F` : ""}` : null, authored.bestWindow, authored.mainIssue, authored.localInsight || authored.localNote].filter(Boolean);
    return { headline: authored.headline || (hot ? "Hot afternoon" : "Your forecast comfort read"), weatherNarrative: authored.narrative || "", narrative: [authored.narrative, note].filter(Boolean).join(" "), bullets, emoji: hot ? "🥵" : item.emoji || "🙂", caption: tomorrow ? "Tomorrow · period-average FEELSCORE" : "Current period · average FEELSCORE" };
  }
  if (!temperatureHours.length) {
    const narrative = "Hourly guidance is unavailable for this period. Check the authored forecast before making plans.";
    return { headline: "Comfort outlook updating", weatherNarrative: narrative, narrative, bullets: [], emoji: "🙂", caption: "Period-average FEELSCORE" };
  }
  const temperature = temperatureStory(temperatureHours, now, tomorrow);
  const sky = skyStory(hours, now, tomorrow);
  const weatherNarrative = [temperature.narrative, sky.text].filter(Boolean).join(" ");
  const dewpoints = hours.map(h => number(h.dewpointF)).filter(t=>t!=null);
  const winds = hours.map(h => number(h.windSpeed)).filter(t=>t!=null);
  return { headline: temperature.headline, weatherNarrative, narrative: weatherNarrative, bullets: [dewpoints.length ? `Dew points ${Math.round(Math.min(...dewpoints))}–${Math.round(Math.max(...dewpoints))}°F` : null, winds.length ? `Wind up to ${Math.round(Math.max(...winds))} mph` : null].filter(Boolean), emoji: sky.emoji || (temperature.hot ? "🥵" : "🙂"), caption: tomorrow ? "Tomorrow · period-average FEELSCORE" : "Current period · average FEELSCORE" };
}
