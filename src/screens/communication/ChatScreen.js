import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft02Icon, SentIcon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import {
  fetchConversationMessages,
  fetchGroupMessages,
  markConversationRead,
  sendConversationMessage,
  sendGroupMessage,
} from '../../api/communication';
import { colors, spacing } from '../../theme';

export function ChatScreen({ navigation, route }) {
  const { mode, conversationId, estateId, groupKey, title } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef(null);
  const refreshVersion = useRef(0);

  const loadMessages = useCallback(async (silent = false) => {
    const version = ++refreshVersion.current;
    try {
      const data = mode === 'group' ? await fetchGroupMessages(estateId, groupKey) : await fetchConversationMessages(conversationId);
      if (version !== refreshVersion.current) return;
      setMessages(data.messages || []);
      if (mode === 'conversation') {
        markConversationRead(conversationId).catch(() => null);
      }
    } catch (error) {
      if (!silent && version === refreshVersion.current) Alert.alert('Messages', error.message);
    }
  }, [mode, conversationId, estateId, groupKey]);

  useFocusEffect(
    useCallback(() => {
      loadMessages();
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') loadMessages(true);
      }, 5000);
      return () => {
        clearInterval(timer);
        refreshVersion.current += 1;
      };
    }, [loadMessages])
  );

  async function handleSend() {
    const body = draft.trim();
    if (!body || isSending) return;
    setIsSending(true);
    try {
      const data = mode === 'group' ? await sendGroupMessage(estateId, groupKey, body) : await sendConversationMessage(conversationId, body);
      refreshVersion.current += 1;
      setMessages((current) => current.some((message) => String(message.id) === String(data.message.id)) ? current : [...current, data.message]);
      setDraft('');
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (error) {
      Alert.alert('Send message', error.message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => navigation.goBack()} style={styles.backButton}>
            <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
          </Pressable>
          <AppText variant="heading" numberOfLines={1} style={styles.title}>{title || 'Conversation'}</AppText>
          <View style={styles.backButtonSpacer} />
        </View>

        <FlatList
          ref={listRef}
          contentContainerStyle={styles.list}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isMine = item.senderUserId === user?.id;
            return (
              <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
                <View style={[styles.bubble, isMine && styles.bubbleMine]}>
                  {!isMine ? <AppText style={styles.senderName}>{item.senderName}</AppText> : null}
                  <AppText style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.body}</AppText>
                </View>
              </View>
            );
          }}
        />

        <View style={styles.composer}>
          <View style={styles.composerInputWrap}>
            <TextInput
              onChangeText={setDraft}
              value={draft}
              placeholder="Type a message"
              placeholderTextColor={colors.textMuted}
              style={styles.composerInput}
              multiline
            />
          </View>
          <Pressable disabled={!draft.trim() || isSending} onPress={handleSend} style={[styles.sendButton, (!draft.trim() || isSending) && styles.sendButtonDisabled]}>
            <HugeiconsIcon icon={SentIcon} size={18} color={colors.onPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonSpacer: { width: 40 },
  title: { flex: 1, textAlign: 'center' },
  list: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 14,
    borderTopLeftRadius: 4,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 4,
  },
  senderName: {
    color: colors.primary,
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    marginBottom: 2,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 19,
  },
  bubbleTextMine: {
    color: colors.onPrimary,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  composerInputWrap: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  composerInput: {
    color: colors.text,
    fontSize: 14,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
