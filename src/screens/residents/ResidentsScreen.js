import { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Call02Icon, IdIcon, UserAdd01Icon, UserGroup02Icon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { TextField } from '../../components/TextField';
import { fetchEstates } from '../../api/estates';
import { createResident, fetchResidents, updateResidentStatus } from '../../api/residents';
import { colors, spacing } from '../../theme';

const RESIDENT_STATUS_LABELS = {
  pending: 'Pending',
  verified: 'Verified',
  active: 'Active',
  suspended: 'Suspended',
  moved_out: 'Moved out',
};

const RESIDENT_STATUS_TONES = {
  pending: 'warning',
  verified: 'info',
  active: 'success',
  suspended: 'danger',
  moved_out: 'neutral',
};

const NEXT_ACTION = {
  pending: { label: 'Verify', nextStatus: 'verified' },
  verified: { label: 'Approve entry', nextStatus: 'active' },
  active: { label: 'Suspend', nextStatus: 'suspended' },
  suspended: { label: 'Reactivate', nextStatus: 'active' },
  moved_out: null,
};

const emptyForm = { fullName: '', phone: '', plotNumber: '' };

export function ResidentsScreen() {
  const [residents, setResidents] = useState([]);
  const [estateId, setEstateId] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const estateData = await fetchEstates();
        const firstEstate = estateData.estates?.[0];
        if (!firstEstate) {
          if (active) {
            setResidents([]);
            setLoadError('No managed estate is available yet.');
          }
          return;
        }
        const residentData = await fetchResidents(firstEstate.id);
        if (active) {
          setEstateId(firstEstate.id);
          setResidents(residentData.residents || []);
          setLoadError(null);
        }
      } catch (error) {
        if (active) {
          setResidents([]);
          setLoadError(error.message);
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleAddResident() {
    if (!form.fullName.trim() || !estateId) {
      return;
    }

    const data = await createResident(estateId, {
      fullName: form.fullName.trim(),
      phone: form.phone.trim() || null,
    });

    setResidents((current) => [data.resident, ...current]);
    setForm(emptyForm);
    setIsAdding(false);
  }

  async function advanceStatus(residentId) {
    const resident = residents.find((item) => item.id === residentId);
    const action = resident ? NEXT_ACTION[resident.status] : null;
    if (!resident || !action || !estateId) return;
    const data = await updateResidentStatus(estateId, residentId, { status: action.nextStatus });
    setResidents((current) => current.map((item) => (item.id === residentId ? data.resident : item)));
  }

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          contentContainerStyle={styles.list}
          data={residents}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <View style={styles.iconBlock}>
                  <HugeiconsIcon icon={UserGroup02Icon} size={22} color={colors.onPrimary} />
                </View>
                <View style={styles.titleCopy}>
                  <AppText variant="title">Residents</AppText>
                  <AppText muted>{loadError || 'Verify tenant records and approve resident entry.'}</AppText>
                </View>
              </View>

              {isAdding ? (
                <View style={styles.addCard}>
                  <TextField
                    label="Full name"
                    onChangeText={(v) => updateField('fullName', v)}
                    placeholder="e.g. Ada Johnson"
                    value={form.fullName}
                  />
                  <TextField
                    keyboardType="phone-pad"
                    label="Phone"
                    onChangeText={(v) => updateField('phone', v)}
                    placeholder="e.g. +234 801 234 5678"
                    value={form.phone}
                  />
                  <View style={styles.addActions}>
                    <Button onPress={() => setIsAdding(false)} title="Cancel" variant="secondary" />
                    <Button onPress={handleAddResident} title="Add resident" />
                  </View>
                </View>
              ) : (
                <Button icon={UserAdd01Icon} onPress={() => setIsAdding(true)} title="Add resident" />
              )}
            </View>
          }
          ListEmptyComponent={
            <EmptyState icon={UserGroup02Icon} title="No residents yet" body="Add a resident to begin tracking their verification." />
          }
          renderItem={({ item }) => {
          const action = NEXT_ACTION[item.status];
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <AppText variant="heading">{item.fullName}</AppText>
                <StatusChip label={RESIDENT_STATUS_LABELS[item.status]} tone={RESIDENT_STATUS_TONES[item.status]} />
              </View>
              <AppText muted>{item.propertyId ? `Property #${item.propertyId}` : 'No property linked yet'}</AppText>
              {item.phone ? (
                <View style={styles.metaRow}>
                  <HugeiconsIcon icon={Call02Icon} size={14} color={colors.textMuted} />
                  <AppText muted style={styles.metaText}>{item.phone}</AppText>
                </View>
              ) : null}
              {item.identityNumber ? (
                <View style={styles.metaRow}>
                  <HugeiconsIcon icon={IdIcon} size={14} color={colors.textMuted} />
                  <AppText muted style={styles.metaText}>{item.identityType}: {item.identityNumber}</AppText>
                </View>
              ) : null}
              {item.note ? <AppText muted style={styles.note}>{item.note}</AppText> : null}
              {action ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => advanceStatus(item.id)}
                  style={styles.actionButton}
                >
                  <AppText style={styles.actionButtonText}>{action.label}</AppText>
                </Pressable>
              ) : null}
            </View>
          );
        }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCard: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  addActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  list: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: 140,
  },
  card: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    fontSize: 12,
  },
  note: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  actionButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionButtonText: {
    color: colors.primary,
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
  },
  separator: {
    height: spacing.md,
  },
});
