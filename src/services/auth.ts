import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  AppleAuthProvider,
  GoogleAuthProvider,
  EmailAuthProvider,
  PhoneAuthProvider,
  verifyPhoneNumber,
  linkWithCredential,
  createUserWithEmailAndPassword,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendEmailVerification,
  sendSignInLinkToEmail,
  sendPasswordResetEmail,
  signInAnonymously as firebaseSignInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPhoneNumber,
  signOut,
  updateProfile,
  type AuthError,
  type ConfirmationResult,
  type AuthCredential,
} from '@react-native-firebase/auth';
import {
  firebaseAuth,
  firebaseSession,
  firebaseUserAsAppUser,
  waitForFirebaseAuth,
} from './firebase';
import MyMapGameCenter from '../../modules/my-map-game-center';

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error?: string | null;
}

export const OAUTH_CALLBACK_URL = 'mymap://auth/callback';
const EMAIL_LINK_KEY = 'mymap:firebase-email-link-address';
let phoneConfirmation: ConfirmationResult | null = null;
let phoneLink: {owner: string; verificationId: string; expires: number} | null = null;
let phoneLinkGeneration = 0;

async function useProviderCredential(credential: AuthCredential, expectedOwner?: string) {
  if (!expectedOwner) return signInWithCredential(firebaseAuth, credential);
  const user = firebaseAuth.currentUser;
  if (!user || user.uid !== expectedOwner) throw Error('Tài khoản đã thay đổi. Hãy bắt đầu liên kết lại.');
  const result = await linkWithCredential(user, credential);
  if (result.user.uid !== expectedOwner) throw Error('Không thể xác nhận tài khoản liên kết.');
  return result;
}

function authErrorMessage(error: unknown, fallback: string): string {
  const authError = error as Partial<AuthError> | undefined;
  switch (authError?.code) {
    case 'auth/invalid-email':
      return 'Địa chỉ email không hợp lệ.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Email hoặc mật khẩu không đúng.';
    case 'auth/email-already-in-use':
      return 'Email này đã có tài khoản Firebase.';
    case 'auth/credential-already-in-use':
      return 'Thông tin đăng nhập này thuộc tài khoản khác. Không thể tự động gộp dữ liệu; hãy đăng nhập tài khoản đó hoặc chọn phương thức khác.';
    case 'auth/requires-recent-login':
      return 'Hãy đăng nhập lại bằng phương thức hiện tại rồi liên kết để xác nhận danh tính.';
    case 'auth/weak-password':
      return 'Mật khẩu chưa đáp ứng chính sách bảo mật của Firebase.';
    case 'auth/user-disabled':
      return 'Tài khoản đã bị vô hiệu hóa.';
    case 'auth/too-many-requests':
      return 'Có quá nhiều lần thử. Hãy đợi một lúc rồi đăng nhập lại.';
    case 'auth/network-request-failed':
      return 'Không thể kết nối Firebase. Hãy kiểm tra mạng và thử lại.';
    case 'auth/operation-not-allowed':
      return 'Phương thức đăng nhập này chưa được bật trong Firebase Authentication.';
    case 'auth/configuration-not-found':
      return 'Firebase Authentication chưa được khởi tạo cho project mymap-a3ae4. Hãy bật Authentication trong Firebase Console.';
    case 'auth/admin-restricted-operation':
      return 'Đăng nhập khách chưa được bật trong Firebase Authentication.';
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return 'Liên kết đăng nhập đã hết hạn hoặc không còn hợp lệ.';
    case 'auth/invalid-phone-number':
      return 'Số điện thoại không hợp lệ. Hãy dùng định dạng quốc tế, ví dụ +84901234567.';
    case 'auth/invalid-verification-code':
      return 'Mã OTP không đúng hoặc đã hết hạn.';
    case 'auth/quota-exceeded':
      return 'Đã vượt giới hạn gửi SMS của Firebase. Hãy thử lại sau.';
    case 'auth/missing-client-identifier':
      return 'Thiếu OAuth client cho ứng dụng này. Hãy cập nhật cấu hình Firebase và rebuild.';
    default:
      return authError?.message || fallback;
  }
}

async function currentResult(): Promise<AuthResult> {
  // Force a fresh native Firebase token after sign-in so Supabase receives the
  // latest subject/provider metadata on the first data request.
  const session = await firebaseSession(true);
  return { user: session?.user ?? null, session, error: null };
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    await waitForFirebaseAuth();
    return firebaseAuth.currentUser ? firebaseUserAsAppUser(firebaseAuth.currentUser) : null;
  } catch {
    return null;
  }
}

