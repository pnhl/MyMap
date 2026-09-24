import * as ImagePicker from 'expo-image-picker';
import jpeg from 'jpeg-js';
import jsQR from 'jsqr';

export function accountCodeFromQR(value: string) {
  const raw = value.trim();
  const prefixed = raw.match(/^mymap:friend:(.+)$/i)
    ?? raw.match(/^mymap:\/\/(?:friend|add)\/(.+)$/i);
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !prefixed) {
    throw new Error('Đây không phải mã kết bạn MyMap.');
  }
  const code = (prefixed?.[1] ?? raw).trim().toUpperCase();
  if (!/^[A-Z0-9_-]{4,80}$/.test(code)) throw new Error('Đây không phải mã kết bạn MyMap.');
  return code;
}
export async function scanAccountQR(): Promise<string|null> {
  const permission=await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('Cần quyền máy ảnh để chụp mã QR.');
  const photo=await ImagePicker.launchCameraAsync({base64:true,quality:.4,allowsEditing:true,aspect:[1,1]});
  if(photo.canceled) return null;
  const image=photo.assets[0];
  if(!image?.base64) throw new Error('Không thể đọc ảnh QR. Bạn có thể nhập mã kết bạn.');
  const binary=globalThis.atob(image.base64);
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  try {
    const decoded=jpeg.decode(bytes,{useTArray:true,maxResolutionInMP:8,maxMemoryUsageInMB:128});
    const result=jsQR(new Uint8ClampedArray(decoded.data),decoded.width,decoded.height);
    if(!result) throw new Error('Không tìm thấy mã QR. Chụp gần hơn, đủ sáng và giữ trọn mã trong ảnh.');
    return accountCodeFromQR(result.data);
  } catch (error) {
    if(error instanceof Error && error.message.startsWith('Không tìm')) throw error;
    if(error instanceof Error && error.message.startsWith('Đây không')) throw error;
    throw new Error('Không thể giải mã ảnh này. Hãy chụp lại mã QR hoặc nhập mã kết bạn.');
  }
}
