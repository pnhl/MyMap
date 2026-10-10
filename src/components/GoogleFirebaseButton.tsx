import React from 'react';
import {googleSignInAvailable} from '../services/nativeSdks';
import type {AuthResult} from '../services/auth';
type Props={disabled:boolean;loading:boolean;linkAccount?:boolean;onStart:()=>void;onFinish:()=>void;onResult:(result:AuthResult)=>void;onError:(message:string)=>void};
export default function GoogleFirebaseButton(props:Props){
 if(!googleSignInAvailable())return null;
 const Button=require('./GoogleFirebaseButtonNative').default as React.ComponentType<Props>;
 return <Button {...props}/>;
}
