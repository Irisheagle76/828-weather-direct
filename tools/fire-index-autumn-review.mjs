import fs from 'node:fs';
import { normalizeInputs } from '../lib/drought-fire/normalize.js';
const base={precipDeficit90d_in:2.0449,precipDeficitSeasonal_in:2.6533,soilPercentile:27.4559,daysSinceRain:9,tempAnomalyF:-18.7,rainTodayIn:0,rainRateInHr:0};
const cases=[
  ['Humid morning',{tempF:39.2,rh:93,windGust:2.237}],
  ['Oct 22 afternoon snapshot',{tempF:69.4,rh:20,windGust:18.1}],
  ['Cool dry afternoon',{tempF:50,rh:20,windGust:18.1}],
  ['Dry but calm',{tempF:60,rh:20,windGust:2}],
  ['Humid and breezy',{tempF:60,rh:80,windGust:18}],
  ['Recent wetting rain',{tempF:60,rh:20,windGust:18,rainTodayIn:0.35}],
  ['Rain in progress',{tempF:60,rh:20,windGust:25,rainRateInHr:0.03}],
  ['No observed dry spell',{tempF:60,rh:20,windGust:18,daysSinceRain:null}],
  ['Severe drought, cool/dry/windy',{tempF:50,rh:15,windGust:30,precipDeficit90d_in:9,precipDeficitSeasonal_in:13,soilPercentile:1,daysSinceRain:24}]
];
const rows=cases.map(([scenario,weather])=>{
  const input={...base,...weather};
  const previous=normalizeInputs(input), autumn=normalizeInputs({...input,timestamp:Date.parse('2026-10-22T16:00:00Z')});
  return {scenario,previous:previous.FRI,autumn:autumn.FRI,drought:autumn.DSS,fineFuelProxyPoints:+autumn.components.autumnFineFuelPoints.toFixed(2)};
});
fs.mkdirSync('.tmp/fire-index',{recursive:true});
fs.writeFileSync('.tmp/fire-index/autumn-comparison.json',JSON.stringify(rows,null,2));
console.table(rows);
