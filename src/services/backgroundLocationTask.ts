import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { insertLocationPoint } from '../db/database';
import { distanceMeters } from '../utils/geo';
import { syncPendingSosEvents } from './liveSafety';

export const LOCATION_TASK_NAME = 'vibecoding-background-location';

let lastPoint: { latitude: number; longitude: number; timestamp: number } | null = null;
let stationaryAnchor: { latitude: number; longitude: number; firstTimestamp: number } | null = null;
let isAutoPaused = false;

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };

  // Opportunistically sync pending offline SOS events whenever location task fires
  void syncPendingSosEvents().catch(() => {});

  for (const location of locations) {
    const c = location.coords;

    // Coarse-only Android / Fire OS devices can report 70-100 m fixes. Keep a
    // usable breadcrumb instead of silently producing an empty journey.
    if (c.accuracy != null && c.accuracy > 120) {
      continue;
    }

    const current = {
      latitude: c.latitude,
      longitude: c.longitude,
      timestamp: location.timestamp,
    };

    if (lastPoint) {
      const dist = distanceMeters(lastPoint, current);
      const timeDeltaSeconds = Math.max(1, (current.timestamp - lastPoint.timestamp) / 1000);
      const speedMps = dist / timeDeltaSeconds;

      // 2. Filter speed jump: Impossible terrestrial speed (> 150 km/h = ~41.6 m/s)
      if (speedMps > 42) {
        continue;
      }

      // 3. Filter indoor drift: If moved less than 8 meters and accuracy is mediocre (> 25m)
      if (dist < 8 && c.accuracy != null && c.accuracy > 25) {
        continue;
      }

      // 4. Auto-pause detection when standing still in same spot
      if (!stationaryAnchor) {
        stationaryAnchor = { latitude: current.latitude, longitude: current.longitude, firstTimestamp: current.timestamp };
      } else {
        const anchorDist = distanceMeters(stationaryAnchor, current);
        if (anchorDist <= 18) {
          const stayDurationMs = current.timestamp - stationaryAnchor.firstTimestamp;
          if (stayDurationMs >= 5 * 60 * 1000) {
            // Stationary for > 5 minutes: auto-pause duplicate points
            if (!isAutoPaused) {
              isAutoPaused = true;
            }
            // Keep a sparse 10-minute heartbeat. It confirms that recording is
            // alive without flooding the database while the user is stationary.
            if (current.timestamp - lastPoint.timestamp < 10 * 60 * 1000) continue;
          }
        } else {
          // Moved outside stationary radius (> 18m): auto-resume tracking
          stationaryAnchor = { latitude: current.latitude, longitude: current.longitude, firstTimestamp: current.timestamp };
          isAutoPaused = false;
        }
      }
    }

    lastPoint = current;

    await insertLocationPoint({
      latitude: c.latitude,
      longitude: c.longitude,
      accuracy: c.accuracy ?? null,
      altitude: c.altitude ?? null,
      speed: c.speed ?? null,
      heading: c.heading ?? null,
      timestamp: location.timestamp,
    });
  }
});
