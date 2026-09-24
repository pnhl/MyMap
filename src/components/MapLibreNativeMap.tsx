import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type CameraRef,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';
import { env } from '../config/env';
import type { LeafletMapProps, LeafletMapRef } from './LeafletMap';

const EMPTY_COLLECTION: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

function routeFeature(coordinates?: [number, number][]): GeoJSON.FeatureCollection {
  if (!coordinates || coordinates.length < 2) return EMPTY_COLLECTION;
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coordinates.map(([latitude, longitude]) => [longitude, latitude]),
      },
    }],
  };
}

function pointCollection(
  points: Array<{ id: string; latitude: number; longitude: number; [key: string]: unknown }>,
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map(point => ({
      type: 'Feature',
      id: point.id,
      properties: { ...point },
      geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
    })),
  };
}

function polygonCollection(polygons?: [number, number][][]): GeoJSON.FeatureCollection {
  if (!polygons?.length) return EMPTY_COLLECTION;
  return {
    type: 'FeatureCollection',
    features: polygons.filter(polygon => polygon.length >= 3).map((polygon, index) => {
      const ring = polygon.map(([latitude, longitude]) => [longitude, latitude]);
      if (ring.length && (ring[0]![0] !== ring[ring.length - 1]![0] || ring[0]![1] !== ring[ring.length - 1]![1])) {
        ring.push([...ring[0]!] as [number, number]);
      }
      return {
        type: 'Feature' as const,
        id: `scratch-${index}`,
        properties: {},
        geometry: { type: 'Polygon' as const, coordinates: [ring] },
      };
    }),
  };
}

function tileUrl(provider: LeafletMapProps['tileProvider']): string {
  if (provider === 'satellite') {
    return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  }
  if ((provider === 'stadia_dark' || provider === 'carto_dark') && env.stadiaMapsKey) {
    return `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}@2x.png?api_key=${env.stadiaMapsKey}`;
  }
  if (provider === 'stadia_smooth' && env.stadiaMapsKey) {
    return `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}@2x.png?api_key=${env.stadiaMapsKey}`;
  }
  return env.osmTileUrl;
}

function mapStyle(provider: LeafletMapProps['tileProvider']): StyleSpecification | string {
  if (env.mapLibreStyleUrl) return env.mapLibreStyleUrl;
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: [tileUrl(provider)],
        tileSize: 256,
        maxzoom: provider === 'satellite' ? 19 : 20,
        attribution: '© OpenStreetMap contributors',
      },
      terrain: {
        type: 'raster-dem',
        url: env.mapLibreDemUrl,
        tileSize: 256,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#020C24' } },
      { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 1 } },
      {
        id: 'terrain-hillshade',
        type: 'hillshade',
        source: 'terrain',
        paint: {
          'hillshade-shadow-color': '#07172e',
          'hillshade-highlight-color': '#8be8ff',
          'hillshade-accent-color': '#2c6f8c',
          'hillshade-exaggeration': 0.32,
        },
      },
    ],
    terrain: { source: 'terrain', exaggeration: 1.18 },
  } as StyleSpecification;
}

