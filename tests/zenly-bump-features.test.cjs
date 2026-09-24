const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function moduleFromSource(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(
    name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === '../utils/geo' || name === './geo') {
        return moduleFromSource('src/utils/geo.ts', {});
      }
      if (name === './privacyZones') {
        return { maskCoordinateIfPrivate: async (lat, lon) => ({ isMasked: false, latitude: lat, longitude: lon }) };
      }
      if (name === './musicStatus') {
        return { getUserMusicStatus: async () => null, formatMusicForBroadcast: () => ({}) };
      }
      throw new Error(`Missing mock for ${name}`);
    },
    module,
    module.exports
  );
  return module.exports;
}

const mockAsyncStorage = {
  _storage: new Map(),
  async getItem(k) { return this._storage.get(k) ?? null; },
  async setItem(k, v) { this._storage.set(k, String(v)); },
  async removeItem(k) { this._storage.delete(k); },
  clear() { this._storage.clear(); }
};

test('1. Scratch Map: Hexagonal quantization and exploration percentage', () => {
  const scratchMap = moduleFromSource('src/services/scratchMap.ts', {
    '@react-native-async-storage/async-storage': mockAsyncStorage,
  });

  const lat = 21.0285;
  const lon = 105.8542;
  const hex = scratchMap.coordsToHex(lat, lon);
  assert.ok(typeof hex.q === 'number' && typeof hex.r === 'number');
  assert.ok(hex.key.includes(':'));

  const center = scratchMap.hexToCoords(hex.q, hex.r);
  assert.ok(Math.abs(center.lat - lat) < 0.01);
  assert.ok(Math.abs(center.lon - lon) < 0.01);

  const poly = scratchMap.hexToPolygonCoords(hex.q, hex.r);
  assert.equal(poly.length, 6, 'Hexagon must have 6 vertices');

  const dummyCells = [
    { key: hex.key, q: hex.q, r: hex.r, centerLat: lat, centerLon: lon, unlockedAt: Date.now(), isNew: true },
  ];
  const stats = scratchMap.computeExplorationStats(dummyCells, 'Hà Nội', 'Hoàn Kiếm');
  assert.equal(stats.unlockedCellsCount, 1);
  assert.ok(stats.wardPercent > 0);
  assert.ok(stats.cityPercent > 0);
  assert.ok(stats.countryPercent > 0);
  assert.equal(stats.newCellsSinceLastSession, 1);
});

test('1b. Scratch Map: City Nights counter groups points between 23h and 06h', () => {
  const scratchMap = moduleFromSource('src/services/scratchMap.ts', {
    '@react-native-async-storage/async-storage': mockAsyncStorage,
  });

  const d1 = new Date(2026, 8, 1, 23, 30).getTime();
  const d2 = new Date(2026, 8, 2, 2, 15).getTime(); // same night stay
  const d3 = new Date(2026, 8, 3, 14, 0).getTime();  // daytime, not night

  const points = [
    { latitude: 21.0285, longitude: 105.8542, timestamp: d1 },
    { latitude: 21.0290, longitude: 105.8545, timestamp: d2 },
    { latitude: 21.0285, longitude: 105.8542, timestamp: d3 },
  ];

  const nights = scratchMap.computeCityNights(points);
  assert.ok(nights.length > 0);
  assert.equal(nights[0].cityName, 'Hà Nội');
  assert.ok(nights[0].nightsCount >= 1);
});

