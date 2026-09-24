import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Text } from '../ui/Text';
import { env } from '../config/env';
import {
  firebaseGoogleAndroidClientId,
  firebaseGoogleWebClientId,
} from '../services/firebase';
import { signInWithGoogleToken, type AuthResult } from '../services/auth';

WebBrowser.maybeCompleteAuthSession();

type Props = {
  disabled: boolean;
  loading: boolean;
  onStart: () => void;
  onFinish: () => void;
  onResult: (result: AuthResult) => void;
  onError: (message: string) => void;
};

function UnconfiguredGoogleButton({ disabled }: Pick<Props, 'disabled'>) {
  return (
    <TouchableOpacity style={[styles.button, styles.disabled]} disabled={disabled || true}>
      <MaterialCommunityIcons name="google" size={22} color="#74777A" />
      <View style={styles.copy}>
        <Text style={styles.titleDisabled}>Google chưa được cấu hình</Text>
        <Text style={styles.subtitle}>Thêm OAuth client Android/iOS vào Firebase rồi tải lại file cấu hình</Text>
      </View>
    </TouchableOpacity>
  );
}

function ConfiguredGoogleButton(props: Props) {
  const handledResponse = useRef<string | null>(null);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: firebaseGoogleAndroidClientId ?? undefined,
    iosClientId: env.googleIosClientId || undefined,
    webClientId: env.googleWebClientId || firebaseGoogleWebClientId || undefined,
    selectAccount: true,
  });

  useEffect(() => {
    if (!response) return;
    const responseKey = JSON.stringify(response);
    if (handledResponse.current === responseKey) return;
    handledResponse.current = responseKey;

    if (response.type !== 'success') {
      props.onFinish();
      if (response.type === 'error') {
        props.onError(response.error?.message || 'Không thể hoàn tất đăng nhập Google.');
      }
      return;
    }

    const idToken = response.params.id_token || response.authentication?.idToken;
    const accessToken = response.params.access_token || response.authentication?.accessToken;
    if (!idToken) {
      props.onFinish();
      props.onError('Google không trả về ID token. Hãy kiểm tra OAuth client trong Firebase.');
      return;
    }

    void signInWithGoogleToken(idToken, accessToken).then(props.onResult).catch((error: unknown) => {
      props.onError(error instanceof Error ? error.message : 'Không thể đăng nhập bằng Google.');
    }).finally(props.onFinish);
  }, [response, props]);

  const handlePress = async () => {
    props.onStart();
    try {
      await promptAsync();
    } catch (error) {
      props.onError(error instanceof Error ? error.message : 'Không thể mở trang đăng nhập Google.');
      props.onFinish();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, (props.disabled || !request) && styles.disabled]}
      onPress={handlePress}
      disabled={props.disabled || !request}
      activeOpacity={0.82}
    >
      {props.loading ? (
        <ActivityIndicator size="small" color="#4285F4" />
      ) : (
        <MaterialCommunityIcons name="google" size={22} color="#4285F4" />
      )}
      <Text style={styles.title}>Tiếp tục với Google</Text>
    </TouchableOpacity>
  );
}

export default function GoogleFirebaseButton(props: Props) {
  const configured = Platform.select({
    android: Boolean(firebaseGoogleAndroidClientId),
    ios: Boolean(env.googleIosClientId),
    default: Boolean(env.googleWebClientId || firebaseGoogleWebClientId),
  });

  if (!configured) return <UnconfiguredGoogleButton disabled={props.disabled} />;
  return <ConfiguredGoogleButton {...props} />;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  disabled: {
    opacity: 0.58,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: '#3C4043',
    fontSize: 14.5,
    fontWeight: '800',
  },
  titleDisabled: {
    color: '#55595D',
    fontSize: 13.5,
    fontWeight: '800',
  },
  subtitle: {
    color: '#74777A',
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 1,
  },
});
