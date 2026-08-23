function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function fraction(value) {
  const number = finite(value);
  if (number == null) return null;
  return Math.max(0, Math.min(1, number > 1 ? number / 100 : number));
}

function timestamp(value) {
  if (Number.isFinite(value)) return value < 1e12 ? value * 1000 : value;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function solarBounds(now, daily = []) {
  const key = new Date(now).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const day = daily.find((item) => {
    const value = item?.timestamp ?? item?.date ?? item?.time;
    const parsed = timestamp(value);
    return Number.isFinite(parsed) && new Date(parsed).toLocaleDateString("en-CA", { timeZone: "America/New_York" }) === key;
  });
  return { sunrise: timestamp(day?.sunrise), sunset: timestamp(day?.sunset) };
}

function phaseAt(now, daily = []) {
  const { sunrise, sunset } = solarBounds(now, daily);
  if (Number.isFinite(sunrise) && Math.abs(now - sunrise) <= 55 * 60 * 1000) return "twilight";
  if (Number.isFinite(sunset) && Math.abs(now - sunset) <= 55 * 60 * 1000) return "twilight";
  if (Number.isFinite(sunrise) && Number.isFinite(sunset)) return now < sunrise || now >= sunset ? "night" : "day";
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" }).format(new Date(now))) % 24;
  return hour < 6 || hour >= 20 ? "night" : "day";
}

export function resolveBlueRidgeScene({ currentHour = {}, forecastHour = {}, daily = [], now = Date.now() } = {}) {
  const source = { ...forecastHour, ...currentHour };
  const code = finite(source.weatherCode ?? source.weather_code);
  const cloud = fraction(forecastHour.cloudCover ?? currentHour.cloudCover);
  const humidity = fraction(currentHour.relativeHumidity ?? currentHour.relative_humidity ?? forecastHour.relativeHumidity);
  const precip = finite(source.precipAmount ?? source.precipitation ?? source.rain) ?? 0;
  const phase = phaseAt(now, daily);
  const thunder = code != null && code >= 95;
  const snow = (code != null && ((code >= 71 && code <= 77) || (code >= 85 && code <= 86))) || (finite(source.snowfall) ?? 0) > 0;
  const fog = code === 45 || code === 48;
  const rain = precip >= 0.005 || (code != null && ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)));

  let state = "clear";
  if (thunder) state = "thunderstorm";
  else if (snow) state = "snow";
  else if (fog) state = "fog";
  else if (rain) state = precip >= 0.1 ? "heavy-rain" : "rain";
  else if ((cloud ?? 0) >= 0.88) state = "overcast";
  else if ((cloud ?? 0) >= 0.58) state = "mostly-cloudy";
  else if ((cloud ?? 0) >= 0.25) state = "partly-cloudy";

  const visualState = phase === "night" && !["thunderstorm", "snow", "fog", "rain", "heavy-rain"].includes(state)
    ? "night"
    : phase === "twilight" && !["thunderstorm", "snow", "fog", "rain", "heavy-rain"].includes(state)
      ? "twilight"
      : state;
  const labels = {
    clear: "Clear over the Blue Ridge",
    "partly-cloudy": "Clouds crossing the Blue Ridge",
    "mostly-cloudy": "A cloudier Blue Ridge sky",
    overcast: "Cloud deck over the ridges",
    rain: "Rain over the Blue Ridge",
    "heavy-rain": "Heavier rain crossing the ridges",
    thunderstorm: "Storm signal over the ridges",
    snow: "Snow over the Blue Ridge",
    fog: "Fog settling into the ridges",
    night: "Night across the Blue Ridge",
    twilight: "Blue Ridge twilight"
  };

  return {
    state: visualState,
    weatherState: state,
    phase,
    cloud,
    humidity,
    label: labels[visualState],
    description: `Stylized Asheville scene based on ${state.replace(/-/g, " ")} conditions${Number.isFinite(cloud) ? ` and ${Math.round(cloud * 100)} percent cloud cover` : ""}.`
  };
}

