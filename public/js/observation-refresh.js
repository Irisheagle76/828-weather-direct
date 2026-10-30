export const OBSERVATION_INTERVAL_MS = 30 * 60 * 1000;
export const observationWindow = (now = Date.now()) => Math.floor(now / OBSERVATION_INTERVAL_MS) * OBSERVATION_INTERVAL_MS;

// Call after the initial page load. Timers follow the clock, not time since opening a tab.
export function scheduleObservationRefresh(refresh, { clock = Date.now, doc = document, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let lastWindow = observationWindow(clock());
  let timer;
  const check = () => {
    const window = observationWindow(clock());
    if (!doc.hidden && window !== lastWindow) {
      lastWindow = window;
      Promise.resolve().then(refresh).catch(() => {});
    }
  };
  const schedule = () => {
    timer = setTimer(() => { check(); schedule(); }, OBSERVATION_INTERVAL_MS - (clock() % OBSERVATION_INTERVAL_MS) + 1000);
  };
  doc.addEventListener('visibilitychange', check);
  schedule();
  return () => { clearTimer(timer); doc.removeEventListener('visibilitychange', check); };
}
