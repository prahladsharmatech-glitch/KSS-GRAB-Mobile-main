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
  LayoutGrid,
  FolderTree,
  Calendar,
  RotateCcw,
  History as HistoryIcon,
} from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { AdminBottomNav } from './admin/AdminBottomNav';
import { get } from '../services/api';

export const MobileBottomNav: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { role } = useAuth();
  const { totalItems } = useCart();
  const [isMounted, setIsMounted] = React.useState(false);
  const [hasActiveDelivery, setHasActiveDelivery] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    if (!pathname.startsWith('/rider')) {
      setHasActiveDelivery(false);
      return;
    }

    let activeMounted = true;
    const checkActiveDelivery = async () => {
      try {
        const res = await get('/delivery/active').catch(() => null);
        if (res && activeMounted) {
          const orders = Array.isArray(res) ? res : (res.orders || []);
          const active = orders.find((o: any) => {
            const st = String(o.status || '').toLowerCase();
            return st !== 'delivered' && st !== 'cancelled' && st !== 'failed_delivery';
          });
          setHasActiveDelivery(!!active);
        } else if (activeMounted) {
          setHasActiveDelivery(false);
        }
      } catch {
        if (activeMounted) setHasActiveDelivery(false);
      }
    };

    checkActiveDelivery();
    const interval = setInterval(checkActiveDelivery, 10000);
    return () => {
      activeMounted = false;
      clearInterval(interval);
    };
  }, [pathname]);

  if (!isMounted) return null;

  // 1. If currently inside Admin Portal screens -> render dedicated AdminBottomNav
  if (pathname.startsWith('/admin')) {
    return <AdminBottomNav />;
  }

  const getTabs = (): { key: string; label: string; icon: any; route: string; badge?: number; hasDotBadge?: boolean }[] => {
    // 1. Rider / Delivery Portal Screens
    if (pathname.startsWith('/rider')) {
      return [
        { key: 'dash', label: 'Dashboard', icon: Home, route: '/rider' },
        { key: 'active', label: 'Active Order', icon: Bike, route: '/rider/active', hasDotBadge: hasActiveDelivery },
        { key: 'attendance', label: 'Attendance', icon: Calendar, route: '/rider/attendance' },
        { key: 'history', label: 'History', icon: RotateCcw, route: '/rider/history' },
        { key: 'profile', label: 'Profile', icon: User, route: '/rider/profile' },
      ];
    }

    // 2. Seller Portal Screens
    if (pathname.startsWith('/seller')) {
      return [
        { key: 'dash', label: 'Dashboard', icon: LayoutGrid, route: '/seller' },
        { key: 'categories', label: 'Categories', icon: FolderTree, route: '/seller/categories' },
        { key: 'products', label: 'Products', icon: Package, route: '/seller/products' },
        { key: 'orders', label: 'Live Orders', icon: ShoppingBag, route: '/seller/orders' },
        { key: 'profile', label: 'Profile', icon: User, route: '/seller/profile' },
      ];
    }

    // 3. Default Customer Portal Tabs
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
            : tab.route === '/seller' || tab.route === '/rider' || tab.route === '/admin'
            ? pathname === tab.route
            : pathname === tab.route || pathname.startsWith(tab.route);

        return (
          <Pressable
            key={tab.key}
            style={styles.tabItem}
            onPress={() => {
              if (!isActive) {
                router.replace(tab.route as any);
              }
            }}
          >
            <View style={styles.iconPill}>
              <IconComponent
                size={22}
                color={isActive ? '#0066FF' : '#71717A'}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              {tab.hasDotBadge && (
                <View style={styles.dotBadge} />
              )}
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
    height: 64,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    alignItems: 'center',
    justifyContent: 'space-around',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingBottom: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
  },
  iconPill: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  dotBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#0066FF',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  tabLabel: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 4,
    fontWeight: '500',
  },
  activeLabel: {
    color: '#0066FF',
    fontWeight: '800',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
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
