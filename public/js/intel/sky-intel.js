// SKY INTEL - balanced dominance system with obscured-view safeguards.

function pickFiniteNumber(source, keys) {
  if (!source) return null;
  for (const key of keys) {
    const n = Number(source[key]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function computeSkyIntel({ camera, previous = null, weatherContext = null }) {
  if (!camera || !camera.metrics) return null;

  const m = camera.metrics;

  const observedCloud = m.cloudCoverWest ?? null;
  const contrast = m.contrast ?? null;
  const groundContrast = m.groundContrast ?? null;
  const groundBrightness = m.groundBrightness ?? null;
  const visibility = m.visibilityScore ?? null;
  const brightness = m.brightness ?? null;
  const sensorObscuredView = m.obscuredView === true;

  const sunlightDetected = m.sunlightDetected ?? false;
  const sunlightLevel = m.sunlightLevel ?? "weak";
  const filteredSunshineSignal = m.filteredSunshineSignal ?? false;
  const satelliteHighCloudSignal = m.satelliteHighCloudSignal ?? false;
  const satelliteCloudMotionSignal = m.satelliteCloudMotionSignal ?? false;
  const softShadowSignal = m.softShadowSignal ?? (
    contrast != null &&
    (
      contrast < 0.09 ||
      (contrast < 0.12 && (groundContrast == null || groundContrast < 0.18))
    )
  );

  const skyBlueSignal = m.skyBlueSignal ?? null;
  const mode = m.mode;
  const airQuality = weatherContext?.airQuality || {};
  const pm25 = pickFiniteNumber(airQuality, ["pm25", "pm2_5"]);
  const pm10 = pickFiniteNumber(airQuality, ["pm10"]);
  const usAqiPm25 = pickFiniteNumber(airQuality, ["usAqiPm25", "us_aqi_pm2_5"]);
  const aerosolOpticalDepth = pickFiniteNumber(airQuality, ["aerosolOpticalDepth", "aerosol_optical_depth"]);
  const dust = pickFiniteNumber(airQuality, ["dust"]);
  const dustSignal =
    dust != null && dust >= 8 &&
    ((aerosolOpticalDepth ?? 0) >= 0.12 || (pm10 ?? 0) >= 20);
  const surfaceSmokeSignal = !dustSignal && (
    (usAqiPm25 != null && usAqiPm25 >= 55) ||
    (pm25 != null && pm25 >= 12 && (aerosolOpticalDepth ?? 0) >= 0.15)
  );
  // A transported smoke layer can be visually thick aloft while surface PM2.5
  // and AQI remain modest. Require the camera's warm veil signal before using
  // this lower-PM, elevated-AOD pathway.
  const elevatedSmokeLayerSignal =
    !dustSignal &&
    m.warmHazeSignal === true &&
    (pm25 ?? 0) >= 7 &&
    (aerosolOpticalDepth ?? 0) >= 0.22;
  const smokeSignal = surfaceSmokeSignal || elevatedSmokeLayerSignal;
  const hazeSignal = !dustSignal && !smokeSignal && (aerosolOpticalDepth ?? 0) >= 0.3;
  const aerosolType = dustSignal ? "dust" : smokeSignal ? "smoke" : hazeSignal ? "haze" : null;
  const satelliteCloudFraction = pickFiniteNumber(m, ["satelliteCloudFraction"]);
  const independentOpenSkySignal =
    (satelliteCloudFraction != null && satelliteCloudFraction < 0.18) ||
    m.buildingCloudStructureSignal === false;
  const aerosolClearSkySignal = Boolean(
    aerosolType &&
    (
      (observedCloud != null && observedCloud <= 35) ||
      (m.warmHazeSignal === true && independentOpenSkySignal)
    )
  );
  // Warm particulate haze is spectrally similar to the camera's warm-gray
  // cloud mask. Preserve the raw observation, but do not count that smooth
  // veil as cloud when independent aerosol and open-sky evidence agree.
  const cloud = aerosolClearSkySignal
    ? Math.min(Number.isFinite(observedCloud) ? observedCloud : 15, 15)
    : observedCloud;
  const stationSolarRadiation = pickFiniteNumber(weatherContext, ["solarRadiation", "solar_radiation", "solarWm2", "solar"]);
  const stationUv = pickFiniteNumber(weatherContext, ["uvIndex", "uv_index", "uv"]);
  const stationLux = pickFiniteNumber(weatherContext, ["brightness", "illuminance", "lux"]);
  const radar = weatherContext?.radar || {};
  const radarAgeMinutes = pickFiniteNumber(radar, ["ageMinutes"]);
  const radarEchoPixels = pickFiniteNumber(radar, ["echoPixels"]);
  const radarEchoCoverage = pickFiniteNumber(radar, ["echoCoverage"]);
  const radarNearWestEchoPixels = pickFiniteNumber(radar, ["nearWestEchoPixels"]);
  const radarNearestEchoMiles = pickFiniteNumber(radar, ["nearestEchoMiles"]);
  const freshRadarEcho = radar.available === true && radarAgeMinutes != null && radarAgeMinutes <= 15 && (
    (radarEchoPixels ?? 0) >= 40 ||
    (radarEchoCoverage ?? 0) >= 0.004
  );
  const nearbyWesternRain = freshRadarEcho && (
    (radarNearWestEchoPixels ?? 0) >= 25 ||
    (radarNearestEchoMiles ?? 999) <= 35
  );
  const stationBrightSignal =
    (stationSolarRadiation != null && stationSolarRadiation >= 220) ||
    (stationUv != null && stationUv >= 2) ||
    (stationLux != null && stationLux >= 12000);
  const stationDaylightSignal =
    stationBrightSignal ||
    (stationSolarRadiation != null && stationSolarRadiation >= 120) ||
    (stationUv != null && stationUv >= 1) ||
    (stationLux != null && stationLux >= 7000);
  const stationSunlightLevel =
    (stationSolarRadiation != null && stationSolarRadiation >= 500) ||
    (stationUv != null && stationUv >= 5) ||
    (stationLux != null && stationLux >= 30000)
      ? "strong"
      : stationBrightSignal
        ? "moderate"
        : "weak";

  let atmosphericState = "unknown";
  let cloudState = "unknown";
  let transition = null;
  let confidence = 0.65;

  if (mode === "night") {
    return {
      cloud,
      displayCloud: cloud,
      cloudCoverReliable: true,
      cloudState: "unknown",
      atmosphericState: "night",
      transition: null,
      sunlightDetected: false,
      sunlightLevel: "none",
      confidence: 0.4
    };
  }

  if (aerosolClearSkySignal) {
    return {
      cloud,
      observedCloud,
      displayCloud: cloud,
      cloudCoverReliable: true,
      cloudState: "mostly_clear",
      atmosphericState: aerosolType === "dust" ? "clear_dust" : aerosolType === "smoke" ? "clear_smoke" : "clear_haze",
      transition: null,
      sunlightDetected,
      sunlightLevel,
      confidence: 0.88,
      visualObscured: false,
      filteredSun: true,
      aerosolDetected: true,
      aerosolType,
      airQuality: { pm25, pm10, usAqiPm25, aerosolOpticalDepth, dust },
      stationLightSignal: stationBrightSignal ? "bright" : stationDaylightSignal ? "daylight" : "low",
      softShadowSignal,
      satelliteHighCloudSignal,
      satelliteCloudMotionSignal
    };
  }

  const strongSun = sunlightDetected && sunlightLevel === "strong";
  const moderateSun = sunlightDetected && sunlightLevel === "moderate";
  const strongBlue = skyBlueSignal != null && skyBlueSignal > 1.2;
  const moderateBlue = skyBlueSignal != null && skyBlueSignal > 1.05;
  const brightGroundSignal = groundBrightness != null && groundBrightness >= 0.34;
  const blueOpenSceneSignal =
    strongBlue &&
    brightGroundSignal &&
    (cloud == null || cloud <= 20 || stationDaylightSignal);
  const brightBlueSkySignal =
    (strongBlue || (moderateBlue && (strongSun || moderateSun))) &&
    (brightness == null || brightness >= 0.42) &&
    (contrast == null || contrast >= 0.08);
  const visibleStructureSignal =
    m.visibleStructureSignal === true ||
    (
      groundContrast != null &&
      groundBrightness != null &&
      groundContrast >= 0.13 &&
      groundBrightness >= 0.18
    );

  const lowCloudSignal = cloud != null && cloud <= 20;
  const poorVisibilityFlatView =
    visibility != null &&
    visibility <= 2 &&
    contrast != null &&
    contrast <= 0.08 &&
    brightness != null &&
    brightness < 0.6 &&
    !blueOpenSceneSignal &&
    !stationBrightSignal;
  const stationLightCounterSignal =
    stationBrightSignal &&
    !poorVisibilityFlatView &&
    (strongSun || moderateBlue || visibleStructureSignal);
  const clearSkyCounterSignal =
    !poorVisibilityFlatView &&
    (lowCloudSignal || brightBlueSkySignal || blueOpenSceneSignal || stationLightCounterSignal) &&
    (strongBlue || brightBlueSkySignal || blueOpenSceneSignal || stationLightCounterSignal || (strongSun && skyBlueSignal != null && skyBlueSignal >= 1.45));
  const flatGrayView = contrast != null && contrast <= 0.1 && !strongBlue;
  const dimGrayView = (brightness != null && brightness < 0.62 && flatGrayView) || poorVisibilityFlatView;
  const structureVisibilityCounterSignal =
    visibleStructureSignal &&
    (
      visibility == null ||
      visibility >= 1 ||
      (groundContrast != null && groundContrast >= 0.15)
    );
  const openViewCounterSignal =
    clearSkyCounterSignal ||
    blueOpenSceneSignal ||
    (brightBlueSkySignal && structureVisibilityCounterSignal) ||
    (stationBrightSignal && structureVisibilityCounterSignal) ||
    (strongSun && moderateBlue && visibility != null && visibility >= 2);
  const lowStratusDeck =
    structureVisibilityCounterSignal &&
    flatGrayView &&
    !strongSun &&
    !strongBlue &&
    (cloud == null || cloud <= 35 || cloud >= 70);
  const obscuredView =
    !openViewCounterSignal &&
    !structureVisibilityCounterSignal &&
    (sensorObscuredView || (visibility != null && visibility <= 2 && dimGrayView));
  const cloudCoverUnreliable =
    obscuredView ||
    lowStratusDeck ||
    (!openViewCounterSignal && !structureVisibilityCounterSignal && visibility != null && visibility <= 1 && flatGrayView);
  const lowDeckDetected = obscuredView && (cloud == null || cloud >= 35 || cloud <= 10);
  const fogDetected =
    !openViewCounterSignal &&
    !structureVisibilityCounterSignal &&
    (sensorObscuredView ||
      visibility === 0 ||
      (visibility === 1 && flatGrayView) ||
      (visibility === 2 && dimGrayView && (cloud == null || cloud <= 20)));

  // A camera-facing low-visibility curtain with fresh echoes immediately west
  // of Asheville is a rain shaft/low-cloud scene, not valley fog. Radar is the
  // deciding evidence because image softness alone cannot distinguish them.
  const rainShaftDetected = nearbyWesternRain && (obscuredView || fogDetected || lowDeckDetected);

  if (rainShaftDetected || fogDetected || lowDeckDetected) {
    return {
      cloud,
      observedCloud,
      displayCloud: null,
      cloudCoverReliable: false,
      cloudState: "obscured",
      atmosphericState: rainShaftDetected ? "rain_shaft" : fogDetected ? "fog" : "low_cloud",
      transition: null,
      sunlightDetected: false,
      sunlightLevel: "low",
      confidence: rainShaftDetected ? 0.9 : fogDetected ? 0.82 : 0.72,
      visualObscured: true,
      radarRainShaftSignal: rainShaftDetected,
      filteredSun: false,
      stationLightSignal: stationDaylightSignal ? "daylight" : "low",
      softShadowSignal,
      satelliteHighCloudSignal,
      satelliteCloudMotionSignal
    };
  }

  const filteredSun = (
    filteredSunshineSignal ||
    satelliteHighCloudSignal ||
    (satelliteCloudMotionSignal && (cloud == null || cloud >= 20)) ||
    (sunlightDetected && softShadowSignal && cloud != null && cloud >= 20)
  );

  const heavyCloud = cloud != null && cloud >= 90;
  const midCloud = cloud != null && cloud >= 65;
  const lowCloud = cloud != null && cloud >= 40;
  const sunDominant = strongSun && strongBlue && !filteredSun;

  if (lowStratusDeck) {
    atmosphericState = brightness != null && brightness >= 0.46 ? "overcast_bright" : "low_stratus";
    cloudState = "low_stratus";
    confidence = 0.8;
  } else if (heavyCloud) {
    if (sunDominant) {
      atmosphericState = "partly_cloudy";
      confidence = 0.85;
    } else if (strongSun || moderateBlue) {
      atmosphericState = "overcast_bright";
      confidence = 0.8;
    } else {
      atmosphericState = "overcast";
      confidence = 0.85;
    }
  } else if (midCloud) {
    if (filteredSun) {
      atmosphericState = "mostly_cloudy_filtered";
      confidence = 0.88;
    } else if (sunDominant) {
      atmosphericState = "partly_cloudy";
      confidence = 0.9;
    } else if (strongSun || moderateBlue) {
      atmosphericState = "partly_cloudy";
      confidence = 0.85;
    } else {
      atmosphericState = "mostly_cloudy";
      confidence = 0.75;
    }
  } else if (lowCloud) {
    if (filteredSun) {
      atmosphericState = (cloud >= 50 || satelliteHighCloudSignal) ? "mostly_cloudy_filtered" : "filtered_sunshine";
      confidence = 0.86;
    } else if (sunDominant) {
      atmosphericState = "mostly_clear";
      confidence = 0.9;
    } else if (strongSun || moderateSun || moderateBlue) {
      atmosphericState = "partly_cloudy";
      confidence = 0.85;
    } else {
      atmosphericState = "mostly_cloudy";
      confidence = 0.7;
    }
  } else if (cloud != null) {
    if (filteredSun) {
      atmosphericState = (cloud >= 20 && satelliteHighCloudSignal) ? "mostly_cloudy_filtered" : "filtered_sunshine";
      confidence = 0.78;
    } else if (strongSun || strongBlue) {
      atmosphericState = "mostly_clear";
      confidence = 0.95;
    } else {
      atmosphericState = "partly_cloudy";
      confidence = 0.75;
    }
  } else {
    atmosphericState = "clear";
    confidence = 0.7;
  }

  if (cloud != null) {
    if (cloud >= 90) cloudState = "overcast";
    else if (cloud >= 65) cloudState = "mostly_cloudy";
    else if (cloud >= 40) cloudState = "partly_cloudy";
    else cloudState = "mostly_clear";
  }

  if (previous?.atmosphericState) {
    if (
      previous.atmosphericState === "overcast" &&
      atmosphericState === "partly_cloudy"
    ) {
      transition = "improving";
    } else if (
      previous.atmosphericState === "partly_cloudy" &&
      atmosphericState === "overcast"
    ) {
      transition = "deteriorating";
    } else if (
      strongSun &&
      previous.atmosphericState !== atmosphericState
    ) {
      transition = "sun_breaking_through";
    }
  }

  return {
    cloud,
    observedCloud,
    displayCloud: cloudCoverUnreliable ? null : cloud,
    cloudCoverReliable: !cloudCoverUnreliable,
    cloudState,
    atmosphericState,
    transition,
    sunlightDetected: sunlightDetected || (stationBrightSignal && (strongBlue || blueOpenSceneSignal)),
    sunlightLevel: sunlightDetected ? sunlightLevel : stationSunlightLevel,
    confidence: Number(Math.min(confidence, 1).toFixed(2)),
    visualObscured: false,
    visibleStructureSignal: structureVisibilityCounterSignal,
    cloudMetricLabel: lowStratusDeck ? "Low stratus" : null,
    filteredSun,
    aerosolDetected: Boolean(aerosolType),
    aerosolType,
    airQuality: { pm25, pm10, usAqiPm25, aerosolOpticalDepth, dust },
    stationLightSignal: stationBrightSignal ? "bright" : stationDaylightSignal ? "daylight" : "low",
    softShadowSignal,
    satelliteHighCloudSignal,
    satelliteCloudMotionSignal
  };
}
