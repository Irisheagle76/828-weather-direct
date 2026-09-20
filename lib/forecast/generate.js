const TZ = "America/New_York";

export function generateForecast(sources, now = new Date()) {
  const hourly = sources.hourly.properties.periods || [];
  const periods = sources.forecast.properties.periods || [];
  const first = addDays(dateKey(now), 1);
  const dates = Array.from({ length: 4 }, (_, index) => addDays(first, index));
  const days = Object.fromEntries(dates.map((date, index) => [date, deriveDay(date, index, hourly, periods, sources.afd)]));
  makeHeadlinesUnique(days);
  const list = Object.values(days);
  const best = [...list].sort((a, b) => b.feelScore - a.feelScore)[0];
  const maxPop = Math.max(...list.map(day => day._pop));
  const highs = list.map(day => day.high);
  return {
    boardHeadline: list.some(day => day.stormRisk !== "none") ? "Daily Storm Timing Matters Most" : "A Quieter Four-Day Stretch",
    boardSummary: boardSummary(list, sources.afd),
    rainRisk: maxPop >= 70 ? "high" : maxPop >= 35 ? "medium" : "low",
    comfortTrend: list.at(-1).feelScore > list[0].feelScore + 5 ? "improving" : list.at(-1).feelScore < list[0].feelScore - 5 ? "declining" : "steady",
    bestOutdoorDay: weekday(best.date),
    forecastConfidence: Math.round(average(list.map(day => day.confidence)) * 100),
    weekAheadSignals: {
      global: {
        weatherPattern: list.filter(day => day.stormRisk !== "none").length >= 2 ? "Midsummer storm cycle" : "Mostly quiet",
        rainfallTrend: list.at(-1)._pop > list[0]._pop + 15 ? "Increasing coverage" : list.at(-1)._pop < list[0]._pop - 15 ? "Drying trend" : "Typical summer pattern",
        mountainVisibility: list.some(day => /cloudy|overcast/.test(day.sky)) ? "Variable in clouds and rain" : "Generally good",
        temperatureTrend: highs.at(-1) >= highs[0] + 4 ? "Warming" : highs.at(-1) <= highs[0] - 4 ? "Cooling" : "Near seasonal",
        windSignal: Math.max(...list.map(day => day.wind.gust || day.wind.speedMax)) >= 30 ? "Occasionally gusty" : "Routine"
      },
      cards: [
        { label: "PICK OF THE WEEK", value: weekday(best.date), detail: "Best mix of comfort, rain timing, and useful outdoor hours.", type: "comfort" },
        { label: "LOWEST CONFIDENCE DAY", value: weekday([...list].sort((a, b) => a.confidence - b.confidence)[0].date), detail: "Timing and coverage carry the most uncertainty.", type: "uncertainty" }
      ]
    },
    days: Object.fromEntries(Object.entries(days).map(([key, day]) => { const { _pop, ...clean } = day; return [key, clean]; })),
    global: { tone: "human", style: "concise", overrideNarrative: true }
  };
}

