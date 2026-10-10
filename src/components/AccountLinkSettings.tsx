import React,{useEffect,useState} from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import {Text} from '../ui/Text';
import {TextInput} from '../ui/TextInput';
import {GlassSurface,GlassButton,glassColors} from '../ui/glass';
import GoogleFirebaseButton from './GoogleFirebaseButton';
import {linkAccountEmail,signInWithApple,sendPhoneLinkCode,confirmPhoneLinkCode,type AuthResult} from '../services/auth';
export function AccountLinkSettings(){
 const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const[phone,setPhone]=useState(''),[code,setCode]=useState(''),[codeSent,setCodeSent]=useState(false),[apple,setApple]=useState(false);
 useEffect(()=>{void AppleAuthentication.isAvailableAsync().then(setApple).catch(()=>setApple(false));},[]);
 function result(value:AuthResult){setMessage(value.error||'Đã liên kết phương thức đăng nhập vào cùng tài khoản.');}
 async function linkApple(){setBusy(true);try{result(await signInWithApple(true));}finally{setBusy(false);}}
 async function sendCode(){setBusy(true);setCodeSent(false);setCode('');try{const value=await sendPhoneLinkCode(phone);setCodeSent(value.success);setMessage(value.error||'Đã yêu cầu OTP. Nhập mã để liên kết điện thoại.');}finally{setBusy(false);}}
 async function linkPhone(){setBusy(true);try{const value=await confirmPhoneLinkCode(code);result(value);if(!value.error){setCode('');setCodeSent(false);}}finally{setBusy(false);}}
 async function link(){if(busy)return;setMessage('');if(password!==confirmation){setMessage('Hai mật khẩu chưa giống nhau.');return;}setBusy(true);try{const result=await linkAccountEmail(email,password);setMessage(result.error||'Đã liên kết. Bạn có thể dùng email này đăng nhập cùng tài khoản trên iPhone, Android và Fire. Hãy kiểm tra email xác minh.');if(!result.error){setPassword('');setConfirmation('');}}finally{setBusy(false);}}
 const style={color:glassColors.text,backgroundColor:'#101B30',padding:12,borderRadius:12};
 return <GlassSurface style={{padding:18,gap:12}}>
 <Text style={{fontSize:20,fontWeight:'800'}}>Dùng cùng tài khoản trên mọi thiết bị</Text>
 <Text style={{color:glassColors.muted,lineHeight:20}}>Thêm phương thức đăng nhập để giữ nguyên dữ liệu tài khoản hiện tại. Thông tin đã thuộc tài khoản khác sẽ bị từ chối; ứng dụng không tự gộp tài khoản.</Text>
 <TextInput accessibilityLabel="Email liên kết" placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!busy} style={style}/>
 <TextInput accessibilityLabel="Mật khẩu liên kết" placeholder="Mật khẩu mới" secureTextEntry autoCapitalize="none" value={password} onChangeText={setPassword} editable={!busy} style={style}/>
 <TextInput accessibilityLabel="Xác nhận mật khẩu liên kết" placeholder="Nhập lại mật khẩu" secureTextEntry autoCapitalize="none" value={confirmation} onChangeText={setConfirmation} editable={!busy} style={style}/>
 <GlassButton disabled={busy} onPress={()=>void link()}><Text>{busy?'Đang liên kết…':'Liên kết email'}</Text></GlassButton>
 <GoogleFirebaseButton disabled={busy} loading={busy} linkAccount onStart={()=>{setBusy(true);setMessage('');}} onFinish={()=>setBusy(false)} onResult={result} onError={setMessage}/>
 {apple&&<GlassButton disabled={busy} onPress={()=>void linkApple()}><Text>Liên kết Apple</Text></GlassButton>}
 <TextInput accessibilityLabel="Số điện thoại liên kết" placeholder="Số điện thoại (+84…)" keyboardType="phone-pad" value={phone} onChangeText={value=>{setPhone(value);setCodeSent(false);}} editable={!busy} style={style}/>
 <GlassButton disabled={busy} onPress={()=>void sendCode()}><Text>Gửi OTP liên kết điện thoại</Text></GlassButton>
 {codeSent&&<><TextInput accessibilityLabel="Mã OTP liên kết" placeholder="Mã OTP 6 chữ số" keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} editable={!busy} style={style}/><GlassButton disabled={busy} onPress={()=>void linkPhone()}><Text>Xác nhận liên kết điện thoại</Text></GlassButton></>}
 {!!message&&<Text accessibilityLiveRegion="polite">{message}</Text>}</GlassSurface>;
}
