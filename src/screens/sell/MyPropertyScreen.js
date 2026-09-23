import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft02Icon, CheckmarkCircle02Icon, Image01Icon, PencilEdit02Icon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { PlotPhotoCapture } from '../../components/PlotPhotoCapture';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { TextField } from '../../components/TextField';
import {
  createProperty,
  fetchEstateProperties,
  fetchEstates,
  fetchPropertyDocuments,
  updatePropertyFields,
  updatePropertyStatus,
  uploadPropertyDocuments,
} from '../../api/estates';
import { PROPERTY_STATUS_LABELS, PROPERTY_STATUS_TONES } from '../../constants/propertyStatuses';
import { colors, spacing } from '../../theme';

const EMPTY_FORM = {
  propertyIdentifier: '',
  propertyType: 'House',
  plotSize: '',
  price: '',
  description: '',
};

// Client-facing lifecycle is exactly 3 statuses: Available, Reserved, Sold/Allocated.
const STATUS_NEXT = {
  available: [['reserved', 'Mark as reserved']],
  reserved: [['available', 'Back to available'], ['sold', 'Mark as sold / allocated']],
  sold: [],
  under_offer: [],
  allocated: [],
  unavailable: [],
};

export function MyPropertyScreen({ navigation }) {
  const [estate, setEstate] = useState(null);
  const [property, setProperty] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photos, setPhotos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmEdit, setConfirmEdit] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const estateData = await fetchEstates();
      const myEstate = estateData.estates?.[0] || null;
      setEstate(myEstate);
      if (myEstate) {
        const propertyData = await fetchEstateProperties(myEstate.id);
        const myProperty = propertyData.properties?.[0] || null;
        setProperty(myProperty);
        if (myProperty) {
          const documentData = await fetchPropertyDocuments(myEstate.id, myProperty.id);
          setDocuments(documentData.documents || []);
          setForm({
            propertyIdentifier: myProperty.propertyIdentifier || '',
            propertyType: myProperty.propertyType || 'House',
            plotSize: myProperty.plotSize || '',
            price: String(myProperty.price ?? ''),
            description: myProperty.description || '',
          });
        }
      }
    } catch (error) {
      Alert.alert('My property', error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function ensureEstate() {
    if (estate) return estate;
    Alert.alert('Verification required', 'Complete your verification application before adding your property.');
    return null;
  }

  async function handleCreate() {
    const myEstate = await ensureEstate();
    if (!myEstate) return;
    if (!form.propertyIdentifier.trim() || !form.propertyType.trim()) {
      Alert.alert('Add property', 'A title/identifier and property type are required.');
      return;
    }
    if (!photos.length) {
      Alert.alert('Add property', 'Capture at least one live camera photo of your property before saving. Gallery uploads are not accepted.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await createProperty(myEstate.id, {
        propertyIdentifier: form.propertyIdentifier.trim(),
        propertyType: form.propertyType.trim(),
        plotSize: form.plotSize.trim() || undefined,
        price: Number(form.price || 0),
        description: form.description.trim() || undefined,
        status: 'available',
      });
      await uploadPropertyDocuments(myEstate.id, data.property.id, 'image', photos);
      setPhotos([]);
      await load();
    } catch (error) {
      Alert.alert('Add property', error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddPhotos() {
    if (!estate || !property || !photos.length) return;
    setIsSubmitting(true);
    try {
      await uploadPropertyDocuments(estate.id, property.id, 'image', photos);
      setPhotos([]);
      await load();
    } catch (error) {
      Alert.alert('Add photos', error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveEdit() {
    if (!confirmEdit) {
      Alert.alert('Edit listing', 'Check the confirmation box — editing listed details is recorded in the audit log.');
      return;
    }
    setIsSubmitting(true);
    try {
      await updatePropertyFields(estate.id, property.id, {
        propertyIdentifier: form.propertyIdentifier.trim(),
        propertyType: form.propertyType.trim(),
        plotSize: form.plotSize.trim() || undefined,
        price: Number(form.price || 0),
        description: form.description.trim() || undefined,
      });
      setIsEditing(false);
      setConfirmEdit(false);
      await load();
    } catch (error) {
      Alert.alert('Edit listing', error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusChange(nextStatus) {
    try {
      await updatePropertyStatus(estate.id, property.id, { status: nextStatus, note: 'Updated by seller from mobile app.' });
      await load();
    } catch (error) {
      Alert.alert('Update status', error.message);
    }
  }

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => navigation.goBack()} style={styles.backButton}>
              <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
            </Pressable>
            <AppText variant="heading">My Listing</AppText>
            <View style={styles.backButtonSpacer} />
          </View>

          {isLoading ? (
            <AppText muted>Loading your listing...</AppText>
          ) : !estate ? (
            <AppText muted>Complete verification before you can add your property.</AppText>
          ) : !property ? (
            <View style={styles.formCard}>
              <AppText variant="heading">Add your property</AppText>
              <AppText muted style={styles.hint}>List the house or plot you're selling. It becomes visible to buyers once an admin verifies and publishes it.</AppText>
              <TextField label="Title" value={form.propertyIdentifier} onChangeText={(v) => setField('propertyIdentifier', v)} placeholder="e.g. 4-Bedroom Duplex, Ikeja" />
              <TextField label="Property type" value={form.propertyType} onChangeText={(v) => setField('propertyType', v)} placeholder="e.g. House, Duplex, Bungalow, Land" />
              <TextField label="Size" value={form.plotSize} onChangeText={(v) => setField('plotSize', v)} placeholder="e.g. 3 bedrooms, or 600 sqm" />
              <TextField label="Price (₦)" value={form.price} onChangeText={(v) => setField('price', v)} placeholder="e.g. 45000000" keyboardType="number-pad" />
              <TextField label="Description" value={form.description} onChangeText={(v) => setField('description', v)} placeholder="Condition, features, access notes" />

              <AppText variant="heading" style={styles.photoHeading}>Property photos</AppText>
              <PlotPhotoCapture photos={photos} onChange={setPhotos} />

              <Button title={isSubmitting ? 'Saving...' : 'Save property'} disabled={isSubmitting} onPress={handleCreate} />
            </View>
          ) : (
            <View style={styles.formCard}>
              {!isEditing ? (
                <>
                  <View style={styles.propertyHeader}>
                    <View style={styles.propertyTitle}>
                      <AppText variant="heading">{property.propertyIdentifier}</AppText>
                      <AppText muted>{property.propertyType}</AppText>
                    </View>
                    <StatusChip
                      label={PROPERTY_STATUS_LABELS[property.status] || property.status}
                      tone={PROPERTY_STATUS_TONES[property.status] || 'neutral'}
                    />
                  </View>
                  <AppText muted>{property.plotSize || 'Size not set'}</AppText>
                  {property.description ? <AppText muted>{property.description}</AppText> : null}

                  <View style={styles.statusActions}>
                    {(STATUS_NEXT[property.status] || []).map(([nextStatus, label]) => (
                      <Button key={nextStatus} title={label} variant="secondary" icon={CheckmarkCircle02Icon} onPress={() => handleStatusChange(nextStatus)} />
                    ))}
                    <Button title="Edit details" variant="secondary" icon={PencilEdit02Icon} onPress={() => setIsEditing(true)} />
                  </View>

                  <AppText variant="heading" style={styles.photoHeading}>Photos</AppText>
                  {documents.length ? (
                    documents.map((doc) => (
                      <View key={doc.id} style={styles.documentRow}>
                        <HugeiconsIcon icon={Image01Icon} size={16} color={colors.primary} />
                        <AppText muted style={styles.documentRowText}>{doc.fileName}</AppText>
                      </View>
                    ))
                  ) : (
                    <AppText muted>No photos yet.</AppText>
                  )}
                  <PlotPhotoCapture photos={photos} onChange={setPhotos} />
                  {photos.length ? (
                    <Button title={isSubmitting ? 'Uploading...' : 'Add photos'} disabled={isSubmitting} onPress={handleAddPhotos} />
                  ) : null}
                </>
              ) : (
                <>
                  <AppText variant="heading">Edit Listing</AppText>
                  <AppText muted style={styles.hint}>Changing listed details (especially price) after buyers may have seen it is recorded in the audit log.</AppText>
                  <TextField label="Title" value={form.propertyIdentifier} onChangeText={(v) => setField('propertyIdentifier', v)} />
                  <TextField label="Property type" value={form.propertyType} onChangeText={(v) => setField('propertyType', v)} />
                  <TextField label="Size" value={form.plotSize} onChangeText={(v) => setField('plotSize', v)} />
                  <TextField label="Price (₦)" value={form.price} onChangeText={(v) => setField('price', v)} keyboardType="number-pad" />
                  <TextField label="Description" value={form.description} onChangeText={(v) => setField('description', v)} />
                  <Checkbox
                    label="I understand this change is permanent and will be recorded in the audit log."
                    value={confirmEdit}
                    onChange={setConfirmEdit}
                  />
                  <View style={styles.statusActions}>
                    <Button title="Cancel" variant="secondary" onPress={() => { setIsEditing(false); setConfirmEdit(false); }} />
                    <Button title={isSubmitting ? 'Saving...' : 'Save changes'} disabled={isSubmitting || !confirmEdit} onPress={handleSaveEdit} />
                  </View>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 140,
    gap: spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    marginBottom: spacing.sm,
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
  formCard: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
  },
  photoHeading: {
    marginTop: spacing.sm,
  },
  propertyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  propertyTitle: {
    flex: 1,
    gap: spacing.xs,
  },
  statusActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  documentRowText: {
    fontSize: 12,
  },
});
