import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  Platform,
  ToastAndroid,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../context/LocationContext';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import {
  User,
  MapPin,
  LogOut,
  ShoppingBag,
  Heart,
  MessageSquare,
  Wallet,
  RotateCcw,
  CreditCard,
  Gift,
  ChevronRight,
  ArrowLeft,
  LogIn,
  X,
  Plus,
  Edit2,
  Check,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { get, patch } from '../../services/api';
import { getItem, setItem } from '../../services/storage';
import { Address, UserProfile } from '../../types';

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, updateProfile } = useAuth();
  const { savedAddresses, addSavedAddress } = useLocation();

  const initialName = user?.name || (user as any)?.full_name || 'Customer User';
  const initialPhone = user?.phone || '';
  const initialEmail = (user as any)?.email || '';

  const [userName, setUserName] = useState(initialName);
  const [userPhone, setUserPhone] = useState(initialPhone);
  const [userEmail, setUserEmail] = useState(initialEmail);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [addAmount, setAddAmount] = useState<string>('100');
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // Sync state when AuthContext user updates & fetch live profile from DB for logged-in phone
  useEffect(() => {
    const resolveCredentials = async () => {
      try {
        const cust = await getItem<UserProfile>('grabit_customer_user').catch(() => null);
        const activeUser = cust || user;

        if (activeUser) {
          const uPhone = activeUser.phone || user?.phone || '';
          const uName = activeUser.name || (activeUser as any)?.full_name || user?.name || (user as any)?.full_name || 'Customer User';
          const uEmail = (activeUser as any)?.email || (user as any)?.email || '';

          setUserName(uName);
          setUserPhone(uPhone);
          setUserEmail(uEmail);

          // Fetch live credentials from backend for this user's phone number
          const liveProfile = await get<any>('/users/me').catch(() => null);
          if (liveProfile && (liveProfile.full_name || liveProfile.name)) {
            const liveName = liveProfile.full_name || liveProfile.name;
            setUserName(liveName);
            if (liveProfile.email) setUserEmail(liveProfile.email);
            if (liveProfile.phone) setUserPhone(liveProfile.phone);

            updateProfile({
              name: liveName,
              full_name: liveName,
              email: liveProfile.email || uEmail,
              phone: liveProfile.phone || uPhone,
            });
          }
        }
      } catch (err) {
        if (__DEV__) console.log('[ProfilePage] Live profile fetch error:', err);
      }
    };

    resolveCredentials();
  }, [user]);

  const rawPhone = (user?.phone || '').replace(/\D/g, '');
  const cleanPhone = rawPhone.length >= 10 ? rawPhone.slice(-10) : rawPhone;
  const addressStorageKey = cleanPhone ? `grabit_addresses_${cleanPhone}` : 'grabit_addresses';
  const walletStorageKey = cleanPhone ? `grabit_wallet_balance_${cleanPhone}` : 'grabit_wallet_balance';

  // Hydrate wallet balance from storage
  useEffect(() => {
    getItem<number>(walletStorageKey).then((bal) => {
      if (bal !== null && bal !== undefined) setWalletBalance(bal);
    });
  }, [walletStorageKey]);

  const notify = (msg: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    } else {
      Alert.alert('Grabit', msg);
    }
  };

  // ── MODAL VISIBILITY STATES ──
  // Active modal types: 'add-balance' | 'refunds' | 'gift-cards' | 'addresses' | 'edit-profile' | 'rewards' | 'payments' | null
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // ── GIFT CARD INPUT ──
  const [giftCardCode, setGiftCardCode] = useState<string>('');

  // ── LOCAL SAVED ADDRESSES STATE ──
  const [addressesList, setAddressesList] = useState<Address[]>([]);
  const [editingAddrIdx, setEditingAddrIdx] = useState<number | null>(null);
  const [isAddingAddress, setIsAddingAddress] = useState<boolean>(false);
  const [editAddrForm, setEditAddrForm] = useState({
    title: 'Home',
    address: '',
    city: 'Bengaluru',
    isDefault: false,
  });

  useEffect(() => {
    getItem<Address[]>(addressStorageKey).then((list) => {
      if (list && Array.isArray(list)) {
        setAddressesList(list);
      } else if (savedAddresses && savedAddresses.length > 0) {
        setAddressesList(savedAddresses);
      } else {
        const defaultAddressItem: Address = {
          label: 'Home',
          street: 'KSS Metro Tech Park, Sector 4',
          city: 'Bengaluru',
          zip: '560102',
          isDefault: true,
        };
        setAddressesList([defaultAddressItem]);
      }
    });
  }, [addressStorageKey, savedAddresses]);

  const saveAddressesToStorage = async (list: Address[]) => {
    setAddressesList(list);
    await setItem(addressStorageKey, list);
  };

  const handleStartEditAddress = (idx: number, addr: Address) => {
    setEditingAddrIdx(idx);
    setIsAddingAddress(false);
    setEditAddrForm({
      title: addr.label || 'Home',
      address: addr.street || '',
      city: addr.city || 'Bengaluru',
      isDefault: addr.isDefault || false,
    });
  };

  const handleStartAddAddress = () => {
    setEditingAddrIdx(null);
    setIsAddingAddress(true);
    setEditAddrForm({
      title: 'Home',
      address: '',
      city: 'Bengaluru',
      isDefault: addressesList.length === 0,
    });
  };

  const handleSaveEditAddress = async () => {
    if (!editAddrForm.address.trim()) {
      notify('Please enter the delivery address.');
      return;
    }

    let updated = [...addressesList];
    const newAddr: Address = {
      label: editAddrForm.title.trim() || 'Home',
      street: editAddrForm.address.trim(),
      city: editAddrForm.city.trim() || 'Bengaluru',
      zip: '560034',
      isDefault: editAddrForm.isDefault,
    };

    if (isAddingAddress) {
      if (newAddr.isDefault) {
        updated = updated.map((a) => ({ ...a, isDefault: false }));
      }
      updated.push(newAddr);
      addSavedAddress(newAddr);
      notify(`Address "${newAddr.label}" saved successfully!`);
    } else if (editingAddrIdx !== null) {
      if (newAddr.isDefault) {
        updated = updated.map((a) => ({ ...a, isDefault: false }));
      }
      updated[editingAddrIdx] = { ...updated[editingAddrIdx], ...newAddr };
      notify(`Address "${newAddr.label}" updated successfully!`);
    }

    await saveAddressesToStorage(updated);
    setEditingAddrIdx(null);
    setIsAddingAddress(false);
  };

  const handleDeleteAddress = async (idx: number) => {
    const updated = addressesList.filter((_, i) => i !== idx);
    await saveAddressesToStorage(updated);
    notify('Delivery address removed.');
  };

  // ── SAVE PROFILE HANDLER ──
  const handleSaveProfile = async () => {
    if (!userName.trim()) {
      notify('Please enter your full name.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const payload = {
        full_name: userName.trim(),
        email: userEmail.trim(),
      };

      try {
        await patch('/users/me', payload);
      } catch (err) {
        console.warn('API patch failed, updating local state:', err);
      }

      await updateProfile({
        name: userName.trim(),
        full_name: userName.trim(),
        email: userEmail.trim(),
        phone: userPhone.trim(),
      });

      notify('Profile updated successfully!');
      setActiveModal(null);
    } catch (err) {
      notify('Failed to save profile. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ── WALLET TOP UP HANDLER ──
  const handleAddBalance = async () => {
    const amt = parseFloat(addAmount) || 0;
    if (amt > 0) {
      const newBal = walletBalance + amt;
      setWalletBalance(newBal);
      await setItem(walletStorageKey, newBal);
      notify(`Added ₹${amt} to Grabit Cash! New Balance: ₹${newBal}`);
      setActiveModal(null);
    }
  };

  // ── CLAIM GIFT CARD HANDLER ──
  const handleClaimGiftCard = async () => {
    if (!giftCardCode.trim()) {
      notify('Please enter a valid gift card code.');
      return;
    }
    const newBal = walletBalance + 200;
    setWalletBalance(newBal);
    await setItem(walletStorageKey, newBal);
    notify('Successfully claimed Gift Card ₹200! Added to Grabit Cash.');
    setGiftCardCode('');
    setActiveModal(null);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login' as any);
  };

  return (
    <View style={styles.container}>
      {/* ── 1. TOP HEADER ROW ── */}
      <View style={styles.topHeader}>
        <Pressable style={styles.backBtnCircle} onPress={() => router.back()}>
          <ArrowLeft size={18} color="#0F172A" />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── 2. USER PROFILE HEADER CARD ── */}
        <View style={styles.profileCard}>
          <View style={styles.blueAvatarCircle}>
            <User size={28} color="#FFFFFF" />
          </View>

          <View style={styles.profileTextColumn}>
            <Text style={styles.profileName}>
              {(user?.phone || userPhone || '').includes('9360843281')
                ? (user?.name && user.name !== 'Customer User' ? user.name : 'Akash')
                : (user ? user.name || (user as any).full_name || 'Customer' : 'Customer')}
            </Text>
            <Text style={styles.profilePhone}>
              {user?.phone || userPhone || ''}
            </Text>
          </View>
        </View>

        {/* ── 3. TOP 3 SHORTCUT ACTION TILES ── */}
        <View style={styles.shortcutRow}>
          {/* Tile 1: Your Orders */}
          <Pressable style={styles.shortcutTile} onPress={() => router.push('/customer/orders' as any)}>
            <ShoppingBag size={22} color="#0071E3" />
            <Text style={styles.shortcutTitle}>Your{'\n'}Orders</Text>
          </Pressable>

          {/* Tile 2: Help & Support */}
          <Pressable style={styles.shortcutTile} onPress={() => router.push('/customer/help' as any)}>
            <MessageSquare size={22} color="#0071E3" />
            <Text style={styles.shortcutTitle}>Help &{'\n'}Support</Text>
          </Pressable>

          {/* Tile 3: Your Wishlist */}
          <Pressable style={styles.shortcutTile} onPress={() => router.push('/customer/wishlist' as any)}>
            <Heart size={22} color="#0071E3" />
            <Text style={styles.shortcutTitle}>Your{'\n'}Wishlist</Text>
          </Pressable>
        </View>

        {/* ── 4. GRABIT CASH & GIFT CARD BANNER ── */}
        <View style={styles.walletCard}>
          <View style={styles.walletHeaderRow}>
            <View style={styles.walletIconBox}>
              <Wallet size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.walletTitle}>Grabit Cash & Gift Card</Text>

            <View style={styles.newTagBadge}>
              <Text style={styles.newTagText}>NEW</Text>
            </View>

            <ChevronRight size={18} color="#0071E3" style={{ marginLeft: 'auto' }} />
          </View>

          <View style={styles.walletBalanceRow}>
            <Text style={styles.availableBalanceText}>
              Available Balance <Text style={styles.balanceVal}>₹{walletBalance}</Text>
            </Text>

            <Pressable style={styles.addBalanceBtn} onPress={() => setActiveModal('add-balance')}>
              <Text style={styles.addBalanceBtnText}>Add Balance</Text>
            </Pressable>
          </View>
        </View>

        {/* ── 5. YOUR INFORMATION MENU LIST ── */}
        <Text style={styles.sectionHeaderTitle}>Your Information</Text>

        <View style={styles.menuListCard}>
          {/* Item 1: Your Refunds */}
          <Pressable style={styles.menuRow} onPress={() => setActiveModal('refunds')}>
            <View style={styles.menuIconCircle}>
              <RotateCcw size={18} color="#0F172A" />
            </View>
            <Text style={styles.menuRowTitle}>Your Refunds</Text>
            <ChevronRight size={16} color="#94A3B8" style={{ marginLeft: 'auto' }} />
          </Pressable>

          {/* Item 2: Your Wishlist */}
          <Pressable style={styles.menuRow} onPress={() => router.push('/customer/wishlist' as any)}>
            <View style={styles.menuIconCircle}>
              <Heart size={18} color="#0F172A" />
            </View>
            <Text style={styles.menuRowTitle}>Your Wishlist</Text>
            <ChevronRight size={16} color="#94A3B8" style={{ marginLeft: 'auto' }} />
          </Pressable>

          {/* Item 3: E-Gift Cards */}
          <Pressable style={styles.menuRow} onPress={() => setActiveModal('gift-cards')}>
            <View style={styles.menuIconCircle}>
              <CreditCard size={18} color="#0F172A" />
            </View>
            <Text style={styles.menuRowTitle}>E-Gift Cards</Text>
            <ChevronRight size={16} color="#94A3B8" style={{ marginLeft: 'auto' }} />
          </Pressable>

          {/* Item 4: Help & Support */}
          <Pressable style={styles.menuRow} onPress={() => router.push('/customer/help' as any)}>
            <View style={styles.menuIconCircle}>
              <MessageSquare size={18} color="#0F172A" />
            </View>
            <Text style={styles.menuRowTitle}>Help & Support</Text>
            <ChevronRight size={16} color="#94A3B8" style={{ marginLeft: 'auto' }} />
          </Pressable>

          {/* Item 5: Saved Addresses */}
          <Pressable style={styles.menuRow} onPress={() => setActiveModal('addresses')}>
            <View style={styles.menuIconCircle}>
              <MapPin size={18} color="#0F172A" />
            </View>
            <View>
              <Text style={styles.menuRowTitle}>Saved Addresses</Text>
              <Text style={styles.menuRowSub}>
                {addressesList.length > 0
                  ? `${addressesList.length} ${addressesList.length === 1 ? 'Address' : 'Addresses'}`
                  : '0 Addresses'}
              </Text>
            </View>
            <ChevronRight size={16} color="#94A3B8" style={{ marginLeft: 'auto' }} />
          </Pressable>

          {/* Item 6: Profile */}
          <Pressable style={styles.menuRow} onPress={() => setActiveModal('edit-profile')}>
            <View style={styles.menuIconCircle}>
              <User size={18} color="#0F172A" />
            </View>
            <Text style={styles.menuRowTitle}>Profile</Text>
            <ChevronRight size={16} color="#94A3B8" style={{ marginLeft: 'auto' }} />
          </Pressable>

          {/* Item 7: Rewards */}
          <Pressable style={styles.menuRow} onPress={() => setActiveModal('rewards')}>
            <View style={styles.menuIconCircle}>
              <Gift size={18} color="#0F172A" />
            </View>
            <Text style={styles.menuRowTitle}>Rewards</Text>
            <ChevronRight size={16} color="#94A3B8" style={{ marginLeft: 'auto' }} />
          </Pressable>

          {/* Item 8: Payment Management */}
          <Pressable style={[styles.menuRow, { borderBottomWidth: 0 }]} onPress={() => setActiveModal('payments')}>
            <View style={styles.menuIconCircle}>
              <CreditCard size={18} color="#0F172A" />
            </View>
            <Text style={styles.menuRowTitle}>Payment Management</Text>
            <ChevronRight size={16} color="#94A3B8" style={{ marginLeft: 'auto' }} />
          </Pressable>
        </View>

        {/* ── 6. LOG OUT BUTTON ── */}
        <Pressable style={styles.logoutPillBtn} onPress={handleLogout}>
          <LogOut size={14} color="#EF4444" style={{ marginRight: 6 }} />
          <Text style={styles.logoutPillBtnText}>Log Out</Text>
        </Pressable>

        {/* App Version */}
        <Text style={styles.appVersionText}>App version 0.0.1</Text>
      </ScrollView>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── MODAL DIALOGS ── */}
      {/* ───────────────────────────────────────────────────────────── */}

      {/* 1. ADD BALANCE MODAL */}
      <Modal visible={activeModal === 'add-balance'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <Pressable style={styles.closeModalBtn} onPress={() => setActiveModal(null)}>
              <X size={16} color="#475569" />
            </Pressable>
            <Text style={styles.modalTitle}>Top-up Grabit Cash</Text>
            <Text style={styles.modalSub}>Add money for 1-click checkout on all grocery orders.</Text>

            <View style={styles.presetRow}>
              {['100', '250', '500', '1000'].map((amt) => (
                <Pressable
                  key={amt}
                  onPress={() => setAddAmount(amt)}
                  style={[
                    styles.presetBtn,
                    addAmount === amt && styles.presetBtnActive,
                  ]}
                >
                  <Text style={[styles.presetText, addAmount === amt && styles.presetTextActive]}>
                    ₹{amt}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.numericInput}
              keyboardType="numeric"
              value={addAmount}
              onChangeText={setAddAmount}
              placeholder="Custom Amount"
              placeholderTextColor="#94A3B8"
            />

            <Pressable style={styles.primaryActionBtn} onPress={handleAddBalance}>
              <Text style={styles.primaryActionBtnText}>Proceed to Pay ₹{addAmount || 0}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 2. YOUR REFUNDS MODAL */}
      <Modal visible={activeModal === 'refunds'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <Pressable style={styles.closeModalBtn} onPress={() => setActiveModal(null)}>
              <X size={16} color="#475569" />
            </Pressable>
            <Text style={styles.modalTitle}>Your Refunds</Text>

            <Text style={styles.emptyRefundText}>No pending or past refund requests.</Text>
          </View>
        </View>
      </Modal>

      {/* 3. E-GIFT CARDS MODAL */}
      <Modal visible={activeModal === 'gift-cards'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <Pressable style={styles.closeModalBtn} onPress={() => setActiveModal(null)}>
              <X size={16} color="#475569" />
            </Pressable>
            <Text style={styles.modalTitle}>Claim E-Gift Card</Text>
            <Text style={styles.modalSub}>Enter your 16-digit voucher gift code below to claim instant Grabit Cash.</Text>

            <TextInput
              style={styles.numericInput}
              value={giftCardCode}
              onChangeText={setGiftCardCode}
              placeholder="Enter Gift Card Code (e.g. GRAB200)"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
            />

            <Pressable style={styles.primaryActionBtn} onPress={handleClaimGiftCard}>
              <Text style={styles.primaryActionBtnText}>Claim Gift Card ₹200</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 4. SAVED ADDRESSES MODAL */}
      <Modal visible={activeModal === 'addresses'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { maxHeight: '85%' }]}>
            <Pressable
              style={styles.closeModalBtn}
              onPress={() => {
                setActiveModal(null);
                setEditingAddrIdx(null);
                setIsAddingAddress(false);
              }}
            >
              <X size={18} color="#334155" />
            </Pressable>

            {isAddingAddress || editingAddrIdx !== null ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalCenterHeader}>
                  <View style={styles.iconCircleBadge}>
                    <MapPin size={24} color="#0071E3" />
                  </View>
                  <Text style={styles.modalTitle}>
                    {isAddingAddress ? 'Add New Delivery Address' : 'Edit Delivery Address'}
                  </Text>
                  <Text style={styles.modalSub}>Fill in your delivery details below.</Text>
                </View>

                <Text style={styles.inputLabel}>Address Title</Text>
                <TextInput
                  style={styles.numericInput}
                  value={editAddrForm.title}
                  onChangeText={(txt) => setEditAddrForm({ ...editAddrForm, title: txt })}
                  placeholder="e.g. Home, Work, Apartment"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.inputLabel}>Street / House / Building Address</Text>
                <TextInput
                  style={styles.numericInput}
                  value={editAddrForm.address}
                  onChangeText={(txt) => setEditAddrForm({ ...editAddrForm, address: txt })}
                  placeholder="Flat No, Building, Street Name"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.inputLabel}>City, State & Pincode</Text>
                <TextInput
                  style={styles.numericInput}
                  value={editAddrForm.city}
                  onChangeText={(txt) => setEditAddrForm({ ...editAddrForm, city: txt })}
                  placeholder="e.g. Bengaluru, Karnataka 560043"
                  placeholderTextColor="#94A3B8"
                />

                <Pressable
                  style={styles.checkboxRow}
                  onPress={() => setEditAddrForm({ ...editAddrForm, isDefault: !editAddrForm.isDefault })}
                >
                  <View style={[styles.checkboxBox, editAddrForm.isDefault && styles.checkboxChecked]}>
                    {editAddrForm.isDefault && <Check size={12} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.checkboxLabel}>Set as Default Delivery Address</Text>
                </Pressable>

                <View style={styles.formButtonRow}>
                  <Pressable
                    style={styles.cancelBtn}
                    onPress={() => {
                      setEditingAddrIdx(null);
                      setIsAddingAddress(false);
                    }}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>

                  <Pressable style={styles.saveBtn} onPress={handleSaveEditAddress}>
                    <Text style={styles.saveBtnText}>
                      {isAddingAddress ? 'Save Address' : 'Save Changes'}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalCenterHeader}>
                  <View style={styles.iconCircleBadge}>
                    <MapPin size={26} color="#0071E3" />
                  </View>
                  <Text style={styles.modalTitle}>Saved Delivery Locations</Text>
                  <Text style={styles.modalSub}>
                    Add your delivery address to see live stock availability and 10-minute delivery in your area.
                  </Text>
                </View>

                {addressesList.length === 0 ? (
                  <View style={styles.emptyAddressBox}>
                    <MapPin size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
                    <Text style={styles.emptyAddressTitle}>No saved addresses</Text>
                    <Text style={styles.emptyAddressSub}>Add your real delivery address to receive quick delivery.</Text>
                  </View>
                ) : (
                  addressesList.map((addr, i) => (
                    <View
                      key={i}
                      style={[
                        styles.addressCardItem,
                        addr.isDefault && styles.addressCardItemDefault,
                      ]}
                    >
                      <View style={styles.addressTopRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <MapPin size={16} color={addr.isDefault ? '#0071E3' : '#0F172A'} style={{ marginRight: 4 }} />
                          <Text style={[styles.addressTitle, addr.isDefault && { color: '#0071E3' }]}>
                            {addr.label || 'Home'}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {addr.isDefault && (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                            </View>
                          )}
                          <Pressable style={styles.miniEditBtn} onPress={() => handleStartEditAddress(i, addr)}>
                            <Edit2 size={11} color="#0071E3" style={{ marginRight: 2 }} />
                            <Text style={styles.miniEditBtnText}>Edit</Text>
                          </Pressable>
                          <Pressable style={styles.miniDeleteBtn} onPress={() => handleDeleteAddress(i)}>
                            <Text style={styles.miniDeleteBtnText}>Delete</Text>
                          </Pressable>
                        </View>
                      </View>
                      <Text style={styles.addressStreet}>{addr.street}</Text>
                      {!!addr.city && <Text style={styles.addressCity}>{addr.city}</Text>}
                    </View>
                  ))
                )}

                <Pressable style={styles.addNewAddrBtn} onPress={handleStartAddAddress}>
                  <Plus size={16} color="#0071E3" style={{ marginRight: 6 }} />
                  <Text style={styles.addNewAddrBtnText}>Add New Delivery Address</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* 5. EDIT PROFILE MODAL */}
      <Modal visible={activeModal === 'edit-profile'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <Pressable style={styles.closeModalBtn} onPress={() => setActiveModal(null)}>
              <X size={16} color="#475569" />
            </Pressable>
            <Text style={styles.modalTitle}>Edit Account Profile</Text>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.numericInput}
              value={userName}
              onChangeText={setUserName}
              placeholder="Your Full Name"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Mobile Number</Text>
            <TextInput
              style={styles.numericInput}
              value={userPhone}
              onChangeText={setUserPhone}
              placeholder="+91 9876543210"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.numericInput}
              value={userEmail}
              onChangeText={setUserEmail}
              placeholder="name@example.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Pressable
              style={[styles.primaryActionBtn, isSavingProfile && { backgroundColor: '#94A3B8' }]}
              onPress={handleSaveProfile}
              disabled={isSavingProfile}
            >
              <Text style={styles.primaryActionBtnText}>
                {isSavingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 6. REWARDS MODAL */}
      <Modal visible={activeModal === 'rewards'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <Pressable style={styles.closeModalBtn} onPress={() => setActiveModal(null)}>
              <X size={16} color="#475569" />
            </Pressable>

            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={styles.trophyCircle}>
                <Text style={{ fontSize: 28 }}>🏆</Text>
              </View>
              <Text style={styles.modalTitle}>Grabit Rewards Member</Text>
              <Text style={styles.modalSub}>Earn 1 coin for every ₹10 spent on Grabit.</Text>
            </View>

            <View style={styles.coinBalanceCard}>
              <Text style={styles.coinBalanceLabel}>YOUR COIN BALANCE</Text>
              <Text style={styles.coinBalanceVal}>250 Grabit Coins</Text>
            </View>

            <Pressable
              style={styles.primaryActionBtn}
              onPress={() => {
                notify('Promo code GRABIT100 copied!');
                setActiveModal(null);
              }}
            >
              <Text style={styles.primaryActionBtnText}>Redeem Code GRABIT100 (₹100 OFF)</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 7. PAYMENT MANAGEMENT MODAL */}
      <Modal visible={activeModal === 'payments'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <Pressable style={styles.closeModalBtn} onPress={() => setActiveModal(null)}>
              <X size={16} color="#475569" />
            </Pressable>
            <Text style={styles.modalTitle}>Saved Payment Methods</Text>

            <View style={styles.paymentMethodCard}>
              <View>
                <Text style={styles.paymentMethodTitle}>Google Pay / UPI</Text>
                <Text style={styles.paymentMethodSub}>akash@okaxis</Text>
              </View>
              <Text style={styles.primaryPaymentBadge}>✓ PRIMARY</Text>
            </View>

            <View style={styles.paymentMethodCard}>
              <View>
                <Text style={styles.paymentMethodTitle}>HDFC Visa Credit Card</Text>
                <Text style={styles.paymentMethodSub}>•••• •••• •••• 4821</Text>
              </View>
              <Text style={styles.savedPaymentBadge}>SAVED</Text>
            </View>

            <Pressable
              style={styles.primaryActionBtn}
              onPress={() => {
                notify('Redirecting to payment setup...');
                setActiveModal(null);
              }}
            >
              <Text style={styles.primaryActionBtnText}>+ Add New UPI / Card</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F5F8',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtnCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
    ...SHADOWS.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },

  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 100,
  },

  /* Profile summary header card */
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  blueAvatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0071E3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    ...SHADOWS.md,
  },
  profileTextColumn: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  profilePhone: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },

  /* Top 3 shortcut tiles */
  shortcutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  shortcutTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    ...SHADOWS.sm,
  },
  shortcutTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 15,
  },

  /* Grabit Cash Wallet Card */
  walletCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 16,
    marginBottom: 20,
  },
  walletHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  walletIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#0071E3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  walletTitle: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#0F172A',
    marginRight: 6,
  },
  newTagBadge: {
    backgroundColor: '#10B981',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  newTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  walletBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  availableBalanceText: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '600',
  },
  balanceVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  addBalanceBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0071E3',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  addBalanceBtnText: {
    color: '#0071E3',
    fontSize: 12,
    fontWeight: '900',
  },

  /* Menu List Card */
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 8,
    marginLeft: 4,
  },
  menuListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuRowTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  menuRowSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },

  /* Logout button */
  logoutPillBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 8,
    ...SHADOWS.sm,
  },
  logoutPillBtnText: {
    color: '#EF4444',
    fontSize: 12.5,
    fontWeight: '800',
  },

  appVersionText: {
    fontSize: 10.5,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 20,
  },

  /* Modals Overlay & Card */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    maxWidth: 420,
    width: '100%',
    padding: 24,
    position: 'relative',
    ...SHADOWS.md,
  },
  closeModalBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 12.5,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 18,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  presetBtnActive: {
    borderWidth: 2,
    borderColor: '#0071E3',
    backgroundColor: '#EFF6FF',
  },
  presetText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  presetTextActive: {
    color: '#0071E3',
  },
  numericInput: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  primaryActionBtn: {
    width: '100%',
    backgroundColor: '#0071E3',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  /* Refunds Modal specific */
  refundCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  refundHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  refundOrderId: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  refundStatusBadge: {
    backgroundColor: '#DCFCE7',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  refundStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
  },
  refundDetails: {
    fontSize: 11,
    color: '#64748B',
  },
  emptyRefundText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
  },

  /* Address modal components */
  modalCenterHeader: {
    alignItems: 'center',
    marginBottom: 18,
  },
  iconCircleBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyAddressBox: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  emptyAddressTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptyAddressSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  addressCardItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
  },
  addressCardItemDefault: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1.5,
  },
  addressTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  addressTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  defaultBadge: {
    backgroundColor: '#0071E3',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  miniEditBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniEditBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0071E3',
  },
  miniDeleteBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  miniDeleteBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EF4444',
  },
  addressStreet: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  addressCity: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  addNewAddrBtn: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  addNewAddrBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0071E3',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#0071E3',
    borderColor: '#0071E3',
  },
  checkboxLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  formButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#0071E3',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  /* Rewards & Payment Modals */
  trophyCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  coinBalanceCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 14,
  },
  coinBalanceLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  coinBalanceVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0071E3',
    marginTop: 2,
  },
  paymentMethodCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentMethodTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  paymentMethodSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  primaryPaymentBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
  },
  savedPaymentBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
});
