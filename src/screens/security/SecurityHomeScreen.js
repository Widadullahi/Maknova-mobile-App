import { ImageBackground, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  ListViewIcon,
  Logout03Icon,
  ScanIcon,
  Shield01Icon,
  UserGroup02Icon,
} from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useVisitorPasses } from '../../context/VisitorPassesContext';

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export function SecurityHomeScreen({ navigation }) {
  const { logout, user } = useAuth();
  const { passes } = useVisitorPasses();

  const pendingCount = passes.filter((pass) => pass.status === 'pending').length;
  const checkedInCount = passes.filter((pass) => pass.status === 'checked_in').length;
  const recentPasses = [...passes]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ImageBackground
          source={require('../../../assets/onboarding/estate-layout-review.jpg')}
          style={styles.hero}
          imageStyle={styles.heroImage}
        >
          <View style={styles.heroOverlay} />
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <AppText style={styles.avatarText}>{getInitials(user?.fullName)}</AppText>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.profileCard}>
          <View style={styles.profileTextBlock}>
            <AppText muted style={styles.heroGreeting}>On duty</AppText>
            <AppText style={styles.heroName}>{user?.fullName || 'Security'}</AppText>
          </View>
          <View style={styles.estateChip}>
            <HugeiconsIcon icon={Shield01Icon} size={13} color={colors.primary} />
            <AppText style={styles.estateChipText}>Amani Gardens Estate</AppText>
          </View>
          <Button icon={Logout03Icon} onPress={logout} title="Sign out" variant="secondary" />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <HugeiconsIcon icon={Clock01Icon} size={18} color={colors.warning} />
            <AppText style={styles.statValue}>{pendingCount}</AppText>
            <AppText muted style={styles.statLabel}>Pending passes</AppText>
          </View>
          <View style={styles.statCard}>
            <HugeiconsIcon icon={UserGroup02Icon} size={18} color={colors.success} />
            <AppText style={styles.statValue}>{checkedInCount}</AppText>
            <AppText muted style={styles.statLabel}>Checked in today</AppText>
          </View>
        </View>

        <View style={styles.section}>
          <AppText variant="heading">Quick actions</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('VerifyPass')}
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <HugeiconsIcon icon={ScanIcon} size={22} color={colors.primary} />
            </View>
            <View style={styles.actionCopy}>
              <AppText style={styles.actionTitle}>Verify visitor pass</AppText>
              <AppText muted style={styles.actionBody}>Scan a QR code or enter a gate PIN</AppText>
            </View>
            <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.textMuted} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('VisitorLog')}
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(96, 165, 250, 0.14)' }]}>
              <HugeiconsIcon icon={ListViewIcon} size={22} color={colors.info} />
            </View>
            <View style={styles.actionCopy}>
              <AppText style={styles.actionTitle}>Visitor log</AppText>
              <AppText muted style={styles.actionBody}>See every pass for this estate</AppText>
            </View>
            <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.textMuted} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('VisitorAnalytics')}
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.14)' }]}>
              <HugeiconsIcon icon={UserGroup02Icon} size={22} color={colors.accent} />
            </View>
            <View style={styles.actionCopy}>
              <AppText style={styles.actionTitle}>Visitor analytics</AppText>
              <AppText muted style={styles.actionBody}>Filter gate activity and visitor trends</AppText>
            </View>
            <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <AppText variant="heading">Recent activity</AppText>
          {recentPasses.map((pass) => (
            <View key={pass.id} style={styles.passCard}>
              <View style={styles.passIconWrap}>
                <HugeiconsIcon
                  icon={pass.status === 'checked_in' ? CheckmarkCircle02Icon : Clock01Icon}
                  size={16}
                  color={pass.status === 'checked_in' ? colors.success : colors.warning}
                />
              </View>
              <View style={styles.passCopy}>
                <AppText style={styles.passName}>{pass.visitorName}</AppText>
                <AppText muted style={styles.passMeta}>
                  {pass.code} · {pass.purpose}
                </AppText>
              </View>
              <StatusChip
                label={pass.status === 'checked_in' ? 'Checked in' : 'Pending'}
                tone={pass.status === 'checked_in' ? 'success' : 'warning'}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 140,
  },
  hero: {
    height: 150,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  heroImage: {
    resizeMode: 'cover',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 9, 10, 0.4)',
  },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(245, 245, 247, 0.9)',
  },
  avatarText: {
    color: colors.onPrimary,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 15,
  },
  profileCard: {
    marginHorizontal: spacing.lg,
    marginTop: -36,
    marginBottom: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  profileTextBlock: {
    gap: 2,
  },
  heroGreeting: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
  },
  heroName: {
    color: colors.text,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 22,
  },
  estateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  estateChipText: {
    color: colors.text,
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  statValue: {
    color: colors.text,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 20,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: 11,
  },
  section: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  actionCardPressed: {
    opacity: 0.85,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    color: colors.text,
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
  },
  actionBody: {
    fontSize: 12,
  },
  passCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  passIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passCopy: {
    flex: 1,
    gap: 2,
  },
  passName: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
  },
  passMeta: {
    fontSize: 11,
  },
});
