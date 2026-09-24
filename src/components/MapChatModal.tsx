import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GlassButton, GlassSurface, glassColors } from '../ui/glass';
import { Text } from '../ui/Text';

interface MapChatModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (message: string, emoji: string) => Promise<void>;
  targetName?: string;
}

const EMOJI_OPTIONS = ['💬', '☕', '🎉', '📍', '🍕', '🍻', '👋', '🔥'];

export function MapChatModal({ visible, onClose, onSubmit, targetName }: MapChatModalProps) {
  const [text, setText] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('💬');
  const [busy, setBusy] = useState(false);

  async function handleSend() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await onSubmit(text.trim(), selectedEmoji);
      setText('');
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <GlassSurface style={s.dialog}>
          <View style={s.header}>
            <MaterialCommunityIcons name="chat-processing-outline" size={24} color={glassColors.cyan} />
            <Text style={s.title}>{targetName ? `Ghim lời nhắn tới ${targetName}` : 'Ghim lời nhắn lên bản đồ'}</Text>
          </View>

          <Text style={s.hint}>Lời nhắn sẽ hiển thị tại toạ độ vị trí hiện tại của bạn cho bạn bè thấy:</Text>

          {/* Emoji row */}
          <View style={s.emojiRow}>
            {EMOJI_OPTIONS.map(em => (
              <Pressable
                key={em}
                onPress={() => setSelectedEmoji(em)}
                style={[s.emojiBtn, selectedEmoji === em && s.emojiActive]}
              >
                <Text style={s.emojiText}>{em}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder="Ví dụ: Đang đợi ở quán cafe, đến nhanh nhé!…"
            placeholderTextColor={glassColors.faint}
            multiline
            numberOfLines={3}
          />

          <View style={s.actions}>
            <GlassButton tone="neutral" style={s.flex} onPress={onClose} disabled={busy}>
              <Text style={s.btnText}>Hủy</Text>
            </GlassButton>
            <GlassButton tone="blue" style={s.flex} onPress={handleSend} disabled={busy || !text.trim()}>
              <Text style={s.btnText}>{busy ? 'Đang gửi…' : 'Ghim tin nhắn'}</Text>
            </GlassButton>
          </View>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(2,10,30,0.75)' },
  dialog: { padding: 20, borderRadius: 24, gap: 12, maxWidth: 500, alignSelf: 'center', width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: '#fff', fontSize: 17, fontWeight: '800', flex: 1 },
  hint: { color: '#B2D6F8', fontSize: 12, lineHeight: 17 },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  emojiBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  emojiActive: { backgroundColor: 'rgba(82,227,255,0.25)', borderWidth: 1.5, borderColor: '#52E3FF' },
  emojiText: { fontSize: 18 },
  input: { backgroundColor: 'rgba(5,21,50,0.7)', borderWidth: 1, borderColor: 'rgba(147,211,255,0.3)', borderRadius: 14, padding: 12, color: '#fff', fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  flex: { flex: 1 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' },
});
