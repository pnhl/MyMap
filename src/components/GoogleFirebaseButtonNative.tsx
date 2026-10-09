import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { Text } from '../ui/Text';
import { env } from '../config/env';
import {
  firebaseGoogleAndroidClientId,
  firebaseGoogleWebClientId,
} from '../services/firebase';
import { signInWithGoogleToken, type AuthResult } from '../services/auth';

type Props = {
  disabled: boolean;
  loading: boolean;
  onStart: () => void;
  onFinish: () => void;
  onResult: (result: AuthResult) => void;
  onError: (message: string) => void;
};

const googleWebClientId = env.googleWebClientId || firebaseGoogleWebClientId || undefined;

if (googleWebClientId) {
  GoogleSignin.configure({
    webClientId: googleWebClientId,
    iosClientId: env.googleIosClientId || undefined,
    offlineAccess: false,
  });
}

function UnconfiguredGoogleButton({ disabled }: Pick<Props, 'disabled'>) {
  return (
    <TouchableOpacity style={[styles.button, styles.disabled]} disabled={disabled || true}>
      <MaterialCommunityIcons name="google" size={22} color="#74777A" />
      <View style={styles.copy}>
        <Text style={styles.titleDisabled}>Google chưa được cấu hình</Text>
        <Text style={styles.subtitle}>Thêm OAuth client Android và Web vào Firebase rồi tải lại file cấu hình</Text>
      </View>
    </TouchableOpacity>
  );
}

function googleSignInError(error: unknown): string {
  if (!isErrorWithCode(error)) {
    return error instanceof Error ? error.message : 'Không thể đăng nhập bằng Google.';
  }
  if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return 'Thiết bị không có Google Play Services. Trên Fire OS, hãy dùng email, số điện thoại hoặc tài khoản Khách.';
  }
  if (error.code === statusCodes.IN_PROGRESS) {
    return 'Một yêu cầu đăng nhập Google khác đang được xử lý.';
  }
  if (error.code === '10' || error.code === 'DEVELOPER_ERROR') {
    return 'OAuth Google chưa khớp chữ ký SHA-1 của APK. Hãy cài đúng bản phát hành mới nhất.';
  }
  return error.message || 'Không thể đăng nhập bằng Google.';
}

function ConfiguredGoogleButton(props: Props) {
  const handlePress = async () => {
    props.onStart();
    try {
      if (Platform.OS === 'android') {
        const available = await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: false,
        });
        if (!available) {
          props.onError(
            'Thiết bị không có Google Play Services. Trên Fire OS, hãy dùng email, số điện thoại hoặc tài khoản Khách.',
          );
          return;
        }
      }

      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return;

      const idToken = response.data.idToken;
      if (!idToken) {
        props.onError('Google không trả về ID token. Hãy kiểm tra OAuth client Web trong Firebase.');
        return;
      }

      const result = await signInWithGoogleToken(idToken);
      props.onResult(result);
    } catch (error) {
      props.onError(googleSignInError(error));
    } finally {
      props.onFinish();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, props.disabled && styles.disabled]}
      onPress={handlePress}
      disabled={props.disabled}
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
    android: Boolean(firebaseGoogleAndroidClientId && googleWebClientId),
    ios: Boolean(env.googleIosClientId && googleWebClientId),
    default: false,
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
