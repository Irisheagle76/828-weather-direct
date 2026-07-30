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
    lat: 35.2020605,
    lon: -82.6237349,
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
    lat: 35.1989797,
    lon: -82.6171123,
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
    lat: 35.19265,
    lon: -82.61365,
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

function unavailableRainfall() {
  return {
    available: false,
    rain6h: null,
    rain24h: null,
    rain3d: null,
    rain7d: null,
    rain14d: null,
    observedThrough: null,
    source: "Precipitation unavailable"
  };
}

function unavailablePayload() {
  return {
    waterfallRainfall: WATERFALLS.map((waterfall) => ({
      waterfallId: waterfall.id,
      rainfall: unavailableRainfall()
    })),
    riverInputs: RIVERS.map((river) => ({
      riverId: river.id,
      rainfall: unavailableRainfall(),
      gauge: null
    })),
    weather: {
      airTempF: null,
      windMph: null,
      thunderstormRisk: null,
      observedAt: null,
      source: "Weather guidance unavailable"
    },
    meta: {
      generatedAt: null,
      status: "unavailable",
      precipitationAvailable: false,
      gaugesAvailable: false,
      precipitationSource: "Unavailable",
      gaugeSource: "Unavailable"
    }
  };
}

export async function getWaterPageInputs() {
  let live = unavailablePayload();

  try {
    const response = await fetch("/api/router?route=water/conditions&v=20260730-basin3", {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`Water conditions returned ${response.status}`);
    live = await response.json();
  } catch (error) {
    console.warn("Live water inputs unavailable", error);
  }

  return {
    waterfalls: WATERFALLS,
    rivers: RIVERS,
    webcams: WATER_WEBCAMS,
    waterfallRainfall: Array.isArray(live.waterfallRainfall)
      ? live.waterfallRainfall
      : unavailablePayload().waterfallRainfall,
    riverInputs: Array.isArray(live.riverInputs)
      ? live.riverInputs
      : unavailablePayload().riverInputs,
    weather: live.weather || unavailablePayload().weather,
    meta: live.meta || unavailablePayload().meta
  };
}
