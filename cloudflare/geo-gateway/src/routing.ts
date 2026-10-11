import { body, coordinate, HttpError, numeric, query, record, Upstream, type Env, type Coordinate } from './security';
export type RoutingProvider = 'osrm' | 'valhalla' | 'graphhopper' | 'tomtom';
export type RouteLane = { indications: string[]; valid: boolean };
export function valhallaLanes(lanes: any): RouteLane[] {
  if(!Array.isArray(lanes))return [];
  const directions: [number,string][]=[[2,'straight'],[4,'sharp left'],[8,'left'],[16,'slight left'],[32,'slight right'],[64,'right'],[128,'sharp right'],[256,'uturn'],[512,'left'],[1024,'right']];
  return lanes.map(lane=>({indications:directions.filter(([mask])=>(Number(lane.directions)&mask)!==0).map(([,name])=>name),valid:Number(lane.active)>0||Number(lane.valid)>0}));
}

export type RouteStep = {
  lanes?: RouteLane[];
  distanceMeters: number;
  instruction: string;
  roadName: string | null;
  type: string;
  modifier: string | null;
  position: [number, number] | null;
};


export interface RoadRouteResult {
  preferencesApplied?: boolean;
  trafficUpdatedAt?: number;
  trafficDelaySeconds?: number;
  trafficSegments?: [number,number][][];
  hasTolls?: boolean;
  alternatives?: RoadRouteResult[];
  coordinates: [number, number][]; // [latitude, longitude]
  distanceMeters: number;
  durationSeconds: number;
  provider: RoutingProvider;
  steps: RouteStep[];
}

