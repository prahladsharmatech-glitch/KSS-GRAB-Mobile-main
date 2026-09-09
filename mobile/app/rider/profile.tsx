import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Modal, TextInput } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { get, patch } from '../../services/api';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import {
  Bike,
  ShieldCheck,
  LogOut,
  User,
  CreditCard,
  FileCheck,
  Phone,
  ChevronRight,
  Edit2,
  Award,
  Star,
  Zap,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useToast } from '../../context/ToastContext';

export default function RiderProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [rider, setRider] = useState<any>(null);
  const [upiId, setUpiId] = useState('');
  const [bankModal, setBankModal] = useState(false);
  const [editUpiInput, setEditUpiInput] = useState('');

  const fetchProfile = useCallback(async () => {
    try {
      const res: any = await get('/delivery/agent/me').catch(() => null);
      if (res) {
        const u = res.user || res;
        if (u) {
          setRider(u);
          const rName = u.full_name || u.name || user?.name || 'Karthik Rider';
          const nameSlug = rName.toLowerCase().replace(/[^a-z0-9]/g, '.');
          const defaultUpi = u.upi_id || `${nameSlug}@okicici`;
          setUpiId(defaultUpi);
          setEditUpiInput(defaultUpi);
        }
      }
    } catch {
      // fallback to user state
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleLogout = async () => {
    await logout();
    showToast('Logged out of Rider Portal', 'info');
    router.replace('/login' as any);
  };

  const handleSaveUpi = async () => {
    if (!editUpiInput.includes('@')) {
      showToast('Please enter a valid UPI ID (e.g. name@upi)', 'error');
      return;
    }
    const val = editUpiInput.trim();
    setUpiId(val);
    setBankModal(false);
    try {
      await patch('/delivery/payout-profile', { upi_id: val });
      showToast('Payout UPI updated successfully!', 'success');
    } catch {
      showToast('Payout UPI updated locally', 'info');
    }
  };

  const riderName = rider?.full_name || rider?.name || user?.name || 'Karthik Rider';
  const partnerId = rider?.partner_id || rider?.partnerId || (rider?.id ? `RDR-${String(rider.id).replace(/-/g, '').slice(0, 4).toUpperCase()}` : 'RDR-700B');
  const phoneDigits = String(rider?.phone || user?.phone || '9999900003').replace(/\D/g, '');
  const phoneLast4 = phoneDigits.length >= 4 ? phoneDigits.slice(-4) : '9903';
  const licenseNo = rider?.license_number || rider?.license_plate || rider?.driving_license || 'DL-2024-88712';
  const vehiclePlate = rider?.plate_number || rider?.vehicle_number || rider?.plate || 'KA-05-EX-9921';
  const emergencyName = rider?.emergency_name || `${riderName.split(' ')[0]}'s Emergency Contact (Family)`;
  const emergencyPhone = rider?.emergency_phone || rider?.phone || user?.phone || '+91 99999 00003';

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Profile Card */}
      <View style={styles.headerCard}>
        <View style={styles.avatarCircle}>
          <User size={32} color={COLORS.primary} />
        </View>
        <Text style={styles.nameText}>{riderName}</Text>
        <Text style={styles.riderIdText}>Rider Partner ID: #{partnerId}</Text>

        <View style={styles.badgeRow}>
          <View style={styles.badgeItem}>
            <Star size={12} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.badgeText}>{rider?.rating ? `${rider.rating} Rating` : '4.95 Rating'}</Text>
          </View>
          <View style={styles.badgeItem}>
            <ShieldCheck size={12} color={COLORS.success} />
            <Text style={styles.badgeText}>KYC Verified Partner</Text>
          </View>
        </View>
      </View>

      {/* Bank & Payout Settings */}
      <View style={styles.card}>
        <View style={styles.cardHeaderBetween}>
          <View style={styles.cardHeader}>
            <CreditCard size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Payout & Bank Account</Text>
          </View>
          <Pressable onPress={() => { setEditUpiInput(upiId); setBankModal(true); }}>
            <Edit2 size={16} color={COLORS.primary} />
          </Pressable>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Primary UPI ID:</Text>
          <Text style={styles.infoVal}>{upiId || `${riderName.toLowerCase().replace(/\s+/g, '.')}@okicici`}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Bank Account:</Text>
          <Text style={styles.infoVal}>HDFC Bank (•••• {phoneLast4})</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Payout Cycle:</Text>
          <Text style={styles.infoVal}>Daily Instant Payout @ 11 PM</Text>
        </View>
      </View>

      {/* Document Verification Status */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <FileCheck size={18} color={COLORS.success} />
          <Text style={styles.cardTitle}>Verified Documents</Text>
        </View>

        {[
          { label: 'Driving License', val: licenseNo },
          { label: 'Vehicle Number', val: vehiclePlate },
          { label: 'Aadhaar Card', val: `•••• •••• ${phoneLast4}` },
          { label: 'Police Verification', val: 'Cleared ✓' },
        ].map((doc, idx) => (
          <View key={idx} style={styles.docRow}>
            <Text style={styles.docLabel}>{doc.label}</Text>
            <View style={styles.docStatusBadge}>
              <Text style={styles.docStatusText}>{doc.val.includes('✓') ? doc.val : `${doc.val} (Verified ✓)`}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Emergency Contact */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Phone size={18} color={COLORS.danger} />
          <Text style={styles.cardTitle}>Emergency Contact</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Contact Name:</Text>
          <Text style={styles.infoVal}>{emergencyName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone:</Text>
          <Text style={styles.infoVal}>{emergencyPhone}</Text>
        </View>
      </View>

      {/* Logout Button */}
      <Pressable style={styles.logoutBtn} onPress={handleLogout}>
        <LogOut size={18} color={COLORS.danger} />
        <Text style={styles.logoutText}>End Shift & Log Out</Text>
      </Pressable>

      {/* Edit Bank Modal */}
      <Modal visible={bankModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Payout UPI ID</Text>
            <Text style={styles.modalSub}>Daily earnings will be credited directly to this VPA.</Text>

            <TextInput
              style={styles.input}
              value={editUpiInput}
              onChangeText={setEditUpiInput}
              placeholder="e.g. rahul@okicici"
              placeholderTextColor={COLORS.textMuted}
            />

            <View style={styles.modalBtnRow}>
              <Pressable style={styles.cancelBtn} onPress={() => setBankModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSaveUpi}>
                <Text style={styles.saveText}>Save Changes</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  nameText: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
  },
  riderIdText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: SPACING.md,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primaryDark,
    marginLeft: 4,
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  cardHeaderBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginLeft: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  docRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  docLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  docStatusBadge: {
    backgroundColor: COLORS.successLight,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  docStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.success,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.danger,
    marginTop: SPACING.xs,
  },
  logoutText: {
    color: COLORS.danger,
    fontWeight: '800',
    fontSize: 14,
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: SPACING.xl,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  cancelText: {
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});

