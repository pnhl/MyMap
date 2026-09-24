import { getAuth, onAuthStateChanged, type User as FirebaseUser } from '@react-native-firebase/auth';
import type { Session, User } from '@supabase/supabase-js';
import googleServices from '../../google-services.json';

type GoogleServicesClient = {
  client_info: {
    mobilesdk_app_id: string;
    android_client_info?: { package_name?: string };
  };
  api_key?: Array<{ current_key?: string }>;
  oauth_client?: Array<{ client_id?: string; client_type?: number }>;
};

const PACKAGE_NAME = 'com.pnhl.vibecoding';
const clients = googleServices.client as GoogleServicesClient[];
const androidClient = clients.find(
  client => client.client_info.android_client_info?.package_name === PACKAGE_NAME,
) ?? clients[0];
const oauthClients = androidClient?.oauth_client ?? [];

if (!androidClient?.client_info.mobilesdk_app_id || !androidClient.api_key?.[0]?.current_key) {
  throw new Error('google-services.json không chứa cấu hình Firebase hợp lệ cho MyMap.');
}

export const firebaseAuth = getAuth();
export const firebaseProjectId = googleServices.project_info.project_id;
export const firebaseGoogleAndroidClientId =
  oauthClients.find(client => client.client_type === 1)?.client_id ?? null;
export const firebaseGoogleWebClientId =
  oauthClients.find(client => client.client_type === 3)?.client_id ?? null;
export const firebaseGoogleOAuthConfigured = Boolean(
  firebaseGoogleAndroidClientId || firebaseGoogleWebClientId,
);

let authReadyPromise: Promise<void> | null = null;

export function waitForFirebaseAuth(): Promise<void> {
  if (!authReadyPromise) {
    authReadyPromise = new Promise(resolve => {
      const unsubscribe = onAuthStateChanged(firebaseAuth, () => {
        unsubscribe();
        resolve();
      });
    });
  }
  return authReadyPromise;
}

export async function getFirebaseIdToken(): Promise<string | null> {
  await waitForFirebaseAuth();
  return firebaseAuth.currentUser?.getIdToken(false) ?? null;
}

export function firebaseUserAsAppUser(user: FirebaseUser): User {
  const providers = user.providerData.map(item => item.providerId).filter(Boolean);
  const createdAt = user.metadata.creationTime ?? new Date().toISOString();
  const updatedAt = user.metadata.lastSignInTime ?? createdAt;
  return {
    id: user.uid,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email ?? undefined,
    phone: user.phoneNumber ?? undefined,
    email_confirmed_at: user.emailVerified ? updatedAt : undefined,
    app_metadata: {
      provider: providers[0] ?? (user.isAnonymous ? 'anonymous' : 'firebase'),
      providers,
      firebase_project_id: firebaseProjectId,
    },
    user_metadata: {
      name: user.displayName,
      full_name: user.displayName,
      avatar_url: user.photoURL,
      is_anonymous: user.isAnonymous,
    },
    identities: [],
    created_at: createdAt,
    updated_at: updatedAt,
    is_anonymous: user.isAnonymous,
  } as User;
}

export async function firebaseSession(): Promise<Session | null> {
  await waitForFirebaseAuth();
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  const tokenResult = await user.getIdTokenResult(false);
  const expiresAt = Math.floor(new Date(tokenResult.expirationTime).getTime() / 1000);
  return {
    access_token: tokenResult.token,
    refresh_token: 'firebase-native-managed',
    token_type: 'bearer',
    expires_in: Math.max(0, expiresAt - Math.floor(Date.now() / 1000)),
    expires_at: expiresAt,
    user: firebaseUserAsAppUser(user),
  };
}
