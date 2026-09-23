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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Login03Icon,
  Mail01Icon,
  LockPasswordIcon,
  RealEstate01Icon,
  ArrowRight02Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { AppText } from '../../components/AppText';
import { TextField } from '../../components/TextField';
import { GoogleLogo, AppleLogo } from '../../components/SocialLogos';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const emailIsInvalid = email.trim().length > 0 && !EMAIL_PATTERN.test(email.trim());

  async function handleSubmit(credentials) {
    if (emailIsInvalid || !email.trim()) {
      Alert.alert('Enter a valid email address');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await login(credentials || { email, password }, { rememberMe });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSocialSignIn(provider) {
    Alert.alert(provider, `${provider} sign-in is not connected to the backend yet.`);
  }

  return (
    <View style={styles.root}>
      <View style={[styles.hero, { paddingTop: Math.max(insets.top, spacing.lg) }]}>
        <View style={styles.heroBlock} />
        <View style={styles.heroRing} />
        <View style={styles.brandBadge}>
          <HugeiconsIcon icon={RealEstate01Icon} size={30} color={colors.onPrimary} />
        </View>
        <AppText style={styles.heroTitle}>Welcome back</AppText>
        <AppText style={styles.heroSubtitle}>Sign in to manage your estates and plots</AppText>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.sheetScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.xxl) }]}>
            <View style={styles.tabRow}>
              <View style={[styles.tab, styles.tabActive]}>
                <AppText style={styles.tabTextActive}>Login</AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate('Register')}
                style={styles.tab}
              >
                <AppText style={styles.tabText}>Register</AppText>
              </Pressable>
            </View>

            <View style={styles.form}>
              <TextField
                autoCapitalize="none"
                icon={Mail01Icon}
                keyboardType="email-address"
                label="Email"
                onChangeText={setEmail}
                placeholder="you@example.com"
                value={email}
              />
              <TextField
                icon={LockPasswordIcon}
                label="Password"
                onChangeText={setPassword}
                placeholder="Your password"
                secureTextEntry
                value={password}
              />

              <View style={styles.optionsRow}>
                <Checkbox label="Remember me" onChange={setRememberMe} value={rememberMe} />
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => navigation.navigate('ForgotPassword')}
                >
                  <AppText style={styles.forgotPasswordText}>Forgot password?</AppText>
                </Pressable>
              </View>

              {errorMessage ? (
                <View style={styles.errorBanner}>
                  <AppText style={styles.errorText}>{errorMessage}</AppText>
                </View>
              ) : null}

              <Button
                disabled={!email || !password || isSubmitting}
                icon={isSubmitting ? Login03Icon : ArrowRight02Icon}
                onPress={() => handleSubmit()}
                title={isSubmitting ? 'Signing in...' : 'Login'}
              />

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <AppText muted style={styles.dividerText}>Or continue with</AppText>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleSocialSignIn('Google')}
                  style={styles.socialButton}
                >
                  <GoogleLogo size={18} />
                  <AppText style={styles.socialText}>Google</AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleSocialSignIn('Apple')}
                  style={styles.socialButton}
                >
                  <AppleLogo size={18} />
                  <AppText style={styles.socialText}>Apple</AppText>
                </Pressable>
              </View>
            </View>

            <View style={styles.footer}>
              <AppText muted style={styles.footerText}>Don't have an account?</AppText>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => navigation.navigate('Register')}>
                <AppText style={styles.footerLink}>Sign up</AppText>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  hero: {
    height: 240,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  heroBlock: {
    position: 'absolute',
    width: '140%',
    height: '120%',
    top: '-40%',
    right: '-30%',
    borderRadius: 80,
    backgroundColor: colors.primary,
    opacity: 0.14,
    transform: [{ rotate: '-10deg' }],
  },
  heroRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.border,
    top: 20,
    right: -60,
  },
  brandBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    color: colors.text,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 24,
  },
  heroSubtitle: {
    color: colors.textMuted,
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    marginTop: spacing.xs,
  },
  sheetScroll: {
    flexGrow: 1,
  },
  sheet: {
    flex: 1,
    marginTop: -28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.textMuted,
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
  },
  tabTextActive: {
    color: colors.onPrimary,
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
  },
  form: {
    gap: spacing.lg,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  forgotPasswordText: {
    color: colors.primary,
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
  },
  errorBanner: {
    backgroundColor: '#2A1518',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    textAlign: 'center',
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
  socialRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  socialButton: {
    flex: 1,
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    color: colors.primary,
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
  },
});
