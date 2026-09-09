import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import { Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { get, patch } from '../services/api';

import { getItem, setItem } from '../services/storage';

interface RiderHeaderProps {
  statusText?: string;
  partnerId?: string;
  onStatusPress?: () => void;
}

export const RiderHeader: React.FC<RiderHeaderProps> = ({
  statusText,
  partnerId,
  onStatusPress,
}) => {
  const router = useRouter();
  const [dutyState, setDutyState] = useState<'ON_DELIVERY' | 'ONLINE' | 'OFFLINE'>(() => {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const local = localStorage.getItem('@grabit_rider_is_online');
        if (local === 'true') return 'ONLINE';
      }
    } catch {}
    return 'OFFLINE';
  });
  const [partnerCode, setPartnerCode] = useState<string>(partnerId || 'RDR-700B');

  const fetchProfile = React.useCallback(() => {
    get('/delivery/agent/me')
      .then((res: any) => {
        if (res) {
          const u = res.user || res;
          const code = u.partner_id || u.partnerId || u.agentId || u.id || '';
          if (code) {
            const cleanCode = String(code).replace(/-/g, '').slice(-4).toUpperCase();
            setPartnerCode(code.startsWith('RDR-') ? code : `RDR-${cleanCode}`);
          }
          const isOnline = Boolean(u.is_online);
          const activeCount = Number(u.active_deliveries_count || 0);
          setItem('@grabit_rider_is_online', String(isOnline)).catch(() => {});
          try {
            if (typeof window !== 'undefined' && typeof localStorage !== 'undefined' && localStorage.setItem) {
              localStorage.setItem('@grabit_rider_is_online', String(isOnline));
            }
          } catch {}
          if (activeCount > 0) {
            setDutyState('ON_DELIVERY');
          } else if (isOnline) {
            setDutyState('ONLINE');
          } else {
            setDutyState('OFFLINE');
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (partnerId) {
      setPartnerCode(partnerId);
    }
    fetchProfile();

    getItem<string>('@grabit_rider_is_online')
      .then((val) => {
        if (val === 'true') {
          setDutyState((prev) => (prev === 'ON_DELIVERY' ? 'ON_DELIVERY' : 'ONLINE'));
        } else if (val === 'false') {
          setDutyState('OFFLINE');
        }
      })
      .catch(() => {});

    const handleUpdate = () => {
      try {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          const local = localStorage.getItem('@grabit_rider_is_online');
          if (local === 'true') {
            setDutyState((prev) => (prev === 'ON_DELIVERY' ? 'ON_DELIVERY' : 'ONLINE'));
          } else if (local === 'false') {
            setDutyState('OFFLINE');
          }
        }
      } catch {}
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('grabit_rider_online_updated', handleUpdate);
      return () => {
        if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
          window.removeEventListener('grabit_rider_online_updated', handleUpdate);
        }
      };
    }
  }, [partnerId, fetchProfile]);

  const currentStatus = statusText || (dutyState === 'ON_DELIVERY' ? 'On Delivery' : dutyState === 'ONLINE' ? 'Duty Online' : 'Offline');

  const handleStatusToggle = async () => {
    if (onStatusPress) {
      onStatusPress();
      return;
    }
    const nextState = dutyState === 'OFFLINE';
    setDutyState(nextState ? 'ONLINE' : 'OFFLINE');
    try {
      if (typeof window !== 'undefined') {
        if (typeof localStorage !== 'undefined' && localStorage.setItem) {
          localStorage.setItem('@grabit_rider_is_online', String(nextState));
        }
        if (typeof window.dispatchEvent === 'function' && typeof Event === 'function') {
          window.dispatchEvent(new Event('grabit_rider_online_updated'));
        }
      }
      await patch('/delivery/agent/status', { is_online: nextState });
    } catch {
      setDutyState(dutyState);
    }
  };

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
        {/* Status Pill */}
        <Pressable style={[styles.statusPill, currentStatus === 'Offline' && styles.statusPillOffline]} onPress={handleStatusToggle}>
          <View
            style={[
              styles.statusDot,
              currentStatus === 'Offline' && styles.statusDotOffline,
            ]}
          />
          <Text style={[styles.statusText, currentStatus === 'Offline' && styles.statusTextOffline]}>
            {currentStatus}
          </Text>
        </Pressable>

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
