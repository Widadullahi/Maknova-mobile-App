import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft02Icon, Megaphone01Icon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { createAnnouncement } from '../../api/communication';
import { colors, spacing } from '../../theme';

const CATEGORIES = ['general', 'maintenance', 'security', 'event', 'billing'];

export function CreateAnnouncementScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('general');
  const [pinned, setPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Broadcast announcement', 'Title and body are required.');
      return;
    }
    setIsSubmitting(true);
    try {
      await createAnnouncement({ title: title.trim(), body: body.trim(), category, pinned });
      Alert.alert('Announcement published', 'Your announcement is now visible to your estate.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Broadcast announcement', error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen padded={false}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => navigation.goBack()} style={styles.backButton}>
          <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
        </Pressable>
        <AppText variant="heading">Broadcast announcement</AppText>
        <View style={styles.backButtonSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Scheduled water shutdown" />
        <TextField label="Message" value={body} onChangeText={setBody} placeholder="Details residents should know" multiline style={styles.bodyField} />

        <AppText style={styles.sectionLabel}>Category</AppText>
        <View style={styles.categoryRow}>
          {CATEGORIES.map((item) => (
            <Pressable key={item} onPress={() => setCategory(item)} style={[styles.categoryChip, category === item && styles.categoryChipActive]}>
              <AppText style={[styles.categoryChipText, category === item && styles.categoryChipTextActive]}>{item}</AppText>
            </Pressable>
          ))}
        </View>

        <Checkbox label="Pin to top of Communication Hub" onChange={setPinned} value={pinned} />

        <Button icon={Megaphone01Icon} title={isSubmitting ? 'Publishing...' : 'Publish announcement'} disabled={isSubmitting} onPress={handleSubmit} />
      </ScrollView>
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
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: 140,
  },
  bodyField: {
    minHeight: 100,
  },
  sectionLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  categoryChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  categoryChipText: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  categoryChipTextActive: {
    color: colors.primary,
  },
});