export const MapLibreNativeMap = forwardRef<LeafletMapRef, LeafletMapProps>(function MapLibreNativeMap(
  {
    currentPosition,
    initialRegion,
    tileProvider = 'stadia_dark',
    friends = [],
    photos = [],
    partyGroups = [],
    mapChatMessages = [],
    todayPoints = [],
    todayRoadRoute,
    showRoute = true,
    destination,
    destinationRoadRoute,
    footprintsFriend,
    scratchHexagons,
    onFriendPress,
    onMapClick,
    onMapReady,
  },
  ref,
) {
  const camera = useRef<CameraRef>(null);
  const initialCenter: [number, number] = [
    initialRegion?.longitude ?? currentPosition?.longitude ?? 105.854167,
    initialRegion?.latitude ?? currentPosition?.latitude ?? 21.028511,
  ];

  const style = useMemo(() => mapStyle(tileProvider), [tileProvider]);
  const todayLine = useMemo(
    () => routeFeature(todayRoadRoute ?? todayPoints.map(point => [point.latitude, point.longitude])),
    [todayPoints, todayRoadRoute],
  );
  const destinationLine = useMemo(() => routeFeature(destinationRoadRoute), [destinationRoadRoute]);
  const friendFeatures = useMemo(
    () => pointCollection(friends.map(friend => ({
      id: friend.id,
      latitude: friend.latitude,
      longitude: friend.longitude,
      name: friend.displayName,
    }))),
    [friends],
  );
  const partyFeatures = useMemo(
    () => pointCollection(partyGroups.map((group, index) => ({
      id: group.id || `party-${index}`,
      latitude: group.centerLat,
      longitude: group.centerLon,
      count: group.friends.length,
    }))),
    [partyGroups],
  );
  const photoFeatures = useMemo(
    () => pointCollection(photos.map(photo => ({
      id: String(photo.id),
      latitude: photo.latitude,
      longitude: photo.longitude,
    }))),
    [photos],
  );
  const chatFeatures = useMemo(
    () => pointCollection(mapChatMessages.map(message => ({
      id: message.id,
      latitude: message.latitude,
      longitude: message.longitude,
    }))),
    [mapChatMessages],
  );
  const scratchFeatures = useMemo(() => polygonCollection(scratchHexagons), [scratchHexagons]);

  useImperativeHandle(ref, () => ({
    animateToRegion(coords, duration = 700) {
      camera.current?.easeTo({
        center: [coords.longitude, coords.latitude],
        zoom: coords.zoom ?? 15,
        duration,
      });
    },
    centerOnUser() {
      if (!currentPosition) return;
      camera.current?.easeTo({ center: [currentPosition.longitude, currentPosition.latitude], zoom: 16, duration: 650 });
    },
    fitToCoordinates(coords, options) {
      if (!coords.length) return;
      const longitudes = coords.map(point => point.longitude);
      const latitudes = coords.map(point => point.latitude);
      camera.current?.fitBounds(
        [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)],
        {
          padding: {
            top: options?.edgePadding?.top ?? 70,
            right: options?.edgePadding?.right ?? 50,
            bottom: options?.edgePadding?.bottom ?? 100,
            left: options?.edgePadding?.left ?? 50,
          },
          duration: 750,
        },
      );
    },
  }), [currentPosition]);

  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={style}
      attribution
      attributionPosition={{ bottom: 6, left: 6 }}
      logo={false}
      compass
      compassPosition={{ top: 72, right: 16 }}
      touchPitch
      onDidFinishLoadingMap={onMapReady}
      onPress={event => {
        const [longitude, latitude] = event.nativeEvent.lngLat;
        onMapClick?.({ latitude, longitude });
      }}
    >
      <Camera
        ref={camera}
        initialViewState={{ center: initialCenter, zoom: initialRegion?.zoom ?? 14, pitch: 48 }}
        minZoom={2}
        maxZoom={20}
      />

      {showRoute && <GeoJSONSource id="today-route-source" data={todayLine}>
        <Layer id="today-route-shadow" type="line" paint={{ 'line-color': '#031333', 'line-width': 8, 'line-opacity': 0.72 }} />
        <Layer id="today-route" type="line" paint={{ 'line-color': '#32D7FF', 'line-width': 4.5, 'line-opacity': 0.96 }} />
      </GeoJSONSource>}

      <GeoJSONSource id="destination-route-source" data={destinationLine}>
        <Layer id="destination-route" type="line" paint={{ 'line-color': '#00F5D4', 'line-width': 5.5, 'line-opacity': 0.95 }} />
      </GeoJSONSource>

      <GeoJSONSource
        id="friends-source"
        data={friendFeatures}
        onPress={event => {
          const id = String(event.nativeEvent.features?.[0]?.properties?.id ?? '');
          const friend = friends.find(item => item.id === id);
          if (friend) onFriendPress?.(friend);
        }}
      >
        <Layer id="friends-halo" type="circle" paint={{ 'circle-radius': 13, 'circle-color': '#00F5D4', 'circle-opacity': 0.2, 'circle-stroke-color': '#52E3FF', 'circle-stroke-width': 2 }} />
        <Layer id="friends-dot" type="circle" paint={{ 'circle-radius': 6, 'circle-color': '#F7FDFF', 'circle-stroke-color': '#00C8FF', 'circle-stroke-width': 2.5 }} />
      </GeoJSONSource>

      <GeoJSONSource id="parties-source" data={partyFeatures}>
        <Layer id="parties" type="circle" paint={{ 'circle-radius': 9, 'circle-color': '#FF3B80', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 }} />
      </GeoJSONSource>

      <GeoJSONSource id="photos-source" data={photoFeatures}>
        <Layer id="photos-halo" type="circle" paint={{ 'circle-radius': 10, 'circle-color': '#9D5CFF', 'circle-opacity': 0.9, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 }} />
        <Layer id="photos-core" type="circle" paint={{ 'circle-radius': 3, 'circle-color': '#FFFFFF' }} />
      </GeoJSONSource>

      <GeoJSONSource id="chats-source" data={chatFeatures}>
        <Layer id="chats" type="circle" paint={{ 'circle-radius': 7, 'circle-color': '#9D5CFF', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1.5 }} />
      </GeoJSONSource>

      <GeoJSONSource id="scratch-source" data={scratchFeatures}>
        <Layer id="scratch-fill" type="fill" paint={{ 'fill-color': '#00F5D4', 'fill-opacity': 0.2, 'fill-outline-color': '#52E3FF' }} />
      </GeoJSONSource>

      {currentPosition && <Marker id="current-position" lngLat={[currentPosition.longitude, currentPosition.latitude]}>
        <View style={styles.userMarker}><View style={styles.userPulse} /><View style={styles.userDot} /></View>
      </Marker>}
      {destination && <Marker id="destination" lngLat={[destination.longitude, destination.latitude]} anchor="bottom">
        <View style={styles.destinationMarker}><View style={styles.destinationCore} /><View style={styles.destinationStem} /></View>
      </Marker>}
      {footprintsFriend && <Marker id="footprints-friend" lngLat={[footprintsFriend.longitude, footprintsFriend.latitude]}>
        <View style={styles.footprint}><View style={styles.footprintDot} /></View>
      </Marker>}
    </Map>
  );
});

const styles = StyleSheet.create({
  userMarker: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  userPulse: { position: 'absolute', width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,245,212,.28)' },
  userDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#00F5D4', borderWidth: 2.5, borderColor: '#FFFFFF' },
  destinationMarker: { width: 36, height: 48, alignItems: 'center', justifyContent: 'flex-start' },
  destinationCore: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FF355E', borderWidth: 3, borderColor: '#FFFFFF' },
  destinationStem: { width: 3, height: 14, marginTop: -2, backgroundColor: '#FF355E' },
  footprint: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(157,92,255,.28)', borderWidth: 1.5, borderColor: '#C5A3FF', alignItems: 'center', justifyContent: 'center' },
  footprintDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
});
