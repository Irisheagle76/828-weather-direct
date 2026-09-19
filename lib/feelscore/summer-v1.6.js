export const ENGINE_VERSION = 'FEELSCORE Summer Comfort Engine v1.6';

export const CATEGORIES = Object.freeze({
  0: { name: 'Unshaded', label: 'Unshaded', color: 'transparent' },
  1: { name: 'just alright', label: 'just alright 🫤', color: '#ef8c38' },
  2: { name: 'Fine, I guess', label: 'Fine, I guess 🤷🏻‍♀️', color: '#f2d357' },
  3: { name: 'Nice!', label: 'Nice! 👍', color: '#9bd85b' },
  4: { name: 'B.E.A. utiful', label: 'B.E.A. utiful 😎', color: '#28a96b' },
  5: { name: 'Goldilocks', label: 'Goldilocks 🏆', color: '#49d6c7' },
});

const clampCategory = (value) => Math.max(0, Math.min(5, value));

export function temperatureCeiling(temperatureF) {
  if (!Number.isFinite(temperatureF) || temperatureF < 52 || temperatureF > 90) return 0;
  if (temperatureF >= 67 && temperatureF <= 76) return 5;
  if (temperatureF >= 64 && temperatureF <= 80) return 4;
  if (temperatureF >= 60 && temperatureF <= 83) return 3;
  if (temperatureF >= 56 && temperatureF <= 87) return 2;
  return 1;
}

export function dewPointCeiling(dewPointF, temperatureF) {
  if (!Number.isFinite(dewPointF) || !Number.isFinite(temperatureF)) return null;
  if (dewPointF <= 57) return 5;
  if (dewPointF <= 60) return 3;
  if (dewPointF <= 62) {
    if (temperatureF <= 80) return 3;
    if (temperatureF <= 87) return 2;
    return 1;
  }
  if (dewPointF <= 65) return temperatureF <= 80 ? 2 : 1;
  if (dewPointF <= 67) {
    if (temperatureF <= 78) return 2;
    if (temperatureF <= 83) return 1;
    return 0;
  }
  if (dewPointF <= 69) return temperatureF <= 76 ? 1 : 0;
  return 0;
}

export function windDowngrade(temperatureF, windMph, gustMph) {
  if (!Number.isFinite(windMph)) return { downgrade: 0, hardFail: false, reason: 'wind missing' };
  let downgrade = 0;
  let hardFail = false;

  if (temperatureF <= 64) {
    if (windMph > 25) hardFail = true;
    else if (windMph >= 21) downgrade = 3;
    else if (windMph >= 16) downgrade = 2;
    else if (windMph >= 11) downgrade = 1;
  } else if (temperatureF <= 72) {
    if (windMph > 30) hardFail = true;
    else if (windMph >= 26) downgrade = 3;
    else if (windMph >= 21) downgrade = 2;
    else if (windMph >= 16) downgrade = 1;
  } else {
    if (windMph > 35) hardFail = true;
    else if (windMph >= 31) downgrade = 3;
    else if (windMph >= 26) downgrade = 2;
    else if (windMph >= 21) downgrade = 1;
  }

  if (!hardFail && Number.isFinite(gustMph) && gustMph >= 30) downgrade += 1;
  return { downgrade, hardFail, reason: hardFail ? 'wind hard limit' : `${downgrade} wind downgrade` };
}

export function skyDowngrade(temperatureF, skyCoverPct) {
  if (!Number.isFinite(skyCoverPct)) return 0;
  if (temperatureF <= 59 && skyCoverPct >= 75) return 2;
  if (temperatureF <= 64 && skyCoverPct >= 75) return 1;
  if (temperatureF <= 72 && skyCoverPct >= 90) return 1;
  if (temperatureF >= 83 && skyCoverPct <= 12) return 1;
  return 0;
}

function riskCap(probabilityPct) {
  if (!Number.isFinite(probabilityPct) || probabilityPct < 50) return 5;
  if (probabilityPct < 60) return 2;
  if (probabilityPct < 70) return 1;
  return 0;
}

