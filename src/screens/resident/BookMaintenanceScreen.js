import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft02Icon,
  CleaningBucketIcon,
  HammerIcon,
  Plug01Icon,
  StarIcon,
  Wrench01Icon,
} from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { createMaintenanceRequest, fetchMaintenanceProviders } from '../../api/maintenance';
import { colors, spacing } from '../../theme';

const CATEGORIES = [
  { key: 'plumbing', icon: Wrench01Icon, label: 'Plumbing' },
  { key: 'electrical', icon: Plug01Icon, label: 'Electrical' },
  { key: 'cleaning', icon: CleaningBucketIcon, label: 'Cleaning' },
  { key: 'carpentry', icon: HammerIcon, label: 'Carpentry' },
];

export function BookMaintenanceScreen({ navigation }) {
  const [category, setCategory] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [note, setNote] = useState('');
  const [isBooked, setIsBooked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteProviders, setRemoteProviders] = useState([]);

  useEffect(() => {
    let isActive = true;

    async function loadProviders() {
      if (!category) {
        setRemoteProviders([]);
        return;
      }

      try {
        const data = await fetchMaintenanceProviders(category);
        if (isActive) {
          setRemoteProviders(data.providers || []);
        }
      } catch {
        if (isActive) {
          setRemoteProviders([]);
        }
      }
    }

    loadProviders();
    return () => {
      isActive = false;
    };
  }, [category]);

  const providers = useMemo(() => {
    if (remoteProviders.length) {
      return remoteProviders.map((provider) => ({
        ...provider,
        jobs: provider.jobs || 'new',
        price: provider.availability || 'available',
      }));
    }
    return [];
  }, [category, remoteProviders]);

  async function handleBook() {
    if (!selectedProvider) {
      Alert.alert('Choose a provider', 'Select a service provider before booking.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createMaintenanceRequest({
        title: `${selectedProvider.name} booking`,
        category,
        description: note.trim() || `${category} service requested from the resident app.`,
        providerId: typeof selectedProvider.id === 'number' ? selectedProvider.id : null,
        priority: 'medium',
      });
      setIsBooked(true);
    } catch (err) {
      Alert.alert('Booking failed', err.message || 'The request could not be sent.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isBooked) {
    return (
      <Screen padded={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => navigation.goBack()} style={styles.backButton}>
            <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.confirmWrap}>
          <View style={styles.successIconWrap}>
            <HugeiconsIcon icon={Wrench01Icon} size={28} color={colors.primary} />
          </View>
          <AppText style={styles.title}>Booking request sent</AppText>
          <AppText muted style={styles.subtitle}>
            {selectedProvider.name} will reach out to confirm a time for your {category} request.
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
            <AppText style={styles.title}>Book maintenance</AppText>
            <AppText muted style={styles.subtitle}>Choose a service and pick a provider near your estate.</AppText>
          </View>

          <View style={styles.categoryGrid}>
            {CATEGORIES.map((item) => {
              const selected = item.key === category;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  onPress={() => {
                    setCategory(item.key);
                    setSelectedProvider(null);
                  }}
                  style={[styles.categoryCard, selected && styles.categoryCardSelected]}
                >
                  <HugeiconsIcon icon={item.icon} size={22} color={selected ? colors.onPrimary : colors.primary} />
                  <AppText style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}>
                    {item.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {category ? (
            <View style={styles.section}>
              <AppText variant="heading">Available providers</AppText>
              {providers.map((provider) => {
                const selected = selectedProvider?.id === provider.id;
                return (
                  <Pressable
                    key={provider.id}
                    accessibilityRole="button"
                    onPress={() => setSelectedProvider(provider)}
                    style={[styles.providerCard, selected && styles.providerCardSelected]}
                  >
                    <View style={styles.providerCopy}>
                      <AppText style={styles.providerName}>{provider.name}</AppText>
                      <View style={styles.providerMetaRow}>
                        <HugeiconsIcon icon={StarIcon} size={13} color={colors.accent} />
                        <AppText muted style={styles.providerMetaText}>
                          {provider.rating} / {provider.jobs} jobs / {provider.price}
                        </AppText>
                      </View>
                    </View>
                    <View style={[styles.radio, selected && styles.radioSelected]} />
                  </Pressable>
                );
              })}
              {!providers.length ? (
                <EmptyProviderNotice />
              ) : null}

              <TextField
                label="Additional notes (optional)"
                onChangeText={setNote}
                placeholder="Describe the issue briefly"
                value={note}
              />

              <Button
                disabled={isSubmitting}
                onPress={handleBook}
                title={isSubmitting ? 'Booking...' : 'Book provider'}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function EmptyProviderNotice() {
  return (
    <View style={styles.emptyProvider}>
      <AppText muted>No live providers are available for this category yet.</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
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
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  categoryCard: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    paddingVertical: spacing.lg,
  },
  categoryCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryLabel: {
    color: colors.text,
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
  },
  categoryLabelSelected: {
    color: colors.onPrimary,
  },
  section: {
    gap: spacing.md,
  },
  emptyProvider: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  providerCardSelected: {
    borderColor: colors.primary,
  },
  providerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  providerName: {
    color: colors.text,
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
  },
  providerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  providerMetaText: {
    fontSize: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
  },
  radioSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
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
