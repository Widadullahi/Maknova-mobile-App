import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft02Icon,
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  File01Icon,
  FileUploadIcon,
  UserIcon,
} from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { Screen } from '../../components/Screen';
import { SignatureField, isSignatureFilled } from '../../components/SignatureField';
import { StatusChip } from '../../components/StatusChip';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../context/AuthContext';
import {
  saveVerificationApplication,
  submitVerificationApplication,
  uploadVerificationDocuments,
} from '../../api/verification';
import { colors, spacing } from '../../theme';

const TERMS_VERSION = 'phase-1-v1';

const DEVELOPER_REQUIRED_DOCS = [
  ['government_planning_approval', 'Government planning approval'],
  ['land_title', 'Title chain: C of O/Consent + Deed'],
  ['survey_plan', 'Survey plan'],
  ['estate_development_approval', 'Estate development approval'],
];

const SUPPORTING_DOCS = [
  ['certificate_of_occupancy', 'Certificate of Occupancy'],
  ['deed_of_assignment', 'Deed of Assignment'],
  ['other_title_document', 'Other title document'],
];

// Individual landowners often can't produce the full estate-developer document
// set (a single plot, or a newly completed house). They need at least
// MIN_LANDOWNER_DOCS from this broader pool instead of one fixed required list.
const LANDOWNER_ALTERNATIVE_DOCS = [
  ['land_title', 'Land title / registration document'],
  ['certificate_of_occupancy', 'Certificate of Occupancy'],
  ['deed_of_assignment', 'Deed of Assignment'],
  ['survey_plan', 'Survey plan'],
  ['purchase_receipt', 'Purchase receipt / contract of sale'],
  ['sworn_affidavit', 'Sworn affidavit of ownership'],
  ['tax_receipt', 'Land/property tax receipt'],
  ['building_approval', 'Building approval / permit'],
  ['utility_bill', 'Utility bill in owner’s name'],
  ['chieftaincy_allocation_letter', 'Chieftaincy / community allocation letter'],
  ['other_title_document', 'Other supporting document'],
];
const MIN_LANDOWNER_DOCS = 3;

const STEPS = [
  { key: 'profile', title: 'Applicant & property details', subtitle: 'Tell us about the estate or plot you are onboarding.' },
  { key: 'required-docs', title: 'Required documents', subtitle: 'Upload official PDFs or high-resolution scans for the required document set.' },
  { key: 'supporting-docs', title: 'Supporting documents', subtitle: 'Optional, but they speed up review.' },
  { key: 'terms', title: 'Terms & signature', subtitle: 'Accept the terms and provide your electronic signature.' },
  { key: 'review', title: 'Review & submit', subtitle: 'Check everything before sending it for review.' },
];

