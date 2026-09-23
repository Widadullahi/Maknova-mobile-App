import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft02Icon, CheckmarkCircle02Icon, Message01Icon, Wrench01Icon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { TextField } from '../../components/TextField';
import { addMaintenanceUpdate, fetchMaintenanceRequest } from '../../api/maintenance';
import { colors, spacing } from '../../theme';

function statusLabel(status) {
  return String(status || 'open').replace(/_/g, ' ');
}

export function MaintenanceDetailScreen({ route, navigation }) {
  const initialRequest = route.params?.request;
  const [request, setRequest] = useState(initialRequest);
  const [updates, setUpdates] = useState([]);
  const [note, setNote] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadDetail() {
      const numericId = Number(initialRequest?.id);
      if (!Number.isInteger(numericId)) return;
      try {
        const data = await fetchMaintenanceRequest(numericId);
        if (active) {
          setRequest(data.request);
          setUpdates(data.updates || []);
        }
      } catch (error) {
        Alert.alert('Load failed', error.message);
      }
    }
    loadDetail();
    return () => {
      active = false;
    };
  }, [initialRequest?.id]);

  async function handleAddUpdate() {
    if (!note.trim()) {
      Alert.alert('Add a note', 'Write a short update before posting.');
      return;
    }
    const numericId = Number(request.id);
    if (!Number.isInteger(numericId)) return;
    try {
      setIsBusy(true);
      const data = await addMaintenanceUpdate(numericId, { note: note.trim() });
      setUpdates((current) => [...current, data.update || { note: note.trim(), status: request.status, createdAt: new Date().toISOString() }]);
      setNote('');
    } catch (error) {
      Alert.alert('Post failed', error.message);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Screen padded={false}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => navigation.goBack()} style={styles.backButton}>
          <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
        </Pressable>
        <AppText variant="heading">Ticket detail</AppText>
        <View style={styles.backButtonSpacer} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.titleRow}>
              <View style={styles.iconWrap}>
                <HugeiconsIcon icon={Wrench01Icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.titleCopy}>
                <AppText style={styles.title}>{request?.title}</AppText>
                <AppText muted style={styles.meta}>{request?.category} / {request?.priority} priority</AppText>
              </View>
              <StatusChip label={statusLabel(request?.status)} tone={request?.status === 'resolved' ? 'success' : 'warning'} />
            </View>
            <AppText muted style={styles.description}>{request?.description}</AppText>
            <Button icon={CheckmarkCircle02Icon} title="Mark resolved request" variant="secondary" onPress={() => Alert.alert('Manager action', 'Managers can resolve this from the backend/admin workflow.')} />
          </View>

          <View style={styles.section}>
            <AppText variant="heading">Timeline</AppText>
            {updates.map((item, index) => (
              <View key={item.id || index} style={styles.updateRow}>
                <View style={styles.timelineDot} />
                <View style={styles.updateCard}>
                  <AppText style={styles.updateTitle}>{statusLabel(item.status || request?.status)}</AppText>
                  <AppText muted style={styles.updateNote}>{item.note}</AppText>
                  <AppText muted style={styles.meta}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Just now'}</AppText>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <TextField label="Add update" value={note} onChangeText={setNote} placeholder="Add a short note" />
            <Button disabled={isBusy} icon={Message01Icon} onPress={handleAddUpdate} title={isBusy ? 'Posting...' : 'Post update'} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.md, marginBottom: spacing.lg },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  backButtonSpacer: { width: 40 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: 140, gap: spacing.lg },
  card: { gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  titleCopy: { flex: 1, gap: 3 },
  title: { fontFamily: 'DMSans_800ExtraBold', fontSize: 17 },
  meta: { fontSize: 11, textTransform: 'capitalize' },
  description: { lineHeight: 21 },
  section: { gap: spacing.md },
  updateRow: { flexDirection: 'row', gap: spacing.md },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: spacing.md, backgroundColor: colors.primary },
  updateCard: { flex: 1, gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, padding: spacing.md },
  updateTitle: { fontFamily: 'DMSans_700Bold', fontSize: 13, textTransform: 'capitalize' },
  updateNote: { fontSize: 12 },
});