function deriveDay(date, index, hours, periods, afd) {
  const hs = hours.filter(item => dateKey(item.startTime) === date);
  if (hs.length < 12) throw new Error(`Hourly forecast is incomplete for ${date}`);
  const temps = hs.map(item => Number(item.temperature)).filter(Number.isFinite);
  const pops = hs.map(item => Number(item.probabilityOfPrecipitation?.value || 0));
  const clouds = hs.map(item => cloud(item.shortForecast));
  const winds = hs.map(item => wind(item.windSpeed));
  const gusts = hs.map(item => gust(item.detailedForecast || "")).filter(Number.isFinite);
  const maxPop = Math.max(...pops), avgCloud = average(clouds), maxWind = Math.max(...winds);
  const dayPeriods = periods.filter(item => dateKey(item.startTime) === date);
  const officialText = dayPeriods.map(item => `${item.shortForecast || ""} ${item.detailedForecast || ""}`).join(" ");
  const storm = hs.some(item => /thunder/i.test(`${item.shortForecast} ${item.detailedForecast || ""}`)) || /thunder/i.test(officialText);
  const severe = /\bsevere\b/i.test(officialText) || afdSupportsSevere(afd?.productText, date, index);
  const officialHigh = dayPeriods.find(item => item.isDaytime && Number.isFinite(Number(item.temperature)))?.temperature;
  const officialLow = dayPeriods.find(item => !item.isDaytime && Number.isFinite(Number(item.temperature)))?.temperature;
  const high = Math.round(Number.isFinite(Number(officialHigh)) ? Number(officialHigh) : Math.max(...temps));
  const low = Math.round(Number.isFinite(Number(officialLow)) ? Number(officialLow) : Math.min(...temps));
  const wet = hs.filter((item, i) => pops[i] >= 30), bestWindow = bestPart(hs);
  const daytimeHours = hs.filter(item => localHour(item.startTime) >= 6 && localHour(item.startTime) <= 23);
  const firstDaytimeStorm = daytimeHours.find(item => /thunder/i.test(`${item.shortForecast} ${item.detailedForecast || ""}`));
  const firstDaytimeWet = daytimeHours.find(item => Number(item.probabilityOfPrecipitation?.value || 0) >= 30);
  const morningCloud = average(hs.filter(item => localHour(item.startTime) >= 6 && localHour(item.startTime) <= 11).map(item => cloud(item.shortForecast)));
  const afternoonCloud = average(hs.filter(item => localHour(item.startTime) >= 14 && localHour(item.startTime) <= 18).map(item => cloud(item.shortForecast)));
  const dayTimeline = selectiveTimeline(hs, { storm, maxPop, clouds });
  const story = language({
    storm,
    severe,
    maxPop,
    avgCloud,
    morningCloud,
    afternoonCloud,
    high,
    bestWindow,
    index,
    date,
    rainStart: firstDaytimeStorm?.startTime || firstDaytimeWet?.startTime || wet[0]?.startTime || null
  });
  return {
    date, confidence: clamp(.88 - index * .07 - (maxPop >= 30 && maxPop <= 60 ? .12 : 0) - (afd?.unavailable || afd?.stale ? .08 : 0), .45, .92),
    ...story, high, low,
    icon: storm ? "thunderstorm" : maxPop >= 40 ? "rain" : avgCloud >= 65 ? "cloudy" : avgCloud >= 35 ? "partly-cloudy" : "sunny",
    condition: storm ? "Storms possible" : maxPop >= 40 ? "Showers" : avgCloud >= 65 ? "Mostly cloudy" : avgCloud >= 35 ? "Partly cloudy" : "Mostly sunny",
    feelScore: clamp(Math.round(100 - Math.max(0, high - 78) * 1.2 - maxPop * .28 - Math.max(0, maxWind - 12) * .7 - avgCloud * .06), 0, 100),
    mainIssue: storm ? "Late storms" : maxPop >= 60 ? "Periods of rain" : maxPop >= 25 ? "Spotty rain" : high >= 88 ? "Afternoon heat" : avgCloud >= 75 ? "Mountain clouds" : "No major issue",
    bestWindow,
    wind: { direction: mode(hs.map(item => item.windDirection).filter(Boolean)) || null, speedMin: Math.min(...winds), speedMax: maxWind, calm: maxWind < 3, gust: gusts.length ? Math.max(...gusts) : null, gustNA: !gusts.length },
    sky: avgCloud >= 80 ? "overcast" : avgCloud >= 60 ? "mostly_cloudy" : avgCloud >= 35 ? "partly_cloudy" : "mostly_sunny",
    evolution: clouds.at(-1) > clouds[0] + 20 ? "building" : clouds.at(-1) < clouds[0] - 20 ? "clearing" : "steady",
    humidity: humidity(hs), stormRisk: storm ? (maxPop >= 60 ? "numerous" : "scattered") : maxPop >= 25 ? "possible" : "none",
    rainWindow: { start: wet.length ? formatTime(wet[0].startTime) : null, end: wet.length ? formatTime(wet.at(-1).endTime || wet.at(-1).startTime) : null },
    timeline: dayTimeline,
    localNote: avgCloud >= 70 ? "Ridges may stay cloudier longer, with reduced visibility at times." : maxWind >= 25 ? "Higher peaks may be noticeably windier than Asheville." : "Valleys may warm faster than the higher terrain during the afternoon.",
    tags: [storm && "late storms", maxPop >= 30 && "rain chance", high >= 88 && "summer heat"].filter(Boolean), needsReview: severe, _pop: maxPop
  };
}

