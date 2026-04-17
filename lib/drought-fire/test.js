import { computeDroughtFireIndexLive } from "./computeDroughtFireIndex.js";

async function run() {
  const result = await computeDroughtFireIndexLive({
    tempAnomalyF: 8,
    daysSinceRain: 18,
    rh: 28,
    windGust: 18,
    tempF: 82
  });

  console.log(result);
}

run();