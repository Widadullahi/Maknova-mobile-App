import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { RealEstate01Icon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Screen } from '../../components/Screen';
import { colors, spacing } from '../../theme';

export function BootScreen() {
  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.badge}>
          <HugeiconsIcon icon={RealEstate01Icon} size={34} color={colors.surface} />
        </View>
        <ActivityIndicator color={colors.primary} size="small" style={styles.spinner} />
        <AppText muted>Preparing your workspace...</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  spinner: {
    marginTop: spacing.xs,
  },
});
