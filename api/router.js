const routes = {
  "admin/login": () => import("../lib/api-routes/admin/login.js"),
  "admin/logout": () => import("../lib/api-routes/admin/logout.js"),
  "alerts/clear": () => import("../lib/api-routes/alerts/clear.js"),
  "alerts/latest": () => import("../lib/api-routes/alerts/latest.js"),
  "alerts/publish": () => import("../lib/api-routes/alerts/publish.js"),
  "drought-fire": () => import("../lib/api-routes/drought-fire.js"),
  "rainfall-context": () => import("../lib/api-routes/rainfall-context.js"),
  "fall": () => import("../lib/api-routes/fall.js"),
  "forecast/latest": () => import("../lib/api-routes/forecast/latest.js"),
  "forecast/model": () => import("../lib/api-routes/forecast/model.js"),
  "forecast/automatic": () => import("../lib/api-routes/forecast/automatic.js"),
  "forecast/publish": () => import("../lib/api-routes/forecast/publish.js"),
  "hiking/current": () => import("../lib/api-routes/hiking/current.js"),
  "notifications/public-key": () => import("../lib/api-routes/notifications/public-key.js"),
  "notifications/status": () => import("../lib/api-routes/notifications/status.js"),
  "notifications/subscribe": () => import("../lib/api-routes/notifications/subscribe.js"),
  "nowcast/current": () => import("../lib/api-routes/nowcast/current.js"),
  "nowcast/drafts": () => import("../lib/api-routes/nowcast/drafts.js"),
  "observations/elevation": () => import("../lib/api-routes/observations/elevation.js"),
  "observations/calibration": () => import("../lib/api-routes/observations/calibration.js"),
  "observations/sample": () => import("../lib/api-routes/observations/sample.js"),
  "i26/cameras": () => import("../lib/api-routes/i26/cameras.js"),
  "i26/email-alerts": () => import("../lib/api-routes/i26/email-alerts.js"),
  "i26/email-alerts-ingest": () => import("../lib/api-routes/i26/email-alerts-ingest.js"),
  "i26/incidents": () => import("../lib/api-routes/i26/incidents.js"),
  "i26/news-feed": () => import("../lib/api-routes/i26/news-feed.js"),
  "i26/news-write": () => import("../lib/api-routes/i26/news-write.js"),
  "sky/current": () => import("../lib/api-routes/sky/current.js"),
  "storm/current": () => import("../lib/api-routes/storm/current.js"),
  "substack-articles": () => import("../lib/api-routes/substack-articles.js"),
  "substack-og": () => import("../lib/api-routes/substack-og.js"),
  "tempest/device": () => import("../lib/api-routes/tempest/device.js"),
  "tidbits/pulse-feed": () => import("../lib/api-routes/tidbits/pulse-feed.js"),
  "tidbits/pulse-latest": () => import("../lib/api-routes/tidbits/pulse-latest.js"),
  "tidbits/pulse-media": () => import("../lib/api-routes/tidbits/pulse-media.js"),
  "tidbits/pulse-upload-signature": () => import("../lib/api-routes/tidbits/pulse-upload-signature.js"),
  "tidbits/pulse-write": () => import("../lib/api-routes/tidbits/pulse-write.js"),
  "water/conditions": () => import("../lib/api-routes/water/conditions.js"),
  "youtube/live": () => import("../lib/api-routes/youtube/live.js"),
  "weather": () => import("../lib/api-routes/weather.js")
};

export default async function handler(req, res) {
  const route = String(req.query?.route || "").replace(/^\/+|\/+$/g, "");
  const loadRoute = routes[route];

  if (!loadRoute) {
    return res.status(404).json({ error: "API route not found" });
  }

  const { default: routeHandler } = await loadRoute();
  return routeHandler(req, res);
}
