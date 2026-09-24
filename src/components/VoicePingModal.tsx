import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View, Vibration } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GlassSurface, GlassButton, IconBadge, glassColors } from '../ui/glass';
import { Text } from '../ui/Text';
import type { RealtimeFriend } from '../services/realtimeFriends';

interface VoicePingModalProps {
  visible: boolean;
  friend?: RealtimeFriend | null;
  targetFriend?: RealtimeFriend | null;
  currentCoords?: any;
  onClose: () => void;
  onSendVoicePing?: (data: { durationSeconds: number; audioNote: string; recipientName?: string }) => void;
  onVoiceSent?: (data?: any) => void;
}

export function VoicePingModal({
  visible,
  friend,
  targetFriend,
  currentCoords,
  onClose,
  onSendVoicePing,
  onVoiceSent,
}: VoicePingModalProps) {
  const activeFriend = targetFriend || friend;
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [sentSuccess, setSentSuccess] = useState(false);
  const timerRef = useRef<any>(null);

  // Audio wave bars animation
  const wave1 = useRef(new Animated.Value(12)).current;
  const wave2 = useRef(new Animated.Value(24)).current;
  const wave3 = useRef(new Animated.Value(16)).current;
  const wave4 = useRef(new Animated.Value(30)).current;
  const wave5 = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    if (isRecording) {
      const anim = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(wave1, { toValue: 40, duration: 250, useNativeDriver: false }),
            Animated.timing(wave1, { toValue: 12, duration: 250, useNativeDriver: false }),
          ]),
          Animated.sequence([
            Animated.timing(wave2, { toValue: 15, duration: 200, useNativeDriver: false }),
            Animated.timing(wave2, { toValue: 45, duration: 200, useNativeDriver: false }),
          ]),
          Animated.sequence([
            Animated.timing(wave3, { toValue: 50, duration: 300, useNativeDriver: false }),
            Animated.timing(wave3, { toValue: 14, duration: 300, useNativeDriver: false }),
          ]),
          Animated.sequence([
            Animated.timing(wave4, { toValue: 16, duration: 220, useNativeDriver: false }),
            Animated.timing(wave4, { toValue: 42, duration: 220, useNativeDriver: false }),
          ]),
          Animated.sequence([
            Animated.timing(wave5, { toValue: 38, duration: 280, useNativeDriver: false }),
            Animated.timing(wave5, { toValue: 10, duration: 280, useNativeDriver: false }),
          ]),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [isRecording, wave1, wave2, wave3, wave4, wave5]);

  const startRecording = () => {
    try {
      Vibration.vibrate(60);
    } catch {}
    setIsRecording(true);
    setSeconds(0);
    setSentSuccess(false);
    timerRef.current = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
  };

  const stopAndSend = () => {
    if (!isRecording) return;
    clearInterval(timerRef.current);
    setIsRecording(false);
    try {
      Vibration.vibrate([0, 40, 30, 50]);
    } catch {}

    const recordedSeconds = Math.max(1, seconds);
    if (onSendVoicePing) {
      onSendVoicePing({
        durationSeconds: recordedSeconds,
        audioNote: `Ghi âm bộ đàm ${recordedSeconds}s`,
        recipientName: activeFriend?.displayName,
      });
    }
    if (onVoiceSent) {
      onVoiceSent({ durationSeconds: recordedSeconds, recipientName: activeFriend?.displayName });
    }

    setSentSuccess(true);
    setTimeout(() => {
      setSentSuccess(false);
      onClose();
    }, 1200);
  };

  const cancelRecording = () => {
    clearInterval(timerRef.current);
    setIsRecording(false);
    setSeconds(0);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <GlassSurface style={s.dialog}>
          {/* Header */}
          <View style={s.header}>
            <IconBadge name="radio-handheld" tone="cyan" size={24} />
            <View style={s.flex}>
              <Text style={s.title}>
                {activeFriend ? `Bộ đàm tới ${activeFriend.displayName}` : 'Bộ đàm Tọa độ (Voice Ping)'}
              </Text>
              <Text style={s.sub}>
                {isRecording
                  ? `Đang phát trực tiếp (${seconds}s)… Nhả để gửi`
                  : sentSuccess
                  ? 'Đã phát sóng thành công! 📡'
                  : 'Nhấn giữ để nói, nhả ra để phát'}
              </Text>
            </View>
            <Pressable onPress={onClose} style={s.closeBtn}>
              <MaterialCommunityIcons name="close" size={20} color="#ADCFFF" />
            </Pressable>
          </View>

          {/* Waveform Visualizer */}
          <View style={s.waveformContainer}>
            <Animated.View style={[s.waveBar, { height: wave1, backgroundColor: isRecording ? '#00F5D4' : 'rgba(100,180,255,0.3)' }]} />
            <Animated.View style={[s.waveBar, { height: wave2, backgroundColor: isRecording ? '#52E3FF' : 'rgba(100,180,255,0.3)' }]} />
            <Animated.View style={[s.waveBar, { height: wave3, backgroundColor: isRecording ? '#B87BFF' : 'rgba(100,180,255,0.3)' }]} />
            <Animated.View style={[s.waveBar, { height: wave4, backgroundColor: isRecording ? '#00F5D4' : 'rgba(100,180,255,0.3)' }]} />
            <Animated.View style={[s.waveBar, { height: wave5, backgroundColor: isRecording ? '#52E3FF' : 'rgba(100,180,255,0.3)' }]} />
          </View>

          {/* Push-to-Talk Action Button */}
          <View style={s.actionRow}>
            <Pressable
              onPressIn={startRecording}
              onPressOut={stopAndSend}
              style={[s.micButton, isRecording && s.micButtonActive]}
            >
              <MaterialCommunityIcons
                name={isRecording ? 'waveform' : 'microphone'}
                size={34}
                color={isRecording ? '#00F5D4' : '#fff'}
              />
            </Pressable>
          </View>

          {isRecording && (
            <Pressable onPress={cancelRecording} style={s.cancelTextBtn}>
              <Text style={s.cancelText}>Vuốt ra ngoài để hủy</Text>
            </Pressable>
          )}
        </GlassSurface>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2,10,32,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    padding: 22,
    borderRadius: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(100,210,255,0.3)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex: { flex: 1 },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  sub: {
    color: '#8AC7FF',
    fontSize: 11.5,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  waveformContainer: {
    height: 70,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(2,18,48,0.6)',
    borderRadius: 16,
    paddingHorizontal: 20,
  },
  waveBar: {
    width: 6,
    borderRadius: 3,
  },
  actionRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  micButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(34,211,238,0.2)',
    borderWidth: 2,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00F5D4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  micButtonActive: {
    backgroundColor: 'rgba(0,245,212,0.3)',
    borderColor: '#00F5D4',
    transform: [{ scale: 1.1 }],
  },
  cancelTextBtn: {
    alignItems: 'center',
  },
  cancelText: {
    color: '#7FB0DF',
    fontSize: 11,
  },
});
