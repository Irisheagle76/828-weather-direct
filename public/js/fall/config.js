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
  { id: "cataloochee-lift", name: "Cataloochee Liftcam", elevationFeet: 4711, imageUrl: null, sourceUrl: "https://www.resortcams.com/webcams/cataloochee-liftcam/", refreshSeconds: null, region: "Maggie Valley High Country", alt: "Live Cataloochee Ski Area lift view" },
  { id: "purchase-knob", name: "Purchase Knob", elevationFeet: 5086, imageUrl: "https://www.nps.gov/featurecontent/ard/webcams/images/grpklarge.jpg", sourceUrl: "https://www.nps.gov/subjects/air/webcams.htm?site=grpk", refreshSeconds: 900, region: "Great Smoky Mountains", alt: "Live view from Purchase Knob in Great Smoky Mountains National Park" },
  { id: "gatlinburg-phenocam", name: "Gatlinburg PhenoCam", elevationFeet: null, imageUrl: "https://phenocam.nau.edu/data/latest/NEON.D07.GRSM.DP1.00033.jpg", sourceUrl: "https://phenocam.nau.edu/webcam/sites/NEON.D07.GRSM.DP1.00033/", refreshSeconds: 900, region: "Gatlinburg / Great Smokies", alt: "Current PhenoCam view near Gatlinburg, Tennessee" },
  { id: "cataloochee-ranch", name: "Cataloochee Ranch", elevationFeet: 4800, imageUrl: null, sourceUrl: "https://www.resortcams.com/webcams/cataloochee-ranch/", refreshSeconds: null, region: "Maggie Valley High Country", alt: "Live mountain view from Cataloochee Ranch" },
  { id: "fairview", name: "Fairview", elevationFeet: null, imageUrl: "https://images.ambientweather.net/308398A68945/latest.jpg?_=0", sourceUrl: "https://images.ambientweather.net/308398A68945/latest.jpg?_=0", refreshSeconds: 300, region: "Southeast Buncombe", alt: "Live weather camera view from Fairview, North Carolina" },
  { id: "newfound-gap", name: "Newfound Gap", elevationFeet: 5046, imageUrl: "https://www.nps.gov/featurecontent/ard/webcams/images/gsnglarge.jpg", sourceUrl: "https://grsmnfgap.air-resource.net/", refreshSeconds: 60, region: "Central Great Smokies", alt: "Live south-facing view from Newfound Gap" },
  { id: "look-rock", name: "Look Rock", elevationFeet: 2650, imageUrl: "https://www.nps.gov/featurecontent/ard/webcams/images/grsmlarge.jpg", sourceUrl: "https://www.nps.gov/subjects/air/webcams.htm?site=grsm", refreshSeconds: 900, region: "Western Great Smokies", alt: "Live long-range view from Look Rock" },
  { id: "banner-elk", name: "Banner Elk", elevationFeet: 3701, imageUrl: "https://live7.brownrice.com/cam-images/bannerchamber1.jpg", sourceUrl: "https://www.bannerelk.org/webcam.html", refreshSeconds: 300, region: "Northern High Country", alt: "Live downtown view from Banner Elk" },
  { id: "beech-base", name: "Beech Mountain Base", elevationFeet: 4675, imageUrl: null, sourceUrl: "https://www.resortcams.com/webcams/beech-base-cam/", refreshSeconds: null, region: "Northern High Country", alt: "Live base-area view from Beech Mountain" },
  { id: "the-swag", name: "The Swag", latitude: 35.57400686030403, longitude: -83.09374622213542, elevationFeet: 5000, imageUrl: null, sourceUrl: "https://www.theswag.com/grounds/property/live-feed/", refreshSeconds: null, region: "Cataloochee Divide", alt: "Live mountaintop view from The Swag near Waynesville" },
  { id: "highlands-whiteside", name: "Highlands / Whiteside Mountain", latitude: 35.06101989261826, longitude: -83.18449534662024, elevationFeet: 4268, imageUrl: "https://live6.brownrice.com/cam-images/highlands2.jpg", sourceUrl: "https://www.highlandschamber.org/webcams/", refreshSeconds: 300, region: "Southern Plateau", alt: "Live broad-canopy view of Whiteside Mountain from Big Bear Pen Mountain near Highlands, North Carolina" },
  { id: "saunook", name: "Saunook", latitude: 35.445883, longitude: -83.033635, elevationFeet: 3317, elevationMeters: 1011, imageUrl: "https://www.saunookweather.com/webcam.jpg", sourceUrl: "https://www.saunookweather.com/webcam.jpg", rawDataUrl: "https://www.saunookweather.com/clientraw.txt", refreshSeconds: 300, region: "Saunook / Haywood County", alt: "Live weather camera view from Saunook, North Carolina" },
  { id: "pigeon-river-i40", name: "Pigeon River Gorge / I-40", latitude: 35.76890579744448, longitude: -83.08067674527256, elevationFeet: 1559, imageUrl: "https://www.drivenc.gov/map/Cctv/6098", sourceUrl: "https://www.drivenc.gov/map/Cctv/6098", refreshSeconds: 300, region: "Pigeon River Gorge", alt: "Live NCDOT view of the forested Pigeon River Gorge along Interstate 40 near Hurricane Helene repair work" }
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
