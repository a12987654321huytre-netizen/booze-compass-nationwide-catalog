/**
 * South Africa is the full geographic scope of Booze Compass.
 * Cape Town / Western Cape are one province, not the product.
 */

export const SA_PROVINCES = [
  'Western Cape',
  'Eastern Cape',
  'Northern Cape',
  'Free State',
  'KwaZulu-Natal',
  'North West',
  'Gauteng',
  'Mpumalanga',
  'Limpopo',
] as const;

export type SAProvince = (typeof SA_PROVINCES)[number];

export type SearchPointKind = 'metro-core' | 'metro-suburb' | 'city' | 'town';

export type SearchPoint = {
  id: string;
  name: string;
  province: SAProvince;
  latitude: number;
  longitude: number;
  /** Nearby-search radius. Smaller in dense metros so the 20-result cap hides less. */
  radiusMeters: number;
  kind: SearchPointKind;
  /** Run extra text searches (bottle store / drankwinkel) from this point. */
  textSearch: boolean;
};

const PROVINCE_ALIASES: Record<string, SAProvince> = {
  'western cape': 'Western Cape',
  'wes-kaap': 'Western Cape',
  weskaap: 'Western Cape',
  'eastern cape': 'Eastern Cape',
  'oos-kaap': 'Eastern Cape',
  ooskaap: 'Eastern Cape',
  'northern cape': 'Northern Cape',
  'noord-kaap': 'Northern Cape',
  noordkaap: 'Northern Cape',
  'free state': 'Free State',
  vrystaat: 'Free State',
  'kwazulu-natal': 'KwaZulu-Natal',
  'kwazulu natal': 'KwaZulu-Natal',
  kzn: 'KwaZulu-Natal',
  'north west': 'North West',
  noordwes: 'North West',
  gauteng: 'Gauteng',
  mpumalanga: 'Mpumalanga',
  limpopo: 'Limpopo',
  soweto: 'Gauteng',
  johannesburg: 'Gauteng',
  sandton: 'Gauteng',
  pretoria: 'Gauteng',
  durban: 'KwaZulu-Natal',
  'pietermaritzburg': 'KwaZulu-Natal',
  bloemfontein: 'Free State',
  kimberley: 'Northern Cape',
  upington: 'Northern Cape',
  polokwane: 'Limpopo',
  mbombela: 'Mpumalanga',
  nelspruit: 'Mpumalanga',
  rustenburg: 'North West',
  mahikeng: 'North West',
  mafikeng: 'North West',
  klerksdorp: 'North West',
  potchefstroom: 'North West',
  gqeberha: 'Eastern Cape',
  'port elizabeth': 'Eastern Cape',
};

/** Rough SA mainland box. Used only to drop obviously foreign Places results. */
export const SA_BOUNDS = {
  minLat: -35.1,
  maxLat: -22.0,
  minLon: 16.3,
  maxLon: 33.0,
} as const;

export function isInSouthAfrica(latitude: number, longitude: number): boolean {
  return (
    latitude >= SA_BOUNDS.minLat &&
    latitude <= SA_BOUNDS.maxLat &&
    longitude >= SA_BOUNDS.minLon &&
    longitude <= SA_BOUNDS.maxLon
  );
}

export function provinceFromText(value?: string | null): SAProvince | undefined {
  if (!value) return undefined;
  const normalized = value
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [alias, province] of Object.entries(PROVINCE_ALIASES)) {
    if (normalized.includes(alias)) return province;
  }
  return undefined;
}

/**
 * Coordinate fallback. Small distinctive provinces and border towns are
 * tested first so overlapping bboxes (Gauteng vs Brits, Kimberley vs
 * Free State, Harrismith vs KZN) don't steal the wrong label.
 */
