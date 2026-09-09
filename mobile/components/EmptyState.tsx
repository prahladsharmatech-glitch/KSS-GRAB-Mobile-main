import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../constants/theme';
import { PackageOpen } from 'lucide-react-native';

interface EmptyStateProps {
  title?: string;
  subtitle?: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No items found',
  subtitle = 'Check back later or try searching for something else.',
  actionText,
  onAction,
}) => (
  <View style={styles.container}>
    <PackageOpen size={64} color={COLORS.textMuted} />
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.subtitle}>{subtitle}</Text>
    {actionText && onAction && (
      <Pressable style={styles.button} onPress={onAction}>
        <Text style={styles.buttonText}>{actionText}</Text>
      </Pressable>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: SPACING.xxl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
