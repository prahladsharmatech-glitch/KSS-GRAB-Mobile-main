import React, { useState, useEffect, useCallback } from 'react';
import { get } from '../../services/api';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Modal,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import {
  Clock,
  CheckCircle2,
  IndianRupee,
  TrendingUp,
  MapPin,
  Calendar,
  ChevronRight,
  X,
  Award,
  Zap,
  Check,
} from 'lucide-react-native';
import { useToast } from '../../context/ToastContext';

interface HistoryRecord {
  id: string;
  orderId: string;
  time: string;
  date: string;
  store: string;
  locality: string;
  distanceKm: number;
  durationMins: number;
  baseFare: number;
  surge: number;
  tip: number;
  totalPayout: number;
  status: 'DELIVERED' | 'CANCELLED';
  itemsCount: number;
}

const RIDER_HISTORY_DATA: HistoryRecord[] = [];

import { formatDisplayOrderId } from '../../utils/orderUtils';

// Utility to map backend order to HistoryRecord
function mapOrderToHistory(o: any, idx: number): HistoryRecord {
  const total = Number(o.total_amount || o.total || o.totalAmount || 0);
  const payout = Math.max(30, Math.round(total * 0.3));
  const createdAt = o.created_at ? new Date(o.created_at) : new Date();
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const dateLabel = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : 'This Week';
  const timeLabel = createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const items = Array.isArray(o.items || o.order_items) ? (o.items || o.order_items) : [];
  return {
    id: String(idx + 1),
    orderId: formatDisplayOrderId(o),
    time: timeLabel,
    date: dateLabel,
    store: o.store_name || 'Grabit Dark Store',
    locality: o.delivery_address || o.address || 'Delivery Address',
    distanceKm: Number(o.distance_km || 2.0),
    durationMins: Number(o.duration_mins || 12),
    baseFare: Math.round(payout * 0.6),
    surge: Math.round(payout * 0.2),
    tip: Math.round(payout * 0.2),
    totalPayout: payout,
    status: String(o.status || '').toLowerCase() === 'delivered' ? 'DELIVERED' : 'CANCELLED',
    itemsCount: items.length || 1,
  };
}


