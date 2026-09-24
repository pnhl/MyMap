/// <reference types="node" />
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { existsSync } from 'node:fs';

const ANDROID_TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const IOS_TEST_APP_ID = 'ca-app-pub-3940256099942544~1458002511';

export default ({ config }: ConfigContext): ExpoConfig => {
  const configuredSchemes = Array.isArray(config.scheme)
    ? config.scheme
    : config.scheme
      ? [config.scheme]
      : [];
  const plugins = (config.plugins ?? []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return typeof name !== 'string' || ![
      'react-native-google-mobile-ads',
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      'expo-apple-authentication',
    ].includes(name);
  });
  const iosGoogleServicesFile = './GoogleService-Info.plist';

  return {
    ...config,
    name: config.name ?? 'MyMap',
    slug: config.slug ?? 'mymap',
    scheme: Array.from(new Set([...configuredSchemes, 'mymap', 'com.pnhl.vibecoding'])),
    android: { ...config.android },
    ios: {
      ...config.ios,
      usesAppleSignIn: true,
      entitlements: {
        ...config.ios?.entitlements,
        'com.apple.developer.game-center': true,
      },
      ...(existsSync(iosGoogleServicesFile) ? { googleServicesFile: iosGoogleServicesFile } : {}),
    },
    plugins: [
      ...plugins,
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      'expo-apple-authentication',
      './plugins/withMyMapAndroid.ts',
      [
        'react-native-google-mobile-ads',
        {
          androidAppId:
            process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || ANDROID_TEST_APP_ID,
          iosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || IOS_TEST_APP_ID,
        },
      ],
    ],
  };
};
