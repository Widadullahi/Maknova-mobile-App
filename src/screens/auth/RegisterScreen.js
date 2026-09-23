import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft02Icon,
  ArrowRight02Icon,
  UserAdd01Icon,
  UserIcon,
  Mail01Icon,
  SmartPhone01Icon,
  LockPasswordIcon,
  RealEstate01Icon,
  Home01Icon,
  Wallet01Icon,
  Shield01Icon,
  UserGroupIcon,
  CheckmarkCircle02Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '../../components/Button';
import { AppText } from '../../components/AppText';
import { Checkbox } from '../../components/Checkbox';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { GoogleLogo } from '../../components/SocialLogos';
import { ROLES, ROLE_LABELS } from '../../constants/roles';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { requestEmailVerification, verifyEmailCode } from '../../api/emailVerification';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^(?:\+?234|0)[789][01]\d{8}$/;

function normalizePhone(value) {
  return value.trim().replace(/[\s()-]/g, '');
}

const GENERAL_TERMS_TEXT = `TERMS OF SERVICE
For General App Users, Homebuyers, Residents & Security Personnel
Effective Date: August 8, 2026

1. Scope of the Service
The platform provides a unified digital environment for services that may include property marketplace listings; property and estate information; electronic document execution and signing; resident access management; visitor registration and access tracking; security and gate management; and digital wallet and payment utilities. The availability of specific features may vary depending on your role, estate, account permissions, and the services enabled by the relevant estate operator.

2. Digital Wallet & Gate Pass Utility Charges
Residents using the platform's visitor management and access-control services may be required to maintain a prepaid digital wallet. Wallet top-ups are subject to a 2% transaction processing markup, where applicable. The platform does not operate on a mandatory fixed monthly subscription for visitor access — instead, generating a secure, single-use Visitor Access Code (OTP or QR code, where supported) triggers an automated deduction of ₦50 from your available wallet balance. If your wallet balance is below the required gate-pass charge, generating a new visitor access code will be temporarily unavailable until the wallet is sufficiently funded.

3. Gate Security Protocol
Visitor access codes are single-use security credentials associated with the relevant resident or residential profile. Authorized security personnel may use the platform's synchronized Guard Mode terminal to enter or scan visitor access codes. Access may be denied where a code is invalid, expired, previously used, manipulated or tampered with, or not associated with an authorized visitor or resident profile. Residents are responsible for visitors they authorize to enter the estate through their access credentials, subject to applicable estate rules and policies.

4. Electronic Signatures & Digital Records
Where electronic signing is enabled, actions such as selecting an acceptance checkbox, typing a name, drawing a signature, or completing another designated electronic-signature process may constitute an electronic acceptance or signature to the extent permitted by applicable law. For security, auditing, verification, and record-keeping purposes, the platform may record relevant transaction and authentication information, including your identity/account information, device information, IP address, date and time of the action, electronic signature or acceptance records, and relevant transaction or document activity. This information is governed by the platform's applicable Privacy Policy and data-protection obligations.

By checking the box below, you confirm that you have read, understood, and agree to be bound by this Terms of Service.`;

const ROLE_OPTIONS = [
  { id: ROLES.ESTATE_MANAGER, icon: RealEstate01Icon },
  { id: ROLES.RESIDENT, icon: Home01Icon },
  { id: ROLES.BUYER, icon: Wallet01Icon },
  { id: ROLES.SECURITY, icon: Shield01Icon },
  { id: ROLES.PUBLIC_USER, icon: UserGroupIcon },
];

const STEPS = [
  { key: 'role', title: 'Choose your role', subtitle: 'Pick the option that matches how you will use the platform.' },
  { key: 'identity', title: 'Your details', subtitle: 'Tell us who you are so we can set up your account.' },
  { key: 'email-verify', title: 'Verify your email', subtitle: "Confirm this email is yours with the 6-digit code we send you." },
  { key: 'security', title: 'Secure your account', subtitle: 'Set a password to finish creating your account.' },
];

function validateStep(step, form) {
  if (step === 'identity') {
    if (!form.fullName.trim()) return 'Full name is required.';
    if (!EMAIL_PATTERN.test(form.email.trim())) return 'Enter a valid email address.';
    if (!form.phone.trim()) return 'Phone number is required.';
    if (!PHONE_PATTERN.test(normalizePhone(form.phone))) {
      return 'Enter a valid Nigerian phone number (e.g. 08012345678 or +2348012345678).';
    }
  }

  if (step === 'security') {
    if (form.password.length < 6) return 'Password must be at least 6 characters.';
    if (!form.acceptedTerms) return 'You must accept the Terms of Service to continue.';
  }

  return null;
}

