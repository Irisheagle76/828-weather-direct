// ============================================================
// PHRASE SYSTEM — v3 (REFINED + INTENSITY-AWARE)
// Asheville-tuned | Composable | Hybrid-engine ready
// ============================================================

export const phrases = {

  // ------------------------------------------------------------
  // TEMPERATURE (WITH INTENSITY GRADIENT)
  // ------------------------------------------------------------
  temperature: {
    cold: [
      "a sharp chill holding in place",
      "cold air settling into lower elevations",
      "a firm, persistent chill through the period",
      "a biting cold that lingers"
    ],
    cool: [
      "a light chill early on",
      "cool, steady air across the region",
      "a mild but distinctly cool setup",
      "a cooler edge that holds in spots"
    ],
    neutral: [
      "a balanced temperature profile",
      "a steady, moderate feel overall",
      "an even band of temperatures",
      "temperatures holding in a comfortable range"
    ],
    warm: [
      "a gentle warmth building",
      "a modest warm edge developing",
      "steady warmth settling in",
      "temperatures trending comfortably warm"
    ],
    hot: [
      "heat becoming more pronounced",
      "a strong warmth building through the day",
      "temperatures pushing into a hot range",
      "heat settling in with more intensity"
    ]
  },

  // ------------------------------------------------------------
  // MOISTURE / HUMIDITY (GRADIENT ADDED)
  // ------------------------------------------------------------
  moisture: {
    dry: [
      "dry air in place",
      "low moisture keeping things crisp",
      "a clean, dry feel to the air",
      "dry conditions holding steady"
    ],
    neutral: [
      "moisture staying in a manageable range",
      "humidity remaining balanced",
      "air feeling steady and controlled",
      "a neutral moisture profile overall"
    ],
    humid: [
      "humidity becoming noticeable",
      "moisture building slightly",
      "a subtle heaviness developing",
      "humidity creeping in through the period"
    ],
    muggy: [
      "thick moisture creating a heavier feel",
      "humid air lingering and adding weight",
      "a muggy layer settling in",
      "a dense, moisture-rich feel taking hold"
    ]
  },

  // ------------------------------------------------------------
  // WIND (BETTER SCALING)
  // ------------------------------------------------------------
  wind: {
    calm: [
      "winds staying light and unobtrusive",
      "a mostly calm air pattern",
      "little movement in the air",
      "minimal wind overall"
    ],
    breezy: [
      "a light breeze adding gentle movement",
      "subtle airflow keeping things from feeling still",
      "a steady but mild breeze",
      "light winds moving through at times"
    ],
    windy: [
      "winds becoming more noticeable",
      "a more active wind pattern developing",
      "consistent movement in the air",
      "winds adding a persistent presence"
    ],
    gusty: [
      "strong gusts shaping the experience",
      "wind surging at times with sharper bursts",
      "a pushy, uneven wind pattern",
      "gusts creating brief spikes in intensity"
    ]
  },

  // ------------------------------------------------------------
  // LIGHT / SKY (MORE VARIETY)
  // ------------------------------------------------------------
  light: {
    sunny: [
      "bright conditions dominating",
      "sun breaking through cleanly at times",
      "a mostly open sky driving the feel",
      "sunlight holding strong through much of the period"
    ],
    filtered: [
      "filtered light softening the overall feel",
      "a mix of sun and thin cloud moderating things",
      "light staying soft and diffused",
      "sun breaking through at times without fully taking over"
    ],
    overcast: [
      "cloud cover keeping things muted",
      "a flatter sky reducing contrast",
      "overcast conditions holding steady",
      "a uniform gray layer limiting brightness"
    ]
  },

  // ------------------------------------------------------------
  // MICROCLIMATE (ALREADY STRONG — SLIGHTLY EXPANDED)
  // ------------------------------------------------------------
  microclimate: {
    stable: [
      "conditions staying fairly consistent from valley to ridge",
      "a stable setup across elevations",
      "little variation across terrain",
      "elevation differences remaining minimal"
    ],
    mixed: [
      "subtle elevation differences showing up",
      "valley and ridge conditions drifting apart at times",
      "terrain introducing small variations",
      "conditions varying slightly with elevation"
    ],
    valley: [
      "cooler air lingering in lower spots",
      "valley pockets holding onto heavier air",
      "low areas retaining a slightly cooler feel",
      "sheltered areas holding onto denser air"
    ],
    ridge: [
      "ridge-top mixing keeping things more open",
      "higher elevations staying more exposed",
      "ridgetops feeling a bit more active",
      "elevated areas seeing more movement"
    ]
  },

  // ------------------------------------------------------------
  // PATTERN / OVERALL FEEL (MORE HUMAN)
  // ------------------------------------------------------------
  pattern: {
    stable: [
      "a quiet, stable pattern",
      "conditions holding steady without major shifts",
      "a predictable stretch overall",
      "little overall change through the period"
    ],
    variable: [
      "conditions shifting subtly over time",
      "a slightly unsettled pattern developing",
      "variability keeping things from locking in",
      "the feel changing in small but noticeable ways"
    ],
    transitional: [
      "a gradual shift unfolding",
      "conditions evolving through the period",
      "a transition taking shape without sharp swings",
      "changes developing steadily over time"
    ]
  },

  // ------------------------------------------------------------
  // EDGE / VARIABILITY (NEW — HIGH VALUE)
  // ------------------------------------------------------------
  edges: [
    "brief spikes in discomfort show up at times",
    "conditions shift quickly in spots",
    "short-lived changes add to the uneven feel",
    "occasional swings break up otherwise steady conditions",
    "momentary changes create a less consistent feel"
  ]
};