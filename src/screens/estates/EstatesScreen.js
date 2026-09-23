import { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Building05Icon, PlusSignIcon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { TextField } from '../../components/TextField';
import { createEstate, fetchEstates } from '../../api/estates';
import { colors, spacing } from '../../theme';

const EMPTY_FORM = { name: '', location: '', description: '' };

export function EstatesScreen({ navigation }) {
  const [estates, setEstates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadEstates();
  }, []);

  async function loadEstates() {
    setIsLoading(true);
    try {
      const data = await fetchEstates();
      setEstates(data.estates || []);
    } catch (error) {
      Alert.alert('Estates', error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleCreateEstate() {
    if (!form.name.trim() || !form.location.trim()) {
      Alert.alert('Add estate', 'Estate name and location are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await createEstate({
        name: form.name.trim(),
        location: form.location.trim(),
        description: form.description.trim() || undefined,
      });
      setEstates([data.estate, ...estates]);
      setForm(EMPTY_FORM);
      setIsFormOpen(false);
    } catch (error) {
      Alert.alert('Create estate', error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          contentContainerStyle={styles.list}
          data={estates}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <View style={styles.iconBlock}>
                  <HugeiconsIcon icon={Building05Icon} size={22} color={colors.surface} />
                </View>
                <View style={styles.titleCopy}>
                  <AppText variant="title">Estates</AppText>
                  <AppText muted>Manage estate records and plot inventory.</AppText>
                </View>
              </View>

              <Button
                title={isFormOpen ? 'Cancel' : 'Add estate'}
                variant={isFormOpen ? 'secondary' : 'primary'}
                icon={PlusSignIcon}
                onPress={() => setIsFormOpen((current) => !current)}
              />

              {isFormOpen ? (
                <View style={styles.formCard}>
                  <AppText variant="heading">New Estate</AppText>
                  <TextField label="Estate name" value={form.name} onChangeText={(value) => setField('name', value)} placeholder="e.g. Greenstone Courts Estate" />
                  <TextField label="Location" value={form.location} onChangeText={(value) => setField('location', value)} placeholder="e.g. Lekki, Lagos" />
                  <TextField label="Description" value={form.description} onChangeText={(value) => setField('description', value)} placeholder="Optional short description" />
                  <Button title={isSubmitting ? 'Saving...' : 'Save estate'} disabled={isSubmitting} onPress={handleCreateEstate} />
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon={Building05Icon}
              title={isLoading ? 'Loading estates' : 'No estates yet'}
              body="Create or approve an estate verification application to start managing inventory."
            />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <AppText variant="heading">{item.name}</AppText>
                <StatusChip label={item.status} tone={item.status === 'approved' ? 'success' : 'neutral'} />
              </View>
              <AppText muted>{item.location}</AppText>
              <Button
                title="View properties"
                variant="secondary"
                onPress={() => navigation.navigate('Properties', { estateId: item.id, estateName: item.name })}
              />
            </View>
          )}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  titleCopy: {
    flex: 1,
  },
  iconBlock: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  formCard: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  list: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: 140,
  },
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});
