import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, Pressable } from 'react-native';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { Settings, Navigation, Volume2, BatteryCharging, Store, ShieldCheck, Cpu } from 'lucide-react-native';
import { useToast } from '../../context/ToastContext';
import { getItem, setItem } from '../../services/storage';

export default function RiderSettingsScreen() {
  const { showToast } = useToast();
  const [highGps, setHighGps] = useState(true);
  const [loudChime, setLoudChime] = useState(true);
  const [autoAccept, setAutoAccept] = useState(false);
  const [batterySaver, setBatterySaver] = useState(false);
  const [preferredStore, setPreferredStore] = useState('Indiranagar Dark Store #4');
  const [navApp, setNavApp] = useState<'GOOGLE_MAPS' | 'IN_APP'>('GOOGLE_MAPS');

  useEffect(() => {
    getItem<any>('@grabit_rider_settings').then((saved) => {
      if (saved) {
        if (saved.highGps !== undefined) setHighGps(saved.highGps);
        if (saved.loudChime !== undefined) setLoudChime(saved.loudChime);
        if (saved.autoAccept !== undefined) setAutoAccept(saved.autoAccept);
        if (saved.batterySaver !== undefined) setBatterySaver(saved.batterySaver);
        if (saved.navApp) setNavApp(saved.navApp);
      }
    }).catch(() => {});
  }, []);

  const saveSettings = async (updates: Partial<{ highGps: boolean; loudChime: boolean; autoAccept: boolean; batterySaver: boolean; navApp: string }>) => {
    try {
      const current = (await getItem<any>('@grabit_rider_settings')) || {};
      await setItem('@grabit_rider_settings', { ...current, ...updates });
    } catch {}
  };

  const toggleSwitch = (setter: React.Dispatch<React.SetStateAction<boolean>>, val: boolean, label: string, key: 'highGps' | 'loudChime' | 'autoAccept' | 'batterySaver') => {
    setter(val);
    saveSettings({ [key]: val });
    showToast(`${label} ${val ? 'Enabled' : 'Disabled'}`, 'info');
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.headerCard}>
        <Settings size={28} color={COLORS.primaryDark} />
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.headerTitle}>Rider Terminal Settings</Text>
          <Text style={styles.headerSub}>Configure hardware, GPS & order dispatch preferences</Text>
        </View>
      </View>

      {/* Dispatch & Audio Settings */}
      <View style={styles.card}>
        <Text style={styles.cardSectionHeading}>Order Dispatch & Navigation</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingTextCol}>
            <Text style={styles.settingTitle}>Loud Order Alert Chime</Text>
            <Text style={styles.settingDesc}>Play max volume ringtone when new trip is assigned</Text>
          </View>
          <Switch
            value={loudChime}
            onValueChange={(v) => toggleSwitch(setLoudChime, v, 'Loud Order Chime', 'loudChime')}
            trackColor={{ false: '#D1D5DB', true: COLORS.primaryLight }}
            thumbColor={loudChime ? COLORS.primary : '#9CA3AF'}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingTextCol}>
            <Text style={styles.settingTitle}>High-Precision Realtime GPS</Text>
            <Text style={styles.settingDesc}>Update location every 2 seconds for exact navigation</Text>
          </View>
          <Switch
            value={highGps}
            onValueChange={(v) => toggleSwitch(setHighGps, v, 'High-Precision GPS', 'highGps')}
            trackColor={{ false: '#D1D5DB', true: COLORS.primaryLight }}
            thumbColor={highGps ? COLORS.primary : '#9CA3AF'}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingTextCol}>
            <Text style={styles.settingTitle}>Auto-Accept Nearby Express Trips</Text>
            <Text style={styles.settingDesc}>Automatically accept trips within 500m of your hub</Text>
          </View>
          <Switch
            value={autoAccept}
            onValueChange={(v) => toggleSwitch(setAutoAccept, v, 'Auto-Accept Trips', 'autoAccept')}
            trackColor={{ false: '#D1D5DB', true: COLORS.primaryLight }}
            thumbColor={autoAccept ? COLORS.primary : '#9CA3AF'}
          />
        </View>
      </View>

      {/* Navigation App Preference */}
      <View style={styles.card}>
        <Text style={styles.cardSectionHeading}>Default Map & Navigation App</Text>

        <Pressable
          style={[styles.radioOption, navApp === 'GOOGLE_MAPS' && styles.radioOptionActive]}
          onPress={() => {
            setNavApp('GOOGLE_MAPS');
            saveSettings({ navApp: 'GOOGLE_MAPS' });
            showToast('Navigation app set to Google Maps', 'success');
          }}
        >
          <View style={[styles.radioDot, navApp === 'GOOGLE_MAPS' && styles.radioDotActive]} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.radioTitle}>Google Maps (Turn-by-Turn Voice)</Text>
            <Text style={styles.radioSub}>Launches external Google Maps with traffic updates</Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.radioOption, navApp === 'IN_APP' && styles.radioOptionActive]}
          onPress={() => {
            setNavApp('IN_APP');
            saveSettings({ navApp: 'IN_APP' });
            showToast('Navigation app set to In-App Map', 'success');
          }}
        >
          <View style={[styles.radioDot, navApp === 'IN_APP' && styles.radioDotActive]} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.radioTitle}>Grabit In-App Live Map</Text>
            <Text style={styles.radioSub}>Integrated map screen inside rider portal</Text>
          </View>
        </Pressable>
      </View>

      {/* Preferred Hub */}
      <View style={styles.card}>
        <Text style={styles.cardSectionHeading}>Home Base Dark Store Hub</Text>
        <Text style={styles.hubCurrentText}>Current: <Text style={{ fontWeight: '800' }}>{preferredStore}</Text></Text>

        {['Indiranagar Dark Store #4', 'Koramangala Dark Store #2', 'HSR Layout Dark Store #1'].map(
          (store) => (
            <Pressable
              key={store}
              style={[styles.storeChip, preferredStore === store && styles.storeChipActive]}
              onPress={() => {
                setPreferredStore(store);
                saveSettings({ preferredStore: store } as any);
                showToast(`Primary Dark Store set to ${store}`, 'success');
              }}
            >
              <Store size={16} color={preferredStore === store ? COLORS.primaryDark : COLORS.textMuted} />
              <Text
                style={[
                  styles.storeChipText,
                  preferredStore === store && styles.storeChipTextActive,
                ]}
              >
                {store}
              </Text>
            </Pressable>
          )
        )}
      </View>

      {/* App Version Info */}
      <View style={styles.footerInfo}>
        <Cpu size={16} color={COLORS.textMuted} />
        <Text style={styles.versionText}>Grabit Rider Terminal v2.4.0 (Build #8921-Prod)</Text>
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
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardSectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingTextCol: {
    flex: 1,
    marginRight: 10,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  settingDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  radioOptionActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  radioDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.textMuted,
  },
  radioDotActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  radioTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  radioSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  hubCurrentText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  storeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderRadius: 10,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  storeChipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  storeChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  storeChipTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '800',
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.md,
  },
  versionText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginLeft: 6,
  },
});

