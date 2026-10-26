// Editorial planning context only: never infer observed canopy loss or season end.
export function seasonPresentation(peak, destinations, now = Date.now()) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
  const midpoint = Date.parse(`${peak.midpointIso}T00:00:00Z`);
  const windowEnd = new Date(midpoint + 3 * 86400000).toISOString().slice(0, 10);
  const afterMidpoint = date > peak.midpointIso;
  const pastWindow = date > windowEnd;
  const lowerSeason = date.slice(5) >= '10-15' && date.slice(5) <= '11-30';
  const lateAutumn = date.slice(5) >= '11-08' && date.slice(5) <= '11-30';
  const candidates = destinations.filter(site => Number.isFinite(site.elevationFeet) && (lowerSeason ? site.elevationFeet < 4000 : site.elevationFeet >= 4000));
  return {
    pastWindow,
    lowerSeason,
    heading: lateAutumn ? 'Late-autumn views and remaining color' : afterMidpoint ? 'Follow the remaining color' : 'Follow fall through the elevations',
    intro: lateAutumn ? 'Plan for mountain views, photography, and hiking weather. Check dated camera views for pockets of remaining color; the calendar alone cannot confirm the season has ended.' : afterMidpoint ? 'The regional season continues beyond one area’s estimated midpoint. Check lower slopes and valleys, camera views, and favorable weather for the remaining display.' : 'Find favorable weather, check camera views, and follow the changing display across elevations.',
    candidates: `${candidates.map(site => site.name).join(' · ') || 'Check the camera collection across elevations'}. ${lowerSeason ? 'Lower and middle elevations are the seasonal focus from mid-October into early November.' : 'Higher elevations are an early-season starting point.'} This is a broad planning reference, not confirmed color.`,
  };
}
