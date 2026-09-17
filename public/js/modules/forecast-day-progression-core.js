(function (root) {
const ICONS = {
  sunny: "☀️",
  "mostly-sunny": "🌤️",
  "partly-cloudy": "⛅",
  cloudy: "☁️",
  overcast: "☁️",
  rain: "🌧️",
  showery: "🌦️",
  thunderstorm: "⛈️",
  stormy: "⛈️",
  snow: "🌨️",
  sleet: "🌨️",
  "wintry-mix": "🌨️",
  "freezing-rain": "🌧️"
};

function normalizeDayIcon(value) {
  const icon = String(value || "").trim();
  return ICONS[icon.toLowerCase().replaceAll("_", "-")] || (/[☀🌤⛅☁🌦🌧⛈🌨❄🧊]/u.test(icon) ? icon : null);
}

function skyIcon(sky) {
  return {
    clear: ICONS.sunny,
    mostly_sunny: ICONS["mostly-sunny"],
    partly_cloudy: ICONS["partly-cloudy"],
    mostly_cloudy: ICONS.cloudy,
    overcast: ICONS.overcast,
    showery: ICONS.showery,
    stormy: ICONS.stormy,
    rain: ICONS.rain,
    thunderstorm: ICONS.thunderstorm,
    snow: ICONS.snow,
    sleet: ICONS.sleet,
    wintry_mix: ICONS["wintry-mix"],
    freezing_rain: ICONS["freezing-rain"]
  }[sky] || null;
}

function skyCondition(sky) {
  return {
    clear: "Clear",
    mostly_sunny: "Mostly sunny",
    partly_cloudy: "Partly cloudy",
    mostly_cloudy: "Mostly cloudy",
    overcast: "Overcast",
    showery: "Showers possible",
    stormy: "Storms possible",
    rain: "Rain",
    thunderstorm: "Storms possible",
    snow: "Snow",
    sleet: "Sleet",
    wintry_mix: "Wintry mix",
    freezing_rain: "Freezing rain"
  }[sky] || null;
}

function iconCondition(value) {
  const key = String(value || "").trim().toLowerCase();
  return {
    sunny: "Sunny", "mostly-sunny": "Mostly sunny", "partly-cloudy": "Partly cloudy",
    cloudy: "Cloudy", overcast: "Overcast", rain: "Rain possible", showery: "Showers possible",
    thunderstorm: "Storms possible", stormy: "Storms possible", snow: "Snow possible",
    sleet: "Sleet possible", "wintry-mix": "Wintry mix possible",
    "freezing-rain": "Freezing rain possible"
  }[key] || null;
}

function iconForCondition(value) {
  const text = String(value || "").toLowerCase();
  if (/thunder|storm/.test(text)) return ICONS.thunderstorm;
  if (/sleet|snow|wintry|flurr/.test(text)) return ICONS.snow;
  if (/freezing rain|ice|icy/.test(text)) return ICONS["freezing-rain"];
  if (/shower/.test(text)) return ICONS.showery;
  if (/rain/.test(text)) return ICONS.rain;
  if (/cloud|overcast/.test(text)) return ICONS.cloudy;
  if (/sun|clear/.test(text)) return ICONS["mostly-sunny"];
  return null;
}

function rainTiming(value) {
  const start = String(value || "").trim();
  if (/overnight/i.test(start)) return "Overnight";
  if (/morning|\b(?:[6-9]|10|11)\s*am\b/i.test(start)) return "Morning";
  if (/midday|\bnoon\b|\b12\s*pm\b/i.test(start)) return "Midday";
  if (/afternoon|\b(?:[1-5])\s*pm\b/i.test(start)) return "Afternoon";
  if (/evening|night|overnight|\b(?:[6-9]|10|11)\s*pm\b/i.test(start)) return "Evening";
  return "Later";
}

function getDayProgression(day = {}, fallbackIcon = "☀️", fallbackCondition = "Forecast") {
  const laterChoice = String(day.laterIcon || "").trim();
  const noSecondIcon = laterChoice === "none";
  const authoredLater = !noSecondIcon && Boolean(laterChoice || String(day.laterCondition || "").trim());
  const stormRisk = String(day.stormRisk || "none").toLowerCase();
  const drySkies = ["clear", "mostly_sunny", "partly_cloudy", "mostly_cloudy", "overcast"].includes(day.sky);
  const evolvingStorms = ["isolated", "scattered", "numerous", "possible"].includes(stormRisk)
    && drySkies
    && (["building", "developing"].includes(day.evolution) || Boolean(day.rainWindow?.start));
  const evolvingRain = stormRisk === "none" && drySkies && day.evolution === "developing" && Boolean(day.rainWindow?.start);
  const clearing = ["clearing", "tapering"].includes(day.evolution)
    && ["mostly_cloudy", "overcast", "showery", "rain", "stormy", "thunderstorm", "snow", "sleet", "wintry_mix", "freezing_rain"].includes(day.sky)
    && stormRisk === "none";
  const twoPhase = !noSecondIcon && (authoredLater || evolvingStorms || evolvingRain || clearing);
  const legacyStormIcon = evolvingStorms && normalizeDayIcon(day.icon) === ICONS.thunderstorm;
  const firstIcon = authoredLater
    ? (legacyStormIcon ? skyIcon(day.sky) : normalizeDayIcon(day.icon)) || skyIcon(day.sky) || fallbackIcon
    : twoPhase
      ? skyIcon(day.sky) || normalizeDayIcon(day.icon) || fallbackIcon
      : normalizeDayIcon(day.icon) || fallbackIcon || skyIcon(day.sky);
  const first = {
    icon: firstIcon,
    condition: twoPhase
      ? skyCondition(day.sky) || String(day.condition || "").trim() || fallbackCondition
      : String(day.condition || "").trim() || skyCondition(day.sky) || fallbackCondition
  };
  if (!twoPhase) return { first, later: null };

  const stormCondition = stormRisk === "possible" || stormRisk === "none"
    ? "Storms possible"
    : `${stormRisk[0].toUpperCase()}${stormRisk.slice(1)} storms possible`;
  const legacyLaterCondition = String(day.laterCondition || "").trim();
  const inferredLater = authoredLater
    ? {
        icon: normalizeDayIcon(laterChoice) || iconForCondition(day.laterCondition) || first.icon,
        condition: normalizeDayIcon(laterChoice) === ICONS.thunderstorm && stormRisk !== "none" && (!legacyLaterCondition || legacyLaterCondition === "Storms possible")
          ? stormCondition
          : legacyLaterCondition || iconCondition(laterChoice) || skyCondition(laterChoice) || "Changing conditions"
      }
    : evolvingStorms
      ? { icon: ICONS.thunderstorm, condition: stormCondition }
      : evolvingRain
        ? { icon: ICONS.showery, condition: "Showers possible" }
        : day.evolution === "tapering"
          ? { icon: ICONS.cloudy, condition: "Drying later" }
          : { icon: ICONS["mostly-sunny"], condition: "Brighter later" };
  return {
    first,
    later: {
      icon: inferredLater.icon,
      condition: inferredLater.condition,
      timing: day.laterTiming ? rainTiming(day.laterTiming) : (evolvingStorms || evolvingRain ? rainTiming(day.rainWindow?.start) : "Later")
    }
  };
}

root.ForecastDayProgression = { normalizeDayIcon, skyIcon, skyCondition, getDayProgression };
})(globalThis);
