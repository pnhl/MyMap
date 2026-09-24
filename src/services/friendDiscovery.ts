import * as Location from 'expo-location';
import { Share } from 'react-native';
import { supabase } from './supabase';

export type FriendCandidate = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_path: string | null;
  distance_m?: number;
};

export type FriendConnection = FriendCandidate & {
  connection_id: string;
  relationship_status: 'pending' | 'accepted';
  direction: 'incoming' | 'outgoing' | 'accepted';
  created_at: string;
};

export type MyFriendProfile = {
  username: string | null;
  display_name: string;
  avatar_path: string | null;
  share_code: string;
  qr_payload: string;
};

function friendError(error: unknown): Error {
  const raw = error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: unknown }).message)
    : String(error);
  const message = raw.toLowerCase();
  if (message.includes('not_authenticated') || message.includes('authentication required')) return new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
  if (message.includes('username_unavailable') || message.includes('duplicate key')) return new Error('Username này đã được sử dụng. Hãy chọn tên khác.');
  if (message.includes('invalid_username') || message.includes('username must')) return new Error('Username cần 3–24 ký tự, chỉ gồm chữ thường, số và dấu gạch dưới.');
  if (message.includes('connection_exists')) return new Error('Hai bạn đã kết nối hoặc đã có lời mời đang chờ.');
  if (message.includes('invalid_target')) return new Error('Bạn không thể gửi lời mời cho chính mình.');
  return new Error(raw || 'Không thể kết nối máy chủ. Hãy thử lại.');
}

export async function getMyFriendProfile(): Promise<MyFriendProfile> {
  const { data, error } = await supabase.rpc('vc_get_my_friend_profile');
  if (error) throw friendError(error);
  const profile = (data as MyFriendProfile[] | null)?.[0];
  if (!profile?.share_code) throw new Error('Chưa thể tạo hồ sơ kết bạn. Hãy thử lại.');
  return profile;
}

export async function searchByUsername(query: string): Promise<FriendCandidate[]> {
  const q = query.trim().replace(/^@/, '').toLowerCase();
  if (q.length < 2) throw new Error('Nhập ít nhất 2 ký tự username để tìm kiếm.');
  const { data, error } = await supabase.rpc('vc_search_username', { p_query: q, p_limit: 20 });
  if (error) throw friendError(error);
  return (data ?? []) as FriendCandidate[];
}

export async function findByPhone(phoneE164: string): Promise<FriendCandidate[]> {
  const phone = phoneE164.replace(/[\s()-]/g, '').trim();
  if (!/^\+[1-9][0-9]{6,14}$/.test(phone)) throw new Error('Số điện thoại cần ở định dạng quốc tế, ví dụ +84901234567.');
  const { data, error } = await supabase.rpc('vc_find_by_phone', { p_phone_e164: phone });
  if (error) throw friendError(error);
  return (data ?? []) as FriendCandidate[];
}

export async function setUsername(username: string): Promise<string> {
  const clean = username.trim().replace(/^@/, '').toLowerCase();
  const { data, error } = await supabase.rpc('vc_set_username', { p_username: clean });
  if (error) throw friendError(error);
  return data as string;
}

export async function ensureShareCode(): Promise<string> {
  const { data, error } = await supabase.rpc('vc_ensure_share_code');
  if (error) throw friendError(error);
  if (!data) throw new Error('Chưa thể tạo mã kết bạn. Hãy thử lại.');
  return data as string;
}

export async function lookupShareCode(code: string): Promise<FriendCandidate[]> {
  const clean = code.trim().toUpperCase();
  const { data, error } = await supabase.rpc('vc_lookup_share_code', { p_code: clean });
  if (error) throw friendError(error);
  return (data ?? []) as FriendCandidate[];
}

export async function listConnections(): Promise<FriendConnection[]> {
  const { data, error } = await supabase.rpc('vc_list_connections');
  if (error) throw friendError(error);
  return (data ?? []) as FriendConnection[];
}

export async function sendFriendRequest(targetUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('vc_send_friend_request', { p_target_id: targetUserId });
  if (error) throw friendError(error);
  return data as string;
}

export async function respondFriendRequest(connectionId: string, accept: boolean) {
  const { data, error } = await supabase.rpc('vc_respond_connection', { p_connection_id: connectionId, p_accept: accept });
  if (error) throw friendError(error);
  return data;
}

export async function startNearbyDiscovery() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Cần quyền vị trí để tìm người dùng trong bán kính 500 m.');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { data, error } = await supabase.rpc('vc_start_nearby_discovery', { p_lat: pos.coords.latitude, p_lon: pos.coords.longitude, p_radius_m: 500 });
  if (error) throw friendError(error);
  return { sessionId: data as string, latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

export async function findNearby(latitude: number, longitude: number): Promise<FriendCandidate[]> {
  const { data, error } = await supabase.rpc('vc_nearby_users', { p_lat: latitude, p_lon: longitude, p_radius_m: 500 });
  if (error) throw friendError(error);
  return (data ?? []) as FriendCandidate[];
}

export async function stopNearbyDiscovery() {
  const { error } = await supabase.rpc('vc_stop_nearby_discovery');
  if (error) throw friendError(error);
}

export async function shareMyMapAccount(code: string, username?: string | null) {
  const identity = username ? `@${username}` : 'tôi';
  await Share.share({ title: 'Kết bạn với tôi trên MyMap', message: `Kết bạn với ${identity} trên MyMap. Mã chia sẻ: ${code}` });
}
