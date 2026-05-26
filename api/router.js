const routes = {
  "admin/login": () => import("../lib/api-routes/admin/login.js"),
  "admin/logout": () => import("../lib/api-routes/admin/logout.js"),
  "alerts/clear": () => import("../lib/api-routes/alerts/clear.js"),
  "alerts/latest": () => import("../lib/api-routes/alerts/latest.js"),
  "alerts/publish": () => import("../lib/api-routes/alerts/publish.js"),
  "drought-fire": () => import("../lib/api-routes/drought-fire.js"),
  "forecast/latest": () => import("../lib/api-routes/forecast/latest.js"),
  "forecast/publish": () => import("../lib/api-routes/forecast/publish.js"),
  "notifications/public-key": () => import("../lib/api-routes/notifications/public-key.js"),
  "notifications/status": () => import("../lib/api-routes/notifications/status.js"),
  "notifications/subscribe": () => import("../lib/api-routes/notifications/subscribe.js"),
  "substack-articles": () => import("../lib/api-routes/substack-articles.js"),
  "substack-og": () => import("../lib/api-routes/substack-og.js"),
  "tempest/device": () => import("../lib/api-routes/tempest/device.js"),
  "tidbits/pulse-feed": () => import("../lib/api-routes/tidbits/pulse-feed.js"),
  "tidbits/pulse-latest": () => import("../lib/api-routes/tidbits/pulse-latest.js"),
  "tidbits/pulse-media": () => import("../lib/api-routes/tidbits/pulse-media.js"),
  "tidbits/pulse-upload-signature": () => import("../lib/api-routes/tidbits/pulse-upload-signature.js"),
  "tidbits/pulse-write": () => import("../lib/api-routes/tidbits/pulse-write.js"),
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
