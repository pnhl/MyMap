import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getLocationPoints, getPhotoPins } from '../db/database';
import { deriveVisits, distanceMeters, formatDuration } from '../utils/geo';
import { groupPointsByLocalDay, localDayKey } from '../utils/journeyStats';
import { GlassButton, GlassSegmentedTabs, GlassSurface, IconBadge, glassColors, useResponsiveLayout } from '../ui/glass';
import { ScreenScaffold, SectionTitle, EmptyGlass } from '../ui/ScreenScaffold';
import { Text } from '../ui/Text';
import { NativeAdCard } from '../components/NativeAdCard';
import { TripStoryModal } from '../components/TripStoryModal';
import type { LocationPoint } from '../types/location';
import type { PhotoPin } from '../types/photo';

function move(key: string, amount: number, month = false) {
  const date = new Date(`${key}T12:00:00`);
  if (month) { date.setDate(1); date.setMonth(date.getMonth()+amount); } else date.setDate(date.getDate()+amount);
  return localDayKey(date.getTime());
}
const clock = (time: number) => new Date(time).toLocaleTimeString('vi-VN',{ hour:'2-digit',minute:'2-digit' });
export default function TimelineScreen() {
  const nav = useNavigation<any>(); const r = useResponsiveLayout(); const initialized = useRef(false);
  const [loading,setLoading] = useState(true); const [error,setError] = useState<string|null>(null);
  const [points,setPoints] = useState<LocationPoint[]>([]); const [photos,setPhotos] = useState<PhotoPin[]>([]);
  const [mode,setMode] = useState<'day'|'month'>('day'); const [selected,setSelected] = useState(()=>localDayKey(Date.now()));
  const [storyVisible, setStoryVisible] = useState(false);
  const [retry,setRetry] = useState(0);
  useFocusEffect(useCallback(()=>{
    let active = true;
    const load = async()=>{
      try {
        const [p,m] = await Promise.all([getLocationPoints(),getPhotoPins()]); if (!active) return;
        setPoints(p); setPhotos(m); setError(null);
        if (!initialized.current) { const latest = Math.max(p.at(-1)?.timestamp||0,m.at(-1)?.capturedAt||0); if (latest) setSelected(localDayKey(latest)); initialized.current = true; }
      } catch { if (active) setError('Không thể đọc lịch sử trên thiết bị.'); } finally { if (active) setLoading(false); }
    };
    void load(); const timer = setInterval(()=>void load(),20000); return()=>{ active = false; clearInterval(timer); };
  },[retry]));
  const daily = useMemo(()=>groupPointsByLocalDay(points),[points]);
  const dayPoints = daily.get(selected)||[]; const visits = deriveVisits(dayPoints);
  const dayPhotos = photos.filter(p=>localDayKey(p.capturedAt)===selected);
  const distance = dayPoints.reduce((sum,p,i)=>i ? sum+distanceMeters(dayPoints[i-1]!,p) : 0,0);
  // Count only intervals with measured movement; long GPS gaps are not travel time.
  const movingMs = dayPoints.reduce((sum,p,i)=>{
    if (!i) return sum; const previous = dayPoints[i-1]!; const elapsed = p.timestamp-previous.timestamp;
    return elapsed>0 && elapsed<=5*60000 && distanceMeters(previous,p)>10 ? sum+elapsed : sum;
  },0);
  const monthDays = [...new Set([...daily.keys(),...photos.map(p=>localDayKey(p.capturedAt))])].filter(d=>d.startsWith(selected.slice(0,7))).sort().reverse();
  const label = new Date(`${selected}T12:00:00`).toLocaleDateString('vi-VN',mode==='day' ? { weekday:'long',day:'numeric',month:'long',year:'numeric' } : { month:'long',year:'numeric' });
  return <ScreenScaffold title="Timeline" subtitle="Hành trình của bạn trong ngày" icon="clock-outline" quote="Khám phá thế giới quanh bạn">
    <GlassSegmentedTabs tabs={[{key:'day',label:'Ngày',icon:'calendar-month-outline'},{key:'month',label:'Tháng',icon:'chart-bar'}]} active={mode} onChange={setMode}/>
    <GlassSurface style={s.date}><Pressable accessibilityRole="button" accessibilityLabel={mode==='day'?'Ngày trước':'Tháng trước'} onPress={()=>setSelected(move(selected,-1,mode==='month'))} style={s.arrow}><MaterialCommunityIcons name="chevron-left" size={27} color="#DBEDFF"/></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Về ngày hôm nay" onPress={()=>setSelected(localDayKey(Date.now()))} style={s.dateCopy}><MaterialCommunityIcons name="calendar-blank-outline" size={21} color="#AFCBFF"/><Text style={s.dateText}>{label}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={mode==='day'?'Ngày sau':'Tháng sau'} onPress={()=>setSelected(move(selected,1,mode==='month'))} style={s.arrow}><MaterialCommunityIcons name="chevron-right" size={27} color="#DBEDFF"/></Pressable></GlassSurface>
    {loading ? <ActivityIndicator color={glassColors.cyan} accessibilityLabel="Đang tải lịch sử"/> : error ? <EmptyGlass title="Không thể tải Timeline" body={error} icon="alert-circle-outline" action={<GlassButton onPress={()=>setRetry(v=>v+1)}><Text style={s.white}>Thử lại</Text></GlassButton>}/> : mode==='day' ? <>
      <View style={s.metrics}>{[
        {icon:'map-marker-distance' as const,value:`${(distance/1000).toLocaleString('vi-VN',{maximumFractionDigits:1})} km`,label:'Tổng quãng đường',tone:'cyan' as const},
        {icon:'map-marker' as const,value:visits.length,label:'Địa điểm đã đến',tone:'mint' as const},
        {icon:'clock-outline' as const,value:movingMs ? formatDuration(movingMs) : '0 phút',label:'Di chuyển ghi nhận',tone:'violet' as const},
        {icon:'camera' as const,value:dayPhotos.length,label:'Ảnh đã chụp',tone:'blue' as const},
      ].map(m=><GlassSurface key={m.label} style={[s.metric,{width:r.width<360||r.fontScale>1.2?'48%':'23.2%'}]}><IconBadge name={m.icon} tone={m.tone} size={22}/><Text style={s.metricValue}>{m.value}</Text><Text style={s.metricLabel}>{m.label}</Text></GlassSurface>)}</View>
      <View style={s.storyRow}>
        <GlassButton tone="blue" onPress={() => setStoryVisible(true)} style={s.storyBtn}>
          <View style={s.storyBtnContent}>
            <MaterialCommunityIcons name="book-open-page-variant" size={18} color="#fff" />
            <Text style={s.white}>Xem Trip Story & Chia sẻ</Text>
          </View>
        </GlassButton>
      </View>
      {visits.length>0 ? <View style={s.visits}>{visits.map((v,i)=>{
        const photo = dayPhotos.find(p=>p.capturedAt>=v.arrivedAt && p.capturedAt<=(v.leftAt||v.arrivedAt+v.durationMs) && distanceMeters(p,v)<=150);
        const traveled = i ? distanceMeters(visits[i-1]!,v)/1000 : 0;
        const title = photo?.placeName || `Điểm dừng ${i+1}`;
        return <View key={v.id} style={s.visitRow}>
          <View style={s.rail}><Text style={s.time}>{clock(v.arrivedAt)}</Text><View style={[s.dot,i%2===1&&{borderColor:glassColors.purple}]}><Text style={s.dotNumber}>{i+1}</Text></View>{i<visits.length-1&&<View style={s.line}/>}</View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Xem ${title}`} style={s.visitTouch} onPress={()=>nav.navigate('PlaceDetail',{name:title,latitude:v.latitude,longitude:v.longitude})}>
            <GlassSurface style={s.visit} tone={i%2?'violet':'blue'}>
              {photo ? <Image source={{uri:photo.uri}} style={s.thumb}/> : <View style={s.thumbPlaceholder}><MaterialCommunityIcons name="map-marker-outline" size={33} color={glassColors.cyan}/></View>}
              <View style={s.visitCopy}><Text numberOfLines={2} style={s.visitTitle}>{title}</Text><View style={s.category}><Text style={s.categoryText}>Điểm dừng GPS</Text></View><View style={s.meta}><Text style={s.muted}>{clock(v.arrivedAt)} · {formatDuration(v.durationMs)}</Text></View><Text style={s.coords}>{v.latitude.toFixed(4)}, {v.longitude.toFixed(4)}</Text><Text style={s.muted}>{i ? `${traveled.toFixed(1)} km theo đường thẳng` : 'Bắt đầu'}</Text></View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#C1DFFF"/>
            </GlassSurface>
          </Pressable>
        </View>;
      })}</View> : <EmptyGlass icon="map-marker-off-outline" title="Chưa có điểm dừng" body="Bật ghi hành trình ở Bản đồ. Những nơi bạn dừng lại sẽ xuất hiện tại đây." action={<GlassButton onPress={()=>nav.navigate('Map')}><Text style={s.white}>Mở Bản đồ</Text></GlassButton>}/>}
      {dayPhotos.length>0 && <><SectionTitle>Kỷ niệm trong ngày</SectionTitle><View style={s.photoRow}>{dayPhotos.map(p=><Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.title||p.placeName||'Xem kỷ niệm'} style={s.photoTile} onPress={()=>nav.navigate('MemoryDetail',{photoId:p.id})}><Image source={{uri:p.uri}} style={s.photo}/><Text numberOfLines={1} style={s.muted}>{p.title||p.placeName||'Kỷ niệm'}</Text></Pressable>)}</View></>}
    </> : <><SectionTitle>Những ngày có hoạt động</SectionTitle>{monthDays.length ? monthDays.map(d=><Pressable key={d} onPress={()=>{setSelected(d);setMode('day')}}><GlassSurface style={s.monthRow}><IconBadge name="calendar-check"/><View style={s.visitCopy}><Text style={s.visitTitle}>{new Date(`${d}T12:00:00`).toLocaleDateString('vi-VN',{day:'numeric',month:'long'})}</Text><Text style={s.muted}>{daily.get(d)?.length||0} điểm GPS · {photos.filter(p=>localDayKey(p.capturedAt)===d).length} ảnh</Text></View><MaterialCommunityIcons name="chevron-right" size={25} color="#D1E9FF"/></GlassSurface></Pressable>) : <EmptyGlass icon="calendar-blank-outline" title="Tháng này chưa có hoạt động" body="Chọn tháng khác hoặc ghi một hành trình mới."/>}</>}
    <NativeAdCard placement="timeline"/>
    <TripStoryModal
      visible={storyVisible}
      onClose={() => setStoryVisible(false)}
      dayLabel={label}
      distanceKm={(distance / 1000).toFixed(1)}
      visitCount={visits.length}
      movingDuration={movingMs ? formatDuration(movingMs) : '0 phút'}
      photos={dayPhotos}
    />
  </ScreenScaffold>;
}
const s=StyleSheet.create({date:{flexDirection:'row',alignItems:'center',padding:4,borderRadius:20},arrow:{width:44,height:49,alignItems:'center',justifyContent:'center'},dateCopy:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,minHeight:49,paddingVertical:5},dateText:{flexShrink:1,color:'#fff',fontSize:13,fontWeight:'700',textAlign:'center',textTransform:'capitalize'},metrics:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:8},metric:{padding:9,alignItems:'center',gap:4,minHeight:108,borderRadius:19},metricValue:{color:'#fff',fontWeight:'800',fontSize:17,fontVariant:['tabular-nums'],textAlign:'center'},metricLabel:{color:glassColors.muted,fontSize:10,lineHeight:14,textAlign:'center'},visits:{gap:10,marginTop:5},visitRow:{flexDirection:'row',gap:8},rail:{width:43,alignItems:'center',gap:7,paddingTop:8},time:{fontSize:11,color:'#D8E8FF',fontWeight:'700'},dot:{width:28,height:28,borderRadius:14,borderWidth:1.5,borderColor:'#58EAFF',backgroundColor:'#13559A',alignItems:'center',justifyContent:'center',boxShadow:'0 0 9px rgba(56,223,255,.5)',zIndex:1},dotNumber:{fontSize:15,fontWeight:'800',color:'#fff'},line:{position:'absolute',top:47,bottom:-25,width:2,backgroundColor:'#36CFFF'},visitTouch:{flex:1},visit:{flexDirection:'row',alignItems:'center',padding:8,gap:10,minHeight:104,borderRadius:20},thumb:{width:66,height:83,borderRadius:14,borderWidth:1.5,borderColor:'#89E9FF'},thumbPlaceholder:{width:49,height:75,borderRadius:14,backgroundColor:'rgba(34,115,196,.2)',alignItems:'center',justifyContent:'center'},visitCopy:{flex:1,gap:3},visitTitle:{color:'#fff',fontSize:15,fontWeight:'800'},category:{alignSelf:'flex-start',borderRadius:10,paddingHorizontal:8,paddingVertical:3,backgroundColor:'rgba(26,116,202,.3)',borderWidth:1,borderColor:'rgba(96,184,245,.4)'},categoryText:{fontSize:10,color:'#9CCFFF'},meta:{flexDirection:'row',flexWrap:'wrap',gap:6},muted:{color:glassColors.muted,fontSize:11,lineHeight:16},coords:{fontSize:10,color:'#87DFFF'},white:{fontSize:13,color:'#fff',fontWeight:'700'},photoRow:{flexDirection:'row',flexWrap:'wrap',gap:9},photoTile:{width:100,gap:5},photo:{width:100,height:100,borderRadius:15,borderWidth:1,borderColor:'#78DEFF'},monthRow:{padding:15,flexDirection:'row',alignItems:'center',gap:12},storyRow:{marginVertical:8},storyBtn:{width:'100%'},storyBtnContent:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8}});
