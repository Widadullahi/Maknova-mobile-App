import { StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Alert02Icon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { ACCOUNT_STATUSES } from '../../constants/statuses';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';

const STATUS_LABELS = {
  [ACCOUNT_STATUSES.SUSPENDED]: 'Suspended',
  [ACCOUNT_STATUSES.REJECTED]: 'Rejected',
};

export function RestrictedScreen() {
  const { logout, user } = useAuth();
  const statusLabel = STATUS_LABELS[user?.accountStatus] || 'Restricted';

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.badge}>
          <HugeiconsIcon icon={Alert02Icon} size={34} color={colors.danger} />
        </View>

        <StatusChip label={statusLabel} tone="danger" />

        <AppText style={styles.title}>Access restricted</AppText>
        <AppText muted style={styles.body}>
          This account cannot access the platform right now. Contact an administrator if you
          believe this account should be active.
        </AppText>

        <Button onPress={logout} title="Sign out" variant="secondary" />
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
    paddingHorizontal: spacing.lg,
  },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(248, 113, 113, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 22,
    color: colors.text,
  },
  body: {
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: spacing.md,
  },
});
