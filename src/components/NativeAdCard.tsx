import React, { useEffect, useState } from 'react';
import { AppState, Image, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  NativeAd,
  NativeAdChoicesPlacement,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaAspectRatio,
  NativeMediaView,
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';
import { env } from '../config/env';
import { Text } from '../ui/Text';

type Placement = 'smart' | 'friends' | 'timeline' | 'stats' | 'profile' | 'memories' | 'heatmap' | 'settings' | 'place';
type Props = { placement: Placement; compact?: boolean };

const PROD_IDS: Record<Placement, string | undefined> = env.nativeAdUnitIds;
const BANNER_IDS: Record<Placement, string | undefined> = env.bannerAdUnitIds;
const fill = { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 };

export function NativeAdCard({ placement, compact = true }: Props) {
  const [ad, setAd] = useState<NativeAd | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [useBannerFallback, setUseBannerFallback] = useState(false);

  useEffect(() => {
    let alive = true;
    let loaded: NativeAd | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const adUnitId = env.enableTestAds ? TestIds.NATIVE : PROD_IDS[placement];

    setAd(null);
    setUseBannerFallback(false);
    if (!adUnitId) return () => { alive = false; };

    NativeAd.createForAdRequest(adUnitId, {
      aspectRatio: NativeMediaAspectRatio.LANDSCAPE,
      adChoicesPlacement: NativeAdChoicesPlacement.TOP_RIGHT,
      startVideoMuted: true,
    }).then(nextAd => {
      loaded = nextAd;
      if (alive) setAd(nextAd);
      else nextAd.destroy();
    }).catch(() => {
      if (alive && attempt < 2) retryTimer = setTimeout(() => setAttempt(value => value + 1), 2500 * (attempt + 1));
      else if (alive && BANNER_IDS[placement]) setUseBannerFallback(true);
    });

    return () => {
      alive = false;
      if (retryTimer) clearTimeout(retryTimer);
      loaded?.destroy();
    };
  }, [placement, attempt]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && !ad) setAttempt(value => value + 1);
    });
    return () => subscription.remove();
  }, [ad]);

  if (!ad && useBannerFallback) {
    const bannerUnitId = env.enableTestAds ? TestIds.ADAPTIVE_BANNER : BANNER_IDS[placement];
    if (!bannerUnitId) return null;
    return <View style={s.bannerFallback}>
      <View style={s.bannerLabel}><Text style={s.bannerLabelText}>ĐƯỢC TÀI TRỢ</Text></View>
      <BannerAd unitId={bannerUnitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} requestOptions={{ requestNonPersonalizedAdsOnly: true }} />
    </View>;
  }
  if (!ad) return null;

  const backgroundImage = ad.images?.[0];

  return (
    <View style={s.outer} pointerEvents="box-none">
      <LinearGradient
        colors={['rgba(39,128,240,.70)', 'rgba(8,50,123,.97)', 'rgba(3,28,78,.98)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.shell, compact && s.compactShell]}
      >
        <View style={s.adClip}>
          <NativeAdView nativeAd={ad} style={s.nativeAd}>
            {ad.mediaContent ? (
              <NativeMediaView resizeMode="cover" style={StyleSheet.absoluteFill} />
            ) : backgroundImage ? (
              <NativeAsset assetType={NativeAssetType.IMAGE}>
                <Image source={{ uri: backgroundImage.url }} resizeMode="cover" style={StyleSheet.absoluteFill} />
              </NativeAsset>
            ) : null}

            <LinearGradient
              pointerEvents="none"
              colors={['rgba(3,25,68,.28)', 'rgba(5,34,86,.78)', 'rgba(2,22,61,.96)']}
              locations={[0, .48, 1]}
              start={{ x: 0, y: .35 }}
              end={{ x: 1, y: .55 }}
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={s.skyGlow} />

            <View style={s.content}>
              <View style={s.attributionRow}>
                <View style={s.sponsoredBadge}>
                  <Text numberOfLines={1} allowFontScaling={false} style={s.sponsored}>ĐƯỢC TÀI TRỢ</Text>
                </View>
              </View>

              <View style={s.infoRow}>
                {ad.icon ? (
                  <NativeAsset assetType={NativeAssetType.ICON}>
                    <Image source={{ uri: ad.icon.url }} style={s.icon} />
                  </NativeAsset>
                ) : <View style={s.iconFallback}><MaterialCommunityIcons name="image-outline" size={22} color="#BDEBFF" /></View>}

                <View style={s.copy}>
                  {!!ad.advertiser && (
                    <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                      <Text numberOfLines={1} style={s.advertiser}>{ad.advertiser}</Text>
                    </NativeAsset>
                  )}
                  <NativeAsset assetType={NativeAssetType.HEADLINE}>
                    <Text numberOfLines={2} style={s.headline}>{ad.headline}</Text>
                  </NativeAsset>
                  {!!ad.body && (
                    <NativeAsset assetType={NativeAssetType.BODY}>
                      <Text numberOfLines={1} style={s.body}>{ad.body}</Text>
                    </NativeAsset>
                  )}
                </View>

                {!!ad.callToAction && (
                  <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
                    <View style={s.cta}>
                      <Text numberOfLines={1} allowFontScaling={false} style={s.ctaText}>{ad.callToAction}</Text>
                      <MaterialCommunityIcons pointerEvents="none" name="arrow-right" size={15} color="#FFFFFF" />
                    </View>
                  </NativeAsset>
                )}
              </View>
            </View>
          </NativeAdView>
        </View>

        <View pointerEvents="none" style={s.innerBorder} />
        <View pointerEvents="none" style={s.topShine} />
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  outer: {
    marginTop: 14,
  },
  shell: {
    minHeight: 116,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(123,224,255,.86)',
    backgroundColor: '#082C70',
    shadowColor: '#29D9FF',
    shadowOpacity: .34,
    shadowRadius: 17,
    shadowOffset: { width: 0, height: 4 },
    elevation: 9,
  },
  compactShell: {
    minHeight: 104,
  },
  bannerFallback: { marginTop: 14, minHeight: 72, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,35,88,.82)', borderWidth: 1, borderColor: 'rgba(123,224,255,.42)' },
  bannerLabel: { alignSelf: 'stretch', paddingHorizontal: 9, paddingTop: 5 },
  bannerLabelText: { color: '#B8D7F4', fontSize: 8, fontWeight: '800', letterSpacing: .4 },
  adClip: {
    flex: 1,
    overflow: 'hidden',
    borderTopLeftRadius: 21,
    borderBottomLeftRadius: 21,
  },
  nativeAd: {
    flex: 1,
    minHeight: 102,
    backgroundColor: 'rgba(5,35,88,.72)',
  },
  skyGlow: {
    position: 'absolute',
    top: -36,
    left: '16%',
    width: 150,
    height: 78,
    borderRadius: 80,
    backgroundColor: 'rgba(77,191,255,.18)',
    transform: [{ rotate: '-8deg' }],
  },
  content: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 9,
    paddingLeft: 10,
    paddingRight: 8,
    justifyContent: 'space-between',
  },
  attributionRow: {
    minHeight: 19,
    alignItems: 'flex-start',
  },
  sponsoredBadge: {
    minHeight: 17,
    minWidth: 96,
    justifyContent: 'center',
    paddingHorizontal: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(163,232,255,.80)',
    backgroundColor: 'rgba(28,90,176,.78)',
    shadowColor: '#69E7FF',
    shadowOpacity: .45,
    shadowRadius: 5,
  },
  sponsored: {
    color: '#E9FAFF',
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: .2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 61,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(159,235,255,.88)',
    backgroundColor: 'rgba(8,48,105,.90)',
  },
  iconFallback: {
    width: 52,
    height: 52,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(159,235,255,.62)',
    backgroundColor: 'rgba(8,48,105,.90)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  advertiser: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
    marginBottom: 1,
    textShadowColor: 'rgba(0,0,0,.55)',
    textShadowRadius: 3,
  },
  headline: {
    color: '#F7FBFF',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,.65)',
    textShadowRadius: 3,
  },
  body: {
    color: '#B8D7F4',
    fontSize: 9.5,
    lineHeight: 12,
    marginTop: 2,
  },
  cta: {
    minWidth: 82,
    minHeight: 36,
    maxWidth: 105,
    paddingHorizontal: 11,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#79E7FF',
    backgroundColor: 'rgba(14,166,222,.86)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: '#39DFFF',
    shadowOpacity: .85,
    shadowRadius: 8,
    elevation: 7,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
  },
  innerBorder: {
    ...fill,
    borderRadius: 21,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: 'rgba(255,255,255,.26)',
  },
  topShine: {
    position: 'absolute',
    top: 0,
    left: '20%',
    width: '32%',
    height: 2,
    backgroundColor: 'rgba(211,251,255,.88)',
    shadowColor: '#88EEFF',
    shadowOpacity: 1,
    shadowRadius: 7,
  },
});
