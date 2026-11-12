// Presentation helpers shared by the homepage render and its regression tests.
const number = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
export function hourlyWind(hour = {}) {
  const speed = number(hour.windSpeed), gust = number(hour.windGust);
  return { speed: speed == null ? null : Math.round(speed), gust: gust != null && gust >= 20 && (speed == null || gust >= speed + 5) ? Math.round(gust) : null };
}
export function clothingDetail(cue) {
  return ({
    'Take a rain layer': 'A rain jacket and shoes that can handle wet ground will make time outside easier.',
    'Coat weather': 'Wear a warm coat over layers. Add a hat and gloves for longer stretches outside.',
    'Bring a light jacket': 'A long-sleeve top and light jacket. Keep the jacket with you if you’re staying out.',
    'Add a wind layer': 'Wear a wind-resistant outer layer, especially on ridges and in exposed spots.',
    'Dress light': 'Choose lightweight, breathable clothing and take breaks in the shade.',
    'Light, breathable layers': 'Keep clothing light and breathable. Bring water for longer outings.',
    'Add sun protection': 'Add sunglasses, sunscreen, and a hat for time in direct sun.',
    'Easy everyday layers': 'Comfortable everyday clothes work well. Keep a light layer handy for later.',
    'Comfortable layers': 'Choose layers you can add or remove as conditions change.'
  })[cue] || 'Choose layers you can add or remove as conditions change.';
}
export function comfortFeel(hour = {}) {
  const temp = number(hour.temperatureF), wind = hourlyWind(hour);
  if (temp == null) return { emoji: '⏳', label: 'Updating' };
  if (temp <= 40) return { emoji: '🧣', label: 'Bundle up' };
  if (temp >= 85) return { emoji: '🥵', label: 'Dress light' };
  if (wind.gust || wind.speed >= 12) return { emoji: '🍃', label: temp < 60 ? 'Cool & breezy' : 'Breezy' };
  if (temp < 60) return { emoji: '🧥', label: 'Light layers' };
  return { emoji: '🙂', label: 'Easy outside' };
}
export function headsUpAction(takeaway, hours = []) {
  if (/cool|fall|drop|down.*from now/i.test(takeaway?.text || '')) return '🧥 Staying out later? Bring a warmer layer.';
  if (/warm|heat|rise/i.test(takeaway?.text || '')) return '👕 Keep your layers easy to adjust.';
  if (hours.some(h => hourlyWind(h).gust >= 25)) return '🍃 Bring a wind layer for exposed spots.';
  if (hours.some(h => number(h.precipProbability) >= .4)) return '☔ Keep a rain layer handy.';
  return '🚶 Plan your layers for later.';
}