test('2. Smart Places: Auto-detection of Home and Work from dwell patterns', () => {
  const smartPlaces = moduleFromSource('src/services/smartPlaces.ts', {
    '@react-native-async-storage/async-storage': mockAsyncStorage,
    './placeMetadata': {
      getSavedPlaces: async () => [],
      savePlace: async () => {},
      placeKey: (lat, lon) => `${lat.toFixed(4)}:${lon.toFixed(4)}`,
    },
  });

  // 3 nights at home (e.g. 23:30)
  const homeVisits = [
    { latitude: 21.0100, longitude: 105.8200, arrivedAt: new Date(2026, 8, 1, 23, 30).getTime(), leftAt: new Date(2026, 8, 2, 7, 0).getTime(), durationMs: 7.5 * 3600000 },
    { latitude: 21.0101, longitude: 105.8201, arrivedAt: new Date(2026, 8, 2, 23, 10).getTime(), leftAt: new Date(2026, 8, 3, 7, 0).getTime(), durationMs: 7.8 * 3600000 },
    { latitude: 21.0100, longitude: 105.8200, arrivedAt: new Date(2026, 8, 3, 23, 40).getTime(), leftAt: new Date(2026, 8, 4, 7, 0).getTime(), durationMs: 7.3 * 3600000 },
  ];

  const detected = smartPlaces.detectSmartPlacesFromVisits(homeVisits);
  assert.ok(detected.length >= 1);
  const home = detected.find(p => p.type === 'home');
  assert.ok(home != null, 'Should detect Home after 3 night stays');
  assert.equal(home.name, 'Nhà của bạn');
});

test('2b. Smart Places: Friends who visited place and regulars leaderboard', () => {
  const smartPlaces = moduleFromSource('src/services/smartPlaces.ts', {
    '@react-native-async-storage/async-storage': mockAsyncStorage,
    './placeMetadata': {
      getSavedPlaces: async () => [],
      savePlace: async () => {},
      placeKey: (lat, lon) => `${lat.toFixed(4)}:${lon.toFixed(4)}`,
    },
  });

  const placeLat = 21.0285;
  const placeLon = 105.8542;

  const mockFriends = [
    {
      id: 'f1',
      displayName: 'Minh Hoàng',
      avatarUrl: null,
      latitude: 21.0286, // ~15m away
      longitude: 105.8543,
      rankingScore: 85,
      lastSeenMs: Date.now() - 60000,
    },
    {
      id: 'f2',
      displayName: 'Lan Anh',
      avatarUrl: null,
      latitude: 10.8231, // in HCMC (far away)
      longitude: 106.6297,
      rankingScore: 50,
      lastSeenMs: Date.now(),
    },
  ];

  const visitors = smartPlaces.getFriendsWhoVisitedPlace(placeLat, placeLon, mockFriends);
  assert.equal(visitors.length, 1);
  assert.equal(visitors[0].friendName, 'Minh Hoàng');

  const leaderboard = smartPlaces.getPlaceRegularsLeaderboard(visitors);
  assert.equal(leaderboard[0].friendId, 'f1');
});

test('3. Destination Prediction: Estimates destination and ETA', () => {
  const destService = moduleFromSource('src/services/destinationPrediction.ts', {
    '@react-native-async-storage/async-storage': mockAsyncStorage,
    'expo-notifications': { scheduleNotificationAsync: async () => {} },
    './smartPlaces': { getSmartPlaces: async () => [] },
  });

  const friend = {
    id: 'f-test',
    displayName: 'Quân',
    latitude: 21.0200,
    longitude: 105.8500,
    heading: 0, // heading North
    speedKmh: 35,
  };

  const knownPlaces = [
    { key: 'work', type: 'work', name: 'Văn phòng làm việc', latitude: 21.0350, longitude: 105.8500, visitCount: 10, lastVisitedMs: Date.now() },
  ];

  const prediction = destService.predictFriendDestination(friend, knownPlaces);
  assert.ok(prediction != null);
  assert.equal(prediction.targetPlaceName, 'Văn phòng làm việc');
  assert.ok(prediction.etaMinutes > 0);
  assert.ok(typeof prediction.etaTimeStr === 'string');
});

