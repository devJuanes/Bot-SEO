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
export function nextHuntTarget(): HuntTarget {
  const location = HUNT_LOCATIONS[locationIndex % HUNT_LOCATIONS.length]!;
  const sector = HUNT_SECTORS[sectorIndex % HUNT_SECTORS.length]!;
  locationIndex = (locationIndex + 1) % HUNT_LOCATIONS.length;
  sectorIndex = (sectorIndex + 1) % HUNT_SECTORS.length;

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