export function VerificationWizardScreen({ navigation, route }) {
  const { user } = useAuth();
  // Buyer/public_user accounts are individuals selling their own single
  // property (the "Individual Landowner" path) — they never see or choose the
  // "Estate Developer" option, which only makes sense for the estate_manager role.
  const canChooseApplicantType = user?.role === 'estate_manager';
  const existingApplication = route.params?.application || null;
  const [stepIndex, setStepIndex] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [applicationId, setApplicationId] = useState(existingApplication?.id || null);
  const [documents, setDocuments] = useState(existingApplication?.documents || []);
  const [form, setForm] = useState({
    applicantType: existingApplication?.applicantType || (canChooseApplicantType ? 'estate_developer' : 'individual_landowner'),
    estateName: existingApplication?.estateName || '',
    estateLocation: existingApplication?.estateLocation || '',
    villageName: existingApplication?.villageName || '',
    partiesInvolved: existingApplication?.partiesInvolved || '',
    listingPrice: existingApplication?.listingPrice != null ? String(existingApplication.listingPrice) : '',
    managerTitle: existingApplication?.managerTitle || '',
    signature: {
      method: existingApplication?.signatureMethod || 'typed',
      text: existingApplication?.signatureText || '',
      paths: [],
    },
    acceptedTerms: Boolean(existingApplication?.acceptedTermsAt),
  });

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const isLandowner = form.applicantType === 'individual_landowner';
  const requiredDocs = isLandowner ? LANDOWNER_ALTERNATIVE_DOCS : DEVELOPER_REQUIRED_DOCS;
  const uploadedCategories = new Set(documents.map((doc) => doc.category));
  const missingRequired = isLandowner ? [] : DEVELOPER_REQUIRED_DOCS.filter(([category]) => !uploadedCategories.has(category));
  const landownerUploadedCount = LANDOWNER_ALTERNATIVE_DOCS.filter(([category]) => uploadedCategories.has(category)).length;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function persistApplication(extra = {}) {
    const data = await saveVerificationApplication({
      applicantType: form.applicantType,
      estateName: form.estateName,
      estateLocation: form.estateLocation,
      villageName: form.villageName,
      partiesInvolved: form.partiesInvolved,
      listingPrice: Number(form.listingPrice || 0),
      managerTitle: form.managerTitle,
      signatureMethod: form.signature.method,
      signatureText: form.signature.method === 'typed' ? form.signature.text : null,
      signatureData: form.signature.method === 'drawn' ? JSON.stringify(form.signature.paths) : null,
      acceptedTerms: form.acceptedTerms,
      termsVersion: TERMS_VERSION,
      ...extra,
    });
    setApplicationId(data.application.id);
    return data.application;
  }

  async function handlePickDocument(category, label) {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: true,
      type: ['application/pdf', 'image/jpeg', 'image/png'],
    });
    if (result.canceled || !result.assets?.length) {
      return;
    }

    const assets = result.assets;

    setIsBusy(true);
    try {
      let currentApplicationId = applicationId;
      if (!currentApplicationId) {
        const application = await persistApplication();
        currentApplicationId = application.id;
      }

      const data = await uploadVerificationDocuments(currentApplicationId, category, assets);

      // Title chain (and any other multi-file category) is built up across
      // separate uploads — e.g. C of O/Consent added first, Deed of Assignment
      // added afterward — so newly uploaded files are appended, not swapped in
      // for the whole category the way a single-document "Replace" implies.
      setDocuments((current) => [...current, ...data.documents]);
    } catch (error) {
      Alert.alert(`Add ${label}`, error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleNext() {
    if (step.key === 'profile') {
      if (!form.estateName.trim() || !form.estateLocation.trim()) {
        Alert.alert('Check your details', 'Estate/property name and location are required.');
        return;
      }
      if (!form.villageName.trim() || !form.partiesInvolved.trim()) {
        Alert.alert(
          'Check your details',
          'The village/community name and the individuals involved (seller, co-owners, family/community head, witnesses) are required so verification staff can visit and confirm the land in person.',
        );
        return;
      }
      if (!form.listingPrice || Number(form.listingPrice) < 0) {
        Alert.alert('Check your details', 'A price is required for verification.');
        return;
      }
      setIsBusy(true);
      try {
        await persistApplication();
        setStepIndex((current) => current + 1);
      } catch (error) {
        Alert.alert('Save application', error.message);
      } finally {
        setIsBusy(false);
      }
      return;
    }

    if (step.key === 'required-docs') {
      if (isLandowner) {
        if (landownerUploadedCount < MIN_LANDOWNER_DOCS) {
          Alert.alert('Missing documents', `Individual landowner submissions require at least ${MIN_LANDOWNER_DOCS} supporting documents. You've added ${landownerUploadedCount}.`);
          return;
        }
      } else if (missingRequired.length) {
        Alert.alert('Missing documents', 'Add all required documents before continuing.');
        return;
      }
      setStepIndex((current) => current + 1);
      return;
    }

    if (step.key === 'terms') {
      if (!form.acceptedTerms) {
        Alert.alert('Accept the terms', 'You must accept the terms to continue.');
        return;
      }
      if (!isSignatureFilled(form.signature)) {
        Alert.alert('Signature required', 'Type or draw your electronic signature before continuing.');
        return;
      }
      setIsBusy(true);
      try {
        await persistApplication();
        setStepIndex((current) => current + 1);
      } catch (error) {
        Alert.alert('Save application', error.message);
      } finally {
        setIsBusy(false);
      }
      return;
    }

    if (isLastStep) {
      if (!applicationId) {
        Alert.alert('Save first', 'Complete the earlier steps before submitting.');
        return;
      }
      setIsBusy(true);
      try {
        await submitVerificationApplication(applicationId);
        Alert.alert('Submitted', 'Your application is ready for admin review.', [
          { text: 'OK', onPress: () => navigation.navigate('Verification') },
        ]);
      } catch (error) {
        Alert.alert('Submit application', error.message);
      } finally {
        setIsBusy(false);
      }
      return;
    }

    setStepIndex((current) => current + 1);
  }

  function handleBack() {
    if (stepIndex === 0) {
      navigation.goBack();
      return;
    }
    setStepIndex((current) => current - 1);
  }

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={handleBack} style={styles.backButton}>
              <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
            </Pressable>
            <StepProgress currentIndex={stepIndex} total={STEPS.length} />
          </View>

          <View style={styles.header}>
            <AppText style={styles.title}>{step.title}</AppText>
            <AppText muted style={styles.subtitle}>{step.subtitle}</AppText>
          </View>

          <View style={styles.card}>
            {step.key === 'profile' ? (
              <ProfileStep form={form} onChange={updateField} isLandowner={isLandowner} canChooseApplicantType={canChooseApplicantType} />
            ) : null}

            {step.key === 'required-docs' ? (
              <>
                {isLandowner ? (
                  <AppText muted style={styles.subtitle}>
                    Attach at least {MIN_LANDOWNER_DOCS} documents from the list below ({landownerUploadedCount}/{MIN_LANDOWNER_DOCS} so far) — any combination is accepted.
                  </AppText>
                ) : null}
                <DocumentListStep
                  docs={requiredDocs}
                  isBusy={isBusy}
                  onPick={handlePickDocument}
                  uploadedCategories={uploadedCategories}
                />
              </>
            ) : null}

            {step.key === 'supporting-docs' ? (
              <DocumentListStep
                docs={SUPPORTING_DOCS}
                isBusy={isBusy}
                onPick={handlePickDocument}
                uploadedCategories={uploadedCategories}
              />
            ) : null}

            {step.key === 'terms' ? (
              <TermsStep form={form} onChange={updateField} />
            ) : null}

            {step.key === 'review' ? (
              <ReviewStep documents={documents} form={form} />
            ) : null}
          </View>

          <Button
            disabled={isBusy}
            icon={isLastStep ? CheckmarkCircle02Icon : ArrowRight02Icon}
            onPress={handleNext}
            title={isBusy ? 'Please wait...' : isLastStep ? 'Submit for review' : 'Continue'}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function StepProgress({ currentIndex, total }) {
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: total }).map((_, index) => (
        <View key={index} style={[styles.progressSegment, index <= currentIndex && styles.progressSegmentActive]} />
      ))}
    </View>
  );
}