export function isGoldilocksHour(hour) {
  return (
    hour.temperatureF >= 67 && hour.temperatureF <= 76 &&
    hour.dewPointF >= 35 && hour.dewPointF <= 53 &&
    Number.isFinite(hour.windMph) && hour.windMph >= 0 && hour.windMph <= 10 &&
    Number.isFinite(hour.gustMph) && hour.gustMph <= 15 &&
    Number.isFinite(hour.precipProbabilityPct) && hour.precipProbabilityPct <= 10 &&
    (!hour.precipProbabilitySource || hour.precipProbabilitySource === 'hourly-pop') &&
    !hour.precipExpected && !hour.thunder
  );
}

export function classifyHour(hour) {
  const tempCap = temperatureCeiling(hour.temperatureF);
  const dewCap = dewPointCeiling(hour.dewPointF, hour.temperatureF);
  const reasons = { temperatureCeiling: tempCap, dewPointCeiling: dewCap };

  if (tempCap === 0 || dewCap === 0) {
    return { category: 0, reasons: { ...reasons, hardFail: tempCap === 0 ? 'temperature' : 'dew point' } };
  }
  if (dewCap == null) {
    return { category: null, reasons: { ...reasons, hardFail: 'missing dew point' } };
  }

  const wind = windDowngrade(hour.temperatureF, hour.windMph, hour.gustMph);
  reasons.windModifier = wind.hardFail ? 'unshaded' : -wind.downgrade;
  if (wind.hardFail) return { category: 0, reasons };

  const cloudPenalty = skyDowngrade(hour.temperatureF, hour.skyCoverPct);
  reasons.skyModifier = -cloudPenalty;
  reasons.precipCap = riskCap(hour.precipProbabilityPct);
  reasons.thunderCap = riskCap(hour.thunderProbabilityPct);

  let category = Math.min(tempCap, dewCap);
  category = clampCategory(category - wind.downgrade - cloudPenalty);
  category = Math.min(category, reasons.precipCap, reasons.thunderCap);

  if (category === 5 && !isGoldilocksHour(hour)) category = 4;
  return { category, reasons };
}

function persistentCap(hours, field) {
  const values = hours.map((hour) => hour[field]).filter(Number.isFinite);
  const countAtLeast = (threshold) => values.filter((value) => value >= threshold).length;
  if (countAtLeast(70) >= 2) return 0;
  if (countAtLeast(60) >= 2) return 1;
  if (countAtLeast(40) >= 2 || countAtLeast(50) >= 1) return 2;
  return 5;
}

export function aggregateHours(hours) {
  if (!Array.isArray(hours) || hours.length !== 4 || hours.some((hour) => hour.category == null)) {
    return { category: null, rule: 'missing-data', caps: {} };
  }

  if (hours.every((hour) => hour.category === 5 && isGoldilocksHour(hour))) {
    return { category: 5, rule: 'goldilocks-four-for-four', caps: { precipitation: 5, thunder: 5 } };
  }

  const sorted = hours.map((hour) => hour.category).sort((a, b) => a - b);
  let category = sorted[1];
  const precipitation = persistentCap(hours, 'precipProbabilityPct');
  const thunder = persistentCap(hours, 'thunderProbabilityPct');
  category = Math.min(category, precipitation, thunder, 4);

  const likelyRainHours = hours.filter((hour) => hour.precipExpected && hour.precipCoverage === 'likely').length;
  if (likelyRainHours >= 2) category = 0;

  return { category, rule: 'second-worst-hour', caps: { precipitation, thunder, likelyRainHours } };
}

export function scorePeriod(rawHours) {
  const hours = rawHours.map((hour) => {
    const result = classifyHour(hour);
    return { ...hour, category: result.category, reasoning: result.reasons };
  });
  const final = aggregateHours(hours);
  return { hours, finalCategory: final.category, aggregation: final };
}
