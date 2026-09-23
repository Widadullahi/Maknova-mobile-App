import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Add01Icon,
  BubbleChatIcon,
  CheckmarkCircle02Icon,
  Megaphone01Icon,
  Pin02Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../context/AuthContext';
import {
  acknowledgeAnnouncement,
  fetchAnnouncements,
  fetchConversations,
  fetchGroups,
} from '../../api/communication';
import { colors, spacing } from '../../theme';

const TABS = [
  { key: 'chats', label: 'Chats' },
  { key: 'groups', label: 'Groups' },
  { key: 'announcements', label: 'Announcements' },
];

function timeAgo(value) {
  if (!value) return '';
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function CommunicationHubScreen({ navigation }) {
  const { user } = useAuth();
  const canBroadcast = ['estate_manager', 'admin', 'super_admin'].includes(user?.role);
  const [tab, setTab] = useState('chats');
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [conversationData, groupData, announcementData] = await Promise.all([
        fetchConversations().catch(() => ({ conversations: [] })),
        fetchGroups().catch(() => ({ groups: [] })),
        fetchAnnouncements().catch(() => ({ announcements: [] })),
      ]);
      setConversations(conversationData.conversations || []);
      setGroups(groupData.groups || []);
      setAnnouncements(announcementData.announcements || []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  async function handleAcknowledge(announcementId) {
    try {
      await acknowledgeAnnouncement(announcementId);
      setAnnouncements((current) =>
        current.map((item) => (item.id === announcementId ? { ...item, acknowledgedByMe: true, acknowledgedCount: item.acknowledgedCount + 1 } : item))
      );
    } catch (error) {
      Alert.alert('Acknowledge', error.message);
    }
  }

  const needle = search.trim().toLowerCase();
  const filteredConversations = conversations.filter((item) => {
    if (!needle) return true;
    const title = item.title || item.participants?.find((p) => p.userId !== user?.id)?.fullName || '';
    return title.toLowerCase().includes(needle);
  });
  const filteredGroups = groups.filter((item) => !needle || item.name.toLowerCase().includes(needle));
  const filteredAnnouncements = announcements.filter((item) => !needle || `${item.title} ${item.body}`.toLowerCase().includes(needle));
  const pinnedAnnouncement = announcements.find((item) => item.pinned);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <AppText style={styles.title}>Communication Hub</AppText>
        <TextField placeholder="Search chats, groups, announcements" value={search} onChangeText={setSearch} />
      </View>

      <View style={styles.quickActions}>
        <Button
          icon={Add01Icon}
          title="New message"
          onPress={() => navigation.navigate('NewMessage')}
        />
        {canBroadcast ? (
          <Button
            icon={Megaphone01Icon}
            title="Broadcast"
            variant="secondary"
            onPress={() => navigation.navigate('CreateAnnouncement')}
          />
        ) : null}
      </View>

      {pinnedAnnouncement ? (
        <Pressable style={styles.pinnedCard} onPress={() => setTab('announcements')}>
          <HugeiconsIcon icon={Pin02Icon} size={16} color={colors.primary} />
          <View style={styles.pinnedCopy}>
            <AppText style={styles.pinnedTitle}>{pinnedAnnouncement.title}</AppText>
            <AppText muted numberOfLines={1} style={styles.pinnedBody}>{pinnedAnnouncement.body}</AppText>
          </View>
          {!pinnedAnnouncement.acknowledgedByMe ? (
            <Pressable onPress={() => handleAcknowledge(pinnedAnnouncement.id)} style={styles.ackButton}>
              <AppText style={styles.ackButtonText}>Acknowledge</AppText>
            </Pressable>
          ) : (
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} color={colors.success} />
          )}
        </Pressable>
      ) : null}

      <View style={styles.tabRow}>
        {TABS.map((item) => (
          <Pressable key={item.key} onPress={() => setTab(item.key)} style={[styles.tabButton, tab === item.key && styles.tabButtonActive]}>
            <AppText style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</AppText>
          </Pressable>
        ))}
      </View>

      {tab === 'chats' ? (
        <FlatList
          contentContainerStyle={styles.list}
          data={filteredConversations}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <EmptyState icon={BubbleChatIcon} title={isLoading ? 'Loading chats' : 'No conversations yet'} body="Start a new message to begin chatting." />
          }
          renderItem={({ item }) => {
            const other = item.participants?.find((p) => p.userId !== user?.id);
            const title = item.title || other?.fullName || 'Conversation';
            return (
              <Pressable
                style={styles.row}
                onPress={() => navigation.navigate('Chat', { mode: 'conversation', conversationId: item.id, title })}
              >
                <View style={styles.rowIconWrap}>
                  <HugeiconsIcon icon={BubbleChatIcon} size={18} color={colors.primary} />
                </View>
                <View style={styles.rowCopy}>
                  <AppText style={styles.rowTitle}>{title}</AppText>
                  <AppText muted numberOfLines={1} style={styles.rowSubtitle}>
                    {item.lastMessage ? `${item.lastMessage.senderName}: ${item.lastMessage.body}` : 'No messages yet'}
                  </AppText>
                </View>
                {item.unreadCount > 0 ? <StatusChip label={String(item.unreadCount)} tone="warning" /> : null}
              </Pressable>
            );
          }}
        />
      ) : null}

      {tab === 'groups' ? (
        <FlatList
          contentContainerStyle={styles.list}
          data={filteredGroups}
          keyExtractor={(item) => item.groupKey}
          ListEmptyComponent={
            <EmptyState icon={UserGroupIcon} title={isLoading ? 'Loading groups' : 'No groups available'} body="Community groups appear once you're linked to an estate." />
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('Chat', { mode: 'group', estateId: item.estateId, groupKey: item.groupKey, title: item.name })}
            >
              <View style={styles.rowIconWrap}>
                <HugeiconsIcon icon={UserGroupIcon} size={18} color={colors.primary} />
              </View>
              <View style={styles.rowCopy}>
                <AppText style={styles.rowTitle}>{item.name}</AppText>
                <AppText muted numberOfLines={1} style={styles.rowSubtitle}>
                  {item.lastMessage ? `${item.lastMessage.senderName}: ${item.lastMessage.body}` : 'No messages yet'}
                </AppText>
              </View>
            </Pressable>
          )}
        />
      ) : null}

      {tab === 'announcements' ? (
        <FlatList
          contentContainerStyle={styles.list}
          data={filteredAnnouncements}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <EmptyState icon={Megaphone01Icon} title={isLoading ? 'Loading announcements' : 'No announcements yet'} body="Estate-wide announcements will appear here." />
          }
          renderItem={({ item }) => (
            <View style={styles.announcementCard}>
              <View style={styles.announcementHeader}>
                <StatusChip label={item.category} tone="info" />
                {item.pinned ? <HugeiconsIcon icon={Pin02Icon} size={14} color={colors.primary} /> : null}
                <AppText muted style={styles.announcementAge}>{timeAgo(item.createdAt)}</AppText>
              </View>
              <AppText style={styles.rowTitle}>{item.title}</AppText>
              <AppText muted style={styles.announcementBody}>{item.body}</AppText>
              <View style={styles.announcementFooter}>
                <AppText muted style={styles.announcementMeta}>By {item.creatorName} · {item.acknowledgedCount} acknowledged</AppText>
                {!item.acknowledgedByMe ? (
                  <Pressable onPress={() => handleAcknowledge(item.id)} style={styles.ackButton}>
                    <AppText style={styles.ackButtonText}>Acknowledge</AppText>
                  </Pressable>
                ) : (
                  <StatusChip label="Acknowledged" tone="success" />
                )}
              </View>
            </View>
          )}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    color: colors.text,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 22,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  pinnedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  pinnedCopy: {
    flex: 1,
    gap: 2,
  },
  pinnedTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
  },
  pinnedBody: {
    fontSize: 12,
  },
  ackButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  ackButtonText: {
    color: colors.primary,
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.onPrimary,
  },
  list: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    paddingBottom: 140,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  rowIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
  },
  rowSubtitle: {
    fontSize: 12,
  },
  announcementCard: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  announcementAge: {
    marginLeft: 'auto',
    fontSize: 11,
  },
  announcementBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  announcementFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  announcementMeta: {
    fontSize: 11,
  },
});
