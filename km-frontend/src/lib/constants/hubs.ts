export interface HubMetadata {
  id: string;
  name: string;
  image: string;
  isProcedural: boolean;
  /** Live open jobs in the city (GET /cities jobs_count); 0 when unknown */
  jobsCount: number;
  /** Curated hub: its landmark and sector are hubs.landmarks.<slug> / hubs.sectors.<slug> in the messages */
  curatedSlug?: string;
  /** Landmark and sector saved with the city in the database (shown as entered) */
  landmark?: string;
  sector?: string;
  state?: string;
}

// Photos for major Indian employment hubs (captions and sectors are in the messages, under "hubs")
const CURATED_HUB_IMAGES: Record<string, string> = {
  mumbai: "/asset/hubs/mumbai.webp",
  delhi: "/asset/hubs/delhi.webp",
  bengaluru: "/asset/hubs/bengaluru.webp",
  hyderabad: "/asset/hubs/hyderabad.webp",
  pune: "/asset/hubs/pune.webp",
  kolkata: "/asset/hubs/kolkata.webp",
  ahmedabad: "/asset/hubs/ahmedabad.webp",
  chennai: "/asset/hubs/chennai.webp",
  jaipur: "/asset/hubs/jaipur.webp",
  surat: "/asset/hubs/surat.webp",
  lucknow: "/asset/hubs/lucknow.webp",
  indore: "/asset/hubs/indore.webp",
};

// Aliases strictly for spelling variations, never collapsing distinct cities
const SLUG_ALIASES: Record<string, string> = {
  "mumbai": "mumbai",
  "bombay": "mumbai",
  "mumbaimmr": "mumbai",
  "delhi": "delhi",
  "newdelhi": "delhi",
  "delhincr": "delhi",
  "bengaluru": "bengaluru",
  "bangalore": "bengaluru",
  "hyderabad": "hyderabad",
  "hyderbad": "hyderabad", // DB spelling variation
  "secunderabad": "hyderabad",
  "pune": "pune",
  "poona": "pune",
  "kolkata": "kolkata",
  "calcutta": "kolkata",
  "ahmedabad": "ahmedabad",
  "chennai": "chennai",
  "madras": "chennai",
  "jaipur": "jaipur",
  "surat": "surat",
  "lucknow": "lucknow",
  "indore": "indore"
};

/**
 * Normalizes an arbitrary city name into a clean key for registry matching.
 */
export function normalizeCitySlug(cityName: string = ""): string {
  const cleaned = cityName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
  return SLUG_ALIASES[cleaned] || cleaned;
}

/**
 * Procedural skyline SVG pattern for regional satellite hubs
 */
export function getSkylineSvgDataUri(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400" height="200" preserveAspectRatio="none">
    <defs>
      <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0f172a" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#1e293b" stop-opacity="1"/>
      </linearGradient>
    </defs>
    <rect width="400" height="200" fill="url(#skyGrad)"/>
    <path d="M0,200 L0,110 L20,110 L20,95 L35,95 L35,110 L60,110 L60,80 L80,80 L80,120 L110,120 L110,65 L135,65 L135,120 L160,120 L160,90 L185,90 L185,125 L210,125 L210,75 L235,75 L235,120 L260,120 L260,85 L285,85 L285,125 L320,125 L320,70 L345,70 L345,120 L370,120 L370,100 L400,100 L400,200 Z" fill="#1e293b" opacity="0.4"/>
    <path d="M0,200 L0,140 L30,140 L30,125 L45,125 L45,145 L75,145 L75,110 L95,110 L95,150 L125,150 L125,95 L145,95 L145,150 L175,150 L175,120 L200,120 L200,155 L230,155 L230,105 L255,105 L255,150 L280,150 L280,115 L305,115 L305,155 L340,155 L340,100 L365,100 L365,150 L400,150 L400,200 Z" fill="#0f172a" opacity="0.85"/>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Hub card data for a city: its photo (DB image, then the curated photo, then a generated
 * skyline), its caption and sector, and its real open-job count (never an invented number).
 */
export function getCityHubMetadata(city: any): HubMetadata {
  const cityName = (city?.name || "").trim();
  const slug = normalizeCitySlug(cityName);
  const jobsCount = typeof city?.jobs_count === "number" && city.jobs_count > 0 ? city.jobs_count : 0;
  const curatedSlug = CURATED_HUB_IMAGES[slug] ? slug : undefined;
  const base = {
    id: city?.id || cityName,
    name: cityName,
    jobsCount,
    curatedSlug,
    landmark: city?.landmark || undefined,
    sector: city?.sector || undefined,
    state: city?.state,
  };

  const dbImage = city?.image_url || city?.image || city?.cover_image;
  if (dbImage) return { ...base, image: dbImage, isProcedural: false };

  if (curatedSlug) return { ...base, image: CURATED_HUB_IMAGES[curatedSlug], isProcedural: false };

  return { ...base, image: getSkylineSvgDataUri(), isProcedural: true };
}