type Mode = 'car' | 'motorbike' | 'bike' | 'foot';
type Preferences = { avoidFerries: boolean; avoidHighways: boolean; avoidUnpaved: boolean };
export async function routingOperation(request: Request, url: URL, env: Env): Promise<{ cost: number; run(up: Upstream): Promise<{ data: unknown }> }> {
  query(url, []);
  const input = record(await body(request), ['origin','destination','mode','preferences','options']);
  const origin = coordinate(input.origin), destination = coordinate(input.destination);
  const mode: Mode = input.mode ?? 'car';
  if (!['car','motorbike','bike','foot'].includes(mode)) throw new HttpError(400, 'Unsupported travel mode');
  const rawPrefs = input.preferences === undefined ? {} : record(input.preferences, ['avoidFerries','avoidHighways','avoidUnpaved','speedWarnings','sound','vibration','customSpeedKmh','voiceGuidance']);
  for (const [key,value] of Object.entries(rawPrefs)) {
    if (key === 'customSpeedKmh') { if (value !== null) numeric(value,5,300); }
    else if (typeof value !== 'boolean') throw new HttpError(400, 'Invalid navigation preferences');
  }
  const preferences: Preferences = { avoidFerries: rawPrefs.avoidFerries === true, avoidHighways: rawPrefs.avoidHighways === true, avoidUnpaved: rawPrefs.avoidUnpaved === true };
  const options = input.options === undefined ? {} : record(input.options, ['heading','accuracy','traffic']);
  if (options.heading != null) numeric(options.heading,0,360);
  if (options.accuracy != null) numeric(options.accuracy,0,10000);
  if (options.traffic !== undefined && typeof options.traffic !== 'boolean') throw new HttpError(400, 'Invalid traffic option');
  const configured = (env.ROUTING_PROVIDERS || 'tomtom,osrm,valhalla,graphhopper').split(',').map(value => value.trim());
  const providers = [...new Set(configured.filter((provider): provider is RoutingProvider => ['osrm','valhalla','graphhopper','tomtom'].includes(provider)))];
  const avoidance = Object.values(preferences).some(Boolean);
  return { cost: 20, run: async up => {
    for (const provider of providers) {
      if (provider === 'osrm' && (mode !== 'car' || avoidance)) continue;
      if (provider === 'graphhopper' && avoidance) continue;
      if (provider === 'valhalla' && preferences.avoidUnpaved && (mode === 'bike' || mode === 'foot')) continue;
      try {
        let result: RoadRouteResult;
        if (provider === 'osrm') {
          const points = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
          const params = new URLSearchParams({ overview: 'full', geometries: 'geojson', steps: 'true', alternatives: 'true' });
          if (options.heading != null) params.set('bearings',`${Math.round(options.heading) % 360},60;`);
          if (options.accuracy != null) params.set('radiuses',`${Math.min(50,Math.max(15,Math.round(options.accuracy)))};`);
          result = osrmChoices(await up.json(`https://router.project-osrm.org/route/v1/driving/${points}?${params}`));
        } else if (provider === 'graphhopper') {
          const params = new URLSearchParams({ algorithm: 'alternative_route', profile: mode === 'motorbike' ? 'motorcycle' : mode === 'bike' ? 'bike' : mode === 'foot' ? 'foot' : 'car', locale: 'vi', points_encoded: 'false', instructions: 'true', key: await up.secret('GRAPHHOPPER_KEY') });
          params.append('point',`${origin.latitude},${origin.longitude}`); params.append('point',`${destination.latitude},${destination.longitude}`);
          const data = await up.json(`https://graphhopper.com/api/1/route?${params}`);
          result = combineRouteChoices((data.paths || []).map((path: any) => { const coordinates = longitudeLatitudeToRoute(path.points?.coordinates); return { coordinates, distanceMeters: Math.round(path.distance), durationSeconds: Math.round(path.time/1000), provider, steps: graphHopperRouteSteps(path,coordinates) }; }));
        } else if (provider === 'valhalla') {
          const costing = mode === 'motorbike' ? 'motor_scooter' : mode === 'bike' ? 'bicycle' : mode === 'foot' ? 'pedestrian' : 'auto';
          const location: Record<string,number> = { lat: origin.latitude, lon: origin.longitude };
          if (options.heading != null) { location.heading = Math.round(options.heading) % 360; location.heading_tolerance = 60; }
          if (options.accuracy != null) location.radius = Math.min(50,Math.max(15,Math.round(options.accuracy)));
          const data = await up.json('https://valhalla1.openstreetmap.de/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alternates: 2, turn_lanes: true, locations: [location,{ lat: destination.latitude, lon: destination.longitude }], costing, costing_options: { [costing]: { exclude_ferries: preferences.avoidFerries, exclude_highways: preferences.avoidHighways, exclude_unpaved: preferences.avoidUnpaved, use_ferry: preferences.avoidFerries ? 0 : 0.5, ...(mode === 'car' ? { use_highways: preferences.avoidHighways ? 0 : 1 } : {}) } }, units: 'kilometers', shape_format: 'geojson', directions_options: { language: 'vi-VN', units: 'kilometers' } }) });
          if (avoidance && data.warnings?.length) throw new Error('Avoidance unavailable');
          result = combineRouteChoices([valhallaChoice(data.trip),...(data.alternates || []).map((alternative: any) => valhallaChoice(alternative.trip))]);
        } else {
          const params = new URLSearchParams({ key: await up.secret('TOMTOM_KEY'), maxAlternatives: '2', traffic: options.traffic === false ? 'false' : 'true', departAt: 'now', travelMode: mode === 'motorbike' ? 'motorcycle' : mode === 'bike' ? 'bicycle' : mode === 'foot' ? 'pedestrian' : 'car', instructionsType: 'text', language: 'vi-VN', computeTravelTimeFor: 'all' });
          if (options.traffic !== false) params.append('sectionType','traffic'); params.append('sectionType','tollRoad');
          if (preferences.avoidFerries) params.append('avoid','ferries'); if (preferences.avoidHighways) params.append('avoid','motorways'); if (preferences.avoidUnpaved) params.append('avoid','unpavedRoads');
          if (options.heading != null) params.set('vehicleHeading',String(Math.round(options.heading) % 360));
          result = parseTomTomRoutes(await up.json(`https://api.tomtom.com/routing/1/calculateRoute/${origin.latitude},${origin.longitude}:${destination.latitude},${destination.longitude}/json?${params}`));
        }
        result.preferencesApplied = true;
        return { data: up.redact(result) };
      } catch (error) {
        if (error instanceof HttpError && error.status === 429) throw error;
        // Fixed, bounded fallback order; upstream details and credentials are never exposed.
      }
    }
    throw new HttpError(502, 'No routing provider returned a usable route');
  } };
}


function isCoordinate(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]);
}

