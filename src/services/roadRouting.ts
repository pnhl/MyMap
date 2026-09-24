import AsyncStorage from '@react-native-async-storage/async-storage';

export type RoutingProvider = 'gateway' | 'osrm' | 'graphhopper' | 'valhalla';
export type RoutingMode = 'car' | 'motorbike' | 'bike' | 'foot';

export interface RoadRouteResult {
  coordinates: [number, number][]; // [latitude, longitude]
  distanceMeters: number;
  durationSeconds: number;
  provider: RoutingProvider;
}

type Coordinate = { latitude: number; longitude: number };

const ROUTE_CACHE_PREFIX = 'mymap.road_route.v2.';
const memoryCache = new Map<string, RoadRouteResult>();
const value = (input: string | undefined) => input?.trim() ?? '';

const config = {
  gatewayUrl: value(process.env.EXPO_PUBLIC_ROUTING_GATEWAY_URL),
  providers: value(process.env.EXPO_PUBLIC_ROUTING_PROVIDERS) || 'osrm,valhalla,graphhopper',
  osrmUrl: value(process.env.EXPO_PUBLIC_OSRM_URL) || 'https://router.project-osrm.org',
  valhallaUrl: value(process.env.EXPO_PUBLIC_VALHALLA_URL) || 'https://valhalla.openstreetmap.de',
  graphHopperUrl: value(process.env.EXPO_PUBLIC_GRAPHHOPPER_URL) || 'https://graphhopper.com/api/1',
  graphHopperKey: value(process.env.EXPO_PUBLIC_GRAPHHOPPER_KEY),
};

function normalizedBase(url: string): string {
  return url.replace(/\/+$/, '');
}

function isCoordinate(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]);
}

