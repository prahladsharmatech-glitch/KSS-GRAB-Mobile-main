import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  Package,
  Truck,
  Wallet,
  X,
  CheckCheck,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import {
  getRealUserNotifications,
  dismissNotification,
  clearAllNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  UserNotification,
} from '../../utils/userNotifications';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';

const TABS = ['all', 'active', 'orders', 'promo', 'system'];

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadNotifs = useCallback(async () => {
    const data = await getRealUserNotifications(user?.phone);
    setNotifications(data);
    setIsRefreshing(false);
  }, [user?.phone]);

  useEffect(() => {
    loadNotifs();
  }, [loadNotifs]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadNotifs();
  };

  const handleClearAll = async () => {
    await clearAllNotifications(user?.phone);
    setNotifications([]);
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead(user?.phone);
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleDismiss = async (id: string) => {
    await dismissNotification(id, user?.phone);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleItemPress = async (item: UserNotification) => {
    await markNotificationAsRead(item.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, unread: false } : n))
    );
    if (item.link) {
      router.push(item.link as any);
    } else {
      router.push('/customer/orders' as any);
    }
  };

  const unreadCount = notifications.filter((n) => n.unread).length;
  const filteredNotifications =
    activeTab === 'all'
      ? notifications
      : notifications.filter((n) => (n.category || 'orders') === activeTab);

  return (
    <View style={styles.container}>
      {/* ── TOP HEADER ── */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.backBtnCircle} onPress={() => router.back()}>
            <ArrowLeft size={18} color="#0F172A" />
          </Pressable>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.pageTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
                </View>
              )}
            </View>
            <Text style={styles.pageSubtitle}>Live order tracking & status updates</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          {notifications.length > 0 && (
            <Pressable style={styles.clearAllPill} onPress={handleClearAll}>
              <Text style={styles.clearAllPillText}>Clear all</Text>
            </Pressable>
          )}

          {unreadCount > 0 && (
            <Pressable style={styles.markReadPill} onPress={handleMarkAllRead}>
              <CheckCheck size={14} color="#0071E3" />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#0071E3']} />
        }
      >
        {/* ── NOTIFICATION CARDS LIST ── */}
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Bell size={44} color="#94A3B8" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No notifications in this tab</Text>
            <Text style={styles.emptySub}>
              When you place an order, live delivery updates will appear here in real-time.
            </Text>
            <Pressable style={styles.browseShopBtn} onPress={() => router.push('/customer' as any)}>
              <Text style={styles.browseShopBtnText}>Browse Products & Shop Now</Text>
            </Pressable>
          </View>
        ) : (
          filteredNotifications.map((item) => {
            const isTruck = item.iconType === 'truck';
            const isRefund = item.iconType === 'refund';

            return (
              <Pressable
                key={item.id}
                style={[styles.notifCard, item.unread && styles.notifCardUnread]}
                onPress={() => handleItemPress(item)}
              >
                {/* Left Icon Badge */}
                <View
                  style={[
                    styles.iconBadge,
                    isTruck && styles.iconBadgeTruck,
                    isRefund && styles.iconBadgeRefund,
                  ]}
                >
                  {isTruck ? (
                    <Truck size={18} color="#0071E3" strokeWidth={2.2} />
                  ) : isRefund ? (
                    <Wallet size={18} color="#059669" strokeWidth={2.2} />
                  ) : (
                    <Package size={18} color="#475569" strokeWidth={2.2} />
                  )}
                </View>

                {/* Right Content */}
                <View style={styles.contentCol}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.title}
                    </Text>

                    <View style={styles.timeDismissRow}>
                      <Text style={styles.timeText}>{item.time || 'Just now'}</Text>
                      <Pressable
                        style={styles.dismissBtn}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          handleDismiss(item.id);
                        }}
                        hitSlop={8}
                      >
                        <X size={14} color="#94A3B8" />
                      </Pressable>
                    </View>
                  </View>

                  <Text style={styles.messageText}>{item.message}</Text>

                  <View style={styles.cardBottomRow}>
                    <View
                      style={[
                        styles.statusBadgePill,
                        { backgroundColor: item.statusBg || '#EFF6FF' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: item.statusColor || '#0071E3' },
                        ]}
                      >
                        {item.statusBadge || '⚡ ~15-20 min'}
                      </Text>
                    </View>

                    <View style={styles.viewDetailsLinkRow}>
                      <Text style={styles.viewDetailsLinkText}>View Details</Text>
                      <ChevronRight size={13} color="#0071E3" />
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  unreadBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0071E3',
  },
  pageSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearAllPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  clearAllPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  markReadPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 100,
    gap: 12,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
    ...SHADOWS.sm,
  },
  notifCardUnread: {
    backgroundColor: '#F8FAFC',
    borderColor: '#BFDBFE',
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  iconBadgeTruck: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
  },
  iconBadgeRefund: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  contentCol: {
    flex: 1,
    minWidth: 0,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    flexShrink: 1,
    marginRight: 8,
  },
  timeDismissRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  dismissBtn: {
    padding: 2,
  },
  messageText: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 17,
    fontWeight: '500',
    marginBottom: 8,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  viewDetailsLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailsLinkText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0071E3',
  },
  emptyContainer: {
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 20,
    ...SHADOWS.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  browseShopBtn: {
    backgroundColor: '#0071E3',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  browseShopBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
});
