import { View, StyleSheet } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { AppText } from './AppText';
import { colors, spacing } from '../theme';

export function EmptyState({ title, body, icon: Icon }) {
  return (
    <View style={styles.wrapper}>
      {Icon ? (
        <View style={styles.iconWrap}>
          <HugeiconsIcon icon={Icon} size={28} color={colors.primary} />
        </View>
      ) : null}
      <AppText variant="heading" style={styles.center}>{title}</AppText>
      {body ? <AppText muted style={styles.center}>{body}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
});
