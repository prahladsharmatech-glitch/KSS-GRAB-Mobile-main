import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import {
  Home,
  Grid,
  ShoppingBag,
  Clock,
  User,
  Store,
  Package,
  Bike,
  Navigation,
  ShieldCheck,
  Users,
  TrendingUp,
} from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { AdminBottomNav } from './admin/AdminBottomNav';

export const MobileBottomNav: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { role } = useAuth();
  const { totalItems } = useCart();
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  // 1. If currently inside Admin Portal screens -> render dedicated AdminBottomNav at screen bottom
  if (pathname.startsWith('/admin')) {
    return <AdminBottomNav />;
  }

  const getTabs = (): { key: string; label: string; icon: any; route: string; badge?: number }[] => {
    // 2. If currently inside Seller Portal screens
    if (pathname.startsWith('/seller')) {
      return [
        { key: 'dash', label: 'Dashboard', icon: Store, route: '/seller' },
        { key: 'products', label: 'Products', icon: Package, route: '/seller/products' },
        { key: 'orders', label: 'Orders', icon: ShoppingBag, route: '/seller/orders' },
        { key: 'categories', label: 'Categories', icon: Grid, route: '/seller/categories' },
        { key: 'profile', label: 'Store Profile', icon: User, route: '/seller/profile' },
      ];
    }

    // 3. If currently inside Rider Portal screens
    if (pathname.startsWith('/rider')) {
      return [
        { key: 'dash', label: 'Dashboard', icon: Bike, route: '/rider' },
        { key: 'active', label: 'Active Task', icon: Navigation, route: '/rider/active' },
        { key: 'history', label: 'History', icon: Clock, route: '/rider/history' },
        { key: 'attendance', label: 'Attendance', icon: ShieldCheck, route: '/rider/attendance' },
        { key: 'profile', label: 'Rider Profile', icon: User, route: '/rider/profile' },
      ];
    }

    // 4. Default Customer Portal Tabs (Home | Categories | Trending | Profile - 1:1 matching PDF reference)
    return [
      { key: 'home', label: 'Home', icon: Home, route: '/customer' },
      { key: 'categories', label: 'Categories', icon: Grid, route: '/customer/categories' },
      { key: 'trending', label: 'Trending', icon: TrendingUp, route: '/customer/trending' },
      { key: 'profile', label: 'Profile', icon: User, route: '/customer/profile' },
    ];
  };

  const tabs = getTabs();

  return (
    <View style={styles.navBar}>
      {tabs.map((tab) => {
        const IconComponent = tab.icon;
        const isActive =
          tab.route === '/customer'
            ? pathname === '/customer' || pathname === '/'
            : tab.route === '/seller' || tab.route === '/rider'
            ? pathname === tab.route
            : pathname === tab.route || pathname.startsWith(tab.route);

        return (
          <Pressable
            key={tab.key}
            style={styles.tabItem}
            onPress={() => router.push(tab.route as any)}
          >
            <View style={[styles.iconPill, isActive && styles.activePill]}>
              <IconComponent
                size={20}
                color={isActive ? '#0066FF' : '#64748B'}
              />
              {tab.badge && tab.badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{tab.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.tabLabel, isActive && styles.activeLabel]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.8)',
    alignItems: 'center',
    justifyContent: 'space-around',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    ...SHADOWS.md,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  activePill: {
    backgroundColor: '#EFF6FF',
  },
  tabLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  activeLabel: {
    color: '#0066FF',
    fontWeight: '800',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
});
