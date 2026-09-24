import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { env } from '../config/env';
import type { LeafletMapProps, LeafletMapRef } from './LeafletMap';

export type WebMapEngineName = 'maplibre_gl' | 'openlayers' | 'cesium';

type Props = LeafletMapProps & { engine: WebMapEngineName };

type WebPayload = {
  center: [number, number];
  zoom: number;
  tileUrl: string;
  demUrl: string;
  ionToken: string;
  todayRoute: [number, number][];
  destinationRoute: [number, number][];
  current: [number, number] | null;
  destination: [number, number] | null;
  friends: Array<{ id: string; name: string; coordinate: [number, number] }>;
};

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function tileUrl(provider: LeafletMapProps['tileProvider']): string {
  if (provider === 'satellite') return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  if ((provider === 'stadia_dark' || provider === 'carto_dark') && env.stadiaMapsKey) {
    return `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}@2x.png?api_key=${env.stadiaMapsKey}`;
  }
  if (provider === 'stadia_smooth' && env.stadiaMapsKey) {
    return `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}@2x.png?api_key=${env.stadiaMapsKey}`;
  }
  return env.osmTileUrl;
}

function shell(title: string, cssUrl: string, scriptUrl: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/><title>${title}</title><link rel="stylesheet" href="${cssUrl}"/><style>html,body,#map{width:100%;height:100%;margin:0;background:#020c24;overflow:hidden}.loading{position:fixed;inset:0;display:grid;place-items:center;color:#9de8ff;font:600 13px system-ui;background:#020c24}.maplibregl-ctrl-attrib,.ol-attribution{font-size:9px!important;opacity:.78}</style></head><body><div id="map"></div><div id="loading" class="loading">Đang tải ${title}…</div><script src="${scriptUrl}"></script><script>${body}</script></body></html>`;
}

function bridgePrelude(payload: WebPayload): string {
  return `const payload=${safeJson(payload)};const send=(type,data={})=>{try{window.ReactNativeWebView.postMessage(JSON.stringify({type,...data}))}catch(_){}};const ready=()=>{const el=document.getElementById('loading');if(el)el.remove();send('ready')};const routeGeoJSON=(coords)=>({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}});window.onerror=(message)=>send('error',{message:String(message)});`;
}

function mapLibreHtml(payload: WebPayload): string {
  const body = `${bridgePrelude(payload)}
  const style={version:8,sources:{osm:{type:'raster',tiles:[payload.tileUrl],tileSize:256,maxzoom:20,attribution:'© OpenStreetMap contributors'},terrain:{type:'raster-dem',url:payload.demUrl,tileSize:256}},layers:[{id:'background',type:'background',paint:{'background-color':'#020c24'}},{id:'osm',type:'raster',source:'osm'},{id:'hillshade',type:'hillshade',source:'terrain',paint:{'hillshade-exaggeration':0.35,'hillshade-shadow-color':'#07172e','hillshade-highlight-color':'#8be8ff'}}],terrain:{source:'terrain',exaggeration:1.2}};
  const map=new maplibregl.Map({container:'map',style,center:payload.center,zoom:payload.zoom,pitch:58,bearing:-12,attributionControl:true});
  const addLine=(id,coords,color,width)=>{if(coords.length<2)return;map.addSource(id,{type:'geojson',data:routeGeoJSON(coords)});map.addLayer({id,type:'line',source:id,paint:{'line-color':color,'line-width':width,'line-opacity':.95}})};
  const addPoints=()=>{const features=[];if(payload.current)features.push({type:'Feature',properties:{kind:'current'},geometry:{type:'Point',coordinates:payload.current}});if(payload.destination)features.push({type:'Feature',properties:{kind:'destination'},geometry:{type:'Point',coordinates:payload.destination}});payload.friends.forEach(f=>features.push({type:'Feature',properties:{kind:'friend',id:f.id,name:f.name},geometry:{type:'Point',coordinates:f.coordinate}}));map.addSource('points',{type:'geojson',data:{type:'FeatureCollection',features}});map.addLayer({id:'points-halo',type:'circle',source:'points',paint:{'circle-radius':['match',['get','kind'],'current',12,'destination',11,9],'circle-color':['match',['get','kind'],'current','#00f5d4','destination','#ff355e','#52e3ff'],'circle-opacity':.88,'circle-stroke-color':'#fff','circle-stroke-width':2}})};
  map.on('load',()=>{addLine('today-route',payload.todayRoute,'#32d7ff',4);addLine('destination-route',payload.destinationRoute,'#00f5d4',5);addPoints();ready()});map.on('click',e=>send('mapClick',{latitude:e.lngLat.lat,longitude:e.lngLat.lng}));window.myMapBridge={animate:(c)=>map.easeTo({center:[c.longitude,c.latitude],zoom:c.zoom||15,duration:c.duration||700,pitch:58}),fit:(coords)=>{if(!coords.length)return;const bounds=coords.reduce((b,c)=>b.extend([c.longitude,c.latitude]),new maplibregl.LngLatBounds());map.fitBounds(bounds,{padding:60,duration:700})}};`;
  return shell('MapLibre GL 3D', 'https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.css', 'https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.js', body);
}