export async function getCurrentSession(): Promise<Session | null> {
  try {
    return await firebaseSession();
  } catch {
    return null;
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) {
    return { user: null, session: null, error: 'Vui lòng nhập đầy đủ email và mật khẩu.' };
  }
  try {
    await signInWithEmailAndPassword(firebaseAuth, cleanEmail, password);
    return currentResult();
  } catch (error) {
    return { user: null, session: null, error: authErrorMessage(error, 'Không thể đăng nhập Firebase.') };
  }
}

// Add a portable login method to the current Apple/Google/guest UID. Never
// create a second account or merge another owner's data on an email collision.
export async function linkAccountEmail(email:string,password:string):Promise<AuthResult>{
 const cleanEmail=email.trim().toLowerCase();
 if(!cleanEmail.includes('@')||password.length<6)return{user:null,session:null,error:'Nhập email hợp lệ và mật khẩu ít nhất 6 ký tự.'};
 try{
  await waitForFirebaseAuth();const user=firebaseAuth.currentUser;
  if(!user)return{user:null,session:null,error:'Hãy đăng nhập tài khoản muốn liên kết trước.'};
  if(user.providerData.some(p=>p.providerId==='password'))return{user:null,session:null,error:'Tài khoản đã có phương thức email/mật khẩu. Dùng đặt lại mật khẩu ở màn hình đăng nhập nếu cần.'};
  const result=await linkWithCredential(user,EmailAuthProvider.credential(cleanEmail,password));
  if(result.user.uid!==user.uid)throw Error('Không thể xác nhận tài khoản liên kết.');
  await sendEmailVerification(result.user).catch(()=>undefined);
  return currentResult();
 }catch(error){return{user:null,session:null,error:authErrorMessage(error,'Chưa liên kết được email.')};}
}

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName?: string,
): Promise<AuthResult> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = fullName?.trim();
  if (!cleanEmail || !password) {
    return { user: null, session: null, error: 'Vui lòng nhập email và mật khẩu.' };
  }
  if (password.length < 6) {
    return { user: null, session: null, error: 'Mật khẩu cần tối thiểu 6 ký tự.' };
  }
  try {
    const credential = await createUserWithEmailAndPassword(firebaseAuth, cleanEmail, password);
    if (cleanName) await updateProfile(credential.user, { displayName: cleanName });
    await sendEmailVerification(credential.user).catch(() => undefined);
    return currentResult();
  } catch (error) {
    return { user: null, session: null, error: authErrorMessage(error, 'Không thể tạo tài khoản Firebase.') };
  }
}

export async function signInAnonymously(): Promise<AuthResult> {
  try {
    await firebaseSignInAnonymously(firebaseAuth);
    return currentResult();
  } catch (error) {
    return { user: null, session: null, error: authErrorMessage(error, 'Không thể đăng nhập khách Firebase.') };
  }
}

export async function signInWithGoogleToken(
  idToken: string,
  accessToken?: string | null,
  expectedOwner?: string,
): Promise<AuthResult> {
  if (!idToken) {
    return { user: null, session: null, error: 'Google không trả về ID token hợp lệ.' };
  }
  try {
    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    await useProviderCredential(credential, expectedOwner);
    return currentResult();
  } catch (error) {
    return { user: null, session: null, error: authErrorMessage(error, 'Không thể đăng nhập bằng Google.') };
  }
}

