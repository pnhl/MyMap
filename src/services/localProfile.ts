import AsyncStorage from '@react-native-async-storage/async-storage';
export type LocalProfile={name:string;bio:string;avatarUri:string|null};
const KEY='mymap.local-profile.v1';
export async function getLocalProfile():Promise<LocalProfile>{const raw=await AsyncStorage.getItem(KEY);return raw?JSON.parse(raw):{name:'',bio:'',avatarUri:null};}
export async function saveLocalProfile(profile:LocalProfile){await AsyncStorage.setItem(KEY,JSON.stringify(profile));}