export function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    role: null,
    fullName: '',
    email: '',
    phone: '',
    password: '',
    acceptedTerms: false,
  });
  const [showTerms, setShowTerms] = useState(false);
  const [otpStatus, setOtpStatus] = useState('idle'); // idle | sent | verified
  const [otpCode, setOtpCode] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [otpError, setOtpError] = useState(null);
  const [otpHint, setOtpHint] = useState(null);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleBack() {
    if (stepIndex === 0) {
      navigation.goBack();
      return;
    }
    if (step.key === 'email-verify') {
      setOtpStatus('idle');
      setOtpCode('');
      setOtpError(null);
    }
    setStepIndex((current) => current - 1);
  }

  async function handleSendCode() {
    if (!EMAIL_PATTERN.test(form.email.trim())) {
      Alert.alert('Check your details', 'Enter a valid email address.');
      return;
    }
    setIsSendingCode(true);
    setOtpError(null);
    setOtpHint(null);
    try {
      const data = await requestEmailVerification(form.email.trim());
      setOtpStatus('sent');
      setOtpCode('');
      if (data.delivered) {
        setOtpHint('Verification code sent. Check your inbox (and spam folder).');
      } else if (data.devCode) {
        setOtpHint(`Email delivery isn't configured — use the development code ${data.devCode}.`);
      }
    } catch (error) {
      setOtpError(error.message);
    } finally {
      setIsSendingCode(false);
    }
  }

  async function handleVerifyCode() {
    if (otpCode.trim().length !== 6) {
      Alert.alert('Enter your code', 'Enter the 6-digit code we sent.');
      return;
    }
    setIsVerifyingCode(true);
    setOtpError(null);
    try {
      await verifyEmailCode(form.email.trim(), otpCode.trim());
      setOtpStatus('verified');
      setOtpHint('Email verified successfully.');
    } catch (error) {
      setOtpError(error.message);
    } finally {
      setIsVerifyingCode(false);
    }
  }

  async function handleNext() {
    if (step.key === 'email-verify') {
      if (otpStatus !== 'verified') {
        Alert.alert('Verify your email', 'Verify your email first before continuing.');
        return;
      }
      setStepIndex((current) => current + 1);
      return;
    }

    const validationError = validateStep(step.key, form);
    if (validationError) {
      Alert.alert('Check your details', validationError);
      return;
    }

    if (!isLastStep) {
      setStepIndex((current) => current + 1);
      return;
    }

    setIsSubmitting(true);
    try {
      await register(form);
    } catch (error) {
      Alert.alert('Registration failed', error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleGoogleSignIn() {
    Alert.alert('Google sign-in', 'Google sign-in is not connected to the backend yet.');
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

          {step.key === 'security' ? (
            <Button
              icon={UserAdd01Icon}
              disabled={isSubmitting}
              onPress={handleNext}
              title={isSubmitting ? 'Creating account...' : 'Create account'}
            />
          ) : null}

          <View style={styles.card}>
            {step.key === 'role' ? (
              <RoleStep
                selectedRole={form.role}
                onSelect={(role) => {
                  updateField('role', role);
                  setStepIndex(1);
                }}
              />
            ) : null}

            {step.key === 'identity' ? (
              <IdentityStep form={form} onChange={updateField} />
            ) : null}

            {step.key === 'email-verify' ? (
              <EmailVerifyStep
                email={form.email}
                error={otpError}
                hint={otpHint}
                isSendingCode={isSendingCode}
                isVerifyingCode={isVerifyingCode}
                onSendCode={handleSendCode}
                onVerifyCode={handleVerifyCode}
                otpCode={otpCode}
                onChangeCode={setOtpCode}
                status={otpStatus}
              />
            ) : null}

            {step.key === 'security' ? (
              <SecurityStep
                form={form}
                isSubmitting={isSubmitting}
                onChange={updateField}
                onGoogleSignIn={handleGoogleSignIn}
                onViewTerms={() => setShowTerms(true)}
              />
            ) : null}
          </View>

          {step.key !== 'role' && step.key !== 'security' ? (
            <Button
              icon={ArrowRight02Icon}
              disabled={isSubmitting}
              onPress={handleNext}
              title="Continue"
            />
          ) : null}

          <View style={styles.footer}>
            <AppText muted style={styles.footerText}>Already have an account?</AppText>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => navigation.navigate('Login')}>
              <AppText style={styles.footerLink}>Sign in</AppText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal animationType="slide" transparent onRequestClose={() => setShowTerms(false)} visible={showTerms}>
        <View style={styles.termsModalBackdrop}>
          <View style={styles.termsModalCard}>
            <AppText style={styles.termsModalTitle}>Terms of Service</AppText>
            <ScrollView style={styles.termsModalScroll}>
              <AppText muted style={styles.termsModalText}>{GENERAL_TERMS_TEXT}</AppText>
            </ScrollView>
            <Button onPress={() => setShowTerms(false)} title="Close" />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function StepProgress({ currentIndex, total }) {
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.progressSegment,
            index <= currentIndex && styles.progressSegmentActive,
          ]}
        />
      ))}
    </View>
  );
}

