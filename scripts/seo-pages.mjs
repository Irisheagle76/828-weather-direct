export const SITE_ORIGIN = "https://avlweather.com";

export const PUBLIC_PAGES = [
  { pathname: "/", file: "index.html", intent: "Asheville weather and current conditions" },
  { pathname: "/forecast.html", file: "forecast.html", intent: "Asheville local forecast and meteorologist analysis" },
  { pathname: "/radar.html", file: "radar.html", intent: "Asheville radar and precipitation tracking" },
  { pathname: "/pulse.html", file: "pulse.html", intent: "Timely Asheville weather updates" },
  { pathname: "/asheville-microscope.html", file: "asheville-microscope.html", intent: "Asheville neighborhood observations and microclimates" },
  { pathname: "/hiking.html", file: "hiking.html", intent: "Asheville and Blue Ridge hiking weather" },
  { pathname: "/water.html", file: "water.html", intent: "Western North Carolina water and waterfall conditions" },
  { pathname: "/828-sunset-radiance.html", file: "828-sunset-radiance.html", intent: "Asheville sunset and cloud-viewing conditions" },
  { pathname: "/i26-connector.html", file: "i26-connector.html", intent: "Asheville I-26 construction and weather impacts" },
  { pathname: "/fall.html", file: "fall.html", intent: "Asheville and WNC fall color weather" },
  { pathname: "/about.html", file: "about.html", intent: "828 Weather Direct expertise and authorship" }
];

export const EXCLUDED_HTML = [
  "404.html", "828-forecast.html", "asheville-microscope-lab.html", "hiking-preview-v2.html",
  "home-sky-preview.html", "home-sky-preview-v2.html", "preview.html", "rainfall-trend-preview.html",
  "sky-preview.html", "static.html", "sunset.html", "obs-overlay/index.html"
];
