import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Alert02Icon, ArrowLeft02Icon, FileAttachmentIcon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { createEstateReport } from '../../api/reports';
import { colors, spacing } from '../../theme';

const CATEGORIES = [
  { label: 'False Estate Information', value: 'false_estate_information' },
  { label: 'Suspicious Documents', value: 'suspicious_documents' },
  { label: 'Fraud Concern', value: 'fraud_concern' },
  { label: 'Misrepresentation', value: 'misrepresentation' },
  { label: 'Other Violation', value: 'other_violation' },
];

export function ReportIssueScreen({ route, navigation }) {
  const listing = route?.params?.listing;
  const [category, setCategory] = useState(null);
  const [description, setDescription] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!category) {
      Alert.alert('Choose a category', 'Select what this report is about.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Add a description', 'Describe the issue before submitting.');
      return;
    }
    try {
      setIsSubmitting(true);
      await createEstateReport({
        category: category.value,
        description: description.trim(),
        estateId: Number.isInteger(Number(listing?.estateId)) ? Number(listing.estateId) : undefined,
        propertyId: Number.isInteger(Number(listing?.id)) ? Number(listing.id) : undefined,
      });
      setIsSubmitted(true);
    } catch (err) {
      Alert.alert('Report failed', err.message || 'The report could not be sent.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitted) {
    return (
      <Screen padded={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => navigation.goBack()} style={styles.backButton}>
            <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.confirmWrap}>
          <View style={styles.successIconWrap}>
            <HugeiconsIcon icon={Alert02Icon} size={28} color={colors.danger} />
          </View>
          <AppText style={styles.title}>Report submitted</AppText>
          <AppText muted style={styles.subtitle}>
            Your "{category.label}" report has been sent to estate management for review. You'll be notified of any updates.
          </AppText>
          <Button onPress={() => navigation.goBack()} title="Done" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => navigation.goBack()} style={styles.backButton}>
              <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.header}>
            <AppText style={styles.title}>Report an issue</AppText>
            <AppText muted style={styles.subtitle}>
              {listing ? `Flag a concern about ${listing.plotNumber}, ${listing.estateName}.` : 'Flag a concern about your estate to management.'}
            </AppText>
          </View>

          <View style={styles.card}>
            <View style={styles.categoryGroup}>
              <AppText style={styles.categoryLabel}>What is this about?</AppText>
              {CATEGORIES.map((item) => {
                const selected = item.value === category?.value;
                return (
                  <Pressable
                    key={item.value}
                    accessibilityRole="button"
                    onPress={() => setCategory(item)}
                    style={[styles.categoryOption, selected && styles.categoryOptionSelected]}
                  >
                    <View style={[styles.radio, selected && styles.radioSelected]} />
                    <AppText style={[styles.categoryOptionText, selected && styles.categoryOptionTextSelected]}>
                      {item.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <TextField
              label="Description"
              onChangeText={setDescription}
              placeholder="Describe what happened in detail"
              value={description}
            />

            <Pressable
              accessibilityRole="button"
              onPress={() => Alert.alert('Attach evidence', 'File attachments will be connected once storage is configured.')}
              style={styles.attachmentButton}
            >
              <HugeiconsIcon icon={FileAttachmentIcon} size={18} color={colors.primary} />
              <AppText style={styles.attachmentText}>Attach evidence (optional)</AppText>
            </Pressable>
          </View>

          <Button
            disabled={isSubmitting}
            icon={Alert02Icon}
            onPress={handleSubmit}
            title={isSubmitting ? 'Submitting...' : 'Submit report'}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
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
  header: {
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  categoryGroup: {
    gap: spacing.sm,
  },
  categoryLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  categoryOptionSelected: {
    borderColor: colors.danger,
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
  },
  categoryOptionText: {
    color: colors.text,
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
  },
  categoryOptionTextSelected: {
    color: colors.danger,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
  },
  radioSelected: {
    borderColor: colors.danger,
    backgroundColor: colors.danger,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: spacing.md,
  },
  attachmentText: {
    color: colors.primary,
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
  },
  confirmWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.sm,
  },
  successIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
});