export function language(x) {
  if (x.storm) {
    return stormStory(x);
  }
  if (x.maxPop >= 60) return { headline: "Periods of Rain Shape the Day", narrative: "Plan around periods of rain, though the steadier coverage may come and go. Clouds should keep temperatures from climbing as quickly as they otherwise would." };
  if (x.maxPop >= 25) return { headline: "A Few Showers, With Useful Dry Time", narrative: `A few showers may interrupt the day, but it does not look like a washout. ${x.bestWindow} offers the better opportunity for outdoor plans.` };
  if (x.avgCloud >= 65) {
    if (x.afternoonCloud <= x.morningCloud - 20) return { headline: "Clouds Ease, With Brighter Breaks Later", narrative: "The day starts on the gray side, especially near the higher terrain, before clouds gradually loosen their grip. Most places stay dry, with the better chance for sun arriving later." };
    if (x.afternoonCloud >= x.morningCloud + 20) return { headline: "Clouds Thicken as the Day Goes On", narrative: "Some early brightness may fade behind increasing cloud cover. Rain chances remain limited, so the main change is a grayer afternoon rather than a wet one." };
    return { headline: "Clouds Win Out, but Most Stay Dry", narrative: "Cloud cover looks persistent for much of the day, especially along the ridges. A few brighter intervals are possible, but meaningful rain disruption is not favored." };
  }
  return { headline: x.high >= 88 ? "Hot, Mainly Dry Afternoon" : "A Quieter Day Takes Shape", narrative: x.high >= 88 ? "Sunshine will help temperatures climb quickly, making afternoon heat the main concern. Rain disruption looks limited, with any extra clouds offering only brief relief." : "A mainly dry setup brings a useful stretch of outdoor weather. Sunshine mixes with passing clouds, without a meaningful rain interruption showing up yet." };
}

function stormStory(x) {
  const timing = stormTiming(x.rainStart);
  const coverage = x.maxPop >= 60 ? "more numerous showers and storms" : "scattered storms";
  const variant = x.index % 4;
  const temperature = temperatureSentence(x.high, variant);
  const storm = stormSentence(coverage, timing, variant);
  const window = windowSentence(x.bestWindow, variant);
  const headline = stormHeadline(x, timing);
  const narrative = `${temperature} ${storm} ${window}${x.severe ? " A few storms may become strong, in line with day-specific NWS guidance." : ""}`;
  return { headline, narrative };
}

function temperatureSentence(high, variant) {
  const feel = high >= 88 ? "hot" : high >= 80 ? "warm" : high >= 70 ? "mild" : "cool";
  return [
    `Temperatures reach around ${high}, making it a ${feel} day.`,
    `The forecast high is near ${high}, so expect ${feel} conditions.`,
    `Temperatures top out near ${high}, keeping the day ${feel}.`,
    `Expect a ${feel} high near ${high}.`
  ][variant];
}

function stormSentence(coverage, timing, variant) {
  const capitalized = capitalize(coverage);
  return [
    `${capitalized} remain possible ${timing}, with uneven coverage around Asheville.`,
    `Look for ${coverage} ${timing}; brief downpours are possible where they develop.`,
    `The main weather concern is ${coverage} ${timing}, and coverage will vary by neighborhood.`,
    `Keep an eye on ${coverage} ${timing}, with activity unlikely to affect every location equally.`
  ][variant];
}

