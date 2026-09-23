import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft02Icon, UserIcon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { fetchContacts, createConversation } from '../../api/communication';
import { colors, spacing } from '../../theme';

function roleLabel(role) {
  return String(role || '').replace(/_/g, ' ');
}

export function NewMessageScreen({ navigation }) {
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchContacts()
      .then((data) => setContacts(data.contacts || []))
      .catch((error) => Alert.alert('Contacts', error.message))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleSelect(contact) {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const data = await createConversation({ type: 'direct', participantUserIds: [contact.userId] });
      navigation.replace('Chat', { mode: 'conversation', conversationId: data.conversation.id, title: contact.fullName });
    } catch (error) {
      Alert.alert('Start conversation', error.message);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Screen padded={false}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => navigation.goBack()} style={styles.backButton}>
          <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
        </Pressable>
        <AppText variant="heading">New message</AppText>
        <View style={styles.backButtonSpacer} />
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={contacts}
        keyExtractor={(item) => String(item.userId)}
        ListEmptyComponent={
          <EmptyState
            icon={UserIcon}
            title={isLoading ? 'Loading contacts' : 'No contacts available'}
            body="You can message people linked to your estate, such as your estate manager or security team."
          />
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => handleSelect(item)}>
            <View style={styles.rowIconWrap}>
              <HugeiconsIcon icon={UserIcon} size={18} color={colors.primary} />
            </View>
            <View style={styles.rowCopy}>
              <AppText style={styles.rowTitle}>{item.fullName}</AppText>
              <AppText muted style={styles.rowSubtitle}>{roleLabel(item.role)}</AppText>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
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
  list: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: 140,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  rowIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  rowSubtitle: { fontSize: 12, textTransform: 'capitalize' },
});
