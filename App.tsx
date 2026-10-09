import React, { useEffect, useMemo, useState } from 'react';
import {ActivityIndicator,AppState,Image,ImageBackground,StatusBar,StyleSheet,Text,View} from 'react-native';
import {useFonts} from 'expo-font';
import {NavigationContainer,DarkTheme,type LinkingOptions,createNavigationContainerRef} from '@react-navigation/native';
import type {RootStackParamList} from './src/navigation/types';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider, useAppTheme } from './src/ui/theme';
import {startIOSCompanions} from './src/services/iosCompanions';
import {startNotificationDelivery} from './src/services/notificationDelivery';
import {startQuickActions} from './src/services/quickActions';
import {getCurrentUser} from './src/services/auth';
import {startWearCompanion} from './src/services/wearCompanion';
import {startFireGeofenceFallback} from './src/services/geofencing';
import { restoreTracking,startTracking,stopTracking } from './src/services/locationTracking';
import {initializeLanguage} from './src/i18n/languages';
import {SafetyMonitor} from './src/components/SafetyMonitor';
import {travelNative} from './src/services/travelPlatform';
import {prepareAds} from './src/services/adsPrivacy';
import {startMomentSync} from './src/services/moments';
import {initializeMusicPlayback} from './src/services/musicPlayback';
import {AppLock} from './src/components/AppLock';
import {startSharedSync} from './src/services/sharedSync';
const navigationRef=createNavigationContainerRef<RootStackParamList>();
let pendingAction:'SOS'|'Smart'|'MomentCamera'|null=null;
let pendingNotification:Record<string,unknown>|null=null;
const openNotification=(data:Record<string,unknown>)=>{
 if(!navigationRef.isReady()){pendingNotification=data;return;}
 void getCurrentUser().then(user=>{if(user?.id!==data.owner||!navigationRef.isReady())return;if(typeof data.callId==='string')navigationRef.navigate('Call',{callId:data.callId});else if(typeof data.roomId==='string')navigationRef.navigate('Chat',{roomId:data.roomId});});
};
const openAction=(name:'SOS'|'Smart'|'MomentCamera')=>{if(navigationRef.isReady())navigationRef.navigate(name);else pendingAction=name;};
const openSOS=()=>openAction('SOS');
const momentLinking:LinkingOptions<RootStackParamList>={prefixes:['mymap://',...(process.env.EXPO_PUBLIC_EMAIL_LINK_DOMAIN?['https://'+process.env.EXPO_PUBLIC_EMAIL_LINK_DOMAIN]:[])],config:{initialRouteName:'Tabs',screens:{Login:'__/auth/links',Moments:'moments',MomentDetail:'moment/:momentId',MomentCamera:'camera',SOS:'sos',Smart:'smart',Search:'search'}}};

function ThemedApp() {
 const {theme}=useAppTheme();
 const navigationTheme=useMemo(()=>({...DarkTheme,colors:{...DarkTheme.colors,primary:theme.colors.primary,background:theme.colors.bg,card:theme.colors.glassStrong,text:theme.colors.text,border:theme.colors.border,notification:theme.colors.danger}}),[theme]);
 return <SafeAreaProvider><View style={{flex:1}} onTouchStart={()=>travelNative?.userInteraction()}><StatusBar barStyle="light-content" translucent backgroundColor="transparent"/><NavigationContainer ref={navigationRef} onReady={()=>{if(pendingAction){const action=pendingAction;pendingAction=null;openAction(action);}if(pendingNotification){const data=pendingNotification;pendingNotification=null;openNotification(data);}}} theme={navigationTheme} linking={momentLinking}><AppNavigator/></NavigationContainer><SafetyMonitor/><AppLock/></View></SafeAreaProvider>;
}

