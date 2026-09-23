import { Text, StyleSheet } from 'react-native';
import { colors, typography } from '../theme';

export function AppText({ children, variant = 'body', muted = false, style, ...rest }) {
  return (
    <Text style={[styles.base, typography[variant], muted && styles.muted, style]} {...rest}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.text,
    fontFamily: 'DMSans_400Regular',
  },
  muted: {
    color: colors.textMuted,
  },
});
