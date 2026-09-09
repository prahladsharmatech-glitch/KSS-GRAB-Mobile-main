import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Switch, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { get, patch } from '../../services/api';
import { DeliveryAgent } from '../../types';
import { useToast } from '../../context/ToastContext';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import {
  Bike,
  Navigation,
  IndianRupee,
  CheckCircle2,
  ShieldCheck,
  Clock,
  MapPin,
  Award,
  ChevronRight,
  FileText,
  User,
  Zap,
  RefreshCw,
  Fingerprint,
  LogOut,
  Coffee,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';

import { getItem, setItem } from '../../services/storage';

interface ActiveOrder {
  id: string;
  orderNumber?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  store_name?: string;
  total?: number;
  status?: string;
}

export default function RiderDashboardScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const local = localStorage.getItem('@grabit_rider_is_online');
        if (local !== null) return local === 'true';
      }
    } catch {}
    return false;
  });
  const [breakMode, setBreakMode] = useState(false);
  const [rider, setRider] = useState<DeliveryAgent | null>(null);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shiftMinutes, setShiftMinutes] = useState(0);

  // Sync isOnline from AsyncStorage on mount and on status update events
  useEffect(() => {
    const syncStatus = () => {
      getItem<string>('@grabit_rider_is_online')
        .then((val) => {
          if (val !== null) {
            setIsOnline(val === 'true');
          } else if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            const local = localStorage.getItem('@grabit_rider_is_online');
            if (local !== null) setIsOnline(local === 'true');
          }
        })
        .catch(() => {});
    };

    syncStatus();

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('grabit_rider_online_updated', syncStatus);
      return () => {
        if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
          window.removeEventListener('grabit_rider_online_updated', syncStatus);
        }
      };
    }
  }, []);

  const saveOnlineState = useCallback((val: boolean) => {
    setIsOnline(val);
    setItem('@grabit_rider_is_online', String(val)).catch(() => {});
    try {
      if (typeof window !== 'undefined') {
        if (typeof localStorage !== 'undefined' && localStorage.setItem) {
          localStorage.setItem('@grabit_rider_is_online', String(val));
        }
        if (typeof window.dispatchEvent === 'function' && typeof Event === 'function') {
          window.dispatchEvent(new Event('grabit_rider_online_updated'));
        }
      }
    } catch {}
  }, []);

  // Shift timer
  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(() => setShiftMinutes((m) => m + 1), 60000);
    return () => clearInterval(interval);
  }, [isOnline]);

  const formatShiftTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}h ${m}m Active`;
    return `${m}m Active`;
  };

  const fetchData = useCallback(async () => {
    try {
      // Fetch rider profile
      const riderRes = await get('/delivery/agent/me').catch(() => null);
      if (riderRes) {
        const u = riderRes.user || riderRes;
        if (u && (u.id || u.phone)) {
          setRider(u);
          if (u.is_online !== undefined) {
            saveOnlineState(Boolean(u.is_online));
          }
        }
      } else {
        const storedVal = await getItem<string>('@grabit_rider_is_online').catch(() => null);
        if (storedVal === 'true') {
          setIsOnline(true);
        }
      }

      // Fetch active orders assigned to this rider
      const activeRes = await get('/delivery/active').catch(() => null);
      if (activeRes) {
        const orders = Array.isArray(activeRes) ? activeRes : (activeRes.orders || []);
        // Find the first active order assigned to this rider
        const active = orders.find((o: any) => {
          const st = String(o.status || '').toLowerCase();
          return st !== 'delivered' && st !== 'cancelled' && st !== 'failed_delivery';
        });
        setActiveOrder(active || null);
      }
    } catch {
      // no-op — will show empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [saveOnlineState]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  useEffect(() => {
    fetchData();
    // Poll every 10 seconds for new assignments
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleToggleOnline = async (val: boolean) => {
    saveOnlineState(val);
    if (!val) setBreakMode(false);
    try {
      await patch('/delivery/agent/status', { is_online: val });
      await fetchData();
    } catch {
      // Optimistic update already done
    }
    showToast(
      val ? 'Duty Started! You are now receiving orders.' : 'Duty Offline. Order assignment paused.',
      val ? 'success' : 'info'
    );
  };

  const handleBiometricPunch = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        handleToggleOnline(!isOnline);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: isOnline
          ? 'Verify Biometrics to End Shift'
          : 'Verify Biometrics to Punch In',
        fallbackLabel: 'Use PIN',
      });

      if (result.success) {
        handleToggleOnline(!isOnline);
      } else {
        showToast('Biometric verification failed', 'error');
      }
    } catch {
      handleToggleOnline(!isOnline);
    }
  };

  const toggleBreak = () => {
    if (!isOnline) {
      showToast('Punch IN first before taking a break!', 'error');
      return;
    }
    setBreakMode(!breakMode);
    showToast(
      !breakMode ? 'Break Mode Activated (30 Mins max)' : 'Resumed Duty Mode!',
      !breakMode ? 'info' : 'success'
    );
  };

  // Derive avatar initials from real rider name
  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  const riderName = rider?.full_name || rider?.name || 'Karthik Rider';
  const riderId = rider?.partner_id || (rider?.id ? `RDR-${String(rider.id).replace(/-/g, '').slice(0, 4).toUpperCase()}` : 'RDR-700B');
  const todaysEarnings = rider?.todays_earnings ?? 0;
  const completedToday = rider?.completed_deliveries_today ?? 0;
  const rating = rider?.rating ?? 0;

  // Order display values from real API
  const orderDisplay = activeOrder
    ? {
        id: activeOrder.orderNumber || activeOrder.id || '—',
        customerName: activeOrder.customer_name || 'Customer',
        customerPhone: activeOrder.customer_phone || '',
        storeName: activeOrder.store_name || 'Grabit Dark Store',
        dropAddress: activeOrder.delivery_address || 'Delivery Address',
        total: activeOrder.total ?? 0,
      }
    : null;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />}
    >
      {/* 1. DAILY SHIFT & DUTY PUNCH CARD */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View>
            <View style={styles.zoneRow}>
              <MapPin size={13} color="#64748B" style={{ marginRight: 4 }} />
              <Text style={styles.headerSubtitle}>Indiranagar Zone • Shift A</Text>
            </View>
            <Text style={styles.headerTitle}>Daily Shift & Duty Punch</Text>
          </View>
          <View style={[styles.statusBadge, isOnline ? (breakMode ? styles.badgeBreak : styles.badgeOnline) : styles.badgeOffline]}>
            <View style={[styles.badgeDot, { backgroundColor: isOnline ? (breakMode ? '#D97706' : '#10B981') : '#94A3B8' }]} />
            <Text style={[styles.statusBadgeText, isOnline ? (breakMode ? styles.badgeBreakText : styles.badgeOnlineText) : styles.badgeOfflineText]}>
              {isOnline ? (breakMode ? 'ON BREAK' : 'ON DUTY') : 'OFF DUTY'}
            </Text>
          </View>
        </View>

        {/* Punch In / Out Action Buttons */}
        <View style={styles.punchActionContainer}>
          <Pressable
            style={[styles.punchBtn, isOnline ? styles.punchBtnOut : styles.punchBtnIn]}
            onPress={handleBiometricPunch}
          >
            {isOnline ? (
              <LogOut size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
            ) : (
              <Fingerprint size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.punchBtnText}>
              {isOnline ? 'PUNCH OUT OF SHIFT' : 'PUNCH IN (BIOMETRIC)'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.breakBtn, breakMode && styles.breakBtnActive]}
            onPress={toggleBreak}
          >
            <Coffee size={18} color={breakMode ? '#FFFFFF' : '#334155'} style={{ marginRight: 8 }} />
            <Text style={[styles.breakBtnText, breakMode && { color: '#FFFFFF' }]}>
              {breakMode ? 'Resume Duty' : '30 Min Break'}
            </Text>
          </Pressable>
        </View>

        {/* Duty Status Footnote */}
        <View style={styles.dutyFooterRow}>
          <View style={[styles.dutyFooterDot, { backgroundColor: isOnline ? '#10B981' : '#CBD5E1' }]} />
          <Text style={styles.dutyFooterText}>
            {isOnline
              ? (breakMode ? 'Break active • 30 Mins max' : 'Duty Active • Receiving 10-Min Express Orders')
              : 'Shift Offline • Verify Biometrics to Start Shift'}
          </Text>
        </View>
      </View>



      {/* 2. RIDER PROFILE BADGE */}
      <View style={styles.riderBar}>
        <View style={styles.riderBarLeft}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{getInitials(riderName)}</Text>
          </View>
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.riderName}>{riderName}</Text>
            <Text style={styles.riderDetail}>Partner ID: {riderId}</Text>
          </View>
        </View>
        <View style={styles.kycBadge}>
          <ShieldCheck size={14} color="#059669" style={{ marginRight: 4 }} />
          <Text style={styles.kycText}>KYC Verified</Text>
        </View>
      </View>

      {/* 3. ACTIVE TASK BANNER — real data only */}
      {orderDisplay ? (
        <Pressable
          style={styles.activeTaskCard}
          onPress={() => router.push('/rider/active' as any)}
        >
          <View style={styles.activeHeader}>
            <View style={styles.urgentBadge}>
              <Zap size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.urgentBadgeText}>ACTIVE DELIVERY ASSIGNED</Text>
            </View>
            <Text style={styles.activePayout}>₹{orderDisplay.total.toFixed(2)} Payout</Text>
          </View>

          <View style={styles.orderIdRow}>
            <Text style={styles.orderId}>Order #{orderDisplay.id}</Text>
          </View>

          {/* Prominent Customer Name Pill Row */}
          <View style={styles.customerNameCardRow}>
            <User size={15} color="#1D4ED8" style={{ marginRight: 6 }} />
            <Text style={styles.customerNameLabel}>Customer:</Text>
            <Text style={styles.customerNameValue}>{orderDisplay.customerName}</Text>
            {orderDisplay.customerPhone ? (
              <Text style={styles.customerPhoneValue}>({orderDisplay.customerPhone})</Text>
            ) : null}
          </View>

          <View style={styles.routeBox}>
            <View style={styles.routeLineRow}>
              <MapPin size={14} color="#0066FF" style={{ marginRight: 6 }} />
              <Text style={styles.routeText} numberOfLines={1}>
                Pickup: {orderDisplay.storeName}
              </Text>
            </View>
            <View style={styles.routeDivider} />
            <View style={styles.routeLineRow}>
              <MapPin size={14} color="#10B981" style={{ marginRight: 6 }} />
              <Text style={styles.routeText} numberOfLines={2}>
                Drop ({orderDisplay.customerName}): {orderDisplay.dropAddress}
              </Text>
            </View>
          </View>

          <View style={styles.navigateBtn}>
            <Navigation size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.navigateBtnText}>Open Task Navigation & Checklist</Text>
            <ChevronRight size={16} color="#FFFFFF" style={{ marginLeft: 'auto' }} />
          </View>
        </Pressable>
      ) : (
        <View style={styles.noOrderCard}>
          <CheckCircle2 size={28} color="#10B981" />
          <Text style={styles.noOrderTitle}>No Active Delivery</Text>
          <Text style={styles.noOrderSub}>
            {isOnline ? 'You are online. Waiting for new order assignment...' : 'Go online to start receiving orders.'}
          </Text>
          <Pressable style={styles.refreshBtn} onPress={handleRefresh}>
            <RefreshCw size={14} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </Pressable>
        </View>
      )}

      {/* 4. TODAY'S KPI CARDS */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <IndianRupee size={20} color="#0066FF" />
          <Text style={styles.kpiVal}>₹{todaysEarnings}</Text>
          <Text style={styles.kpiLabel}>Today's Payout</Text>
        </View>

        <View style={styles.kpiCard}>
          <CheckCircle2 size={20} color="#10B981" />
          <Text style={styles.kpiVal}>{completedToday}</Text>
          <Text style={styles.kpiLabel}>Trips Completed</Text>
        </View>

        <View style={styles.kpiCard}>
          <Award size={20} color="#F59E0B" />
          <Text style={styles.kpiVal}>{rating > 0 ? `★ ${rating}` : '—'}</Text>
          <Text style={styles.kpiLabel}>Customer Score</Text>
        </View>
      </View>

      {/* 5. QUICK NAVIGATION GRID */}
      <Text style={styles.sectionHeading}>Rider Operations Hub</Text>

      <View style={styles.navGrid}>
        <Pressable style={styles.navCard} onPress={() => router.push('/rider/active' as any)}>
          <View style={[styles.navIconBox, { backgroundColor: '#EFF6FF' }]}>
            <Navigation size={20} color="#0066FF" />
          </View>
          <Text style={styles.navTitle}>Active Task</Text>
          <Text style={styles.navSub}>Pickup & Drop</Text>
        </Pressable>

        <Pressable style={styles.navCard} onPress={() => router.push('/rider/history' as any)}>
          <View style={[styles.navIconBox, { backgroundColor: '#ECFDF5' }]}>
            <Clock size={20} color="#10B981" />
          </View>
          <Text style={styles.navTitle}>Trip History</Text>
          <Text style={styles.navSub}>Earnings Log</Text>
        </Pressable>

        <Pressable style={styles.navCard} onPress={() => router.push('/rider/attendance' as any)}>
          <View style={[styles.navIconBox, { backgroundColor: '#F5F3FF' }]}>
            <FileText size={20} color="#8B5CF6" />
          </View>
          <Text style={styles.navTitle}>Attendance</Text>
          <Text style={styles.navSub}>Shift Punch Logs</Text>
        </Pressable>

        <Pressable style={styles.navCard} onPress={() => router.push('/rider/profile' as any)}>
          <View style={[styles.navIconBox, { backgroundColor: '#F1F5F9' }]}>
            <User size={20} color="#334155" />
          </View>
          <Text style={styles.navTitle}>Profile & Bank</Text>
          <Text style={styles.navSub}>KYC & Payouts</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    gap: 12,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  container: {
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    paddingBottom: 90,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 3,
    letterSpacing: -0.3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeOnline: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  badgeBreak: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  badgeOffline: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  badgeOnlineText: {
    color: '#047857',
  },
  badgeBreakText: {
    color: '#B45309',
  },
  badgeOfflineText: {
    color: '#64748B',
  },
  punchActionContainer: {
    gap: 10,
  },
  punchBtn: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  punchBtnIn: {
    backgroundColor: '#0066FF',
  },
  punchBtnOut: {
    backgroundColor: '#DC2626',
  },
  punchBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.6,
  },
  breakBtn: {
    height: 44,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  breakBtnActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#D97706',
  },
  breakBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  dutyFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dutyFooterDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 8,
  },
  dutyFooterText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  shiftCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  shiftOnline: {
    backgroundColor: '#FFFFFF',
    borderColor: '#10B981',
  },
  shiftOffline: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  shiftLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleOnline: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  iconCircleOffline: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  shiftTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
  },
  shiftSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  riderBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  riderBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#0066FF',
    fontWeight: '900',
    fontSize: 13,
  },
  riderName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  riderDetail: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  kycBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  kycText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  activeTaskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  noOrderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
    gap: 8,
  },
  noOrderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 4,
  },
  noOrderSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  refreshBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  urgentBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  activePayout: {
    color: COLORS.success,
    fontWeight: '900',
    fontSize: 15,
  },
  orderIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  orderId: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
  },
  customerNameCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 10,
    gap: 4,
  },
  customerNameLabel: {
    color: '#1E40AF',
    fontSize: 13,
    fontWeight: '700',
  },
  customerNameValue: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '900',
  },
  customerPhoneValue: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
  },
  customerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  customerBadgeText: {
    color: '#0066FF',
    fontSize: 12,
    fontWeight: '700',
  },
  routeBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  routeLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  routeDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 6,
  },
  navigateBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  navigateBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  kpiCard: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  kpiVal: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
    marginTop: 4,
  },
  kpiLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 12,
  },
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  navCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  navIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  navTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  navSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
