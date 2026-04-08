// ------------------------------------------------------------
// VOICE FILTER (ANTI-VAGUE GUARDRAIL)
// ------------------------------------------------------------

const BANNED = [
  "balanced",
  "subtle",
  "similar",
  "mixed",
  "varied",
  "moderate conditions",
  "not much change"
];

export function cleanPhrase(text) {
  if (!text) return "";

  let t = text.toLowerCase();

  const isVague = BANNED.some(word => t.includes(word));

  if (!isVague) return text;

  return null; // force fallback
}