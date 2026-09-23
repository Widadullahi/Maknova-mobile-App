import { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Home11Icon, PencilEdit02Icon, PlusSignIcon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { EmptyState } from '../../components/EmptyState';
import { PlotPhotoCapture } from '../../components/PlotPhotoCapture';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { TextField } from '../../components/TextField';
import {
  createProperty,
  fetchEstateProperties,
  updatePropertyFields,
  updatePropertyStatus,
  uploadPropertyDocuments,
} from '../../api/estates';
import { PROPERTY_STATUS_LABELS, PROPERTY_STATUS_TONES } from '../../constants/propertyStatuses';
import { colors, spacing } from '../../theme';

const EMPTY_FORM = {
  propertyIdentifier: '',
  plotNumber: '',
  propertyType: 'Residential plot',
  plotSize: '',
  price: '',
  description: '',
};

export function PropertiesScreen({ route }) {
  const { estateId, estateName } = route.params;
  const [properties, setProperties] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photos, setPhotos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [confirmEdit, setConfirmEdit] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    loadProperties();
  }, []);

  async function loadProperties(filters = {}) {
    setIsLoading(true);
    try {
      const data = await fetchEstateProperties(estateId, filters);
      setProperties(data.properties || []);
    } catch (error) {
      Alert.alert('Properties', error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleCreatePlot() {
    if (!form.propertyIdentifier.trim() || !form.propertyType.trim()) {
      Alert.alert('Add plot', 'Property identifier and type are required.');
      return;
    }
    if (!photos.length) {
      Alert.alert('Add plot', 'Capture at least one live camera photo of the plot before saving. Gallery uploads are not accepted.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await createProperty(estateId, {
        propertyIdentifier: form.propertyIdentifier.trim(),
        plotNumber: form.plotNumber.trim() || undefined,
        propertyType: form.propertyType.trim(),
        plotSize: form.plotSize.trim() || undefined,
        price: Number(form.price || 0),
        description: form.description.trim() || undefined,
        status: 'available',
      });

      await uploadPropertyDocuments(estateId, data.property.id, 'image', photos);

      setProperties([data.property, ...properties]);
      setForm(EMPTY_FORM);
      setPhotos([]);
      setIsFormOpen(false);
    } catch (error) {
      Alert.alert('Create property', error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function markReserved(propertyItem) {
    try {
      const data = await updatePropertyStatus(estateId, propertyItem.id, {
        status: 'reserved',
        note: 'Reserved from mobile Phase 4 workflow.',
      });
      setProperties(properties.map((item) => (item.id === propertyItem.id ? data.property : item)));
    } catch (error) {
      Alert.alert('Status update', error.message);
    }
  }

  function openEdit(propertyItem) {
    setEditingId(propertyItem.id);
    setConfirmEdit(false);
    setEditForm({
      propertyIdentifier: propertyItem.propertyIdentifier || '',
      plotNumber: propertyItem.plotNumber || '',
      propertyType: propertyItem.propertyType || '',
      plotSize: propertyItem.plotSize || '',
      price: String(propertyItem.price ?? ''),
      description: propertyItem.description || '',
    });
  }

  function closeEdit() {
    setEditingId(null);
    setConfirmEdit(false);
  }

  function setEditField(field, value) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSaveEdit() {
    if (!editForm.propertyIdentifier.trim() || !editForm.propertyType.trim()) {
      Alert.alert('Edit plot', 'Property identifier and type are required.');
      return;
    }
    if (!confirmEdit) {
      Alert.alert('Edit plot', 'Check the confirmation box — editing listed plot details is recorded in the audit log.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const data = await updatePropertyFields(estateId, editingId, {
        propertyIdentifier: editForm.propertyIdentifier.trim(),
        plotNumber: editForm.plotNumber.trim() || undefined,
        propertyType: editForm.propertyType.trim(),
        plotSize: editForm.plotSize.trim() || undefined,
        price: Number(editForm.price || 0),
        description: editForm.description.trim() || undefined,
      });
      setProperties((current) => current.map((item) => (item.id === editingId ? data.property : item)));
      closeEdit();
    } catch (error) {
      Alert.alert('Edit plot', error.message);
    } finally {
      setIsSavingEdit(false);
    }
  }

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          contentContainerStyle={styles.list}
          data={properties}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.header}>
              <AppText variant="title">{estateName}</AppText>
              <AppText muted>Search, filter, and manage plot lifecycle statuses.</AppText>
              <TextField
                label="Search"
                value={search}
                onChangeText={setSearch}
                placeholder="Plot number, identifier, or type"
                returnKeyType="search"
                onSubmitEditing={() => loadProperties({ search })}
              />
              <Button
                title={isFormOpen ? 'Cancel' : 'Add plot'}
                variant={isFormOpen ? 'secondary' : 'primary'}
                icon={PlusSignIcon}
                onPress={() => setIsFormOpen((current) => !current)}
              />

              {isFormOpen ? (
                <View style={styles.formCard}>
                  <AppText variant="heading">New Plot</AppText>
                  <TextField label="Property identifier" value={form.propertyIdentifier} onChangeText={(value) => setField('propertyIdentifier', value)} placeholder="e.g. GM-PLT-001" />
                  <TextField label="Plot number" value={form.plotNumber} onChangeText={(value) => setField('plotNumber', value)} placeholder="e.g. Plot 12B" />
                  <TextField label="Property type" value={form.propertyType} onChangeText={(value) => setField('propertyType', value)} placeholder="e.g. Residential plot" />
                  <TextField label="Plot size" value={form.plotSize} onChangeText={(value) => setField('plotSize', value)} placeholder="e.g. 500 sqm" />
                  <TextField label="Price (₦)" value={form.price} onChangeText={(value) => setField('price', value)} placeholder="e.g. 25000000" keyboardType="number-pad" />
                  <TextField label="Description" value={form.description} onChangeText={(value) => setField('description', value)} placeholder="Road access, allocation notes" />

                  <AppText variant="heading" style={styles.photoHeading}>Plot photos</AppText>
                  <PlotPhotoCapture photos={photos} onChange={setPhotos} />

                  <Button title={isSubmitting ? 'Saving...' : 'Save plot'} disabled={isSubmitting} onPress={handleCreatePlot} />
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon={Home11Icon}
              title={isLoading ? 'Loading plots' : 'No plots yet'}
              body="Create a plot record to start tracking availability, sales, and allocation."
            />
          }
          renderItem={({ item }) => (
          <View style={styles.card}>
            {editingId === item.id ? (
              <View style={styles.editForm}>
                <AppText variant="heading">Edit Plot</AppText>
                <AppText muted style={styles.editHint}>
                  Changing listed details (especially price) after buyers may have seen the plot is recorded in the audit log.
                </AppText>
                <TextField label="Property identifier" value={editForm.propertyIdentifier} onChangeText={(value) => setEditField('propertyIdentifier', value)} />
                <TextField label="Plot number" value={editForm.plotNumber} onChangeText={(value) => setEditField('plotNumber', value)} />
                <TextField label="Property type" value={editForm.propertyType} onChangeText={(value) => setEditField('propertyType', value)} />
                <TextField label="Plot size" value={editForm.plotSize} onChangeText={(value) => setEditField('plotSize', value)} />
                <TextField label="Price (₦)" value={editForm.price} onChangeText={(value) => setEditField('price', value)} keyboardType="number-pad" />
                <TextField label="Description" value={editForm.description} onChangeText={(value) => setEditField('description', value)} />
                <Checkbox
                  label="I understand this change is permanent and will be recorded in the audit log."
                  value={confirmEdit}
                  onChange={setConfirmEdit}
                />
                <View style={styles.editActions}>
                  <Button title="Cancel" variant="secondary" onPress={closeEdit} />
                  <Button title={isSavingEdit ? 'Saving...' : 'Save changes'} disabled={isSavingEdit || !confirmEdit} onPress={handleSaveEdit} />
                </View>
              </View>
            ) : (
              <>
                <View style={styles.cardHeader}>
                  <View style={styles.propertyTitle}>
                    <AppText variant="heading">{item.propertyIdentifier}</AppText>
                    <AppText muted>{item.propertyType}</AppText>
                  </View>
                  <StatusChip
                    label={PROPERTY_STATUS_LABELS[item.status] || item.status}
                    tone={PROPERTY_STATUS_TONES[item.status] || 'neutral'}
                  />
                </View>
                <View style={styles.metaRow}>
                  <AppText muted>{item.plotSize || 'Size not set'}</AppText>
                  <AppText style={styles.dot}>•</AppText>
                  <AppText muted>{item.plotNumber ? `Plot ${item.plotNumber}` : 'No plot number'}</AppText>
                </View>
                <View style={styles.cardActions}>
                  <Button
                    disabled={item.status !== 'available'}
                    title="Mark reserved"
                    variant="secondary"
                    onPress={() => markReserved(item)}
                  />
                  <Button icon={PencilEdit02Icon} title="Edit" variant="secondary" onPress={() => openEdit(item)} />
                </View>
              </>
            )}
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
  formCard: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  photoHeading: {
    marginTop: spacing.sm,
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  propertyTitle: {
    flex: 1,
    gap: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    color: colors.textMuted,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editForm: {
    gap: spacing.md,
  },
  editHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