function windowSentence(bestWindow, variant) {
  if (bestWindow === "Limited") return [
    "No part of the day looks reliably dry enough to call a clear best window yet.",
    "A dependable dry window is difficult to identify right now.",
    "The forecast does not offer a reliable dry period yet.",
    "Outdoor timing remains uncertain because no period clearly stands out."
  ][variant];
  return [
    `${bestWindow} currently looks like the best opportunity for outdoor plans.`,
    `The better opening for outdoor plans currently favors ${bestWindow.toLowerCase()}.`,
    `${bestWindow} carries the most usable outdoor window at this point.`,
    `For outdoor plans, ${bestWindow.toLowerCase()} has the more favorable signal right now.`
  ][variant];
}

function stormHeadline(x, timing) {
  const later = /afternoon|evening|later/.test(timing);
  const coverage = x.maxPop >= 60 ? "Storm Coverage Increases" : "Scattered Storms Remain Possible";
  if (x.high >= 88 && later) return "Heat Builds Before Storms Develop";
  if (x.high >= 80 && later) return x.maxPop >= 60 ? "Warm and Unsettled Later" : "Warm Day, With Storms Possible Later";
  if (x.high >= 70 && later) return x.maxPop >= 60 ? "Mild, With More Storms Later" : "Mild Day, With Storms Possible Later";
  if (x.high < 70 && later) return "Cooler Day, With Storms Possible Later";
  return `${coverage} ${headlineTiming(timing)}`;
}

function stormTiming(value) {
  if (!value) return "later in the day";
  const hour = localHour(value);
  if (hour < 12) return "during the morning";
  if (hour < 14) return "around midday";
  if (hour < 19) return "during the afternoon";
  return "during the evening";
}

function headlineTiming(timing) {
  return {
    "during the morning": "This Morning",
    "around midday": "Around Midday",
    "during the afternoon": "This Afternoon",
    "during the evening": "This Evening",
    "later in the day": "Later in the Day"
  }[timing] || capitalize(timing);
}

function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }

