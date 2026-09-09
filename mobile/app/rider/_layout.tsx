import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { RiderHeader } from '../../components/RiderHeader';

export default function RiderLayout() {
  return (
    <View style={styles.container}>
      <RiderHeader />
      <View style={styles.content}>
        <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="active" />
          <Stack.Screen name="history" />
          <Stack.Screen name="attendance" />
          <Stack.Screen name="performance" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="support" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="profile" />
        </Stack>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
});
