import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  findByPhone,
  findNearby,
  getMyFriendProfile,
  listConnections,
  lookupShareCode,
  respondFriendRequest,
  searchByUsername,
  sendFriendRequest,
  setUsername,
  shareMyMapAccount,
  startNearbyDiscovery,
  stopNearbyDiscovery,
  type FriendCandidate,
  type FriendConnection,
} from '../services/friendDiscovery';
import { getCurrentSession } from '../services/auth';
import { GlassButton, GlassSurface, IconBadge, glassColors, useResponsiveLayout, type IconName } from '../ui/glass';
import { EmptyGlass, ScreenScaffold, SectionTitle } from '../ui/ScreenScaffold';
import { AccountQRCode } from '../ui/AccountQRCode';
import { Text } from '../ui/Text';
import { NativeAdCard } from '../components/NativeAdCard';
import { AccountQRScannerModal } from '../components/AccountQRScannerModal';

type Mode = 'username' | 'phone' | 'code' | 'nearby';
const methods: { mode: Mode; icon: IconName; title: string; tone: 'cyan' | 'mint' | 'violet' }[] = [
  { mode: 'username', icon: 'at', title: 'Tìm bằng\n@username', tone: 'cyan' },
  { mode: 'phone', icon: 'phone', title: 'Tìm bằng\nsố điện thoại', tone: 'mint' },
  { mode: 'code', icon: 'qrcode-scan', title: 'Quét mã QR', tone: 'violet' },
  { mode: 'nearby', icon: 'map-marker', title: 'Bạn bè\nxung quanh 500 m', tone: 'cyan' },
];

function Avatar({ candidate }: { candidate: FriendCandidate }) {
  return (
    <View style={s.avatar}>
      {/^(https|file):\/\//.test(candidate.avatar_path || '')
        ? <Image source={{ uri: candidate.avatar_path! }} style={s.avatarImage} />
        : <MaterialCommunityIcons name="account" size={27} color={glassColors.cyan} />}
    </View>
  );
}

