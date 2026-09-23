import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft02Icon,
  Calendar03Icon,
  CalendarCheckIn01Icon,
  Clock01Icon,
  QrCodeIcon,
  SmartPhone01Icon,
  UserIcon,
} from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import { useVisitorPasses } from '../../context/VisitorPassesContext';

const PURPOSES = ['Family', 'Business', 'Delivery', 'Other'];

export function RequestVisitorEntryScreen({ navigation }) {
  const { user } = useAuth();
  const { addPass } = useVisitorPasses();
  const { addInAppNotification } = useNotifications();
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [expectedDate, setExpectedDate] = useState('');
  const [expectedTime, setExpectedTime] = useState('');
  const [pass, setPass] = useState(null);

  const canGenerate = visitorName.trim() && visitorPhone.trim() && expectedDate.trim() && expectedTime.trim();

  async function handleGenerate() {
    if (!canGenerate) {
      Alert.alert('Missing details', 'Fill in the visitor name, phone, date, and time.');
      return;
    }

    try {
      const createdPass = await addPass({
        visitorName: visitorName.trim(),
        visitorPhone: visitorPhone.trim(),
        purpose,
        expectedDate,
        expectedTime,
        requestedBy: user?.fullName,
      });
      setPass(createdPass);
      addInAppNotification({
        title: 'Visitor pass generated',
        body: `${createdPass.visitorName} can use ${createdPass.code} or PIN ${createdPass.pin} at the gate.`,
        type: 'visitor',
        data: { passCode: createdPass.code },
      });
    } catch (error) {
      if (error.code === 'TOPUP_REQUIRED') {
        Alert.alert(
          'Top-up required',
          error.message,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Top up wallet', onPress: () => navigation.navigate('ProfileStack', { screen: 'Wallet' }) },
          ],
        );
        return;
      }
      Alert.alert('Generate pass', error.message);
    }
  }

  if (pass) {
    return (
      <Screen padded={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => navigation.goBack()} style={styles.backButton}>
            <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.passWrap}>
          <View style={styles.successIconWrap}>
            <HugeiconsIcon icon={CalendarCheckIn01Icon} size={28} color={colors.primary} />
          </View>
          <AppText style={styles.title}>Pass generated</AppText>
          <AppText muted style={styles.subtitle}>
            Share this code with {visitorName || 'your visitor'}. Security can verify it at the gate.
          </AppText>

          <View style={styles.passCard}>
            <View style={styles.qrBox}>
              <HugeiconsIcon icon={QrCodeIcon} size={96} color={colors.text} />
            </View>
            <AppText style={styles.passCode}>{pass.code}</AppText>
            <View style={styles.pinRow}>
              {pass.pin.split('').map((digit, index) => (
                <View key={index} style={styles.pinDigit}>
                  <AppText style={styles.pinDigitText}>{digit}</AppText>
                </View>
              ))}
            </View>
            <AppText muted style={styles.pinLabel}>Gate PIN</AppText>

            <View style={styles.passDetails}>
              <View style={styles.passDetailRow}>
                <AppText muted style={styles.passDetailLabel}>Visitor</AppText>
                <AppText style={styles.passDetailValue}>{visitorName}</AppText>
              </View>
              <View style={styles.passDetailRow}>
                <AppText muted style={styles.passDetailLabel}>Purpose</AppText>
                <AppText style={styles.passDetailValue}>{purpose}</AppText>
              </View>
              <View style={styles.passDetailRow}>
                <AppText muted style={styles.passDetailLabel}>Expected</AppText>
                <AppText style={styles.passDetailValue}>{expectedDate} · {expectedTime}</AppText>
              </View>
            </View>
          </View>

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
            <AppText style={styles.title}>Request visitor entry</AppText>
            <AppText muted style={styles.subtitle}>Generate a gate pass for your guest ahead of their arrival.</AppText>
          </View>

          <View style={styles.card}>
            <TextField icon={UserIcon} label="Visitor full name" onChangeText={setVisitorName} value={visitorName} />
            <TextField
              icon={SmartPhone01Icon}
              keyboardType="phone-pad"
              label="Visitor phone"
              onChangeText={setVisitorPhone}
              value={visitorPhone}
            />

            <View style={styles.purposeGroup}>
              <AppText style={styles.purposeLabel}>Purpose of visit</AppText>
              <View style={styles.purposeRow}>
                {PURPOSES.map((item) => {
                  const selected = item === purpose;
                  return (
                    <Pressable
                      key={item}
                      accessibilityRole="button"
                      onPress={() => setPurpose(item)}
                      style={[styles.purposeChip, selected && styles.purposeChipSelected]}
                    >
                      <AppText style={[styles.purposeChipText, selected && styles.purposeChipTextSelected]}>
                        {item}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <TextField
              icon={Calendar03Icon}
              label="Expected date"
              onChangeText={setExpectedDate}
              placeholder="e.g. 28 Nov 2026"
              value={expectedDate}
            />
            <TextField
              icon={Clock01Icon}
              label="Expected time"
              onChangeText={setExpectedTime}
              placeholder="e.g. 4:00 PM"
              value={expectedTime}
            />
          </View>

          <Button disabled={!canGenerate} onPress={handleGenerate} title="Generate visitor pass" />
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  purposeGroup: {
    gap: spacing.sm,
  },
  purposeLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
  },
  purposeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  purposeChip: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  purposeChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  purposeChipText: {
    color: colors.text,
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
  },
  purposeChipTextSelected: {
    color: colors.onPrimary,
  },
  passWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
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
  passCard: {
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  qrBox: {
    width: 128,
    height: 128,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  passCode: {
    color: colors.primary,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 16,
    letterSpacing: 1,
  },
  pinRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  pinDigit: {
    width: 40,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDigitText: {
    color: colors.text,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 20,
  },
  pinLabel: {
    fontSize: 12,
    marginBottom: spacing.md,
  },
  passDetails: {
    width: '100%',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  passDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  passDetailLabel: {
    fontSize: 13,
  },
  passDetailValue: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
  },
});
