import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, invokeEdgeFunctionWithFallback } from './supabase';
import { getCurrentUser } from './auth';
import { computeCurrentAutomaticStatus } from './friendStatus';
import { applyGhostModeToCoords, getGlobalGhostMode } from './ghostMode';
import { maskCoordinateIfPrivate } from './privacyZones';
import { getUserMusicStatus, formatMusicForBroadcast } from './musicStatus';
import { distanceMeters } from '../utils/geo';
import { listConnections } from './friendDiscovery';

export type RealtimeFriend = {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  phoneNumber?: string | null;
  avatarUrl: string | null;
  latitude: number;
  longitude: number;
  heading?: number;
  speedKmh: number;
  batteryLevel: number;
  isCharging: boolean;
  statusText: string;
  statusIcon: string;
  ghostMode: 'precise' | 'fuzzy' | 'frozen';
  lastSeenMs: number;
  footprints?: FriendFootprintPoint[];
  rankingScore: number;
  streakDays: number;
  musicTitle?: string;
  musicArtist?: string;
  musicIsPlaying?: boolean;
  isOnline?: boolean;
};

export type FriendFootprintPoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
  dwellMinutes?: number;
  placeName?: string;
};

export type RealtimePartyGroup = {
  id: string;
  centerLat: number;
  centerLon: number;
  friends: RealtimeFriend[];
  label: string;
};

export type MapChatMessage = {
  id: string;
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  latitude: number;
  longitude: number;
  message: string;
  emoji?: string;
  createdAt: number;
};

export type FriendInteractionType = 'peek' | 'heart' | 'invite' | 'buzz';

export interface FriendInteractionEvent {
  id: string;
  senderId: string;
  senderName: string;
  targetFriendId: string;
  type: FriendInteractionType;
  timestamp: number;
  metadata?: Record<string, any>;
}

const FRIENDS_CACHE_KEY = 'mymap.realtime_friends.cache.v3';
const MAP_CHAT_CACHE_KEY = 'mymap.map_chat.cache.v1';
let connectionsCache: Awaited<ReturnType<typeof listConnections>> | null = null;
let connectionsCacheAt = 0;

async function getAcceptedConnectionsCached() {
  if (connectionsCache && Date.now() - connectionsCacheAt < 30_000) return connectionsCache;
  connectionsCache = await listConnections();
  connectionsCacheAt = Date.now();
  return connectionsCache;
}

/**
 * Đẩy vị trí hiện tại của mình lên đám mây liên tục (Continuous Presence)
 * Có áp dụng Vùng riêng tư (Privacy Zone) và Chế độ tàng hình (Ghost Mode).
 */
export async function broadcastContinuousPresence(coords: {
  latitude: number;
  longitude: number;
  heading?: number | null;
  speedMps?: number | null;
}) {
  const user = await getCurrentUser();
  const status = await computeCurrentAutomaticStatus({
    speedMps: coords.speedMps,
    latitude: coords.latitude,
    longitude: coords.longitude,
  });

  // 1. Kiểm tra Vùng riêng tư: làm mờ tọa độ nếu ở Nhà/Cơ quan đã ghim
  const privacyCheck = await maskCoordinateIfPrivate(coords.latitude, coords.longitude);
  const effectiveCoords = privacyCheck.isMasked
    ? { latitude: privacyCheck.latitude, longitude: privacyCheck.longitude }
    : coords;

  // 2. Áp dụng Ghost Mode đã thiết lập
  const ghostCoords = await applyGhostModeToCoords(effectiveCoords);

  // 3. Đọc trạng thái bài hát đang nghe nếu có
  const currentMusic = await getUserMusicStatus();
  const musicBroadcast = formatMusicForBroadcast(currentMusic);

  const payload = {
    latitude: ghostCoords.latitude,
    longitude: ghostCoords.longitude,
    heading_deg: coords.heading ?? 0,
    speed_mps: coords.speedMps ?? 0,
    battery_level: status.batteryLevel,
    is_charging: status.isCharging,
    status_text: status.contextStatus,
    status_icon: status.icon,
    speed_kmh: status.speedKmh,
    is_fuzzy: ghostCoords.isFuzzy || privacyCheck.isMasked,
    is_frozen: ghostCoords.isFrozen,
    music_title: musicBroadcast.musicTitle,
    music_artist: musicBroadcast.musicArtist,
    music_is_playing: currentMusic?.isPlaying || false,
    updated_at: new Date().toISOString(),
  };

  try {
    if (user) {
      const result = await invokeEdgeFunctionWithFallback('mymap-presence', 'vibecoding-presence', { body: payload });
      if (result?.error) {
        // A direct RLS-protected upsert keeps presence working while an Edge
        // Function is cold, renamed or temporarily unavailable.
        await supabase.from('vc_live_presence').upsert({ user_id: user.id, ...payload }, { onConflict: 'user_id' });
      }
    }
  } catch {}

  return payload;
}

/**
 * Lấy danh sách bạn bè realtime kèm toạ độ, pin, tốc độ và trạng thái.
 */