function ProfileStep({ form, onChange, isLandowner, canChooseApplicantType }) {
  return (
    <View style={styles.form}>
      {canChooseApplicantType ? (
        <View style={styles.applicantTypeRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onChange('applicantType', 'estate_developer')}
            style={[styles.applicantTypeChip, !isLandowner && styles.applicantTypeChipActive]}
          >
            <AppText style={[styles.applicantTypeText, !isLandowner && styles.applicantTypeTextActive]}>Estate Developer</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onChange('applicantType', 'individual_landowner')}
            style={[styles.applicantTypeChip, isLandowner && styles.applicantTypeChipActive]}
          >
            <AppText style={[styles.applicantTypeText, isLandowner && styles.applicantTypeTextActive]}>Individual Landowner</AppText>
          </Pressable>
        </View>
      ) : null}
      {isLandowner ? (
        <AppText muted style={styles.subtitle}>
          {canChooseApplicantType
            ? 'For sellers without the full estate-developer document set — a single plot, or a newly completed house.'
            : "Tell us about the property you're selling, and attach at least 3 supporting documents so our team can verify it."}
        </AppText>
      ) : null}

      <TextField
        icon={File01Icon}
        label={isLandowner ? 'Property name' : 'Estate name'}
        onChangeText={(value) => onChange('estateName', value)}
        placeholder="e.g. Greenstone Courts Estate"
        value={form.estateName}
      />
      <TextField
        label="Location"
        onChangeText={(value) => onChange('estateLocation', value)}
        placeholder="e.g. Lekki Phase 2, Lagos"
        value={form.estateLocation}
      />
      <TextField
        label="Village / community name"
        onChangeText={(value) => onChange('villageName', value)}
        placeholder="e.g. Ibeju village"
        value={form.villageName}
      />
      <TextField
        label="Individuals involved"
        onChangeText={(value) => onChange('partiesInvolved', value)}
        placeholder="Seller, co-owners, family/community head, witnesses"
        value={form.partiesInvolved}
      />
      <TextField
        label="Price (₦)"
        keyboardType="number-pad"
        onChangeText={(value) => onChange('listingPrice', value)}
        placeholder="e.g. 5000000"
        value={form.listingPrice}
      />
      {canChooseApplicantType ? (
        <TextField
          icon={UserIcon}
          label="Manager title"
          onChangeText={(value) => onChange('managerTitle', value)}
          placeholder="e.g. Managing Director or Estate Management"
          value={form.managerTitle}
        />
      ) : null}
    </View>
  );
}

