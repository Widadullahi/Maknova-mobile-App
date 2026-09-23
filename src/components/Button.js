import { Pressable, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { AppText } from './AppText';
import { colors, spacing } from '../theme';

export function Button({ title, onPress, variant = 'primary', disabled = false, icon: Icon }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={styles.content}>
        {Icon ? (
          <HugeiconsIcon
            icon={Icon}
            size={20}
            color={variant === 'secondary' ? colors.text : colors.onPrimary}
          />
        ) : null}
        <AppText style={[styles.text, variant === 'secondary' && styles.secondaryText]}>{title}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.86,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    color: colors.onPrimary,
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
  },
  secondaryText: {
    color: colors.text,
  },
});