export default function FriendsScreen() {
  const nav = useNavigation<any>();
  const r = useResponsiveLayout();
  const searchInput = useRef<TextInput>(null);
  const pending = useRef(false);
  const [mode, setMode] = useState<Mode>('username');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FriendCandidate[]>([]);
  const [connections, setConnections] = useState<FriendConnection[]>([]);
  const [username, setUser] = useState('');
  const [code, setCode] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [searched, setSearched] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const connectionByUser = useMemo(
    () => new Map(connections.map(connection => [connection.user_id, connection])),
    [connections],
  );
  const incoming = connections.filter(connection => connection.direction === 'incoming');
  const accepted = connections.filter(connection => connection.direction === 'accepted');

  const refreshConnections = useCallback(async () => {
    setConnections(await listConnections());
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setInitializing(true);
    setError(null);
    void getCurrentSession().then(async session => {
      if (!active) return;
      setSignedIn(Boolean(session));
      setCode('');
      setUser('');
      setConnections([]);
      if (!session) return;
      try {
        const [profile, currentConnections] = await Promise.all([getMyFriendProfile(), listConnections()]);
        if (!active) return;
        setCode(profile.share_code);
        setUser(profile.username ?? '');
        setConnections(currentConnections);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : String(loadError));
      }
    }).finally(() => {
      if (active) setInitializing(false);
    });
    return () => {
      active = false;
      void stopNearbyDiscovery().catch(() => {});
    };
  }, []));

  async function action(work: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await work();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : String(actionError));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function performSearch(selected: Mode = mode, text = query) {
    setSearched(true);
    setResults([]);
    if (!signedIn) throw new Error('Đăng nhập để tìm và kết bạn trên MyMap.');
    let found: FriendCandidate[] = [];
    if (selected === 'username') found = await searchByUsername(text);
    if (selected === 'phone') found = await findByPhone(text);
    if (selected === 'code') found = await lookupShareCode(text);
    if (selected === 'nearby') {
      const pos = await startNearbyDiscovery();
      found = await findNearby(pos.latitude, pos.longitude);
    }
    setResults(found);
  }

  function selectMethod(next: Mode) {
    if (busy) return;
    setMode(next);
    setQuery('');
    setResults([]);
    setSearched(false);
    setError(null);
    setStatus(null);
    if (next !== 'nearby' && next !== 'code') requestAnimationFrame(() => searchInput.current?.focus());
  }

  async function connect(candidate: FriendCandidate) {
    const relationship = connectionByUser.get(candidate.user_id);
    if (relationship?.direction === 'incoming') {
      await respondFriendRequest(relationship.connection_id, true);
      await refreshConnections();
      setStatus(`Bạn và ${candidate.display_name || '@' + candidate.username} đã trở thành bạn bè.`);
      return;
    }
    if (relationship) return;
    await sendFriendRequest(candidate.user_id);
    await refreshConnections();
    setStatus('Đã gửi lời mời kết bạn.');
  }

  function relationLabel(candidate: FriendCandidate) {
    const relationship = connectionByUser.get(candidate.user_id);
    if (relationship?.direction === 'incoming') return 'Chấp nhận';
    if (relationship?.direction === 'outgoing') return 'Đã gửi';
    if (relationship?.direction === 'accepted') return 'Bạn bè';
    return 'Kết bạn';
  }

  return (
    <ScreenScaffold title="Thêm bạn bè" subtitle="Kết nối, khám phá và cùng tạo nên những hành trình đáng nhớ" icon="account-group" iconTone="violet" quote="Bạn bè là những điểm đến tuyệt vời nhất" onSearch={() => searchInput.current?.focus()}>
      <View style={s.methods}>{methods.map(item => (
        <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === item.mode, disabled: busy }} disabled={busy} key={item.mode} style={{ width: r.width < 360 || r.fontScale > 1.2 ? '48%' : '23.2%' }} onPress={() => selectMethod(item.mode)}>
          <GlassSurface tone={item.tone} style={[s.method, mode === item.mode && s.methodActive]}>
            <IconBadge name={item.icon} tone={item.tone} size={26} />
            <Text style={s.methodTitle}>{item.title}</Text>
          </GlassSurface>
        </Pressable>
      ))}</View>

      <Pressable accessibilityRole="button" accessibilityLabel="Người thân tin cậy & Cứu trợ SOS" onPress={() => nav.navigate('SOS')}>
        <GlassSurface tone="rose" style={s.sos}>
          <IconBadge name="shield-alert" tone="rose" size={24} />
          <View style={s.flex}><Text style={s.sosTitle}>Người thân tin cậy & Cứu trợ SOS</Text><Text style={s.sosBody}>Thiết lập số khẩn cấp, SMS tự động và định vị khi gặp sự cố</Text></View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#FF93AD" />
        </GlassSurface>
      </Pressable>

      <GlassSurface style={s.account}>
        <View style={s.accountCopy}>
          <View style={s.heading}><MaterialCommunityIcons name="account-group" size={22} color={glassColors.purple} /><Text style={s.section}>Mã của tôi</Text></View>
          <Text style={s.muted}>{username ? `Tài khoản @${username}` : 'Đặt username để bạn bè tìm thấy bạn dễ hơn'}</Text>
          {code ? <>
            <Pressable accessibilityRole="button" accessibilityLabel="Chia sẻ mã kết bạn" onPress={() => void shareMyMapAccount(code, username)} style={s.codeBox}>
              <Text selectable style={s.code}>{code}</Text><MaterialCommunityIcons name="share-variant" size={24} color={glassColors.cyan} />
            </Pressable>
            <Text style={s.shareHint}>Chạm để chia sẻ mã kết bạn</Text>
          </> : <GlassButton tone="neutral" onPress={() => signedIn ? void action(async () => setCode((await getMyFriendProfile()).share_code)) : nav.navigate('Login')} disabled={busy || initializing}>
            <Text style={s.white}>{signedIn ? 'Tạo mã kết bạn' : 'Đăng nhập để tạo mã'}</Text>
          </GlassButton>}
        </View>
        <GlassSurface tone="violet" style={s.qrBox}>{code ? <AccountQRCode code={code} size={r.width < 360 ? 90 : 104} /> : <MaterialCommunityIcons name="qrcode" size={66} color="#819AC3" />}<Text style={s.qrLabel}>{code ? 'Quét để kết bạn' : 'Chưa có mã QR'}</Text></GlassSurface>
      </GlassSurface>

      {incoming.length > 0 && <>
        <SectionTitle>Lời mời đang chờ ({incoming.length})</SectionTitle>
        {incoming.map(request => <GlassSurface key={request.connection_id} tone="violet" style={s.person}>
          <Avatar candidate={request} />
          <View style={s.personCopy}><Text style={s.name}>{request.display_name || request.username || 'Người dùng MyMap'}</Text><Text style={s.muted}>{request.username ? '@' + request.username : ''} muốn kết bạn</Text></View>
          <View style={s.requestActions}>
            <GlassButton tone="neutral" disabled={busy} onPress={() => void action(async () => { await respondFriendRequest(request.connection_id, false); await refreshConnections(); setStatus('Đã từ chối lời mời.'); })}><Text style={s.white}>Bỏ qua</Text></GlassButton>
            <GlassButton tone="purple" disabled={busy} onPress={() => void action(async () => { await respondFriendRequest(request.connection_id, true); await refreshConnections(); setStatus('Đã chấp nhận lời mời kết bạn.'); })}><Text style={s.white}>Đồng ý</Text></GlassButton>
          </View>
        </GlassSurface>)}
      </>}

      <SectionTitle action={accepted.length > 0 ? <Text style={s.friendCount}>{accepted.length} người</Text> : undefined}>Bạn bè của tôi</SectionTitle>
      {accepted.length > 0 ? <View style={s.friendList}>
        {accepted.map(friend => <Pressable
          key={friend.connection_id}
          accessibilityRole="button"
          accessibilityLabel={`Xem ${friend.display_name || friend.username || 'bạn bè'} trên bản đồ`}
          onPress={() => nav.navigate('Map', { focusFriendId: friend.user_id })}
        >
          <GlassSurface tone="mint" style={s.friendRow}>
            <Avatar candidate={friend} />
            <View style={s.personCopy}>
              <Text style={s.name}>{friend.display_name || friend.username || 'Người dùng MyMap'}</Text>
              <Text style={s.muted}>{friend.username ? `@${friend.username}` : 'Đã kết bạn'} · chạm để mở bản đồ</Text>
            </View>
            <View style={s.friendMapButton}><MaterialCommunityIcons name="map-marker-outline" size={21} color={glassColors.green} /></View>
          </GlassSurface>
        </Pressable>)}
      </View> : !initializing && !error ? <EmptyGlass
        icon="account-multiple-outline"
        title="Chưa có bạn bè trong danh sách"
        body="Lời mời đã chấp nhận sẽ xuất hiện tại đây, kể cả khi người đó đang ngoại tuyến."
      /> : null}

      <GlassSurface style={s.search}>
        <View style={s.heading}><IconBadge name={mode === 'nearby' ? 'radar' : 'account-search-outline'} size={23} /><View style={s.searchCopy}><Text style={s.section}>{mode === 'nearby' ? 'Gợi ý bạn bè xung quanh' : mode === 'code' ? 'Quét QR hoặc nhập mã' : 'Tìm người dùng'}</Text><Text style={s.muted}>{mode === 'nearby' ? 'Chỉ người cũng đang bật khám phá trong 500 m' : 'Tìm bằng thông tin được người dùng cho phép'}</Text></View></View>
        {mode !== 'nearby' && <TextInput ref={searchInput} accessibilityLabel="Thông tin tìm bạn" style={s.input} value={query} onChangeText={setQuery} autoCapitalize={mode === 'code' ? 'characters' : 'none'} keyboardType={mode === 'phone' ? 'phone-pad' : 'default'} placeholder={mode === 'username' ? 'Nhập @username' : mode === 'phone' ? '+84…' : 'Nhập mã kết bạn MyMap'} placeholderTextColor={glassColors.faint} onSubmitEditing={() => void action(() => performSearch())} />}
        <View style={s.searchActions}>
          {mode === 'code' && <GlassButton tone="purple" style={s.flex} disabled={busy} onPress={() => signedIn ? setScannerOpen(true) : setError('Đăng nhập để quét mã và kết bạn.')}><Text style={s.white}>Mở camera</Text></GlassButton>}
          <GlassButton style={s.flex} disabled={busy || (mode !== 'nearby' && !query.trim())} onPress={() => void action(() => performSearch())}><Text style={s.white}>{busy ? 'Đang tìm…' : mode === 'nearby' ? 'Bật khám phá 500 m' : 'Tìm kiếm'}</Text></GlassButton>
        </View>
      </GlassSurface>

      {error && <EmptyGlass icon="alert-circle-outline" title="Chưa thể hoàn tất" body={error} action={!signedIn ? <GlassButton onPress={() => nav.navigate('Login')}><Text style={s.white}>Đăng nhập</Text></GlassButton> : undefined} />}
      {status && <Text accessibilityLiveRegion="polite" style={s.status}>{status}</Text>}
      <SectionTitle>{mode === 'nearby' ? 'Bạn bè xung quanh' : 'Kết quả tìm kiếm'}</SectionTitle>
      {(busy || initializing) && <ActivityIndicator color={glassColors.cyan} />}
      {results.map(candidate => {
        const relationship = connectionByUser.get(candidate.user_id);
        return <GlassSurface key={candidate.user_id} style={s.person}>
          <Avatar candidate={candidate} />
          <View style={s.personCopy}><Text style={s.name}>{candidate.display_name || candidate.username || 'Người dùng MyMap'}</Text><Text style={s.muted}>{candidate.username ? '@' + candidate.username : ''}{candidate.distance_m != null ? ` · Cách ${Math.round(candidate.distance_m)} m` : ''}</Text></View>
          <GlassButton tone="purple" disabled={busy || relationship?.direction === 'outgoing' || relationship?.direction === 'accepted'} onPress={() => void action(() => connect(candidate))}><Text style={s.white}>{relationLabel(candidate)}</Text></GlassButton>
        </GlassSurface>;
      })}
      {!busy && !initializing && !error && !results.length && <EmptyGlass icon={searched ? 'account-search-outline' : 'account-group-outline'} title={searched ? 'Không tìm thấy kết quả' : 'Kết nối đầu tiên của bạn'} body={searched ? 'Kiểm tra lại thông tin hoặc chọn cách tìm khác.' : 'Tìm một người bạn bằng username, số điện thoại hoặc mã QR.'} />}

      <GlassSurface style={s.username}>
        <Text style={s.section}>Username của tôi</Text>
        <Text style={s.muted}>3–24 ký tự: chữ thường, số hoặc dấu gạch dưới.</Text>
        <View style={s.searchActions}><TextInput accessibilityLabel="Đặt username" style={[s.input, s.flex]} value={username} onChangeText={setUser} autoCapitalize="none" autoCorrect={false} placeholder="Đặt @username" placeholderTextColor={glassColors.faint} /><GlassButton disabled={busy || !username.trim() || !signedIn} onPress={() => void action(async () => { const value = await setUsername(username); setUser(value); setStatus(`Đã lưu @${value}`); })}><Text style={s.white}>Lưu</Text></GlassButton></View>
      </GlassSurface>

      <NativeAdCard placement="friends" />
      <AccountQRScannerModal visible={scannerOpen} onClose={() => setScannerOpen(false)} onScanned={value => { setScannerOpen(false); setMode('code'); setQuery(value); void action(() => performSearch('code', value)); }} />
    </ScreenScaffold>
  );
}