function timelineText(hs, start, end, part) { const set = hs.filter(item => localHour(item.startTime) >= start && localHour(item.startTime) <= end); const pop = Math.max(0, ...set.map(item => Number(item.probabilityOfPrecipitation?.value || 0))); if (set.some(item => /thunder/i.test(item.shortForecast))) return part === "afternoon" ? "Storms become more likely later" : "A storm remains possible"; if (pop >= 50) return "Periods of rain"; if (pop >= 25) return "A few showers possible"; if (average(set.map(item => cloud(item.shortForecast))) >= 70) return "Cloudy with a few brighter breaks"; return part === "morning" ? "Dry with some early sun" : "Warm and mainly dry"; }
function selectiveTimeline(hs, { storm, maxPop, clouds }) {
  const ranges = { morning:[6,11], midday:[12,14], afternoon:[15,18], evening:[19,23] };
  const result = { morning:null, midday:null, afternoon:null, evening:null };
  for (const [part,[start,end]] of Object.entries(ranges)) {
    const set = hs.filter(item => localHour(item.startTime) >= start && localHour(item.startTime) <= end);
    const pop = Math.max(0, ...set.map(item => Number(item.probabilityOfPrecipitation?.value || 0)));
    const thunder = set.some(item => /thunder/i.test(`${item.shortForecast} ${item.detailedForecast || ""}`));
    if (thunder || pop >= 50) result[part] = timelineText(hs, start, end, part);
  }
  const populated = Object.keys(result).filter(part => result[part]);
  if (populated.length > 2) {
    const keep = result.afternoon
      ? new Set(["afternoon", result.evening ? "evening" : populated[0]])
      : new Set(populated.slice(0, 2));
    for (const part of populated) if (!keep.has(part)) result[part] = null;
  }
  if (!Object.values(result).some(Boolean) && maxPop >= 30) {
    const wettest = Object.entries(ranges).map(([part,[start,end]]) => ({ part, start, end, pop:Math.max(0,...hs.filter(item=>localHour(item.startTime)>=start&&localHour(item.startTime)<=end).map(item=>Number(item.probabilityOfPrecipitation?.value||0))) })).sort((a,b)=>b.pop-a.pop)[0];
    result[wettest.part] = timelineText(hs, wettest.start, wettest.end, wettest.part);
  }
  if (!storm && maxPop < 30 && Math.abs(clouds.at(-1) - clouds[0]) >= 35) result.afternoon = clouds.at(-1) < clouds[0] ? "Clouds gradually break" : "Clouds build later";
  return result;
}
function bestPart(hs) { const parts = [[6,11,"Morning"],[12,14,"Midday"],[15,18,"Afternoon"],[19,23,"Evening"]].map(([a,b,label]) => ({ label, pop: average(hs.filter(item => localHour(item.startTime) >= a && localHour(item.startTime) <= b).map(item => Number(item.probabilityOfPrecipitation?.value || 0))) })).sort((a,b) => a.pop-b.pop); return parts[0].pop < 25 ? parts[0].label : "Limited"; }
function makeHeadlinesUnique(days) { const seen = new Set(); for (const day of Object.values(days)) { if (seen.has(day.headline)) day.headline = `${weekday(day.date)}: ${day.headline}`; seen.add(day.headline); } }
function afdSupportsSevere(text="", date, index) { if (!text || !/\bsevere\b/i.test(text)) return false; const day=weekday(date).toLowerCase(); const sentences=String(text).split(/(?<=[.!?])\s+/).filter(sentence=>/\bsevere\b/i.test(sentence)); return sentences.some(sentence => { const value=sentence.toLowerCase(); return value.includes(day) || (index===0 && /\b(today|tonight|tomorrow)\b/.test(value)); }); }
function boardSummary(days, afd) { const wet = days.filter(day => day._pop >= 30).length; return wet ? `${wet} of the next four days carry a meaningful rain chance, with timing and coverage more important than all-day rain.${afd?.stale ? " Confidence is trimmed because the latest GSP discussion is older than preferred." : ""}` : "The next four days lean mainly dry, with heat, humidity, and mountain cloud cover providing the smaller day-to-day changes."; }
function humidity(hs) { const value = average(hs.map(item => Number(item.relativeHumidity?.value)).filter(Number.isFinite)); return value >= 75 ? "humid" : value >= 55 ? "moderate" : "comfortable"; }
function cloud(text="") { if (/overcast/i.test(text)) return 90; if (/mostly cloudy/i.test(text)) return 75; if (/partly/i.test(text)) return 50; if (/mostly sunny|mostly clear/i.test(text)) return 25; if (/sunny|clear/i.test(text)) return 10; return 55; }
function wind(text="") { const values = (text.match(/\d+/g) || []).map(Number); return values.length ? Math.max(...values) : 0; }
function gust(text="") { const match = text.match(/gust(?:s|ing)?(?: as high as| up to)? (\d+)/i); return match ? Number(match[1]) : null; }
function dateKey(value) { return new Intl.DateTimeFormat("en-CA", { timeZone:TZ, year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date(value)); }
function addDays(key, count) { const date = new Date(`${key}T12:00:00-04:00`); date.setUTCDate(date.getUTCDate() + count); return dateKey(date); }
function weekday(key) { return new Intl.DateTimeFormat("en-US", { timeZone:TZ, weekday:"long" }).format(new Date(`${key}T12:00:00-04:00`)); }
function localHour(value) { return Number(new Intl.DateTimeFormat("en-US", { timeZone:TZ, hour:"numeric", hourCycle:"h23" }).format(new Date(value))); }
function formatTime(value) { return new Intl.DateTimeFormat("en-US", { timeZone:TZ, hour:"numeric" }).format(new Date(value)); }
function average(values) { return values.length ? values.reduce((a,b) => a+b, 0) / values.length : 0; }
function clamp(value,min,max) { return Math.max(min, Math.min(max,value)); }
function mode(values) { return values.sort((a,b) => values.filter(x => x===a).length - values.filter(x => x===b).length).at(-1); }