function longitudeLatitudeToRoute(coordinates: unknown): [number, number][] {
  if (!Array.isArray(coordinates)) return [];
  return coordinates.filter(isCoordinate).map(([longitude, latitude]) => [latitude, longitude]);
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 8500): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'MyMap/0.9 (com.pnhl.vibecoding)',
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) throw new Error(`Routing HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function osrmProfile(mode: RoutingMode): string {
  return mode === 'foot' ? 'foot' : mode === 'bike' ? 'bike' : 'driving';
}

function graphHopperProfile(mode: RoutingMode): string {
  if (mode === 'motorbike') return 'motorcycle';
  if (mode === 'bike') return 'bike';
  if (mode === 'foot') return 'foot';
  return 'car';
}

function valhallaCosting(mode: RoutingMode): string {
  if (mode === 'motorbike') return 'motor_scooter';
  if (mode === 'bike') return 'bicycle';
  if (mode === 'foot') return 'pedestrian';
  return 'auto';
}

export function decodePolyline6(encoded: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let latitude = 0;
  let longitude = 0;
  let index = 0;
  while (index < encoded.length) {
    const decodeValue = () => {
      let result = 0;
      let shift = 0;
      let byte = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index <= encoded.length);
      return result & 1 ? ~(result >> 1) : result >> 1;
    };
    latitude += decodeValue();
    longitude += decodeValue();
    coordinates.push([latitude / 1e6, longitude / 1e6]);
  }
  return coordinates;
}

async function routeWithGateway(origin: Coordinate, destination: Coordinate, mode: RoutingMode): Promise<RoadRouteResult> {
  if (!config.gatewayUrl) throw new Error('Gateway not configured');
  const data = await fetchJson(`${normalizedBase(config.gatewayUrl)}/route`, {
    method: 'POST',
    body: JSON.stringify({ origin, destination, mode }),
  });
  if (!Array.isArray(data.coordinates) || data.coordinates.length < 2) throw new Error('Invalid gateway route');
  return {
    coordinates: data.coordinates,
    distanceMeters: Math.round(data.distanceMeters),
    durationSeconds: Math.round(data.durationSeconds),
    provider: 'gateway',
  };
}

async function routeWithOsrm(origin: Coordinate, destination: Coordinate, mode: RoutingMode): Promise<RoadRouteResult> {
  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = `${normalizedBase(config.osrmUrl)}/route/v1/${osrmProfile(mode)}/${coordinates}?overview=full&geometries=geojson&steps=false`;
  const data = await fetchJson(url);
  const route = data?.code === 'Ok' ? data.routes?.[0] : null;
  const points = longitudeLatitudeToRoute(route?.geometry?.coordinates);
  if (!route || points.length < 2) throw new Error('No OSRM route');
  return { coordinates: points, distanceMeters: Math.round(route.distance), durationSeconds: Math.round(route.duration), provider: 'osrm' };
}

async function routeWithGraphHopper(origin: Coordinate, destination: Coordinate, mode: RoutingMode): Promise<RoadRouteResult> {
  if (!config.graphHopperKey) throw new Error('GraphHopper key not configured');
  const params = new URLSearchParams({
    profile: graphHopperProfile(mode),
    locale: 'vi',
    points_encoded: 'false',
    key: config.graphHopperKey,
  });
  params.append('point', `${origin.latitude},${origin.longitude}`);
  params.append('point', `${destination.latitude},${destination.longitude}`);
  const data = await fetchJson(`${normalizedBase(config.graphHopperUrl)}/route?${params.toString()}`);
  const path = data?.paths?.[0];
  const points = longitudeLatitudeToRoute(path?.points?.coordinates);
  if (!path || points.length < 2) throw new Error('No GraphHopper route');
  return { coordinates: points, distanceMeters: Math.round(path.distance), durationSeconds: Math.round(path.time / 1000), provider: 'graphhopper' };
}

async function routeWithValhalla(origin: Coordinate, destination: Coordinate, mode: RoutingMode): Promise<RoadRouteResult> {
  const data = await fetchJson(`${normalizedBase(config.valhallaUrl)}/route`, {
    method: 'POST',
    body: JSON.stringify({
      locations: [{ lat: origin.latitude, lon: origin.longitude }, { lat: destination.latitude, lon: destination.longitude }],
      costing: valhallaCosting(mode),
      units: 'kilometers',
      shape_format: 'geojson',
      directions_options: { language: 'vi-VN', units: 'kilometers' },
    }),
  });
  const legs = data?.trip?.legs ?? [];
  const coordinates = legs.flatMap((leg: any) => {
    if (Array.isArray(leg?.shape?.coordinates)) return longitudeLatitudeToRoute(leg.shape.coordinates);
    if (typeof leg?.shape === 'string') return decodePolyline6(leg.shape);
    return [];
  });
  if (coordinates.length < 2) throw new Error('No Valhalla route');
  return {
    coordinates,
    distanceMeters: Math.round(Number(data.trip.summary?.length ?? 0) * 1000),
    durationSeconds: Math.round(Number(data.trip.summary?.time ?? 0)),
    provider: 'valhalla',
  };
}

function providerOrder(): RoutingProvider[] {
  const configured = config.providers.split(',').map(item => item.trim().toLowerCase());
  const valid = configured.filter((item): item is Exclude<RoutingProvider, 'gateway'> => item === 'osrm' || item === 'valhalla' || item === 'graphhopper');
  const defaults: Exclude<RoutingProvider, 'gateway'>[] = ['osrm', 'valhalla', 'graphhopper'];
  const providers: RoutingProvider[] = [...new Set(valid.length ? valid : defaults)];
  if (config.gatewayUrl) providers.unshift('gateway');
  return providers;
}

/** Resolve a road route with cached, ordered fallback across OSRM, GraphHopper and Valhalla. */
export async function fetchRoadRoute(
  origin: Coordinate,
  destination: Coordinate,
  mode: RoutingMode = 'car',
): Promise<RoadRouteResult | null> {
  const order = providerOrder();
  const cacheKey = `${mode}:${origin.latitude.toFixed(4)},${origin.longitude.toFixed(4)}->${destination.latitude.toFixed(4)},${destination.longitude.toFixed(4)}`;
  if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey)!;
  try {
    const raw = await AsyncStorage.getItem(ROUTE_CACHE_PREFIX + cacheKey);
    if (raw) {
      const parsed = JSON.parse(raw) as RoadRouteResult;
      if (parsed.coordinates?.length > 1) {
        memoryCache.set(cacheKey, parsed);
        return parsed;
      }
    }
  } catch {}

  for (const provider of order) {
    try {
      const result = provider === 'gateway'
        ? await routeWithGateway(origin, destination, mode)
        : provider === 'osrm'
          ? await routeWithOsrm(origin, destination, mode)
          : provider === 'graphhopper'
            ? await routeWithGraphHopper(origin, destination, mode)
            : await routeWithValhalla(origin, destination, mode);
      memoryCache.set(cacheKey, result);
      void AsyncStorage.setItem(ROUTE_CACHE_PREFIX + cacheKey, JSON.stringify(result)).catch(() => {});
      return result;
    } catch {
      // Continue to the next configured provider.
    }
  }
  return null;
}

/** Map-match a recorded trace with OSRM and gracefully retain the original GPS trace offline. */
export async function matchTraveledRoute(points: Coordinate[]): Promise<[number, number][]> {
  if (!points || points.length < 2) return points.map(point => [point.latitude, point.longitude]);
  let samplePoints = points;
  if (points.length > 100) {
    const step = Math.ceil(points.length / 100);
    samplePoints = points.filter((_, index) => index % step === 0);
    if (samplePoints[samplePoints.length - 1] !== points[points.length - 1]) samplePoints.push(points[points.length - 1]!);
  }
  const coordinateString = samplePoints.map(point => `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`).join(';');
  const cacheKey = `match:${coordinateString.slice(0, 180)}:${samplePoints.length}`;
  if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey)!.coordinates;
  try {
    const url = `${normalizedBase(config.osrmUrl)}/match/v1/driving/${coordinateString}?overview=full&geometries=geojson&tidy=true`;
    const data = await fetchJson(url, undefined, 9000);
    const matching = data?.code === 'Ok' ? data.matchings?.[0] : null;
    const coordinates = longitudeLatitudeToRoute(matching?.geometry?.coordinates);
    if (matching && coordinates.length > 1) {
      memoryCache.set(cacheKey, {
        coordinates,
        distanceMeters: Math.round(matching.distance),
        durationSeconds: Math.round(matching.duration),
        provider: 'osrm',
      });
      return coordinates;
    }
  } catch {}
  return points.map(point => [point.latitude, point.longitude]);
}
