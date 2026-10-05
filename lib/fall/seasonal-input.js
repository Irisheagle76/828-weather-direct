import { readFileSync } from "node:fs";

const INPUTS = JSON.parse(readFileSync(new URL("./seasonal-inputs.json", import.meta.url), "utf8").replace(/^\uFEFF/, ""));

export function seasonalPeakTimingInput(now, env = process.env, inputs = INPUTS) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "numeric" }).formatToParts(new Date(now));
  const seasonYear = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const empty = { seasonYear, septemberMeanF: null, source: null };
  if (month < 10) return empty;
  const validMean = (value) => value != null && value !== "" && Number.isFinite(Number(value)) && Number(value) >= 45 && Number(value) <= 85;
  // A reviewed, year-specific artifact takes precedence over legacy manual settings.
  const reviewed = inputs[seasonYear];
  if (reviewed && validMean(reviewed.septemberMeanF) && reviewed.source && reviewed.sourceUrl) {
    return { seasonYear, septemberMeanF: Number(reviewed.septemberMeanF), source: reviewed.source, provenance: reviewed };
  }
  const valid = Number(env.FALL_SEPTEMBER_MEAN_YEAR) === seasonYear && validMean(env.FALL_SEPTEMBER_MEAN_F);
  return valid ? { seasonYear, septemberMeanF: Number(env.FALL_SEPTEMBER_MEAN_F), source: env.FALL_SEPTEMBER_MEAN_SOURCE || "Seasonal September mean input" } : empty;
}
