import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OfflineTilePack {
  id: string;
  name: string;
  centerLat: number;
  centerLon: number;
  tileCount: number;
  sizeBytes: number;
  downloadedAt: number;
}

const OFFLINE_PACKS_KEY = 'mymap.offline_packs.v1';
const TILES_DIR = `${FileSystem.documentDirectory || ''}offline_tiles/`;

export const PRESET_CITIES = [
  { id: 'hanoi', name: 'Hà Nội', lat: 21.0285, lon: 105.8542 },
  { id: 'danang', name: 'Đà Nẵng', lat: 16.0544, lon: 108.2022 },
  { id: 'hcmc', name: 'TP. Hồ Chí Minh', lat: 10.8231, lon: 106.6297 },
];

function lon2tile(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

export async function getDownloadedPacks(): Promise<OfflineTilePack[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_PACKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function downloadCityOfflinePack(
  cityId: string,
  onProgress?: (progressPercent: number) => void
): Promise<OfflineTilePack> {
  const city = PRESET_CITIES.find(c => c.id === cityId) || PRESET_CITIES[0];
  if (!city) {
    throw new Error('Thành phố không hợp lệ');
  }

  // Ensure tiles directory exists
  const dirInfo = await FileSystem.getInfoAsync(TILES_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(TILES_DIR, { intermediates: true });
  }

  // Generate tiles for zoom 12 and 13 (covering the metropolitan area efficiently)
  const zoomLevels = [12, 13];
  const tileUrls: { z: number; x: number; y: number; url: string; localPath: string }[] = [];

  for (const z of zoomLevels) {
    const centerX = lon2tile(city.lon, z);
    const centerY = lat2tile(city.lat, z);

    // 3x3 grid around center tile for compact offline coverage
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const x = centerX + dx;
        const y = centerY + dy;
        const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
        const localPath = `${TILES_DIR}${z}_${x}_${y}.png`;
        tileUrls.push({ z, x, y, url, localPath });
      }
    }
  }

  let downloadedCount = 0;
  let totalBytes = 0;

  for (let i = 0; i < tileUrls.length; i++) {
    const item = tileUrls[i];
    if (!item) continue;
    try {
      const existing = await FileSystem.getInfoAsync(item.localPath);
      if (existing.exists && existing.size) {
        totalBytes += existing.size;
      } else {
        const res = await FileSystem.downloadAsync(item.url, item.localPath, {
          headers: { 'User-Agent': 'MyMap-Offline-Sync/0.8.2' },
        });
        if (res.status === 200) {
          const info = await FileSystem.getInfoAsync(item.localPath);
          if (info.exists && info.size) totalBytes += info.size;
        }
      }
    } catch {
      // Ignore individual tile failure (e.g. offline or rate limit)
    }

    downloadedCount++;
    if (onProgress) {
      onProgress(Math.round((downloadedCount / tileUrls.length) * 100));
    }
  }

  const newPack: OfflineTilePack = {
    id: city.id,
    name: city.name,
    centerLat: city.lat,
    centerLon: city.lon,
    tileCount: downloadedCount,
    sizeBytes: totalBytes,
    downloadedAt: Date.now(),
  };

  const currentPacks = await getDownloadedPacks();
  const filtered = currentPacks.filter(p => p.id !== city.id);
  filtered.push(newPack);
  await AsyncStorage.setItem(OFFLINE_PACKS_KEY, JSON.stringify(filtered));

  return newPack;
}

export async function clearOfflinePacks(): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(TILES_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(TILES_DIR, { idempotent: true });
    }
    await AsyncStorage.removeItem(OFFLINE_PACKS_KEY);
  } catch {
    // ignore
  }
}
