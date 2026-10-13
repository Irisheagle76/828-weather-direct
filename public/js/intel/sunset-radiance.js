// Shared desktop Radiance algorithm. Inputs and phase policy are supplied by each surface.
export function createRadianceEngine({state,isObscuredSky,pickNumber,clamp,pct,labelize,formatTime,getTodayDaily,getSunsetHour,getCurrentHour,getRadiancePhase,getSkyPrecipOverride,buildDuskSkyFallback}) {
    function scoreCloudTexture(cameraCloud, forecastCloud, phase, skyIntel = null) {
      if (isObscuredSky(skyIntel)) {
        return {
          score: 24,
          label: "Live view obscured",
          detail: phase?.state === "setup" || phase?.state === "waiting"
            ? "Fog or low cloud is hiding the current cloud texture. It is useful now context, but not a clean sunset texture read yet."
            : "Fog or low cloud is hiding the actual cloud texture, so the sunset read should stay cautious."
        };
      }

      const cloud = Number.isFinite(forecastCloud) ? forecastCloud * 100 : cameraCloud;
      const hasForecastCloud = Number.isFinite(forecastCloud);
      const earlySetup = phase?.state === "setup" || phase?.state === "waiting";
      if (!Number.isFinite(cloud)) return { score: 58, label: "Limited cloud data", detail: "Using the camera read more heavily until forecast cloud cover is available." };
      let score;
      if (cloud >= 25 && cloud <= 60) score = 92;
      else if (cloud > 60 && cloud <= 75) score = 78;
      else if (cloud >= 12 && cloud < 25) score = 68;
      else if (cloud > 75 && cloud <= 88) score = 48;
      else if (cloud < 12) score = 42;
      else score = 26;
      return {
        score,
        label: earlySetup && hasForecastCloud
          ? `Early forecast: ${Math.round(cloud)}% near sunset`
          : hasForecastCloud
            ? `${Math.round(cloud)}% clouds near sunset`
            : `Current camera: ${Math.round(cloud)}% clouds`,
        detail: earlySetup
          ? hasForecastCloud
            ? "This is a long-range sunset ingredient, not a final read. Morning cloud cover can change a lot before low-angle light arrives."
            : "This is the current sky read only. It is useful for the now story, but it is too early to treat it as a sunset forecast."
          : cloud >= 25 && cloud <= 60
          ? "A strong color setup: enough texture to catch light without fully blocking the horizon."
          : cloud > 75
            ? "Clouds may be too dominant unless the western edge opens up."
            : "The sky may be clean, but color needs cloud texture to really spread."
      };
    }

    function scoreMoisture(hour, camera, phase, skyIntel = null) {
      const humidity = pickNumber(hour, ["relativeHumidity", "relative_humidity", "humidity"]);
      const precip = pickNumber(hour, ["precipProbability", "precipitation_probability", "probabilityOfPrecipitation"]);
      const fog = isObscuredSky(skyIntel) || camera?.metrics?.visibilityScore === 0;
      const earlySetup = phase?.state === "setup" || phase?.state === "waiting";
      let score = 78;
      if (Number.isFinite(humidity)) {
        const humidityPct = humidity <= 1 ? humidity * 100 : humidity;
        if (humidityPct >= 35 && humidityPct <= 68) score = 88;
        else if (humidityPct > 82) score = 46;
        else if (humidityPct < 25) score = 58;
        else score = 70;
      }
      if (Number.isFinite(precip)) score -= precip * 34;
      if (fog) score -= 38;
      return {
        score: clamp(score),
        label: Number.isFinite(humidity)
          ? `${earlySetup ? "Forecast " : ""}${pct(humidity)} humidity${earlySetup ? " near sunset" : ""}`
          : "Humidity pending",
        detail: earlySetup
          ? "This is still a forecast ingredient. The better question later today will be whether fog, haze, or rain is present near the actual window."
          : fog
          ? "Fog is the main limiter right now."
          : Number.isFinite(precip) && precip > 0.35
            ? "Rain chances are high enough to mute or interrupt color."
            : "Moisture does not look like the primary blocker."
      };
    }

    function scoreClearing(skyIntel, camera, phase) {
      const m = camera?.metrics || {};
      const earlySetup = phase?.state === "setup" || phase?.state === "waiting";
      let score = 56;
      if (skyIntel?.atmosphericState === "mostly_clear") score = 62;
      if (skyIntel?.atmosphericState === "partly_cloudy") score = 86;
      if (skyIntel?.atmosphericState === "mostly_cloudy") score = 58;
      if (skyIntel?.atmosphericState === "overcast") score = 30;
      if (skyIntel?.atmosphericState === "fog") score = 18;
      if (skyIntel?.atmosphericState === "low_cloud") score = 22;
      const obscured = isObscuredSky(skyIntel);
      if (m.sunlightDetected && !obscured) score += m.sunlightLevel === "strong" ? 10 : 5;
      if (Number.isFinite(m.skyBlueSignal) && m.skyBlueSignal > (obscured ? 1.2 : 1.05)) score += 8;
      return {
        score: clamp(score),
        label: earlySetup ? `Current sky: ${labelize(skyIntel?.atmosphericState)}` : labelize(skyIntel?.atmosphericState),
        detail: obscured
          ? "A low cloud or fog layer is obscuring the view, which limits the current sunset color case."
          : earlySetup
          ? "This describes what Asheville looks like now. It is useful context, but the real clearing signal matters most after mid-afternoon."
          : m.sunlightDetected
          ? "Sunlight is still getting into the cloud deck, which helps the evening color case."
          : "The sky needs more breaks or filtered light to lift the radiance score."
      };
    }

    function scoreTiming(weather) {
      const daily = getTodayDaily(weather);
      if (!daily?.sunset) {
        return { score: 60, label: "Sunset time pending", detail: "The page will refine timing once the weather feed responds." };
      }
      const minutes = (daily.sunset - Date.now()) / 60000;
      let score = 72;
      if (minutes > 0 && minutes <= 120) score = 94;
      else if (minutes > 120 && minutes <= 240) score = 82;
      else if (minutes < -45) score = 36;
      else if (minutes < 0) score = 64;
      return {
        score,
        label: formatTime(daily.sunset),
        detail: minutes > 0
          ? `Best color usually builds from about ${formatTime(daily.sunset - 35 * 60000)} through ${formatTime(daily.sunset + 15 * 60000)}.`
          : "Today's sunset has passed, so the score is leaning on current twilight and sky texture."
      };
    }

    function buildRadiance() {
      const cameraCloud = state.skyIntel?.cloud;
      const sunsetHour = getSunsetHour(state.weather);
      const daily = getTodayDaily(state.weather);
      const rawPhase = getRadiancePhase(daily);
      const earlySetup = rawPhase.state === "setup" || rawPhase.state === "waiting";
      const texture = scoreCloudTexture(cameraCloud, sunsetHour?.cloudCover, rawPhase, state.skyIntel);
      const moisture = scoreMoisture(sunsetHour, state.skyData, rawPhase, state.skyIntel);
      const clearing = scoreClearing(state.skyIntel, state.skyData, rawPhase);
      const timing = scoreTiming(state.weather);

      let score = Math.round(
        texture.score * 0.36 +
        clearing.score * 0.28 +
        moisture.score * 0.22 +
        timing.score * 0.14
      );
      const obscured = isObscuredSky(state.skyIntel);
      if (obscured) score = Math.min(score, earlySetup ? 56 : 48);

      const currentHour = getCurrentHour(state.weather);
      const precipAmount = pickNumber(currentHour, ["precipAmount", "precipitation", "rain"]);
      const weatherCode = pickNumber(currentHour, ["weatherCode", "weather_code"]);
      const precipOverride = getSkyPrecipOverride();
      const sharedSunsetRead = buildDuskSkyFallback({
        cameraCloud: state.skyIntel?.displayCloud ?? state.skyIntel?.cloud,
        cloudCover: pickNumber(currentHour, ["cloudCover", "cloud_cover", "cloudcover"]),
        phase: rawPhase.state === "peak" ? "sunset" : "afterglow",
        sunsetAt: daily?.sunset,
        precipActive: precipOverride?.mode === "active",
        recentRain: precipOverride?.mode === "recent",
        precipAmount,
        precipProbability: pickNumber(currentHour, ["precipProbability", "precipitation_probability", "probabilityOfPrecipitation"]),
        weatherCode,
        sunlightDetected: state.skyIntel?.sunlightDetected,
        sunlightLevel: state.skyIntel?.sunlightLevel,
        obscured
      });
      const gateCloud = sharedSunsetRead.cloud;
      const wetSignal = sharedSunsetRead.wetSignal;
      const afterglowVetted = rawPhase.state === "post_sunset" && sharedSunsetRead.radianceVetted;
      const phase = rawPhase.state === "post_sunset"
        ? afterglowVetted
          ? { ...rawPhase, state: "afterglow", label: "Verified afterglow" }
          : {
              ...rawPhase,
              state: "twilight",
              label: wetSignal
                ? "Wet twilight"
                : Number.isFinite(gateCloud) && gateCloud >= 0.75
                  ? "Cloudy twilight"
                  : "Post-sunset check"
            }
        : rawPhase;

      const sharedSunsetCaution = (rawPhase.state === "peak" || rawPhase.state === "post_sunset") &&
        !sharedSunsetRead.radianceVetted;

      return {
        phase,
        score,
        afterglowVetted,
        wetSignal,
        title: precipOverride?.mode === "clearing"
          ? "Clearing is returning after the storms"
          : precipOverride?.mode === "nearby"
          ? "Storms remain nearby"
          : precipOverride?.type === "storm" && precipOverride?.mode === "active"
          ? "A thunderstorm is controlling the sunset setup"
          : sharedSunsetCaution ? sharedSunsetRead.headline
          : phase.state === "closed" ? "Tonight's radiance window has closed"
          : obscured ? (earlySetup ? "Fog is muting the early setup" : "Fog is muting the sunset setup")
          : earlySetup ? "Early sunset setup"
          : score >= 90 ? "High radiance potential"
          : score >= 80 ? "Strong sunset chance"
          : score >= 65 ? "Worth watching"
          : score >= 45 ? "Mixed sunset setup"
          : "Low color potential",
        detail: ["active", "clearing", "nearby"].includes(precipOverride?.mode) &&
          (precipOverride?.type === "storm" || precipOverride?.mode !== "active")
          ? precipOverride.summary
          : sharedSunsetCaution ? sharedSunsetRead.detail
          : phase.state === "closed"
          ? "The useful sunset and twilight period has passed for Asheville. The sky snapshot remains here for context, and tomorrow's window will come back into focus after the next daylight cycle begins."
          : obscured
          ? "The live camera view is obscured by fog or low cloud. Forecast ingredients can still improve later, but the current sky read should stay cautious."
          : earlySetup
          ? "This is still a long-lead setup read. Current daytime sky conditions are informative, but the true sunset signal starts to matter much more after about 3 PM."
          : score >= 80
          ? "The sky has enough working ingredients to justify keeping an eye on the western horizon."
          : score >= 65
            ? "There are useful ingredients, but the signal is still short of a strong sunset alert."
            : score >= 45
            ? "There are useful ingredients, but one or two limits may keep color localized or brief."
            : "The current setup is likely to stay muted unless the western sky opens quickly.",
        factors: [
          { name: "Cloud texture", ...texture },
          { name: "Clearing signal", ...clearing },
          { name: "Moisture drag", ...moisture },
          { name: "Sunset window", ...timing }
        ]
      };
    }


return buildRadiance;
}
