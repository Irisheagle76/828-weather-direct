import { calculateSVI } from "../lib/sunsetAlgorithm.js";

export default async function handler(req, res) {

const lat = 35.595;
const lon = -82.551;

try {

const weatherResponse = await fetch(
`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=cloudcover_low,cloudcover_mid,cloudcover_high,relativehumidity_2m`
);

const weather = await weatherResponse.json();

const now = new Date();
const hour = now.getHours() + 2;

const highCloud = weather.hourly.cloudcover_high[hour];
const midCloud = weather.hourly.cloudcover_mid[hour];
const lowCloud = weather.hourly.cloudcover_low[hour];
const humidity = weather.hourly.relativehumidity_2m[hour];

let svi = calculateSVI({
highCloud,
midCloud,
lowCloud,
humidity,
pm25: 10
});

if (highCloud >= 25 && highCloud <= 70 && lowCloud < 20) {
svi += 8;
}

if (svi > 100) svi = 100;

let alert = null;

if (svi >= 85) {
alert = {
message: "Spectacular sunset possible tonight in Asheville.",
score: svi,
peakColorWindow: "10–25 minutes after sunset",
suggestedSpots: [
"Blue Ridge Parkway",
"Craggy Gardens",
"Black Balsam",
"Mount Mitchell"
]
};
}

res.json({
sunsetIndex: svi,
alert
});

} catch (error) {

res.status(500).json({ error: "Sunset alert check failed" });

}

}