function BrandLaunchScreen() {
 return <View style={launchStyles.root} accessibilityLabel="MyMap đang khởi động">
  <StatusBar barStyle="light-content" backgroundColor="#061326" />
  <ImageBackground source={require('./assets/branding/splash-background-v2.png')} resizeMode="cover" style={StyleSheet.absoluteFill}>
   <View style={launchStyles.shade}/>
   <View style={launchStyles.center}>
    <View style={launchStyles.logoGlow}/>
    <Image source={require('./assets/branding/splash-logo-v2.png')} resizeMode="contain" style={launchStyles.logo}/>
    <Text allowFontScaling={false} style={launchStyles.brand}><Text style={launchStyles.brandMy}>My</Text><Text style={launchStyles.brandMap}>Map</Text></Text>
    <Text style={launchStyles.tagline}>Mỗi hành trình đều đáng nhớ</Text>
   </View>
   <View style={launchStyles.loading}><ActivityIndicator color="#58DFFF" size="small"/><Text style={launchStyles.loadingText}>ĐANG CHUẨN BỊ BẢN ĐỒ</Text></View>
  </ImageBackground>
 </View>;
}

export default function App(){
 const[launchElapsed,setLaunchElapsed]=useState(false);
 const[loaded,error]=useFonts({MyMapRegular:require('./assets/design/NunitoSans-Regular.ttf'),MyMapSemiBold:require('./assets/design/NunitoSans-SemiBold.ttf'),MyMapBold:require('./assets/design/NunitoSans-Bold.ttf'),MyMapScript:require('./assets/design/DancingScript.ttf')});
 useEffect(()=>{const timer=setTimeout(()=>setLaunchElapsed(true),900);return()=>clearTimeout(timer);},[]);
 useEffect(()=>{void initializeLanguage();},[]);
 useEffect(()=>{void initializeMusicPlayback();},[]);
 useEffect(()=>startMomentSync(),[]);
 useEffect(()=>startSharedSync(),[]);
 useEffect(()=>startIOSCompanions(openSOS),[]);
 useEffect(()=>startQuickActions(openAction),[]);
 useEffect(()=>startWearCompanion(),[]);
 useEffect(()=>startFireGeofenceFallback(),[]);
 useEffect(()=>startNotificationDelivery(openNotification),[]);
 useEffect(()=>{
  const restore=async()=>{try{const shortcut=await travelNative?.consumeTrackingShortcut?.();if(shortcut==='start')await startTracking();else if(shortcut==='stop')await stopTracking();await restoreTracking();}catch{/* Smart screen exposes permission/recorder status and allows retry. */}};
  if(AppState.currentState==='active')void restore();
  const subscription=AppState.addEventListener('change',state=>{if(state==='active')void restore();});
  return()=>subscription.remove();
 },[]);
 useEffect(()=>{
  void prepareAds();
 },[]);
 if((!loaded&&!error)||!launchElapsed)return <BrandLaunchScreen/>;
 return <ThemeProvider><ThemedApp/></ThemeProvider>;
}

const launchStyles=StyleSheet.create({
 root:{flex:1,backgroundColor:'#061326'},
 shade:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:'rgba(2,10,25,.22)'},
 center:{flex:1,alignItems:'center',justifyContent:'center',paddingBottom:34},
 logoGlow:{position:'absolute',width:230,height:230,borderRadius:115,backgroundColor:'rgba(44,139,255,.13)'},
 logo:{width:118,height:128,marginBottom:14},
 brand:{fontSize:42,lineHeight:50,fontWeight:'800',letterSpacing:-1.7,textShadowColor:'rgba(52,167,255,.30)',textShadowRadius:16},
 brandMy:{color:'#F4F7FC'},brandMap:{color:'#7EB8FF'},
 tagline:{marginTop:3,color:'#A9BAD0',fontSize:13.5,letterSpacing:.2},
 loading:{position:'absolute',left:0,right:0,bottom:48,alignItems:'center',gap:11},
 loadingText:{color:'#7F9AB8',fontSize:9.5,fontWeight:'700',letterSpacing:2.1},
});
