import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/theme';

export default function Index() {
  const router = useRouter();
  const { user, role, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (user && role === 'seller') {
      router.replace('/seller' as any);
    } else if (user && (role === 'delivery_agent' || role === 'rider')) {
      router.replace('/rider' as any);
    } else if (user && role === 'admin') {
      router.replace('/admin' as any);
    } else {
      router.replace('/customer' as any);
    }
  }, [router, user, role, isLoading]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background }}>
      <ActivityIndicator color={COLORS.primary} />
    </View>
  );
}