export async function signInWithApple(linkAccount = false): Promise<AuthResult> {
  try {
    await waitForFirebaseAuth();
    const owner = linkAccount ? firebaseAuth.currentUser?.uid : undefined;
    if (linkAccount && !owner) throw Error('Hãy đăng nhập tài khoản muốn liên kết trước.');
    if (!(await AppleAuthentication.isAvailableAsync())) {
      return { user: null, session: null, error: 'Sign in with Apple chỉ khả dụng trên thiết bị Apple được hỗ trợ.' };
    }
    const rawNonce = Crypto.randomUUID().replace(/-/g, '');
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );
    const apple = await AppleAuthentication.signInAsync({
      nonce: hashedNonce,
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!apple.identityToken) {
      return { user: null, session: null, error: 'Apple không trả về identity token.' };
    }
    const credential = AppleAuthProvider.credential(apple.identityToken, rawNonce);
    const result = await useProviderCredential(credential, owner);
    const displayName = apple.fullName
      ? [apple.fullName.givenName, apple.fullName.familyName].filter(Boolean).join(' ')
      : '';
    if (displayName && !result.user.displayName) {
      await updateProfile(result.user, { displayName }).catch(() => undefined);
    }
    return currentResult();
  } catch (error) {
    if ((error as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
      return { user: null, session: null, error: 'Bạn đã hủy đăng nhập bằng Apple.' };
    }
    return { user: null, session: null, error: authErrorMessage(error, 'Không thể đăng nhập bằng Apple.') };
  }
}

export async function sendPhoneCode(phoneNumber: string): Promise<{ success: boolean; error?: string | null }> {
  const cleanPhone = phoneNumber.replace(/[\s()-]/g, '');
  if (!/^\+[1-9][0-9]{6,14}$/.test(cleanPhone)) {
    return { success: false, error: 'Nhập số điện thoại quốc tế, ví dụ +84901234567.' };
  }
  try {
    phoneConfirmation = await signInWithPhoneNumber(firebaseAuth, cleanPhone);
    return { success: true, error: null };
  } catch (error) {
    phoneConfirmation = null;
    return { success: false, error: authErrorMessage(error, 'Không thể gửi mã OTP Firebase.') };
  }
}

export async function confirmPhoneCode(code: string): Promise<AuthResult> {
  const cleanCode = code.replace(/\s/g, '');
  if (!phoneConfirmation) {
    return { user: null, session: null, error: 'Hãy yêu cầu gửi mã OTP trước.' };
  }
  if (!/^[0-9]{6}$/.test(cleanCode)) {
    return { user: null, session: null, error: 'Mã OTP phải gồm 6 chữ số.' };
  }
  try {
    await phoneConfirmation.confirm(cleanCode);
    phoneConfirmation = null;
    return currentResult();
  } catch (error) {
    return { user: null, session: null, error: authErrorMessage(error, 'Không thể xác nhận mã OTP.') };
  }
}

// Verification alone never signs in or changes UID. Confirmation explicitly
// links a credential to the owner captured before the SMS request.
export async function sendPhoneLinkCode(phoneNumber: string): Promise<{success: boolean; error?: string}> {
  const cleanPhone = phoneNumber.replace(/[\s()-]/g, '');
  if (!/^\+[1-9][0-9]{6,14}$/.test(cleanPhone)) return {success:false,error:'Nhập số điện thoại quốc tế, ví dụ +84901234567.'};
  const epoch = ++phoneLinkGeneration;
  phoneLink = null;
  try {
    await waitForFirebaseAuth();
    const owner = firebaseAuth.currentUser?.uid;
    if (!owner) throw Error('Hãy đăng nhập tài khoản muốn liên kết trước.');
    const verificationId = await new Promise<string>((resolve,reject) => {
      const timer = setTimeout(() => reject(Error('Yêu cầu OTP đã hết thời gian. Hãy thử lại.')),180000);
      const finish = (id?: string, error?: unknown) => {clearTimeout(timer);if(error)reject(error);else if(id)resolve(id);else reject(Error('Firebase không trả về phiên xác minh OTP.'));};
      try {
        verifyPhoneNumber(firebaseAuth,cleanPhone).on('state_changed',snapshot => {
          if (snapshot.state === 'error') finish(undefined,snapshot.error);
          else if (snapshot.verificationId) finish(snapshot.verificationId);
        }, error => finish(undefined,error));
      } catch (error) {finish(undefined,error);}
    });
    if (epoch !== phoneLinkGeneration || firebaseAuth.currentUser?.uid !== owner) throw Error('Tài khoản đã thay đổi. Hãy bắt đầu liên kết lại.');
    phoneLink = {owner,verificationId,expires:Date.now()+300000};
    return {success:true};
  } catch (error) {return {success:false,error:authErrorMessage(error,'Không thể gửi mã liên kết điện thoại.')};}
}

export async function confirmPhoneLinkCode(code: string): Promise<AuthResult> {
  const pending = phoneLink;
  if (!pending || pending.expires < Date.now()) return {user:null,session:null,error:'Hãy yêu cầu mã liên kết điện thoại mới.'};
  if (!/^[0-9]{6}$/.test(code.trim())) return {user:null,session:null,error:'Mã OTP phải gồm 6 chữ số.'};
  try {
    await useProviderCredential(PhoneAuthProvider.credential(pending.verificationId,code.trim()),pending.owner);
    phoneLink = null;
    return currentResult();
  } catch (error) {return {user:null,session:null,error:authErrorMessage(error,'Chưa liên kết được điện thoại.')};}
}

export async function signInWithGameCenter(): Promise<AuthResult> {
  if (!MyMapGameCenter?.signIn) {
    return { user: null, session: null, error: 'Game Center chỉ khả dụng trong bản build iOS native.' };
  }
  try {
    await MyMapGameCenter.signIn();
    return currentResult();
  } catch (error) {
    return { user: null, session: null, error: authErrorMessage(error, 'Không thể đăng nhập bằng Game Center.') };
  }
}

export async function signInWithMagicLink(email: string): Promise<{ success: boolean; error?: string | null }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Vui lòng nhập địa chỉ email hợp lệ.' };
  }
  if(!emailLinkConfigured())return{success:false,error:'Chưa cấu hình Firebase Hosting cho liên kết đăng nhập. Bạn vẫn có thể dùng email và mật khẩu.'};
  try{
    await sendSignInLinkToEmail(firebaseAuth,cleanEmail,{url:process.env.EXPO_PUBLIC_EMAIL_LINK_CONTINUE_URL!,handleCodeInApp:true,linkDomain:process.env.EXPO_PUBLIC_EMAIL_LINK_DOMAIN!,iOS:{bundleId:'com.pnhl.vibecoding'},android:{packageName:'com.pnhl.vibecoding',installApp:false}});
    await AsyncStorage.setItem(EMAIL_LINK_KEY,cleanEmail);return{success:true,error:null};
  }catch(error){return{success:false,error:authErrorMessage(error,'Chưa gửi được liên kết đăng nhập.')};}
}

