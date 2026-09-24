export type TravelMode = 'motorbike' | 'car';

export type RoadSpeedContext = {
  speedLimitKmh: number;
  roadName: string | null;
  roadClass: string | null;
  isDivided: boolean;
  isBuiltUp: boolean;
  source: 'osm' | 'estimated';
  updatedAt: number;
};

type OsmRoadElement = {
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};

const memoryCache = new Map<string, { savedAt: number; value: RoadSpeedContext }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function parseSpeed(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(\d{1,3})/);
  if (!match) return null;
  const raw = Number(match[1]);
  if (!Number.isFinite(raw) || raw < 5 || raw > 160) return null;
  return /mph/i.test(value) ? Math.round(raw * 1.60934) : raw;
}

function hasPositiveTag(value: string | undefined): boolean {
  return Boolean(value && !['no', 'none', '0', 'false'].includes(value.toLowerCase()));
}

export function inferRoadSpeedContext(
  tags: Record<string, string> = {},
  mode: TravelMode = 'motorbike'
): RoadSpeedContext {
  const roadClass = tags.highway || null;
  const lanes = Number(tags.lanes || 0);
  const isOneWay = ['yes', '1', '-1', 'reversible'].includes((tags.oneway || '').toLowerCase());
  const majorRoad = ['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link'].includes(tags.highway || '');
  const isDivided =
    hasPositiveTag(tags.divider) ||
    hasPositiveTag(tags.median) ||
    hasPositiveTag(tags.dual_carriageway) ||
    (isOneWay && tags.junction !== 'roundabout' && (lanes >= 2 || majorRoad));

  const urbanType = `${tags['maxspeed:type'] || ''} ${tags['zone:maxspeed'] || ''}`.toLowerCase();
  const isBuiltUp =
    /urban|built.?up|city/.test(urbanType) ||
    ['residential', 'living_street', 'service'].includes(tags.highway || '') ||
    (tags.lit === 'yes' && !['motorway', 'trunk'].includes(tags.highway || ''));

  const posted = parseSpeed(tags.maxspeed);
  const motorcyclePosted = parseSpeed(tags['maxspeed:motorcycle']);
  let estimated = isBuiltUp ? (isDivided ? 60 : 50) : (isDivided ? 70 : 60);

  if (mode === 'car') {
    estimated = isBuiltUp ? (isDivided ? 60 : 50) : (isDivided ? 90 : 80);
  }

  const explicit = mode === 'motorbike' ? motorcyclePosted : posted;
  const speedLimitKmh = explicit ?? (posted ? Math.min(posted, estimated) : estimated);

  return {
    speedLimitKmh,
    roadName: tags.name || tags.ref || null,
    roadClass,
    isDivided,
    isBuiltUp,
    source: explicit || posted ? 'osm' : 'estimated',
    updatedAt: Date.now(),
  };
}

export async function getRoadSpeedContext(
  latitude: number,
  longitude: number,
  mode: TravelMode = 'motorbike'
): Promise<RoadSpeedContext> {
  const fallback = inferRoadSpeedContext({}, mode);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return fallback;

  const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}|${mode}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) return cached.value;

  const query = `[out:json][timeout:8];way(around:35,${latitude},${longitude})["highway"]["highway"!~"footway|pedestrian|cycleway|path|steps|bridleway|corridor|construction|proposed"];out tags geom 12;`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': 'MyMap/0.8.2 (com.pnhl.vibecoding)',
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: controller.signal,
    });
    if (!response.ok) return fallback;

    const payload: { elements?: OsmRoadElement[] } = await response.json();
    const roads = Array.isArray(payload.elements) ? payload.elements : [];
    const roadDistanceMeters = (item: OsmRoadElement) => {
      const geometry = item.geometry || [];
      if (geometry.length < 2) return Number.POSITIVE_INFINITY;
      const metersPerDegreeLat = 111320;
      const metersPerDegreeLon = 111320 * Math.cos((latitude * Math.PI) / 180);
      let closest = Number.POSITIVE_INFINITY;
      for (let index = 1; index < geometry.length; index += 1) {
        const start = geometry[index - 1]!;
        const end = geometry[index]!;
        const ax = (start.lon - longitude) * metersPerDegreeLon;
        const ay = (start.lat - latitude) * metersPerDegreeLat;
        const bx = (end.lon - longitude) * metersPerDegreeLon;
        const by = (end.lat - latitude) * metersPerDegreeLat;
        const dx = bx - ax;
        const dy = by - ay;
        const lengthSquared = dx * dx + dy * dy;
        const projection = lengthSquared > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
        closest = Math.min(closest, Math.hypot(ax + projection * dx, ay + projection * dy));
      }
      return closest;
    };

    const best = roads
      .filter(item => item.tags?.highway)
      .sort((a, b) => {
        const distanceDifference = roadDistanceMeters(a) - roadDistanceMeters(b);
        if (Math.abs(distanceDifference) > 2) return distanceDifference;
        const metadataScore = (item: OsmRoadElement) => {
          const tags = item.tags || {};
          return Number(Boolean(tags['maxspeed:motorcycle'])) * 4 + Number(Boolean(tags.maxspeed)) * 3 + Number(Boolean(tags.name || tags.ref));
        };
        return metadataScore(b) - metadataScore(a);
      })[0];

    const value = inferRoadSpeedContext(best?.tags || {}, mode);
    memoryCache.set(cacheKey, { savedAt: Date.now(), value });
    return value;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}
