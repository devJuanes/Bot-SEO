import {
  HUNT_LOCATIONS,
  HUNT_SECTORS,
} from '../knowledge/matubyte.js';

let locationIndex = 0;
let sectorIndex = Math.floor(Math.random() * HUNT_SECTORS.length);

export interface HuntTarget {
  city: string;
  country: string;
  countryCode: string;
  sector: string;
  query: string;
}

/** Rota ciudad (CO + LatAm) y sector para no quedarse en peluquerías de Cali. */
export function nextHuntTarget(opts?: {
  countryCode?: string;
  sectors?: string[];
}): HuntTarget {
  const code = opts?.countryCode?.trim().toUpperCase();
  const locations =
    code && code.length > 0
      ? HUNT_LOCATIONS.filter((l) => l.countryCode === code)
      : HUNT_LOCATIONS;
  const pool = locations.length > 0 ? locations : HUNT_LOCATIONS;
  const sectorPool =
    opts?.sectors && opts.sectors.length > 0 ? opts.sectors : HUNT_SECTORS;

  const location = pool[locationIndex % pool.length]!;
  const sector = sectorPool[sectorIndex % sectorPool.length]!;
  locationIndex = (locationIndex + 1) % pool.length;
  sectorIndex = (sectorIndex + 1) % sectorPool.length;

  return {
    city: location.city,
    country: location.country,
    countryCode: location.countryCode,
    sector,
    query: `${sector} ${location.city} ${location.country}`,
  };
}

export function peekHuntRotation(): {
  nextLocationIndex: number;
  nextSectorIndex: number;
  locations: number;
  sectors: number;
} {
  return {
    nextLocationIndex: locationIndex,
    nextSectorIndex: sectorIndex,
    locations: HUNT_LOCATIONS.length,
    sectors: HUNT_SECTORS.length,
  };
}
