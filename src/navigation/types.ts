export type RootStackParamList={
  Tabs:undefined;
  Smart:undefined;
  SOS:undefined;
  Heatmap:undefined;
  Settings:undefined;
  MemoryDetail:{photoId:number};
  PlaceDetail:{placeId?:string;name?:string;latitude?:number;longitude?:number;osmType?:'node'|'way'|'relation';osmId?:number}|undefined;
  Login:{redirectTo?:string}|undefined;
};

export type MainTabsParamList={
  Map:{destination?:{latitude:number;longitude:number;name:string};travelMode?:'motorbike'|'car';focusFriendId?:string}|undefined;
  Timeline:undefined;
  Memories:{focusSearch?:boolean}|undefined;
  Friends:undefined;
  Profile:undefined;
};
