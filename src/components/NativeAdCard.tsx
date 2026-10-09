import React from 'react';
import {adsSdkAvailable} from '../services/nativeSdks';
type Props={placement:'smart'|'friends'|'timeline'|'stats'|'profile'|'memories'|'heatmap'|'settings'|'place';compact?:boolean};
export function NativeAdCard(props:Props){
 if(!adsSdkAvailable())return null;
 const Card=require('./NativeAdCardGoogle').NativeAdCard as React.ComponentType<Props>;
 return <Card {...props}/>;
}
