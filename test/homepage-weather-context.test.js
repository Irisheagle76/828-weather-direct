import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('homepage weather context works after removing the station note', () => {
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const source=html.match(/    function buildSkyWeatherContext\([\s\S]*?(?=    function closestCurrentForecastHour)/)[0];
 const build=new Function('rememberStationObservation','normalizeProbabilityValue','latestSunriseAt','latestSunsetAt',source+'; return buildSkyWeatherContext;')(()=>null,value=>value>1?value/100:value,null,null);
 assert.equal(build(null,null),null);
 const context=build({temperature:42,cloudCover:0,relativeHumidity:60},{temperature:41});
 assert.equal(context.temperature,42);
 assert.equal(context.humidity,.6);
});
