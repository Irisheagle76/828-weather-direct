// Presentation only. Reuses published editorial fields; never recalculates scores.
const zone = "America/New_York";
export function comfortDateKey(value) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
const number = value => value == null || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const timestamp = hour => { const t = number(hour.timestamp ?? hour.ts); return t == null ? NaN : t < 1e12 ? t * 1000 : t; };

export function forecastComfortCopy({ item = {}, forecast = {}, hourly = [], tomorrow = false, now = Date.now() } = {}) {
  const date = new Date(`${comfortDateKey(now)}T12:00:00Z`);
  if (tomorrow) date.setUTCDate(date.getUTCDate() + 1);
  const key = date.toISOString().slice(0, 10);
  const hours = hourly.filter(h => Number.isFinite(timestamp(h)) && (tomorrow ? comfortDateKey(timestamp(h)) === key : timestamp(h) >= now && timestamp(h) <= now + 6 * 3600000)).sort((a,b) => timestamp(a)-timestamp(b));
  const authored = forecast.days?.[key];
  const localHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", hourCycle: "h23" }).format(new Date(now)));
  // Today's published full-day copy should not describe a past afternoon as future.
  const useAuthored = authored && (tomorrow || localHour < 17) && (authored.headline || authored.narrative);
  if (useAuthored) {
    const high = number(authored.high), low = number(authored.low);
    const hot = high != null && high >= 85;
    const note = hot ? "Plan around the afternoon heat. The hourly curve and time windows show where comfort improves or slips." : "Use the hourly curve and time windows to see how the feel changes through the day.";
    const bullets = [high != null ? `Forecast high ${Math.round(high)}°F${low != null ? ` · low ${Math.round(low)}°F` : ""}` : null, authored.bestWindow, authored.mainIssue, authored.localInsight || authored.localNote].filter(Boolean);
    return { headline: authored.headline || (hot ? "Hot afternoon" : "Your forecast comfort read"), weatherNarrative: authored.narrative || "", narrative: [authored.narrative, note].filter(Boolean).join(" "), bullets, emoji: hot ? "🥵" : item.emoji || "🙂", caption: tomorrow ? "Tomorrow · period-average FEELSCORE" : "Current period · average FEELSCORE" };
  }
  const temperatures = hours.map(h => number(h.temperatureF)).filter(t => t != null);
  if (!temperatures.length) return { headline: "Comfort outlook updating", narrative: "Hourly guidance is unavailable for this period. Check the authored forecast before making plans.", bullets: [], emoji: "🙂", caption: "Period-average FEELSCORE" };
  const low = Math.round(Math.min(...temperatures)), high = Math.round(Math.max(...temperatures));
  const hot = high >= 85;
  const period = tomorrow ? "Tomorrow" : localHour >= 17 ? "Over the next few hours tonight" : "Over the next six hours";
  const range = low === high ? `near ${high}°F` : `about ${low}–${high}°F`;
  const heat = hot ? "The warmer hours will feel hot; a better period-average score does not mean the afternoon is comfortable." : "Use the comfort curve to see how the feel changes by hour.";
  const dewpoints = hours.map(h => number(h.dewpointF)).filter(t=>t!=null);
  const winds = hours.map(h => number(h.windSpeed)).filter(t=>t!=null);
  return { headline: hot ? "Hot during the warmer hours" : localHour >= 17 && !tomorrow ? "Tonight's comfort outlook" : high >= 80 ? "Warm during the warmer hours" : "Hourly comfort outlook", weatherNarrative: `${period}, hourly guidance puts temperatures ${range}.`, narrative: `${period}, hourly guidance puts temperatures ${range}. ${heat}`, bullets: [dewpoints.length ? `Dew points ${Math.round(Math.min(...dewpoints))}–${Math.round(Math.max(...dewpoints))}°F` : null, winds.length ? `Wind up to ${Math.round(Math.max(...winds))} mph` : null].filter(Boolean), emoji: hot ? "🥵" : item.emoji || "🙂", caption: tomorrow ? "Tomorrow · period-average FEELSCORE" : "Current period · average FEELSCORE" };
}
