export const WATERFALLS = [
  {
    id: "looking-glass-falls",
    name: "Looking Glass Falls",
    region: "Pisgah National Forest",
    lat: 35.2961,
    lon: -82.7687,
    basin: "Looking Glass Creek",
    responseSpeed: "fast",
    familyFriendly: true,
    photoValue: "high",
    hazardSensitivity: "medium"
  },
  {
    id: "moore-cove-falls",
    name: "Moore Cove Falls",
    region: "Pisgah National Forest",
    lat: 35.3141,
    lon: -82.7799,
    basin: "Looking Glass Creek",
    responseSpeed: "fast",
    familyFriendly: true,
    photoValue: "medium",
    hazardSensitivity: "medium"
  },
  {
    id: "hooker-falls",
    name: "Hooker Falls",
    region: "DuPont State Recreational Forest",
    lat: 35.2053,
    lon: -82.6174,
    basin: "Little River",
    responseSpeed: "moderate",
    familyFriendly: true,
    photoValue: "high",
    hazardSensitivity: "medium"
  },
  {
    id: "triple-falls",
    name: "Triple Falls",
    region: "DuPont State Recreational Forest",
    lat: 35.1982,
    lon: -82.6188,
    basin: "Little River",
    responseSpeed: "moderate",
    familyFriendly: false,
    photoValue: "high",
    hazardSensitivity: "high"
  },
  {
    id: "high-falls",
    name: "High Falls",
    region: "DuPont State Recreational Forest",
    lat: 35.1938,
    lon: -82.6221,
    basin: "Little River",
    responseSpeed: "moderate",
    familyFriendly: true,
    photoValue: "high",
    hazardSensitivity: "high"
  },
  {
    id: "catawba-falls",
    name: "Catawba Falls",
    region: "Old Fort",
    lat: 35.6131,
    lon: -82.2271,
    basin: "Catawba River",
    responseSpeed: "moderate",
    familyFriendly: false,
    photoValue: "high",
    hazardSensitivity: "high"
  },
  {
    id: "crabtree-falls",
    name: "Crabtree Falls",
    region: "Blue Ridge Parkway",
    lat: 35.8173,
    lon: -82.1453,
    basin: "Crabtree Creek",
    responseSpeed: "fast",
    familyFriendly: false,
    photoValue: "high",
    hazardSensitivity: "medium"
  },
  {
    id: "linville-falls",
    name: "Linville Falls",
    region: "Linville Gorge",
    lat: 35.9495,
    lon: -81.9265,
    basin: "Linville River",
    responseSpeed: "slow",
    familyFriendly: true,
    photoValue: "high",
    hazardSensitivity: "high"
  },
  {
    id: "graveyard-fields",
    name: "Graveyard Fields / Yellowstone Falls area",
    region: "Blue Ridge Parkway",
    lat: 35.3208,
    lon: -82.8466,
    basin: "Yellowstone Prong",
    responseSpeed: "fast",
    familyFriendly: false,
    photoValue: "high",
    hazardSensitivity: "high"
  }
];

