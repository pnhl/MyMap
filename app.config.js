const base = require('./app.json');

const ANDROID_TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const IOS_TEST_APP_ID = 'ca-app-pub-3940256099942544~1458002511';

/** Pass map keys & plugins to native SDKs during prebuild/EAS. */
module.exports = () => {
  const expoBase = base.expo || base;

  const plugins = (expoBase.plugins ?? []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== 'react-native-google-mobile-ads';
  });

  return {
    ...expoBase,
    name: expoBase.name ?? 'MyMap',
    slug: expoBase.slug ?? 'mymap',
    android: { ...expoBase.android },
    ios: { ...expoBase.ios },
    plugins: [
      ...plugins,
      [
        'react-native-google-mobile-ads',
        {
          androidAppId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || ANDROID_TEST_APP_ID,
          iosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || IOS_TEST_APP_ID,
        },
      ],
    ],
  };
};
