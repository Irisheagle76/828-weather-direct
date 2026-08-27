export const DESTINATIONS = [
  { id: "asheville", name: "Asheville", latitude: 35.5951, longitude: -82.5515, elevationFeet: 2134, region: "French Broad Valley", type: "city" },
  { id: "black-mountain", name: "Black Mountain", latitude: 35.6179, longitude: -82.3212, elevationFeet: 2405, region: "Swannanoa Valley", type: "town" },
  { id: "waynesville", name: "Waynesville", latitude: 35.4887, longitude: -82.9887, elevationFeet: 2752, region: "Haywood County", type: "town" },
  { id: "pisgah", name: "Mt. Pisgah / Southern Parkway", latitude: 35.4258, longitude: -82.7567, elevationFeet: 5721, region: "Southern Parkway", type: "summit" },
  { id: "graveyard", name: "Graveyard Fields", latitude: 35.3207, longitude: -82.8473, elevationFeet: 5120, region: "Southern Parkway", type: "overlook" },
  { id: "black-balsam", name: "Black Balsam", latitude: 35.3257, longitude: -82.8743, elevationFeet: 6214, region: "Southern Parkway", type: "ridge" },
  { id: "craggy", name: "Craggy Gardens", latitude: 35.7043, longitude: -82.3736, elevationFeet: 5892, region: "Northern Parkway", type: "overlook" },
  { id: "mitchell", name: "Mt. Mitchell", latitude: 35.7648, longitude: -82.2652, elevationFeet: 6684, region: "Black Mountains", type: "summit" }
];

export const CAMERAS = [
  { id: "mitchell", name: "Mount Mitchell", elevationFeet: 6684, imageUrl: "https://nchighpeaks.org/cam11/up/image.jpg", sourceUrl: "https://nchighpeaks.org/cam11/cam11view.php", refreshSeconds: 300, region: "Black Mountains", alt: "Live northeast view from the summit of Mount Mitchell" },
  { id: "pisgah", name: "Pisgah Inn", elevationFeet: 5000, imageUrl: "https://streamer5.brownrice.com/cam-images/pisgahinn1.jpg", sourceUrl: "https://streamer5.brownrice.com/cam-images/pisgahinn1.jpg", refreshSeconds: 300, region: "Southern Parkway", alt: "Live mountain view from Pisgah Inn" },
  { id: "grassland", name: "Grassland Mountain", elevationFeet: 4130, imageUrl: "https://cameraftpapi.drivehq.com/api/Camera/GetCameraThumbnail.ashx?parentID=361818469&shareID=17333090", sourceUrl: "https://www.weatherlink.com/embeddablePage/show/eb5b3cb48064488fbf13910524445c99/wide", refreshSeconds: 300, region: "Madison County", alt: "Live sky view from Grassland Mountain Observatory" },
  { id: "max-patch", name: "Max Patch North", elevationFeet: 4420, imageUrl: "https://assets2.webcam.io/w/9W1ZRz/latest.jpg", sourceUrl: "https://www.wunderground.com/dashboard/pws/KTNDELRI5", refreshSeconds: 300, region: "Northwest High Country", alt: "Live high-country view north of Max Patch" },
  { id: "the-swag", name: "The Swag", latitude: 35.57400686030403, longitude: -83.09374622213542, elevationFeet: 5000, imageUrl: null, sourceUrl: "https://www.theswag.com/grounds/property/live-feed/", refreshSeconds: null, region: "Cataloochee Divide", alt: "Live mountaintop view from The Swag near Waynesville" }
];

export const ELEVATION_BANDS = [
  { id: "6000-plus", label: "6,000+ ft", representativeFeet: 6400 },
  { id: "5000-6000", label: "5,000–6,000 ft", representativeFeet: 5500 },
  { id: "4000-5000", label: "4,000–5,000 ft", representativeFeet: 4500 },
  { id: "3000-4000", label: "3,000–4,000 ft", representativeFeet: 3500 },
  { id: "2000-3000", label: "2,000–3,000 ft", representativeFeet: 2500 },
  { id: "asheville-valley", label: "Asheville / French Broad Valley", representativeFeet: 2134 }
];

// Phase 1 persistence seam. Replace this isolated preview array with stored threshold
// milestones (first40/first36/first32/first28) when a seasonal archive is available.
export const SEASON_MILESTONE_PREVIEW = ELEVATION_BANDS.map((band) => ({
  season: 2026,
  elevationBand: band.id,
  first40: null,
  first36: null,
  first32: null,
  first28: null
}));