export default function RiderHistoryScreen() {
  const { showToast } = useToast();
  const [selectedFilter, setSelectedFilter] = useState<'Today' | 'Yesterday' | 'This Week'>('Today');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<HistoryRecord | null>(null);
  const [historyData, setHistoryData] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await get('/delivery/history').catch(() => null);
      if (res && Array.isArray(res) && res.length > 0) {
        setHistoryData(res.map(mapOrderToHistory));
      } else if (res && Array.isArray(res?.orders) && res.orders.length > 0) {
        setHistoryData(res.orders.map(mapOrderToHistory));
      } else {
        // No history yet — show empty state
        setHistoryData([]);
      }
    } catch {
      setHistoryData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filteredData = historyData.filter((item) => {
    if (selectedFilter === 'Today') return item.date === 'Today';
    if (selectedFilter === 'Yesterday') return item.date === 'Yesterday';
    return true; // This Week
  });

  const totalEarnings = filteredData.reduce((acc, item) => acc + item.totalPayout, 0);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  return (
    <View style={styles.container}>
      {/* All 4 Metrics in a Single Horizontal Line of Cards */}
      <View style={styles.kpiRowContainer}>
        <View style={styles.kpiRowCard}>
          <View style={styles.kpiRowHeader}>
            <CheckCircle2 size={12} color="#0066FF" style={{ marginRight: 3 }} />
            <Text style={styles.kpiRowLabel} numberOfLines={1}>Completed</Text>
          </View>
          <Text style={styles.kpiRowValue}>{filteredData.length}</Text>
        </View>

        <View style={styles.kpiRowCard}>
          <View style={styles.kpiRowHeader}>
            <IndianRupee size={12} color="#10B981" style={{ marginRight: 3 }} />
            <Text style={styles.kpiRowLabel} numberOfLines={1}>Earned</Text>
          </View>
          <Text style={[styles.kpiRowValue, { color: '#059669' }]}>₹{totalEarnings}</Text>
        </View>

        <View style={styles.kpiRowCard}>
          <View style={styles.kpiRowHeader}>
            <X size={12} color="#EF4444" style={{ marginRight: 3 }} />
            <Text style={styles.kpiRowLabel} numberOfLines={1}>Failed</Text>
          </View>
          <Text style={[styles.kpiRowValue, { color: '#EF4444' }]}>0</Text>
        </View>

        <View style={styles.kpiRowCard}>
          <View style={styles.kpiRowHeader}>
            <Zap size={12} color="#F59E0B" style={{ marginRight: 3 }} />
            <Text style={styles.kpiRowLabel} numberOfLines={1}>Returned</Text>
          </View>
          <Text style={[styles.kpiRowValue, { color: '#F59E0B' }]}>0</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['Today', 'Yesterday', 'This Week'] as const).map((filter) => (
          <Pressable
            key={filter}
            style={[styles.filterChip, selectedFilter === filter && styles.filterChipActive]}
            onPress={() => setSelectedFilter(filter)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedFilter === filter && styles.filterChipTextActive,
              ]}
            >
              {filter}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Delivery Logs List */}
      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => setSelectedItem(item)}>
            <View style={styles.cardHeader}>
              <View style={styles.orderIdBox}>
                <Text style={styles.orderId}>{item.orderId}</Text>
                <Text style={styles.timeTag}>
                  {item.time} • {item.itemsCount} Items
                </Text>
              </View>
              <View style={styles.payoutBadge}>
                <Text style={styles.payoutValue}>₹{item.totalPayout}</Text>
              </View>
            </View>

            <View style={styles.routeBox}>
              <View style={styles.routeLine}>
                <MapPin size={14} color={COLORS.primary} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {item.locality}
                </Text>
              </View>
              <Text style={styles.distanceBadge}>
                {item.distanceKm} km • {item.durationMins} mins
              </Text>
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.badgeGroup}>
                <View style={styles.deliveredBadge}>
                  <CheckCircle2 size={12} color={COLORS.success} />
                  <Text style={styles.deliveredText}>Completed</Text>
                </View>
              </View>
              <ChevronRight size={16} color={COLORS.textMuted} />
            </View>
          </Pressable>
        )}
      />

      {/* Item Detail Modal */}
      <Modal visible={!!selectedItem} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trip Details - {selectedItem?.orderId}</Text>
              <Pressable style={styles.closeBtn} onPress={() => setSelectedItem(null)}>
                <X size={20} color={COLORS.text} />
              </Pressable>
            </View>

            {selectedItem && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalBody}>
                  <View style={styles.payoutHeaderBanner}>
                    <Text style={styles.bannerLabel}>Total Payout Earned</Text>
                    <Text style={styles.bannerAmount}>₹{selectedItem.totalPayout}</Text>
                  </View>

                  <Text style={styles.breakdownHeading}>Earnings Breakdown</Text>

                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Base Order Fare</Text>
                    <Text style={styles.breakdownVal}>₹{selectedItem.baseFare}</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Peak Surge Bonus</Text>
                    <Text style={styles.breakdownVal}>+₹{selectedItem.surge}</Text>
                  </View>

                  <View style={styles.divider} />

                  <Text style={styles.breakdownHeading}>Trip Info</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Dark Store:</Text>
                    <Text style={styles.infoVal}>{selectedItem.store}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Drop Location:</Text>
                    <Text style={styles.infoVal}>{selectedItem.locality}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Distance & Time:</Text>
                    <Text style={styles.infoVal}>
                      {selectedItem.distanceKm} km ({selectedItem.durationMins} Mins)
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  kpiRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  kpiRowCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginHorizontal: 3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  kpiRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  kpiRowLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  kpiRowValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginVertical: SPACING.xs,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.xs,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 13,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  orderIdBox: {},
  orderId: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  timeTag: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  payoutBadge: {
    backgroundColor: COLORS.successLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  payoutValue: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.success,
  },
  routeBox: {
    backgroundColor: '#F9FAFB',
    padding: 8,
    borderRadius: 8,
    marginVertical: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  routeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 6,
    flex: 1,
  },
  distanceBadge: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginRight: 6,
  },
  deliveredText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.success,
    marginLeft: 4,
  },
  tipBadge: {
    backgroundColor: COLORS.warningLight,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  tipBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.warning,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    paddingVertical: SPACING.md,
  },
  payoutHeaderBanner: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  bannerLabel: {
    fontSize: 12,
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  bannerAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginTop: 2,
  },
  breakdownHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  breakdownLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  breakdownVal: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  breakdownValHighlight: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.success,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    width: 120,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  infoVal: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
});

