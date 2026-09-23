import { useState } from 'react';
import { Pressable, TextInput, View, StyleSheet } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons';
import { AppText } from './AppText';
import { colors, spacing } from '../theme';

export function TextField({ label, error, icon: Icon, placeholder, style, secureTextEntry, onFocus, onBlur, ...props }) {
  const [isFocused, setIsFocused] = useState(false);
  const [isHidden, setIsHidden] = useState(true);
  const resolvedPlaceholder = placeholder || (label ? `Enter ${label.toLowerCase()}` : undefined);

  return (
    <View style={[styles.wrapper, style]}>
      {label ? <AppText style={styles.label}>{label}</AppText> : null}
      <View
        style={[
          styles.inputRow,
          isFocused && styles.inputRowFocused,
          error && styles.inputRowError,
        ]}
      >
        {Icon ? (
          <HugeiconsIcon
            icon={Icon}
            size={20}
            color={isFocused ? colors.primary : colors.textMuted}
          />
        ) : null}
        <TextInput
          placeholder={resolvedPlaceholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry ? isHidden : false}
          style={styles.input}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          {...props}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isHidden ? 'Show password' : 'Hide password'}
            hitSlop={4}
            onPress={() => setIsHidden((value) => !value)}
            style={styles.toggle}
          >
            <HugeiconsIcon
              icon={isHidden ? ViewOffIcon : ViewIcon}
              size={18}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <AppText style={styles.error}>{error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  inputRowFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  inputRowError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
  },
  toggle: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: colors.danger,
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
  },
});
