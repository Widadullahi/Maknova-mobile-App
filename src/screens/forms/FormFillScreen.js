import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft02Icon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { SignatureField, isSignatureFilled } from '../../components/SignatureField';
import { TextField } from '../../components/TextField';
import { useFormSubmissions } from '../../context/FormSubmissionsContext';
import { colors, spacing } from '../../theme';
import { fetchEstateProperties, fetchEstates } from '../../api/estates';
import { uploadMultipart } from '../../api/upload';
import { useAuth } from '../../context/AuthContext';

export function FormFillScreen({ navigation, route }) {
  const template = route.params?.template;
  const { addSubmission } = useFormSubmissions();
  const { user } = useAuth();
  const [values, setValues] = useState({});
  const [signature, setSignature] = useState({ method: 'typed', text: '', paths: [] });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsPropertyContext = ['plot_allocation_form', 'ownership_transfer_form'].includes(template?.code);
  const [propertyId, setPropertyId] = useState('');
  const [property, setProperty] = useState(null);
  const [estate, setEstate] = useState(null);
  const [isLoadingProperty, setIsLoadingProperty] = useState(false);
  const [propertyLoadError, setPropertyLoadError] = useState(null);

  function updateField(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function applyPropertyDetails(nextProperty, nextEstate) {
    setProperty(nextProperty);
    setEstate(nextEstate);
    setPropertyLoadError(null);
    setPropertyId(String(nextProperty.id));
    setValues((current) => ({
      ...current,
      allocationReference: current.allocationReference || `ALLOC-${nextProperty.id}-${Date.now()}`,
      propertyIdentifier: nextProperty.plotNumber || nextProperty.propertyIdentifier || '',
      plotNumber: nextProperty.plotNumber || nextProperty.propertyIdentifier || '',
      estateName: nextEstate?.name || '',
      ownerName: user?.fullName || '',
      buyerName: current.buyerName || user?.fullName || '',
    }));
  }

  async function loadProperty(propertyIdValue, estates = null) {
    if (!propertyIdValue?.trim()) return;
    setIsLoadingProperty(true);
    try {
      const estateData = estates || await fetchEstates();
      const estatesList = estateData.estates || [];
      let match = null;
      let matchEstate = null;
      for (const candidateEstate of estatesList) {
        const data = await fetchEstateProperties(candidateEstate.id);
        match = (data.properties || []).find((item) => String(item.id) === String(propertyIdValue));
        if (match) {
          matchEstate = candidateEstate;
          break;
        }
      }
      if (!match) throw new Error('That property was not found in your accessible estates.');
      applyPropertyDetails(match, matchEstate);
    } catch (error) {
      setProperty(null);
      setEstate(null);
      setPropertyLoadError(error.message);
    } finally {
      setIsLoadingProperty(false);
    }
  }

  useEffect(() => {
    if (!template || !needsPropertyContext) return;
    let active = true;
    (async () => {
      try {
        const estateData = await fetchEstates();
        const firstEstate = estateData.estates?.[0];
        if (!firstEstate) return;
        const propertyData = await fetchEstateProperties(firstEstate.id);
        const firstProperty = propertyData.properties?.[0];
        if (active && firstProperty) applyPropertyDetails(firstProperty, firstEstate);
      } catch (error) {
        if (active) setPropertyLoadError(error.message);
      }
    })();
    return () => { active = false; };
  }, [template?.id, template?.code, user?.id]);

  if (!template) {
    return (
      <View style={styles.notFound}>
        <AppText variant="heading">Form not found</AppText>
        <Button onPress={() => navigation.goBack()} title="Go back" variant="secondary" />
      </View>
    );
  }

  const fields = template?.schema?.fields || template?.fields || [];
  const getFieldKey = (field, index) => typeof field === 'string' ? field : field.key || field.name || field.label || `field-${index}`;
  const getFieldLabel = (field, index) => typeof field === 'string' ? field.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase()) : field.label || field.title || field.name || `Field ${index + 1}`;
  const getFieldPlaceholder = (field, index) =>
    field.placeholder || field.hint || field.description || `Enter ${getFieldLabel(field, index).toLowerCase()}`;
  const allFieldsFilled = fields.every((field, index) => (values[getFieldKey(field, index)] || '').trim());
  async function handleSubmit() {
    if (needsPropertyContext && !propertyId.trim()) {
      Alert.alert('Property required', 'Load the property details before completing this document.');
      return;
    }
    if (!allFieldsFilled) {
      Alert.alert('Missing fields', 'Fill in every field before submitting.');
      return;
    }
    if (!isSignatureFilled(signature)) {
      Alert.alert('Signature required', 'Type or draw your electronic signature before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const submission = await addSubmission({
        template,
        values,
        propertyId: needsPropertyContext ? propertyId.trim() : undefined,
        signatureText: signature.method === 'typed' ? signature.text.trim() : `Drawn signature (${signature.paths.length} strokes)`,
        signatureMethod: signature.method,
      });
      const html = buildDocumentHtml(template, values, user, estate, property);
      const pdf = await Print.printToFileAsync({ html });
      if (estate?.id && property?.id) {
        await uploadMultipart(`/estates/${estate.id}/properties/${property.id}/documents/upload`, {
          assets: [{ uri: pdf.uri, name: `plot-allocation-${property.plotNumber || property.id}.pdf`, mimeType: 'application/pdf' }],
          category: 'allocation_document',
          fallbackName: 'plot-allocation-form',
          failureMessage: 'The allocation PDF could not be stored in the property documents.',
        });
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdf.uri, {
          mimeType: 'application/pdf',
          dialogTitle: `${template.name} PDF`,
          UTI: 'com.adobe.pdf',
        });
      }
      Alert.alert('Submitted', `${template.name} has been submitted and the PDF is ready to download/share.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Submit failed', error.message);
    } finally {
      setIsSubmitting(false);
    }
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
            <AppText style={styles.title}>{template.name}</AppText>
            <AppText muted style={styles.subtitle}>{template.description}</AppText>
          </View>

          {needsPropertyContext ? (
            <View style={styles.card}>
              <AppText variant="heading">Property details</AppText>
              <AppText muted style={styles.subtitle}>
                Document generation is included in the successful property transaction. No additional payment is required.
              </AppText>
              <TextField
                label="Property ID"
                keyboardType="number-pad"
                onChangeText={setPropertyId}
                placeholder="e.g. 42"
                value={propertyId}
                editable
              />
              <Button
                title={isLoadingProperty ? 'Loading property...' : 'Load plot details'}
                variant="secondary"
                disabled={isLoadingProperty || !propertyId.trim()}
                onPress={() => loadProperty(propertyId)}
              />
              {property ? (
                <View style={styles.propertySummary}>
                  <AppText variant="heading">Plot details loaded</AppText>
                  <AppText muted>Plot: {property.plotNumber || property.propertyIdentifier || 'Not set'}</AppText>
                  <AppText muted>Estate: {estate?.name || 'Not set'}</AppText>
                  <AppText muted>Type / size: {property.propertyType || 'Not set'}{property.plotSize ? ` · ${property.plotSize}` : ''}</AppText>
                  <AppText muted>Filling and signing as: {user?.fullName || 'Current account'}</AppText>
                </View>
              ) : null}
              {propertyLoadError ? <AppText style={styles.errorText}>{propertyLoadError}</AppText> : null}
            </View>
          ) : null}

          <View style={styles.card}>
            {fields.map((field, index) => {
              const fieldKey = getFieldKey(field, index);
              return (
              <TextField
                key={fieldKey}
                label={getFieldLabel(field, index)}
                onChangeText={(value) => updateField(fieldKey, value)}
                placeholder={getFieldPlaceholder(field, index)}
                value={values[fieldKey] || ''}
              />
              );
            })}

            <SignatureField label="Your signature" onChange={setSignature} value={signature} />
          </View>

          <Button
            disabled={isSubmitting}
            onPress={handleSubmit}
            title={isSubmitting ? 'Submitting...' : 'Submit form'}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#039;' }[character]));
}

function buildDocumentHtml(template, values, user, estate, property) {
  const rows = Object.entries(values)
    .filter(([, value]) => String(value ?? '').trim())
    .map(([key, value]) => `<div class="row"><span>${escapeHtml(key.replace(/([A-Z])/g, ' $1'))}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join('');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><style>
    body{font-family:Arial,sans-serif;color:#17321e;padding:36px}h1{font-size:22px;margin:0 0 8px;color:#003B0B}h2{font-size:14px;color:#56705d;margin:0 0 28px}.brand{border-bottom:3px solid #003B0B;padding-bottom:14px;margin-bottom:28px}.row{display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid #d8e2da;padding:12px 0}.row span{color:#607364;text-transform:capitalize}.row strong{text-align:right}.footer{margin-top:44px;color:#607364;font-size:12px}
  </style></head><body><div class="brand"><h1>EstateFlow</h1><h2>LEGAL DOCUMENTATION · ${escapeHtml(template.name)}</h2></div>${property ? `<p><strong>Plot:</strong> ${escapeHtml(property.plotNumber || property.propertyIdentifier)} &nbsp; <strong>Estate:</strong> ${escapeHtml(estate?.name)}</p>` : ''}${rows}<div class="footer">Submitted by ${escapeHtml(user?.fullName || 'Account holder')} · Electronic signature recorded · Submission ${escapeHtml(Date.now())}</div></body></html>`;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.xl,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
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
  },
  subtitle: {
    fontSize: 14,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  cardLocked: {
    opacity: 0.4,
  },
  paidNotice: {
    color: colors.success,
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
  },
  propertySummary: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
});
