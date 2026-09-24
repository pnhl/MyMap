import { getLocationPoints, getPhotoPins } from '../db/database';
import { getHangoutHistory } from './hangoutBump';
import { getUnlockedHexCells } from './scratchMap';
import { getSavedPlaces } from './placeMetadata';

export interface WrappedStats {
  weekLabel: string;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  topPlaceName: string;
  topPlaceCategory?: string;
  photoCount: number;
  hangoutCount: number;
  unlockedHexCount: number;
  titleBadge: string;
  slides: {
    title: string;
    headline: string;
    description: string;
    icon: string;
    highlight: string;
    bgColor: string;
  }[];
}

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function generateWeeklyWrapped(): Promise<WrappedStats> {
  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const [allPoints, allPhotos, hangouts, hexCells, savedPlaces] = await Promise.all([
    getLocationPoints().catch(() => []),
    getPhotoPins().catch(() => []),
    getHangoutHistory().catch(() => []),
    getUnlockedHexCells().catch(() => []),
    getSavedPlaces().catch(() => []),
  ]);

  // Filter last 7 days
  const recentPoints = allPoints.filter(p => p.timestamp >= oneWeekAgo);
  const recentPhotos = allPhotos.filter(p => p.capturedAt >= oneWeekAgo);
  const recentHangouts = hangouts.filter(h => (h.startedAt || 0) >= oneWeekAgo);

  // Calculate distance
  let totalDistanceMeters = 0;
  for (let i = 1; i < recentPoints.length; i++) {
    const p1 = recentPoints[i - 1];
    const p2 = recentPoints[i];
    if (p1 && p2) {
      const d = haversineDistanceMeters(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
      if (d < 10000) {
        // ignore GPS jumps > 10km between adjacent points
        totalDistanceMeters += d;
      }
    }
  }

  const totalDistanceKm = Math.round((totalDistanceMeters / 1000) * 10) / 10;
  const totalDurationMinutes = Math.round(recentPoints.length * 0.5); // estimated active track minutes

  // Top place
  let topPlaceName = 'Chưa xác định';
  let topPlaceCategory = 'Địa điểm nổi bật';
  const firstPlace = savedPlaces[0];
  const firstPhoto = recentPhotos[0];
  if (firstPlace) {
    topPlaceName = firstPlace.name;
    topPlaceCategory = firstPlace.favorite ? 'Yêu thích' : 'Thân quen';
  } else if (firstPhoto && firstPhoto.placeName) {
    topPlaceName = firstPhoto.placeName;
  }

  // Determine Title Badge
  let titleBadge = 'Người Đi Lạc Mộng Mơ';
  if (totalDistanceKm > 50) {
    titleBadge = 'Tên Lửa Xuyên Phố';
  } else if (recentHangouts.length >= 2) {
    titleBadge = 'Bậc Thầy Cụng Máy';
  } else if (recentPhotos.length >= 3) {
    titleBadge = 'Kẻ Săn Hoàng Hôn';
  } else if (hexCells.length >= 15) {
    titleBadge = 'Khai Hoang Lục Địa';
  }

  const startDateStr = new Date(oneWeekAgo).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  });
  const endDateStr = new Date(now).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  });
  const weekLabel = `${startDateStr} - ${endDateStr}`;

  const slides = [
    {
      title: 'HÀNH TRÌNH TUẦN NÀY',
      headline: `${totalDistanceKm} km đã qua bánh xe`,
      description: `Bạn đã trải qua khoảng ${Math.max(15, totalDurationMinutes)} phút di chuyển khắp các cung đường đô thị.`,
      icon: 'map-marker-distance',
      highlight: `${totalDistanceKm} KM`,
      bgColor: '#158CC9',
    },
    {
      title: 'ĐỊA BÀN QUEN THUỘC',
      headline: topPlaceName,
      description: `Nơi bạn để lại nhiều dấu chân và lưu giữ nhiều kỷ niệm nhất trong suốt 7 ngày qua.`,
      icon: 'heart-pulse',
      highlight: topPlaceCategory,
      bgColor: '#734BD1',
    },
    {
      title: 'KẾT NỐI & KỶ NIỆM',
      headline: `${recentHangouts.length} lần cụng máy · ${recentPhotos.length} bức ảnh`,
      description: `Những khoảnh khắc chân thực bên bạn bè ngoài đời thật được ghim trực tiếp lên bản đồ.`,
      icon: 'camera-burst',
      highlight: `${recentPhotos.length} ẢNH`,
      bgColor: '#ED4366',
    },
    {
      title: 'MỞ CÕI BẢN ĐỒ',
      headline: `${hexCells.length} ô sương mù đã mở`,
      description: `Danh hiệu danh dự tuần này của bạn: ${titleBadge}! Hãy tiếp tục khám phá.`,
      icon: 'trophy',
      highlight: titleBadge,
      bgColor: '#1D9E74',
    },
  ];

  return {
    weekLabel,
    totalDistanceKm,
    totalDurationMinutes,
    topPlaceName,
    topPlaceCategory,
    photoCount: recentPhotos.length,
    hangoutCount: recentHangouts.length,
    unlockedHexCount: hexCells.length,
    titleBadge,
    slides,
  };
}
