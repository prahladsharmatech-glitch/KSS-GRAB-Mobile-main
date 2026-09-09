import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Package, Truck, Wallet, X, ChevronRight, Bell } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import {
  getRealUserNotifications,
  dismissNotification,
  clearAllNotifications,
  markNotificationAsRead,
  UserNotification,
} from '../utils/userNotifications';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({ visible, onClose }) => {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);

  const loadNotifs = useCallback(async () => {
    const data = await getRealUserNotifications(user?.phone);
    setNotifications(data);
  }, [user?.phone]);

  useEffect(() => {
    if (visible) {
      loadNotifs();
    }
  }, [visible, loadNotifs]);

  const handleClearAll = async () => {
    await clearAllNotifications(user?.phone);
    setNotifications([]);
  };

  const handleDismiss = async (id: string) => {
    await dismissNotification(id, user?.phone);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleItemPress = async (item: UserNotification) => {
    await markNotificationAsRead(item.id);
    onClose();
    if (item.link) {
      router.push(item.link as any);
    } else {
      router.push('/customer/orders' as any);
    }
  };

  const handleViewAll = () => {
    onClose();
    router.push('/customer/notifications' as any);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header Row: Title, Clear All, and Circular Close (X) button */}
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Notifications</Text>

            <View style={styles.headerActionsGroup}>
              {notifications.length > 0 && (
                <Pressable style={styles.clearAllBtn} onPress={handleClearAll}>
                  <Text style={styles.clearAllText}>Clear all</Text>
                </Pressable>
              )}

              <Pressable style={styles.closeBtnCircle} onPress={onClose}>
                <X size={16} color="#0F172A" />
              </Pressable>
            </View>
          </View>

          {/* Scrollable Notifications List */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Bell size={36} color="#94A3B8" style={{ marginBottom: 10 }} />
                <Text style={styles.emptyTitle}>No notifications yet</Text>
                <Text style={styles.emptySub}>
                  When you place an order, live delivery tracking and order status updates will appear here.
                </Text>
              </View>
            ) : (
              notifications.map((item) => {
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

                    {/* Right Content Column */}
                    <View style={styles.contentCol}>
                      {/* Top line: Title, Time, and Dismiss X button */}
                      <View style={styles.titleRow}>
                        <Text style={styles.notifTitle} numberOfLines={1}>
                          {item.title}
                        </Text>

                        <View style={styles.timeDismissGroup}>
                          <Text style={styles.timeText}>{item.time || 'Just now'}</Text>
                          <Pressable
                            style={styles.dismissBtn}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              handleDismiss(item.id);
                            }}
                            hitSlop={8}
                          >
                            <X size={13} color="#94A3B8" />
                          </Pressable>
                        </View>
                      </View>

                      {/* Message body */}
                      <Text style={styles.messageText}>{item.message}</Text>

                      {/* Status Badge */}
                      <View
                        style={[
                          styles.statusBadgePill,
                          {
                            backgroundColor: item.statusBg || '#EFF6FF',
                          },
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
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {/* Bottom Button: View Full Notifications Center */}
          <Pressable style={styles.viewFullCenterBtn} onPress={handleViewAll}>
            <Text style={styles.viewFullCenterText}>View Full Notifications Center</Text>
            <ChevronRight size={15} color="#0F172A" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: Dimensions.get('window').height * 0.82,
    ...SHADOWS.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearAllBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  closeBtnCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    marginTop: 12,
    marginBottom: 12,
  },
  scrollContent: {
    paddingVertical: 2,
    gap: 10,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    ...SHADOWS.sm,
  },
  notifCardUnread: {
    backgroundColor: '#F8FAFC',
    borderColor: '#BFDBFE',
  },
  iconBadge: {
    width: 38,
    height: 38,
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  notifTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    flexShrink: 1,
    marginRight: 6,
  },
  timeDismissGroup: {
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
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
    lineHeight: 16,
    marginBottom: 6,
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
  viewFullCenterBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewFullCenterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
});
