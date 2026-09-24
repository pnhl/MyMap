import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GlassSurface, glassColors, type IconName } from './glass';
import { Text } from './Text';
import { weatherLabel, type WeatherSnapshot } from '../services/weather';

export function WeatherCard({ weather, place = 'Tại vị trí đã lưu', unavailable = 'Chưa có dữ liệu thời tiết' }: { weather: WeatherSnapshot|null; place?: string; unavailable?: string }) {
  const c = weather?.current; const code = c?.weather_code;
  const icon: IconName = code === 0 ? 'weather-sunny' : code != null && code >= 95 ? 'weather-lightning-rainy' : code != null && code >= 71 && code <= 86 ? 'weather-snowy' : code != null && code >= 51 ? 'weather-rainy' : 'weather-partly-cloudy';
  const number = (n: number|undefined, suffix: string) => typeof n === 'number' && Number.isFinite(n) ? `${Math.round(n)}${suffix}` : '—';
  return <GlassSurface style={s.card}>
    <View style={s.left}><MaterialCommunityIcons name={weather ? icon : 'weather-cloudy-alert'} size={48} color={weather ? '#FFE07D' : '#8ABAE7'} />
      <View style={s.copy}><Text numberOfLines={1} style={s.place}>{place}</Text><Text style={s.temperature}>{number(c?.temperature_2m,'°')}</Text><Text style={s.description}>{weather ? weatherLabel(code) : unavailable}</Text></View>
    </View>
    <View style={s.divider} /><View style={s.right}><Text style={s.label}>Cảm giác như</Text><Text style={s.feels}>{number(c?.apparent_temperature,'°')}</Text>
      <View style={s.line}><MaterialCommunityIcons name="water" size={16} color="#AAD9FF" /><Text style={s.label}>Độ ẩm {number(c?.relative_humidity_2m,'%')}</Text></View>
      <View style={s.line}><MaterialCommunityIcons name="weather-windy" size={16} color="#AAD9FF" /><Text style={s.label}>Gió {number(c?.wind_speed_10m,' km/h')}</Text></View>
    </View>
  </GlassSurface>;
}
const s = StyleSheet.create({ card: { padding: 15, flexDirection: 'row', alignItems: 'center', minHeight: 120 }, left: { flex: 1.4, flexDirection: 'row', alignItems: 'center', gap: 9 }, copy: { flex: 1 }, place: { color: '#fff', fontSize: 13, fontWeight: '700' }, temperature: { color: '#fff', fontSize: 40, lineHeight: 47, fontWeight: '800', fontVariant: ['tabular-nums'] }, description: { color: '#D5E7FF', fontSize: 11, lineHeight: 16 }, divider: { width: 1, height: 79, backgroundColor: 'rgba(147,211,255,.35)', marginHorizontal: 12 }, right: { flex: 1, gap: 5 }, label: { color: glassColors.muted, fontSize: 11, flexShrink: 1 }, feels: { color: '#fff', fontSize: 17, fontWeight: '700' }, line: { flexDirection: 'row', alignItems: 'center', gap: 6 } });
