function normalizePercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n > 1 ? n : n * 100;
}

function seededIndex(seed, length) {
  if (!length) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % length;
}

function narrativeSeed(data, state, transition) {
  const timestamp = data?.timestamp || data?.capturedAt || "";
  const bucket = timestamp ? String(timestamp).slice(0, 13) : new Date().toISOString().slice(0, 13);
  return `${bucket}:${state || "unknown"}:${transition || "steady"}`;
}

function chooseNarrative(data, state, transition, options) {
  return options[seededIndex(narrativeSeed(data, state, transition), options.length)];
}

function withCommon(result, confidence, type) {
  return {
    ...result,
    confidence,
    type
  };
}

function mostlyCloudyDetail({ sunlightDetected, cloud }) {
  if (Number.isFinite(cloud) && cloud >= 85) {
    return "Clouds are doing most of the work overhead, with only a few brighter spots showing through.";
  }
  if (sunlightDetected) {
    return "There is still some light reaching the ground, but the cloud layer is the main story.";
  }
  return "Breaks are limited, and the sky has more gray texture than open blue right now.";
}

export function generateSkyNarrative(data, skyIntel = null) {
  if (!data || !data.metrics || !skyIntel) return null;

  const m = data.metrics;
  const t = data.trend || {};

  const state = skyIntel.atmosphericState;
  const transition = skyIntel.transition;
  const cloud = normalizePercent(skyIntel.displayCloud ?? skyIntel.cloud);

  const sunlightDetected = m.sunlightDetected;
  const sunlightLevel = m.sunlightLevel;
  const cloudTrend = Number(t.cloudDelta ?? t.cloudChange ?? t.cloudTrend);
  const brightening = transition === "improving" || transition === "sun_breaking_through" || cloudTrend < -8;
  const dimming = transition === "deteriorating" || cloudTrend > 8;

  if (m.mode === "night") {
    return {
      headline: "Quiet conditions have settled in for the night.",
      detail: "It's too dark to reliably assess sky conditions right now.",
      confidence: "low",
      type: "night"
    };
  }

  if (transition === "sun_breaking_through") {
    return withCommon(chooseNarrative(data, state, transition, [
      {
        headline: "Some breaks are starting to show up in the clouds.",
        detail: "It is still mostly cloudy, but brighter spots are beginning to develop."
      },
      {
        headline: "The clouds are starting to give the sun a little room.",
        detail: "The sky is not wide open, but the camera is picking up brighter gaps than before."
      },
      {
        headline: "A few sun breaks are trying to punch through.",
        detail: "Clouds remain the main player, though the light is becoming more useful in spots."
      },
      {
        headline: "The sky is beginning to brighten around the edges.",
        detail: "The cloud deck still matters, but it is no longer reading as completely locked in."
      }
    ]), "high", "improving");
  }

  if (transition === "improving") {
    return withCommon(chooseNarrative(data, state, transition, [
      {
        headline: "Cloud cover is starting to thin out.",
        detail: "Gradual clearing is underway with more light getting through."
      },
      {
        headline: "The sky is slowly opening up.",
        detail: "Clouds are still around, but the trend is toward a brighter, less closed-in look."
      },
      {
        headline: "Brighter breaks are becoming easier to find.",
        detail: "The camera view suggests the cloud layer is loosening rather than filling back in."
      },
      {
        headline: "The gray is losing a little of its grip.",
        detail: "It is not a clean clearing yet, but the visual trend is moving in the right direction."
      }
    ]), "medium", "improving");
  }

  if (transition === "deteriorating") {
    return withCommon(chooseNarrative(data, state, transition, [
      {
        headline: "Clouds are building back in.",
        detail: "Skies are trending more gray with less light getting through."
      },
      {
        headline: "The sky is closing down a bit.",
        detail: "The latest view shows cloud cover gaining ground and the light becoming flatter."
      },
      {
        headline: "Cloud cover is becoming more dominant.",
        detail: "The brighter breaks are fading, and the view is taking on a grayer look."
      },
      {
        headline: "The light is starting to get muted again.",
        detail: "Clouds are filling more of the view, so the sky read is trending less open."
      }
    ]), "medium", "deteriorating");
  }

  if (state === "fog") {
    return withCommon(chooseNarrative(data, state, transition, [
      {
        headline: "Fog is limiting visibility across the area.",
        detail: "Views are obscured with very little definition in the distance."
      },
      {
        headline: "The view is softened by fog right now.",
        detail: "The camera is seeing a muted, low-contrast scene rather than a clean sky read."
      },
      {
        headline: "Visibility is taking the lead over cloud detail.",
        detail: "Fog is making it hard to separate sky conditions from the low-level haze."
      },
      {
        headline: "A foggy layer is blurring the Asheville view.",
        detail: "Sky cover is being handled cautiously because the distance view is obscured."
      }
    ]), "high", "fog");
  }

  if (state === "low_cloud") {
    return withCommon(chooseNarrative(data, state, transition, [
      {
        headline: "Low cloud is obscuring the view.",
        detail: "The camera view is washed out, so cloud cover and sunlight are being treated cautiously."
      },
      {
        headline: "A low cloud layer is sitting on the view.",
        detail: "The sky read is muted because the camera is seeing more obstruction than open sky."
      },
      {
        headline: "The sky is wrapped in low cloud.",
        detail: "Details above Asheville are hard to read, so the module is leaning conservative."
      },
      {
        headline: "Low clouds are flattening the scene.",
        detail: "The view does not offer enough depth for a confident sunshine or cloud-break read."
      }
    ]), "medium", "fog");
  }

  if (state === "low_stratus") {
    return withCommon(chooseNarrative(data, state, transition, [
      {
        headline: "A gray low cloud deck is in place.",
        detail: "Downtown buildings and the ridge line are still readable, but the cloud base is keeping the sky flat and muted."
      },
      {
        headline: "Low stratus is giving the sky a flat gray look.",
        detail: "The view has structure near the ground, but the ceiling itself is doing most of the talking."
      },
      {
        headline: "A low ceiling is keeping the light subdued.",
        detail: "The camera can still read the city, but the sky overhead is more blanket than broken cloud."
      },
      {
        headline: "The cloud base looks low and steady.",
        detail: "This is a muted sky read, with little sign of meaningful clearing in the camera view."
      }
    ]), "high", "cloud");
  }

  if (state === "overcast") {
    return withCommon(chooseNarrative(data, state, transition, [
      {
        headline: "Gray, overcast skies are in place.",
        detail: "Clouds are firmly in control with very little sunlight getting through."
      },
      {
        headline: "The sky is locked into a gray overcast.",
        detail: "The light is flat, and the cloud deck is not offering much definition right now."
      },
      {
        headline: "Clouds have the sky fully covered.",
        detail: "There is not much brightness to work with, so the current read is a straightforward gray one."
      },
      {
        headline: "A solid cloud deck is sitting over Asheville.",
        detail: "The view reads closed-in, with little evidence of sun breaks at the moment."
      },
      {
        headline: "It is a muted, overcast sky right now.",
        detail: "The cloud layer is broad and steady, keeping the daylight soft and limited."
      }
    ]), "high", "cloud");
  }

  if (state === "overcast_bright") {
    return withCommon(chooseNarrative(data, state, transition, [
      {
        headline: "Clouds are in control, but it is fairly bright.",
        detail: "A solid cloud deck is in place, though filtered light is getting through."
      },
      {
        headline: "The sky is overcast, but not especially dark.",
        detail: "Clouds dominate the view while still allowing enough light to keep things from feeling gloomy."
      },
      {
        headline: "A bright overcast is hanging over Asheville.",
        detail: "The cloud cover is broad, but the daylight underneath it still has some lift."
      },
      {
        headline: "Cloud cover is widespread with filtered brightness.",
        detail: "The sun is not clearly visible, but the sky is brighter than a typical flat gray overcast."
      }
    ]), "high", "cloud");
  }

  if (state === "mostly_cloudy") {
    return withCommon(chooseNarrative(data, state, transition, [
      {
        headline: "Clouds are covering most of the sky.",
        detail: mostlyCloudyDetail({ sunlightDetected, cloud })
      },
      {
        headline: "The sky is leaning mostly cloudy.",
        detail: sunlightDetected
          ? "Some brightness is still getting through, but clouds are carrying the current look."
          : "Open breaks are limited, and the view is more cloud-filled than mixed."
      },
      {
        headline: "Clouds are the main feature overhead.",
        detail: "There may be a few brighter pockets, but this is not reading as an open-sky moment."
      },
      {
        headline: "Mostly cloudy conditions are holding on.",
        detail: brightening
          ? "The deck may be loosening a little, but cloud cover still owns most of the view."
          : "The view remains cloud-heavy, with sunlight playing a smaller role."
      },
      {
        headline: "The sky has more cloud than clearing right now.",
        detail: dimming
          ? "The light is becoming more muted as clouds gain back some ground."
          : "Clouds are widespread, though the scene is not completely dark or socked in."
      }
    ]), "medium", "cloud");
  }

  if (state === "mostly_cloudy_filtered") {
    return withCommon(chooseNarrative(data, state, transition, [
      {
        headline: "Mostly cloudy skies with filtered sunshine.",
        detail: "Visible satellite and soft shadow contrast point to high clouds muting the sun, even though filtered brightness is still reaching the ground."
      },
      {
        headline: "The sun is being filtered through a cloudier sky.",
        detail: "There is brightness in the scene, but the cloud layer is softening and spreading the light."
      },
      {
        headline: "Clouds are winning, but the light is not gone.",
        detail: "The camera and satellite clues point to a veiled sun working through a mostly cloudy layer."
      },
      {
        headline: "Filtered brightness is showing through mostly cloudy skies.",
        detail: "This is not full sunshine, but the sky still has enough glow to keep conditions from looking flat."
      },
      {
        headline: "High clouds are putting a veil over the sun.",
        detail: "The sky reads mostly cloudy, with softened light rather than a clean sunny break."
      }
    ]), "high", "cloud");
  }

  if (state === "filtered_sunshine") {
    return withCommon(chooseNarrative(data, state, transition, [
      {
        headline: "Filtered sunshine is making it through the clouds.",
        detail: "The sky is bright, but high-cloud clues and soft pavement shadows point to a veiled sun rather than a wide-open sunny sky."
      },
      {
        headline: "Sunshine is getting through, but with a filter on it.",
        detail: "The light is useful and noticeable, though the sky still has enough cloud texture to soften it."
      },
      {
        headline: "The sun is showing through a thin cloud veil.",
        detail: "It looks bright over Asheville, but the light is more diffused than crystal-clear."
      },
      {
        headline: "A veiled sun is brightening the scene.",
        detail: "Clouds are not blocking the light outright, but they are muting the sharpness of the sunshine."
      },
      {
        headline: "The sky is bright with softened sunshine.",
        detail: "This is a filtered-light setup, with high clouds taking the edge off the sun."
      },
      {
        headline: "Sunlight is present, just not wide open.",
        detail: "The current view has enough brightness to feel sunny, but the sky is still carrying a cloudy filter."
      }
    ]), "high", "cloud");
  }

  if (state === "partly_cloudy") {
    return withCommon(chooseNarrative(data, state, transition, [
      {
        headline: "A mix of clouds and sun across the area.",
        detail: sunlightLevel === "strong"
          ? "There are brighter breaks, but clouds are still a noticeable part of the sky."
          : "Clouds and sun are sharing the sky with no clear winner."
      },
      {
        headline: "Clouds and sunshine are splitting the view.",
        detail: "The sky has enough open space for brightness, but enough cloud cover to keep it from reading fully clear."
      },
      {
        headline: "It is a partly cloudy look over Asheville.",
        detail: brightening
          ? "Brighter breaks are becoming more noticeable, even with clouds still in the picture."
          : "The view is balanced, with clouds moving through rather than taking over."
      },
      {
        headline: "Sun breaks are mixing with passing clouds.",
        detail: "The sky has a changeable feel, with neither gray nor full sun completely taking charge."
      },
      {
        headline: "There is enough sun to notice and enough cloud to matter.",
        detail: "The current view lands in that middle ground between open sky and mostly cloudy."
      }
    ]), "medium", "cloud");
  }

  if (state === "mostly_clear") {
    return withCommon(chooseNarrative(data, state, transition, [
      {
        headline: "Mostly sunny skies are in place.",
        detail: "Just a few clouds around with plenty of open sky."
      },
      {
        headline: "The sky is mostly open over Asheville.",
        detail: "A few clouds may be around, but sunshine is doing most of the work right now."
      },
      {
        headline: "Sunshine has plenty of room to work.",
        detail: "Cloud cover is limited, and the camera view is reading bright and open."
      },
      {
        headline: "It is a mostly clear, bright sky right now.",
        detail: "There is not much cloud cover competing with the sun at the moment."
      },
      {
        headline: "The sky is leaning sunny and open.",
        detail: "Any clouds in the view are minor compared with the amount of clear sky showing."
      }
    ]), "high", "clear");
  }

  return withCommon(chooseNarrative(data, state, transition, [
    {
      headline: "Clear skies are in place.",
      detail: "Wide open visibility with bright conditions overhead."
    },
    {
      headline: "The sky is reading clear right now.",
      detail: "Clouds are not playing much of a role in the current view."
    },
    {
      headline: "Open sky is the main story.",
      detail: "The camera view points to bright, uncomplicated sky conditions."
    },
    {
      headline: "Sunshine is getting a clean lane over Asheville.",
      detail: "The view has little cloud interference and plenty of open brightness."
    }
  ]), "high", "clear");
}
