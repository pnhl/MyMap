import React, { PropsWithChildren } from 'react';
import { Image, Platform, Pressable, StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from './Text';
import { useAppTheme } from './theme';

export type LayoutClass = 'narrow' | 'phone' | 'foldable' | 'tablet';
export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
export type AccentTone = 'cyan' | 'violet' | 'rose' | 'mint' | 'blue';
export function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const layout: LayoutClass = width < 360 ? 'narrow' : width < 600 ? 'phone' : width < 900 ? 'foldable' : 'tablet';
  const gutter = width < 360 ? 14 : width < 600 ? 16 : 24;
  const maxContent = width >= 900 ? 1080 : width >= 600 ? 840 : 720;
  return { width, height, fontScale, layout, gutter, maxContent, isWide: width >= 600, isLandscape: width > height };
}
export const glassColors = {
  bg: '#031337', bgRaised: '#0A2857', text: '#F7FAFF', muted: '#ABC9EF', faint: '#789ACA',
  cyan: '#48E3FF', blue: '#43A5FF', purple: '#AB85FF', red: '#FF5279', green: '#45EBC0',
  glass: 'rgba(13,49,105,.64)', glassStrong: 'rgba(17,57,119,.90)', border: 'rgba(152,211,255,.65)', borderStrong: 'rgba(176,236,255,.95)',
};
export function AmbientBackdrop() {
  const { theme } = useAppTheme();
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bg }]} />
    <Image source={require('../../assets/design/street-backdrop.png')} resizeMode="cover" style={[StyleSheet.absoluteFill, { opacity: theme.ambient.imageOpacity, width:'100%',height:'100%' }]} />
    <LinearGradient colors={theme.ambient.gradient} style={StyleSheet.absoluteFill} />
    <View style={[s.orbCyan, { backgroundColor: theme.ambient.orbPrimary }]} /><View style={[s.orbViolet, { backgroundColor: theme.ambient.orbSecondary }]} />
  </View>;
}
function GlassBackdrop({ intensity = 46, color }: { intensity?: number; color: string }) {
  return Platform.OS === 'ios' ? <><View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color }]} /><BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} /></> : <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color }]} />;
}
export function GlassSurface({ children, style, intensity = 46, tone = 'blue' }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; intensity?: number; tone?: AccentTone }>) {
  const { theme } = useAppTheme();
  const themeTones: Record<AccentTone, string> = { cyan: theme.colors.primary, violet: theme.colors.secondary, rose: theme.colors.danger, mint: theme.colors.success, blue: theme.colors.primary };
  const accent = themeTones[tone];
  const solid = theme.layout.surface === 'solid';
  const outline = theme.layout.surface === 'outline';
  const layered = theme.layout.surface === 'layered';
  return <View style={[s.shell, {
    borderColor: tone === 'blue' ? theme.colors.border : `${accent}AA`,
    backgroundColor: solid ? theme.colors.bgRaised : outline ? `${theme.colors.bgRaised}99` : theme.colors.glass,
    shadowColor: tone === 'blue' ? theme.colors.shadow : accent,
    borderRadius: theme.radius.surface,
    borderWidth: outline ? 1.35 : solid ? 0 : .8,
    shadowOpacity: outline ? 0 : layered ? .32 : .18,
    transform: layered ? [{ translateY: -1 }] : undefined,
  }, style]}>
    {!solid && <GlassBackdrop intensity={intensity} color={outline ? `${theme.colors.bg}C8` : theme.colors.glassStrong} />}
    {!outline && <LinearGradient pointerEvents="none" colors={theme.surfaceGradient} style={StyleSheet.absoluteFill} />}
    <LinearGradient pointerEvents="none" colors={theme.surfaceTopLight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.topLight} />
    <View pointerEvents="none" style={[s.edgeLight, { borderRadius: theme.radius.surface, borderColor: theme.colors.border }]} />{children}
  </View>;
}
export function GlassButton({ children, onPress, style, tone = 'blue', disabled = false, accessibilityLabel }: PropsWithChildren<{ onPress?: () => void; style?: StyleProp<ViewStyle>; tone?: 'blue' | 'purple' | 'red' | 'neutral'; disabled?: boolean; accessibilityLabel?: string }>) {
  const { theme } = useAppTheme();
  const edge = tone === 'purple' ? theme.colors.secondary : tone === 'red' ? theme.colors.danger : tone === 'neutral' ? theme.colors.border : theme.colors.primary;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, { borderColor: edge, shadowColor: edge, borderRadius: theme.radius.control }, pressed && s.pressed, disabled && s.disabled, style]}>
    <LinearGradient pointerEvents="none" colors={theme.buttonGradients[tone]} style={StyleSheet.absoluteFill} />
    <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,.10)','transparent']} locations={[0,1]} style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={s.buttonEdge} /><View style={s.buttonContent}>{children}</View>
  </Pressable>;
}
export function GlassChip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const { theme } = useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [s.chip, { borderColor: active ? theme.colors.primary : theme.colors.border, backgroundColor: theme.colors.glassStrong, borderRadius: Math.max(10, theme.radius.control - 3) }, active && { shadowColor: theme.colors.primary }, pressed && s.pressed]}>
    {active && <LinearGradient colors={theme.activeGradient} style={StyleSheet.absoluteFill} />}<Text style={[s.chipText, { color: active ? theme.colors.text : theme.colors.muted }]}>{label}</Text>
  </Pressable>;
}
export function IconBadge({ name, tone = 'cyan', size = 24, diameter = 46 }: { name: IconName; tone?: AccentTone; size?: number; diameter?:number }) {
  const { theme } = useAppTheme();
  const dynamicTones: Record<AccentTone, string> = { cyan: theme.colors.primary, violet: theme.colors.secondary, rose: theme.colors.danger, mint: theme.colors.success, blue: theme.colors.primary };
  const color = dynamicTones[tone];
  return <View style={[s.iconBadge, { borderColor: `${color}45`, backgroundColor: `${color}12`, shadowColor: theme.colors.shadow,width:diameter,height:diameter,borderRadius:Math.min(15,diameter*.34) }]}><LinearGradient colors={[`${color}18`,theme.colors.glassStrong]} style={StyleSheet.absoluteFill} /><MaterialCommunityIcons name={name} size={size} color={color} /></View>;
}
export function BrandHeader({ compact = false, smart = false }: { compact?: boolean; smart?: boolean }) {
  const { theme } = useAppTheme();
  const markWidth = compact ? 34 : 40;
  const markHeight = compact ? 37 : 44;
  return <View style={[s.brandRow, compact && { minHeight: 44 }]}>
    <View style={[s.brandMarkWrap, { width: markWidth + 8, height: markHeight + 6, shadowColor: theme.colors.primary }]}><Image source={require('../../assets/branding/splash-logo-v2.png')} resizeMode="contain" style={{ width: markWidth, height: markHeight }} /></View>
    <View style={s.brandCopy}><Text allowFontScaling={false} numberOfLines={1} style={[s.brandName, compact && { fontSize: 23, lineHeight: 28 }]}><Text style={{ color: theme.colors.text }}>My</Text><Text style={{ color: theme.colors.primary }}>Map</Text>{smart && <Text style={{ color: theme.colors.secondary }}> Smart</Text>}</Text>
      {!compact && <Text numberOfLines={1} maxFontSizeMultiplier={1.15} style={[s.brandTagline, { color: theme.colors.muted }]}>{smart ? 'An toàn hơn mỗi hành trình' : 'Mỗi hành trình đều đáng nhớ'}</Text>}
    </View></View>;
}
export function ScreenQuote({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  const { theme } = useAppTheme();
  return <View pointerEvents="none" style={[s.quoteWrap, style]}><Text style={[s.quoteText, { color: theme.colors.primary }]}>{text}</Text><View style={[s.quoteUnderline, { backgroundColor: theme.colors.primary }]} /></View>;
}
export function TopIconButton({ icon, onPress, hasBadge, badgeColor, accessibilityLabel, disabled, tone }: { icon: IconName; onPress?: () => void; hasBadge?: boolean; badgeColor?: string; accessibilityLabel?: string; disabled?: boolean; tone?: AccentTone }) {
  const { theme } = useAppTheme();
  const isRose = tone === 'rose';
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: disabled || !onPress }} disabled={disabled || !onPress} onPress={onPress} style={({ pressed }) => [s.topBtn, { borderColor: isRose ? theme.colors.danger : theme.colors.border, shadowColor: isRose ? theme.colors.danger : theme.colors.shadow, borderRadius: Math.max(11, theme.radius.control - 4) }, pressed && s.pressed, disabled && s.disabled]}>
    <LinearGradient pointerEvents="none" colors={isRose ? theme.buttonGradients.red : theme.buttonGradients.neutral} style={StyleSheet.absoluteFill} /><MaterialCommunityIcons pointerEvents="none" name={icon} size={24} color={isRose ? '#FFE4EC' : theme.colors.text} />{hasBadge && <View pointerEvents="none" style={[s.badgeDot, { backgroundColor: badgeColor || theme.colors.secondary }]} />}
  </Pressable>;
}
export function GlassSegmentedTabs<T extends string>({ tabs, active, onChange }: { tabs: { key: T; label: string; icon?: IconName }[]; active: T; onChange: (key: T) => void }) {
  const { theme } = useAppTheme();
  const { width, fontScale } = useWindowDimensions();
  const stacked = tabs.length > 2 && (width < 360 || fontScale > 1.2);
  return <GlassSurface style={s.segmentedContainer}><View style={s.segmentedInner}>{tabs.map(t => <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: t.key === active }} onPress={() => onChange(t.key)} style={({ pressed }) => [s.segmentedTab, { borderRadius: Math.max(9, theme.radius.control - 3) }, stacked && { flexDirection: 'column', gap: 3, paddingVertical: 8 }, t.key === active && [s.segmentedActive, { borderColor: theme.colors.primary, shadowColor: theme.colors.primary }], pressed && s.pressed]}>
    {t.key === active && <LinearGradient colors={theme.activeGradient} style={StyleSheet.absoluteFill} />}{t.icon && <MaterialCommunityIcons name={t.icon} size={20} color={t.key === active ? theme.colors.text : theme.colors.muted} />}<Text maxFontSizeMultiplier={1.3} style={[s.segmentedText, { color: t.key === active ? theme.colors.text : theme.colors.muted }]}>{t.label}</Text></Pressable>)}</View></GlassSurface>;
}
const s = StyleSheet.create({
  orbCyan: { position: 'absolute', top: -180, right: -230, width: 520, height: 520, borderRadius: 260, backgroundColor: 'rgba(20,91,220,.10)' }, orbViolet: { position: 'absolute', top: 300, left: -250, width: 480, height: 480, borderRadius: 240, backgroundColor: 'rgba(93,45,218,.07)' },
  shell: { overflow: 'hidden', borderRadius: 23, borderWidth: .8, borderColor: glassColors.border, backgroundColor: 'rgba(13,29,43,.78)', boxShadow: '0 10px 28px rgba(1,8,15,.18)' }, topLight: { position: 'absolute', top: 0, left: 16, right: 16, height: 1 }, edgeLight: { ...StyleSheet.absoluteFill, borderRadius: 23, borderTopWidth: .6, borderColor: 'rgba(231,243,248,.10)' },
  button: { overflow: 'hidden', minHeight: 48, borderRadius: 15, borderWidth: .8, justifyContent: 'center', boxShadow: '0 6px 18px rgba(1,8,15,.16)' }, buttonEdge: { ...StyleSheet.absoluteFill, borderRadius: 15, borderTopWidth: .7, borderColor: 'rgba(255,255,255,.12)' }, buttonContent: { paddingHorizontal: 15, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }, pressed: { transform: [{ scale: .985 }], opacity: .9 }, disabled: { opacity: .42 },
  chip: { minHeight: 40, overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 13, borderWidth: .8, borderColor: glassColors.border, backgroundColor: 'rgba(16,34,49,.86)', alignItems: 'center', justifyContent: 'center' }, chipActive: { borderColor: '#6BC3D3' }, chipText: { color: glassColors.muted, fontWeight: '600', fontSize: 12.5 },
  iconBadge: { width: 46, height: 46, borderRadius: 15, overflow: 'hidden', borderWidth: .8, alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 14px rgba(1,8,15,.14)' },
  brandRow: { flexDirection: 'row', alignItems: 'center', minHeight: 59, gap: 9 }, brandMarkWrap: { alignItems: 'center', justifyContent: 'center', shadowOpacity: .35, shadowRadius: 10, elevation: 4 }, brandCopy: { flex: 1, minWidth: 0 }, brandName: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -1 }, brandTagline: { color: glassColors.muted, fontSize: 10.5, lineHeight: 15, letterSpacing: .05 },
  quoteWrap: { alignItems: 'flex-end', paddingVertical: 4 }, quoteText: { fontFamily: 'MyMapScript', fontSize: 19, lineHeight: 24, color: '#9DD9FF', textAlign: 'right', maxWidth: 220 }, quoteUnderline: { width: 47, height: 2, backgroundColor: '#44DFFF', marginTop: 4, marginRight: 13, transform: [{ rotate: '-13deg' }] },
  topBtn: { width: 40, height: 40, borderRadius: 13, overflow: 'hidden', borderWidth: .8, borderColor: 'rgba(148,199,255,.24)', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(1,8,15,.16)' }, topBtnRose: { borderColor: 'rgba(233,121,142,.45)' }, badgeDot: { position: 'absolute', top: 3, right: 3, width: 7, height: 7, borderRadius: 4, borderWidth: 1, borderColor: '#DCE6EF' },
  segmentedContainer: { borderRadius: 17, padding: 3 }, segmentedInner: { flexDirection: 'row', gap: 3 }, segmentedTab: { flex: 1, minHeight: 42, borderRadius: 13, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingHorizontal: 6 }, segmentedActive: { borderWidth: .8 }, segmentedText: { color: glassColors.muted, fontWeight: '600', fontSize: 12 },
});
