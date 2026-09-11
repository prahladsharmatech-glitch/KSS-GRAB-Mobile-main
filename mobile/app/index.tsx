import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../constants/theme';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/customer' as any);
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background }}>
      <ActivityIndicator color={COLORS.primary} />
    </View>
  );
}
