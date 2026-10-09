import React,{useState} from 'react';
import {Text} from '../ui/Text';
import {TextInput} from '../ui/TextInput';
import {GlassSurface,GlassButton,glassColors} from '../ui/glass';
import {linkAccountEmail} from '../services/auth';
export function AccountLinkSettings(){
 const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function link(){if(busy)return;setMessage('');if(password!==confirmation){setMessage('Hai mật khẩu chưa giống nhau.');return;}setBusy(true);try{const result=await linkAccountEmail(email,password);setMessage(result.error||'Đã liên kết. Bạn có thể dùng email này đăng nhập cùng tài khoản trên iPhone, Android và Fire. Hãy kiểm tra email xác minh.');if(!result.error){setPassword('');setConfirmation('');}}finally{setBusy(false);}}
 const style={color:glassColors.text,backgroundColor:'#101B30',padding:12,borderRadius:12};
 return <GlassSurface style={{padding:18,gap:12}}><Text style={{fontSize:20,fontWeight:'800'}}>Dùng cùng tài khoản trên mọi thiết bị</Text><Text style={{color:glassColors.muted,lineHeight:20}}>Đăng nhập tài khoản Apple, Google hoặc khách muốn giữ trước, rồi thêm email và mật khẩu. Liên kết giữ nguyên mã tài khoản; không tự gộp tài khoản khác có cùng email.</Text><TextInput accessibilityLabel="Email liên kết" placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!busy} style={style}/><TextInput accessibilityLabel="Mật khẩu liên kết" placeholder="Mật khẩu mới" secureTextEntry autoCapitalize="none" value={password} onChangeText={setPassword} editable={!busy} style={style}/><TextInput accessibilityLabel="Xác nhận mật khẩu liên kết" placeholder="Nhập lại mật khẩu" secureTextEntry autoCapitalize="none" value={confirmation} onChangeText={setConfirmation} editable={!busy} style={style}/><GlassButton disabled={busy} onPress={()=>void link()}><Text>{busy?'Đang liên kết…':'Liên kết email vào tài khoản hiện tại'}</Text></GlassButton>{!!message&&<Text accessibilityLiveRegion="polite">{message}</Text>}</GlassSurface>;
}
