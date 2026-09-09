import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  Package,
  Lightbulb,
  MapPin,
} from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { SHADOWS } from '../../constants/theme';

export interface AdminTabItem {
  id: string;
  label: string;
  icon: any;
  route: string;
  count?: number;
}

interface AdminBottomNavProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  ordersCount?: number;
  partnersCount?: number;
  productsCount?: number;
  suggestionsCount?: number;
}

export const AdminBottomNav: React.FC<AdminBottomNavProps> = ({
  activeTab,
  onTabChange,
  ordersCount,
  partnersCount,
  productsCount,
  suggestionsCount,
}) => {
  const router = useRouter();
  const pathname = usePathname();

  const NAV_ITEMS: AdminTabItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
      route: '/admin',
    },
    {
      id: 'orders',
      label: 'Live Orders',
      icon: ShoppingBag,
      route: '/admin/orders',
      count: ordersCount,
    },
    {
      id: 'partners',
      label: 'Partners',
      icon: Users,
      route: '/admin/partners',
      count: partnersCount,
    },
    {
      id: 'products',
      label: 'Catalog',
      icon: Package,
      route: '/admin/catalog',
      count: productsCount,
    },
    {
      id: 'suggestions',
      label: 'Customer Requests',
      icon: Lightbulb,
      route: '/admin/requests',
      count: suggestionsCount,
    },
    {
      id: 'security',
      label: 'Store Map',
      icon: MapPin,
      route: '/admin/map',
    },
  ];

  const handlePress = (item: AdminTabItem) => {
    if (onTabChange) {
      onTabChange(item.id);
    } else {
      router.push(item.route as any);
    }
  };

  const getIsActive = (item: AdminTabItem) => {
    if (activeTab) {
      return activeTab === item.id;
    }
    if (item.id === 'overview') {
      return pathname === '/admin' || pathname === '/admin/';
    }
    if (item.id === 'partners') {
      return pathname === '/admin/partners' || pathname === '/admin/users';
    }
    return pathname === item.route || pathname.startsWith(item.route);
  };

  return (
    <View style={styles.navBar}>
      {NAV_ITEMS.map((tab) => {
        const IconComponent = tab.icon;
        const isActive = getIsActive(tab);

        return (
          <Pressable
            key={tab.id}
            style={styles.tabItem}
            onPress={() => handlePress(tab)}
            android_ripple={{ color: 'rgba(0, 113, 227, 0.1)', borderless: true }}
          >
            <View style={styles.iconContainer}>
              <IconComponent
                size={19}
                color={isActive ? '#0071E3' : '#94A3B8'}
                strokeWidth={isActive ? 2.5 : 2}
              />
              {tab.count !== undefined && tab.count > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {tab.count > 99 ? '99+' : tab.count}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[styles.tabLabel, isActive && styles.activeLabel]}
              numberOfLines={1}
            >
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
    borderTopColor: '#E2E8F0',
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
    paddingVertical: 4,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 24,
  },
  tabLabel: {
    fontSize: 9.5,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '600',
    textAlign: 'center',
  },
  activeLabel: {
    color: '#0071E3',
    fontWeight: '800',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 7,
    paddingHorizontal: 3.5,
    paddingVertical: 1,
    minWidth: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
});

export default AdminBottomNav;
