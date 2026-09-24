import AsyncStorage from '@react-native-async-storage/async-storage';
import { distanceMeters } from '../utils/geo';
import type { LocationPoint } from '../types/location';

export interface ScratchHexCell {
  key: string;
  q: number;
  r: number;
  centerLat: number;
  centerLon: number;
  unlockedAt: number;
  isNew?: boolean;
}

export interface CityNights {
  cityName: string;
  nightsCount: number;
  lastStayMs: number;
}

export interface ExplorationStats {
  unlockedCellsCount: number;
  wardPercent: number;
  cityPercent: number;
  countryPercent: number;
  worldPercent: number;
  currentCityName: string;
  currentWardName: string;
  newCellsSinceLastSession: number;
}

const SCRATCH_STORAGE_KEY = 'mymap.scratch_cells.v2';
const LAST_SESSION_TIMESTAMP_KEY = 'mymap.scratch_last_session.v1';

// Hexagon grid resolution: ~500m per cell (approx 0.0045° latitude)
const HEX_SIZE_DEG = 0.0045;

/**
 * Quantize geographic coordinates to axial hexagon coordinates (q, r).
 */
export function coordsToHex(lat: number, lon: number): { q: number; r: number; key: string } {
  // Axial coordinates for flat-topped hexagons
  const x = lon / (HEX_SIZE_DEG * Math.sqrt(3));
  const y = lat / (HEX_SIZE_DEG * 1.5);
  const q = Math.round(x);
  const r = Math.round(y);
  return { q, r, key: `${q}:${r}` };
}

/**
 * Get geographic center of an axial hexagon coordinate.
 */
export function hexToCoords(q: number, r: number): { lat: number; lon: number } {
  const lon = q * HEX_SIZE_DEG * Math.sqrt(3);
  const lat = r * HEX_SIZE_DEG * 1.5;
  return { lat, lon };
}

/**
 * Compute 6 vertices of a hexagon in [lat, lon] for Leaflet / Map rendering.
 */
export function hexToPolygonCoords(q: number, r: number): [number, number][] {
  const { lat, lon } = hexToCoords(q, r);
  const angles = [0, 60, 120, 180, 240, 300];
  return angles.map(deg => {
    const rad = (deg * Math.PI) / 180;
    const vertexLat = lat + HEX_SIZE_DEG * 0.9 * Math.sin(rad);
    const vertexLon = lon + HEX_SIZE_DEG * 0.9 * Math.cos(rad) * 1.15;
    return [vertexLat, vertexLon];
  });
}

/**
 * Load all unlocked scratch cells from local storage.
 */
