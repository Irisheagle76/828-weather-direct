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
    "dry air keeps things feeling crisp",
    "the air stays clean and comfortable",
    "low humidity keeps it feeling light"
  ],
  neutral: [
    "humidity stays comfortable",
    "nothing too noticeable in the air",
    "moisture stays in a good range"
  ],
  humid: [
    "humidity starts to creep in",
    "the air feels a bit heavier at times",
    "a little stickiness develops"
  ],
  muggy: [
    "it turns muggy as the day goes on",
    "the air feels thick and heavy",
    "humidity becomes hard to ignore"
  ]
}, 

wind: {
  calm: [
    "winds stay light",
    "not much wind to deal with",
    "the air stays mostly still"
  ],
  breezy: [
    "a light breeze develops",
    "a bit of a breeze at times",
    "some gentle movement in the air"
  ],
  windy: [
    "winds become noticeable",
    "it gets a bit windy at times",
    "winds pick up through the day"
  ],
  gusty: [
    "gusts kick up at times",
    "some stronger gusts show up",
    "winds get a bit pushy at times"
  ]
},  // ✅

light: {
  sunny: [
    "plenty of sunshine",
    "mostly sunny through the day",
    "a good amount of sun overall",
    "sunshine dominates for much of the day"
  ],
  filtered: [
    "a mix of sun and clouds",
    "sun at times with some passing clouds",
    "partly sunny with a few clouds around",
    "sun peeking through now and then",
    "sun filtered by some thin clouds at times"
  ],
  overcast: [
    "mostly cloudy skies",
    "a good bit of cloud cover",
    "skies stay on the cloudy side",
    "not much sunshine getting through",
    "clouds hanging around for most of the day"
  ]
},  // ✅

  // ------------------------------------------------------------
  // LIGHT / SKY (MORE VARIETY)
  // ------------------------------------------------------------
 light: {
  sunny: [
    "plenty of sunshine",
    "mostly sunny through the day",
    "a good amount of sun overall",
    "sunshine dominates for much of the day"
  ],

  filtered: [
    "a mix of sun and clouds",
    "sun at times with some passing clouds",
    "partly sunny with a few clouds around",
    "sun peeking through now and then",
    "sun filtered by some thin clouds at times"
  ],

  overcast: [
    "mostly cloudy skies",
    "a good bit of cloud cover",
    "skies stay on the cloudy side",
    "not much sunshine getting through",
    "clouds hanging around for most of the day"
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