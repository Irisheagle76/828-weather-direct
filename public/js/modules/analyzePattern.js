// analyzePattern.js
// ---------------------------------------------
// CORE METEOROLOGY ENGINE + INPUT MAPPER
// ---------------------------------------------

// MAIN EXPORT
export function analyzePattern(inputs = {}) {
  const pattern = {
    dayType: null,

    skyBehavior: {},
    convection: {},
    moistureProfile: {},
    temperature: {},
    windProfile: {},

    hazards: {},
    localEffects: {},

    confidence: {},
    tension: []
  };

  detectMoisture(pattern, inputs);
  detectTemperatureTrend(pattern, inputs);
  detectWind(pattern, inputs);

  detectConvection(pattern, inputs);
  detectSkyBehavior(pattern, inputs);

  detectDayType(pattern);
  detectHazards(pattern, inputs);
  detectLocalEffects(pattern, inputs);

  computeConfidence(pattern, inputs);
  computeTension(pattern);

  return pattern;
}

// ---------------------------------------------
// OPTIONAL: INPUT MAPPER (exported for convenience)
// ---------------------------------------------
export function mapToInputs(data = {}) {
  return {
    dewPoint: data?.hourly?.dewpoint?.[12] ?? 55,

    tempTrend:
      ((data?.daily?.temperatureMax?.[0] ?? 70) -
       (data?.daily?.temperatureMin?.[0] ?? 50)) / 10,

    maxTemp: data?.daily?.temperatureMax?.[0] ?? null,

    windSpeed: data?.hourly?.windspeed?.[12] ?? 5,
    windDir: data?.hourly?.winddirection?.[12] ?? 0,

    skyCover: (data?.hourly?.cloudcover?.[12] ?? 50) / 100,
    skyTrend: 0, // placeholder until you compute trend

    instability: data?.derived?.instability ?? 0.6,
    moistureDepth: data?.derived?.moistureDepth ?? 0.6,
    lift: data?.derived?.lift ?? 0.5,

    heatingPeak: 15,

    shear: data?.derived?.shear ?? 0.4,
    modelSpread: data?.derived?.modelSpread ?? 0.3,
    skyConfidence: data?.derived?.skyConfidence ?? 0.7
  };
}

// ---------------------------------------------
// MODULES
// ---------------------------------------------

function detectMoisture(pattern, inputs) {
  const dp = inputs.dewPoint ?? 55;
  const depth = inputs.moistureDepth ?? 0.5;

  pattern.moistureProfile.surface =
    dp < 50 ? "dry" :
    dp < 60 ? "comfortable" :
    dp < 68 ? "humid" : "tropical";

  pattern.moistureProfile.depth =
    depth > 0.7 ? "deep" : "shallow";
}

function detectTemperatureTrend(pattern, inputs) {
  const t = inputs.tempTrend ?? 0;

  pattern.temperature.trend =
    t > 2 ? "warming" :
    t < -2 ? "cooling" : "steady";

  pattern.temperature.max = inputs.maxTemp ?? null;
}

function detectWind(pattern, inputs) {
  const dir = inputs.windDir ?? 0;
  const speed = inputs.windSpeed ?? 0;

  pattern.windProfile = {
    direction: dir,
    speed,
    upslope: (dir >= 290 && dir <= 330) && speed > 5
  };
}

function detectConvection(pattern, inputs) {
  const instability = inputs.instability ?? 0;
  const moisture = inputs.moistureDepth ?? 0;
  const trigger = inputs.lift ?? 0;

  if (instability > 0.6 && moisture > 0.6 && trigger > 0.4) {
    pattern.convection = {
      present: true,
      coverage:
        instability > 0.8 ? "numerous" :
        instability > 0.65 ? "scattered" : "isolated",
      intensity:
        instability > 0.85 ? "strong" : "general",
      triggerTime: inputs.heatingPeak ?? 15
    };
  } else {
    pattern.convection = {
      present: false,
      coverage: "none",
      intensity: null,
      triggerTime: null
    };
  }
}

function detectSkyBehavior(pattern, inputs) {
  const clouds = inputs.skyCover ?? 0.5;
  const trend = inputs.skyTrend ?? 0;

  pattern.skyBehavior = {
    coverage:
      clouds < 0.3 ? "mostly sunny" :
      clouds < 0.6 ? "partly cloudy" : "mostly cloudy",

    trend:
      trend > 0.2 ? "increasing clouds" :
      trend < -0.2 ? "clearing" : "steady",

    sunWindows:
      clouds < 0.4 ? "strong" :
      clouds < 0.7 ? "periodic" : "limited"
  };
}

function detectDayType(pattern) {
  if (pattern.convection.present) {
    pattern.dayType = "convective";
    return;
  }

  if (
    pattern.windProfile.upslope &&
    pattern.moistureProfile.surface !== "dry"
  ) {
    pattern.dayType = "nw_flow";
    return;
  }

  if (pattern.skyBehavior.trend === "clearing") {
    pattern.dayType = "clearing";
    return;
  }

  pattern.dayType = "stable";
}

function detectHazards(pattern, inputs) {
  const instability = inputs.instability ?? 0;
  const shear = inputs.shear ?? 0;

  pattern.hazards = {
    stormRisk: pattern.convection.present
      ? pattern.convection.coverage
      : "none",

    severePotential:
      instability > 0.85 && shear > 0.6
        ? "low-end"
        : "none",

    rainWindow:
      pattern.convection.present
        ? "afternoon-evening"
        : null
  };
}

function detectLocalEffects(pattern, inputs) {
  const windSpeed = inputs.windSpeed ?? 0;
  const skyCover = inputs.skyCover ?? 0.5;

  pattern.localEffects = {
    terrainInfluence:
      pattern.windProfile.upslope ? "upslope clouds" : null,

    valleyFog:
      windSpeed < 3 &&
      pattern.moistureProfile.surface !== "dry" &&
      skyCover < 0.4,

    radiationalCooling:
      skyCover < 0.3 && windSpeed < 3,

    sunBreakPotential:
      pattern.skyBehavior.sunWindows === "periodic"
  };
}

function computeConfidence(pattern, inputs) {
  const spread = inputs.modelSpread ?? 0.3;

  pattern.confidence = {
    overall: Math.max(0, Math.min(1, 1 - spread)),
    stormTiming: pattern.convection.present ? 0.5 : null,
    cloudCoverage: inputs.skyConfidence ?? 0.7
  };
}

function computeTension(pattern) {
  const t = [];

  if (
    pattern.skyBehavior.coverage === "partly cloudy" &&
    pattern.skyBehavior.trend === "increasing clouds"
  ) {
    t.push("sun vs clouds");
  }

  if (
    pattern.convection.present &&
    pattern.moistureProfile.depth === "shallow"
  ) {
    t.push("instability vs limited moisture");
  }

  if (pattern.dayType === "nw_flow") {
    t.push("clearing vs upslope clouds");
  }

  pattern.tension = t;
}