export const RIVERS = [
  {
    id: "french-broad-asheville",
    name: "French Broad River",
    segmentName: "near Asheville",
    lat: 35.5857,
    lon: -82.5788,
    usgsGaugeId: "03451500",
    riverType: "urban",
    activities: ["tubing", "canoeing", "kayaking", "fishing", "swimming"],
    normalFlowRange: [900, 3500],
    cautionFlowRange: [3500, 6000],
    hazardousFlowRange: [6000, Infinity],
    notes: "Broad urban river with strainers, changing access points, and water-quality concerns after storms."
  },
  {
    id: "french-broad-marshall",
    name: "French Broad River",
    segmentName: "near Marshall",
    lat: 35.7973,
    lon: -82.6841,
    usgsGaugeId: "03453500",
    riverType: "recreational",
    activities: ["tubing", "canoeing", "kayaking", "rafting", "fishing", "swimming"],
    normalFlowRange: [1200, 4500],
    cautionFlowRange: [4500, 8000],
    hazardousFlowRange: [8000, Infinity],
    notes: "Bigger-water French Broad stretch where current can feel stronger than it looks."
  },
  {
    id: "davidson-river",
    name: "Davidson River",
    segmentName: "near Brevard",
    lat: 35.2811,
    lon: -82.7182,
    usgsGaugeId: "03441000",
    riverType: "coldwater",
    activities: ["fishing", "swimming", "wading"],
    normalFlowRange: [80, 350],
    cautionFlowRange: [350, 650],
    hazardousFlowRange: [650, Infinity],
    notes: "Coldwater trout stream. Low, clear water can still be good for careful fishing."
  },
  {
    id: "green-river",
    name: "Green River",
    segmentName: "near Saluda",
    lat: 35.2687,
    lon: -82.3486,
    usgsGaugeId: "02150062",
    riverType: "whitewater",
    activities: ["kayaking", "rafting", "fishing"],
    normalFlowRange: [200, 900],
    cautionFlowRange: [900, 1500],
    hazardousFlowRange: [1500, Infinity],
    notes: "Technical whitewater and release-driven sections. Treat casual tubing or swimming as not applicable."
  },
  {
    id: "nantahala-river",
    name: "Nantahala River",
    segmentName: "near Wesser",
    lat: 35.3315,
    lon: -83.5912,
    usgsGaugeId: "03505550",
    riverType: "whitewater",
    activities: ["kayaking", "rafting", "fishing", "swimming"],
    normalFlowRange: [450, 1200],
    cautionFlowRange: [1200, 2000],
    hazardousFlowRange: [2000, Infinity],
    notes: "Cold, managed whitewater. Great for outfitters at normal release flows, not a casual swim river."
  },
  {
    id: "oconaluftee-river",
    name: "Oconaluftee River",
    segmentName: "at Birdtown near Cherokee",
    lat: 35.46138889,
    lon: -83.3536111,
    usgsGaugeId: "03512000",
    riverType: "recreational",
    activities: ["tubing", "canoeing", "kayaking", "fishing", "swimming"],
    normalFlowRange: [500, 2200],
    cautionFlowRange: [2200, 4000],
    hazardousFlowRange: [4000, Infinity],
    notes: "Mountain recreation river near Cherokee where flow can change with rain and upstream releases."
  },
  {
    id: "pigeon-river",
    name: "Pigeon River",
    segmentName: "near Hartford",
    lat: 35.8137,
    lon: -83.1421,
    usgsGaugeId: "03461500",
    riverType: "whitewater",
    activities: ["kayaking", "rafting", "fishing"],
    normalFlowRange: [600, 2500],
    cautionFlowRange: [2500, 4500],
    hazardousFlowRange: [4500, Infinity],
    notes: "Commercial whitewater character. Good flow for rafting can still be too much for casual users."
  },
  {
    id: "swannanoa-river",
    name: "Swannanoa River",
    segmentName: "at Biltmore Village",
    lat: 35.56694444,
    lon: -82.5441667,
    usgsGaugeId: "03451000",
    usgsUrl: "https://waterdata.usgs.gov/monitoring-location/USGS-03451000/#dataTypeId=continuous-00065-0&period=P7D&showFieldMeasurements=true",
    riverType: "mountain_stream",
    activities: ["fishing", "swimming", "wading"],
    normalFlowRange: [80, 500],
    cautionFlowRange: [500, 1100],
    hazardousFlowRange: [1100, Infinity],
    notes: "Flashier urban mountain stream. It can rise quickly after thunderstorms."
  }
];

