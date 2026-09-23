import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowRight01Icon, DocumentValidationIcon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { EmptyState } from '../../components/EmptyState';
import { fetchFormTemplates } from '../../api/forms';
import { useFormSubmissions } from '../../context/FormSubmissionsContext';
import { colors, spacing } from '../../theme';

export function FormsScreen({ navigation }) {
  const { submissions } = useFormSubmissions();
  const [templates, setTemplates] = useState([]);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadTemplates() {
      try {
        const data = await fetchFormTemplates();
        if (active) {
          setTemplates(data.templates || []);
          setLoadError(null);
        }
      } catch (error) {
        if (active) {
          setTemplates([]);
          setLoadError(error.message);
        }
      }
    }
    loadTemplates();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.content}
        data={templates}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText variant="title">Digital forms</AppText>
            <AppText muted>{loadError || 'Complete platform forms with an electronic signature record.'}</AppText>
          </View>
        }
        ListEmptyComponent={<EmptyState icon={DocumentValidationIcon} title="No forms available" body="Live form templates will appear here once they are active in the backend." />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('FormFill', { template: item })}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.iconWrap}>
              <HugeiconsIcon icon={DocumentValidationIcon} size={20} color={colors.primary} />
            </View>
            <View style={styles.cardCopy}>
              <AppText variant="heading">{item.name}</AppText>
              <AppText muted>{item.description}</AppText>
            </View>
            <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.textMuted} />
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={
          submissions.length ? (
            <View style={styles.footer}>
              <AppText variant="heading">Recent submissions</AppText>
              {submissions.slice(0, 5).map((item) => (
                <View key={item.id} style={styles.submissionRow}>
                  <View style={styles.submissionCopy}>
                    <AppText style={styles.submissionTitle}>Form #{item.templateId}</AppText>
                    <AppText muted style={styles.submissionMeta}>
                      Submitted {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : 'recently'}
                    </AppText>
                  </View>
                  <StatusChip label="Submitted" tone="success" />
                </View>
              ))}
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xl,
    paddingBottom: 140,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  cardPressed: {
    opacity: 0.85,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    gap: 2,
  },
  separator: {
    height: spacing.md,
  },
  footer: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  submissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  submissionCopy: {
    flex: 1,
    gap: 2,
  },
  submissionTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
  },
  submissionMeta: {
    fontSize: 12,
  },
});
