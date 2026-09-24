import {AppDock} from '../ui/AppDock';
import React from 'react';
import MemoryDetailScreen from '../screens/MemoryDetailScreen';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import MapScreen from '../screens/MapScreen';import TimelineScreen from '../screens/TimelineScreen';import MemoriesScreen from '../screens/MemoriesScreen';import FriendsScreen from '../screens/FriendsScreen';import ProfileScreen from '../screens/ProfileScreen';import SmartScreen from '../screens/SmartScreen';import SOSScreen from '../screens/SOSScreen';import HeatmapScreen from '../screens/HeatmapScreen';import SettingsScreen from '../screens/SettingsScreen';import PlaceDetailScreen from '../screens/PlaceDetailScreen';import LoginScreen from '../screens/LoginScreen';
import type{MainTabsParamList,RootStackParamList} from './types';
import {useAppTheme} from '../ui/theme';

const Tabs=createBottomTabNavigator<MainTabsParamList>();const Stack=createNativeStackNavigator<RootStackParamList>();

function MainTabs(){const{theme}=useAppTheme();return <Tabs.Navigator tabBar={props=><AppDock tabs={props}/>} screenOptions={{headerShown:false,sceneStyle:{backgroundColor:theme.colors.bg},tabBarHideOnKeyboard:true}}><Tabs.Screen name="Map" component={MapScreen} options={{title:'Bản đồ'}}/><Tabs.Screen name="Timeline" component={TimelineScreen}/><Tabs.Screen name="Memories" component={MemoriesScreen} options={{title:'Kỷ niệm'}}/><Tabs.Screen name="Friends" component={FriendsScreen} options={{title:'Bạn bè'}}/><Tabs.Screen name="Profile" component={ProfileScreen} options={{title:'Cá nhân'}}/></Tabs.Navigator>}
export default function AppNavigator(){const{theme}=useAppTheme();return <Stack.Navigator screenOptions={{headerShown:false,contentStyle:{backgroundColor:theme.colors.bg},animation:'fade'}}><Stack.Screen name="Tabs" component={MainTabs}/><Stack.Screen name="Smart" component={SmartScreen}/><Stack.Screen name="SOS" component={SOSScreen}/><Stack.Screen name="Heatmap" component={HeatmapScreen}/><Stack.Screen name="Settings" component={SettingsScreen}/><Stack.Screen name="PlaceDetail" component={PlaceDetailScreen}/><Stack.Screen name="MemoryDetail" component={MemoryDetailScreen}/><Stack.Screen name="Login" component={LoginScreen}/></Stack.Navigator>}
