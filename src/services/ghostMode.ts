import AsyncStorage from '@react-native-async-storage/async-storage';

export type GhostModeLevel = 'precise' | 'fuzzy' | 'frozen';

const GHOST_GLOBAL_KEY = 'mymap.ghost_mode.global.v1';
const GHOST_FRIENDS_KEY = 'mymap.ghost_mode.friends.v1';
const GHOST_FROZEN_KEY = 'mymap.ghost_mode.frozen_coords.v1';

export type GhostFriendSettings = Record<string, GhostModeLevel>;

export async function getGlobalGhostMode(): Promise<GhostModeLevel> {
  try {
    const raw = await AsyncStorage.getItem(GHOST_GLOBAL_KEY);
    if (raw === 'fuzzy' || raw === 'frozen' || raw === 'precise') {
      return raw;
    }
  } catch {}
  return 'precise';
}

export async function setGlobalGhostMode(mode: GhostModeLevel, currentCoords?: { latitude: number; longitude: number }): Promise<void> {
  try {
    await AsyncStorage.setItem(GHOST_GLOBAL_KEY, mode);
    if (mode === 'frozen' && currentCoords) {
      await AsyncStorage.setItem(GHOST_FROZEN_KEY, JSON.stringify(currentCoords));
    }
  } catch {}
}

export async function getFriendGhostSettings(): Promise<GhostFriendSettings> {
  try {
    const raw = await AsyncStorage.getItem(GHOST_FRIENDS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export async function setFriendGhostMode(friendUserId: string, mode: GhostModeLevel): Promise<void> {
  try {
    const settings = await getFriendGhostSettings();
    settings[friendUserId] = mode;
    await AsyncStorage.setItem(GHOST_FRIENDS_KEY, JSON.stringify(settings));
  } catch {}
}

export async function getEffectiveGhostModeForFriend(friendUserId?: string): Promise<GhostModeLevel> {
  if (friendUserId) {
    const settings = await getFriendGhostSettings();
    if (settings[friendUserId]) {
      return settings[friendUserId]!;
    }
  }
  return await getGlobalGhostMode();
}

/**
 * Áp dụng làm mờ toạ độ (Fuzzy) hoặc đóng băng toạ độ (Frozen) trước khi chia sẻ.
 */
export async function applyGhostModeToCoords(
  coords: { latitude: number; longitude: number },
  friendUserId?: string
): Promise<{ latitude: number; longitude: number; isFuzzy: boolean; isFrozen: boolean }> {
  const mode = await getEffectiveGhostModeForFriend(friendUserId);

  if (mode === 'frozen') {
    try {
      const raw = await AsyncStorage.getItem(GHOST_FROZEN_KEY);
      if (raw) {
        const frozen = JSON.parse(raw);
        if (typeof frozen.latitude === 'number' && typeof frozen.longitude === 'number') {
          return { latitude: frozen.latitude, longitude: frozen.longitude, isFuzzy: false, isFrozen: true };
        }
      }
    } catch {}
    // If no frozen saved yet, lock to current
    await AsyncStorage.setItem(GHOST_FROZEN_KEY, JSON.stringify(coords)).catch(() => {});
    return { ...coords, isFuzzy: false, isFrozen: true };
  }

  if (mode === 'fuzzy') {
    // Làm mờ trong bán kính ~800m - 1km một cách ổn định theo block thời gian
    const daySeed = Math.floor(Date.now() / (1000 * 60 * 60 * 4));
    const salt = (coords.latitude * 1000 + coords.longitude) * 31 + daySeed;
    const angle = (salt % 360) * (Math.PI / 180);
    const radiusMeters = 800 + (Math.abs(salt) % 400);
    const deltaLat = (radiusMeters / 111320) * Math.cos(angle);
    const deltaLon = (radiusMeters / (111320 * Math.cos((coords.latitude * Math.PI) / 180))) * Math.sin(angle);

    return {
      latitude: coords.latitude + deltaLat,
      longitude: coords.longitude + deltaLon,
      isFuzzy: true,
      isFrozen: false,
    };
  }

  return { ...coords, isFuzzy: false, isFrozen: false };
}
