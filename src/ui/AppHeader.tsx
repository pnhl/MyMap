import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { Text } from './Text';
import { BrandHeader, GlassSurface, TopIconButton, glassColors, useResponsiveLayout } from './glass';
import { useAppTheme } from './theme';

export function AppHeader({ back = false, smart = false, onSearch, searchLabel = 'Tìm kiếm kỷ niệm' }: { back?: boolean; smart?: boolean; onSearch?: () => void; searchLabel?: string }) {
  const nav = useNavigation<any>();
  const r = useResponsiveLayout();
  const { theme } = useAppTheme();
  const [inbox, setInbox] = useState<Notifications.Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function openInbox() {
    setError(null); setInbox([]);
    try { setInbox(await Notifications.getPresentedNotificationsAsync()); }
    catch { setError('Không thể đọc thông báo trên thiết bị.'); }
  }
  return <>
    <View style={s.row}>
      {back && <TopIconButton icon="chevron-left" accessibilityLabel="Quay lại" onPress={() => nav.goBack()} />}
      <View style={s.brand}><BrandHeader compact smart={smart} /></View>
      <TopIconButton icon="alert-octagon" tone="rose" accessibilityLabel="Cứu trợ khẩn cấp SOS" onPress={() => nav.navigate('SOS')} />
      <TopIconButton icon="magnify" accessibilityLabel={searchLabel} onPress={onSearch || (() => nav.navigate('Tabs', { screen: 'Memories', params: { focusSearch: true } }))} />
      <TopIconButton icon="bell-outline" accessibilityLabel="Xem thông báo" onPress={() => void openInbox()} />
    </View>
    <Modal visible={inbox !== null} transparent animationType="fade" onRequestClose={() => setInbox(null)}>
      <View style={[s.overlay, { backgroundColor: `${theme.colors.bg}E8` }]}><GlassSurface style={s.dialog}>
        <View style={s.inboxHead}><Text style={[s.title, { color: theme.colors.text }]}>Thông báo</Text><TopIconButton icon="close" accessibilityLabel="Đóng thông báo" onPress={() => setInbox(null)} /></View>
        <ScrollView style={{ maxHeight: r.height * .5 }}>
          {error ? <Text style={[s.body, { color: theme.colors.muted }]}>{error}</Text> : !inbox?.length ? <Text style={[s.body, { color: theme.colors.muted }]}>Bạn chưa có thông báo trên thiết bị.</Text> : inbox.map(n => <View key={n.request.identifier} style={[s.notification, { borderBottomColor: theme.colors.border }]}>
            <Text style={[s.notificationTitle, { color: theme.colors.text }]}>{n.request.content.title || 'Thông báo MyMap'}</Text>
            {!!n.request.content.body && <Text style={[s.body, { color: theme.colors.muted }]}>{n.request.content.body}</Text>}
            <Text style={[s.date, { color: theme.colors.faint }]}>{new Date(n.date).toLocaleString('vi-VN')}</Text>
          </View>)}
        </ScrollView>
      </GlassSurface></View>
    </Modal>
  </>;
}
const s = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 54 }, brand: { flex: 1, minWidth: 108 }, overlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(1,8,29,.8)' }, dialog: { width: '100%', maxWidth: 540, alignSelf: 'center', padding: 20, gap: 18 }, inboxHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 22, fontWeight: '700', color: '#fff', letterSpacing: -.4 }, body: { color: glassColors.muted, fontSize: 14, lineHeight: 21 }, notification: { gap: 5, paddingVertical: 15, borderBottomWidth: .7, borderBottomColor: glassColors.border }, notificationTitle: { color: '#fff', fontSize: 15, fontWeight: '700' }, date: { fontSize: 11, color: glassColors.faint } });