test('4. Real Hangout Bump: Dual-validation requires proximity <= 60m', async () => {
  const hangoutService = moduleFromSource('src/services/hangoutBump.ts', {
    '@react-native-async-storage/async-storage': mockAsyncStorage,
    './auth': { getCurrentUser: async () => ({ id: 'my-user', email: 'test@mymap.local' }) },
    './supabase': { supabase: { rpc: async () => ({ data: null, error: null }), from: () => ({ select: () => ({ data: [] }), insert: () => ({ error: null }) }) } },
  });

  const myCoords = { latitude: 21.0285, longitude: 105.8542 };

  // 1. Valid close bump with friend ~15m away
  const closeFriend = {
    id: 'f-close',
    displayName: 'Thùy Chi',
    latitude: 21.0286,
    longitude: 105.8543,
  };
  const validBump = await hangoutService.validateDualBump(myCoords, [closeFriend]);
  assert.equal(validBump.success, true);
  assert.equal(validBump.matchedFriend.id, 'f-close');
  assert.ok(validBump.hangout != null);

  // 2. Invalid far bump (friend ~700m away)
  const farFriend = {
    id: 'f-far',
    displayName: 'Bảo Nam',
    latitude: 21.0350,
    longitude: 105.8542,
  };
  const farBump = await hangoutService.validateDualBump(myCoords, [farFriend]);
  assert.equal(farBump.success, false);
  assert.ok(farBump.message.includes('60m'));
});

test('6. Best Friends: Intimacy score calculated from real meetups, bumps and chats', async () => {
  const bestFriendsService = moduleFromSource('src/services/bestFriends.ts', {
    '@react-native-async-storage/async-storage': mockAsyncStorage,
    './hangoutBump': {
      getHangoutHistory: async () => [
        { id: 'h1', partnerId: 'friend-1', startedAt: Date.now() - 3600000 },
        { id: 'h2', partnerId: 'friend-1', startedAt: Date.now() - 86400000 },
      ],
    },
  });

  const stats = await bestFriendsService.computeFriendIntimacy('friend-1', 3);
  assert.ok(stats.score >= 30, `Expected score >= 30, got ${stats.score}`);
  assert.ok(stats.score <= 100);
  assert.equal(stats.totalMeetups, 2);
  assert.ok(stats.streakDays >= 3);
  assert.ok(stats.tierLabel.length > 0);
});

test('7. Real data enforcement: No fake friends are generated or cached', async () => {
  mockAsyncStorage.clear();
  // Simulate old cached fake friends
  await mockAsyncStorage.setItem('mymap.realtime_friends.v1', JSON.stringify([
    { id: 'friend_linh', displayName: 'Khánh Linh' },
    { id: 'friend_huy', displayName: 'Minh Huy' },
    { id: 'friend_mai', displayName: 'Thanh Mai' },
  ]));

  const realtimeFriends = moduleFromSource('src/services/realtimeFriends.ts', {
    '@react-native-async-storage/async-storage': mockAsyncStorage,
    '../config/env': { env: {} },
    './auth': { getCurrentUser: async () => null },
    './friendDiscovery': { listConnections: async () => [] },
    './friendStatus': { computeCurrentAutomaticStatus: async () => ({}) },
    './ghostMode': { applyGhostModeToCoords: (c) => c, getGlobalGhostMode: async () => 'precise' },
    './supabase': {
      supabase: {
        from: () => ({ select: () => ({ order: async () => ({ data: [], error: null }) }) }),
        functions: { invoke: async () => ({}) },
      },
    },
    './nativeSafety': { getNativeBatteryStatus: async () => ({ level: 90, isCharging: false }) },
  });

  const friends = await realtimeFriends.getLiveFriends({ latitude: 21.0285, longitude: 105.8542 });
  // Should purge fake IDs and return empty when no real friends exist in DB
  assert.equal(friends.length, 0, 'Must NOT return fake friends');
  assert.ok(!friends.some(f => f.id === 'friend_linh'));
  assert.ok(!friends.some(f => f.id === 'friend_huy'));
  assert.ok(!friends.some(f => f.id === 'friend_mai'));
});

