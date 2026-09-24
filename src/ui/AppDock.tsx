import React, { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassSurface, useResponsiveLayout, type IconName } from './glass';
import { Text } from './Text';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAppTheme } from './theme';

const canonical: { name: string; label: string; icon: IconName }[] = [
  { name: 'Map', label: 'Bản đồ', icon: 'map-marker-path' },
  { name: 'Timeline', label: 'Timeline', icon: 'chart-timeline-variant-shimmer' },
  { name: 'Memories', label: 'Kỷ niệm', icon: 'image-outline' },
  { name: 'Friends', label: 'Bạn bè', icon: 'account-group-outline' },
  { name: 'Profile', label: 'Cá nhân', icon: 'account-outline' },
];

export function AppDock({ tabs }: { tabs?: BottomTabBarProps }) {
  const nav = useNavigation<any>();
  const route = useRoute();
  const r = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const active = tabs ? tabs.state.routes[tabs.state.index]?.name : route.name;

  function select(name: string) {
    if (name === active) return;
    if (tabs) {
      const destination = tabs.state.routes.find(x => x.name === name);
      if (destination) {
        const event = tabs.navigation.emit({ type: 'tabPress', target: destination.key, canPreventDefault: true });
        if (!event.defaultPrevented) tabs.navigation.navigate(name);
      }
    } else {
      nav.navigate('Tabs', { screen: name });
    }
  }

  const bottom = Math.max(insets.bottom, 8);
  const compact = theme.layout.dock === 'compact';
  const island = theme.layout.dock === 'island';
  if (keyboardOpen) return null;

  return (
    <View pointerEvents="box-none" style={[s.position, { height: (compact ? 61 : 70) + bottom, paddingBottom: bottom, paddingHorizontal: island ? Math.max(22, (r.width - Math.min(r.width - 44, 440)) / 2) : r.isWide ? Math.max(24, (r.width - r.maxContent) / 2) : compact ? 8 : 14 }]}> 
      <GlassSurface style={[s.dock, { borderRadius: theme.radius.dock }, compact && s.dockCompact, island && s.dockIsland]} intensity={65}>
        <View style={s.items}>
          {canonical.map(item => {
            const selected = item.name === active ||
              (active === 'Settings' && item.name === 'Profile') ||
              (active === 'Smart' && item.name === 'Profile') ||
              (active === 'Heatmap' && item.name === 'Timeline') ||
              (active === 'SOS' && item.name === 'Friends');

            const destination = tabs?.state.routes.find(x => x.name === item.name);

            return (
              <Pressable
                key={item.name}
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected }}
                onPress={() => select(item.name)}
                onLongPress={destination ? () => tabs?.navigation.emit({ type: 'tabLongPress', target: destination.key }) : undefined}
                style={({ pressed }) => [
                  s.item,
                  { borderRadius: Math.max(11, theme.radius.control) },
                  pressed && { opacity: 0.78, transform: [{ scale: .98 }] },
                ]}
              >
                <LinearGradient
                  pointerEvents="none"
                  colors={theme.dockGradient}
                  style={[StyleSheet.absoluteFill, { opacity: selected ? .72 : 0, borderRadius: Math.max(11, theme.radius.control) }]}
                />
                <MaterialCommunityIcons
                  name={item.icon}
                  size={compact ? 21 : island ? 24 : 23}
                  color={selected ? theme.colors.primary : theme.colors.muted}
                />
                {(!compact || selected) && <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[
                    s.label,
                    r.width < 360 && { fontSize: 10 },
                    selected ? { color: theme.colors.primary, fontWeight: '700' } : { color: theme.colors.muted },
                  ]}
                >
                  {item.label}
                </Text>}
                <View
                  style={[
                    s.indicator,
                    { opacity: selected ? 1 : 0, backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

const s = StyleSheet.create({
  position: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    elevation: 30,
  },
  dock: {
    borderRadius: 25,
    flex: 1,
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  dockCompact: { paddingHorizontal: 2, paddingVertical: 2, borderRadius: 13 },
  dockIsland: { maxWidth: 440, width: '100%', alignSelf: 'center', paddingHorizontal: 8 },
  items: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    borderRadius: 20,
    overflow: 'hidden',
    paddingVertical: 6,
  },
  label: {
    fontSize: 10,
    lineHeight: 13,
  },
  indicator: {
    position: 'absolute',
    top: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#70E9FF',
    shadowColor: '#44DFFF',
    shadowOpacity: 0,
  },
});
