import { Text } from '../ui/Text';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused, useNavigation, useRoute, type CompositeNavigationProp, type RouteProp } from '@react-navigation/native';
import { useBottomTabBarHeight, type BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Platform, StatusBar } from 'react-native';
import type { LeafletTileProvider } from '../components/LeafletMap';
import {
  MAP_RENDERER_ENGINES,
  MAP_RENDERER_LABELS,
  MapRenderer,
  isMapRendererEngine,
  type MapRendererEngine,
  type MapRendererRef,
} from '../components/MapRenderer';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocationPoints, getPhotoPins } from '../db/database';
import { startTracking, stopTracking, isTracking, getBatteryProfile, getTrackingMode, type BatteryProfile, type TrackingMode } from '../services/locationTracking';
import { capturePhotoPin } from '../services/photoPins';
import { supabase } from '../services/supabase';
import { fetchWeather, weatherLabel, type WeatherSnapshot } from '../services/weather';
import { publishLivePresence } from '../services/liveSafety';
import { BrandHeader, glassColors, useResponsiveLayout, type IconName } from '../ui/glass';
import { useAppTheme } from '../ui/theme';
type HomeAction = 'tracking' | 'photo' | 'locate' | null;
type LatLng = { latitude: number; longitude: number };
import { AppHeader } from '../ui/AppHeader';
import { AmbientBackdrop, GlassSurface, GlassButton, IconBadge, ScreenQuote } from '../ui/glass';
import { WeatherCard } from '../ui/WeatherCard';
import { visitsWithinLocalDays } from '../utils/journeyStats';
import { NATIVE_MAPS_ENABLED } from '../config/maps';
import { distanceMeters, formatDateTime } from '../utils/geo';
import { groupPointsByLocalDay, localDayKey } from '../utils/journeyStats';
import type { MainTabsParamList, RootStackParamList } from '../navigation/types';
import type { LocationPoint } from '../types/location';
import type { PhotoPin } from '../types/photo';
import type { CrowdCell } from '../types/safety';
import { searchOpenStreetMap, type OsmSearchResult, POPULAR_SEARCH_SUGGESTIONS } from '../services/openStreetMap';
import { env } from '../config/env';
import {
  getLiveFriends,
  broadcastContinuousPresence,
  detectPartyGroups,
  getMapChatMessages,
  postMapChatMessage,
  sendFriendInteraction,
  subscribeToFriendInteractions,
  subscribeToMapChat,
  type RealtimeFriend,
  type RealtimePartyGroup,
  type MapChatMessage,
  type FriendInteractionEvent,
} from '../services/realtimeFriends';
import { getCurrentSession, getCurrentUser } from '../services/auth';
import {
  startLiveTrip,
  updateLiveTrip,
  endLiveTrip,
  getActiveLiveTrip,
  type LiveTripSession,
} from '../services/liveTripShare';
import { formatBatteryDisplay } from '../services/friendStatus';
import { setFriendGhostMode, type GhostModeLevel } from '../services/ghostMode';
import { FriendDetailModal } from '../components/FriendDetailModal';
import { MapChatModal } from '../components/MapChatModal';
import { BumpModal } from '../components/BumpModal';
import { InteractionWheel } from '../components/InteractionWheel';
import { EmojiBombOverlay } from '../components/EmojiBombOverlay';
import { VoicePingModal } from '../components/VoicePingModal';
import { AchievementsModal } from '../components/AchievementsModal';
import { WrappedStoryModal } from '../components/WrappedStoryModal';
import { TimeCapsuleModal } from '../components/TimeCapsuleModal';
import { ARFinderModal } from '../components/ARFinderModal';
import { RealtimeInteractionsOverlay } from '../components/RealtimeInteractionsOverlay';
import { MusicStatusWidget } from '../components/MusicStatusWidget';
import { LiveTripCard } from '../components/LiveTripCard';
import { updateWidgetSnapshot } from '../services/widgetBridge';
import { downloadCityOfflinePack, PRESET_CITIES } from '../services/offlineMap';
import { Alert } from 'react-native';
import { getMapStories24h, type MapStory } from '../services/mapStories';
import { getUnlockedHexCells, hexToPolygonCoords } from '../services/scratchMap';
import { registerOneTimeArrivalAlert, checkArrivalAlerts } from '../services/destinationPrediction';
import { fetchRoadRoute, matchTraveledRoute } from '../services/roadRouting';
import { getRoadSpeedContext, type RoadSpeedContext, type TravelMode } from '../services/roadSpeedLimit';

type HomeNavigation = CompositeNavigationProp<BottomTabNavigationProp<MainTabsParamList, 'Map'>, NativeStackNavigationProp<RootStackParamList>>;
type MapRouteProp = RouteProp<MainTabsParamList, 'Map'>;
const defaultCenter = { latitude: 21.028511, longitude: 105.854167, latitudeDelta: 0.04, longitudeDelta: 0.04 };

export type TileProvider = LeafletTileProvider;

const TILE_MAP: Record<TileProvider, { label: string }> = {
  stadia_dark: {
    label: 'Bản đồ Tối',
  },
  carto_dark: {
    label: 'Bản đồ Tối',
  },
  osm: {
    label: 'OSM Bright',
  },
  stadia_smooth: {
    label: 'Bản đồ Sáng',
  },
  satellite: {
    label: 'Vệ Tinh Esri',
  },
};

