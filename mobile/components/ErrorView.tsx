import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../constants/theme';
import { AlertCircle, RefreshCw } from 'lucide-react-native';

interface ErrorViewProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorView: React.FC<ErrorViewProps> = ({
  message = 'Something went wrong. Please check your connection.',
  onRetry,
}) => (
  <View style={styles.container}>
    <AlertCircle size={48} color={COLORS.danger} />
    <Text style={styles.title}>Error</Text>
    <Text style={styles.message}>{message}</Text>
    {onRetry && (
      <Pressable style={styles.button} onPress={onRetry}>
        <RefreshCw size={18} color="#FFFFFF" style={{ marginRight: SPACING.xs }} />
        <Text style={styles.buttonText}>Try Again</Text>
      </Pressable>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.xl,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  message: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