function openLayersHtml(payload: WebPayload): string {
  const body = `${bridgePrelude(payload)}
  const from=ol.proj.fromLonLat;const features=[];const line=(coords,color,width)=>{if(coords.length<2)return;const f=new ol.Feature(new ol.geom.LineString(coords).transform('EPSG:4326','EPSG:3857'));f.setStyle(new ol.style.Style({stroke:new ol.style.Stroke({color,width})}));features.push(f)};line(payload.todayRoute,'#32d7ff',4);line(payload.destinationRoute,'#00f5d4',5);
  const point=(coord,color,radius)=>{if(!coord)return;const f=new ol.Feature(new ol.geom.Point(from(coord)));f.setStyle(new ol.style.Style({image:new ol.style.Circle({radius,fill:new ol.style.Fill({color}),stroke:new ol.style.Stroke({color:'#fff',width:2})})}));features.push(f)};point(payload.current,'#00f5d4',8);point(payload.destination,'#ff355e',9);payload.friends.forEach(f=>point(f.coordinate,'#52e3ff',7));
  const map=new ol.Map({target:'map',layers:[new ol.layer.Tile({source:new ol.source.XYZ({url:payload.tileUrl,attributions:'© OpenStreetMap contributors',crossOrigin:'anonymous'})}),new ol.layer.Vector({source:new ol.source.Vector({features})})],view:new ol.View({center:from(payload.center),zoom:payload.zoom})});map.once('rendercomplete',ready);map.on('click',e=>{const c=ol.proj.toLonLat(e.coordinate);send('mapClick',{latitude:c[1],longitude:c[0]})});window.myMapBridge={animate:(c)=>map.getView().animate({center:from([c.longitude,c.latitude]),zoom:c.zoom||15,duration:c.duration||700}),fit:(coords)=>{if(!coords.length)return;const extent=ol.extent.boundingExtent(coords.map(c=>from([c.longitude,c.latitude])));map.getView().fit(extent,{padding:[60,60,60,60],duration:700,maxZoom:17})}};`;
  return shell('OpenLayers', 'https://cdn.jsdelivr.net/npm/ol@10.10.0/ol.css', 'https://cdn.jsdelivr.net/npm/ol@10.10.0/dist/ol.js', body);
}

function cesiumHtml(payload: WebPayload): string {
  const body = `${bridgePrelude(payload)}
  (async()=>{if(payload.ionToken)Cesium.Ion.defaultAccessToken=payload.ionToken;const terrainProvider=payload.ionToken?await Cesium.createWorldTerrainAsync():new Cesium.EllipsoidTerrainProvider();const viewer=new Cesium.Viewer('map',{terrainProvider,baseLayer:false,animation:false,timeline:false,geocoder:false,homeButton:false,sceneModePicker:false,baseLayerPicker:false,navigationHelpButton:false,fullscreenButton:false,selectionIndicator:false,infoBox:false});viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({url:payload.tileUrl,credit:'© OpenStreetMap contributors',maximumLevel:19}));viewer.scene.globe.depthTestAgainstTerrain=true;
  const addLine=(coords,color,width)=>{if(coords.length<2)return;viewer.entities.add({polyline:{positions:Cesium.Cartesian3.fromDegreesArray(coords.flat()),width,material:color,clampToGround:true}})};addLine(payload.todayRoute,Cesium.Color.fromCssColorString('#32d7ff'),4);addLine(payload.destinationRoute,Cesium.Color.fromCssColorString('#00f5d4'),5);const point=(coord,color,size)=>{if(!coord)return;viewer.entities.add({position:Cesium.Cartesian3.fromDegrees(coord[0],coord[1]),point:{pixelSize:size,color,outlineColor:Cesium.Color.WHITE,outlineWidth:2,heightReference:Cesium.HeightReference.CLAMP_TO_GROUND}})};point(payload.current,Cesium.Color.fromCssColorString('#00f5d4'),12);point(payload.destination,Cesium.Color.fromCssColorString('#ff355e'),13);payload.friends.forEach(f=>point(f.coordinate,Cesium.Color.fromCssColorString('#52e3ff'),10));viewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(payload.center[0],payload.center[1],Math.max(900,24000000/Math.pow(2,payload.zoom-2))),duration:0});const handler=new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);handler.setInputAction(m=>{const c=viewer.camera.pickEllipsoid(m.position,viewer.scene.globe.ellipsoid);if(!c)return;const d=Cesium.Cartographic.fromCartesian(c);send('mapClick',{latitude:Cesium.Math.toDegrees(d.latitude),longitude:Cesium.Math.toDegrees(d.longitude)})},Cesium.ScreenSpaceEventType.LEFT_CLICK);window.myMapBridge={animate:(c)=>viewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(c.longitude,c.latitude,Math.max(500,24000000/Math.pow(2,(c.zoom||15)-2))),duration:(c.duration||700)/1000}),fit:(coords)=>{if(!coords.length)return;const west=Math.min(...coords.map(c=>c.longitude)),east=Math.max(...coords.map(c=>c.longitude)),south=Math.min(...coords.map(c=>c.latitude)),north=Math.max(...coords.map(c=>c.latitude));viewer.camera.flyTo({destination:Cesium.Rectangle.fromDegrees(west,south,east,north),duration:.8})}};ready()})().catch(e=>send('error',{message:String(e&&e.message||e)}));`;
  return shell('CesiumJS 3D', 'https://cesium.com/downloads/cesiumjs/releases/1.145/Build/Cesium/Widgets/widgets.css', 'https://cesium.com/downloads/cesiumjs/releases/1.145/Build/Cesium/Cesium.js', body);
}

