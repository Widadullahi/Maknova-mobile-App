import { ImageBackground, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Alert02Icon,
  ArrowRight01Icon,
  CalendarCheckIn01Icon,
  Logout03Icon,
  Megaphone01Icon,
  Notification03Icon,
  PinLocation01Icon,
  Wrench01Icon,
} from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useVisitorPasses } from '../../context/VisitorPassesContext';

const QUICK_ACTIONS = [
  {
    key: 'visitor',
    icon: CalendarCheckIn01Icon,
    title: 'Request visitor entry',
    body: 'Generate a gate pass for a guest',
    tone: colors.info,
    toneSoft: 'rgba(96, 165, 250, 0.14)',
    screen: 'RequestVisitorEntry',
  },
  {
    key: 'maintenance',
    icon: Wrench01Icon,
    title: 'Book maintenance',
    body: 'Plumbing, electrical, and more',
    tone: colors.primary,
    toneSoft: 'rgba(16, 185, 129, 0.12)',
    screen: 'BookMaintenance',
  },
  {
    key: 'maintenance-list',
    icon: Wrench01Icon,
    title: 'My requests',
    body: 'Track tickets and updates',
    tone: colors.accent,
    toneSoft: 'rgba(245, 158, 11, 0.14)',
    screen: 'MaintenanceRequests',
  },
  {
    key: 'report',
    icon: Alert02Icon,
    title: 'Report an issue',
    body: 'Flag a concern to management',
    tone: colors.danger,
    toneSoft: 'rgba(248, 113, 113, 0.14)',
    screen: 'ReportIssue',
  },
];

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export function ResidentHomeScreen({ navigation }) {
  const { logout, user } = useAuth();
  const { passes } = useVisitorPasses();

  const myPasses = passes.filter((pass) => pass.requestedBy === user?.fullName);
  const activePassCount = myPasses.filter((pass) => pass.status === 'pending').length;

  const stats = [
    { key: 'visitors', icon: CalendarCheckIn01Icon, value: String(activePassCount), label: 'Active passes', tone: colors.info },
    { key: 'maintenance', icon: Wrench01Icon, value: '0', label: 'Open request', tone: colors.primary },
    { key: 'notices', icon: Notification03Icon, value: '0', label: 'New notices', tone: colors.accent },
  ];

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ImageBackground
          source={require('../../../assets/onboarding/subdivided-estate.jpg')}
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
            <AppText muted style={styles.heroGreeting}>Welcome back</AppText>
            <AppText style={styles.heroName}>{user?.fullName || 'Resident'}</AppText>
          </View>
          <View style={styles.plotChip}>
            <HugeiconsIcon icon={PinLocation01Icon} size={13} color={colors.primary} />
            <AppText style={styles.plotChipText} numberOfLines={1}>
              Property link pending
            </AppText>
          </View>
          <Button icon={Logout03Icon} onPress={logout} title="Sign out" variant="secondary" />
        </View>

        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <View key={stat.key} style={styles.statCard}>
              <HugeiconsIcon icon={stat.icon} size={18} color={stat.tone} />
              <AppText style={styles.statValue}>{stat.value}</AppText>
              <AppText muted style={styles.statLabel}>{stat.label}</AppText>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <AppText variant="heading">Quick actions</AppText>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.key}
              accessibilityRole="button"
              onPress={() => navigation.navigate(action.screen)}
              style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: action.toneSoft }]}>
                <HugeiconsIcon icon={action.icon} size={22} color={action.tone} />
              </View>
              <View style={styles.actionCopy}>
                <AppText style={styles.actionTitle}>{action.title}</AppText>
                <AppText muted style={styles.actionBody}>{action.body}</AppText>
              </View>
              <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>

        {myPasses.length ? (
          <View style={styles.section}>
            <AppText variant="heading">My visitor passes</AppText>
            {myPasses.slice(0, 4).map((pass) => (
              <View key={pass.id} style={styles.passCard}>
                <View style={styles.passCopy}>
                  <AppText style={styles.passName}>{pass.visitorName}</AppText>
                  <AppText muted style={styles.passMeta}>
                    {pass.code} · {pass.purpose} · {pass.expectedDate} {pass.expectedTime}
                  </AppText>
                </View>
                <StatusChip
                  label={pass.status === 'checked_in' ? 'Checked in' : 'Pending'}
                  tone={pass.status === 'checked_in' ? 'success' : 'warning'}
                />
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.noticesHeader}>
            <HugeiconsIcon icon={Megaphone01Icon} size={18} color={colors.primary} />
            <AppText variant="heading">Estate notices</AppText>
          </View>
          <View style={styles.noticeCard}>
            <View style={styles.noticeCopy}>
              <AppText muted style={styles.noticeBody}>No live estate notices yet.</AppText>
            </View>
          </View>
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
  plotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  plotChipText: {
    flexShrink: 1,
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
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: spacing.md,
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
  noticesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  noticeCard: {
    flexDirection: 'row',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  noticeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeCopy: {
    flex: 1,
    gap: 2,
  },
  noticeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  noticeTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
  },
  noticeTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  noticeTime: {
    fontSize: 11,
  },
  noticeBody: {
    fontSize: 13,
  },
});