export function emailLinkConfigured(){
 const domain=process.env.EXPO_PUBLIC_EMAIL_LINK_DOMAIN||'',continuation=process.env.EXPO_PUBLIC_EMAIL_LINK_CONTINUE_URL||'';
 try{const url=new URL(continuation);return url.protocol==='https:'&&!url.username&&!url.password&&/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(domain)&&!['localhost','127.0.0.1'].includes(url.hostname);}catch{return false;}
}
export function isEmailSignInLink(url:string){return emailLinkConfigured()&&isSignInWithEmailLink(firebaseAuth,url);}

export async function sendPasswordReset(email: string): Promise<{ success: boolean; error?: string | null }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Vui lòng nhập địa chỉ email hợp lệ.' };
  }
  try {
    await sendPasswordResetEmail(firebaseAuth, cleanEmail);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: authErrorMessage(error, 'Không thể gửi email đặt lại mật khẩu.') };
  }
}

export function parseAuthParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!url) return params;
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const queryString = hashIndex !== -1
    ? url.substring(hashIndex + 1)
    : queryIndex !== -1
      ? url.substring(queryIndex + 1)
      : '';
  if (!queryString) return params;
  for (const pair of queryString.split('&')) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const rawKey = pair.substring(0, eqIdx).trim();
    const rawVal = pair.substring(eqIdx + 1).trim();
    try {
      params[decodeURIComponent(rawKey)] = decodeURIComponent(rawVal.replace(/\+/g, ' '));
    } catch {
      params[rawKey] = rawVal;
    }
  }
  return params;
}

export async function handleAuthUrl(url: string, confirmationEmail?:string): Promise<AuthResult> {
  try {
    if (!isSignInWithEmailLink(firebaseAuth, url)) {
      const params = parseAuthParams(url);
      const error = params.error_description || params.error;
      return { user: null, session: null, error: error || 'Liên kết không phải callback Firebase hợp lệ.' };
    }
    const email = confirmationEmail?.trim().toLowerCase() || await AsyncStorage.getItem(EMAIL_LINK_KEY);
    if (!email) {
      return { user: null, session: null, error: 'Cần nhập lại email để xác nhận liên kết đăng nhập.' };
    }
    await signInWithEmailLink(firebaseAuth, email, url);
    await AsyncStorage.removeItem(EMAIL_LINK_KEY);
    return currentResult();
  } catch (error) {
    return { user: null, session: null, error: authErrorMessage(error, 'Không thể xử lý callback Firebase.') };
  }
}

export async function signOutUser(): Promise<{ error?: string | null }> {
  try {
    phoneLinkGeneration++; phoneLink = null; phoneConfirmation = null;
    await import('./pushRegistration').then(m=>m.revokePushDelivery()).catch(()=>undefined);
    await signOut(firebaseAuth);
    return { error: null };
  } catch (error) {
    return { error: authErrorMessage(error, 'Không thể đăng xuất Firebase.') };
  }
}

export function subscribeAuthState(callback: (event: string, session: Session | null) => void) {
  let wasSignedIn = Boolean(firebaseAuth.currentUser);
  return onAuthStateChanged(firebaseAuth, user => {
    if (!user) {
      const event = wasSignedIn ? 'SIGNED_OUT' : 'INITIAL_SESSION';
      wasSignedIn = false;
      callback(event, null);
      return;
    }
    const event = wasSignedIn ? 'TOKEN_REFRESHED' : 'SIGNED_IN';
    wasSignedIn = true;
    void firebaseSession().then(session => callback(event, session));
  });
}
