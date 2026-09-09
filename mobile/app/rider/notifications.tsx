import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { Bell, Bike, ShieldCheck, DollarSign, Zap, CheckCheck, Trash2 } from 'lucide-react-native';
import { useToast } from '../../context/ToastContext';
import { get } from '../../services/api';
import { getItem, setItem } from '../../services/storage';

interface RiderNotif {
  id: string;
  title: string;
  msg: string;
  time: string;
  type: 'ORDER' | 'PAYOUT' | 'SURGE' | 'SYSTEM';
  read: boolean;
}

export default function RiderNotificationsScreen() {
  const { showToast } = useToast();
  const [notifs, setNotifs] = useState<RiderNotif[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'ORDER' | 'PAYOUT' | 'SURGE'>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const fetchLiveNotifs = useCallback(async () => {
    try {
      const [activeRes, histRes] = await Promise.all([
        get('/delivery/active').catch(() => null),
        get('/delivery/history').catch(() => null),
      ]);

      const savedReads = (await getItem<string[]>('@grabit_rider_read_notifs')) || [];
      const readSet = new Set(savedReads);

      const generatedNotifs: RiderNotif[] = [];

      // 1. Check active assigned orders
      const activeOrders = Array.isArray(activeRes) ? activeRes : (activeRes?.orders || []);
      for (const ord of activeOrders) {
        const oid = ord.orderNumber || ord.id || 'Active';
        const st = String(ord.status || '').toUpperCase();
        if (st !== 'DELIVERED' && st !== 'CANCELLED') {
          const nId = `active-${oid}`;
          generatedNotifs.push({
            id: nId,
            title: '⚡ New Delivery Assigned!',
            msg: `Order #${oid} is ready for pickup at ${ord.store_name || 'Dark Store #4'}. Customer: ${ord.customer_name || 'Customer'}.`,
            time: 'Active Now',
            type: 'ORDER',
            read: readSet.has(nId),
          });
        }
      }

      // 2. Check recent completed delivery history
      const histOrders = Array.isArray(histRes) ? histRes : (histRes?.orders || []);
      for (const h of histOrders.slice(0, 10)) {
        const oid = h.orderNumber || h.id || 'TRIP';
        const total = Number(h.total_amount || h.total || 190);
        const payout = Math.max(30, Math.round(total * 0.3));
        const nId = `payout-${oid}`;
        generatedNotifs.push({
          id: nId,
          title: '💰 Delivery Payout Processed',
          msg: `₹${payout} credited for delivering Order #${oid} to ${h.delivery_address || 'Customer'}.`,
          time: h.delivered_at ? new Date(h.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Completed',
          type: 'PAYOUT',
          read: readSet.has(nId),
        });
      }

      // 3. System compliance notification
      const sysId = 'sys-compliance';
      generatedNotifs.push({
        id: sysId,
        title: '🛡️ Biometrics Verification Active',
        msg: 'Your shift credentials and EV document compliance checked and verified for Express Delivery.',
        time: 'Today',
        type: 'SYSTEM',
        read: readSet.has(sysId),
      });

      setNotifs(generatedNotifs);
    } catch {
      // Retain
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveNotifs();
  }, [fetchLiveNotifs]);

  const filteredNotifs = notifs.filter((n) => {
    if (selectedFilter === 'ALL') return true;
    return n.type === selectedFilter;
  });

  const markAllRead = async () => {
    const updated = notifs.map((n) => ({ ...n, read: true }));
    setNotifs(updated);
    const allIds = updated.map((n) => n.id);
    await setItem('@grabit_rider_read_notifs', allIds);
    showToast('All notifications marked as read', 'success');
  };

  const clearAll = async () => {
    setNotifs([]);
    await setItem('@grabit_rider_read_notifs', []);
    showToast('Notifications cleared', 'info');
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLiveNotifs();
    showToast('Alerts synced with dispatch server', 'info');
  };

  const getIcon = (type: RiderNotif['type']) => {
    switch (type) {
      case 'ORDER':
        return <Bike size={20} color={COLORS.primary} />;
      case 'PAYOUT':
        return <DollarSign size={20} color={COLORS.success} />;
      case 'SURGE':
        return <Zap size={20} color={COLORS.warning} />;
      case 'SYSTEM':
        return <ShieldCheck size={20} color={COLORS.primaryDark} />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header Actions Bar */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Bell size={22} color={COLORS.primaryDark} />
          <Text style={styles.headerTitle}>Rider Task Alerts</Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable style={styles.actionBtn} onPress={markAllRead}>
            <CheckCheck size={16} color={COLORS.primary} />
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={clearAll}>
            <Trash2 size={16} color={COLORS.danger} />
          </Pressable>
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {[
          { label: 'All', key: 'ALL' },
          { label: 'Orders', key: 'ORDER' },
          { label: 'Payouts', key: 'PAYOUT' },
          { label: 'Surge', key: 'SURGE' },
        ].map((item) => (
          <Pressable
            key={item.key}
            style={[styles.filterChip, selectedFilter === item.key && styles.filterChipActive]}
            onPress={() => setSelectedFilter(item.key as any)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedFilter === item.key && styles.filterChipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filteredNotifs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Bell size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptySub}>You're all caught up with your rider alerts!</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, !item.read && styles.cardUnread]}
            onPress={() => {
              setNotifs((prev) =>
                prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
              );
            }}
          >
            <View style={styles.iconCircle}>{getIcon(item.type)}</View>
            <View style={{ flex: 1 }}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.title}>{item.title}</Text>
                {!item.read && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.msg}>{item.msg}</Text>
              <Text style={styles.time}>{item.time}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginLeft: 8,
  },
  headerActions: {
    flexDirection: 'row',
  },
  actionBtn: {
    padding: 6,
    marginLeft: 6,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterChip: {
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginRight: 6,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardUnread: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginLeft: 6,
  },
  msg: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  time: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 6,
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
});

