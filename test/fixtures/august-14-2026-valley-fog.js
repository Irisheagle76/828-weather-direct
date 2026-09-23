const fogMetrics = {
  cloudCoverWest: 100,
  brightness: 0.43,
  contrast: 0.04,
  visibilityScore: 0,
  sunlightDetected: false,
  sunlightLevel: "weak",
  groundBrightness: 0.18,
  groundContrast: 0.04,
  skyBlueSignal: 1,
  obscuredView: true,
  mode: "day"
};

const clearMetrics = {
  cloudCoverWest: 8,
  brightness: 0.67,
  contrast: 0.16,
  visibilityScore: 3,
  sunlightDetected: true,
  sunlightLevel: "strong",
  groundBrightness: 0.42,
  groundContrast: 0.2,
  skyBlueSignal: 1.35,
  mode: "day"
};

export const august14ValleyFogFixture = {
  timestamp: "2026-08-14T12:15:00.000Z",
  metrics: fogMetrics,
  surfaceObservations: {
    nceiDowntown: {
      id: "ncei-grove-arcade",
      stationName: "Grove Arcade",
      stale: false,
      metadata: {
        region: "downtown-asheville",
        elevationFt: 2343,
        role: "surface-valley"
      },
      humidityPct: 94,
      temperatureF: 73.5,
      dewPointF: 72,
      dewPointDepressionF: 1.5,
      solarRadiation: 450,
      saturationSignal: true,
      fogSupport: true
    }
  },
  cameras: {
    downtownSurface: {
      id: "asheville-river-valley-surface",
      metadata: {
        id: "asheville-river-valley-surface",
        region: "downtown-asheville",
        elevationFt: 1985,
        role: "surface-valley",
        directions: ["W", "NW"]
      },
      classification: "fog",
      metrics: fogMetrics
    },
    courthouse: {
      id: "buncombe-courthouse",
      metadata: {
        id: "buncombe-courthouse",
        region: "downtown-asheville",
        elevationFt: 2200,
        role: "elevated-valley-view",
        directions: ["W", "NW", "N"]
      },
      classification: "mostly_clear",
      metrics: clearMetrics
    },
    fairview: {
      id: "fairview-context",
      metadata: {
        id: "fairview-context",
        region: "fairview",
        elevationFt: null,
        role: "southern-buncombe",
        directions: ["N", "W"]
      },
      classification: "mostly_clear",
      metrics: { ...clearMetrics, cloudCoverWest: 15 }
    }
  },
  satellite: {
    available: true,
    product: "GOES visible",
    illuminated: true,
    footprint: "valley-confined",
    terrainConfined: true,
    clearAbove: true,
    confidence: 0.9
  },
  metar: {
    station: "KAVL",
    region: "southern-buncombe",
    classification: "mostly_clear",
    visibilityMiles: 10
  }
};
