const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function foliageSignal(category) {
  if (category === 'Color Preservation') return { tone: 'gentle', icon: '●', label: 'Leaves may last' };
  if (['Color Enhancement', 'Color Acceleration'].includes(category)) return { tone: 'gentle', icon: '↗', label: 'Color may develop' };
  if (['Color Arrest', 'Color Degradation'].includes(category)) return { tone: 'watch', icon: '❄', label: 'Cold may dull color' };
  if (['Premature Leaf Drop', 'Foliage Reset Event', 'Season Shutdown'].includes(category)) return { tone: 'watch', icon: '↓', label: 'Leaf loss possible' };
  return { tone: 'unknown', icon: '?', label: 'Forecast unavailable' };
}

export function renderFoliageGraphic(cards, lowerSeason) {
  const groups = [
    { title: 'Towns & lower slopes', subtitle: 'Below 4,000 ft', action: lowerSeason ? 'Start here for color' : 'Check how color is developing', icon: '🍁', cards: cards.filter(c => Number.isFinite(c.elevationFeet) && c.elevationFeet < 4000) },
    { title: 'High ridges', subtitle: '4,000 ft and above', action: lowerSeason ? 'Go for mountain views' : 'Start here for color', icon: '⛰', cards: cards.filter(c => Number.isFinite(c.elevationFeet) && c.elevationFeet >= 4000) },
  ];
  const unknown = cards.filter(c => !Number.isFinite(c.elevationFeet));
  if (unknown.length) groups.push({title:'Other stops', subtitle:'Elevation unavailable', action:'Check a recent view', icon:'◎', cards:unknown});
  return `<div class="foliage-landscape" aria-hidden="true"><svg viewBox="0 0 1000 140" preserveAspectRatio="none"><circle cx="170" cy="40" r="24" fill="#e9b967"/><path d="M0 140L0 110 160 80 260 108 410 55 500 85 660 8 755 72 835 25 1000 100V140Z" fill="#c6d3c5"/><path d="M0 140L0 122 180 105 310 120 490 88 575 108 740 54 875 100 1000 68V140Z" fill="#789489"/><path d="M0 140L0 130Q170 75 360 130T740 125L1000 140Z" fill="#bf864e"/></svg></div>
    <div class="foliage-zones">${groups.map(group => `<section class="foliage-zone"><header><span class="foliage-zone-icon" aria-hidden="true">${group.icon}</span><div><h3>${group.action}</h3><p>${group.title} <span>· ${group.subtitle}</span></p></div></header><div class="foliage-stops">${group.cards.length ? group.cards.map(card => {
      const signal = foliageSignal(card.consequence.primaryCategory);
      return `<details class="foliage-stop"><summary><span class="foliage-stop-name">${esc(card.name)}</span><span class="foliage-signal ${signal.tone}"><span aria-hidden="true">${signal.icon}</span> ${signal.label}</span><span class="foliage-expand" aria-hidden="true">+</span></summary><div class="foliage-stop-detail"><p>${esc(card.visitor.explanation)}</p><p><strong>Plan your visit:</strong> ${esc(card.visitor.action)}</p><p class="color-forecast-evidence">${esc(card.visitor.evidence)}</p><a href="#live">Check camera views ↓</a></div></details>`;
    }).join('') : '<p class="foliage-empty">No destinations available.</p>'}</div></section>`).join('')}</div>
    <section class="foliage-legend" aria-label="Weather outlook legend"><h3>What do the labels mean?</h3><p>These describe weather effects—not stages from early color to bare trees.</p><ul>${[
      ['Color Enhancement', 'Weather may help leaves keep changing.'],
      ['Color Preservation', 'Weather may help remaining leaves stay on trees.'],
      ['Color Degradation', 'Freezing weather may limit or dull the color.'],
      ['Premature Leaf Drop', 'Wind, rain or severe cold may bring leaves down.'],
      [null, 'Not enough fresh weather data to judge.']
    ].map(([category, meaning]) => {
      const signal = foliageSignal(category);
      const count = cards.filter(card => foliageSignal(card.consequence.primaryCategory).label === signal.label).length;
      return `<li><div><span class="foliage-signal ${signal.tone}"><span aria-hidden="true">${signal.icon}</span> ${signal.label}</span>${count ? `<small>${count} ${count === 1 ? 'stop' : 'stops'} now</small>` : ''}</div><span>${meaning}</span></li>`;
    }).join('')}</ul></section>
    <div class="foliage-graphic-footer"><span>Weather effect on leaves · select a place for details</span><a href="#live">See camera views →</a></div>`;
}
