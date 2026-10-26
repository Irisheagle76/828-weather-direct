const COPY = {
  'Color Preservation': ['Weather may help the remaining leaves last', 'The weather looks more likely to help remaining leaves last than to knock them down quickly.'],
  'Color Enhancement': ['More color may still develop', 'The weather may allow leaves to keep changing where they are still healthy. It cannot tell us how colorful the trees are today.'],
  'Color Acceleration': ['Color could change more quickly', 'The coming cool-down may speed up the change in leaves that are still developing color. Check recent views again before choosing a day.'],
  'Color Arrest': ['Cold could limit further color', 'Several hours of hard freezing could damage leaves that have not finished changing. Waiting longer may not bring a brighter display.'],
  'Color Degradation': ['Cold may dull the remaining color', 'A sustained or repeated hard freeze could leave some leaves brown or less vivid. The amount of damage will vary from place to place.'],
  'Premature Leaf Drop': ['More leaves could come down', 'Wind or persistent rain could thin the remaining display, especially on exposed slopes.'],
  'Foliage Reset Event': ['A sharp loss of color is possible', 'Strong wind combined with severe cold could remove or damage many of the remaining leaves.'],
  'Season Shutdown': ['The remaining display is at risk', 'Repeated freezing, severe cold and strong wind could leave much less color to see. Sheltered pockets may still hold leaves.'],
};

export function visitorGuidance(site, consequence, now = Date.now()) {
  const category = consequence.primaryCategory;
  const d = consequence.diagnostics || {};
  const copy = COPY[category];
  if (!copy) return { title: 'Check conditions before making the trip', explanation: 'There is not enough fresh forecast information to say how the weather will affect leaves here.', action: 'Open a recent camera view and check the local forecast before choosing this destination.', evidence: 'Weather outlook unavailable.' };
  const monthDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', month: '2-digit', day: '2-digit' }).format(new Date(now));
  const late = monthDay >= '10-15' && monthDay <= '11-30';
  const high = Number.isFinite(site.elevationFeet) && site.elevationFeet >= 4000;
  const low = Number.isFinite(site.elevationFeet) && site.elevationFeet < 4000;
  const threatened = ['Premature Leaf Drop', 'Foliage Reset Event', 'Season Shutdown', 'Color Arrest', 'Color Degradation'].includes(category);
  let action = late && high
    ? 'Choose this stop for mountain views; check a recent camera image before making a trip mainly for leaves. Color usually changes earlier at this elevation.'
    : late && low
      ? 'Start your color search around town and on nearby lower slopes. These elevations often change later than the summits; check a recent view before setting out.'
      : 'Check a recent camera view for color, then use the viewing-weather recommendations above to choose when to go.';
  if (threatened) action = 'Check the local forecast for the wind, rain or freeze timing before choosing a day. Look for sheltered lower slopes, and check a new camera image after the weather passes.';
  const numbers = [];
  const missing = consequence.missingInputs || [];
  if (Number.isFinite(d.peakGust) && !missing.some(text => text.includes('Wind coverage'))) numbers.push(`gusts up to ${Math.round(d.peakGust)} mph`);
  if (Number.isFinite(d.rainIn) && !missing.some(text => text.includes('Rainfall coverage'))) numbers.push(`${d.rainIn.toFixed(2)} inches of rain`);
  if (Number.isFinite(d.minimumF)) numbers.push(`coldest temperature near ${Math.round(d.minimumF)}°F`);
  const through = Number.isFinite(d.through) ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }).format(new Date(d.through)) : null;
  return { title: copy[0], explanation: copy[1], action, evidence: `${through ? `Forecast through ${through}` : 'Available forecast'}${numbers.length ? `: ${numbers.join('; ')}.` : '.'}` };
}

export function visitorSummary(cards) {
  const usable = cards.filter(card => card.consequence.primaryCategory);
  if (!usable.length) return 'Check recent camera views and local forecasts before planning a foliage trip. There is not enough fresh weather information for this outlook.';
  const allHolding = usable.every(card => card.consequence.primaryCategory === 'Color Preservation');
  if (allHolding) return 'The available forecasts suggest remaining leaves may hang on a little longer. That helps where trees still have color, but it will not bring leaves back to bare branches. Use the location advice below to decide where to look.';
  return 'Some places may keep their leaves longer than others as the weather changes. Use the cards below to see what could change at each stop and how to plan around it.';
}
