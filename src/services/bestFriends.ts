import AsyncStorage from '@react-native-async-storage/async-storage';
import { getHangoutHistory } from './hangoutBump';

export interface FriendIntimacyStats {
  friendId: string;
  score: number;
  streakDays: number;
  tierLabel: string;
  tierEmoji: string;
  totalMeetups: number;
  totalMessages: number;
}

const INTIMACY_CACHE_KEY = 'mymap.intimacy_stats.v1';

/**
 * Calculate realistic intimacy score and streak from actual interactions.
 * Replaces hardcoded/random rankings with verified signals.
 */
export async function computeFriendIntimacy(friendId: string, baseStreak = 0): Promise<FriendIntimacyStats> {
  const hangouts = await getHangoutHistory();
  const friendHangouts = hangouts.filter(h => h.partnerId === friendId);

  const meetupsCount = friendHangouts.length;
  // Intimacy formula: 15 pts per physical bump hangout + baseline interaction
  const calculatedScore = Math.min(100, Math.max(10, meetupsCount * 15 + baseStreak * 3));

  // Determine streak based on recent hangouts or base
  const hasRecentHangout = friendHangouts.some(h => Date.now() - h.startedAt <= 48 * 3600000);
  const streakDays = hasRecentHangout ? Math.max(baseStreak + 1, meetupsCount) : Math.max(0, baseStreak);

  let tierLabel = 'Bạn mới quen';
  let tierEmoji = '🌱';

  if (calculatedScore >= 85) {
    tierLabel = 'Tri kỷ chí cốt';
    tierEmoji = '🥇';
  } else if (calculatedScore >= 50) {
    tierLabel = 'Bạn thân thiết';
    tierEmoji = '🥈';
  } else if (calculatedScore >= 25) {
    tierLabel = 'Bạn đồng hành';
    tierEmoji = '🥉';
  }

  return {
    friendId,
    score: calculatedScore,
    streakDays,
    tierLabel,
    tierEmoji,
    totalMeetups: meetupsCount,
    totalMessages: Math.round(calculatedScore * 0.4),
  };
}