export const WATER_WEBCAMS = [
  {
    id: "french-broad-beer-city",
    name: "Beer City Tubing French Broad River Live Camera",
    waterway: "French Broad River",
    location: "Arden / South Asheville",
    region: "Asheville area",
    lat: 35.466,
    lon: -82.535,
    url: "https://www.ashevillewx.com/beer-city-tubing-french-broad-river-live-camera",
    embedType: "external",
    provider: "AshevilleWX / Beer City Tubing",
    status: "source",
    bestFor: ["tubing", "river level", "crowd context"],
    note: "Useful visual check for the French Broad south of Asheville; open the source for the live player."
  },
  {
    id: "french-broad-horse-shoe-farm",
    name: "Horse Shoe Farm French Broad Riverfront",
    waterway: "French Broad River",
    location: "Horse Shoe / Henderson County",
    region: "Southwest of Asheville",
    lat: 35.348,
    lon: -82.565,
    url: "https://www.resortcams.com/webcams/horse-shoe-farm/",
    embedUrl: "https://www.resortcams.com/embed.php?cam=horse-shoe-farm",
    embedType: "iframe",
    provider: "ResortCams / Horse Shoe Farm",
    status: "available",
    bestFor: ["riverfront view", "sky and water context"],
    note: "Riverfront French Broad visual from a broad valley setting southwest of Asheville."
  },
  {
    id: "nantahala-noc",
    name: "Nantahala River at Nantahala Outdoor Center",
    waterway: "Nantahala River",
    location: "Nantahala Gorge near Bryson City",
    region: "Far WNC",
    lat: 35.3315,
    lon: -83.5912,
    url: "https://noc.com/live-webcam/",
    embedUrl: "https://www.resortcams.com/embed.php?cam=nantahala-outdoor-center",
    embedType: "iframe",
    provider: "Nantahala Outdoor Center",
    status: "available",
    bestFor: ["rafting", "kayaking", "release flow"],
    note: "Rotating views around NOC, including Founder's Bridge, the play wave, and river activity."
  },
  {
    id: "brevard-waterfall-country",
    name: "Downtown Brevard Waterfall Country Cam",
    waterway: "Waterfall country gateway",
    location: "Brevard",
    region: "Transylvania County",
    lat: 35.2334,
    lon: -82.7343,
    url: "https://www.resortcams.com/webcams/downtown-brevard/",
    embedUrl: "https://www.resortcams.com/embed.php?cam=downtown-brevard",
    embedType: "iframe",
    provider: "ResortCams / Explore Brevard",
    status: "available",
    bestFor: ["waterfall trip context", "Brevard weather check"],
    note: "A live look at Brevard, the gateway town for Pisgah and Transylvania County waterfall trips."
  },
  {
    id: "pigeon-river-canton",
    name: "Riverview Farm & Garden Pigeon River Live Cam",
    waterway: "Pigeon River",
    location: "Downtown Canton",
    region: "Haywood County",
    lat: 35.5329,
    lon: -82.8374,
    url: "https://www.ashevillewx.com/wncwebcams",
    embedType: "external",
    provider: "AshevilleWX / Riverview Farm & Garden",
    status: "source",
    bestFor: ["river level", "local visual check"],
    note: "AshevilleWX lists this as a 24/7 Pigeon River level camera in downtown Canton; open the source for the live player."
  },
  {
    id: "french-broad-usgs-asheville",
    name: "USGS French Broad River at Asheville",
    waterway: "French Broad River",
    location: "Asheville gauge 03451500",
    region: "Asheville area",
    lat: 35.5857,
    lon: -82.5788,
    url: "https://nc.water.usgs.gov/rivercam/webcam-french_broad_asheville.php",
    imageUrl: "https://usgs-nims-images.s3.amazonaws.com/720/NC_French_Broad_River_at_Asheville/NC_French_Broad_River_at_Asheville_newest.jpg",
    embedType: "image",
    provider: "USGS / NCDOT",
    status: "available",
    bestFor: ["gauge reference", "river orientation", "water quality context"],
    note: "Latest USGS still image for the French Broad River at Asheville; useful for river level, color, and debris checks."
  },
  {
    id: "french-broad-usgs-bent-creek",
    name: "USGS French Broad below I-26 near Bent Creek",
    waterway: "French Broad River",
    location: "Bent Creek gauge 03448050",
    region: "Asheville area",
    lat: 35.493,
    lon: -82.596,
    url: "https://nc.water.usgs.gov/rivercam/webcam-french_broad_bent_creek.php",
    imageUrl: "https://usgs-nims-images.s3.amazonaws.com/720/NC_French_Broad_River_near_Bent_Creek/NC_French_Broad_River_near_Bent_Creek_newest.jpg",
    embedType: "image",
    provider: "USGS / NCDOT",
    status: "available",
    bestFor: ["gauge reference", "water quality context", "daylight river image"],
    note: "Latest USGS still image for the French Broad below I-26 near Bent Creek; USGS notes the image updates every 15 minutes during daylight hours."
  },
  {
    id: "oconaluftee-birdtown-usgs",
    name: "USGS Oconaluftee River at Birdtown",
    waterway: "Oconaluftee River",
    location: "Birdtown / Cherokee gauge 03512000",
    region: "Great Smoky Mountains",
    lat: 35.46138889,
    lon: -83.3536111,
    url: "https://waterdata.usgs.gov/monitoring-location/USGS-03512000/",
    imageUrl: "https://usgs-nims-images.s3.amazonaws.com/overlay/NC_Oconaluftee_River_at_Birdtown/NC_Oconaluftee_River_at_Birdtown_newest.jpg",
    embedType: "image",
    provider: "USGS / Eastern Band of Cherokee Indians",
    status: "available",
    bestFor: ["gauge reference", "river level", "Smokies-side water check"],
    note: "Latest USGS still image for the Oconaluftee River at Birdtown, paired with monitoring location USGS-03512000."
  }
];

