import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { colors, spacing } from '../theme';

let subscriber = null;
let queue = [];

function enqueue(alert) {
  queue = [...queue, alert];
  return queue;
}

function dequeue() {
  queue = queue.slice(1);
  return queue;
}

export function showAlert(title, message, buttons) {
  if (subscriber) {
    subscriber(enqueue({ title, message, buttons: buttons || [] }));
  } else {
    queue.push({ title, message, buttons: buttons || [] });
  }
}

export function AlertHost() {
  const [alerts, setAlerts] = useState(queue);

  useEffect(() => {
    subscriber = setAlerts;
    if (queue.length > 0) setAlerts(queue);
    return () => {
      subscriber = null;
    };
  }, []);

  const current = alerts[0];
  if (!current) return null;

  const cancel = current.buttons.find((button) => button && button.style === 'cancel');
  const primary = current.buttons.find((button) => button && button.style !== 'cancel') || current.buttons[0];

  function dismiss(action) {
    if (action && typeof action.onPress === 'function') {
      action.onPress();
    }
    setAlerts(dequeue());
  }

  return (
    <Modal animationType="fade" transparent visible>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {current.title ? <AppText style={styles.title}>{current.title}</AppText> : null}
          {current.message ? <AppText style={styles.message}>{current.message}</AppText> : null}
          <View style={styles.actions}>
            {cancel ? (
              <View style={styles.actionRow}>
                <View style={styles.half}>
                  <Button title={cancel.text || 'Cancel'} onPress={() => dismiss(cancel)} variant="secondary" />
                </View>
                {primary ? (
                  <View style={styles.half}>
                    <Button title={primary.text || 'OK'} onPress={() => dismiss(primary)} />
                  </View>
                ) : null}
              </View>
            ) : (
              <Button title={(primary && primary.text) || 'OK'} onPress={() => dismiss(primary)} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontFamily: 'DMSans_700Bold',
    fontSize: 17,
  },
  message: {
    color: colors.textMuted,
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
});