function longitudeLatitudeToRoute(coordinates: unknown): [number, number][] {
  if (!Array.isArray(coordinates)) return [];
  return coordinates.filter(isCoordinate).map(([longitude, latitude]) => [latitude, longitude]);
}

function maneuverInstruction(
  type: string,
  modifier: string | null,
  roadName: string | null,
): string {
  const road = roadName ? ` · ${roadName}` : '';
  if (type === 'arrive' || type === 'finish') return 'Đến điểm đến';
  if (type === 'roundabout' || type === 'rotary') return `Đi vào vòng xuyến${road}`;
  if (type === 'merge') return `Nhập làn${road}`;
  if (type === 'fork') return modifier?.includes('left') ? `Đi theo nhánh trái${road}` : `Đi theo nhánh phải${road}`;
  if (type === 'on ramp' || type === 'off ramp') return modifier?.includes('left') ? `Đi theo lối bên trái${road}` : `Đi theo lối bên phải${road}`;
  if (type === 'uturn' || modifier === 'uturn') return 'Quay đầu khi an toàn';
  if (modifier?.includes('sharp left')) return `Rẽ gấp sang trái${road}`;
  if (modifier?.includes('slight left')) return `Chếch sang trái${road}`;
  if (modifier?.includes('left')) return `Rẽ trái${road}`;
  if (modifier?.includes('sharp right')) return `Rẽ gấp sang phải${road}`;
  if (modifier?.includes('slight right')) return `Chếch sang phải${road}`;
  if (modifier?.includes('right')) return `Rẽ phải${road}`;
  if (type === 'depart') return roadName ? `Đi theo ${roadName}` : 'Bắt đầu đi theo tuyến đường';
  return roadName ? `Tiếp tục trên ${roadName}` : 'Tiếp tục đi thẳng';
}

function routePosition(value: unknown): [number, number] | null {
  if (!isCoordinate(value)) return null;
  return [value[1], value[0]];
}

function osrmRouteSteps(route: any): RouteStep[] {
  const raw = (route?.legs ?? []).flatMap((leg: any) => leg?.steps ?? []);
  return raw.map((step: any) => {
    const type = String(step?.maneuver?.type || 'continue');
    const modifier = step?.maneuver?.modifier ? String(step.maneuver.modifier) : null;
    const roadName = String(step?.name || step?.ref || '').trim() || null;
    return {
      lanes: (step?.intersections?.[0]?.lanes ?? []).filter((lane: any)=>Array.isArray(lane.indications)).map((lane: any)=>({indications:lane.indications.filter((value:unknown)=>typeof value==='string'),valid:lane.valid===true})),
      distanceMeters: Math.max(0, Math.round(Number(step?.distance || 0))),
      instruction: maneuverInstruction(type, modifier, roadName),
      roadName,
      type,
      modifier,
      position: routePosition(step?.maneuver?.location),
    };
  });
}

function graphHopperType(sign: number): { type: string; modifier: string | null } {
  if (sign === 4 || sign === 5) return { type: 'arrive', modifier: null };
  if (sign === 6) return { type: 'roundabout', modifier: 'right' };
  if (sign <= -1) return { type: 'turn', modifier: sign <= -3 ? 'sharp left' : sign === -1 ? 'slight left' : 'left' };
  if (sign >= 1) return { type: 'turn', modifier: sign >= 3 ? 'sharp right' : sign === 1 ? 'slight right' : 'right' };
  return { type: 'continue', modifier: 'straight' };
}