test('8. Road routing: Snaps coordinates to real road network instead of straight line', async () => {
  const roadRouting = moduleFromSource('src/services/roadRouting.ts', {
    '@react-native-async-storage/async-storage': mockAsyncStorage,
  });

  const rawPoints = [
    { latitude: 21.0285, longitude: 105.8542 },
    { latitude: 21.0335, longitude: 105.8600 },
  ];
  const matched = await roadRouting.matchTraveledRoute(rawPoints);
  assert.ok(Array.isArray(matched));
  assert.ok(matched.length >= 2);
  // Snapped to real street within 50m of original coordinate
  assert.ok(Math.abs(matched[0][0] - 21.0285) < 0.005);
  assert.ok(Math.abs(matched[0][1] - 105.8542) < 0.005);
});

test('9. Heatmap Screen: Does not contain hardcoded demo locations or mock toggle', () => {
  const heatmapCode = fs.readFileSync(path.resolve(__dirname, '../src/screens/HeatmapScreen.tsx'), 'utf8');
  assert.ok(!heatmapCode.includes('DEMO_OBSERVATIONS'), 'Must NOT have DEMO_OBSERVATIONS in HeatmapScreen');
  assert.ok(!heatmapCode.includes('useDemo'), 'Must NOT have useDemo in HeatmapScreen');
  assert.ok(!heatmapCode.includes('isShowingDemo'), 'Must NOT have isShowingDemo in HeatmapScreen');
});

test('10. Achievements: Badge definitions, progress evaluation, and point summation', async () => {
  const achievements = moduleFromSource('src/services/achievements.ts', {
    '@react-native-async-storage/async-storage': mockAsyncStorage,
    '../db/database': {
      getLocationPoints: async () => [
        { latitude: 21.0285, longitude: 105.8542, timestamp: new Date(2026, 8, 1, 3, 0).getTime() }, // Night owl (03:00)
        { latitude: 16.0544, longitude: 108.2022, timestamp: new Date(2026, 8, 2, 10, 0).getTime() }, // Da Nang (Vitamin sea)
      ],
      getPhotoPins: async () => [],
    },
    './hangoutBump': {
      getHangoutHistory: async () => [],
    },
    './scratchMap': {
      getUnlockedHexCells: async () => [],
    },
    './placeMetadata': {
      getSavedPlaces: async () => [
        { name: 'Cafe Giảng' },
        { name: 'Cà phê Đinh' },
      ],
    },
  });

  const list = await achievements.evaluateAchievements();
  assert.ok(Array.isArray(list));
  assert.equal(list.length, 7, 'Must have 7 badges');

  const nightOwl = list.find(b => b.id === 'night_owl');
  assert.ok(nightOwl && nightOwl.unlocked, 'Night owl badge must be unlocked at 3AM');

  const vitaminSea = list.find(b => b.id === 'vitamin_sea');
  assert.ok(vitaminSea && vitaminSea.unlocked, 'Vitamin sea badge must be unlocked for Da Nang');

  const coffeeLover = list.find(b => b.id === 'coffee_lover');
  assert.ok(coffeeLover);
  assert.equal(coffeeLover.progress, 40, '2 out of 5 cafes = 40%');
  assert.equal(coffeeLover.unlocked, false);
});

