import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { LocationProvider } from '../context/LocationContext';
import { WishlistProvider } from '../context/WishlistContext';
import { CartProvider } from '../context/CartContext';
import { FloatingCartBar } from '../components/FloatingCartBar';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { COLORS } from '../constants/theme';
import { View, StyleSheet, LogBox } from 'react-native';

LogBox.ignoreLogs([
  'Cannot connect to Expo CLI',
  'Console Warning',
  'Require cycle:',
]);
LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <LocationProvider>
            <WishlistProvider>
              <CartProvider>
                <SafeAreaView style={styles.container} edges={['top']}>
                  <StatusBar style="dark" />
                  <View style={styles.content}>
                    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
                      <Stack.Screen name="index" />
                      <Stack.Screen name="login" />
                      <Stack.Screen name="customer/index" />
                      <Stack.Screen name="customer/categories" />
                      <Stack.Screen name="customer/category/[slug]" />
                      <Stack.Screen name="customer/product/[id]" />
                      <Stack.Screen name="customer/cart" />
                      <Stack.Screen name="customer/checkout" />
                      <Stack.Screen name="customer/orders" />
                      <Stack.Screen name="customer/track/[orderId]" />
                      <Stack.Screen name="customer/wishlist" />
                      <Stack.Screen name="customer/profile" />
                      <Stack.Screen name="customer/notifications" />
                      <Stack.Screen name="customer/help" />
                      <Stack.Screen name="customer/deals" />
                      <Stack.Screen name="customer/trending" />
                      <Stack.Screen name="customer/fresh-produce" />
                      <Stack.Screen name="customer/pharmacy" />
                      <Stack.Screen name="customer/chicken-meat" />
                      <Stack.Screen name="customer/search" />
                      <Stack.Screen name="seller/index" />
                      <Stack.Screen name="seller/products" />
                      <Stack.Screen name="seller/orders" />
                      <Stack.Screen name="seller/categories" />
                      <Stack.Screen name="seller/profile" />
                      <Stack.Screen name="rider/index" />
                      <Stack.Screen name="rider/active" />
                      <Stack.Screen name="rider/history" />
                      <Stack.Screen name="rider/attendance" />
                      <Stack.Screen name="rider/performance" />
                      <Stack.Screen name="rider/notifications" />
                      <Stack.Screen name="rider/support" />
                      <Stack.Screen name="rider/settings" />
                      <Stack.Screen name="rider/profile" />
                      <Stack.Screen name="admin/index" />
                      <Stack.Screen name="admin/users" />
                      <Stack.Screen name="admin/orders" />
                      <Stack.Screen name="admin/partners" />
                      <Stack.Screen name="admin/catalog" />
                      <Stack.Screen name="admin/requests" />
                      <Stack.Screen name="admin/map" />
                    </Stack>
                  </View>
                  <FloatingCartBar />
                  <MobileBottomNav />
                </SafeAreaView>
              </CartProvider>
            </WishlistProvider>
          </LocationProvider>
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingBottom: 60,
  },
});