function cloudMarkup(state) {
  const count = state === "overcast" || state === "heavy-rain" || state === "thunderstorm" ? 4 : state === "mostly-cloudy" || state === "rain" || state === "snow" ? 3 : state === "partly-cloudy" ? 2 : 0;
  return Array.from({ length: count }, (_, index) => {
    const x = 430 + index * 92;
    const y = 44 + (index % 2) * 25;
    return `<g class="scene-cloud" transform="translate(${x} ${y})"><ellipse cx="0" cy="18" rx="54" ry="18"/><circle cx="-25" cy="8" r="24"/><circle cx="13" cy="4" r="30"/><circle cx="39" cy="13" r="20"/></g>`;
  }).join("");
}

function precipitationMarkup(state) {
  if (["rain", "heavy-rain", "thunderstorm"].includes(state)) {
    return Array.from({ length: state === "heavy-rain" ? 18 : 11 }, (_, index) => {
      const x = 455 + index * 25;
      const y = 86 + (index % 3) * 10;
      return `<line class="scene-rain" x1="${x}" y1="${y}" x2="${x - 8}" y2="${y + 20}"/>`;
    }).join("");
  }
  if (state === "snow") {
    return Array.from({ length: 20 }, (_, index) => `<circle class="scene-snow" cx="${430 + (index * 37) % 330}" cy="${78 + (index * 23) % 82}" r="${index % 3 === 0 ? 3 : 2}"/>`).join("");
  }
  return "";
}

export function renderBlueRidgeWeatherScene(target, options = {}) {
  const container = typeof target === "string" ? document.querySelector(target) : target;
  if (!container) return null;
  const scene = resolveBlueRidgeScene(options);
  const showSun = scene.phase !== "night" && ["clear", "partly-cloudy", "twilight"].includes(scene.state);
  const showMoon = scene.state === "night";
  const showFog = scene.weatherState === "fog";
  const showLightning = scene.weatherState === "thunderstorm";

  container.hidden = false;
  container.innerHTML = `
    <figure class="blue-ridge-scene ${scene.state}" role="img" aria-label="${scene.description}">
      <svg class="blue-ridge-scene-svg" viewBox="0 0 900 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        ${showSun ? `<circle class="scene-sun" cx="735" cy="52" r="28"/>` : ""}
        ${showMoon ? `<circle class="scene-moon" cx="735" cy="48" r="23"/><circle cx="745" cy="40" r="22" fill="var(--scene-sky-top)"/>` : ""}
        ${cloudMarkup(scene.weatherState)}
        ${precipitationMarkup(scene.weatherState)}
        ${showLightning ? `<path class="scene-lightning" d="M615 78h22l-15 28h14l-34 43 10-32h-16Z"/>` : ""}
        <path class="scene-ridge-far" d="M0 150 86 103l72 28 94-70 79 55 86-36 91 55 97-63 74 44 92-68 129 93v79H0Z"/>
        ${showFog ? `<path class="scene-fog" d="M0 139c116-33 199 28 319-1s198 27 310-3 171 1 271 11v42H0Z"/>` : ""}
        <path class="scene-ridge-mid" d="M0 174 111 124l91 49 110-66 99 51 102-40 93 47 103-61 86 48 105-31v99H0Z"/>
        <path class="scene-ridge-near" d="M0 192 118 157l106 32 128-43 117 38 109-29 112 38 139-51 171 48v30H0Z"/>
      </svg>
      <figcaption class="blue-ridge-scene-copy">
        <div class="blue-ridge-scene-kicker">Blue Ridge weather scene · experimental</div>
        <strong>${scene.label}</strong>
        <span>Data-driven illustration · live camera remains the visual ground truth.</span>
      </figcaption>
    </figure>
  `;
  return scene;
}