export async function getLiveFriends(myCoords?: { latitude: number; longitude: number } | null): Promise<RealtimeFriend[]> {
  let friends: RealtimeFriend[] = [];

  // 1. Đọc cache cục bộ (lọc bỏ các ID mẫu nếu từng lưu trước đây)
  try {
    const raw = await AsyncStorage.getItem(FRIENDS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        friends = parsed.filter(
          (f: any) => f && f.id && !['friend_linh', 'friend_huy', 'friend_mai'].includes(f.id)
        );
      }
    }
  } catch {}

  // 2. Thử truy vấn từ Supabase
  try {
    const user = await getCurrentUser();
    if (user) {
      const { data, error } = await supabase
        .from('vc_live_friends')
        .select('*')
        .order('updated_at', { ascending: false });

      if (!error && data) {
        const liveFriends: RealtimeFriend[] = data.map((d: any) => ({
          id: d.id || d.user_id,
          userId: d.user_id,
          displayName: d.display_name || d.name || 'Bạn bè MyMap',
          username: d.username || 'friend',
          phoneNumber: d.phone_e164 || d.phone || null,
          avatarUrl: d.avatar_url || null,
          latitude: Number(d.latitude),
          longitude: Number(d.longitude),
          heading: Number(d.heading || 0),
          speedKmh: Number(d.speed_kmh || 0),
          batteryLevel: Number(d.battery_level || 85),
          isCharging: Boolean(d.is_charging),
          statusText: d.status_text || 'Đang trực tuyến',
          statusIcon: d.status_icon || 'map-marker',
          ghostMode: (d.is_fuzzy ? 'fuzzy' : d.is_frozen ? 'frozen' : 'precise') as RealtimeFriend['ghostMode'],
          lastSeenMs: new Date(d.updated_at || Date.now()).getTime(),
          rankingScore: Number(d.ranking_score || 85),
          streakDays: Number(d.streak_days || 3),
          musicTitle: d.music_title || undefined,
          musicArtist: d.music_artist || undefined,
          musicIsPlaying: Boolean(d.music_is_playing),
          isOnline: Date.now() - new Date(d.updated_at || Date.now()).getTime() < 5 * 60 * 1000,
        }));

        // The presence view and the connection RPC have different lifecycles.
        // Merge them by user id so accepted friends remain visible using their
        // last known coordinate even when they have just gone offline.
        const cachedByUser = new Map(friends.map(friend => [friend.userId, friend]));
        const liveByUser = new Map(liveFriends.map((friend: RealtimeFriend) => [friend.userId, friend]));
        try {
          const accepted = (await getAcceptedConnectionsCached()).filter(connection => connection.direction === 'accepted');
          friends = accepted.flatMap(connection => {
            const live = liveByUser.get(connection.user_id);
            if (live) return [live];
            const cached = cachedByUser.get(connection.user_id);
            if (!cached) return [];
            return [{
              ...cached,
              displayName: connection.display_name || cached.displayName,
              username: connection.username || cached.username,
              avatarUrl: connection.avatar_path || cached.avatarUrl,
              statusText: 'Ngoại tuyến · vị trí gần nhất',
              isOnline: false,
            }];
          });
        } catch {
          friends = liveFriends;
        }
        await AsyncStorage.setItem(FRIENDS_CACHE_KEY, JSON.stringify(friends)).catch(() => {});
      }
    }
  } catch {}

  return friends;
}

/**
 * Phát hiện các nhóm bạn bè đang gặp nhau trong bán kính 50m (Party / Pop).
 */
export function detectPartyGroups(friends: RealtimeFriend[], myCoords?: { latitude: number; longitude: number } | null): RealtimePartyGroup[] {
  const allEntities = [...friends];
  if (myCoords) {
    allEntities.push({
      id: 'me',
      userId: 'me',
      displayName: 'Bạn',
      username: 'you',
      avatarUrl: null,
      latitude: myCoords.latitude,
      longitude: myCoords.longitude,
      speedKmh: 0,
      batteryLevel: 100,
      isCharging: false,
      statusText: 'Tại đây',
      statusIcon: 'account',
      ghostMode: 'precise',
      lastSeenMs: Date.now(),
      rankingScore: 100,
      streakDays: 0,
    });
  }

  const groups: RealtimePartyGroup[] = [];
  const visited = new Set<string>();

  for (let i = 0; i < allEntities.length; i++) {
    const f1 = allEntities[i]!;
    if (visited.has(f1.id)) continue;

    const cluster: RealtimeFriend[] = [f1];
    for (let j = i + 1; j < allEntities.length; j++) {
      const f2 = allEntities[j]!;
      if (visited.has(f2.id)) continue;
      const d = distanceMeters(
        { latitude: f1.latitude, longitude: f1.longitude },
        { latitude: f2.latitude, longitude: f2.longitude }
      );
      if (d <= 65) {
        cluster.push(f2);
        visited.add(f2.id);
      }
    }

    if (cluster.length >= 2) {
      visited.add(f1.id);
      const centerLat = cluster.reduce((sum, c) => sum + c.latitude, 0) / cluster.length;
      const centerLon = cluster.reduce((sum, c) => sum + c.longitude, 0) / cluster.length;
      groups.push({
        id: `party_${f1.id}`,
        centerLat,
        centerLon,
        friends: cluster,
        label: `🎉 Tụ họp ${cluster.length} người!`,
      });
    }
  }

  return groups;
}

