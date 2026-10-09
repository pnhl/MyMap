import {Text,VStack} from '@expo/ui/swift-ui';
import {font,lineLimit} from '@expo/ui/swift-ui/modifiers';
import {createLiveActivity} from 'expo-widgets';
export type JourneyActivityProps={tracking:boolean;instruction:string;speed:string};
export default createLiveActivity<JourneyActivityProps>('MyMapJourneyActivity',(props)=>{
 'widget';
 return {
  banner:<VStack><Text modifiers={[font({size:16,weight:'bold'})]}>MyMap · {props.tracking?'Đang ghi hành trình':'Đang dẫn đường'}</Text><Text modifiers={[lineLimit(2)]}>{props.instruction}</Text><Text>{props.speed}</Text></VStack>,
  compactLeading:<Text>MyMap</Text>,compactTrailing:<Text>{props.speed}</Text>,minimal:<Text>↗</Text>,
  expandedCenter:<Text modifiers={[lineLimit(2)]}>{props.instruction}</Text>,
 };
});