const MOCK_RAINFALL_BY_BASIN = {
  "Looking Glass Creek": { rain24h: 0.42, rain3d: 1.35, rain7d: 2.1, rain14d: 3.15 },
  "Little River": { rain24h: 0.36, rain3d: 1.18, rain7d: 1.85, rain14d: 2.7 },
  "Catawba River": { rain24h: 0.2, rain3d: 0.82, rain7d: 1.55, rain14d: 2.35 },
  "Crabtree Creek": { rain24h: 0.55, rain3d: 1.52, rain7d: 2.25, rain14d: 3.4 },
  "Linville River": { rain24h: 0.28, rain3d: 1.05, rain7d: 2.35, rain14d: 4.1 },
  "Yellowstone Prong": { rain24h: 0.68, rain3d: 1.78, rain7d: 2.6, rain14d: 3.85 },
  default: { rain24h: 0.35, rain3d: 1.1, rain7d: 1.95, rain14d: 3.0 }
};

const MOCK_RIVER_GAUGES = {
  "03451500": { dischargeCfs: 2400, gaugeHeightFt: 3.6, waterTempF: 69, normalMedianCfs: 1510 },
  "03453500": { dischargeCfs: 3100, gaugeHeightFt: 4.1, waterTempF: 68, normalMedianCfs: 2350 },
  "03441000": { dischargeCfs: 145, gaugeHeightFt: 1.7, waterTempF: 58, normalMedianCfs: 180 },
  "02150062": { dischargeCfs: 760, gaugeHeightFt: 2.4, waterTempF: 61, normalMedianCfs: 610 },
  "03505550": { dischargeCfs: 820, gaugeHeightFt: 2.7, waterTempF: 54, normalMedianCfs: 690 },
  "03512000": { dischargeCfs: 1500, gaugeHeightFt: 3.2, waterTempF: 66, normalMedianCfs: 980 },
  "03461500": { dischargeCfs: 1900, gaugeHeightFt: 3.5, waterTempF: 63, normalMedianCfs: 1500 },
  "03451000": { dischargeCfs: 430, gaugeHeightFt: 2.2, waterTempF: 67, normalMedianCfs: 250 }
};

export const MOCK_WEATHER_CONTEXT = {
  airTempF: 78,
  windMph: 7,
  thunderstormRisk: 0.22,
  generatedAt: new Date().toISOString()
};

export async function getRecentRainfallForLocation(lat, lon, basin = "default") {
  void lat;
  void lon;
  // TODO: Replace this mock with NOAA/MRMS or another gridded rainfall source.
  // Keep this function as the single rainfall abstraction for future live data.
  return {
    ...(MOCK_RAINFALL_BY_BASIN[basin] || MOCK_RAINFALL_BY_BASIN.default),
    source: "Mock rainfall estimate"
  };
}

export async function fetchUSGSGaugeData(gaugeId) {
  // TODO: Integrate USGS instantaneous values API for discharge, gauge height, and water temperature.
  // The page is designed to keep working when this returns null or partial data.
  const mock = MOCK_RIVER_GAUGES[gaugeId];
  if (!mock) return null;
  return {
    gaugeId,
    ...mock,
    percentNormal: mock.normalMedianCfs ? Math.round((mock.dischargeCfs / mock.normalMedianCfs) * 100) : null,
    observedAt: new Date().toISOString(),
    source: "Mock gauge estimate",
    isLive: false
  };
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function todayEasternParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric"
  }).formatToParts(new Date());
  return {
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value)
  };
}

