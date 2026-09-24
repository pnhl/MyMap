import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GlassButton, GlassSurface } from '../ui/glass';
import {
  getUserMusicStatus,
  setUserMusicStatus,
  clearUserMusicStatus,
  togglePlayback,
  type UserMusicStatus,
} from '../services/musicStatus';

interface MusicStatusWidgetProps {
  onStatusChange?: (status: UserMusicStatus | null) => void;
}

const PRESET_SONGS = [
  { songTitle: 'Nấu Ăn Cho Em', artistName: 'Đen Vâu ft. PiaLinh' },
  { songTitle: 'Cắt Đôi Nỗi Sầu', artistName: 'Tăng Duy Tân' },
  { songTitle: 'Lofi Chill Ban Đêm', artistName: 'Chillies' },
  { songTitle: 'Đi Về Nhà', artistName: 'Đen x JustaTee' },
  { songTitle: 'Từng Quen', artistName: 'Wren Evans' },
];

export function MusicStatusWidget({ onStatusChange }: MusicStatusWidgetProps) {
  const [currentMusic, setCurrentMusic] = useState<UserMusicStatus | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [artistInput, setArtistInput] = useState('');

  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    void getUserMusicStatus().then(status => {
      setCurrentMusic(status);
      if (status) {
        setTitleInput(status.songTitle);
        setArtistInput(status.artistName);
      }
    });
  }, []);

  useEffect(() => {
    if (currentMusic?.isPlaying) {
      spinLoopRef.current = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 6000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      spinLoopRef.current.start();
    } else {
      if (spinLoopRef.current) {
        spinLoopRef.current.stop();
      }
      spinAnim.setValue(0);
    }
  }, [currentMusic?.isPlaying]);

  const handleTogglePlay = async () => {
    if (!currentMusic) {
      setModalVisible(true);
      return;
    }
    const updated = await togglePlayback();
    setCurrentMusic(updated);
    onStatusChange?.(updated);
  };

  const handleSave = async (title?: string, artist?: string) => {
    const finalTitle = (title ?? titleInput).trim();
    const finalArtist = (artist ?? artistInput).trim();
    if (!finalTitle) return;

    const updated = await setUserMusicStatus({
      songTitle: finalTitle,
      artistName: finalArtist || 'Nghệ sĩ',
      isPlaying: true,
    });
    setCurrentMusic(updated);
    onStatusChange?.(updated);
    setModalVisible(false);
  };

  const handleClear = async () => {
    await clearUserMusicStatus();
    setCurrentMusic(null);
    setTitleInput('');
    setArtistInput('');
    onStatusChange?.(null);
    setModalVisible(false);
  };

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <>
      {/* Compact Vinyl Disc Floating Button on Map */}
      <Pressable
        onPress={() => setModalVisible(true)}
        style={[s.floatingDiscButton, currentMusic?.isPlaying && s.floatingDiscActive]}
      >
        <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
          <MaterialCommunityIcons
            name="record-player"
            size={22}
            color={currentMusic?.isPlaying ? '#FFD700' : '#8EB8E5'}
          />
        </Animated.View>
        {currentMusic?.isPlaying && (
          <View style={s.musicActiveDot} />
        )}
      </Pressable>

      {/* Music Selector Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <GlassSurface style={s.modalCard}>
            <View style={s.modalHeader}>
              <View style={s.headerTitleRow}>
                <MaterialCommunityIcons name="record-player" size={24} color="#FFD700" />
                <Text style={s.headerTitle}>Trạng thái Âm nhạc</Text>
              </View>
              <Pressable hitSlop={12} onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#8EB8E5" />
              </Pressable>
            </View>

            <Text style={s.headerSubtitle}>
              Chia sẻ giai điệu bạn đang nghe cùng bạn bè trên bản đồ thời gian thực.
            </Text>

            {/* Currently Playing Status Card */}
            {currentMusic && (
              <View style={s.currentTrackBox}>
                <View style={s.currentTrackRow}>
                  <MaterialCommunityIcons
                    name={currentMusic.isPlaying ? 'music-note-eighth' : 'music-note-off'}
                    size={20}
                    color="#52E3FF"
                  />
                  <View style={s.currentTrackInfo}>
                    <Text style={s.currentTrackTitle} numberOfLines={1}>
                      {currentMusic.songTitle}
                    </Text>
                    <Text style={s.currentTrackArtist} numberOfLines={1}>
                      {currentMusic.artistName}
                    </Text>
                  </View>
                  <Pressable onPress={handleTogglePlay} style={s.playPauseBtn}>
                    <MaterialCommunityIcons
                      name={currentMusic.isPlaying ? 'pause' : 'play'}
                      size={20}
                      color="#020E26"
                    />
                  </Pressable>
                </View>
              </View>
            )}

            {/* Input Form */}
            <View style={s.formGroup}>
              <Text style={s.inputLabel}>Tên bài hát:</Text>
              <TextInput
                value={titleInput}
                onChangeText={setTitleInput}
                placeholder="Ví dụ: Nấu Ăn Cho Em..."
                placeholderTextColor="rgba(142, 184, 229, 0.5)"
                style={s.input}
              />
            </View>

            <View style={s.formGroup}>
              <Text style={s.inputLabel}>Nghệ sĩ / Ca sĩ:</Text>
              <TextInput
                value={artistInput}
                onChangeText={setArtistInput}
                placeholder="Ví dụ: Đen Vâu"
                placeholderTextColor="rgba(142, 184, 229, 0.5)"
                style={s.input}
              />
            </View>

            {/* Quick Presets */}
            <Text style={s.presetsTitle}>Giai điệu gợi ý:</Text>
            <View style={s.presetsRow}>
              {PRESET_SONGS.map(song => (
                <Pressable
                  key={song.songTitle}
                  style={s.presetChip}
                  onPress={() => {
                    setTitleInput(song.songTitle);
                    setArtistInput(song.artistName);
                    void handleSave(song.songTitle, song.artistName);
                  }}
                >
                  <Text style={s.presetChipText} numberOfLines={1}>
                    🎵 {song.songTitle}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Actions */}
            <View style={s.actionRow}>
              {currentMusic && (
                <GlassButton style={s.flex1} tone="red" onPress={handleClear}>
                  <Text style={s.btnTextWhite}>Tắt chia sẻ</Text>
                </GlassButton>
              )}
              <GlassButton
                style={s.flex1}
                tone="blue"
                onPress={() => void handleSave()}
                disabled={!titleInput.trim()}
              >
                <Text style={s.btnTextWhite}>
                  {currentMusic ? 'Cập nhật' : 'Phát trạng thái'}
                </Text>
              </GlassButton>
            </View>
          </GlassSurface>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  floatingDiscButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(3, 17, 48, 0.82)',
    borderWidth: 1.5,
    borderColor: 'rgba(82, 227, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingDiscActive: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(40, 32, 4, 0.92)',
    shadowColor: '#FFD700',
    shadowOpacity: 0.4,
  },
  musicActiveDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 9, 28, 0.78)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#8EB8E5',
    fontSize: 12.5,
    lineHeight: 17,
  },
  currentTrackBox: {
    backgroundColor: 'rgba(4, 24, 64, 0.65)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(82, 227, 255, 0.3)',
  },
  currentTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  currentTrackInfo: {
    flex: 1,
    gap: 2,
  },
  currentTrackTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  currentTrackArtist: {
    color: '#8EB8E5',
    fontSize: 12,
  },
  playPauseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formGroup: {
    gap: 4,
  },
  inputLabel: {
    color: '#B0CEEE',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  presetsTitle: {
    color: '#8EB8E5',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    backgroundColor: 'rgba(82, 227, 255, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(82, 227, 255, 0.25)',
  },
  presetChipText: {
    color: '#52E3FF',
    fontSize: 11.5,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  flex1: {
    flex: 1,
  },
  btnTextWhite: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
});