type LatLonBox = {
  province: SAProvince;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

function inBox(latitude: number, longitude: number, box: LatLonBox): boolean {
  return (
    latitude >= box.minLat &&
    latitude <= box.maxLat &&
    longitude >= box.minLon &&
    longitude <= box.maxLon
  );
}

/**
 * First matching box wins. Northern Cape is last on purpose: it is huge
 * and would otherwise swallow Kimberley-adjacent Free State, the Karoo
 * Eastern Cape, and Namaqualand Western Cape.
 */
const PROVINCE_BOXES: readonly LatLonBox[] = [
  { province: 'Gauteng', minLat: -25.95, maxLat: -25.2, minLon: 28.0, maxLon: 28.55 },
  { province: 'Gauteng', minLat: -26.76, maxLat: -25.95, minLon: 27.35, maxLon: 28.7 },
  { province: 'KwaZulu-Natal', minLat: -31.15, maxLat: -26.7, minLon: 29.2, maxLon: 32.95 },
  { province: 'Limpopo', minLat: -25.4, maxLat: -22.12, minLon: 26.5, maxLon: 30.0 },
  { province: 'Limpopo', minLat: -24.85, maxLat: -22.12, minLon: 30.0, maxLon: 31.95 },
  { province: 'Mpumalanga', minLat: -27.55, maxLat: -24.05, minLon: 29.0, maxLon: 32.15 },
  // Goldfields towns sit on the FS/NW border. Match NW first so Klerksdorp
  // and Potchefstroom are not swallowed by the Free State box.
  { province: 'North West', minLat: -27.22, maxLat: -26.55, minLon: 25.7, maxLon: 27.35 },
  { province: 'Free State', minLat: -30.6, maxLat: -26.55, minLon: 24.9, maxLon: 29.82 },
  { province: 'Western Cape', minLat: -34.85, maxLat: -31.0, minLon: 17.75, maxLon: 24.0 },
  { province: 'Eastern Cape', minLat: -34.45, maxLat: -31.2, minLon: 22.8, maxLon: 30.25 },
  { province: 'Eastern Cape', minLat: -31.2, maxLat: -30.0, minLon: 25.5, maxLon: 30.25 },
  { province: 'North West', minLat: -28.3, maxLat: -24.55, minLon: 24.5, maxLon: 27.95 },
  { province: 'Northern Cape', minLat: -32.55, maxLat: -24.4, minLon: 16.35, maxLon: 25.5 },
];

export function provinceFromCoordinates(latitude: number, longitude: number): SAProvince | undefined {
  if (!isInSouthAfrica(latitude, longitude)) return undefined;
  for (const box of PROVINCE_BOXES) {
    if (inBox(latitude, longitude, box)) return box.province;
  }
  return undefined;
}

export function resolveProvince(
  latitude: number,
  longitude: number,
  address?: string | null
): SAProvince | undefined {
  return provinceFromText(address) ?? provinceFromCoordinates(latitude, longitude);
}

function point(
  id: string,
  name: string,
  province: SAProvince,
  latitude: number,
  longitude: number,
  radiusMeters: number,
  kind: SearchPointKind,
  textSearch = false
): SearchPoint {
  return { id, name, province, latitude, longitude, radiusMeters, kind, textSearch };
}

/**
 * Nationwide discovery grid. Metros are partitioned so Google's 20-result
 * cap cannot hide an entire city. Smaller towns are included on purpose —
 * national coverage is not "the big 5 metros".
 */
export const SA_SEARCH_GRID: readonly SearchPoint[] = [
  // --- Western Cape (Cape Town is one metro, not the country) ---
  point('wc-cape-town-cbd', 'Cape Town CBD', 'Western Cape', -33.9249, 18.4241, 3500, 'metro-core', true),
  point('wc-sea-point', 'Sea Point', 'Western Cape', -33.921, 18.382, 3000, 'metro-suburb'),
  point('wc-claremont', 'Claremont', 'Western Cape', -33.9806, 18.4652, 3500, 'metro-suburb'),
  point('wc-bellville', 'Bellville', 'Western Cape', -33.894, 18.629, 4000, 'metro-suburb', true),
  point('wc-khayelitsha', 'Khayelitsha', 'Western Cape', -34.041, 18.677, 4500, 'metro-suburb'),
  point('wc-mitchells-plain', 'Mitchells Plain', 'Western Cape', -34.05, 18.618, 4000, 'metro-suburb'),
  point('wc-table-view', 'Table View', 'Western Cape', -33.823, 18.489, 4000, 'metro-suburb'),
  point('wc-somerset-west', 'Somerset West', 'Western Cape', -34.084, 18.843, 5000, 'city', true),
  point('wc-stellenbosch', 'Stellenbosch', 'Western Cape', -33.9321, 18.8602, 5000, 'city', true),
  point('wc-paarl', 'Paarl', 'Western Cape', -33.727, 18.976, 6000, 'city', true),
  point('wc-worcester', 'Worcester', 'Western Cape', -33.646, 19.448, 7000, 'city', true),
  point('wc-hermanus', 'Hermanus', 'Western Cape', -34.418, 19.245, 6000, 'town', true),
  point('wc-george', 'George', 'Western Cape', -33.964, 22.459, 7000, 'city', true),
  point('wc-mossel-bay', 'Mossel Bay', 'Western Cape', -34.183, 22.146, 7000, 'town', true),
  point('wc-knysna', 'Knysna', 'Western Cape', -34.036, 23.047, 6000, 'town', true),
  point('wc-oudtshoorn', 'Oudtshoorn', 'Western Cape', -33.59, 22.203, 6000, 'town', true),
  point('wc-beaufort-west', 'Beaufort West', 'Western Cape', -32.351, 22.583, 8000, 'town', true),
  point('wc-vredendal', 'Vredendal', 'Western Cape', -31.662, 18.503, 7000, 'town', true),
  point('wc-vredenburg', 'Vredenburg', 'Western Cape', -32.907, 17.99, 7000, 'town', true),
  point('wc-malmesbury', 'Malmesbury', 'Western Cape', -33.461, 18.727, 6000, 'town', true),
  point('wc-ceres', 'Ceres', 'Western Cape', -33.37, 19.31, 6000, 'town', true),
  point('wc-robertson', 'Robertson', 'Western Cape', -33.803, 19.887, 6000, 'town', true),
  point('wc-plettenberg-bay', 'Plettenberg Bay', 'Western Cape', -34.052, 23.368, 6000, 'town', true),
  point('wc-swellendam', 'Swellendam', 'Western Cape', -34.022, 20.442, 6000, 'town', true),
  point('wc-saldanha', 'Saldanha', 'Western Cape', -33.012, 17.944, 6000, 'town', true),

  // --- Eastern Cape ---
  point('ec-gqeberha-cbd', 'Gqeberha CBD', 'Eastern Cape', -33.9608, 25.6022, 4000, 'metro-core', true),
  point('ec-newton-park', 'Newton Park', 'Eastern Cape', -33.948, 25.57, 4000, 'metro-suburb'),
  point('ec-motherwell', 'Motherwell', 'Eastern Cape', -33.804, 25.589, 5000, 'metro-suburb'),
  point('ec-uitenhage', 'Kariega (Uitenhage)', 'Eastern Cape', -33.767, 25.397, 6000, 'city', true),
  point('ec-jeffreys-bay', 'Jeffreys Bay', 'Eastern Cape', -34.0507, 24.9195, 6000, 'town', true),
  point('ec-east-london', 'East London', 'Eastern Cape', -33.0153, 27.9116, 5000, 'metro-core', true),
  point('ec-mdantsane', 'Mdantsane', 'Eastern Cape', -32.95, 27.76, 5000, 'metro-suburb'),
  point('ec-king-williams-town', 'Qonce (King William’s Town)', 'Eastern Cape', -32.881, 27.394, 6000, 'city', true),
  point('ec-makhanda', 'Makhanda', 'Eastern Cape', -33.3046, 26.532, 6000, 'town', true),
  point('ec-mthatha', 'Mthatha', 'Eastern Cape', -31.5889, 28.7844, 8000, 'city', true),
  point('ec-butterworth', 'Butterworth', 'Eastern Cape', -32.331, 28.15, 7000, 'town', true),
  point('ec-komani', 'Komani (Queenstown)', 'Eastern Cape', -31.897, 26.875, 7000, 'city', true),
  point('ec-aliwal-north', 'Aliwal North', 'Eastern Cape', -30.695, 26.711, 7000, 'town', true),
  point('ec-cradock', 'Cradock', 'Eastern Cape', -32.164, 25.619, 7000, 'town', true),
  point('ec-graaff-reinet', 'Graaff-Reinet', 'Eastern Cape', -32.252, 24.541, 7000, 'town', true),
  point('ec-port-alfred', 'Port Alfred', 'Eastern Cape', -33.591, 26.891, 6000, 'town', true),
  point('ec-humansdorp', 'Humansdorp', 'Eastern Cape', -34.029, 24.766, 6000, 'town', true),
  point('ec-queenstown-park', 'Komani Parkside', 'Eastern Cape', -31.91, 26.86, 5000, 'metro-suburb'),

  // --- Northern Cape ---
  point('nc-kimberley', 'Kimberley', 'Northern Cape', -28.7282, 24.7499, 8000, 'city', true),
  point('nc-galeshewe', 'Galeshewe', 'Northern Cape', -28.722, 24.73, 5000, 'metro-suburb'),
  point('nc-upington', 'Upington', 'Northern Cape', -28.4478, 21.2561, 8000, 'city', true),
  point('nc-springbok', 'Springbok', 'Northern Cape', -29.664, 17.886, 8000, 'town', true),
  point('nc-de-aar', 'De Aar', 'Northern Cape', -30.65, 24.012, 7000, 'town', true),
  point('nc-kuruman', 'Kuruman', 'Northern Cape', -27.452, 23.432, 7000, 'town', true),
  point('nc-kathu', 'Kathu', 'Northern Cape', -27.696, 23.049, 6000, 'town', true),
  point('nc-postmasburg', 'Postmasburg', 'Northern Cape', -28.329, 23.068, 6000, 'town', true),
  point('nc-calvinia', 'Calvinia', 'Northern Cape', -31.475, 19.776, 7000, 'town', true),
  point('nc-colesberg', 'Colesberg', 'Northern Cape', -30.72, 25.097, 6000, 'town', true),
  point('nc-hartswater', 'Hartswater', 'Northern Cape', -27.76, 24.799, 6000, 'town', true),
  point('nc-kakamas', 'Kakamas', 'Northern Cape', -28.775, 20.615, 6000, 'town', true),
  point('nc-prieska', 'Prieska', 'Northern Cape', -29.668, 22.747, 6000, 'town', true),
  point('nc-port-nolloth', 'Port Nolloth', 'Northern Cape', -29.259, 16.87, 7000, 'town', true),
  point('nc-alexander-bay', 'Alexander Bay', 'Northern Cape', -28.596, 16.484, 6000, 'town', true),

  // --- Free State ---
  point('fs-bloemfontein', 'Bloemfontein', 'Free State', -29.0852, 26.1596, 5000, 'metro-core', true),
  point('fs-mangaung', 'Mangaung', 'Free State', -29.153, 26.214, 5000, 'metro-suburb'),
  point('fs-botshabelo', 'Botshabelo', 'Free State', -29.233, 26.72, 6000, 'city', true),
  point('fs-welkom', 'Welkom', 'Free State', -27.977, 26.735, 7000, 'city', true),
  point('fs-virginia', 'Virginia', 'Free State', -28.104, 26.866, 5000, 'town', true),
  point('fs-bethlehem', 'Bethlehem', 'Free State', -28.237, 28.311, 7000, 'city', true),
  point('fs-sasolburg', 'Sasolburg', 'Free State', -26.813, 27.824, 7000, 'city', true),
  point('fs-kroonstad', 'Kroonstad', 'Free State', -27.65, 27.234, 7000, 'city', true),
  point('fs-parys', 'Parys', 'Free State', -26.903, 27.457, 6000, 'town', true),
  point('fs-harrismith', 'Harrismith', 'Free State', -28.273, 29.129, 6000, 'town', true),
  point('fs-phuthaditjhaba', 'Phuthaditjhaba', 'Free State', -28.534, 28.816, 7000, 'city', true),
  point('fs-ladybrand', 'Ladybrand', 'Free State', -29.192, 27.457, 6000, 'town', true),
  point('fs-ficksburg', 'Ficksburg', 'Free State', -28.874, 27.874, 6000, 'town', true),
  point('fs-odendaalsrus', 'Odendaalsrus', 'Free State', -27.874, 26.687, 5000, 'town', true),
  point('fs-bloemhof', 'Bloemhof', 'Free State', -27.504, 25.604, 6000, 'town', true),
  point('fs-bothaville', 'Bothaville', 'Free State', -27.389, 26.617, 6000, 'town', true),

  // --- KwaZulu-Natal ---
  point('kzn-durban-cbd', 'Durban CBD', 'KwaZulu-Natal', -29.8587, 31.0218, 4000, 'metro-core', true),
  point('kzn-umhlanga', 'Umhlanga', 'KwaZulu-Natal', -29.728, 31.085, 4000, 'metro-suburb', true),
  point('kzn-chatsworth', 'Chatsworth', 'KwaZulu-Natal', -29.912, 30.885, 4000, 'metro-suburb'),
  point('kzn-phoenix', 'Phoenix', 'KwaZulu-Natal', -29.72, 31.0, 4000, 'metro-suburb'),
  point('kzn-pinetown', 'Pinetown', 'KwaZulu-Natal', -29.819, 30.873, 4000, 'metro-suburb', true),
  point('kzn-amanzimtoti', 'Amanzimtoti', 'KwaZulu-Natal', -30.05, 30.885, 4000, 'metro-suburb'),
  point('kzn-ballito', 'Ballito', 'KwaZulu-Natal', -29.539, 31.214, 5000, 'town', true),
  point('kzn-pietermaritzburg', 'Pietermaritzburg', 'KwaZulu-Natal', -29.6006, 30.3794, 6000, 'city', true),
  point('kzn-newcastle', 'Newcastle', 'KwaZulu-Natal', -27.758, 29.932, 7000, 'city', true),
  point('kzn-ladysmith', 'Ladysmith', 'KwaZulu-Natal', -28.559, 29.78, 7000, 'city', true),
  point('kzn-richards-bay', 'Richards Bay', 'KwaZulu-Natal', -28.783, 32.038, 7000, 'city', true),
  point('kzn-empangeni', 'Empangeni', 'KwaZulu-Natal', -28.758, 31.893, 6000, 'town', true),
  point('kzn-port-shepstone', 'Port Shepstone', 'KwaZulu-Natal', -30.741, 30.455, 6000, 'town', true),
  point('kzn-margate', 'Margate', 'KwaZulu-Natal', -30.864, 30.37, 5000, 'town', true),
  point('kzn-vryheid', 'Vryheid', 'KwaZulu-Natal', -27.769, 30.792, 7000, 'town', true),
  point('kzn-dundee', 'Dundee', 'KwaZulu-Natal', -28.165, 30.234, 6000, 'town', true),
  point('kzn-estcourt', 'Estcourt', 'KwaZulu-Natal', -29.013, 29.872, 6000, 'town', true),
  point('kzn-kwadukuza', 'KwaDukuza', 'KwaZulu-Natal', -29.328, 31.286, 6000, 'town', true),
  point('kzn-howick', 'Howick', 'KwaZulu-Natal', -29.49, 30.23, 5000, 'town', true),
  point('kzn-kokstad', 'Kokstad', 'KwaZulu-Natal', -30.547, 29.424, 6000, 'town', true),

  // --- North West ---
  point('nw-mahikeng', 'Mahikeng', 'North West', -25.86, 25.644, 7000, 'city', true),
  point('nw-rustenburg', 'Rustenburg', 'North West', -25.667, 27.242, 7000, 'city', true),
  point('nw-klerksdorp', 'Klerksdorp', 'North West', -26.852, 26.666, 7000, 'city', true),
  point('nw-potchefstroom', 'Potchefstroom', 'North West', -26.715, 27.096, 7000, 'city', true),
  point('nw-brits', 'Brits', 'North West', -25.634, 27.78, 6000, 'town', true),
  point('nw-hartbeespoort', 'Hartbeespoort', 'North West', -25.748, 27.887, 5000, 'town', true),
  point('nw-lichtenburg', 'Lichtenburg', 'North West', -26.152, 26.16, 6000, 'town', true),
  point('nw-vryburg', 'Vryburg', 'North West', -26.956, 24.728, 7000, 'town', true),
  point('nw-orkney', 'Orkney', 'North West', -26.981, 26.673, 5000, 'town', true),
  point('nw-zeerust', 'Zeerust', 'North West', -25.537, 26.078, 6000, 'town', true),
  point('nw-mogwase', 'Mogwase', 'North West', -25.443, 27.216, 6000, 'town', true),
  point('nw-wolmaransstad', 'Wolmaransstad', 'North West', -27.201, 25.973, 6000, 'town', true),
  point('nw-klerksdorp-alabama', 'Alabama (Matlosana)', 'North West', -26.89, 26.63, 4000, 'metro-suburb'),

  // --- Gauteng ---
  point('gp-jhb-cbd', 'Johannesburg CBD', 'Gauteng', -26.2041, 28.0473, 3500, 'metro-core', true),
  point('gp-sandton', 'Sandton', 'Gauteng', -26.1076, 28.0567, 4000, 'metro-suburb', true),
  point('gp-soweto', 'Soweto', 'Gauteng', -26.2485, 27.854, 5000, 'metro-suburb', true),
  point('gp-randburg', 'Randburg', 'Gauteng', -26.093, 28.007, 4000, 'metro-suburb'),
  point('gp-roodepoort', 'Roodepoort', 'Gauteng', -26.162, 27.873, 4000, 'metro-suburb'),
  point('gp-midrand', 'Midrand', 'Gauteng', -25.975, 28.127, 5000, 'metro-suburb'),
  point('gp-fourways', 'Fourways', 'Gauteng', -26.021, 28.007, 4000, 'metro-suburb'),
  point('gp-pretoria-cbd', 'Pretoria CBD', 'Gauteng', -25.7479, 28.2293, 4000, 'metro-core', true),
  point('gp-hatfield', 'Hatfield', 'Gauteng', -25.748, 28.238, 3500, 'metro-suburb'),
  point('gp-centurion', 'Centurion', 'Gauteng', -25.86, 28.189, 5000, 'metro-suburb', true),
  point('gp-mamelodi', 'Mamelodi', 'Gauteng', -25.723, 28.419, 4500, 'metro-suburb'),
  point('gp-benoni', 'Benoni', 'Gauteng', -26.188, 28.321, 5000, 'city', true),
  point('gp-boksburg', 'Boksburg', 'Gauteng', -26.212, 28.263, 4000, 'city'),
  point('gp-germiston', 'Germiston', 'Gauteng', -26.209, 28.168, 4000, 'city'),
  point('gp-kempton-park', 'Kempton Park', 'Gauteng', -26.1, 28.23, 4500, 'city', true),
  point('gp-springs', 'Springs', 'Gauteng', -26.25, 28.4, 5000, 'city', true),
  point('gp-alberton', 'Alberton', 'Gauteng', -26.268, 28.122, 4000, 'city'),
  point('gp-vereeniging', 'Vereeniging', 'Gauteng', -26.673, 27.926, 6000, 'city', true),
  point('gp-vanderbijlpark', 'Vanderbijlpark', 'Gauteng', -26.699, 27.838, 5000, 'city', true),
  point('gp-krugersdorp', 'Krugersdorp', 'Gauteng', -26.1, 27.77, 5000, 'city', true),
  point('gp-randfontein', 'Randfontein', 'Gauteng', -26.184, 27.702, 5000, 'town', true),
  point('gp-tembisa', 'Tembisa', 'Gauteng', -26.006, 28.21, 4500, 'metro-suburb'),
  point('gp-heidelberg', 'Heidelberg GP', 'Gauteng', -26.505, 28.359, 6000, 'town', true),

  // --- Mpumalanga ---
  point('mp-mbombela', 'Mbombela', 'Mpumalanga', -25.465, 30.985, 7000, 'city', true),
  point('mp-white-river', 'White River', 'Mpumalanga', -25.332, 31.012, 5000, 'town', true),
  point('mp-witbank', 'eMalahleni (Witbank)', 'Mpumalanga', -25.877, 29.209, 7000, 'city', true),
  point('mp-middelburg', 'Middelburg', 'Mpumalanga', -25.775, 29.464, 7000, 'city', true),
  point('mp-secunda', 'Secunda', 'Mpumalanga', -26.55, 29.17, 7000, 'city', true),
  point('mp-ermelo', 'Ermelo', 'Mpumalanga', -26.533, 29.988, 7000, 'town', true),
  point('mp-standerton', 'Standerton', 'Mpumalanga', -26.934, 29.241, 7000, 'town', true),
  point('mp-barberton', 'Barberton', 'Mpumalanga', -25.788, 31.053, 6000, 'town', true),
  point('mp-hazyview', 'Hazyview', 'Mpumalanga', -25.044, 31.126, 6000, 'town', true),
  point('mp-lydenburg', 'Mashishing (Lydenburg)', 'Mpumalanga', -25.096, 30.448, 6000, 'town', true),
  point('mp-piet-retief', 'eMkhondo (Piet Retief)', 'Mpumalanga', -27.007, 30.803, 7000, 'town', true),
  point('mp-malelane', 'Malalane', 'Mpumalanga', -25.49, 31.517, 6000, 'town', true),
  point('mp-komatipoort', 'Komatipoort', 'Mpumalanga', -25.435, 31.955, 6000, 'town', true),
  point('mp-carolina', 'Carolina', 'Mpumalanga', -26.069, 30.115, 6000, 'town', true),
  point('mp-sabie', 'Sabie', 'Mpumalanga', -25.1, 30.78, 5000, 'town', true),

  // --- Limpopo ---
  point('lp-polokwane', 'Polokwane', 'Limpopo', -23.9045, 29.4689, 7000, 'city', true),
  point('lp-tzaneen', 'Tzaneen', 'Limpopo', -23.833, 30.163, 7000, 'town', true),
  point('lp-mokopane', 'Mokopane', 'Limpopo', -24.194, 29.009, 7000, 'city', true),
  point('lp-thohoyandou', 'Thohoyandou', 'Limpopo', -22.971, 30.46, 7000, 'city', true),
  point('lp-makhado', 'Makhado', 'Limpopo', -23.046, 29.903, 7000, 'town', true),
  point('lp-phalaborwa', 'Phalaborwa', 'Limpopo', -23.943, 31.141, 7000, 'town', true),
  point('lp-lebowakgomo', 'Lebowakgomo', 'Limpopo', -24.3, 29.5, 7000, 'town', true),
  point('lp-bela-bela', 'Bela-Bela', 'Limpopo', -24.885, 28.294, 6000, 'town', true),
  point('lp-modimolle', 'Modimolle', 'Limpopo', -24.7, 28.406, 6000, 'town', true),
  point('lp-groblersdal', 'Groblersdal', 'Limpopo', -25.169, 29.395, 6000, 'town', true),
  point('lp-giyani', 'Giyani', 'Limpopo', -23.302, 30.717, 7000, 'town', true),
  point('lp-musina', 'Musina', 'Limpopo', -22.348, 30.04, 7000, 'town', true),
  point('lp-lephalale', 'Lephalale', 'Limpopo', -23.674, 27.745, 7000, 'town', true),
  point('lp-burgersfort', 'Burgersfort', 'Limpopo', -24.67, 30.325, 7000, 'town', true),
  point('lp-hoedspruit', 'Hoedspruit', 'Limpopo', -24.347, 30.95, 6000, 'town', true),
  point('lp-thabazimbi', 'Thabazimbi', 'Limpopo', -24.592, 27.412, 6000, 'town', true),
  point('lp-modjadjiskloof', 'Modjadjiskloof', 'Limpopo', -23.7, 30.14, 5000, 'town', true),
];

export function searchPointsByProvince(province: SAProvince): SearchPoint[] {
  return SA_SEARCH_GRID.filter((point) => point.province === province);
}

export function provincesCoveredByGrid(): SAProvince[] {
  return SA_PROVINCES.filter((province) =>
    SA_SEARCH_GRID.some((point) => point.province === province)
  );
}
