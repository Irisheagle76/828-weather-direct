// ============================================================
// PHRASE SYSTEM — v2 (INTEL-DRIVEN + REGIONALLY TUNED)
// Asheville-aware + condition-aware selection
// ============================================================

export const phrases = {

  // ------------------------------------------------------------
  // TEMPERATURE
  // ------------------------------------------------------------
  temperature: {
    cold: [
      "a noticeable chill holding in place",
      "cool air settling into the valleys",
      "a crisp, cold feel dominating the period",
      "a lingering chill that doesn’t fully lift"
    ],
    cool: [
      "a light chill early, easing with time",
      "cool, steady air across the region",
      "a mild but distinctly cool setup"
    ],
    neutral: [
      "a balanced, comfortable temperature profile",
      "a steady and moderate feel overall",
      "a clean, even band of temperatures"
    ],
    warm: [
      "a gentle warmth building through the period",
      "a modest warm edge developing later",
      "a steady, comfortable warmth in place"
    ],
    hot: [
      "heat becoming a defining feature",
      "a strong warmth that builds through the day",
      "temperatures pushing into a noticeably hot range"
    ]
  },

  // ------------------------------------------------------------
  // MOISTURE / HUMIDITY
  // ------------------------------------------------------------
  moisture: {
    dry: [
      "dry air keeps the feel crisp and clean",
      "low moisture maintains a comfortable edge",
      "a clean, continental air mass dominates"
    ],
    neutral: [
      "moisture stays in a manageable range",
      "humidity remains balanced and unobtrusive",
      "air feels steady and well-regulated"
    ],
    humid: [
      "humidity adds a slight heaviness",
      "moisture builds subtly through the period",
      "a noticeable uptick in humidity develops"
    ],
    muggy: [
      "thick moisture creates a heavier feel",
      "humid air lingers and adds weight",
      "a muggy layer settles into the region"
    ]
  },

  // ------------------------------------------------------------
  // WIND
  // ------------------------------------------------------------
  wind: {
    calm: [
      "winds stay light and unobtrusive",
      "a mostly calm air pattern holds",
      "little movement in the air overall"
    ],
    breezy: [
      "a steady breeze adds a touch of movement",
      "light winds move through without disruption",
      "a gentle flow keeps things from feeling stagnant"
    ],
    windy: [
      "winds play a noticeable role at times",
      "a more active wind pattern develops",
      "gusts add variability through the period"
    ],
    gusty: [
      "strong gusts become a defining factor",
      "wind surges at times with sharper bursts",
      "a pushy wind pattern shapes the experience"
    ]
  },

  // ------------------------------------------------------------
  // LIGHT / SKY
  // ------------------------------------------------------------
  light: {
    sunny: [
      "bright conditions dominate much of the period",
      "sunlight breaks through cleanly at times",
      "a mostly open sky drives the feel"
    ],
    filtered: [
      "filtered light softens the overall feel",
      "a mix of sun and thin cloud moderates things",
      "light remains soft and diffused"
    ],
    overcast: [
      "cloud cover keeps things muted",
      "a flatter sky reduces contrast and warmth",
      "overcast conditions hold steady"
    ]
  },

  // ------------------------------------------------------------
  // MICROCLIMATE (REGIONAL CHARACTER)
  // ------------------------------------------------------------
  microclimate: {
    stable: [
      "conditions stay fairly consistent from valley to ridge",
      "a stable setup holds across elevations",
      "little variation across terrain"
    ],
    mixed: [
      "subtle elevation differences show up at times",
      "valley and ridge conditions drift slightly apart",
      "terrain introduces small variations"
    ],
    valley: [
      "cooler air lingers in lower spots",
      "valley pockets hold onto cooler conditions",
      "low areas retain a slightly heavier feel"
    ],
    ridge: [
      "ridge-top mixing keeps things more open",
      "higher elevations stay a touch more exposed",
      "ridgetops feel slightly more active"
    ]
  },

  // ------------------------------------------------------------
  // PATTERN / OVERALL FEEL
  // ------------------------------------------------------------
  pattern: {
    stable: [
      "a quiet, stable pattern dominates",
      "conditions remain steady without major shifts",
      "a predictable stretch overall"
    ],
    variable: [
      "conditions shift subtly over time",
      "a slightly unsettled pattern develops",
      "variability keeps things from locking in"
    ],
    transitional: [
      "a gradual shift in the pattern begins",
      "conditions evolve through the period",
      "a transition unfolds without sharp changes"
    ]
  }
};