export default function MapScreen() {
  const nav = useNavigation<HomeNavigation>();
  const route = useRoute<MapRouteProp>();
  const r = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0);
  const tabHeight = useBottomTabBarHeight();
  const focused = useIsFocused();
  const mapRef = useRef<MapRendererRef>(null);
  const pendingRef = useRef<HomeAction>(null);
  const placeSearchRequestRef = useRef(0);

  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [photos, setPhotos] = useState<PhotoPin[]>([]);
  const [tracking, setTracking] = useState(false);
  const [trackingMode, setTrackingMode] = useState<TrackingMode | null>(null);
  const [battery, setBattery] = useState<BatteryProfile>('balanced');
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [crowd, setCrowd] = useState<CrowdCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<HomeAction>(null);
  const [expanded, setExpanded] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [showRoute, setShowRoute] = useState(true);
  const [showPhotos, setShowPhotos] = useState(true);
  const [showFriends, setShowFriends] = useState(true);
  const [tileProvider, setTileProvider] = useState<TileProvider>(env.stadiaMapsKey ? 'stadia_dark' : 'osm');
  const [mapEngine, setMapEngine] = useState<MapRendererEngine>('maplibre_native');
  const [foregroundGranted, setForegroundGranted] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<LatLng | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [placeSearchOpen, setPlaceSearchOpen] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<OsmSearchResult[]>([]);
  const [placeSearchBusy, setPlaceSearchBusy] = useState(false);
  const [placeSearchError, setPlaceSearchError] = useState<string | null>(null);
  const [fullscreenMap, setFullscreenMap] = useState(false);
  const [destination, setDestination] = useState<{ latitude: number; longitude: number; name: string } | null>(null);
  const [destinationRoadRoute, setDestinationRoadRoute] = useState<[number, number][] | undefined>(undefined);
  const [destinationRoadInfo, setDestinationRoadInfo] = useState<{ kmStr: string; minutes: number } | null>(null);
  const [todayRoadRoute, setTodayRoadRoute] = useState<[number, number][] | undefined>(undefined);
  const [travelMode, setTravelMode] = useState<TravelMode>('motorbike');
  const [liveSpeedKmh, setLiveSpeedKmh] = useState<number | null>(null);
  const [navigationPosition, setNavigationPosition] = useState<LatLng | null>(null);
  const [roadSpeedContext, setRoadSpeedContext] = useState<RoadSpeedContext | null>(null);
  const [replayActive, setReplayActive] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<1 | 2 | 4>(1);

  // Social & Realtime states
  const [friends, setFriends] = useState<RealtimeFriend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<RealtimeFriend | null>(null);
  const [wheelFriend, setWheelFriend] = useState<RealtimeFriend | null>(null);
  const [footprintsFriend, setFootprintsFriend] = useState<RealtimeFriend | null>(null);
  const [partyGroups, setPartyGroups] = useState<RealtimePartyGroup[]>([]);
  const [mapChatMessages, setMapChatMessages] = useState<MapChatMessage[]>([]);
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [bumpModalOpen, setBumpModalOpen] = useState(false);
  const [mapStories, setMapStories] = useState<MapStory[]>([]);
  const [activeStory, setActiveStory] = useState<MapStory | null>(null);
  const [showScratch, setShowScratch] = useState(false);
  const [scratchHexagons, setScratchHexagons] = useState<[number, number][][]>([]);

  // 4 Feature Groups States (Zenly / Bump Next-Gen)
  const [emojiBombOpen, setEmojiBombOpen] = useState(false);
  const [emojiTargetFriend, setEmojiTargetFriend] = useState<RealtimeFriend | null>(null);
  const [voicePingFriend, setVoicePingFriend] = useState<RealtimeFriend | null>(null);
  const [arFinderFriend, setArFinderFriend] = useState<RealtimeFriend | null>(null);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const [timeCapsuleOpen, setTimeCapsuleOpen] = useState(false);
  const [offlineDownloading, setOfflineDownloading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('me');
  const [incomingInteraction, setIncomingInteraction] = useState<FriendInteractionEvent | null>(null);
  const [liveTripSession, setLiveTripSession] = useState<LiveTripSession | null>(null);
  const lastPresenceRef = useRef<{ latitude: number; longitude: number; sentAt: number } | null>(null);

  useEffect(() => {
    // Safety fallback: Map is ready within 1200ms
    const t = setTimeout(() => setMapLoaded(true), 1200);
    // Request initial position immediately if permission granted
    void Location.getForegroundPermissionsAsync().then(perm => {
      if (perm.granted) {
        setForegroundGranted(true);
        void Location.getLastKnownPositionAsync().then(last => {
          if (last) {
            setCurrentPosition({ latitude: last.coords.latitude, longitude: last.coords.longitude });
          }
          return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }).then(pos => {
          if (pos) {
            setCurrentPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          }
        });
      }
    }).catch(() => {});

    void getCurrentUser().then(user => {
      if (user?.id) setCurrentUserId(user.id);
    });

    void getActiveLiveTrip().then(session => {
      if (session) setLiveTripSession(session);
    });

    return () => clearTimeout(t);
  }, []);

  // Lắng nghe tương tác bạn bè & tin nhắn bản đồ Realtime
  useEffect(() => {
    const unsubInteractions = subscribeToFriendInteractions(currentUserId, event => {
      setIncomingInteraction(event);
    });
    const unsubChat = subscribeToMapChat(newMsg => {
      setMapChatMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [newMsg, ...prev].slice(0, 30);
      });
    });

    return () => {
      if (typeof unsubInteractions === 'function') unsubInteractions();
      if (typeof unsubChat === 'function') unsubChat();
    };
  }, [currentUserId]);

  // Khởi động hoặc cập nhật chuyến đi trực tiếp (Live Trip Session)
  useEffect(() => {
    const originCoord = currentPosition || (points.length > 0 ? points[points.length - 1] : null);
    if (destination && originCoord) {
      void startLiveTrip(
        { name: 'Vị trí hiện tại', latitude: originCoord.latitude, longitude: originCoord.longitude },
        { name: destination.name, latitude: destination.latitude, longitude: destination.longitude },
        liveSpeedKmh || 30
      ).then(session => {
        setLiveTripSession(session);
      });
    } else if (!destination && liveTripSession) {
      void endLiveTrip().then(() => {
        setLiveTripSession(null);
      });
    }
  }, [destination]);

  // Cập nhật tọa độ di chuyển theo thời gian thực cho Live Trip
  useEffect(() => {
    if (liveTripSession?.isActive) {
      const pos = currentPosition || (points.length > 0 ? points[points.length - 1] : null);
      if (pos) {
        void updateLiveTrip(pos.latitude, pos.longitude, liveSpeedKmh || 30).then(updated => {
          if (updated) setLiveTripSession(updated);
        });
      }
    }
  }, [currentPosition, points, liveSpeedKmh]);

  const handleEndLiveTrip = useCallback(async () => {
    await endLiveTrip();
    setLiveTripSession(null);
    setDestination(null);
  }, []);

  useEffect(() => {
    if (route.params?.destination) {
      setDestination(route.params.destination);
      setTravelMode(route.params.travelMode || 'motorbike');
    }
  }, [route.params?.destination, route.params?.travelMode]);

  useEffect(() => {
    const focusFriendId = route.params?.focusFriendId;
    if (!focusFriendId || !friends.length) return;
    const friend = friends.find(item => item.userId === focusFriendId || item.id === focusFriendId);
    if (!friend) return;
    setSelectedFriend(friend);
    mapRef.current?.animateToRegion({ latitude: friend.latitude, longitude: friend.longitude, zoom: 16 }, 650);
    nav.setParams({ focusFriendId: undefined });
  }, [route.params?.focusFriendId, friends, nav]);

  useEffect(() => {
    if (currentPosition) {
      const lastPt = points.length > 0 ? points[points.length - 1] : undefined;
      void updateWidgetSnapshot({
        friendCount: friends.length,
        batteryPercent: 95,
        currentPlaceName: destination?.name || 'Đang khám phá',
        speedKmh: Math.round(lastPt?.speed ? lastPt.speed * 3.6 : 0),
        statusEmoji: '⚡',
      });
    }
  }, [currentPosition, friends.length, destination?.name, points]);

  // Load saved tile preference and migrate away from carto_dark
  useEffect(() => {
    void AsyncStorage.getItem('mymap.tile_provider').then(val => {
      if (val === 'carto_dark' || !val || ((val === 'stadia_dark' || val === 'stadia_smooth') && !env.stadiaMapsKey)) {
        const fallbackProvider = env.stadiaMapsKey ? 'stadia_dark' : 'osm';
        setTileProvider(fallbackProvider);
        void AsyncStorage.setItem('mymap.tile_provider', fallbackProvider).catch(() => {});
      } else if (val === 'osm' || val === 'stadia_dark' || val === 'stadia_smooth' || val === 'satellite') {
        setTileProvider(val as TileProvider);
      }
    });
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem('mymap.map_engine').then(value => {
      if (isMapRendererEngine(value)) setMapEngine(value);
    });
  }, []);

  const changeTileProvider = useCallback(async (tp: TileProvider) => {
    setMapLoaded(false);
    setTileProvider(tp);
    await AsyncStorage.setItem('mymap.tile_provider', tp).catch(() => {});
  }, []);

  const changeMapEngine = useCallback(async (engine: MapRendererEngine) => {
    setMapLoaded(false);
    setMapEngine(engine);
    await AsyncStorage.setItem('mymap.map_engine', engine).catch(() => {});
  }, []);

  const refresh = useCallback(async (active: () => boolean = () => true) => {
    try {
      const [p, m, t, b, permission, activeTrackingMode] = await Promise.all([
        getLocationPoints(),
        getPhotoPins(),
        isTracking(),
        getBatteryProfile(),
        Location.getForegroundPermissionsAsync(),
        getTrackingMode(),
      ]);
      if (!active()) return;
      setPoints(p);
      setPhotos(m);
      setTracking(t);
      setTrackingMode(activeTrackingMode);
      setBattery(b);
      setForegroundGranted(permission.granted);
      setDataError(null);
      if (permission.granted) {
        void Location.getLastKnownPositionAsync()
          .then(last => {
            if (active() && last) setCurrentPosition({ latitude: last.coords.latitude, longitude: last.coords.longitude });
          })
          .catch(() => {});
      }
      void getMapStories24h().then(st => { if (active()) setMapStories(st); }).catch(() => {});
      void getUnlockedHexCells().then(cells => {
        if (active()) {
          const hexs = cells.slice(0, 300).map(c => hexToPolygonCoords(c.q, c.r));
          setScratchHexagons(hexs);
        }
      }).catch(() => {});
    } catch {
      if (active()) setDataError('Không thể tải hành trình. Chạm nút thử lại.');
    } finally {
      if (active()) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void refresh(() => active);
      const timer = setInterval(() => void refresh(() => active), 20000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [refresh])
  );

  const latestPoint = points[points.length - 1];
  const latestPhoto = photos[photos.length - 1];

  // Keep the navigation speed bubble live without requiring background tracking.
  useEffect(() => {
    if (!destination) {
      setLiveSpeedKmh(null);
      setNavigationPosition(null);
      setRoadSpeedContext(null);
      return;
    }

    let active = true;
    let subscription: Location.LocationSubscription | null = null;
    void Location.getForegroundPermissionsAsync()
      .then(async permission => {
        if (!active || !permission.granted) return;
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1200,
            distanceInterval: 2,
          },
          location => {
            if (!active) return;
            const nextSpeed = Math.max(0, (location.coords.speed ?? 0) * 3.6);
            setLiveSpeedKmh(previous => {
              const normalized = nextSpeed < 2 ? 0 : nextSpeed;
              return previous === null ? normalized : previous * 0.4 + normalized * 0.6;
            });
            setNavigationPosition({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });
          }
        );
      })
      .catch(() => {});

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [Boolean(destination)]);

  const roadLookupKey = navigationPosition
    ? `${navigationPosition.latitude.toFixed(3)},${navigationPosition.longitude.toFixed(3)}`
    : currentPosition
    ? `${currentPosition.latitude.toFixed(3)},${currentPosition.longitude.toFixed(3)}`
    : latestPoint
    ? `${latestPoint.latitude.toFixed(3)},${latestPoint.longitude.toFixed(3)}`
    : null;

  const routeOrigin = useMemo(() => {
    if (!roadLookupKey) return null;
    const [latitude, longitude] = roadLookupKey.split(',').map(Number);
    return { latitude: latitude!, longitude: longitude! };
  }, [roadLookupKey]);

  useEffect(() => {
    if (!destination || !roadLookupKey) {
      setRoadSpeedContext(null);
      return;
    }
    const [lat, lon] = roadLookupKey.split(',').map(Number);
    let active = true;
    void getRoadSpeedContext(lat!, lon!, travelMode).then(context => {
      if (active) setRoadSpeedContext(context);
    });
    return () => {
      active = false;
    };
  }, [Boolean(destination), roadLookupKey, travelMode]);

  // Realtime friends, Continuous Presence & Map Chat loop (every 4s)
  useEffect(() => {
    let active = true;
    const runRealtimeSync = async () => {
      const pos = currentPosition || latestPoint;
      try {
        const [f, c] = await Promise.all([
          getLiveFriends(pos),
          getMapChatMessages(),
        ]);
        if (!active) return;
        setFriends(f);
        setMapChatMessages(c);
        setPartyGroups(detectPartyGroups(f, pos));

        void checkArrivalAlerts(f, w => {
          alert(`🔔 ${w.friendName} đã đến đích (${w.destinationName})!`);
        });

        if (pos) {
          const previousPresence = lastPresenceRef.current;
          const shouldBroadcast = !previousPresence
            || Date.now() - previousPresence.sentAt > 30_000
            || distanceMeters(previousPresence, pos) >= 15;
          if (!shouldBroadcast) return;
          lastPresenceRef.current = { latitude: pos.latitude, longitude: pos.longitude, sentAt: Date.now() };
          void broadcastContinuousPresence({
            latitude: pos.latitude,
            longitude: pos.longitude,
            heading: latestPoint?.heading,
            speedMps: latestPoint?.speed,
          });
        }
      } catch {}
    };

    void runRealtimeSync();
    const interval = setInterval(() => {
      if (active && focused) void runRealtimeSync();
    }, destination ? 6000 : 12000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [focused, currentPosition?.latitude, currentPosition?.longitude, latestPoint?.timestamp, Boolean(destination)]);

  useEffect(() => {
    if (!latestPoint || !focused) return;
    let active = true;
    const latest = latestPoint;
    const run = async () => {
      try {
        const session = await getCurrentSession();
        if (!session || !active) return;
        const [w, c] = await Promise.allSettled([
          fetchWeather(latest.latitude, latest.longitude),
          publishLivePresence({ latitude: latest.latitude, longitude: latest.longitude, accuracy_m: latest.accuracy }),
        ]);
        if (!active) return;
        if (w.status === 'fulfilled') setWeather(w.value);
        if (c.status === 'fulfilled') setCrowd(c.value);
      } catch {}
    };
    void run();
    return () => {
      active = false;
    };
  }, [latestPoint?.timestamp, focused]);

  const today = localDayKey(Date.now());
  const todayPoints = useMemo(() => groupPointsByLocalDay(points).get(today) || [], [points, today]);

  // 1. Nắn các điểm GPS di chuyển hôm nay khớp hoàn hảo vào đường phố thực tế
  useEffect(() => {
    let active = true;
    if (todayPoints.length < 2) {
      setTodayRoadRoute(undefined);
      return;
    }
    void matchTraveledRoute(todayPoints).then(snapped => {
      if (active && snapped && snapped.length > 1) {
        setTodayRoadRoute(snapped);
      }
    });
    return () => {
      active = false;
    };
  }, [todayPoints]);

  // 2. Tính toán đường dẫn bộ chính xác theo mạng lưới giao thông tới điểm đến (thay vì vẽ đường thẳng chim bay)
  useEffect(() => {
    let active = true;
    const origin = routeOrigin;
    if (!destination || !origin) {
      setDestinationRoadRoute(undefined);
      setDestinationRoadInfo(null);
      return;
    }

    void fetchRoadRoute(origin, destination, travelMode).then(res => {
      if (!active) return;
      if (res && res.coordinates.length > 1) {
        setDestinationRoadRoute(res.coordinates);
        const kmStr = (res.distanceMeters / 1000).toLocaleString('vi-VN', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        });
        const minutes = Math.max(1, Math.round(res.durationSeconds / 60));
        setDestinationRoadInfo({ kmStr, minutes });
      } else {
        setDestinationRoadRoute(undefined);
        setDestinationRoadInfo(null);
      }
    });

    return () => {
      active = false;
    };
  }, [
    destination?.latitude,
    destination?.longitude,
    routeOrigin?.latitude,
    routeOrigin?.longitude,
    travelMode,
  ]);

  useEffect(() => {
    if (!replayPlaying || !todayPoints.length) return;
    const interval = setInterval(() => {
      setReplayIndex(curr => {
        if (curr >= todayPoints.length - 1) {
          setReplayPlaying(false);
          return curr;
        }
        const next = curr + 1;
        const pt = todayPoints[next];
        if (pt && mapRef.current) {
          mapRef.current.animateToRegion(
            {
              latitude: pt.latitude,
              longitude: pt.longitude,
              zoom: 16,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            }
          );
        }
        return next;
      });
    }, 750 / replaySpeed);
    return () => clearInterval(interval);
  }, [replayPlaying, todayPoints, replaySpeed]);

  const region = useMemo(() => {
    if (destination) {
      return { latitude: destination.latitude, longitude: destination.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 };
    }
    const latest = latestPhoto && (!latestPoint || latestPhoto.capturedAt > latestPoint.timestamp) ? latestPhoto : latestPoint;
    const center = currentPosition || latest;
    return center ? { latitude: center.latitude, longitude: center.longitude, latitudeDelta: 0.035, longitudeDelta: 0.035 } : defaultCenter;
  }, [destination, currentPosition, latestPoint, latestPhoto]);

  useEffect(() => {
    if (destination && mapRef.current) {
      const origin = routeOrigin;
      if (destinationRoadRoute && destinationRoadRoute.length > 1) {
        const step = Math.max(1, Math.floor(destinationRoadRoute.length / 20));
        const sampleCoords: { latitude: number; longitude: number }[] = [];
        for (let i = 0; i < destinationRoadRoute.length; i += step) {
          const pt = destinationRoadRoute[i]!;
          sampleCoords.push({ latitude: pt[0], longitude: pt[1] });
        }
        const last = destinationRoadRoute[destinationRoadRoute.length - 1]!;
        sampleCoords.push({ latitude: last[0], longitude: last[1] });

        mapRef.current.fitToCoordinates(sampleCoords, {
          edgePadding: { top: 140, right: 80, bottom: tabHeight + 120, left: 80 },
          animated: true,
        });
      } else if (origin) {
        mapRef.current.fitToCoordinates(
          [
            { latitude: origin.latitude, longitude: origin.longitude },
            { latitude: destination.latitude, longitude: destination.longitude },
          ],
          {
            edgePadding: { top: 140, right: 80, bottom: tabHeight + 120, left: 80 },
            animated: true,
          }
        );
      } else {
        mapRef.current.animateToRegion(
          {
            latitude: destination.latitude,
            longitude: destination.longitude,
            zoom: 16,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          },
          500
        );
      }
    }
  }, [destination, destinationRoadRoute, routeOrigin, tabHeight]);

  const routeDistance = useMemo(() => {
    if (destinationRoadInfo) {
      return `${destinationRoadInfo.kmStr} km đường bộ · ~${destinationRoadInfo.minutes} phút`;
    }
    const origin = navigationPosition || currentPosition || latestPoint;
    if (!origin || !destination) return null;
    const meters = distanceMeters(origin, destination);
    return `${(meters / 1000).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
  }, [destinationRoadInfo, navigationPosition, currentPosition, latestPoint, destination]);

  async function performAction(action: Exclude<HomeAction, null>, work: () => Promise<void>) {
    if (pendingRef.current) return;
    pendingRef.current = action;
    setPending(action);
    setActionError(null);
    try {
      await work();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Không thể thực hiện. Vui lòng thử lại.');
    } finally {
      pendingRef.current = null;
      setPending(null);
    }
  }

  function toggleTracking() {
    void performAction('tracking', async () => {
      if (tracking) {
        await stopTracking();
        setTrackingMode(null);
      } else {
        const result = await startTracking();
        setTrackingMode(result.mode);
      }
      await refresh();
    });
  }

  function takePhoto() {
    void performAction('photo', async () => {
      const id = await capturePhotoPin();
      if (id !== null) {
        await refresh();
        nav.navigate('MemoryDetail', { photoId: id });
      }
    });
  }

  function locate() {
    void performAction('locate', async () => {
      if (!(await Location.hasServicesEnabledAsync())) throw new Error('Hãy bật dịch vụ vị trí để tìm bạn trên bản đồ.');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Cần quyền vị trí để đưa bản đồ về nơi bạn đang đứng.');
      setForegroundGranted(true);
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const next = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      setCurrentPosition(next);
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: next.latitude,
            longitude: next.longitude,
            zoom: 16,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          }
        );
      }
    });
  }

  async function manualRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  async function searchPlaces(text = placeQuery, allowNominatim = true) {
    const q = text.trim();
    if (!q) return;
    const requestId = ++placeSearchRequestRef.current;
    setPlaceSearchBusy(true);
    setPlaceSearchError(null);
    try {
      const userCoords = currentPosition || latestPoint;
      const results = await searchOpenStreetMap(q, 12, userCoords, { allowNominatim });
      if (requestId !== placeSearchRequestRef.current) return;
      setPlaceResults(results);
      if (!results.length) {
        setPlaceSearchError('Không tìm thấy địa điểm nào phù hợp.');
      }
    } catch {
      if (requestId !== placeSearchRequestRef.current) return;
      setPlaceSearchError('Không thể tìm kiếm lúc này. Vui lòng thử lại sau.');
    } finally {
      if (requestId === placeSearchRequestRef.current) setPlaceSearchBusy(false);
    }
  }

  // Debounced live search as user types
  useEffect(() => {
    if (!placeSearchOpen) return;
    const q = placeQuery.trim();
    if (q.length < 2) {
      setPlaceResults([]);
      setPlaceSearchError(null);
      return;
    }
    const timer = setTimeout(() => {
      void searchPlaces(q, false);
    }, 450);
    return () => clearTimeout(timer);
  }, [placeQuery, placeSearchOpen]);

  function getPlaceIcon(item: OsmSearchResult): IconName {
    const t = (item.type || item.category || '').toLowerCase();
    if (t.includes('cafe') || t.includes('coffee')) return 'coffee';
    if (t.includes('food') || t.includes('restaurant') || t.includes('marketplace')) return 'silverware-fork-knife';
    if (t.includes('beach')) return 'beach';
    if (t.includes('bridge')) return 'bridge';
    if (t.includes('park') || t.includes('water')) return 'pine-tree';
    if (t.includes('city') || t.includes('town') || t.includes('administrative')) return 'city-variant-outline';
    if (t.includes('hotel') || t.includes('tourism')) return 'bed';
    return 'map-marker';
  }

  function selectPlace(res: OsmSearchResult) {
    placeSearchRequestRef.current += 1;
    setPlaceSearchOpen(false);
    setPlaceQuery('');
    setPlaceResults([]);
    setDestination({
      latitude: res.latitude,
      longitude: res.longitude,
      name: res.displayName.split(',')[0] || res.displayName,
    });
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: res.latitude,
          longitude: res.longitude,
          zoom: 16,
          latitudeDelta: 0.018,
          longitudeDelta: 0.018,
        }
      );
    }
  }

  const totals = useMemo(() => {
    const visits = visitsWithinLocalDays(points);
    const dayKeys = new Set<string>();
    for (const p of points) dayKeys.add(localDayKey(p.timestamp));
    for (const m of photos) dayKeys.add(localDayKey(m.capturedAt));
    return { visits, photos: photos.length, days: dayKeys.size };
  }, [points, photos]);

  const mapHeight = r.isWide ? 460 : 340;
  const error = dataError || actionError;

  return (
    <View style={s.root}>
      <AmbientBackdrop />

      {NATIVE_MAPS_ENABLED && (
        <MapRenderer
          ref={mapRef}
          engine={mapEngine}
          currentPosition={navigationPosition || currentPosition || latestPoint || null}
          initialRegion={{
            latitude: region.latitude,
            longitude: region.longitude,
            zoom: 14,
          }}
          tileProvider={tileProvider}
          friends={showFriends ? friends : []}
          photos={showPhotos ? photos : []}
          partyGroups={partyGroups}
          mapChatMessages={mapChatMessages}
          todayPoints={todayPoints}
          todayRoadRoute={todayRoadRoute}
          showRoute={showRoute}
          destination={destination}
          destinationRoadRoute={destinationRoadRoute}
          footprintsFriend={footprintsFriend}
          scratchHexagons={showScratch ? scratchHexagons : undefined}
          onFriendPress={f => setWheelFriend(f)}
          onMapClick={() => {
            if (expanded) setExpanded(false);
          }}
          onMapReady={() => setMapLoaded(true)}
        />
      )}

      {/* Light gradient overlay for maximum tile readability */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(3,17,51,.25)', 'transparent', 'rgba(3,17,51,.35)']}
        style={[StyleSheet.absoluteFill, s.mapShade]}
      />

      {destination && (
        <GlassSurface style={[s.routeBanner, { top: insets.top + 8 }]}>
          <IconBadge name="navigation-variant" size={20} diameter={36} tone="cyan" />
          <View style={s.routeBannerCopy}>
            <Text style={s.routeBannerTitle} numberOfLines={1}>
              Chỉ đường: {destination.name}
            </Text>
            <Text style={s.routeBannerSub}>
              {routeDistance ? `${routeDistance} từ vị trí của bạn` : 'Đang tính lộ trình đường bộ…'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Phương tiện: ${travelMode === 'motorbike' ? 'xe máy' : 'ô tô'}. Chạm để đổi.`}
            onPress={() => setTravelMode(mode => (mode === 'motorbike' ? 'car' : 'motorbike'))}
            style={s.travelModeButton}
          >
            <MaterialCommunityIcons name={travelMode === 'motorbike' ? 'motorbike' : 'car'} size={17} color="#7BE8FF" />
            <Text style={s.travelModeText}>{travelMode === 'motorbike' ? 'Xe máy' : 'Ô tô'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng chỉ đường" onPress={() => setDestination(null)} style={s.closeRoute}>
            <MaterialCommunityIcons name="close" size={22} color="#DCEEFF" />
          </Pressable>
        </GlassSurface>
      )}

      {destination && travelMode === 'motorbike' && (
        <GlassSurface
          style={[
            s.navigationSpeedBubble,
            { bottom: tabHeight + (replayActive ? 86 : 18) },
          ]}
        >
          <View style={s.currentSpeedCircle}>
            <Text style={[
              s.currentSpeedValue,
              (liveSpeedKmh ?? 0) > (roadSpeedContext?.speedLimitKmh ?? 60) && s.currentSpeedOver,
            ]}>
              {Math.round(liveSpeedKmh ?? Math.max(0, (latestPoint?.speed ?? 0) * 3.6))}
            </Text>
            <Text style={s.speedUnit}>km/h</Text>
          </View>
          <View style={s.limitSign}>
            <Text style={s.limitValue}>{roadSpeedContext?.speedLimitKmh ?? 60}</Text>
            <Text style={s.limitCaption}>TỐI ĐA</Text>
          </View>
          <View style={s.speedRoadCopy}>
            <Text style={s.speedRoadTitle} numberOfLines={1}>
              {roadSpeedContext?.roadName || 'Đoạn đường hiện tại'}
            </Text>
            <Text style={s.speedRoadMeta} numberOfLines={1}>
              {roadSpeedContext
                ? `${roadSpeedContext.isBuiltUp ? 'Khu đông dân cư' : 'Ngoài khu đông dân cư'} · ${roadSpeedContext.isDivided ? 'Có dải phân cách' : 'Không có dải phân cách'}`
                : 'Đang nhận diện đoạn đường…'}
            </Text>
            <Text style={s.speedEstimateNote} numberOfLines={1}>
              {roadSpeedContext?.source === 'osm' ? 'Theo dữ liệu biển báo OSM' : 'Giới hạn ước tính · ưu tiên biển báo thực tế'}
            </Text>
          </View>
        </GlassSurface>
      )}

      {/* Real-time Live Trip Floating Card */}
      {liveTripSession && liveTripSession.isActive && (
        <LiveTripCard
          session={liveTripSession}
          onEndTrip={handleEndLiveTrip}
          style={[
            s.liveTripCardFixed,
            { bottom: tabHeight + (destination && travelMode === 'motorbike' ? 116 : (replayActive ? 86 : 20)) },
          ]}
        />
      )}

      {fullscreenMap ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <View style={[s.fullscreenTopBar, { top: insets.top + 8 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tìm địa điểm"
              onPress={() => setPlaceSearchOpen(true)}
              style={s.fullscreenSearch}
            >
              <MaterialCommunityIcons name="magnify" size={22} color={glassColors.cyan} />
              <Text style={s.fullscreenSearchText} numberOfLines={1}>
                Tìm địa điểm…
              </Text>
            </Pressable>
          </View>

          <View style={[s.fullscreenTools, { top: insets.top + 70 }]}>
            <SideTool icon="arrow-collapse" label="Bảng tin" tone="cyan" onPress={() => setFullscreenMap(false)} />
            <MapControl icon="crosshairs-gps" label="Về vị trí hiện tại" pending={pending === 'locate'} disabled={!!pending} onPress={locate} />
            <SideTool icon="alert-octagon" label="Khẩn cấp SOS" tone="rose" onPress={() => nav.navigate('SOS')} />
            <SideTool icon={toolsExpanded ? 'close' : 'dots-horizontal'} label={toolsExpanded ? 'Thu gọn công cụ' : 'Mở thêm công cụ'} tone="blue" onPress={() => { setToolsExpanded(v => !v); if (toolsExpanded) setExpanded(false); }} />
            {toolsExpanded && <>
              <SideTool icon="cellphone-nfc" label="Cụng máy" tone="yellow" onPress={() => setBumpModalOpen(true)} />
              <SideTool icon="chat-processing-outline" label="Ghim tin" tone="violet" onPress={() => setChatModalOpen(true)} />
              <SideTool icon="trophy-award" label="Huy hiệu" tone="yellow" onPress={() => setAchievementsOpen(true)} />
              <SideTool icon="star-face" label="Recap tuần" tone="violet" onPress={() => setWrappedOpen(true)} />
              <SideTool icon="timer-sand" label="Viên nang" tone="cyan" onPress={() => setTimeCapsuleOpen(true)} />
              <MusicStatusWidget />
              {NATIVE_MAPS_ENABLED && (
                <Pressable accessibilityRole="button" accessibilityLabel="Mở lớp bản đồ" onPress={() => setExpanded(v => !v)} style={s.control}>
                  <MaterialCommunityIcons name="layers-outline" size={21} color="#B8C8D6" />
                </Pressable>
              )}
            </>}
          </View>

          {expanded && NATIVE_MAPS_ENABLED && (
            <GlassSurface style={[s.layerPanel, { position: 'absolute', right: 70, top: insets.top + 140, width: 230 }]}>
              <LayerChoice label="Bạn bè realtime" value={showFriends} onChange={() => setShowFriends(v => !v)} />
              <LayerChoice label="Tuyến đường" value={showRoute} onChange={() => setShowRoute(v => !v)} />
              <LayerChoice label="Ghim kỷ niệm" value={showPhotos} onChange={() => setShowPhotos(v => !v)} />
              <LayerChoice label="Lớp cào bản đồ (Scratch)" value={showScratch} onChange={() => setShowScratch(v => !v)} />
              <View style={s.tileSelectBox}>
                <Text style={s.tileSelectLabel}>Engine hiển thị:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 4 }}>
                  {MAP_RENDERER_ENGINES.map(engine => (
                    <Pressable key={engine} onPress={() => void changeMapEngine(engine)} style={[s.tileBtn, mapEngine === engine && s.tileBtnActive]}>
                      <Text style={[s.tileBtnText, mapEngine === engine && s.tileBtnTextActive]}>{MAP_RENDERER_LABELS[engine]}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <View style={s.tileSelectBox}>
                <Text style={s.tileSelectLabel}>Lớp bản đồ:</Text>
                {(['stadia_dark', 'osm', 'stadia_smooth', 'satellite'] as const).map(tp => (
                  <Pressable key={tp} onPress={() => void changeTileProvider(tp)} style={[s.tileBtn, tileProvider === tp && s.tileBtnActive]}>
                    <Text style={[s.tileBtnText, tileProvider === tp && s.tileBtnTextActive]}>{TILE_MAP[tp].label}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={async () => {
                  setOfflineDownloading(true);
                  try {
                    await downloadCityOfflinePack('hanoi');
                    Alert.alert('Thành công', 'Đã tải gói bản đồ ngoại tuyến Hà Nội!');
                  } catch {
                    Alert.alert('Lỗi', 'Không thể tải gói bản đồ.');
                  } finally {
                    setOfflineDownloading(false);
                  }
                }}
                style={[s.tileBtn, { marginTop: 6, backgroundColor: 'rgba(69,235,192,0.15)', borderColor: '#45EBC0' }]}
              >
                <Text style={[s.tileBtnText, { color: '#45EBC0', fontWeight: '800' }]}>
                  {offlineDownloading ? 'Đang tải gói…' : '📥 Tải bản đồ ngoại tuyến'}
                </Text>
              </Pressable>
            </GlassSurface>
          )}

          <Pressable onPress={() => setFullscreenMap(false)} style={[s.exitFullscreenBtn, { bottom: tabHeight + 16 }]}>
            <GlassSurface style={s.exitFullscreenInner}>
              <MaterialCommunityIcons name="view-dashboard-outline" size={18} color="#7BE8FF" />
              <Text style={s.exitFullscreenText}>Hiện bảng điều khiển</Text>
            </GlassSurface>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={s.foreground}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: topInset, paddingBottom: tabHeight + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void manualRefresh()} tintColor={glassColors.cyan} colors={[glassColors.cyan]} />}
        >
          <View style={[s.content, { paddingHorizontal: r.gutter, maxWidth: r.maxContent }]}>
            <AppHeader searchLabel="Tìm địa điểm trên OpenStreetMap" onSearch={() => setPlaceSearchOpen(true)} />
            <WeatherCard
              weather={weather}
              place={latestPoint ? 'Tại điểm GPS gần nhất' : 'Vị trí của bạn'}
              unavailable={latestPoint ? 'Thời tiết chưa khả dụng' : 'Ghi vị trí để xem thời tiết'}
            />

            {/* 24h Map Stories Highlights */}
            {mapStories.length > 0 && (
              <View style={s.storiesBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.storiesScroll}>
                  {mapStories.map(story => (
                    <Pressable
                      key={story.id}
                      accessibilityRole="button"
                      accessibilityLabel={story.title}
                      onPress={() => {
                        setActiveStory(story);
                        if (mapRef.current) {
                          mapRef.current.animateToRegion({
                            latitude: story.latitude,
                            longitude: story.longitude,
                            zoom: 15,
                          });
                        }
                      }}
                      style={s.storyPill}
                    >
                      <View style={s.storyRing}>
                        <View style={s.storyAvatarInner}>
                          <Text style={s.storyEmoji}>{story.emoji}</Text>
                        </View>
                      </View>
                      <Text style={s.storyTitle} numberOfLines={1}>
                        {story.title}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <View pointerEvents="box-none" style={[s.mapSpace, { height: mapHeight }]}>
              {(!NATIVE_MAPS_ENABLED || !mapLoaded) && (
                <View pointerEvents="none" style={s.mapFallback}>
                  <MaterialCommunityIcons name="map-outline" size={16} color={glassColors.cyan} />
                  <Text style={s.mapFallbackText}>Đang tải bản đồ…</Text>
                </View>
              )}

              {/* Online Friends pill count */}
              {friends.length > 0 && (
                <Pressable onPress={() => setFullscreenMap(true)} style={s.friendsOnlinePill}>
                  <View style={s.greenDot} />
                  <Text style={s.friendsOnlineText}>{friends.filter(friend => friend.isOnline !== false).length} online · {friends.length} trên bản đồ</Text>
                </Pressable>
              )}

              <View style={s.mapTools}>
                <SideTool icon="arrow-expand" label="Bản đồ toàn màn hình" tone="cyan" onPress={() => setFullscreenMap(true)} />
                <MapControl icon="crosshairs-gps" label="Về vị trí hiện tại" pending={pending === 'locate'} disabled={!!pending} onPress={locate} />
                <SideTool icon="alert-octagon" label="Khẩn cấp SOS" tone="rose" onPress={() => nav.navigate('SOS')} />
                <SideTool icon={toolsExpanded ? 'close' : 'dots-horizontal'} label={toolsExpanded ? 'Thu gọn công cụ' : 'Mở thêm công cụ'} tone="blue" onPress={() => { setToolsExpanded(v => !v); if (toolsExpanded) setExpanded(false); }} />
                {toolsExpanded && <>
                  <SideTool icon="cellphone-nfc" label="Cụng máy kết bạn" tone="yellow" onPress={() => setBumpModalOpen(true)} />
                  <SideTool icon="chat-processing-outline" label="Ghim tin nhắn" tone="violet" onPress={() => setChatModalOpen(true)} />
                  <SideTool icon="trophy-award" label="Huy hiệu" tone="yellow" onPress={() => setAchievementsOpen(true)} />
                  <SideTool icon="star-face" label="Recap tuần" tone="violet" onPress={() => setWrappedOpen(true)} />
                  <SideTool icon="timer-sand" label="Viên nang" tone="cyan" onPress={() => setTimeCapsuleOpen(true)} />
                  <MusicStatusWidget />
                  {todayPoints.length > 1 && (
                    <SideTool
                      icon="play-circle-outline"
                      label="Phát lại hôm nay"
                      tone="mint"
                      onPress={() => {
                        setReplayIndex(0);
                        setReplayActive(true);
                        setReplayPlaying(true);
                      }}
                    />
                  )}
                  {NATIVE_MAPS_ENABLED && (
                    <Pressable accessibilityRole="button" accessibilityLabel="Mở lớp bản đồ" onPress={() => setExpanded(v => !v)} style={s.control}>
                      <MaterialCommunityIcons name="layers-outline" size={21} color="#B8C8D6" />
                    </Pressable>
                  )}
                </>}
              </View>
            </View>

            {expanded && NATIVE_MAPS_ENABLED && (
              <GlassSurface style={s.layerPanel}>
                <LayerChoice label="Bạn bè realtime" value={showFriends} onChange={() => setShowFriends(v => !v)} />
                <LayerChoice label="Tuyến đường hôm nay" value={showRoute} onChange={() => setShowRoute(v => !v)} />
                <LayerChoice label="Ghim kỷ niệm" value={showPhotos} onChange={() => setShowPhotos(v => !v)} />
                <LayerChoice label="Lớp cào bản đồ (Scratch)" value={showScratch} onChange={() => setShowScratch(v => !v)} />
                <View style={s.tileSelectBox}>
                  <Text style={s.tileSelectLabel}>Engine hiển thị:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 4 }}>
                    {MAP_RENDERER_ENGINES.map(engine => (
                      <Pressable key={engine} onPress={() => void changeMapEngine(engine)} style={[s.tileBtn, mapEngine === engine && s.tileBtnActive]}>
                        <Text style={[s.tileBtnText, mapEngine === engine && s.tileBtnTextActive]}>{MAP_RENDERER_LABELS[engine]}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
                <View style={s.tileSelectBox}>
                  <Text style={s.tileSelectLabel}>Lớp bản đồ:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 4 }}>
                    {(['stadia_dark', 'osm', 'stadia_smooth', 'satellite'] as const).map(tp => (
                      <Pressable key={tp} onPress={() => void changeTileProvider(tp)} style={[s.tileBtn, tileProvider === tp && s.tileBtnActive]}>
                        <Text style={[s.tileBtnText, tileProvider === tp && s.tileBtnTextActive]}>{TILE_MAP[tp].label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
                <Pressable
                  onPress={async () => {
                    setOfflineDownloading(true);
                    try {
                      await downloadCityOfflinePack('hanoi');
                      Alert.alert('Thành công', 'Đã tải gói bản đồ ngoại tuyến Hà Nội!');
                    } catch {
                      Alert.alert('Lỗi', 'Không thể tải gói bản đồ.');
                    } finally {
                      setOfflineDownloading(false);
                    }
                  }}
                  style={[s.tileBtn, { marginTop: 6, backgroundColor: 'rgba(69,235,192,0.15)', borderColor: '#45EBC0' }]}
                >
                  <Text style={[s.tileBtnText, { color: '#45EBC0', fontWeight: '800' }]}>
                    {offlineDownloading ? 'Đang tải gói…' : '📥 Tải bản đồ ngoại tuyến'}
                  </Text>
                </Pressable>
              </GlassSurface>
            )}

            {error && (
              <GlassSurface tone="rose" style={s.error}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#FF9BB6" />
                <Text style={s.errorText}>{error}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Thử tải lại" onPress={() => void manualRefresh()} style={s.retry}>
                  <MaterialCommunityIcons name="refresh" size={24} color="#FFD0DE" />
                </Pressable>
              </GlassSurface>
            )}

            <GlassSurface style={s.summary}>
              <HomeStat icon="map-marker" value={loading ? '—' : totals.visits} label="Địa điểm đã đến" onPress={() => nav.navigate('Timeline')} />
              <View style={s.divider} />
              <HomeStat icon="image" value={loading ? '—' : totals.photos} label="Kỷ niệm đã lưu" onPress={() => nav.navigate('Memories')} />
              <View style={s.divider} />
              <HomeStat icon="calendar-month" tone="violet" value={loading ? '—' : totals.days} label="Ngày khám phá" onPress={() => nav.navigate('Heatmap')} />
            </GlassSurface>

            <View style={s.actions}>
              <GlassButton
                style={s.action}
                tone={tracking ? 'red' : 'blue'}
                disabled={loading || !!pending}
                onPress={toggleTracking}
                accessibilityLabel={tracking ? 'Dừng ghi hành trình' : 'Bắt đầu ghi hành trình'}
              >
                <View style={s.actionRow}>
                  <IconBadge name={tracking ? 'stop' : 'navigation-variant'} size={24} diameter={35} />
                  <View style={s.actionCopy}>
                    <Text style={s.actionTitle}>
                      {pending === 'tracking' ? 'Đang xử lý…' : tracking ? 'Dừng ghi hành trình' : 'Bắt đầu ghi hành trình'}
                    </Text>
                    <Text style={s.actionSubtitle}>{tracking ? trackingMode === 'background' ? 'Đang ghi cả khi chạy nền' : 'Đang ghi khi ứng dụng mở' : 'Lưu ngay từ điểm bắt đầu'}</Text>
                  </View>
                </View>
              </GlassButton>
              <GlassButton style={s.action} tone="purple" disabled={!!pending} onPress={takePhoto} accessibilityLabel="Tạo kỷ niệm mới">
                <View style={s.actionRow}>
                  <IconBadge name="camera" tone="violet" size={24} diameter={35} />
                  <View style={s.actionCopy}>
                    <Text style={s.actionTitle}>{pending === 'photo' ? 'Đang mở…' : 'Tạo kỷ niệm mới'}</Text>
                    <Text style={s.actionSubtitle}>Chụp, ghi chú, lưu vị trí</Text>
                  </View>
                </View>
              </GlassButton>
            </View>

            <Text style={s.status}>
              {loading
                ? 'Đang đọc dữ liệu trên thiết bị…'
                : tracking
                ? trackingMode === 'background'
                  ? '● Đang ghi nền · điểm đầu tiên đã được lưu'
                  : '● Đang ghi trong ứng dụng · cấp quyền nền để ghi khi đóng app'
                : points.length
                ? 'Đã dừng ghi · Dữ liệu lưu trên thiết bị'
                : 'Chưa ghi hành trình · Dữ liệu lưu trên thiết bị'}
            </Text>
          </View>
        </ScrollView>
      )}

      {replayActive && todayPoints.length > 0 && (
        <GlassSurface style={[s.replayBar, { bottom: tabHeight + 14 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={replayPlaying ? 'Tạm dừng phát lại' : 'Tiếp tục phát lại'}
            onPress={() => setReplayPlaying(v => !v)}
            style={s.replayPlayBtn}
          >
            <MaterialCommunityIcons name={replayPlaying ? 'pause' : 'play'} size={22} color="#fff" />
          </Pressable>
          <View style={s.replayInfo}>
            <Text style={s.replayTime}>
              {todayPoints[replayIndex] ? formatDateTime(todayPoints[replayIndex]!.timestamp) : '—'}
            </Text>
            <Text style={s.replayProgress}>
              Điểm {replayIndex + 1} / {todayPoints.length} · Di chuyển
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đổi tốc độ phát lại"
            onPress={() => setReplaySpeed(v => (v === 1 ? 2 : v === 2 ? 4 : 1))}
            style={s.speedBtn}
          >
            <Text style={s.speedText}>{replaySpeed}x</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng phát lại"
            onPress={() => {
              setReplayPlaying(false);
              setReplayActive(false);
            }}
            style={s.closeReplayBtn}
          >
            <MaterialCommunityIcons name="close" size={20} color="#DCEEFF" />
          </Pressable>
        </GlassSurface>
      )}

      {/* Place search modal */}
      <Modal visible={placeSearchOpen} transparent animationType="fade" onRequestClose={() => { placeSearchRequestRef.current += 1; setPlaceSearchOpen(false); }}>
        <View style={s.searchOverlay}>
          <GlassSurface style={s.searchDialog}>
            <View style={s.searchHead}>
              <View style={s.searchCopy}>
                <Text style={s.searchTitle}>Tìm địa điểm</Text>
                <Text style={s.searchHint}>Tìm nhanh địa danh, toà nhà, đường phố trên bản đồ</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Đóng tìm kiếm" onPress={() => { placeSearchRequestRef.current += 1; setPlaceSearchOpen(false); }} style={s.searchClose}>
                <MaterialCommunityIcons name="close" size={22} color="#DCEEFF" />
              </Pressable>
            </View>

            <View style={s.searchBar}>
              <View style={s.searchInputWrapper}>
                <MaterialCommunityIcons name="magnify" size={20} color={glassColors.faint} style={s.searchIconLead} />
                <TextInput
                  accessibilityLabel="Ô nhập tìm địa điểm"
                  value={placeQuery}
                  onChangeText={setPlaceQuery}
                  placeholder="Hồ Gươm, Landmark 81, Đà Nẵng..."
                  placeholderTextColor={glassColors.faint}
                  style={s.searchInput}
                  onSubmitEditing={() => void searchPlaces()}
                  returnKeyType="search"
                  autoFocus
                />
                {placeQuery.length > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Xóa ô tìm kiếm"
                    onPress={() => {
                      setPlaceQuery('');
                      setPlaceResults([]);
                      setPlaceSearchError(null);
                    }}
                    style={s.searchClearBtn}
                  >
                    <MaterialCommunityIcons name="close-circle" size={18} color="#8CB8E8" />
                  </Pressable>
                )}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Tìm" onPress={() => void searchPlaces()} style={s.searchSubmit}>
                {placeSearchBusy ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <MaterialCommunityIcons name="arrow-right" size={22} color="#fff" />
                )}
              </Pressable>
            </View>

            {/* Quick Suggestion Chips */}
            <View style={s.suggestionChipsWrapper}>
              <Text style={s.suggestionChipsLabel}>Gợi ý phổ biến:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.suggestionChipsRow}>
                {POPULAR_SEARCH_SUGGESTIONS.map(sug => (
                  <Pressable
                    key={sug}
                    onPress={() => {
                      setPlaceQuery(sug);
                      void searchPlaces(sug);
                    }}
                    style={s.suggestionChip}
                  >
                    <MaterialCommunityIcons name="compass-outline" size={12} color="#00FFCC" />
                    <Text style={s.suggestionChipText}>{sug}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {placeSearchError && <Text style={s.searchError}>{placeSearchError}</Text>}

            <ScrollView style={s.searchResultsList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {placeResults.map((r, idx) => {
                const userLoc = currentPosition || latestPoint;
                const distM = userLoc ? distanceMeters(userLoc, { latitude: r.latitude, longitude: r.longitude }) : null;
                const distStr = distM !== null
                  ? distM < 1000
                    ? `${Math.round(distM)} m`
                    : `${(distM / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`
                  : null;
                const namePart = r.displayName.split(',')[0]?.trim() || r.displayName;
                const addrPart = r.displayName.split(',').slice(1).join(',').trim();
                const iconName = getPlaceIcon(r);

                return (
                  <Pressable key={`${r.osmId || idx}-${r.latitude}-${r.longitude}`} onPress={() => selectPlace(r)} style={s.searchResultItem}>
                    <View style={s.resultIconCircle}>
                      <MaterialCommunityIcons name={iconName} size={18} color="#00F5D4" />
                    </View>
                    <View style={s.searchResultTextWrap}>
                      <Text style={s.searchResultName} numberOfLines={1}>
                        {namePart}
                      </Text>
                      {!!addrPart && (
                        <Text style={s.searchResultFull} numberOfLines={1}>
                          {addrPart}
                        </Text>
                      )}
                    </View>
                    {distStr && (
                      <View style={s.distBadge}>
                        <MaterialCommunityIcons name="near-me" size={11} color="#00E5FF" />
                        <Text style={s.distText}>{distStr}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </GlassSurface>
        </View>
      </Modal>

      {/* Friend Detail Modal */}
      <FriendDetailModal
        friend={selectedFriend}
        visible={!!selectedFriend}
        onClose={() => setSelectedFriend(null)}
        onNavigate={f => {
          setSelectedFriend(null);
          setDestination({ latitude: f.latitude, longitude: f.longitude, name: f.displayName });
        }}
        onToggleFootprints={f => {
          if (footprintsFriend?.id === f.id) setFootprintsFriend(null);
          else setFootprintsFriend(f);
        }}
        showingFootprints={footprintsFriend?.id === selectedFriend?.id}
        onSendPop={f => {
          alert(`🎉 Đã gửi Pop nổ tiệc tới ${f.displayName}!`);
        }}
        onOpenChat={() => {
          setSelectedFriend(null);
          setChatModalOpen(true);
        }}
        onChangeGhostMode={(f, mode) => {
          void setFriendGhostMode(f.userId, mode);
          setSelectedFriend({ ...f, ghostMode: mode });
        }}
        distanceKm={
          selectedFriend && (currentPosition || latestPoint)
            ? (distanceMeters(currentPosition || latestPoint!, { latitude: selectedFriend.latitude, longitude: selectedFriend.longitude }) / 1000).toFixed(1)
            : undefined
        }
        onEmojiBomb={f => {
          setSelectedFriend(null);
          setEmojiTargetFriend(f);
          setEmojiBombOpen(true);
        }}
        onVoicePing={f => {
          setSelectedFriend(null);
          setVoicePingFriend(f);
        }}
        onARFinder={f => {
          setSelectedFriend(null);
          setArFinderFriend(f);
        }}
      />

      {/* Map Chat Modal */}
      <MapChatModal
        visible={chatModalOpen}
        onClose={() => setChatModalOpen(false)}
        onSubmit={async (msg, emoji) => {
          const pos = currentPosition || latestPoint || defaultCenter;
          const newM = await postMapChatMessage({
            message: msg,
            emoji,
            latitude: pos.latitude,
            longitude: pos.longitude,
          });
          setMapChatMessages(prev => [newM, ...prev]);
        }}
        targetName={selectedFriend?.displayName}
      />

      {/* Bump Modal */}
      <BumpModal
        visible={bumpModalOpen}
        onClose={() => setBumpModalOpen(false)}
        currentCoords={currentPosition || latestPoint || null}
        onFriendAdded={name => {
          alert(`Đã kết bạn thành công với ${name}!`);
        }}
      />

      {/* Interaction Wheel */}
      <InteractionWheel
        friend={wheelFriend}
        visible={!!wheelFriend}
        onClose={() => setWheelFriend(null)}
        onPeek={f => {
          void sendFriendInteraction(f.userId || f.id, 'peek');
          alert(`👀 Đã gửi "Đang xem bạn" tới ${f.displayName}!`);
        }}
        onSendHeart={f => {
          void sendFriendInteraction(f.userId || f.id, 'heart');
          alert(`❤️ Đã gửi tim yêu thương tới ${f.displayName}!`);
        }}
        onInviteHangout={f => {
          void sendFriendInteraction(f.userId || f.id, 'invite');
          alert(`🍻 Đã gửi lời rủ đi chơi tới ${f.displayName}!`);
        }}
        onBuzz={f => {
          void sendFriendInteraction(f.userId || f.id, 'buzz');
          alert(`📣 Đã gửi Buzz rung chuông tới ${f.displayName}!`);
        }}
        onOpenChat={f => {
          setWheelFriend(null);
          setChatModalOpen(true);
        }}
        onNavigate={f => {
          setWheelFriend(null);
          setDestination({ latitude: f.latitude, longitude: f.longitude, name: f.displayName });
        }}
        onNotifyArrival={f => {
          setWheelFriend(null);
          void registerOneTimeArrivalAlert(f, {
            name: 'Điểm đến quen thuộc',
            latitude: f.latitude,
            longitude: f.longitude,
          });
          alert(`🔔 Sẽ thông báo cho bạn một lần khi ${f.displayName} đến nơi!`);
        }}
        onOpenFullDetail={f => {
          setWheelFriend(null);
          setSelectedFriend(f);
        }}
        onEmojiBomb={f => {
          setWheelFriend(null);
          setEmojiTargetFriend(f);
          setEmojiBombOpen(true);
        }}
        onVoicePing={f => {
          setWheelFriend(null);
          setVoicePingFriend(f);
        }}
        onARFinder={f => {
          setWheelFriend(null);
          setArFinderFriend(f);
        }}
      />

      {/* Story Viewer Modal */}
      <Modal visible={!!activeStory} transparent animationType="fade" onRequestClose={() => setActiveStory(null)}>
        <View style={s.searchOverlay}>
          <GlassSurface style={s.storyModal}>
            <View style={s.storyModalHeader}>
              <View style={s.storyBadgeWrap}>
                <Text style={s.storyBadgeEmoji}>{activeStory?.emoji}</Text>
                <View style={s.flex}>
                  <Text style={s.storyModalTitle} numberOfLines={1}>{activeStory?.title}</Text>
                  <Text style={s.storyModalSub} numberOfLines={1}>{activeStory?.subtitle} · 24h</Text>
                </View>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={() => setActiveStory(null)} style={s.searchClose}>
                <MaterialCommunityIcons name="close" size={22} color="#DCEEFF" />
              </Pressable>
            </View>

            {activeStory?.coverUri ? (
              <Image source={{ uri: activeStory.coverUri }} style={s.storyCoverImg} resizeMode="cover" />
            ) : (
              <View style={s.storyEmptyCover}>
                <Text style={s.storyBigEmoji}>{activeStory?.emoji}</Text>
                <Text style={s.storyCoverCaption}>{activeStory?.title}</Text>
              </View>
            )}

            <View style={s.storyModalFooter}>
              <GlassButton
                tone="blue"
                style={s.flex}
                onPress={() => {
                  if (activeStory) {
                    setDestination({ latitude: activeStory.latitude, longitude: activeStory.longitude, name: activeStory.title });
                    setActiveStory(null);
                  }
                }}
              >
                <View style={s.actionRow}>
                  <MaterialCommunityIcons name="navigation-variant" size={16} color="#7BE8FF" />
                  <Text style={s.white}>Đến vị trí này</Text>
                </View>
              </GlassButton>
              <GlassButton tone="neutral" onPress={() => setActiveStory(null)}>
                <Text style={s.white}>Đóng</Text>
              </GlassButton>
            </View>
          </GlassSurface>
        </View>
      </Modal>

      {/* Emoji Bomb Overlay */}
      <EmojiBombOverlay
        visible={emojiBombOpen}
        onClose={() => setEmojiBombOpen(false)}
        targetName={emojiTargetFriend?.displayName}
      />

      {/* Voice Ping Modal */}
      <VoicePingModal
        visible={!!voicePingFriend}
        onClose={() => setVoicePingFriend(null)}
        targetFriend={voicePingFriend}
        currentCoords={currentPosition || latestPoint || defaultCenter}
        onVoiceSent={() => {
          Alert.alert('Đã gửi Voice Memo! 🎙️', `Ghi chú âm thanh tọa độ đã được gửi tới ${voicePingFriend?.displayName}.`);
        }}
      />

      {/* AR Compass Finder Modal */}
      {arFinderFriend && (
        <ARFinderModal
          visible={!!arFinderFriend}
          onClose={() => setArFinderFriend(null)}
          friendName={arFinderFriend.displayName}
          friendAvatar={arFinderFriend.avatarUrl || undefined}
          friendLat={arFinderFriend.latitude}
          friendLon={arFinderFriend.longitude}
          userLat={(currentPosition || latestPoint)?.latitude || defaultCenter.latitude}
          userLon={(currentPosition || latestPoint)?.longitude || defaultCenter.longitude}
        />
      )}

      {/* Explorer Badges & Achievements Modal */}
      <AchievementsModal
        visible={achievementsOpen}
        onClose={() => setAchievementsOpen(false)}
      />

      {/* Weekly MyMap Wrapped Modal */}
      <WrappedStoryModal
        visible={wrappedOpen}
        onClose={() => setWrappedOpen(false)}
      />

      {/* Geocached Time Capsule Modal */}
      <TimeCapsuleModal
        visible={timeCapsuleOpen}
        onClose={() => setTimeCapsuleOpen(false)}
        userLat={(currentPosition || latestPoint)?.latitude || defaultCenter.latitude}
        userLon={(currentPosition || latestPoint)?.longitude || defaultCenter.longitude}
      />

      {/* Real-time Friend Interactions Overlay (Hearts, Buzz, Peek, Hangout Invites) */}
      <RealtimeInteractionsOverlay
        incomingEvent={incomingInteraction}
        onDismiss={() => setIncomingInteraction(null)}
        onLocateSender={senderId => {
          const friend = friends.find(f => f.userId === senderId || f.id === senderId);
          if (friend && mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: friend.latitude,
              longitude: friend.longitude,
              zoom: 16,
            });
            setSelectedFriend(friend);
          }
        }}
        onOpenChatWithSender={() => {
          setChatModalOpen(true);
        }}
      />
    </View>
  );
}

function SideTool({ icon, label, onPress, tone = 'blue' }: { icon: IconName; label: string; onPress: () => void; tone?: 'blue' | 'cyan' | 'mint' | 'yellow' | 'violet' | 'rose' }) {
  const { theme } = useAppTheme();
  const isDanger = tone === 'rose';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        s.control,
        { backgroundColor: theme.colors.glassStrong, borderColor: theme.colors.border },
        isDanger && [s.sosControl, { backgroundColor: `${theme.colors.danger}1F`, borderColor: `${theme.colors.danger}52` }],
        pressed && s.controlPressed,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={21} color={isDanger ? theme.colors.danger : theme.colors.primary} />
    </Pressable>
  );
}

function MapControl({ icon, label, onPress, pending, disabled }: { icon: IconName; label: string; onPress: () => void; pending?: boolean; disabled?: boolean }) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
      style={({ pressed }) => [s.control, { backgroundColor: theme.colors.glassStrong, borderColor: theme.colors.border }, disabled && s.disabledControl, pressed && s.controlPressed]}
    >
      {pending ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <MaterialCommunityIcons name={icon} size={21} color={theme.colors.muted} />}
    </Pressable>
  );
}

function LayerChoice({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: value }} onPress={onChange} style={s.layerChoice}>
      <MaterialCommunityIcons name={value ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={20} color={value ? glassColors.cyan : '#94B4D8'} />
      <Text style={s.layerChoiceLabel}>{label}</Text>
    </Pressable>
  );
}

function HomeStat({ icon, value, label, tone, onPress }: { icon: IconName; value: number | string; label: string; tone?: 'cyan' | 'violet'; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={onPress} style={s.stat}>
      <IconBadge name={icon} size={20} diameter={34} tone={tone} />
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07131F' },
  nativeMap: { zIndex: 0 },
  mapShade: { zIndex: 1 },
  foreground: { flex: 1, zIndex: 2 },
  content: { alignSelf: 'center', width: '100%', gap: 16, paddingTop: 8 },
  mapSpace: { width: '100%', position: 'relative' },
  mapFallback: { position: 'absolute', top: 12, left: 14, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(8,24,38,.84)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  mapFallbackText: { color: '#B3D3FB', fontSize: 11, fontWeight: '600' },
  friendsOnlinePill: { position: 'absolute', top: 12, left: 14, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(8,24,38,.88)', borderWidth: .8, borderColor: 'rgba(135,186,205,.22)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 13, zIndex: 10 },
  greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#00FF88' },
  friendsOnlineText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  mapTools: { position: 'absolute', right: 12, top: 10, gap: 7, zIndex: 5 },
  control: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(11,27,41,.9)', borderWidth: .8, borderColor: 'rgba(135,186,205,.2)', alignItems: 'center', justifyContent: 'center', shadowColor: '#01080F', shadowOpacity: .14, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  controlPressed: { transform: [{ scale: .96 }], opacity: .82 },
  sosControl: { backgroundColor: 'rgba(233,121,142,.12)', borderColor: 'rgba(233,121,142,.32)', shadowOpacity: .08 },
  disabledControl: { opacity: 0.6 },
  layerPanel: { padding: 14, gap: 12, borderRadius: 18, alignSelf: 'flex-end', width: 230, zIndex: 20 },
  layerChoice: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  layerChoiceLabel: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tileSelectBox: { marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  tileSelectLabel: { color: '#AFD5FA', fontSize: 11, marginBottom: 4 },
  tileBtn: { paddingVertical: 7, paddingHorizontal: 9, borderRadius: 10, backgroundColor: 'rgba(255,255,255,.045)', borderWidth: .8, borderColor: 'rgba(255,255,255,.08)', marginBottom: 5 },
  tileBtnActive: { backgroundColor: 'rgba(105,195,211,.14)', borderColor: 'rgba(105,195,211,.38)' },
  tileBtnText: { color: '#B0CEEE', fontSize: 11, textAlign: 'center' },
  tileBtnTextActive: { color: '#fff', fontWeight: '700' },
  userMarkerWrap: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  userMarkerPulse: { position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,255,200,.3)' },
  userMarkerDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#00FFCC', borderWidth: 2.5, borderColor: '#fff' },
  friendMarker: { alignItems: 'center', justifyContent: 'center' },
  friendAvatarRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#52E3FF', backgroundColor: '#092147', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  friendAvatar: { width: 36, height: 36, borderRadius: 18 },
  friendAvatarBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#164375', alignItems: 'center', justifyContent: 'center' },
  friendInitial: { color: '#fff', fontSize: 16, fontWeight: '800' },
  friendStatusBadge: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#041738', borderWidth: 1, borderColor: '#52E3FF', alignItems: 'center', justifyContent: 'center' },
  friendPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(3,17,48,0.85)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginTop: 2 },
  friendPillText: { fontSize: 9, fontWeight: '800' },
  partyMarker: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF0055', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 14, borderWidth: 2, borderColor: '#fff', gap: 3 },
  partyEmoji: { fontSize: 14 },
  partyCount: { color: '#fff', fontSize: 11, fontWeight: '900' },
  chatPin: { backgroundColor: 'rgba(4,22,60,0.88)', borderWidth: 1, borderColor: '#52E3FF', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 140 },
  chatPinEmoji: { fontSize: 13 },
  chatPinText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  stopBadge: { backgroundColor: '#FF6BD6', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 7, flexDirection: 'row', alignItems: 'center', gap: 2, borderWidth: 1, borderColor: '#fff' },
  stopText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  pinFrame: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#fff', overflow: 'hidden', backgroundColor: '#052250' },
  pin: { width: 34, height: 34 },
  pinStem: { width: 2, height: 8, backgroundColor: '#fff', alignSelf: 'center' },
  destPinFrame: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E02020', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  destPinStem: { width: 2, height: 8, backgroundColor: '#E02020', alignSelf: 'center' },
  replayMarker: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(3,17,51,.9)', borderWidth: 2, borderColor: '#00FFCC', alignItems: 'center', justifyContent: 'center' },
  routeBanner: { position: 'absolute', left: 16, right: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 15, borderRadius: 18 },
  routeBannerCopy: { flex: 1 },
  routeBannerTitle: { color: '#fff', fontSize: 13, fontWeight: '800' },
  routeBannerSub: { color: '#88E5FF', fontSize: 11, marginTop: 2 },
  travelModeButton: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(123,232,255,.42)', backgroundColor: 'rgba(15,71,111,.55)', paddingHorizontal: 8, paddingVertical: 7 },
  travelModeText: { color: '#E8FAFF', fontSize: 10, fontWeight: '800' },
  closeRoute: { padding: 4 },
  navigationSpeedBubble: { position: 'absolute', left: 16, right: 76, maxWidth: 390, zIndex: 30, borderRadius: 22, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 9 },
  currentSpeedCircle: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,23,55,.92)', borderWidth: 2, borderColor: '#52E3FF' },
  currentSpeedValue: { color: '#fff', fontSize: 23, lineHeight: 25, fontWeight: '900', fontVariant: ['tabular-nums'] },
  currentSpeedOver: { color: '#FF5B72' },
  speedUnit: { color: '#9CCFF2', fontSize: 8, fontWeight: '800' },
  limitSign: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 5, borderColor: '#E32235' },
  limitValue: { color: '#111827', fontSize: 20, lineHeight: 21, fontWeight: '900', fontVariant: ['tabular-nums'] },
  limitCaption: { color: '#4B5563', fontSize: 6.5, fontWeight: '900' },
  speedRoadCopy: { flex: 1, minWidth: 0 },
  speedRoadTitle: { color: '#fff', fontSize: 11.5, fontWeight: '800' },
  speedRoadMeta: { color: '#9DDCF5', fontSize: 9, marginTop: 2 },
  speedEstimateNote: { color: '#7E9DBB', fontSize: 8, marginTop: 2 },
  fullscreenTopBar: { position: 'absolute', left: 16, right: 16, zIndex: 12 },
  fullscreenSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(4,22,58,.85)', borderWidth: 1, borderColor: 'rgba(141,208,255,.3)', borderRadius: 22, paddingHorizontal: 14, height: 44 },
  fullscreenSearchText: { color: '#AFD5FA', fontSize: 13, flex: 1 },
  fullscreenTools: { position: 'absolute', right: 16, gap: 7, zIndex: 12 },
  exitFullscreenBtn: { position: 'absolute', alignSelf: 'center', zIndex: 12 },
  exitFullscreenInner: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  exitFullscreenText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  replayBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, zIndex: 25, borderRadius: 20 },
  replayPlayBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#00A8FF', alignItems: 'center', justifyContent: 'center' },
  replayInfo: { flex: 1 },
  replayTime: { color: '#fff', fontSize: 12, fontWeight: '800' },
  replayProgress: { color: '#88E5FF', fontSize: 10, marginTop: 2 },
  speedBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,.12)' },
  speedText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  closeReplayBtn: { padding: 6 },
  searchOverlay: { flex: 1, backgroundColor: 'rgba(2,9,28,.82)', justifyContent: 'center', padding: 16 },
  searchDialog: { padding: 18, borderRadius: 24, gap: 12, maxHeight: '82%' },
  searchHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  searchCopy: { flex: 1 },
  searchTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  searchHint: { color: '#AFD7FA', fontSize: 11, marginTop: 2 },
  searchClose: { padding: 4 },
  searchBar: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 46, borderRadius: 14, backgroundColor: 'rgba(5,21,50,.7)', borderWidth: 1, borderColor: 'rgba(147,211,255,.3)', paddingHorizontal: 10 },
  searchIconLead: { marginRight: 6 },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, height: '100%' },
  searchClearBtn: { padding: 4 },
  searchSubmit: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#00A8FF', alignItems: 'center', justifyContent: 'center' },
  suggestionChipsWrapper: { gap: 6, marginTop: 2 },
  suggestionChipsLabel: { color: '#8CB8E8', fontSize: 11, fontWeight: '600' },
  suggestionChipsRow: { gap: 8, paddingVertical: 2 },
  suggestionChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,168,255,.12)', borderWidth: 1, borderColor: 'rgba(0,255,204,.3)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  suggestionChipText: { color: '#DCEEFF', fontSize: 11.5, fontWeight: '600' },
  searchError: { color: '#FF9BB6', fontSize: 12, textAlign: 'center' },
  searchResultsList: { maxHeight: 280 },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,.08)' },
  resultIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,245,212,.12)', borderWidth: 1, borderColor: 'rgba(0,245,212,.3)', alignItems: 'center', justifyContent: 'center' },
  searchResultTextWrap: { flex: 1 },
  searchResultName: { color: '#fff', fontSize: 13, fontWeight: '700' },
  searchResultFull: { color: '#8CB8E8', fontSize: 11, marginTop: 1 },
  distBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,229,255,.1)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,229,255,.25)' },
  distText: { color: '#00E5FF', fontSize: 10.5, fontWeight: '700' },
  error: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16 },
  errorText: { flex: 1, color: '#FFD0DE', fontSize: 12 },
  retry: { padding: 4 },
  summary: { paddingVertical: 16, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderRadius: 18 },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  statLabel: { color: glassColors.muted, fontSize: 10, textAlign: 'center' },
  divider: { width: 1, height: 28, backgroundColor: 'rgba(147,211,255,.18)' },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, padding: 12, borderRadius: 16 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionCopy: { flex: 1 },
  actionTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  actionSubtitle: { color: '#AFD5FA', fontSize: 10, marginTop: 2 },
  status: { color: '#8CB8E8', fontSize: 11, textAlign: 'center', marginTop: 4 },
  flex: { flex: 1 },
  white: { color: '#fff', fontWeight: '700', fontSize: 13 },
  storiesBar: { marginBottom: 10 },
  storiesScroll: { gap: 14, paddingHorizontal: 4 },
  storyPill: { alignItems: 'center', width: 68, gap: 5 },
  storyRing: { width: 56, height: 56, borderRadius: 18, padding: 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(105,195,211,.36)', backgroundColor: 'rgba(11,27,41,.72)' },
  storyAvatarInner: { width: '100%', height: '100%', borderRadius: 16, backgroundColor: '#102333', alignItems: 'center', justifyContent: 'center' },
  storyEmoji: { fontSize: 24 },
  storyTitle: { color: '#DCEEFF', fontSize: 10.5, fontWeight: '700', textAlign: 'center' },
  storyModal: { padding: 20, borderRadius: 24, gap: 16, width: '100%', maxWidth: 460, alignSelf: 'center' },
  storyModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storyBadgeWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  storyBadgeEmoji: { fontSize: 32 },
  storyModalTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  storyModalSub: { color: '#88E5FF', fontSize: 12, marginTop: 2 },
  storyCoverImg: { width: '100%', height: 220, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(113,241,255,0.3)' },
  storyEmptyCover: { width: '100%', height: 160, borderRadius: 18, backgroundColor: 'rgba(5,26,64,0.6)', borderWidth: 1, borderColor: 'rgba(113,241,255,0.2)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  storyBigEmoji: { fontSize: 48 },
  storyCoverCaption: { color: '#B0D8FF', fontSize: 13, fontWeight: '600' },
  storyModalFooter: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  liveTripCardFixed: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 900,
  },
});