function parseUSGSInstantaneousValues(payload) {
  const byGauge = {};
  const series = payload?.value?.timeSeries || [];
  series.forEach((item) => {
    const gaugeId = item.sourceInfo?.siteCode?.[0]?.value;
    const parameter = item.variable?.variableCode?.[0]?.value;
    const reading = item.values?.[0]?.value?.[0];
    if (!gaugeId || !parameter || !reading) return;
    byGauge[gaugeId] ||= { gaugeId };
    byGauge[gaugeId].quality ||= {};
    const value = numberOrNull(reading.value);
    if (parameter === "00060") byGauge[gaugeId].dischargeCfs = value;
    if (parameter === "00065") byGauge[gaugeId].gaugeHeightFt = value;
    if (parameter === "00010") {
      byGauge[gaugeId].waterTempF = value !== null ? (value * 9) / 5 + 32 : null;
      byGauge[gaugeId].quality.waterTempF = byGauge[gaugeId].waterTempF;
    }
    if (parameter === "00095") byGauge[gaugeId].quality.specificConductance = value;
    if (parameter === "00300") byGauge[gaugeId].quality.dissolvedOxygen = value;
    if (parameter === "00400") byGauge[gaugeId].quality.ph = value;
    if (parameter === "63680" || parameter === "99133") byGauge[gaugeId].quality.turbidity = value;
    byGauge[gaugeId].observedAt = reading.dateTime || byGauge[gaugeId].observedAt;
    byGauge[gaugeId].quality.observedAt = reading.dateTime || byGauge[gaugeId].quality.observedAt;
  });
  return byGauge;
}

function parseUSGSDailyMedianStats(text, month, day) {
  const byGauge = {};
  String(text || "").split(/\r?\n/).forEach((line) => {
    if (!line || line.startsWith("#") || line.startsWith("agency_cd") || line.startsWith("5s")) return;
    const cols = line.split("\t");
    const gaugeId = cols[1];
    const rowMonth = Number(cols[5]);
    const rowDay = Number(cols[6]);
    if (!gaugeId || rowMonth !== month || rowDay !== day) return;
    byGauge[gaugeId] = {
      normalMedianCfs: numberOrNull(cols[10]),
      normalStartYear: numberOrNull(cols[7]),
      normalEndYear: numberOrNull(cols[8]),
      normalSampleCount: numberOrNull(cols[9])
    };
  });
  return byGauge;
}

async function fetchUSGSGaugeBundle(gaugeIds = []) {
  const uniqueIds = [...new Set(gaugeIds.filter(Boolean))];
  if (!uniqueIds.length) return {};

  const ids = uniqueIds.join(",");
  const { month, day } = todayEasternParts();
  const ivUrl = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${encodeURIComponent(ids)}&parameterCd=00060,00065,00010,00095,00300,00400,63680,99133&siteStatus=all`;
  const statUrl = `https://waterservices.usgs.gov/nwis/stat/?format=rdb&sites=${encodeURIComponent(ids)}&statReportType=daily&statTypeCd=median&parameterCd=00060`;

  try {
    const [ivResponse, statResponse] = await Promise.all([
      fetch(ivUrl),
      fetch(statUrl)
    ]);
    if (!ivResponse.ok || !statResponse.ok) throw new Error("USGS gauge request failed");
    const [ivPayload, statText] = await Promise.all([
      ivResponse.json(),
      statResponse.text()
    ]);
    const currentByGauge = parseUSGSInstantaneousValues(ivPayload);
    const normalByGauge = parseUSGSDailyMedianStats(statText, month, day);
    return Object.fromEntries(uniqueIds.map((gaugeId) => {
      const mock = MOCK_RIVER_GAUGES[gaugeId] || {};
      const live = currentByGauge[gaugeId] || {};
      const normal = normalByGauge[gaugeId] || {};
      const dischargeCfs = live.dischargeCfs ?? mock.dischargeCfs ?? null;
      const normalMedianCfs = normal.normalMedianCfs ?? mock.normalMedianCfs ?? null;
      const percentNormal = dischargeCfs && normalMedianCfs
        ? Math.round((dischargeCfs / normalMedianCfs) * 100)
        : null;
      return [gaugeId, {
        gaugeId,
        dischargeCfs,
        gaugeHeightFt: live.gaugeHeightFt ?? mock.gaugeHeightFt ?? null,
        waterTempF: live.waterTempF ?? mock.waterTempF ?? null,
        quality: live.quality && Object.keys(live.quality).length ? live.quality : null,
        normalMedianCfs,
        percentNormal,
        normalStartYear: normal.normalStartYear || null,
        normalEndYear: normal.normalEndYear || null,
        normalSampleCount: normal.normalSampleCount || null,
        observedAt: live.observedAt || new Date().toISOString(),
        source: "USGS instantaneous values and daily median statistics",
        isLive: Boolean(live.dischargeCfs)
      }];
    }));
  } catch {
    return Object.fromEntries(uniqueIds.map((gaugeId) => [gaugeId, {
      gaugeId,
      ...(MOCK_RIVER_GAUGES[gaugeId] || {}),
      percentNormal: MOCK_RIVER_GAUGES[gaugeId]?.normalMedianCfs
        ? Math.round((MOCK_RIVER_GAUGES[gaugeId].dischargeCfs / MOCK_RIVER_GAUGES[gaugeId].normalMedianCfs) * 100)
        : null,
      observedAt: new Date().toISOString(),
      source: "Mock gauge estimate",
      isLive: false
    }]));
  }
}

