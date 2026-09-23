import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { colors, spacing } from '../theme';

const tones = {
  success: { backgroundColor: 'rgba(34, 197, 94, 0.16)', color: colors.success },
  warning: { backgroundColor: 'rgba(245, 158, 11, 0.16)', color: colors.warning },
  danger: { backgroundColor: 'rgba(248, 113, 113, 0.16)', color: colors.danger },
  info: { backgroundColor: 'rgba(96, 165, 250, 0.16)', color: colors.info },
  neutral: { backgroundColor: colors.surfaceMuted, color: colors.textMuted },
};

export function StatusChip({ label, tone = 'neutral' }) {
  const palette = tones[tone] || tones.neutral;

  return (
    <View style={[styles.chip, { backgroundColor: palette.backgroundColor }]}>
      <AppText variant="small" style={{ color: palette.color, fontWeight: '700' }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