const s = StyleSheet.create({
  methods: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  method: { padding: 10, minHeight: 108, alignItems: 'center', gap: 9, borderRadius: 19 },
  methodActive: { borderColor: '#8BF2FF' },
  methodTitle: { color: '#fff', fontSize: 11, lineHeight: 16, fontWeight: '700', textAlign: 'center' },
  sos: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sosTitle: { color: '#fff', fontWeight: '800', fontSize: 13 },
  sosBody: { color: glassColors.muted, fontSize: 10.5, marginTop: 2 },
  account: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountCopy: { flex: 1, gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  section: { color: '#fff', fontSize: 16, fontWeight: '800' },
  muted: { color: glassColors.muted, fontSize: 11.5, lineHeight: 17 },
  codeBox: { padding: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#56CFFF', borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  code: { color: '#5DE9FF', fontSize: 18, letterSpacing: 1, fontWeight: '800', flex: 1 },
  shareHint: { color: glassColors.cyan, fontSize: 11 },
  qrBox: { padding: 7, alignItems: 'center', gap: 7, borderRadius: 17, minHeight: 120, minWidth: 93 },
  qrLabel: { color: '#D3E3FF', fontSize: 10 },
  search: { padding: 15, gap: 12 },
  searchCopy: { flex: 1 },
  input: { minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(147,211,255,.5)', backgroundColor: 'rgba(4,20,50,.62)', paddingHorizontal: 14, color: '#fff', fontSize: 14 },
  searchActions: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  requestActions: { gap: 6 },
  flex: { flex: 1 },
  white: { color: '#fff', fontWeight: '700', fontSize: 12 },
  status: { color: glassColors.green, fontSize: 13 },
  friendCount: { color: glassColors.green, fontSize: 12, fontWeight: '700' },
  friendList: { gap: 9 },
  friendRow: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  friendMapButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(69,235,192,.10)', borderWidth: 1, borderColor: 'rgba(69,235,192,.28)' },
  person: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 45, height: 45, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164B81', borderWidth: 1, borderColor: '#53DFFF', overflow: 'hidden' },
  avatarImage: { width: 45, height: 45 },
  personCopy: { flex: 1 },
  name: { color: '#fff', fontSize: 15, fontWeight: '800' },
  username: { padding: 15, gap: 12 },
});
