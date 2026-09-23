import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { ROLE_LABELS } from '../../constants/roles';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';

export function ProfileDetailsScreen() {
  const { user } = useAuth();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <AppText variant="title">Profile details</AppText>
          <AppText muted>Review the identity and account information connected to your account.</AppText>
        </View>
        <View style={styles.card}>
          <Detail label="Full name" value={user?.fullName} />
          <Detail label="Email" value={user?.email} />
          <Detail label="Phone" value={user?.phone} />
          <View style={styles.row}>
            <AppText muted style={styles.label}>Role</AppText>
            <StatusChip label={ROLE_LABELS[user?.role] || 'Member'} tone="info" />
          </View>
          <View style={styles.row}>
            <AppText muted style={styles.label}>Account status</AppText>
            <StatusChip label={user?.accountStatus || 'active'} tone="success" />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Detail({ label, value }) {
  return (
    <View style={styles.row}>
      <AppText muted style={styles.label}>{label}</AppText>
      <AppText style={styles.value}>{value || 'Not provided'}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140, gap: spacing.lg },
  header: { gap: spacing.sm, paddingTop: spacing.xl },
  card: {
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: spacing.xl,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg },
  label: { flex: 1, fontSize: 13 },
  value: { flex: 2, textAlign: 'right' },
});
