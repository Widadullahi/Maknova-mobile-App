import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowRight01Icon,
  Alert02Icon,
  DocumentValidationIcon,
  Logout03Icon,
  Notification03Icon,
  UserGroup02Icon,
  Wallet01Icon,
} from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { ROLE_LABELS } from '../../constants/roles';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getInitials } from '../../utils/format';

const FORMS_ROLES = new Set(['estate_manager', 'resident', 'buyer', 'security', 'admin', 'super_admin']);
const MANAGER_ROLES = new Set(['estate_manager', 'admin', 'super_admin']);
const INDIVIDUAL_SELLER_ROLES = new Set(['buyer', 'public_user']);

function getMenuItems(role) {
  const items = [
    {
      key: 'profile-details',
      icon: UserGroup02Icon,
      title: 'Profile details',
      body: 'Manage identity, role, account status, and linked estate profile.',
      screen: 'ProfileDetails',
    },
    {
      key: 'notifications',
      icon: Notification03Icon,
      title: 'Notifications',
      body: 'View in-app alerts for visitors, payments, maintenance, and reports.',
      screen: 'Notifications',
    },
    {
      key: 'settings',
      icon: UserGroup02Icon,
      title: 'Settings',
      body: 'Preferences, notifications, security, and estate defaults.',
      screen: 'Profile',
    },
  ];

  if (MANAGER_ROLES.has(role)) {
    items.push({
      key: 'verification',
      icon: DocumentValidationIcon,
      title: 'Estate verification',
      body: 'Manage your onboarding and document review status.',
      screen: 'Verification',
    });
    items.push({
      key: 'residents',
      icon: UserGroup02Icon,
      title: 'Residents',
      body: 'Verify tenant records and approve resident entry.',
      screen: 'Residents',
    });
  }

  if (INDIVIDUAL_SELLER_ROLES.has(role)) {
    items.push({
      key: 'sell-property',
      icon: DocumentValidationIcon,
      title: 'Sell a property',
      body: 'List your own house or plot for sale, once verified.',
      screen: 'Verification',
    });
  }

  if (role === 'resident') {
    items.push({
      key: 'wallet',
      icon: Wallet01Icon,
      title: 'Visitor Wallet',
      body: 'Top up your wallet — a small fee applies per guest pass generated.',
      screen: 'Wallet',
    });
  }

  if (FORMS_ROLES.has(role)) {
    items.push({
      key: 'forms',
      icon: DocumentValidationIcon,
      title: 'Digital forms',
      body: 'Submit and review signed platform forms.',
      screen: 'Forms',
    });
  }

  items.push({
    key: 'support',
    icon: Alert02Icon,
    title: 'Help and support',
    body: 'FAQs, support tickets, and escalation channels.',
      screen: 'Profile',
  });

  return items;
}

export function ProfileScreen({ navigation }) {
  const { logout, user } = useAuth();
  const menuItems = getMenuItems(user?.role);

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <AppText style={styles.avatarText}>{getInitials(user?.fullName)}</AppText>
          </View>
          <View style={styles.headerCopy}>
            <AppText variant="title">{user?.fullName || 'Platform user'}</AppText>
            <AppText muted>{user?.email}</AppText>
          </View>
          <View style={styles.chipRow}>
            <StatusChip label={ROLE_LABELS[user?.role] || 'Member'} tone="info" />
            <StatusChip label={user?.accountStatus || 'active'} tone="success" />
          </View>
        </View>

        {menuItems.length ? (
        <View style={styles.menu}>
          {menuItems.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              onPress={() => navigation.navigate(item.screen)}
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            >
              <View style={styles.menuIconWrap}>
                <HugeiconsIcon icon={item.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.menuCopy}>
                <AppText variant="heading">{item.title}</AppText>
                <AppText muted>{item.body}</AppText>
              </View>
              <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
        ) : null}

        <Button icon={Logout03Icon} onPress={logout} title="Sign out" variant="secondary" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: 120,
  },
  content: {
    paddingBottom: 140,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  avatarText: {
    color: colors.onPrimary,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 22,
  },
  headerCopy: {
    alignItems: 'center',
    gap: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  menu: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  menuItemPressed: {
    opacity: 0.85,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCopy: {
    flex: 1,
    gap: 2,
  },
});