export const WebMapEngine = forwardRef<LeafletMapRef, Props>(function WebMapEngine(
  {
    engine,
    currentPosition,
    initialRegion,
    tileProvider = 'osm',
    friends = [],
    todayPoints = [],
    todayRoadRoute,
    showRoute = true,
    destination,
    destinationRoadRoute,
    onMapClick,
    onMapReady,
  },
  ref,
) {
  const webView = useRef<WebView>(null);
  const payload = useMemo<WebPayload>(() => ({
    center: [initialRegion?.longitude ?? currentPosition?.longitude ?? 105.854167, initialRegion?.latitude ?? currentPosition?.latitude ?? 21.028511],
    zoom: initialRegion?.zoom ?? 14,
    tileUrl: tileUrl(tileProvider),
    demUrl: env.mapLibreDemUrl,
    ionToken: env.cesiumIonToken,
    todayRoute: showRoute ? (todayRoadRoute ?? todayPoints.map(point => [point.longitude, point.latitude])) : [],
    destinationRoute: destinationRoadRoute?.map(([latitude, longitude]) => [longitude, latitude]) ?? [],
    current: currentPosition ? [currentPosition.longitude, currentPosition.latitude] : null,
    destination: destination ? [destination.longitude, destination.latitude] : null,
    friends: friends.map(friend => ({ id: friend.id, name: friend.displayName, coordinate: [friend.longitude, friend.latitude] })),
  }), [currentPosition, destination, destinationRoadRoute, friends, initialRegion, showRoute, tileProvider, todayPoints, todayRoadRoute]);
  const html = useMemo(() => engine === 'maplibre_gl' ? mapLibreHtml(payload) : engine === 'openlayers' ? openLayersHtml(payload) : cesiumHtml(payload), [engine, payload]);

  const inject = useCallback((expression: string) => {
    webView.current?.injectJavaScript(`try{${expression}}catch(e){true;}true;`);
  }, []);

  useImperativeHandle(ref, () => ({
    animateToRegion(coords, duration = 700) {
      inject(`window.myMapBridge&&window.myMapBridge.animate(${safeJson({ ...coords, duration })})`);
    },
    centerOnUser() {
      if (currentPosition) inject(`window.myMapBridge&&window.myMapBridge.animate(${safeJson({ ...currentPosition, zoom: 16, duration: 650 })})`);
    },
    fitToCoordinates(coords) {
      inject(`window.myMapBridge&&window.myMapBridge.fit(${safeJson(coords)})`);
    },
  }), [currentPosition, inject]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type?: string; latitude?: number; longitude?: number };
      if (message.type === 'ready') onMapReady?.();
      if (message.type === 'mapClick' && Number.isFinite(message.latitude) && Number.isFinite(message.longitude)) {
        onMapClick?.({ latitude: message.latitude!, longitude: message.longitude! });
      }
    } catch {}
  }, [onMapClick, onMapReady]);

  return <View style={StyleSheet.absoluteFill}>
    <WebView
      ref={webView}
      source={{ html, baseUrl: 'https://app.mymap.local/' }}
      style={styles.webView}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['https://*']}
      mixedContentMode="never"
      setSupportMultipleWindows={false}
      allowsInlineMediaPlayback={false}
      onMessage={onMessage}
      startInLoadingState
      renderLoading={() => <View style={styles.loading}><ActivityIndicator color="#52E3FF" /></View>}
    />
  </View>;
});

const styles = StyleSheet.create({
  webView: { flex: 1, backgroundColor: '#020C24' },
  loading: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#020C24' },
});
