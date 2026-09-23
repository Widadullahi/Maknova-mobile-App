import { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowTurnBackwardIcon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { AppText } from './AppText';
import { colors, spacing } from '../theme';

const DEFAULT_PAD_HEIGHT = 200;

export function SignaturePad({ height = DEFAULT_PAD_HEIGHT, onChange, resetSignal = 0, value = [] }) {
  const [paths, setPaths] = useState(value);
  const [currentPath, setCurrentPath] = useState('');
  const currentPointsRef = useRef('');
  const hasMountedRef = useRef(false);

  useEffect(() => {
    setPaths(value || []);
    setCurrentPath('');
    currentPointsRef.current = '';
  }, [resetSignal]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    onChange?.(paths);
  }, [onChange, paths]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        currentPointsRef.current = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        setCurrentPath(currentPointsRef.current);
      },
      onPanResponderMove: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        currentPointsRef.current += ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        setCurrentPath(currentPointsRef.current);
      },
      onPanResponderRelease: () => {
        if (!currentPointsRef.current) return;
        const completedPath = currentPointsRef.current;
        setPaths((current) => [...current, completedPath]);
        currentPointsRef.current = '';
        setCurrentPath('');
      },
    })
  ).current;

  function handleClear() {
    setPaths([]);
    setCurrentPath('');
    currentPointsRef.current = '';
  }

  function handleUndo() {
    setPaths((current) => {
      return current.slice(0, -1);
    });
  }

  const isEmpty = paths.length === 0 && !currentPath;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.pad, { height }]} {...panResponder.panHandlers}>
        <Svg height={height} width="100%" style={StyleSheet.absoluteFill}>
          {paths.map((d, index) => (
            <Path key={index} d={d} stroke={colors.text} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {currentPath ? (
            <Path d={currentPath} stroke={colors.text} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
        </Svg>

        {isEmpty ? (
          <View pointerEvents="none" style={styles.placeholder}>
            <AppText muted style={styles.placeholderText}>Sign here with your finger</AppText>
          </View>
        ) : null}

        <View pointerEvents="none" style={styles.baseline} />
      </View>

      <View style={styles.actionsRow}>
        <Pressable accessibilityRole="button" disabled={!paths.length} onPress={handleUndo} style={styles.actionButton}>
          <HugeiconsIcon icon={ArrowTurnBackwardIcon} size={16} color={paths.length ? colors.text : colors.textMuted} />
          <AppText style={[styles.actionText, !paths.length && styles.actionTextDisabled]}>Undo</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={isEmpty} onPress={handleClear} style={styles.actionButton}>
          <HugeiconsIcon icon={Cancel01Icon} size={16} color={!isEmpty ? colors.danger : colors.textMuted} />
          <AppText style={[styles.actionText, !isEmpty && styles.actionTextDanger, isEmpty && styles.actionTextDisabled]}>
            Clear
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  pad: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 13,
  },
  baseline: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    height: 1,
    backgroundColor: colors.border,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  actionText: {
    color: colors.text,
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
  },
  actionTextDanger: {
    color: colors.danger,
  },
  actionTextDisabled: {
    color: colors.textMuted,
  },
});