function graphHopperRouteSteps(path: any, coordinates: [number, number][]): RouteStep[] {
  return (path?.instructions ?? []).map((step: any, index: number) => {
    const movement = graphHopperType(Number(step?.sign ?? 0));
    const pointIndex = Number(step?.interval?.[0] ?? 0);
    const roadName = String(step?.street_name || '').trim() || null;
    return {
      distanceMeters: Math.max(0, Math.round(Number(step?.distance || 0))),
      instruction: String(step?.text || '').trim()
        || maneuverInstruction(index === 0 ? 'depart' : movement.type, movement.modifier, roadName),
      roadName,
      type: index === 0 ? 'depart' : movement.type,
      modifier: movement.modifier,
      position: coordinates[pointIndex] ?? null,
    };
  });
}

function valhallaType(typeValue: number): { type: string; modifier: string | null } {
  if ([4, 5, 6].includes(typeValue)) return { type: 'arrive', modifier: null };
  if ([26,27].includes(typeValue)) return {type:'roundabout',modifier:'right'};
  if ([12,13].includes(typeValue)) return {type:'uturn',modifier:'uturn'};
  if ([17,18,19].includes(typeValue)) return {type:'on ramp',modifier:typeValue===19?'left':typeValue===18?'right':'straight'};
  if ([20,21].includes(typeValue)) return {type:'off ramp',modifier:typeValue===21?'left':'right'};
  if ([25,37,38].includes(typeValue)) return {type:'merge',modifier:typeValue===38?'left':typeValue===37?'right':'straight'};
  if ([22,23,24].includes(typeValue)) return {type:'fork',modifier:typeValue===24?'left':typeValue===23?'right':'straight'};
  if ([9,10,11].includes(typeValue)) return {type:'turn',modifier:typeValue===9?'slight right':typeValue===11?'sharp right':'right'};
  if ([14,15,16].includes(typeValue)) return {type:'turn',modifier:typeValue===16?'slight left':typeValue===14?'sharp left':'left'};
  return { type: 'continue', modifier: 'straight' };
}

function valhallaRouteSteps(legs: any[], coordinates: [number, number][]): RouteStep[] {
  let offset = 0;
  return legs.flatMap((leg: any, legIndex: number) => {
    const legOffset = offset;
    offset += typeof leg?.shape === 'string' ? decodePolyline6(leg.shape).length : (leg?.shape?.coordinates?.length ?? 0);
    return (leg?.maneuvers ?? []).map((step: any, index: number) => {
    const movement = valhallaType(Number(step?.type ?? 0));
    const roadName = String(step?.street_names?.[0] || '').trim() || null;
    const type = legIndex === 0 && index === 0 ? 'depart' : movement.type;
    return {
      lanes: valhallaLanes(step?.lanes),
      distanceMeters: Math.max(0, Math.round(Number(step?.length || 0) * 1000)),
      instruction: String(step?.instruction || step?.verbal_pre_transition_instruction || '').trim()
        || maneuverInstruction(type, movement.modifier, roadName),
      roadName,
      type,
      modifier: movement.modifier,
      position: coordinates[legOffset + Number(step?.begin_shape_index ?? 0)] ?? null,
    };
  });});
}


export function combineRouteChoices(routes: RoadRouteResult[]): RoadRouteResult {
  const seen = new Set<string>();
  const valid = routes.filter(route=>{
    if (route.coordinates.length<2 || !Number.isFinite(route.distanceMeters) || route.distanceMeters<0 || !Number.isFinite(route.durationSeconds) || route.durationSeconds<0) return false;
    const key=JSON.stringify(route.coordinates);
    if(seen.has(key))return false;
    seen.add(key);return true;
  }).slice(0,3);
  if(!valid.length)throw new Error('No valid road route');
  return {...valid[0]!,alternatives:valid.slice(1).map(({alternatives,...route})=>route)};
}

