
export function calculateSVI(data) {

const { highCloud, midCloud, lowCloud, humidity, pm25 } = data;

let cloudScore = 0;

if (highCloud >= 20 && highCloud <= 60) cloudScore += 40;
else if (highCloud >= 10 && highCloud < 20) cloudScore += 25;
else cloudScore += 10;

if (midCloud >= 10 && midCloud <= 40) cloudScore += 20;
else if (midCloud < 10) cloudScore += 10;
else cloudScore += 5;

if (lowCloud < 20) cloudScore += 20;
else if (lowCloud < 40) cloudScore += 10;

let humidityScore = 0;

if (humidity >= 30 && humidity <= 60) humidityScore = 10;
else if (humidity <= 75) humidityScore = 6;
else humidityScore = 2;

let aerosolScore = 0;

if (pm25 >= 5 && pm25 <= 15) aerosolScore = 15;
else if (pm25 < 5) aerosolScore = 8;
else if (pm25 <= 35) aerosolScore = 10;
else aerosolScore = 3;

let svi = cloudScore + humidityScore + aerosolScore;

return Math.min(svi, 100);

}
