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
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft02Icon, LockPasswordIcon, ShieldKeyIcon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { confirmPasswordReset } from '../../api/auth';
import { colors, spacing } from '../../theme';

export function ResetPasswordScreen({ navigation, route }) {
  const { email, devResetToken } = route.params || {};
  const [token, setToken] = useState(devResetToken || '');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      await confirmPasswordReset(token.trim(), newPassword);
      Alert.alert('Password updated', 'You can now sign in with your new password.', [
        { text: 'Sign in', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (error) {
      Alert.alert('Reset password', error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => navigation.goBack()} style={styles.backButton}>
            <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
          </Pressable>

          <View style={styles.header}>
            <View style={styles.brandBadge}>
              <HugeiconsIcon icon={ShieldKeyIcon} size={30} color={colors.onPrimary} />
            </View>
            <AppText style={styles.title}>Enter your reset code</AppText>
            <AppText muted style={styles.subtitle}>
              {email
                ? `We issued a reset code for ${email}. Enter it below with your new password.`
                : 'Enter the reset code you received along with your new password.'}
            </AppText>
            {devResetToken ? (
              <AppText muted style={styles.devHint}>
                Dev mode: code pre-filled since no email service is connected yet.
              </AppText>
            ) : null}
          </View>

          <View style={styles.card}>
            <TextField
              autoCapitalize="none"
              icon={ShieldKeyIcon}
              label="Reset code"
              onChangeText={setToken}
              value={token}
            />
            <TextField
              icon={LockPasswordIcon}
              label="New password"
              onChangeText={setNewPassword}
              secureTextEntry
              value={newPassword}
            />
            <Button
              disabled={!token || newPassword.length < 6 || isSubmitting}
              onPress={handleSubmit}
              title={isSubmitting ? 'Updating...' : 'Update password'}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
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
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 24,
    lineHeight: 30,
  },
  subtitle: {
    textAlign: 'center',
    maxWidth: 320,
  },
  devHint: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
  },
});
