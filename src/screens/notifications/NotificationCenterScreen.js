import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft02Icon, CheckmarkCircle02Icon, Notification03Icon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { colors, spacing } from '../../theme';
import { useNotifications } from '../../context/NotificationsContext';

export function NotificationCenterScreen({ navigation }) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.backButton}>
            <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
          </Pressable>
          <StatusChip label={`${unreadCount} unread`} tone={unreadCount ? 'warning' : 'success'} />
        </View>

        <View style={styles.header}>
          <HugeiconsIcon icon={Notification03Icon} size={28} color={colors.primary} />
          <AppText style={styles.title}>Notifications</AppText>
          <AppText muted style={styles.subtitle}>Push and in-app alerts for payments, maintenance, verification, documents, and reports.</AppText>
        </View>

        <View style={styles.actions}>
          <Button title="Mark all read" onPress={markAllRead} variant="secondary" />
        </View>

        <View style={styles.list}>
          {notifications.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => markRead(item.id)}
              style={[styles.card, !item.isRead && styles.cardUnread]}
            >
              <View style={styles.cardIcon}>
                <HugeiconsIcon
                  icon={item.isRead ? CheckmarkCircle02Icon : Notification03Icon}
                  size={18}
                  color={item.isRead ? colors.success : colors.primary}
                />
              </View>
              <View style={styles.cardCopy}>
                <View style={styles.cardTitleRow}>
                  <AppText style={styles.cardTitle}>{item.title}</AppText>
                  <StatusChip label={item.type || 'info'} tone={item.isRead ? 'neutral' : 'info'} />
                </View>
                <AppText muted style={styles.cardBody}>{item.body}</AppText>
                <AppText muted style={styles.timeText}>{new Date(item.createdAt).toLocaleString()}</AppText>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: 140,
    gap: spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  title: {
    color: colors.text,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 26,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
  },
  actions: {
    gap: spacing.md,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  cardUnread: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  cardCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    color: colors.text,
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
  },
  cardBody: {
    fontSize: 13,
  },
  timeText: {
    fontSize: 11,
  },
});
