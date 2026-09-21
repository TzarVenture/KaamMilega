export interface HubMetadata {
  id: string;
  name: string;
  landmark: string;
  image: string;
  isProcedural: boolean;
  sector: string;
  vacancies: string;
  state?: string;
}

// Curated landmarks and sectors for major Indian employment hubs
const CURATED_HUBS: Record<string, {
  landmark: string;
  image: string;
  sector: string;
  defaultVacancies: string;
}> = {
  mumbai: {
    landmark: "Gateway of India",
    image: "/asset/hubs/mumbai.webp",
    sector: "BFSI & Logistics",
    defaultVacancies: "45,000+ Openings"
  },
  delhi: {
    landmark: "India Gate",
    image: "/asset/hubs/delhi.webp",
    sector: "Logistics & Tech",
    defaultVacancies: "52,000+ Openings"
  },
  bengaluru: {
    landmark: "Vidhana Soudha",
    image: "/asset/hubs/bengaluru.webp",
    sector: "Quick Commerce & Tech",
    defaultVacancies: "38,000+ Openings"
  },
  hyderabad: {
    landmark: "Charminar",
    image: "/asset/hubs/hyderabad.webp",
    sector: "Pharma & Infra",
    defaultVacancies: "28,000+ Openings"
  },
  pune: {
    landmark: "Shaniwar Wada",
    image: "/asset/hubs/pune.webp",
    sector: "Auto & Manufacturing",
    defaultVacancies: "24,000+ Openings"
  },
  kolkata: {
    landmark: "Howrah Bridge",
    image: "/asset/hubs/kolkata.webp",
    sector: "Commerce & Ports",
    defaultVacancies: "19,000+ Openings"
  },
  ahmedabad: {
    landmark: "Atal Pedestrian Bridge",
    image: "/asset/hubs/ahmedabad.webp",
    sector: "Industrial & Textiles",
    defaultVacancies: "22,000+ Openings"
  },
  chennai: {
    landmark: "Chennai Central",
    image: "/asset/hubs/chennai.webp",
    sector: "Automotive & Hardware",
    defaultVacancies: "25,000+ Openings"
  },
  jaipur: {
    landmark: "Hawa Mahal",
    image: "/asset/hubs/jaipur.webp",
    sector: "Tourism & Handicrafts",
    defaultVacancies: "16,000+ Openings"
  },
  surat: {
    landmark: "Diamond Bourse",
    image: "/asset/hubs/surat.webp",
    sector: "Textiles & Trade",
    defaultVacancies: "20,000+ Openings"
  },
  lucknow: {
    landmark: "Rumi Darwaza",
    image: "/asset/hubs/lucknow.webp",
    sector: "Agro & Aviation",
    defaultVacancies: "15,000+ Openings"
  },
  indore: {
    landmark: "Rajwada Palace",
    image: "/asset/hubs/indore.webp",
    sector: "Pharma & Food Processing",
    defaultVacancies: "14,000+ Openings"
  }
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

// Regional sector mapping for Tier 3 (procedural fallback)
const STATE_SECTOR_MAP: Record<string, string> = {
  "gujarat": "Chemicals & SEZ Corridor",
  "gujrat": "Chemicals & SEZ Corridor",
  "tamil nadu": "Textile & Precision Tech",
  "tamilnadu": "Textile & Precision Tech",
  "maharashtra": "Industrial & Central Logistics",
  "jharkhand": "Steel, Minerals & Energy",
  "bihar": "Agro-Logistics & Heritage Trade",
  "madhya pradesh": "Heavy Engineering & Solar",
  "chhattisgarh": "Power, Minerals & Steel",
  "haryana": "Automotive & Logistics",
  "rajasthan": "Minerals & Heritage Commerce",
  "uttar pradesh": "Textiles & Regional Commerce",
  "uttam pradesh": "Textiles & Regional Commerce",
  "west bengal": "Commerce, Port & Tea Trade"
};

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
 * 3-Tier Dynamic Hub Resolution Engine:
 * Tier 1: Explicit DB image/override
 * Tier 2: Curated Landmark registry
 * Tier 3: Procedural Architectural Fallback
 */
export function getCityHubMetadata(city: any): HubMetadata {
  const cityName = (city?.name || "Verified Hub").trim();
  const slug = normalizeCitySlug(cityName);
  const state = (city?.state || "").toLowerCase().trim();

  // Determine vacancies string: prioritize live jobs count if present, else vacancies string or curated fallback
  let vacancies = city?.vacancies;
  if (city?.jobs_count !== undefined && city?.jobs_count > 0) {
    vacancies = `${city.jobs_count} Active Opening${city.jobs_count > 1 ? 's' : ''}`;
  } else if (!vacancies || vacancies === "0 Vacancies") {
    vacancies = CURATED_HUBS[slug]?.defaultVacancies || "15,000+ Openings";
  }

  // Tier 1: DB Image Override
  if (city?.image_url || city?.image || city?.cover_image) {
    const rawImg = city.image_url || city.image || city.cover_image;
    return {
      id: city.id || cityName,
      name: cityName,
      landmark: city.landmark || "Regional Hub",
      image: rawImg,
      isProcedural: false,
      sector: city.sector || STATE_SECTOR_MAP[state] || "Industrial Hub",
      vacancies,
      state: city.state
    };
  }

  // Tier 2: Curated Landmark Map
  if (CURATED_HUBS[slug]) {
    const curated = CURATED_HUBS[slug];
    return {
      id: city.id || cityName,
      name: cityName,
      landmark: curated.landmark,
      image: curated.image,
      isProcedural: false,
      sector: curated.sector,
      vacancies,
      state: city.state
    };
  }

  // Tier 3: Procedural Generative Fallback
  const sector = STATE_SECTOR_MAP[state] || "Industrial & Logistics";
  const landmark = city.state ? `${city.state} Hub` : "Industrial Corridor";

  return {
    id: city.id || cityName,
    name: cityName,
    landmark,
    image: getSkylineSvgDataUri(),
    isProcedural: true,
    sector,
    vacancies,
    state: city.state
  };
}
