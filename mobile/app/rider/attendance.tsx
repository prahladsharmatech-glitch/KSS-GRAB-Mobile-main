import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Switch } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { get, patch } from '../../services/api';
import { getItem, setItem } from '../../services/storage';
import { useToast } from '../../context/ToastContext';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import {
  ShieldCheck,
  Fingerprint,
  CheckCircle2,
  Clock,
  Coffee,
  Calendar as CalendarIcon,
  Award,
  LogOut,
  Play,
  Zap,
  IndianRupee,
  Umbrella,
  AlertTriangle,
  Info,
  X,
  Bike,
  MapPin,
} from 'lucide-react-native';

export default function RiderAttendanceScreen() {
  const { showToast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [onShift, setOnShift] = useState(false);
  const [breakMode, setBreakMode] = useState(false);
  const [punchInTime, setPunchInTime] = useState('--');
  const [activeHoursStr, setActiveHoursStr] = useState('--');
  const [todaysEarnings, setTodaysEarnings] = useState(0);
  const [summary, setSummary] = useState({ present: 0, late: 0, absent: 0, leave: 0 });

  interface CalendarDay {
    dayNum: number | null;
    status: 'PRESENT' | 'LATE' | 'ABSENT' | 'WEEK_OFF' | 'NORMAL';
    title?: string;
    detail?: string;
  }

  const generateMonthGrid = (monthStr: string, isOnline: boolean): CalendarDay[] => {
    const now = new Date();
    const [y, m] = monthStr.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstDayOfWeek = new Date(y, m - 1, 1).getDay();
    const padOffset = (firstDayOfWeek + 6) % 7;
    const currentDayNum = now.getDate();

    const formattedDays: CalendarDay[] = [];
    for (let i = 0; i < padOffset; i++) {
      formattedDays.push({ dayNum: null, status: 'NORMAL' });
    }

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dayDate = new Date(y, m - 1, dayNum);
      const isSunday = dayDate.getDay() === 0;

      let status: CalendarDay['status'] = 'NORMAL';
      let title = 'SCHEDULED';
      let detail = 'Scheduled Duty Details';

      if (isSunday) {
        status = 'WEEK_OFF';
        title = 'LEAVE';
        detail = 'Sunday Weekly Off';
      } else if (dayNum === currentDayNum && isOnline) {
        status = 'PRESENT';
        title = 'PRESENT';
        detail = 'Shift Active — On Duty';
      } else if (dayNum < currentDayNum) {
        status = 'ABSENT';
        title = 'ABSENT';
        detail = 'Absent — No shift recorded';
      }

      formattedDays.push({ dayNum, status, title, detail });
    }
    return formattedDays;
  };

  const nowInit = new Date();
  const monthStrInit = `${nowInit.getFullYear()}-${String(nowInit.getMonth() + 1).padStart(2, '0')}`;

  // Selected day state
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>(() => generateMonthGrid(monthStrInit, false));

  const fetchAttendance = useCallback(async () => {
    try {
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const currentDayNum = now.getDate();

      const res: any = await get(`/delivery/attendance?month=${monthStr}`).catch(() => null);
      const profileRes: any = await get('/delivery/agent/me').catch(() => null);

      let currentOnline = false;
      try {
        const storedVal = await getItem<string>('@grabit_rider_is_online').catch(() => null);
        if (storedVal === 'true') {
          currentOnline = true;
        } else if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          const local = localStorage.getItem('@grabit_rider_is_online');
          if (local === 'true') currentOnline = true;
        }
      } catch {}

      if (profileRes) {
        const u = profileRes.user || profileRes;
        if (u && u.is_online !== undefined) {
          currentOnline = Boolean(u.is_online);
          setItem('@grabit_rider_is_online', String(currentOnline)).catch(() => {});
          try {
            if (typeof window !== 'undefined' && typeof localStorage !== 'undefined' && localStorage.setItem) {
              localStorage.setItem('@grabit_rider_is_online', String(currentOnline));
            }
          } catch {}
          setOnShift(currentOnline);
        }
        if (u && u.todays_earnings !== undefined) {
          setTodaysEarnings(u.todays_earnings);
        }
        if (u && u.punch_in_time && u.punch_in_time !== '--') {
          setPunchInTime(u.punch_in_time);
        }
      } else {
        setOnShift(currentOnline);
      }

      const baseDays = generateMonthGrid(monthStr, currentOnline);
      const daysMap = new Map<number, any>();
      if (res && res.days && Array.isArray(res.days)) {
        res.days.forEach((d: any) => {
          const num = parseInt(String(d.date).slice(-2), 10);
          if (!isNaN(num)) daysMap.set(num, d);
        });
      }

      const formattedDays: CalendarDay[] = baseDays.map((bd) => {
        if (bd.dayNum === null) return bd;
        const d = daysMap.get(bd.dayNum);

        let status: CalendarDay['status'] = bd.status;
        let title = bd.title;

        if (d) {
          if (d.status === 'PRESENT') {
            status = 'PRESENT';
            title = 'PRESENT';
          } else if (d.status === 'LATE') {
            status = 'LATE';
            title = 'LATE';
          } else if (d.status === 'LEAVE' || d.status === 'WEEK_OFF') {
            status = 'WEEK_OFF';
            title = 'LEAVE';
          } else if (d.status === 'ABSENT') {
            status = 'ABSENT';
            title = 'ABSENT';
          }
        }

        // Active punch in / online status strictly marks today as PRESENT
        if (bd.dayNum === currentDayNum && currentOnline) {
          status = 'PRESENT';
          title = 'PRESENT';
        }

        if (bd.dayNum === currentDayNum) {
          if (d && d.check_in) setPunchInTime(d.check_in);
          else if (currentOnline && punchInTime === '--') setPunchInTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          if (d && d.duration) setActiveHoursStr(d.duration);
        }

        return {
          dayNum: bd.dayNum,
          status,
          title,
          detail: d?.detail || bd.detail || (status === 'PRESENT' ? 'Shift Active — On Duty' : status === 'WEEK_OFF' ? 'Weekoff — Scheduled Weekly Off' : status === 'ABSENT' ? 'Absent — No shift recorded' : 'Scheduled Shift'),
        };
      });

      setCalendarDays(formattedDays);

      // Derive monthly summary counts directly from formattedDays (Single Source of Truth)
      const counts = { present: 0, late: 0, absent: 0, leave: 0 };
      formattedDays.forEach((fd) => {
        if (fd.dayNum !== null) {
          if (fd.status === 'PRESENT') {
            counts.present++;
          } else if (fd.status === 'LATE') {
            counts.present++; // Attended working day
            counts.late++;    // Late tracked independently
          } else if (fd.status === 'ABSENT') {
            counts.absent++;
          } else if (fd.status === 'WEEK_OFF') {
            counts.leave++;
          }
        }
      });
      setSummary(counts);
      
      setSelectedDay((prev) => {
        if (prev) {
          const updated = formattedDays.find((fd) => fd.dayNum === prev.dayNum);
          if (updated) return updated;
        }
        return formattedDays.find((fd) => fd.dayNum === currentDayNum) || formattedDays.find((fd) => fd.dayNum === 7) || null;
      });
    } catch {
      // no-op
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAttendance();
    }, [fetchAttendance])
  );

  useEffect(() => {
    fetchAttendance();
    const interval = setInterval(fetchAttendance, 10000);

    const handleUpdate = () => fetchAttendance();
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('grabit_rider_online_updated', handleUpdate);
    }
    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('grabit_rider_online_updated', handleUpdate);
      }
    };
  }, [fetchAttendance]);

  const getDayBoxStyle = (status: CalendarDay['status']) => {
    switch (status) {
      case 'PRESENT':
        return { bg: '#ECFDF5', border: '#A7F3D0', text: '#059669' };
      case 'LATE':
        return { bg: '#FEF3C7', border: '#FDE68A', text: '#D97706' };
      case 'ABSENT':
        return { bg: '#FEE2E2', border: '#FCA5A5', text: '#DC2626' };
      case 'WEEK_OFF':
        return { bg: '#F3E8FF', border: '#DDD6FE', text: '#7C3AED' };
      default:
        return { bg: '#F8FAFC', border: '#E2E8F0', text: '#475569' };
    }
  };

  const getWeekdayName = (dayNum: number) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), dayNum);
    const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return WEEKDAY_NAMES[d.getDay()];
  };

  const handleBiometricPunch = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        await toggleShiftStatus();
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: onShift
          ? 'Verify Biometrics to End Shift'
          : 'Verify Biometrics to Punch In',
        fallbackLabel: 'Use PIN',
      });

      if (result.success) {
        await toggleShiftStatus();
      } else {
        showToast('Biometric verification failed', 'error');
      }
    } catch {
      await toggleShiftStatus();
    }
  };

  const toggleShiftStatus = async () => {
    const nextState = !onShift;
    setOnShift(nextState);
    if (!nextState) {
      setBreakMode(false);
      setPunchInTime('--');
      await patch('/delivery/agent/status', { is_online: false }).catch(() => {});
      showToast('Punched OUT of shift!', 'info');
    } else {
      setPunchInTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      await patch('/delivery/agent/status', { is_online: true }).catch(() => {});
      showToast('Punched IN for shift successfully!', 'success');
    }
    await fetchAttendance();
  };

  const toggleBreak = () => {
    if (!onShift) {
      showToast('Punch IN first before taking a break!', 'error');
      return;
    }
    setBreakMode(!breakMode);
    showToast(
      !breakMode ? 'Break Mode Activated (30 Mins max)' : 'Resumed Duty Mode!',
      !breakMode ? 'info' : 'success'
    );
  };

  const parseActiveHoursToDecimal = (durStr: string, isOnline: boolean): number => {
    if (!durStr || durStr === '--') return isOnline ? 0.5 : 0;
    if (durStr.includes('h')) {
      const parts = durStr.split('h');
      const h = parseFloat(parts[0]) || 0;
      const m = parseFloat((parts[1] || '').replace(/[^0-9.]/g, '')) || 0;
      return h + m / 60;
    } else if (durStr.includes('min') || durStr.includes('m')) {
      const m = parseFloat(durStr.replace(/[^0-9.]/g, '')) || 0;
      return m / 60;
    }
    return isOnline ? 0.5 : 0;
  };

  const activeHoursDecimal = parseActiveHoursToDecimal(activeHoursStr, onShift);
  const targetHours = 8.0;
  const percentCompleted = Math.min(100, Math.round((activeHoursDecimal / targetHours) * 100));
  const hoursRemaining = Math.max(0, targetHours - activeHoursDecimal).toFixed(1);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Today's Shift Metrics */}
      <View style={styles.metricsCard}>
        <Text style={styles.cardHeading}>Today's Shift Progress</Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <Clock size={20} color={COLORS.primary} />
            <Text style={styles.metricVal}>{punchInTime}</Text>
            <Text style={styles.metricSub}>Punch In Time</Text>
          </View>

          <View style={styles.metricBox}>
            <Zap size={20} color={COLORS.success} />
            <Text style={styles.metricVal}>{activeHoursStr}</Text>
            <Text style={styles.metricSub}>Active Hours</Text>
          </View>

          <View style={styles.metricBox}>
            <IndianRupee size={20} color={COLORS.success} />
            <Text style={styles.metricVal}>₹{todaysEarnings}</Text>
            <Text style={styles.metricSub}>Today's Earnings</Text>
          </View>
        </View>

        {/* Goal Bar */}
        <View style={styles.goalBox}>
          <View style={styles.goalLabelRow}>
            <Text style={styles.goalLabel}>Daily Target: {targetHours.toFixed(1)} Hours</Text>
            <Text style={styles.goalPercent}>{percentCompleted}% Completed</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${percentCompleted}%` }]} />
          </View>
          <Text style={styles.goalSub}>
            {parseFloat(hoursRemaining) > 0
              ? `Complete ${hoursRemaining} more hours to unlock ₹150 Bonus.`
              : '🎉 Daily Target Completed! ₹150 Bonus Unlocked!'}
          </Text>
        </View>
      </View>

      {/* Monthly Summary Pill Cards */}
      <View style={styles.monthlySummaryCard}>
        <Text style={styles.monthlyHeaderTitle}>MONTHLY SUMMARY (SEPTEMBER 2026)</Text>

        <View style={styles.summaryGridRow}>
          <View style={[styles.summaryBox, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
            <Text style={[styles.summaryCount, { color: '#059669' }]}>{summary.present}</Text>
            <Text style={[styles.summaryLabel, { color: '#059669' }]}>Present</Text>
          </View>

          <View style={[styles.summaryBox, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
            <Text style={[styles.summaryCount, { color: '#D97706' }]}>{summary.late}</Text>
            <Text style={[styles.summaryLabel, { color: '#D97706' }]}>Late</Text>
          </View>

          <View style={[styles.summaryBox, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
            <Text style={[styles.summaryCount, { color: '#DC2626' }]}>{summary.absent}</Text>
            <Text style={[styles.summaryLabel, { color: '#DC2626' }]}>Absent</Text>
          </View>

          <View style={[styles.summaryBox, { backgroundColor: '#F3E8FF', borderColor: '#DDD6FE' }]}>
            <Text style={[styles.summaryCount, { color: '#7C3AED' }]}>{summary.leave}</Text>
            <Text style={[styles.summaryLabel, { color: '#7C3AED', textAlign: 'center' }]}>
              Week Off / Leave
            </Text>
          </View>
        </View>
      </View>

      {/* Monthly Calendar View */}
      <View style={styles.calendarCard}>
        {/* Weekday Names Header Row */}
        <View style={styles.weekdayHeaderRow}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <View key={day} style={styles.weekdayCol}>
              <Text style={styles.weekdayText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* 7-Column Calendar Days Grid */}
        <View style={styles.calendarGrid}>
          {calendarDays.map((item, idx) => {
            if (item.dayNum === null) {
              return <View key={idx} style={styles.dayBoxEmpty} />;
            }
            const colors = getDayBoxStyle(item.status);
            const isSelected = selectedDay?.dayNum === item.dayNum;
            return (
              <Pressable
                key={idx}
                onPress={() => setSelectedDay(item)}
                style={[
                  styles.dayBox,
                  { backgroundColor: colors.bg, borderColor: isSelected ? '#0071E3' : colors.border },
                  isSelected && styles.dayBoxSelected,
                ]}
              >
                <Text style={[styles.dayBoxNum, { color: isSelected ? '#0071E3' : colors.text }]}>
                  {item.dayNum}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Selected Day Details Card Banner (Matches Screenshot) */}
        {selectedDay && selectedDay.dayNum !== null && (
          <View
            style={[
              styles.selectedDayCard,
              selectedDay.status === 'WEEK_OFF' && { backgroundColor: '#F3E8FF', borderColor: '#DDD6FE' },
              selectedDay.status === 'PRESENT' && { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
              selectedDay.status === 'LATE' && { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
              selectedDay.status === 'ABSENT' && { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
              selectedDay.status === 'NORMAL' && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
            ]}
          >
            <View style={styles.selectedDayLeftRow}>
              {selectedDay.status === 'WEEK_OFF' && <Umbrella size={22} color="#7C3AED" />}
              {selectedDay.status === 'PRESENT' && <CheckCircle2 size={22} color="#059669" />}
              {selectedDay.status === 'LATE' && <Clock size={22} color="#D97706" />}
              {selectedDay.status === 'ABSENT' && <AlertTriangle size={22} color="#DC2626" />}
              {selectedDay.status === 'NORMAL' && <Info size={22} color="#475569" />}

              <View style={styles.selectedDayTextCol}>
                <Text style={styles.selectedDayTitle}>
                  {getWeekdayName(selectedDay.dayNum)} {selectedDay.dayNum} Sept — {selectedDay.title || (selectedDay.status === 'WEEK_OFF' ? 'LEAVE' : selectedDay.status)}
                </Text>
                <Text style={styles.selectedDaySubtitle}>
                  {selectedDay.detail || 'Scheduled Duty Details'}
                </Text>
              </View>
            </View>

            <Pressable onPress={() => setSelectedDay(null)} style={styles.closeCardBtn} hitSlop={8}>
              <X size={18} color="#8E8E93" />
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
    paddingBottom: 100,
    backgroundColor: COLORS.background,
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
  metricsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricVal: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
    marginTop: 4,
  },
  metricSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  goalBox: {
    backgroundColor: COLORS.primaryLight,
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  goalLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  goalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  goalPercent: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  goalSub: {
    fontSize: 11,
    color: COLORS.primaryDark,
    fontWeight: '600',
  },
  monthlySummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  monthlyHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  summaryGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  summaryBox: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  summaryCount: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  weekdayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  weekdayCol: {
    width: '13.5%',
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayBoxEmpty: {
    width: '13.5%',
    height: 44,
    marginVertical: 4,
    marginHorizontal: '0.35%',
  },
  dayBox: {
    width: '13.5%',
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    marginHorizontal: '0.35%',
  },
  dayBoxNum: {
    fontSize: 15,
    fontWeight: '900',
  },
  dayBoxSelected: {
    borderWidth: 2.5,
    borderColor: '#0071E3',
  },
  selectedDayCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedDayLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  selectedDayTextCol: {
    flex: 1,
  },
  selectedDayTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 2,
  },
  selectedDaySubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  closeCardBtn: {
    padding: 6,
    borderRadius: 12,
  },
});
