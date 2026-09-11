import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { get, patch } from '../../services/api';
import {
  Store,
  LogOut,
  ShieldCheck,
  Building,
  CreditCard,
  Bell,
  Clock,
  MapPin,
  Save,
  CheckCircle,
  Phone,
  Mail,
  User,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function SellerProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  // General Store Form
  const [storeName, setStoreName] = useState(user?.store_name || 'Grabit Store');
  const [managerName, setManagerName] = useState(user?.name || 'Store Manager');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [address, setAddress] = useState('');
  const [operatingHours, setOperatingHours] = useState('06:00 AM - 11:00 PM');
  const [deliveryRadius, setDeliveryRadius] = useState('5.0');

  // Business & Payout Info
  const [gstin, setGstin] = useState('');
  const [fssai, setFssai] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [upiId, setUpiId] = useState('');

  // Notification Preferences
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await get('/seller/profile');
      if (res && typeof res === 'object') {
        if (res.store_name) setStoreName(res.store_name);
        if (res.manager_name) setManagerName(res.manager_name);
        if (res.phone) setPhone(res.phone);
        if (res.email) setEmail(res.email);
        if (res.address) setAddress(res.address);
        if (res.operating_hours) setOperatingHours(res.operating_hours);
        if (res.delivery_radius) setDeliveryRadius(String(res.delivery_radius));
        if (res.gstin) setGstin(res.gstin);
        if (res.fssai) setFssai(res.fssai);
        if (res.bank_account) setBankAccount(res.bank_account);
        if (res.ifsc) setIfsc(res.ifsc);
        if (res.upi_id) setUpiId(res.upi_id);
        if (res.sms_alerts !== undefined) setSmsAlerts(Boolean(res.sms_alerts));
        if (res.push_alerts !== undefined) setPushAlerts(Boolean(res.push_alerts));
        if (res.sound_alerts !== undefined) setSoundAlerts(Boolean(res.sound_alerts));
      }
    } catch {
      // Retain existing state
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const payload = {
        store_name: storeName.trim(),
        manager_name: managerName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        operating_hours: operatingHours.trim(),
        delivery_radius: deliveryRadius.trim(),
        gstin: gstin.trim(),
        fssai: fssai.trim(),
        bank_account: bankAccount.trim(),
        ifsc: ifsc.trim(),
        upi_id: upiId.trim(),
        sms_alerts: smsAlerts,
        push_alerts: pushAlerts,
        sound_alerts: soundAlerts,
      };
      await patch('/seller/profile', payload);
      showToast('Store profile & payout details saved to cloud!', 'success');
    } catch {
      showToast('Failed to save store profile. Please retry.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login' as any);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* STORE HEADER BANNER */}
      <View style={styles.headerCard}>
        <View style={styles.storeIconCircle}>
          <Store size={28} color={COLORS.primary} />
        </View>
        <Text style={styles.storeTitle}>{storeName}</Text>
        <Text style={styles.storeSub}>Merchant Partner ID: STR-88291</Text>
        
        <View style={styles.badgeRow}>
          <View style={styles.verifiedBadge}>
            <ShieldCheck size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.verifiedText}>FSSAI Verified</Text>
          </View>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>★ 4.8 Store Rating</Text>
          </View>
        </View>
      </View>

      {/* USER ACCOUNT DETAILS CARD */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <User size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>Merchant Account & User Details</Text>
        </View>

        <View style={styles.rowTwo}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <Text style={styles.inputLabel}>Account Owner</Text>
            <TextInput
              style={styles.input}
              value={managerName}
              onChangeText={setManagerName}
              placeholder="John Seller"
            />
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={styles.inputLabel}>Registered Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+919999900002"
            />
          </View>
        </View>

        <Text style={styles.inputLabel}>Account Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          placeholder="seller@grabit.local"
        />

        <View style={{ marginTop: 8, padding: 10, backgroundColor: COLORS.primaryLight || '#EEF2FF', borderRadius: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.primary }}>
            Account Role: Merchant Seller Partner (Verified Cloud Profile)
          </Text>
        </View>
      </View>

      {/* GENERAL STORE INFO */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Building size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>Store Information</Text>
        </View>

        <Text style={styles.inputLabel}>Store Display Name</Text>
        <TextInput
          style={styles.input}
          value={storeName}
          onChangeText={setStoreName}
        />

        <View style={styles.rowTwo}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <Text style={styles.inputLabel}>Manager Name</Text>
            <TextInput
              style={styles.input}
              value={managerName}
              onChangeText={setManagerName}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <Text style={styles.inputLabel}>Support Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />

        <Text style={styles.inputLabel}>Store Physical Address</Text>
        <TextInput
          style={[styles.input, { height: 60, textAlignVertical: 'top', paddingTop: 8 }]}
          value={address}
          onChangeText={setAddress}
          multiline
        />

        <View style={styles.rowTwo}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <Text style={styles.inputLabel}>Operating Hours</Text>
            <TextInput
              style={styles.input}
              value={operatingHours}
              onChangeText={setOperatingHours}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={styles.inputLabel}>Delivery Radius (km)</Text>
            <TextInput
              style={styles.input}
              value={deliveryRadius}
              onChangeText={setDeliveryRadius}
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>

      {/* REGULATORY & COMPLIANCE */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <ShieldCheck size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>Business & Compliance</Text>
        </View>

        <Text style={styles.inputLabel}>GSTIN Registration</Text>
        <TextInput
          style={styles.input}
          value={gstin}
          onChangeText={setGstin}
          autoCapitalize="characters"
        />

        <Text style={styles.inputLabel}>FSSAI License Number</Text>
        <TextInput
          style={styles.input}
          value={fssai}
          onChangeText={setFssai}
          keyboardType="numeric"
        />
      </View>

      {/* BANK & PAYOUT SETUP */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <CreditCard size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>Payout & Settlement Bank</Text>
        </View>

        <Text style={styles.inputLabel}>Account Number</Text>
        <TextInput
          style={styles.input}
          value={bankAccount}
          onChangeText={setBankAccount}
          keyboardType="numeric"
          secureTextEntry
        />

        <View style={styles.rowTwo}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <Text style={styles.inputLabel}>IFSC Code</Text>
            <TextInput
              style={styles.input}
              value={ifsc}
              onChangeText={setIfsc}
              autoCapitalize="characters"
            />
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={styles.inputLabel}>UPI VPA ID</Text>
            <TextInput
              style={styles.input}
              value={upiId}
              onChangeText={setUpiId}
            />
          </View>
        </View>
      </View>

      {/* SAVE PROFILE BUTTON */}
      <Pressable style={styles.saveBtn} onPress={handleSaveProfile} disabled={isSaving}>
        {isSaving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveBtnText}>Save Profile & Account Details</Text>
        )}
      </Pressable>

      {/* LOGOUT BUTTON */}
      <Pressable style={styles.logoutBtn} onPress={handleLogout}>
        <LogOut size={18} color={COLORS.danger} style={{ marginRight: 6 }} />
        <Text style={styles.logoutText}>Log Out from Merchant Session</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
    backgroundColor: COLORS.background,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  storeIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  storeTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
  },
  storeSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 6,
  },
  verifiedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  ratingBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  ratingText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 13,
    color: COLORS.text,
  },
  rowTwo: {
    flexDirection: 'row',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 48,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.danger,
    marginBottom: SPACING.xl,
  },
  logoutText: {
    color: COLORS.danger,
    fontWeight: '800',
    fontSize: 14,
  },
});
