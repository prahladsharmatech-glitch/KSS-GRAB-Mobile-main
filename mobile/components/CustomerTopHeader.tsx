import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  MapPin,
  Bell,
  ShoppingBag,
  ChevronDown,
  Navigation,
  X,
  Edit,
  Plus,
} from 'lucide-react-native';
import { useCart } from '../context/CartContext';
import { useLocation } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getCloudinaryUrl } from '../services/cloudinary';
import { NotificationModal } from './NotificationModal';
import { getRealUserNotifications } from '../utils/userNotifications';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';

interface CustomerTopHeaderProps {
  showBorderBottom?: boolean;
}

export const CustomerTopHeader: React.FC<CustomerTopHeaderProps> = ({
  showBorderBottom = true,
}) => {
  const router = useRouter();
  const { totalItems } = useCart();
  const { currentAddress, fetchCurrentLocation } = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  const loadNotifications = React.useCallback(() => {
    getRealUserNotifications(user?.phone).then((list) => {
      setUnreadNotifCount(list.filter((n) => n.unread).length);
    });
  }, [user?.phone]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications, isNotifModalOpen]);

  useFocusEffect(
    React.useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  return (
    <>
      {/* ── EXACT TOP HEADER MATCHING CUSTOMER HOME PAGE ── */}
      <View style={[styles.topHeader, !showBorderBottom && { borderBottomWidth: 0 }]}>
        <View style={styles.headerLeftCol}>
          <Pressable onPress={() => router.push('/customer' as any)}>
            <Image
              source={{ uri: getCloudinaryUrl('grabit-logo.png') }}
              style={styles.brandLogoImg}
              resizeMode="contain"
            />
          </Pressable>

          <Pressable style={styles.locationPillRow} onPress={() => setIsLocationModalOpen(true)}>
            <MapPin size={13} color="#0066FF" style={{ marginRight: 4 }} />
            <Text style={styles.locationPrefixText}>Pinned Location - </Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {currentAddress.street || 'Kalyanagar, Bengaluru'}
            </Text>
            <ChevronDown size={13} color="#0066FF" style={{ marginLeft: 3 }} />
          </Pressable>
        </View>

        <View style={styles.headerRightIcons}>
          <Pressable style={styles.iconCircle} onPress={() => setIsNotifModalOpen(true)}>
            <Bell size={18} color="#0066FF" />
            {unreadNotifCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
              </View>
            )}
          </Pressable>

          <Pressable style={styles.iconCircle} onPress={() => router.push('/customer/cart' as any)}>
            <ShoppingBag size={18} color="#0066FF" />
            {totalItems > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalItems}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      {/* ── NOTIFICATION MODAL ── */}
      <NotificationModal
        visible={isNotifModalOpen}
        onClose={() => {
          setIsNotifModalOpen(false);
          loadNotifications();
        }}
      />

      {/* ── LOCATION SELECTION MODAL ── */}
      <Modal
        visible={isLocationModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLocationModalOpen(false)}
      >
        <View style={styles.locModalOverlay}>
          <Pressable
            style={styles.locModalBackdrop}
            onPress={() => setIsLocationModalOpen(false)}
          />

          <View style={styles.locModalContent}>
            {/* Top Close Button */}
            <Pressable
              style={styles.locModalCloseBtn}
              onPress={() => setIsLocationModalOpen(false)}
            >
              <X size={16} color="#64748B" />
            </Pressable>

            {/* Top Icon Badge */}
            <View style={styles.locModalIconBadge}>
              <MapPin size={22} color="#0066FF" />
            </View>

            {/* Title & Subtitle */}
            <Text style={styles.locModalTitle}>Select Delivery Location</Text>
            <Text style={styles.locModalSub}>
              Add your delivery address to see live stock availability and 10-minute delivery in your area.
            </Text>

            {/* Button 1: Use Current Location */}
            <Pressable
              style={styles.locPrimaryBtn}
              onPress={async () => {
                showToast('Fetching current GPS location...', 'info');
                await fetchCurrentLocation();
                setIsLocationModalOpen(false);
              }}
            >
              <View style={styles.locBtnIconCol}>
                <Navigation size={18} color="#FFFFFF" />
              </View>
              <View style={styles.locBtnTextCol}>
                <Text style={styles.locPrimaryBtnTitle}>Use Current Location</Text>
                <Text style={styles.locPrimaryBtnSub}>Detect device GPS & fetch street address</Text>
              </View>
            </Pressable>

            {/* Button 2: Set Address / Pin on Map */}
            <Pressable
              style={styles.locSecondaryBtn}
              onPress={() => {
                setIsLocationModalOpen(false);
                router.push('/customer/address-picker' as any);
              }}
            >
              <View style={styles.locBtnIconCol}>
                <MapPin size={18} color="#0066FF" />
              </View>
              <View style={styles.locBtnTextCol}>
                <Text style={styles.locSecondaryBtnTitle}>Set Address / Pin on Map</Text>
                <Text style={styles.locSecondaryBtnSub}>Interactive map picker & address search</Text>
              </View>
            </Pressable>

            {/* Divider */}
            <View style={styles.locDividerRow}>
              <View style={styles.locDividerLine} />
              <Text style={styles.locDividerText}>OR CHOOSE FROM SAVED ADDRESSES</Text>
              <View style={styles.locDividerLine} />
            </View>

            {/* Saved Address Card (Pinned Location) */}
            <View style={styles.savedAddrCard}>
              <View style={styles.savedAddrHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MapPin size={16} color="#0066FF" style={{ marginRight: 6 }} />
                  <Text style={styles.savedAddrTitle}>Pinned Location</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Pressable
                    style={styles.editAddrPill}
                    onPress={() => {
                      setIsLocationModalOpen(false);
                      showToast('Opening address edit form...', 'info');
                    }}
                  >
                    <Edit size={11} color="#0066FF" style={{ marginRight: 3 }} />
                    <Text style={styles.editAddrText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={styles.deleteAddrPill}
                    onPress={() => showToast('Address deleted', 'info')}
                  >
                    <Text style={styles.deleteAddrText}>Delete</Text>
                  </Pressable>
                </View>
              </View>

              <Text style={styles.savedAddrMainText}>Kalyanagar, Kalyanagar</Text>
              <Text style={styles.savedAddrExpressBadge}>12-20 min express delivery</Text>
              <Text style={styles.savedAddrSubText}>Bengaluru 560043, Karnataka 560043</Text>
            </View>

            {/* Bottom Dashed Button: Enter Address Details Manually */}
            <Pressable
              style={styles.manualAddrBtn}
              onPress={() => {
                setIsLocationModalOpen(false);
                showToast('Opening manual address form...', 'info');
              }}
            >
              <Plus size={16} color="#0066FF" style={{ marginRight: 6 }} />
              <Text style={styles.manualAddrBtnText}>Enter Address Details Manually</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  /* Top Header matching Screenshot 1 */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeftCol: {
    flex: 1,
    marginRight: 8,
  },
  brandLogoImg: {
    width: 110,
    height: 34,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  locationPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  locationPrefixText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  locationText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    maxWidth: 140,
  },
  headerRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    position: 'relative',
    ...SHADOWS.sm,
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#0066FF',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#34C759',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },

  /* Location Selection Modal Styles */
  locModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  locModalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  locModalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: SPACING.lg,
    alignItems: 'center',
    position: 'relative',
    ...SHADOWS.lg,
    elevation: 12,
  },
  locModalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  locModalIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  locModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  locModalSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  locPrimaryBtn: {
    width: '100%',
    backgroundColor: '#0066FF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    ...SHADOWS.sm,
  },
  locSecondaryBtn: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0066FF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  locBtnIconCol: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locBtnTextCol: {
    flex: 1,
  },
  locPrimaryBtnTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  locPrimaryBtnSub: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 1,
  },
  locSecondaryBtnTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0066FF',
  },
  locSecondaryBtnSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  locDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    width: '100%',
  },
  locDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  locDividerText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94A3B8',
    marginHorizontal: 8,
    letterSpacing: 0.5,
  },
  savedAddrCard: {
    width: '100%',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#0066FF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  savedAddrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  savedAddrTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0066FF',
  },
  editAddrPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  editAddrText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0066FF',
  },
  deleteAddrPill: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  deleteAddrText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EF4444',
  },
  savedAddrMainText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 2,
  },
  savedAddrExpressBadge: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0066FF',
    marginBottom: 4,
  },
  savedAddrSubText: {
    fontSize: 11,
    color: '#64748B',
  },
  manualAddrBtn: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualAddrBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0066FF',
  },
});
