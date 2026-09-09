import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocation } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import { MapPin, Search, User, ShieldAlert, Store, Bike, Bell, Zap, ShoppingBag } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { NotificationModal } from './NotificationModal';
import { getRealUserNotifications } from '../utils/userNotifications';

export const Header: React.FC = () => {
  const router = useRouter();
  const { currentAddress, fetchCurrentLocation, isFetchingLocation } = useLocation();
  const { role, switchRole, user } = useAuth();
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    getRealUserNotifications(user?.phone).then((list) => {
      setUnreadCount(list.filter((n) => n.unread).length);
    });
  }, [user?.phone, isNotifModalOpen]);

  return (
    <View style={styles.container}>
      {/* Top Brand & Workspace Row */}
      <View style={styles.brandRow}>
        <Pressable style={styles.brand} onPress={() => router.push('/customer' as any)}>
          <View style={styles.brandIcon}>
            <Zap size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.brandText}>GrabIt</Text>
        </Pressable>

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.roleBadge, role === 'seller' && styles.activeRole]}
            onPress={() => {
              switchRole('seller');
              router.push('/seller' as any);
            }}
          >
            <Store size={15} color={role === 'seller' ? '#FFFFFF' : COLORS.textSecondary} />
          </Pressable>

          <Pressable
            style={[styles.roleBadge, role === 'rider' && styles.activeRole]}
            onPress={() => {
              switchRole('rider');
              router.push('/rider' as any);
            }}
          >
            <Bike size={15} color={role === 'rider' ? '#FFFFFF' : COLORS.textSecondary} />
          </Pressable>

          <Pressable
            style={[styles.roleBadge, role === 'admin' && styles.activeRole]}
            onPress={() => {
              switchRole('admin');
              router.push('/admin' as any);
            }}
          >
            <ShieldAlert size={15} color={role === 'admin' ? '#FFFFFF' : COLORS.textSecondary} />
          </Pressable>

          <Pressable
            style={styles.circleBtn}
            onPress={() => setIsNotifModalOpen(true)}
          >
            <Bell size={18} color={COLORS.text} />
            {unreadCount > 0 && (
              <View style={styles.unreadDot}>
                <Text style={styles.unreadDotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            style={styles.circleBtn}
            onPress={() => router.push('/customer/profile' as any)}
          >
            <User size={18} color={COLORS.text} />
          </Pressable>
        </View>
      </View>

      {/* Location Bar Pill */}
      <Pressable style={styles.locationBar} onPress={fetchCurrentLocation}>
        <View style={styles.pinCircle}>
          <MapPin size={16} color={COLORS.primary} />
        </View>
        <View style={styles.addressInfo}>
          <Text style={styles.deliveryTitle}>
            DELIVERY IN <Text style={styles.boldTime}>10 MINS</Text>
          </Text>
          <Text style={styles.addressText} numberOfLines={1}>
            {isFetchingLocation ? 'Locating...' : currentAddress.street || 'Set Delivery Location'}
          </Text>
        </View>
      </Pressable>

      {/* Search Input Bar */}
      <Pressable
        style={styles.searchBar}
        onPress={() => router.push('/customer/categories' as any)}
      >
        <Search size={18} color={COLORS.textMuted} style={{ marginRight: SPACING.xs }} />
        <Text style={styles.searchPlaceholder}>Search for milk, butter, chips, snacks...</Text>
      </Pressable>

      <NotificationModal
        visible={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#0066FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    ...SHADOWS.sm,
  },
  brandText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleBadge: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginLeft: 4,
  },
  activeRole: {
    backgroundColor: '#0066FF',
  },
  circleBtn: {
    position: 'relative',
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginLeft: 6,
  },
  unreadDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#0071E3',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  unreadDotText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    marginBottom: SPACING.sm,
  },
  pinCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.xs,
  },
  addressInfo: {
    flex: 1,
  },
  deliveryTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A',
  },
  boldTime: {
    color: '#0066FF',
    fontWeight: '900',
  },
  addressText: {
    fontSize: 12,
    color: '#475569',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  searchPlaceholder: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
});