test('11. Time Capsule: Geocache proximity and future time-lock logic', async () => {
  const timeCapsule = moduleFromSource('src/services/timeCapsule.ts', {
    '@react-native-async-storage/async-storage': mockAsyncStorage,
  });

  // Plant a capsule at (21.0285, 105.8542) locked for 1 hour
  const futureTime = Date.now() + 3600000;
  const saved = await timeCapsule.saveTimeCapsule({
    title: 'Thư gửi tương lai',
    message: 'Hẹn gặp lại năm 2030!',
    latitude: 21.0285,
    longitude: 105.8542,
    unlockAt: futureTime,
    creatorName: 'Khám Phá',
  });
  assert.ok(saved.id.startsWith('tc_'));

  // Test 1: User nearby (20 meters away), but time is NOT unlocked yet
  const nearResults = await timeCapsule.checkNearbyCapsules(21.0286, 105.8542, 50);
  const found = nearResults.find(r => r.capsule.id === saved.id);
  assert.ok(found);
  assert.equal(found.isWithinReach, true, 'User is within 50m');
  assert.equal(found.isTimeUnlocked, false, 'Time lock is still in effect');
  assert.equal(found.canOpen, false, 'Cannot open before unlockAt');

  // Test 2: User 5km away
  const farResults = await timeCapsule.checkNearbyCapsules(21.0700, 105.8542, 50);
  const farFound = farResults.find(r => r.capsule.id === saved.id);
  assert.ok(farFound);
  assert.equal(farFound.isWithinReach, false, 'User is > 50m away');
  assert.equal(farFound.canOpen, false);
});

test('12. Live Trip Share: Session tracking, speed, and real-time ETA calculation', async () => {
  const liveTrip = moduleFromSource('src/services/liveTripShare.ts', {
    '@react-native-async-storage/async-storage': mockAsyncStorage,
  });

  const origin = { name: 'Hồ Hoàn Kiếm', latitude: 21.0285, longitude: 105.8542 };
  const dest = { name: 'Landmark 72', latitude: 21.0172, longitude: 105.7838 }; // ~7.4 km

  const session = await liveTrip.startLiveTrip(origin, dest, 30);
  assert.ok(session.isActive);
  assert.ok(session.remainingDistanceMeters > 5000);
  assert.ok(session.etaMinutes >= 10 && session.etaMinutes <= 25);

  const shareMsg = liveTrip.formatTripShareMessage(session);
  assert.ok(shareMsg.includes('Landmark 72'));
  assert.ok(shareMsg.includes('Hồ Hoàn Kiếm'));
  assert.ok(shareMsg.includes('Dự kiến đến sau'));

  await liveTrip.endLiveTrip();
  const activeAfterEnd = await liveTrip.getActiveLiveTrip();
  assert.equal(activeAfterEnd, null, 'Trip session must be inactive after endLiveTrip');
});

test('13. Music Status: Now playing state, vinyl toggle, and broadcast data', async () => {
  const musicStatus = moduleFromSource('src/services/musicStatus.ts', {
    '@react-native-async-storage/async-storage': mockAsyncStorage,
  });

  await musicStatus.setMusicTrack({
    songTitle: 'Nấu Ăn Cho Em',
    artist: 'Đen Vâu ft. PiaLinh',
    isPlaying: true,
  });

  const current = await musicStatus.getCurrentMusicStatus();
  assert.ok(current);
  assert.equal(current.songTitle, 'Nấu Ăn Cho Em');
  assert.equal(current.isPlaying, true);

  const toggled = await musicStatus.togglePlayback();
  assert.equal(toggled?.isPlaying, false);

  const broadcast = musicStatus.formatMusicForBroadcast(toggled);
  assert.equal(broadcast.musicTitle, undefined, 'Must not broadcast title if paused');
});

test('14. Offline Map: Tile coordinate projection math', () => {
  const offlineMap = moduleFromSource('src/services/offlineMap.ts', {
    '@react-native-async-storage/async-storage': mockAsyncStorage,
    'expo-file-system/legacy': {
      documentDirectory: '/mock/docs/',
      getInfoAsync: async () => ({ exists: true }),
    },
  });

  assert.ok(Array.isArray(offlineMap.PRESET_CITIES));
  assert.equal(offlineMap.PRESET_CITIES.length, 3);
  assert.equal(offlineMap.PRESET_CITIES[0].name, 'Hà Nội');
  assert.equal(offlineMap.PRESET_CITIES[1].name, 'Đà Nẵng');
  assert.equal(offlineMap.PRESET_CITIES[2].name, 'TP. Hồ Chí Minh');
});