export async function getUnlockedHexCells(): Promise<ScratchHexCell[]> {
  try {
    const raw = await AsyncStorage.getItem(SCRATCH_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

/**
 * Save newly unlocked scratch cells from user GPS points.
 */
export async function processAndSaveScratchPoints(points: LocationPoint[]): Promise<{
  allCells: ScratchHexCell[];
  newlyUnlocked: number;
}> {
  const existing = await getUnlockedHexCells();
  const existingMap = new Map<string, ScratchHexCell>();
  existing.forEach(c => existingMap.set(c.key, c));

  const lastSessionRaw = await AsyncStorage.getItem(LAST_SESSION_TIMESTAMP_KEY);
  const lastSessionMs = lastSessionRaw ? parseInt(lastSessionRaw, 10) : 0;

  let newCount = 0;
  for (const pt of points) {
    const { q, r, key } = coordsToHex(pt.latitude, pt.longitude);
    if (!existingMap.has(key)) {
      const { lat, lon } = hexToCoords(q, r);
      const isNew = pt.timestamp > lastSessionMs;
      if (isNew) newCount++;
      existingMap.set(key, {
        key,
        q,
        r,
        centerLat: lat,
        centerLon: lon,
        unlockedAt: pt.timestamp,
        isNew,
      });
    }
  }

  const allCells = Array.from(existingMap.values());
  await AsyncStorage.setItem(SCRATCH_STORAGE_KEY, JSON.stringify(allCells)).catch(() => {});
  return { allCells, newlyUnlocked: newCount };
}

/**
 * Mark current time as session end for tracking new unlocks in next launch.
 */
export async function markScratchSessionViewed(): Promise<void> {
  await AsyncStorage.setItem(LAST_SESSION_TIMESTAMP_KEY, Date.now().toString()).catch(() => {});
}

/**
 * Approximate exploration percentage by ward, city, country and world.
 */
export function computeExplorationStats(cells: ScratchHexCell[], currentCity = 'Hà Nội', currentWard = 'Hoàn Kiếm'): ExplorationStats {
  const count = cells.length;
  // Approximations based on typical urban area sizes (500m hex ~ 0.2 km²)
  // A typical central district/ward has ~10-25 hex cells
  const wardPercent = Math.min(100, Math.round((Math.min(count, 20) / 20) * 100));
  // A typical city has ~300-600 hex cells
  const cityPercent = Math.min(100, parseFloat(((Math.min(count, 450) / 450) * 100).toFixed(1)));
  // Country (Vietnam) exploration
  const countryPercent = parseFloat(((Math.min(count, 2500) / 2500) * 100).toFixed(2));
  // Global world exploration percentage
  const worldPercent = parseFloat(((Math.min(count, 50000) / 50000) * 100).toFixed(3));

  const newCells = cells.filter(c => c.isNew).length;

  return {
    unlockedCellsCount: count,
    wardPercent,
    cityPercent,
    countryPercent,
    worldPercent,
    currentCityName: currentCity,
    currentWardName: currentWard,
    newCellsSinceLastSession: newCells,
  };
}

/**
 * Compute night stays per city ("Nights" metric from Bump/Zenly)
 * Analyzes points recorded between 23:00 and 06:00.
 */
export function computeCityNights(points: LocationPoint[]): CityNights[] {
  // Group points into distinct nights by local date string
  const nightsByCity = new Map<string, { dates: Set<string>; lastStay: number }>();

  for (const pt of points) {
    const d = new Date(pt.timestamp);
    const hour = d.getHours();
    // Night hours: 23:00 to 06:00
    if (hour >= 23 || hour <= 6) {
      const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      // Determine city by coarse lat/lon
      let cityName = 'Hà Nội';
      if (pt.latitude < 12.0 && pt.longitude > 106.0) {
        cityName = 'TP. Hồ Chí Minh';
      } else if (pt.latitude > 15.5 && pt.latitude < 17.0) {
        cityName = 'Đà Nẵng';
      } else if (pt.latitude > 11.5 && pt.latitude < 12.5 && pt.longitude < 109.0) {
        cityName = 'Đà Lạt';
      } else if (pt.latitude > 20.5 && pt.latitude < 21.5 && pt.longitude > 106.5) {
        cityName = 'Hạ Long';
      }

      const existing = nightsByCity.get(cityName) || { dates: new Set<string>(), lastStay: pt.timestamp };
      existing.dates.add(dateKey);
      if (pt.timestamp > existing.lastStay) existing.lastStay = pt.timestamp;
      nightsByCity.set(cityName, existing);
    }
  }

  const results: CityNights[] = [];
  nightsByCity.forEach((data, cityName) => {
    results.push({
      cityName,
      nightsCount: data.dates.size,
      lastStayMs: data.lastStay,
    });
  });

  return results.sort((a, b) => b.nightsCount - a.nightsCount);
}

/**
 * Compare scratch exploration score with friends.
 */
export function compareScratchWithFriends(
  userCellCount: number,
  friends: { id: string; displayName: string; avatarUrl?: string | null; unlockedCells?: number }[]
) {
  const list = [
    { id: 'me', name: 'Bạn', avatarUrl: null, cells: userCellCount, isMe: true },
    ...friends.map(f => ({
      id: f.id,
      name: f.displayName,
      avatarUrl: f.avatarUrl ?? null,
      cells: f.unlockedCells ?? 0,
      isMe: false,
    })),
  ];

  return list.sort((a, b) => b.cells - a.cells);
}
