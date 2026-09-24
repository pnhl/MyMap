import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  View,
  Vibration,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GlassSurface } from '../ui/glass';
import type { FriendInteractionEvent } from '../services/realtimeFriends';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface HeartParticle {
  id: string;
  x: number;
  startY: number;
  animY: Animated.Value;
  animOpacity: Animated.Value;
  animScale: Animated.Value;
  animRotate: Animated.Value;
}

interface RealtimeInteractionsOverlayProps {
  incomingEvent: FriendInteractionEvent | null;
  onDismiss: () => void;
  onLocateSender?: (senderId: string) => void;
  onOpenChatWithSender?: (senderId: string) => void;
}

export function RealtimeInteractionsOverlay({
  incomingEvent,
  onDismiss,
  onLocateSender,
  onOpenChatWithSender,
}: RealtimeInteractionsOverlayProps) {
  const [hearts, setHearts] = useState<HeartParticle[]>([]);
  const bannerAnimY = useRef(new Animated.Value(-120)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const dismissTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!incomingEvent) {
      setHearts([]);
      return;
    }

    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    if (incomingEvent.type === 'heart') {
      try {
        Vibration.vibrate([0, 50, 40, 80]);
      } catch {}

      const newHearts: HeartParticle[] = [];
      const heartCount = 18;
      for (let i = 0; i < heartCount; i++) {
        const x = Math.random() * (SCREEN_WIDTH - 80) + 40;
        const startY = SCREEN_HEIGHT * 0.72 + (Math.random() * 60 - 30);
        newHearts.push({
          id: `h_${Date.now()}_${i}`,
          x,
          startY,
          animY: new Animated.Value(startY),
          animOpacity: new Animated.Value(1),
          animScale: new Animated.Value(0.5 + Math.random() * 0.7),
          animRotate: new Animated.Value(Math.random() * 40 - 20),
        });
      }
      setHearts(newHearts);

      const anims = newHearts.map(h => {
        const targetY = h.startY - (SCREEN_HEIGHT * 0.45 + Math.random() * SCREEN_HEIGHT * 0.3);
        const duration = 1500 + Math.random() * 900;
        return Animated.parallel([
          Animated.timing(h.animY, {
            toValue: targetY,
            duration,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(h.animScale, {
              toValue: 1.3,
              duration: duration * 0.35,
              useNativeDriver: true,
            }),
            Animated.timing(h.animScale, {
              toValue: 0.9,
              duration: duration * 0.65,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(duration * 0.6),
            Animated.timing(h.animOpacity, {
              toValue: 0,
              duration: duration * 0.4,
              useNativeDriver: true,
            }),
          ]),
        ]);
      });

      Animated.parallel(anims).start(() => {
        setHearts([]);
      });

      // Show small toast for hearts
      bannerAnimY.setValue(-80);
      bannerOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(bannerAnimY, { toValue: 60, friction: 8, tension: 50, useNativeDriver: true }),
        Animated.timing(bannerOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();

      dismissTimerRef.current = setTimeout(() => {
        Animated.timing(bannerOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
          onDismiss();
        });
      }, 3500);
    } else if (incomingEvent.type === 'buzz') {
      try {
        Vibration.vibrate([0, 180, 80, 180, 80, 250]);
      } catch {}

      bannerAnimY.setValue(-120);
      bannerOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(bannerAnimY, { toValue: 60, friction: 6, tension: 70, useNativeDriver: true }),
        Animated.timing(bannerOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      dismissTimerRef.current = setTimeout(() => {
        Animated.timing(bannerOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
          onDismiss();
        });
      }, 4500);
    } else if (incomingEvent.type === 'peek') {
      try {
        Vibration.vibrate(60);
      } catch {}

      bannerAnimY.setValue(-100);
      bannerOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(bannerAnimY, { toValue: 60, friction: 8, tension: 50, useNativeDriver: true }),
        Animated.timing(bannerOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();

      dismissTimerRef.current = setTimeout(() => {
        Animated.timing(bannerOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
          onDismiss();
        });
      }, 4000);
    } else if (incomingEvent.type === 'invite') {
      try {
        Vibration.vibrate([0, 100, 70, 120]);
      } catch {}

      bannerAnimY.setValue(-140);
      bannerOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(bannerAnimY, { toValue: 60, friction: 7, tension: 60, useNativeDriver: true }),
        Animated.timing(bannerOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();

      dismissTimerRef.current = setTimeout(() => {
        Animated.timing(bannerOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
          onDismiss();
        });
      }, 8000);
    }

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [incomingEvent]);

  if (!incomingEvent && hearts.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* Floating Hearts Animation */}
      {hearts.map(h => (
        <Animated.View
          key={h.id}
          pointerEvents="none"
          style={[
            s.heartParticle,
            {
              left: h.x,
              opacity: h.animOpacity,
              transform: [
                { translateY: h.animY },
                { scale: h.animScale },
                {
                  rotate: h.animRotate.interpolate({
                    inputRange: [-20, 20],
                    outputRange: ['-20deg', '20deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <MaterialCommunityIcons name="heart" size={32} color="#FF3366" />
        </Animated.View>
      ))}

      {/* Top Banner Notification */}
      {incomingEvent && (
        <Animated.View
          style={[
            s.bannerContainer,
            {
              opacity: bannerOpacity,
              transform: [{ translateY: bannerAnimY }],
            },
          ]}
        >
          {incomingEvent.type === 'heart' && (
            <GlassSurface style={s.heartBanner}>
              <View style={s.bannerRow}>
                <View style={[s.iconCircle, { backgroundColor: 'rgba(255, 51, 102, 0.2)' }]}>
                  <MaterialCommunityIcons name="heart-pulse" size={22} color="#FF3366" />
                </View>
                <View style={s.textColumn}>
                  <Text style={s.bannerTitle}>Gửi tim yêu thương ❤️</Text>
                  <Text style={s.bannerSubtitle} numberOfLines={1}>
                    <Text style={s.boldSender}>{incomingEvent.senderName}</Text> vừa thả tim bạn!
                  </Text>
                </View>
                <Pressable hitSlop={12} onPress={onDismiss} style={s.closeBtn}>
                  <MaterialCommunityIcons name="close" size={18} color="#CBE5FF" />
                </Pressable>
              </View>
            </GlassSurface>
          )}

          {incomingEvent.type === 'buzz' && (
            <GlassSurface style={s.buzzBanner}>
              <View style={s.bannerRow}>
                <View style={[s.iconCircle, { backgroundColor: 'rgba(255, 154, 60, 0.25)' }]}>
                  <MaterialCommunityIcons name="vibrate" size={24} color="#FF9A3C" />
                </View>
                <View style={s.textColumn}>
                  <Text style={[s.bannerTitle, { color: '#FFA84D' }]}>BUZZ! Rung chuông 📣</Text>
                  <Text style={s.bannerSubtitle} numberOfLines={1}>
                    <Text style={s.boldSender}>{incomingEvent.senderName}</Text> vừa BUZZ bạn trên bản đồ!
                  </Text>
                </View>
                <Pressable hitSlop={12} onPress={onDismiss} style={s.closeBtn}>
                  <MaterialCommunityIcons name="close" size={18} color="#CBE5FF" />
                </Pressable>
              </View>
            </GlassSurface>
          )}

          {incomingEvent.type === 'peek' && (
            <GlassSurface style={s.peekBanner}>
              <View style={s.bannerRow}>
                <View style={[s.iconCircle, { backgroundColor: 'rgba(72, 227, 255, 0.2)' }]}>
                  <MaterialCommunityIcons name="eye" size={22} color="#48E3FF" />
                </View>
                <View style={s.textColumn}>
                  <Text style={[s.bannerTitle, { color: '#52E3FF' }]}>Đang xem bạn 👀</Text>
                  <Text style={s.bannerSubtitle} numberOfLines={1}>
                    <Text style={s.boldSender}>{incomingEvent.senderName}</Text> đang mở xem vị trí bạn.
                  </Text>
                </View>
                <Pressable hitSlop={12} onPress={onDismiss} style={s.closeBtn}>
                  <MaterialCommunityIcons name="close" size={18} color="#CBE5FF" />
                </Pressable>
              </View>
            </GlassSurface>
          )}

          {incomingEvent.type === 'invite' && (
            <GlassSurface style={s.inviteBanner}>
              <View style={s.bannerRow}>
                <View style={[s.iconCircle, { backgroundColor: 'rgba(255, 215, 0, 0.25)' }]}>
                  <MaterialCommunityIcons name="glass-mug-variant" size={24} color="#FFD700" />
                </View>
                <View style={s.textColumn}>
                  <Text style={[s.bannerTitle, { color: '#FFD700' }]}>Rủ đi chơi! 🍻</Text>
                  <Text style={s.bannerSubtitle} numberOfLines={2}>
                    <Text style={s.boldSender}>{incomingEvent.senderName}</Text> rủ bạn tụ tập ngay hôm nay!
                  </Text>
                </View>
                <Pressable hitSlop={12} onPress={onDismiss} style={s.closeBtn}>
                  <MaterialCommunityIcons name="close" size={18} color="#CBE5FF" />
                </Pressable>
              </View>

              <View style={s.inviteActionRow}>
                {onLocateSender && (
                  <Pressable
                    style={[s.actionBtn, s.locateBtn]}
                    onPress={() => {
                      onLocateSender(incomingEvent.senderId);
                      onDismiss();
                    }}
                  >
                    <MaterialCommunityIcons name="crosshairs-gps" size={16} color="#020E26" />
                    <Text style={s.locateBtnText}>Xem vị trí</Text>
                  </Pressable>
                )}

                {onOpenChatWithSender && (
                  <Pressable
                    style={[s.actionBtn, s.chatBtn]}
                    onPress={() => {
                      onOpenChatWithSender(incomingEvent.senderId);
                      onDismiss();
                    }}
                  >
                    <MaterialCommunityIcons name="chat-outline" size={16} color="#fff" />
                    <Text style={s.chatBtnText}>Nhắn tin</Text>
                  </Pressable>
                )}
              </View>
            </GlassSurface>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  heartParticle: {
    position: 'absolute',
    zIndex: 9999,
  },
  bannerContainer: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 9998,
    alignItems: 'center',
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heartBanner: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(38, 10, 24, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 51, 102, 0.5)',
    shadowColor: '#FF3366',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  buzzBanner: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(40, 20, 5, 0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 154, 60, 0.6)',
    shadowColor: '#FF9A3C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  peekBanner: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(4, 25, 60, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(72, 227, 255, 0.55)',
    shadowColor: '#48E3FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  inviteBanner: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 25, 4, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 215, 0, 0.6)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 9,
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  bannerTitle: {
    color: '#FF6688',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  bannerSubtitle: {
    color: '#DCEEFF',
    fontSize: 12.5,
    lineHeight: 17,
  },
  boldSender: {
    color: '#fff',
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
  },
  inviteActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
  },
  locateBtn: {
    backgroundColor: '#FFD700',
  },
  locateBtnText: {
    color: '#020E26',
    fontSize: 12,
    fontWeight: '800',
  },
  chatBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  chatBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
