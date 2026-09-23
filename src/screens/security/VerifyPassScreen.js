import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  QrCodeIcon,
  ScanIcon,
} from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { colors, spacing } from '../../theme';
import { useNotifications } from '../../context/NotificationsContext';
import { useVisitorPasses } from '../../context/VisitorPassesContext';

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'back'],
];

export function VerifyPassScreen({ navigation }) {
  const { verifyPass } = useVisitorPasses();
  const { addInAppNotification } = useNotifications();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState('scan');
  const [action, setAction] = useState('check_in');
  const [manualCode, setManualCode] = useState('');
  const [pin, setPin] = useState('');
  const [result, setResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  async function resolvePass(query, source = 'manual') {
    const verification = await verifyPass(query, source, action);

    if (!verification?.pass) {
      setResult({ status: 'invalid' });
      return;
    }

    if (verification.status === 'approved' || verification.status === 'checked_out') {
      setResult({ status: verification.status === 'checked_out' ? 'checked_out' : 'success', pass: verification.pass, message: verification.message });
      addInAppNotification({
        title: verification.status === 'checked_out' ? 'Visitor checked out' : 'Visitor checked in',
        body: `${verification.pass.visitorName} was ${verification.status === 'checked_out' ? 'checked out' : 'verified'} at the gate.`,
        type: 'visitor',
        data: { passCode: verification.pass.code },
      });
      return;
    }

    setResult({
      status: verification.status === 'checked_in' ? 'already_used' : verification.status,
      pass: verification.pass,
      message: verification.message,
    });
    addInAppNotification({
      title: 'Visitor verification alert',
      body: verification.message || `${verification.pass.visitorName} requires manual review.`,
      type: 'security',
      data: { passCode: verification.pass.code, status: verification.status },
    });
  }

  async function handleBarcodeScanned(scan) {
    if (isScanning) return;
    setIsScanning(true);
    await resolvePass(scan.data, 'scan');
    setIsScanning(false);
  }

  function handleManualVerify() {
    if (!manualCode.trim()) return;
    resolvePass(manualCode);
  }

  function handleKeyPress(key) {
    if (key === 'back') {
      setPin((current) => current.slice(0, -1));
      return;
    }
    if (pin.length >= 6) return;

    const nextPin = pin + key;
    setPin(nextPin);

    if (nextPin.length === 6) {
      resolvePass(nextPin, 'pin');
    }
  }

  function reset() {
    setResult(null);
    setPin('');
    setManualCode('');
  }

  if (result) {
    const isSuccess = result.status === 'success';
    const isCheckedOut = result.status === 'checked_out';
    const isAlreadyUsed = result.status === 'already_used';
    const isDenied = result.status === 'denied';

    return (
      <Screen padded={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => navigation.goBack()} style={styles.backButton}>
            <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.resultWrap}>
          <View
            style={[
              styles.resultIconWrap,
              { backgroundColor: isSuccess || isCheckedOut ? 'rgba(16, 185, 129, 0.14)' : 'rgba(248, 113, 113, 0.14)' },
            ]}
          >
            <HugeiconsIcon
              icon={isSuccess || isCheckedOut ? CheckmarkCircle02Icon : Cancel01Icon}
              size={32}
              color={isSuccess || isCheckedOut ? colors.primary : colors.danger}
            />
          </View>

          <AppText style={styles.title}>
            {isCheckedOut ? 'Visitor checked out' : isSuccess ? 'Visitor checked in' : isAlreadyUsed ? 'Pass already used' : isDenied ? 'Pass denied' : 'Invalid pass'}
          </AppText>
          <AppText muted style={styles.subtitle}>
            {result.message ||
              (isSuccess
                ? `${result.pass.visitorName} has been checked in.`
                : isCheckedOut
                ? `${result.pass.visitorName} has been checked out.`
                : isAlreadyUsed
                ? `${result.pass.visitorName} was already checked in earlier.`
                : isDenied
                ? `${result.pass.visitorName} is not cleared for entry.`
                : 'That code or PIN does not match an active visitor pass.')}
          </AppText>

          {result.pass ? (
            <View style={styles.passDetails}>
              <View style={styles.passDetailRow}>
                <AppText muted style={styles.passDetailLabel}>Visitor</AppText>
                <AppText style={styles.passDetailValue}>{result.pass.visitorName}</AppText>
              </View>
              <View style={styles.passDetailRow}>
                <AppText muted style={styles.passDetailLabel}>Purpose</AppText>
                <AppText style={styles.passDetailValue}>{result.pass.purpose}</AppText>
              </View>
              <View style={styles.passDetailRow}>
                <AppText muted style={styles.passDetailLabel}>Pass code</AppText>
                <AppText style={styles.passDetailValue}>{result.pass.code}</AppText>
              </View>
              {result.pass.hostName ? (
                <View style={styles.passDetailRow}>
                  <AppText muted style={styles.passDetailLabel}>Host</AppText>
                  <AppText style={styles.passDetailValue}>{result.pass.hostName}</AppText>
                </View>
              ) : null}
            </View>
          ) : null}

          <Button onPress={reset} title="Verify another pass" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.verifyContent} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => navigation.goBack()} style={styles.backButton}>
              <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.header}>
            <AppText style={styles.title}>Verify visitor pass</AppText>
            <AppText muted style={styles.subtitle}>Scan the visitor's QR code or enter their gate PIN.</AppText>
          </View>

          <View style={styles.tabRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAction('check_in')}
              style={[styles.tab, action === 'check_in' && styles.tabActive]}
            >
              <AppText style={[styles.tabText, action === 'check_in' && styles.tabTextActive]}>Check in</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAction('check_out')}
              style={[styles.tab, action === 'check_out' && styles.tabActive]}
            >
              <AppText style={[styles.tabText, action === 'check_out' && styles.tabTextActive]}>Check out</AppText>
            </Pressable>
          </View>

          <View style={styles.tabRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setMode('scan')}
              style={[styles.tab, mode === 'scan' && styles.tabActive]}
            >
              <AppText style={[styles.tabText, mode === 'scan' && styles.tabTextActive]}>Scan QR</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setMode('pin')}
              style={[styles.tab, mode === 'pin' && styles.tabActive]}
            >
              <AppText style={[styles.tabText, mode === 'pin' && styles.tabTextActive]}>Enter PIN</AppText>
            </Pressable>
          </View>

          {mode === 'scan' ? (
            <View style={styles.scanWrap}>
          {permission?.granted ? (
            <View style={styles.viewfinder}>
              <CameraView
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                facing="back"
                onBarcodeScanned={isScanning ? undefined : handleBarcodeScanned}
                style={styles.camera}
              />
              <View style={styles.cameraShade} pointerEvents="none" />
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
          ) : (
            <View style={styles.viewfinder}>
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
              <HugeiconsIcon icon={QrCodeIcon} size={64} color={colors.textMuted} />
            </View>
          )}
          <AppText muted style={styles.scanHint}>
            {permission?.granted
              ? 'Point the camera at a visitor QR pass.'
              : 'Camera access is required to scan QR passes.'}
          </AppText>

          {permission?.granted ? null : (
            <Button icon={ScanIcon} onPress={requestPermission} title="Allow camera access" />
          )}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <AppText muted style={styles.dividerText}>Or enter code manually</AppText>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.manualRow}>
            <View style={styles.manualField}>
              <TextField
                autoCapitalize="characters"
                label="Pass code"
                onChangeText={setManualCode}
                placeholder="VP-100201"
                value={manualCode}
              />
            </View>
          </View>
          <Button onPress={handleManualVerify} title="Verify code" variant="secondary" />
            </View>
          ) : (
            <View style={styles.pinWrap}>
          <View style={styles.pinDisplay}>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <View key={index} style={[styles.pinDot, pin.length > index && styles.pinDotFilled]} />
            ))}
          </View>

          <View style={styles.keypad}>
            {KEYPAD_ROWS.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.keypadRow}>
                {row.map((key, keyIndex) => {
                  if (key === '') {
                    return <View key={keyIndex} style={styles.keypadKeyEmpty} />;
                  }
                  return (
                    <Pressable
                      key={keyIndex}
                      accessibilityRole="button"
                      onPress={() => handleKeyPress(key)}
                      style={({ pressed }) => [styles.keypadKey, pressed && styles.keypadKeyPressed]}
                    >
                      {key === 'back' ? (
                        <HugeiconsIcon icon={Delete02Icon} size={20} color={colors.text} />
                      ) : (
                        <AppText style={styles.keypadKeyText}>{key}</AppText>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  verifyContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
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
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
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
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 4,
    gap: 4,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
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
  },
  scanWrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  viewfinder: {
    width: 220,
    height: 220,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraShade: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(245, 245, 247, 0.2)',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: colors.primary,
  },
  cornerTopLeft: {
    top: 12,
    left: 12,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    top: 12,
    right: 12,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    bottom: 12,
    left: 12,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    bottom: 12,
    right: 12,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  scanHint: {
    fontSize: 12,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
    marginTop: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 12,
  },
  manualRow: {
    width: '100%',
  },
  manualField: {
    width: '100%',
  },
  pinWrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.xxl,
  },
  pinDisplay: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
  },
  pinDotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  keypad: {
    gap: spacing.lg,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  keypadKey: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  keypadKeyPressed: {
    opacity: 0.7,
  },
  keypadKeyEmpty: {
    width: 64,
    height: 64,
  },
  keypadKeyText: {
    color: colors.text,
    fontFamily: 'DMSans_700Bold',
    fontSize: 22,
  },
  resultWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  resultIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  passDetails: {
    width: '100%',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginVertical: spacing.lg,
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