function DocumentListStep({ docs, uploadedCategories, onPick, isBusy }) {
  return (
    <View style={styles.form}>
      {docs.map(([category, label]) => {
        const uploaded = uploadedCategories.has(category);
        return (
          <View key={category} style={styles.documentRow}>
            <View style={styles.documentIconWrap}>
              <HugeiconsIcon icon={File01Icon} size={18} color={colors.primary} />
            </View>
            <View style={styles.documentCopy}>
              <AppText style={styles.documentLabel}>{label}</AppText>
              <StatusChip label={uploaded ? 'Added' : 'Missing'} tone={uploaded ? 'success' : 'warning'} />
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => onPick(category, label)}
              style={styles.documentAction}
            >
              <HugeiconsIcon icon={FileUploadIcon} size={16} color={colors.primary} />
              <AppText style={styles.documentActionText}>{uploaded ? 'Add another' : 'Add'}</AppText>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const MANAGER_TERMS_TEXT = `TERMS AND CONDITIONS
For Estate Management Teams, Property Developers, Landowners & Gated Estate Operators
Effective Date: August 8, 2026

1. Account Registration & Mandatory Verification
To access the Estate Management Dashboard and publish properties on the marketplace, you must successfully complete the platform's mandatory verification process. You agree to provide genuine, valid, complete, and up-to-date documentation, which may include Government Planning Approval or an Approved Estate Layout Plan; valid Land Title or Registration Documents (Certificate of Occupancy, Governor's Consent, Deed of Assignment, where applicable); an Approved Survey Plan; Estate Development Registration Certificates; and other documents reasonably required for verification. The platform reserves the right to request additional documentation where necessary to verify ownership, development authority, or the authenticity of a property listing.

2. Legal Representations & Warranties
By accepting these terms and completing the digital signature process, you represent and warrant that: you are the lawful owner of the estate or a duly authorized representative of the owner or developer; all information, documents, property dimensions, prices, layouts, descriptions, and other materials submitted are accurate, complete, authentic, and not misleading; you have the legal authority to upload, publish, market, allocate, or otherwise transact in relation to the properties submitted; and you accept responsibility for any fraudulent, misleading, inaccurate, forged, unauthorized, or unlawful information or documentation submitted through your account. Fraudulent or deliberately misleading submissions may result in account suspension, termination, removal of listings, reporting to relevant authorities, and any other remedies available under applicable law.

3. Usage-Based Monetization & Processing Fees
The platform operates under a zero-upfront-subscription model for property listings, subject to the configured buyer transaction fee and seller commission. Property listings may be published without an upfront listing fee. After the successful property payment, official transaction documents—including Plot Allocation Forms and Ownership Transfer Forms—are available without an additional document-generation charge. Properties progress transparently through the platform's transaction lifecycle: Available → Reserved → Sold / Allocated. Any deliberate attempt to bypass the platform's documentation process or transaction controls may result in suspension or permanent termination of your account.

4. Public Reporting, Investigation & Account Suspension
Each estate profile may include a "Report Estate" function through which users can report suspected false or misleading information, suspicious or potentially fraudulent documentation, unauthorized property listings, misrepresentation of ownership or development rights, or other activities that may violate these terms or applicable law. Upon receiving a report, the platform may conduct an investigation and, where reasonably necessary, temporarily suspend your dashboard, restrict account functionality, hide affected listings from the marketplace, or permanently terminate your account following verification of a violation.

These Terms should be read in full. By checking the box below and providing your electronic signature, you confirm that you have read, understood, and agree to be bound by them.`;

function TermsStep({ form, onChange }) {
  return (
    <View style={styles.form}>
      <ScrollView
        style={styles.termsBox}
        contentContainerStyle={styles.termsBoxContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator
        persistentScrollbar
      >
        <AppText muted style={styles.termsText}>
          {MANAGER_TERMS_TEXT}
        </AppText>
      </ScrollView>
      <Checkbox
        label="I have read and accept the terms"
        onChange={(value) => onChange('acceptedTerms', value)}
        value={form.acceptedTerms}
      />
      <SignatureField label="Your signature" onChange={(value) => onChange('signature', value)} value={form.signature} />
    </View>
  );
}

function ReviewStep({ form, documents }) {
  return (
    <View style={styles.form}>
      <ReviewRow label="Applicant type" value={form.applicantType === 'individual_landowner' ? 'Individual Landowner' : 'Estate Developer'} />
      <ReviewRow label="Estate / property name" value={form.estateName} />
      <ReviewRow label="Location" value={form.estateLocation} />
      <ReviewRow label="Village / community" value={form.villageName} />
      <ReviewRow label="Individuals involved" value={form.partiesInvolved} />
      <ReviewRow label="Price" value={form.listingPrice ? `₦${Number(form.listingPrice).toLocaleString()}` : 'Not provided'} />
      <ReviewRow label="Manager title" value={form.managerTitle || 'Not provided'} />
      <ReviewRow label="Documents attached" value={String(documents.length)} />
      <ReviewRow
        label="Signature"
        value={form.signature.method === 'drawn' ? `Drawn (${form.signature.paths.length} strokes)` : form.signature.text}
      />
    </View>
  );
}

function ReviewRow({ label, value }) {
  return (
    <View style={styles.reviewRow}>
      <AppText muted style={styles.reviewLabel}>{label}</AppText>
      <AppText style={styles.reviewValue}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  applicantTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  applicantTypeChip: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  applicantTypeChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  applicantTypeText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    color: colors.textMuted,
  },
  applicantTypeTextActive: {
    color: colors.primary,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
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
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  progressSegmentActive: {
    backgroundColor: colors.primary,
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
  },
  form: {
    gap: spacing.lg,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  documentIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  documentLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
  },
  documentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  documentActionText: {
    color: colors.primary,
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
  },
  termsBox: {
    maxHeight: 320,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },
  termsBoxContent: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  termsText: {
    lineHeight: 20,
    fontSize: 13,
  },
  reviewRow: {
    gap: 2,
  },
  reviewLabel: {
    fontSize: 12,
  },
  reviewValue: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
  },
});
