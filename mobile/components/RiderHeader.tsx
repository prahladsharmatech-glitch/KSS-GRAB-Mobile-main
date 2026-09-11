import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../constants/theme';
import { Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useRiderDuty } from '../context/RiderDutyContext';

export const RiderHeader: React.FC = () => {
  const router = useRouter();
  const { dutyStatus } = useRiderDuty();

  const currentStatus =
    dutyStatus === 'ON_DELIVERY'
      ? 'On Delivery'
      : dutyStatus === 'ONLINE'
        ? 'Duty Online'
        : 'Offline';

  return (
    <View style={styles.headerContainer}>
      {/* Left: Brand Logo */}
      <View style={styles.leftRow}>
        <View style={styles.logoContainer}>
          <View style={styles.brandTitleRow}>
            <Text style={styles.logoGrab}>Grab</Text>
            <Text style={styles.logoIt}>it</Text>
          </View>
          <Text style={styles.logoTagline}>GRAB IT. GET IT. NEAR YOU.</Text>
        </View>
      </View>

      {/* Right: Duty Pill & Notification Bell */}
      <View style={styles.rightRow}>
        {/* Status Pill (Display only - non-clickable) */}
        <View style={[styles.statusPill, currentStatus === 'Offline' && styles.statusPillOffline]}>
          <View
            style={[
              styles.statusDot,
              currentStatus === 'Offline' && styles.statusDotOffline,
            ]}
          />
          <Text style={[styles.statusText, currentStatus === 'Offline' && styles.statusTextOffline]}>
            {currentStatus}
          </Text>
        </View>

        {/* Bell Button */}
        <Pressable
          style={styles.bellButton}
          onPress={() => router.push('/rider/notifications' as any)}
        >
          <Bell size={18} color="#475569" />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    justifyContent: 'center',
    marginRight: 10,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoGrab: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  logoIt: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0066FF',
    letterSpacing: -0.5,
  },
  logoTagline: {
    fontSize: 6.5,
    fontWeight: '800',
    color: '#0066FF',
    letterSpacing: 0.5,
    marginTop: -2,
  },
  partnerPill: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginLeft: 6,
  },
  partnerPillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0066FF',
    letterSpacing: 0.8,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  statusPillOffline: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusDotOffline: {
    backgroundColor: '#94A3B8',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  statusTextOffline: {
    color: '#64748B',
  },
  bellButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
