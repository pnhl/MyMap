import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View, Vibration } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type EmojiType = '❤️' | '🔥' | '👻' | '🚀' | '⚡' | '🎉' | '⭐' | '💥';

interface Particle {
  id: string;
  emoji: EmojiType;
  x: number;
  startY: number;
  animY: Animated.Value;
  animOpacity: Animated.Value;
  animScale: Animated.Value;
}

interface EmojiBombOverlayProps {
  visible: boolean;
  emoji?: EmojiType;
  count?: number;
  onComplete?: () => void;
  onClose?: () => void;
  targetName?: string;
}

export function EmojiBombOverlay({
  visible,
  emoji = '🔥',
  count = 24,
  onComplete,
  onClose,
  targetName,
}: EmojiBombOverlayProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      setParticles([]);
      return;
    }

    // Trigger haptic vibration burst
    try {
      Vibration.vibrate([0, 40, 30, 50, 40, 60]);
    } catch {}

    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const x = Math.random() * (SCREEN_WIDTH - 60) + 30;
      const startY = SCREEN_HEIGHT * 0.75 + (Math.random() * 80 - 40);
      newParticles.push({
        id: `p_${Date.now()}_${i}`,
        emoji,
        x,
        startY,
        animY: new Animated.Value(startY),
        animOpacity: new Animated.Value(1),
        animScale: new Animated.Value(0.4 + Math.random() * 0.8),
      });
    }

    setParticles(newParticles);

    const animations = newParticles.map(p => {
      const targetY = p.startY - (SCREEN_HEIGHT * 0.45 + Math.random() * SCREEN_HEIGHT * 0.3);
      const duration = 1200 + Math.random() * 800;

      return Animated.parallel([
        Animated.timing(p.animY, {
          toValue: targetY,
          duration,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(p.animScale, {
            toValue: 1.2 + Math.random() * 0.6,
            duration: duration * 0.3,
            useNativeDriver: true,
          }),
          Animated.timing(p.animScale, {
            toValue: 0.8,
            duration: duration * 0.7,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(duration * 0.5),
          Animated.timing(p.animOpacity, {
            toValue: 0,
            duration: duration * 0.5,
            useNativeDriver: true,
          }),
        ]),
      ]);
    });

    Animated.parallel(animations).start(() => {
      if (mountedRef.current) {
        setParticles([]);
        onComplete?.();
        onClose?.();
      }
    });
  }, [visible, emoji, count, onComplete, onClose]);

  if (!visible || particles.length === 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map(p => (
        <Animated.View
          key={p.id}
          style={[
            styles.particle,
            {
              left: p.x,
              transform: [
                { translateY: p.animY },
                { scale: p.animScale },
              ],
              opacity: p.animOpacity,
            },
          ]}
        >
          <Text style={styles.emojiText}>{p.emoji}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 36,
  },
});