function RoleStep({ selectedRole, onSelect }) {
  return (
    <View style={styles.roleGrid}>
      {ROLE_OPTIONS.map((item) => {
        const selected = item.id === selectedRole;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() => onSelect(item.id)}
            style={[styles.roleOption, selected && styles.roleOptionSelected]}
          >
            <View style={[styles.roleIconWrap, selected && styles.roleIconWrapSelected]}>
              <HugeiconsIcon icon={item.icon} size={18} color={colors.primary} />
            </View>
            <AppText style={[styles.roleText, selected && styles.roleTextSelected]}>
              {ROLE_LABELS[item.id]}
            </AppText>
            {selected ? <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} color={colors.primary} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function IdentityStep({ form, onChange }) {
  return (
    <View style={styles.form}>
      <TextField icon={UserIcon} label="Full name" onChangeText={(value) => onChange('fullName', value)} value={form.fullName} />
      <TextField
        autoCapitalize="none"
        icon={Mail01Icon}
        keyboardType="email-address"
        label="Email"
        onChangeText={(value) => onChange('email', value)}
        value={form.email}
      />
      <TextField
        icon={SmartPhone01Icon}
        keyboardType="phone-pad"
        label="Phone"
        onChangeText={(value) => onChange('phone', value)}
        value={form.phone}
      />
    </View>
  );
}

function EmailVerifyStep({ email, status, otpCode, onChangeCode, onSendCode, onVerifyCode, isSendingCode, isVerifyingCode, error, hint }) {
  return (
    <View style={styles.form}>
      <View style={styles.otpEmailRow}>
        <HugeiconsIcon icon={Mail01Icon} size={18} color={colors.textMuted} />
        <AppText style={styles.otpEmailText}>{email}</AppText>
        {status === 'verified' ? (
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} color="#2F8F5B" />
        ) : null}
      </View>

      {status === 'sent' || status === 'verified' ? (
        <>
          <TextField
            editable={status !== 'verified'}
            icon={LockPasswordIcon}
            keyboardType="number-pad"
            label="Verification code"
            maxLength={6}
            onChangeText={onChangeCode}
            placeholder="6-digit code"
            value={otpCode}
          />
          <Button
            disabled={isVerifyingCode || status === 'verified'}
            icon={CheckmarkCircle02Icon}
            onPress={onVerifyCode}
            title={status === 'verified' ? 'Verified' : isVerifyingCode ? 'Verifying...' : 'Verify code'}
          />
        </>
      ) : null}

      {status !== 'verified' ? (
        <Button
          disabled={isSendingCode}
          onPress={onSendCode}
          title={status === 'sent' ? (isSendingCode ? 'Resending...' : 'Resend code') : isSendingCode ? 'Sending...' : 'Send verification code'}
          variant="secondary"
        />
      ) : null}

      {error ? <AppText style={styles.otpError}>{error}</AppText> : null}
      {hint ? <AppText muted style={styles.otpHint}>{hint}</AppText> : null}
    </View>
  );
}

function SecurityStep({ form, isSubmitting, onChange, onGoogleSignIn, onViewTerms }) {
  return (
    <View style={styles.form}>
      <TextField
        icon={LockPasswordIcon}
        label="Password"
        onChangeText={(value) => onChange('password', value)}
        secureTextEntry
        value={form.password}
      />

      <View style={styles.termsRow}>
        <Checkbox
          label="I have read and accept the Terms of Service"
          onChange={(value) => onChange('acceptedTerms', value)}
          value={form.acceptedTerms}
        />
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onViewTerms}>
          <AppText style={styles.footerLink}>View Terms of Service</AppText>
        </Pressable>
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <AppText muted style={styles.dividerText}>or continue with</AppText>
        <View style={styles.dividerLine} />
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={isSubmitting}
        onPress={onGoogleSignIn}
        style={styles.socialButton}
      >
        <GoogleLogo size={18} />
        <AppText style={styles.socialText}>Continue with Google</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
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
    backgroundColor: '#4FAF73',
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 26,
    lineHeight: 32,
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
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  socialText: {
    color: colors.text,
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
  },
  otpEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  otpEmailText: {
    flex: 1,
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
    color: colors.text,
  },
  otpError: {
    color: colors.danger,
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
  },
  otpHint: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 12,
  },
  roleGrid: {
    gap: spacing.sm,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  roleOptionSelected: {
    borderColor: '#4FAF73',
    backgroundColor: '#E8F5EC',
  },
  roleIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconWrapSelected: {
    backgroundColor: '#CBE6D2',
  },
  roleText: {
    flex: 1,
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
    color: colors.text,
  },
  roleTextSelected: {
    color: colors.primary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    color: colors.primary,
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
  },
  termsRow: {
    gap: spacing.sm,
  },
  termsModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  termsModalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    maxHeight: '80%',
    gap: spacing.lg,
  },
  termsModalTitle: {
    color: colors.text,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 18,
  },
  termsModalScroll: {
    maxHeight: 420,
  },
  termsModalText: {
    lineHeight: 20,
    fontSize: 13,
  },
});