/**
 * Lấy danh sách tin nhắn ghim bản đồ (Map Chat).
 */
export async function getMapChatMessages(): Promise<MapChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(MAP_CHAT_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

// Kênh Realtime chung cho Map Chat
let mapChatChannel: any = null;

/**
 * Lắng nghe tin nhắn Map Chat từ bạn bè theo thời gian thực (Supabase Realtime Channel).
 */
export function subscribeToMapChat(onMessageReceived: (msg: MapChatMessage) => void): () => void {
  if (!mapChatChannel) {
    mapChatChannel = supabase.channel('realtime:map_chat');
  }

  mapChatChannel.on('broadcast', { event: 'new_chat' }, (payload: any) => {
    if (payload && payload.payload) {
      const msg = payload.payload as MapChatMessage;
      void getMapChatMessages().then(existing => {
        if (!existing.some(m => m.id === msg.id)) {
          const updated = [msg, ...existing].slice(0, 30);
          void AsyncStorage.setItem(MAP_CHAT_CACHE_KEY, JSON.stringify(updated)).catch(() => {});
        }
      });
      onMessageReceived(msg);
    }
  });

  mapChatChannel.subscribe();

  return () => {
    // Keep channel open or unsubscribe listener
  };
}

/**
 * Gửi tin nhắn ghim lên toạ độ bản đồ (Lưu cục bộ + phát Realtime tới bạn bè).
 */
export async function postMapChatMessage(input: {
  message: string;
  latitude: number;
  longitude: number;
  emoji?: string;
}): Promise<MapChatMessage> {
  const user = await getCurrentUser();
  const newMsg: MapChatMessage = {
    id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    userId: user?.id || 'me',
    userName: user?.user_metadata?.name || user?.user_metadata?.full_name || 'Tôi',
    avatarUrl: user?.user_metadata?.avatar_url || null,
    latitude: input.latitude,
    longitude: input.longitude,
    message: input.message,
    emoji: input.emoji || '💬',
    createdAt: Date.now(),
  };

  const existing = await getMapChatMessages();
  const updated = [newMsg, ...existing].slice(0, 30);
  await AsyncStorage.setItem(MAP_CHAT_CACHE_KEY, JSON.stringify(updated)).catch(() => {});

  // Phát Realtime qua Supabase Broadcast Channel tới các bạn bè đang mở bản đồ
  try {
    if (!mapChatChannel) {
      mapChatChannel = supabase.channel('realtime:map_chat');
      mapChatChannel.subscribe();
    }
    await mapChatChannel.send({
      type: 'broadcast',
      event: 'new_chat',
      payload: newMsg,
    });
  } catch {}

  return newMsg;
}

// Kênh Realtime chung cho tương tác bạn bè (Peek, Heart, Invite, Buzz)
let interactionChannel: any = null;

/**
 * Gửi tương tác tức thì (Gửi tim, Đang xem bạn, Buzz rung, Rủ đi chơi) qua Supabase Realtime.
 */
export async function sendFriendInteraction(
  targetFriendId: string,
  type: FriendInteractionType,
  metadata?: Record<string, any>
): Promise<FriendInteractionEvent> {
  const user = await getCurrentUser();
  const event: FriendInteractionEvent = {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    senderId: user?.id || 'me',
    senderName: user?.user_metadata?.name || user?.user_metadata?.full_name || 'Một người bạn',
    targetFriendId,
    type,
    timestamp: Date.now(),
    metadata,
  };

  try {
    if (!interactionChannel) {
      interactionChannel = supabase.channel('realtime:interactions');
      interactionChannel.subscribe();
    }
    await interactionChannel.send({
      type: 'broadcast',
      event: 'friend_action',
      payload: event,
    });
  } catch {}

  return event;
}

/**
 * Đăng ký nhận tương tác tức thì từ bạn bè (Peek, Heart, Invite, Buzz).
 */
export function subscribeToFriendInteractions(
  currentUserId: string,
  onInteractionReceived: (event: FriendInteractionEvent) => void
): () => void {
  if (!interactionChannel) {
    interactionChannel = supabase.channel('realtime:interactions');
  }

  interactionChannel.on('broadcast', { event: 'friend_action' }, (payload: any) => {
    if (payload && payload.payload) {
      const ev = payload.payload as FriendInteractionEvent;
      // Chỉ kích hoạt nếu tương tác nhắm vào người dùng hiện tại
      if (ev.targetFriendId === currentUserId || ev.targetFriendId === 'all') {
        onInteractionReceived(ev);
      }
    }
  });

  interactionChannel.subscribe();

  return () => {
    // listener cleanup
  };
}

