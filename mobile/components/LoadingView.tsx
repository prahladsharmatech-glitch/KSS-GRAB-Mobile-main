import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../constants/theme';

export const LoadingView: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <View style={styles.container}>
    <ActivityIndicator size="large" color={COLORS.primary} />
    <Text style={styles.text}>{message}</Text>
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
  text: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
});
