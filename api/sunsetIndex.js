
import { calculateSVI } from "../lib/sunsetAlgorithm.js";

export default async function handler(req, res) {

const lat = 35.595;
const lon = -82.551;

try {

const response = await fetch(
`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=cloudcover_low,cloudcover_mid,cloudcover_high,relativehumidity_2m`
);

const weather = await response.json();

const now = new Date();
const hour = now.getHours() + 2;

const svi = calculateSVI({
highCloud: weather.hourly.cloudcover_high[hour],
midCloud: weather.hourly.cloudcover_mid[hour],
lowCloud: weather.hourly.cloudcover_low[hour],
humidity: weather.hourly.relativehumidity_2m[hour],
pm25: 10
});

res.status(200).json({
location: "Asheville",
sunsetIndex: svi
});

} catch (error) {

res.status(500).json({ error: "Failed to calculate sunset index" });

}

}