export function normalizeGaugeData(raw) {
  if (!raw) return null;
  return {
    gaugeId: raw.gaugeId,
    dischargeCfs: Number.isFinite(Number(raw.dischargeCfs)) ? Number(raw.dischargeCfs) : null,
    gaugeHeightFt: Number.isFinite(Number(raw.gaugeHeightFt)) ? Number(raw.gaugeHeightFt) : null,
    waterTempF: Number.isFinite(Number(raw.waterTempF)) ? Number(raw.waterTempF) : null,
    quality: raw.quality && typeof raw.quality === "object" ? {
      waterTempF: Number.isFinite(Number(raw.quality.waterTempF)) ? Number(raw.quality.waterTempF) : null,
      turbidity: Number.isFinite(Number(raw.quality.turbidity)) ? Number(raw.quality.turbidity) : null,
      dissolvedOxygen: Number.isFinite(Number(raw.quality.dissolvedOxygen)) ? Number(raw.quality.dissolvedOxygen) : null,
      ph: Number.isFinite(Number(raw.quality.ph)) ? Number(raw.quality.ph) : null,
      specificConductance: Number.isFinite(Number(raw.quality.specificConductance)) ? Number(raw.quality.specificConductance) : null,
      observedAt: raw.quality.observedAt || null
    } : null,
    normalMedianCfs: Number.isFinite(Number(raw.normalMedianCfs)) ? Number(raw.normalMedianCfs) : null,
    percentNormal: Number.isFinite(Number(raw.percentNormal)) ? Number(raw.percentNormal) : null,
    normalStartYear: Number.isFinite(Number(raw.normalStartYear)) ? Number(raw.normalStartYear) : null,
    normalEndYear: Number.isFinite(Number(raw.normalEndYear)) ? Number(raw.normalEndYear) : null,
    normalSampleCount: Number.isFinite(Number(raw.normalSampleCount)) ? Number(raw.normalSampleCount) : null,
    observedAt: raw.observedAt || null,
    source: raw.source || "Gauge data",
    isLive: Boolean(raw.isLive)
  };
}

export async function getWaterPageInputs() {
  const gaugeById = await fetchUSGSGaugeBundle(RIVERS.map((river) => river.usgsGaugeId));

  const waterfallRainfall = await Promise.all(
    WATERFALLS.map(async (waterfall) => ({
      waterfallId: waterfall.id,
      rainfall: await getRecentRainfallForLocation(waterfall.lat, waterfall.lon, waterfall.basin)
    }))
  );

  const riverInputs = await Promise.all(
    RIVERS.map(async (river) => ({
      riverId: river.id,
      rainfall: await getRecentRainfallForLocation(river.lat, river.lon, river.name),
      gauge: normalizeGaugeData(gaugeById[river.usgsGaugeId] || await fetchUSGSGaugeData(river.usgsGaugeId))
    }))
  );

  return {
    waterfalls: WATERFALLS,
    rivers: RIVERS,
    webcams: WATER_WEBCAMS,
    waterfallRainfall,
    riverInputs,
    weather: MOCK_WEATHER_CONTEXT
  };
}
