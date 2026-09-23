import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { FilePenIcon } from '@hugeicons/core-free-icons';
import { AppText } from './AppText';
import { Button } from './Button';
import { SignaturePad } from './SignaturePad';
import { TextField } from './TextField';
import { colors, spacing } from '../theme';
import { useState } from 'react';

const METHODS = [
  { key: 'typed', label: 'Type' },
  { key: 'drawn', label: 'Draw' },
];

export function SignatureField({ label, value, onChange }) {
  const method = value?.method || 'typed';
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);
  const [draftPaths, setDraftPaths] = useState(value?.paths || []);
  const [resetSignal, setResetSignal] = useState(0);

  function setMethod(nextMethod) {
    onChange({ method: nextMethod, text: '', paths: [] });
  }

  function setText(text) {
    onChange({ method: 'typed', text, paths: [] });
  }

  function setPaths(paths) {
    onChange({ method: 'drawn', text: '', paths });
  }

  function openDrawingModal() {
    setDraftPaths(value?.paths || []);
    setResetSignal((current) => current + 1);
    setIsDrawingOpen(true);
  }

  function saveDrawing() {
    setPaths(draftPaths);
    setIsDrawingOpen(false);
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerRow}>
        {label ? <AppText style={styles.label}>{label}</AppText> : <View />}
        <View style={styles.tabRow}>
          {METHODS.map((item) => {
            const selected = item.key === method;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                onPress={() => setMethod(item.key)}
                style={[styles.tab, selected && styles.tabSelected]}
              >
                <AppText style={[styles.tabText, selected && styles.tabTextSelected]}>{item.label}</AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {method === 'typed' ? (
        <View style={styles.signatureInputGroup}>
          <TextField
            label="Typed signature"
            onChangeText={setText}
            placeholder="Type your legal full name"
            value={value?.text || ''}
          />
          <AppText muted style={styles.helperText}>This name is recorded as your electronic signature.</AppText>
        </View>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={openDrawingModal}
            style={({ pressed }) => [styles.signatureLaunch, pressed && styles.signatureLaunchPressed]}
          >
            <View style={styles.signatureIcon}>
              <HugeiconsIcon icon={FilePenIcon} size={20} color={colors.primary} />
            </View>
            <View style={styles.signatureLaunchCopy}>
              <AppText style={styles.signatureLaunchTitle}>
                {value?.paths?.length ? 'Edit drawn signature' : 'Open signature pad'}
              </AppText>
              <AppText muted style={styles.signatureLaunchHint}>
                {value?.paths?.length ? `${value.paths.length} stroke${value.paths.length === 1 ? '' : 's'} saved` : 'Use a larger signing surface'}
              </AppText>
            </View>
          </Pressable>

          <Modal
            animationType="slide"
            onRequestClose={() => setIsDrawingOpen(false)}
            presentationStyle="fullScreen"
            visible={isDrawingOpen}
          >
            <View style={styles.modalScreen}>
              <View style={styles.modalHeader}>
                <View>
                  <AppText variant="title">Draw signature</AppText>
                  <AppText muted style={styles.modalSubtitle}>Lift your finger as needed. Tap Done when finished.</AppText>
                </View>
              </View>
              <View style={styles.modalPadWrap}>
                <SignaturePad height={420} onChange={setDraftPaths} resetSignal={resetSignal} value={draftPaths} />
              </View>
              <View style={styles.modalActions}>
                <Button onPress={() => setIsDrawingOpen(false)} title="Cancel" variant="secondary" />
                <Button onPress={saveDrawing} title="Done" />
              </View>
            </View>
          </Modal>
        </>
      )}
    </View>
  );
}

export function isSignatureFilled(value) {
  if (!value) return false;
  if (value.method === 'drawn') return Boolean(value.paths?.length);
  return Boolean(value.text?.trim());
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tabSelected: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.textMuted,
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
  },
  tabTextSelected: {
    color: colors.onPrimary,
  },
  signatureLaunch: {
    minHeight: 78,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  signatureLaunchPressed: {
    opacity: 0.86,
  },
  signatureIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatureLaunchCopy: {
    flex: 1,
    gap: 2,
  },
  signatureLaunchTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
  },
  signatureLaunchHint: {
    fontSize: 12,
  },
  signatureInputGroup: {
    gap: spacing.xs,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 17,
  },
  modalScreen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingTop: spacing.xxl,
  },
  modalHeader: {
    marginBottom: spacing.lg,
  },
  modalSubtitle: {
    marginTop: spacing.xs,
  },
  modalPadWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  modalActions: {
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
});
