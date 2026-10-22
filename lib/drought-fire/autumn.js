import { clamp } from './utils.js';

// Local, provisional seasonal calibration; not an NCFS/NWS rating formula.
// NC fall climatology: https://climate.ncsu.edu/fire/learn/climatology/
// Ramp through early October and fade through early December. Calendar dates
// represent a seasonal tendency, not observed leaf fall or fuel moisture.
export function autumnWeight(timestamp) {
  if (!Number.isFinite(timestamp)) return 0;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return 0;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'numeric', day: 'numeric'
  }).formatToParts(date);
  const month = Number(parts.find(p => p.type === 'month').value);
  const day = Number(parts.find(p => p.type === 'day').value);
  if (month === 10) return clamp((day - 1) / 14, 0, 1);
  if (month === 11) return 1;
  if (month === 12) return clamp((15 - day) / 14, 0, 1);
  return 0;
}