function osrmChoices(data: any): RoadRouteResult {
  if(data?.code!=='Ok')throw new Error('No OSRM route');
  return combineRouteChoices((data.routes??[]).map((route:any)=>({coordinates:longitudeLatitudeToRoute(route.geometry?.coordinates),distanceMeters:Math.round(route.distance),durationSeconds:Math.round(route.duration),provider:'osrm',steps:osrmRouteSteps(route)})));
}

function valhallaChoice(trip: any): RoadRouteResult {
  const legs=trip?.legs??[];
  const coordinates=legs.flatMap((leg:any)=>Array.isArray(leg?.shape?.coordinates)?longitudeLatitudeToRoute(leg.shape.coordinates):typeof leg?.shape==='string'?decodePolyline6(leg.shape):[]);
  return {coordinates,distanceMeters:Math.round(Number(trip?.summary?.length??0)*1000),durationSeconds:Math.round(Number(trip?.summary?.time??0)),provider:'valhalla',steps:valhallaRouteSteps(legs,coordinates)};
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


export function parseTomTomRoutes(data:any,updatedAt=Date.now()):RoadRouteResult {
  const routes=(data?.routes??[]).map((route:any):RoadRouteResult=>{
    // Preserve point indexes: TomTom sections refer to the flattened, unfiltered geometry.
    const points=(route.legs??[]).flatMap((leg:any)=>leg.points??[]);
    if(points.some((point:any)=>!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude)||Math.abs(point.latitude)>90||Math.abs(point.longitude)>180))throw new Error('Invalid route geometry');
    const coordinates:[number,number][]=points.map((point:any)=>[point.latitude,point.longitude]);
    const instructions=route.guidance?.instructions??[];
    const steps:RouteStep[]=instructions.map((step:any,index:number)=>{
      const maneuver=String(step.maneuver||'STRAIGHT').toLowerCase();
      const type=maneuver.includes('arriv')?'arrive':maneuver.includes('depart')?'depart':maneuver.includes('roundabout')?'roundabout':maneuver.includes('u_turn')?'uturn':maneuver.includes('keep_')?'fork':'turn';
      const direction=maneuver.includes('left')?'left':maneuver.includes('right')?'right':'straight';
      const modifier=direction==='straight'?'straight':`${maneuver.includes('sharp')?'sharp ':maneuver.includes('bear')?'slight ':''}${direction}`;
      const roadName=String(step.street||'').trim()||null;
      return {type,modifier,roadName,instruction:maneuverInstruction(type,modifier,roadName),distanceMeters:Math.max(0,Number(instructions[index+1]?.routeOffsetInMeters??route.summary?.lengthInMeters)-Number(step.routeOffsetInMeters||0)),position:step.point?[step.point.latitude,step.point.longitude]:coordinates[step.pointIndex]??null};
    });
    const trafficSegments:[number,number][][]=(route.sections??[]).flatMap((section:any)=>{
      const start=section.startPointIndex,end=section.endPointIndex;
      if(section.sectionType!=='TRAFFIC'||!['JAM','ROAD_CLOSURE'].includes(section.simpleCategory)||!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>=coordinates.length)return [];
      return [coordinates.slice(start,end+1)];
    });
    return {provider:'tomtom',coordinates,steps,distanceMeters:Number(route.summary?.lengthInMeters),durationSeconds:Number(route.summary?.travelTimeInSeconds),trafficUpdatedAt:updatedAt,trafficDelaySeconds:Math.max(0,Number(route.summary?.trafficDelayInSeconds||0)),trafficSegments,hasTolls:(route.sections??[]).some((section:any)=>section.sectionType==='TOLL_ROAD'||section.sectionType==='TOLL')};
  });
  return combineRouteChoices(routes);
}
