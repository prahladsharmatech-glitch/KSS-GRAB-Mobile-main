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

import { DeliveryLocationMapPicker } from './DeliveryLocationMapPicker';

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
  const [modalView, setModalView] = useState<'options' | 'map'>('options');

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
      {/* ── COMPACT TOP HEADER ── */}
      <View style={[styles.topHeader, !showBorderBottom && { borderBottomWidth: 0 }]}>
        <View style={styles.headerLeftCol}>
          <Pressable onPress={() => router.push('/customer' as any)}>
            <Image
              source={{ uri: getCloudinaryUrl('grabit-logo.png') }}
              style={styles.brandLogoImg}
              resizeMode="contain"
            />
          </Pressable>

          <Pressable
            style={styles.locationPillRow}
            onPress={() => {
              setModalView('options');
              setIsLocationModalOpen(true);
            }}
          >
            <MapPin size={12} color="#0066FF" style={{ marginRight: 4 }} />
            <Text style={styles.locationText} numberOfLines={1}>
              {currentAddress.street || 'Kalyanagar, Bengaluru'}
            </Text>
            <ChevronDown size={12} color="#0066FF" style={{ marginLeft: 3 }} />
          </Pressable>
        </View>

        <View style={styles.headerRightIcons}>
          <Pressable style={styles.iconCircle} onPress={() => setIsNotifModalOpen(true)}>
            <Bell size={16} color="#0066FF" />
            {unreadNotifCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
              </View>
            )}
          </Pressable>

          <Pressable style={styles.iconCircle} onPress={() => router.push('/customer/cart' as any)}>
            <ShoppingBag size={16} color="#0066FF" />
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

      {/* ── COMPACT LOCATION SELECTION MODAL ── */}
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
            {/* Modal Header */}
            <View style={styles.locModalHeader}>
              <View style={styles.locModalHeaderLeft}>
                <MapPin size={17} color="#0066FF" style={{ marginRight: 6 }} />
                <Text style={styles.locModalTitle}>Delivery Location</Text>
              </View>
              <Pressable
                style={styles.locModalCloseBtn}
                onPress={() => setIsLocationModalOpen(false)}
              >
                <X size={15} color="#64748B" />
              </Pressable>
            </View>

            {modalView === 'map' ? (
              <View style={{ width: '100%', marginTop: 8 }}>
                <DeliveryLocationMapPicker
                  initialLat={currentAddress.latitude || 12.9716}
                  initialLng={currentAddress.longitude || 77.5946}
                  height={175}
                  onSelectLocation={(lat, lng) => {
                    showToast(`Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'success');
                  }}
                />
                <View style={styles.mapActionRow}>
                  <Pressable
                    style={styles.mapBackBtn}
                    onPress={() => setModalView('options')}
                  >
                    <Text style={styles.mapBackBtnText}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={styles.mapConfirmBtn}
                    onPress={() => {
                      setIsLocationModalOpen(false);
                      showToast('Location confirmed from map', 'success');
                    }}
                  >
                    <Text style={styles.mapConfirmBtnText}>Confirm Location</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.locModalSub}>
                  Select your address for 10-minute instant delivery
                </Text>

                {/* 2 Compact Action Buttons Row */}
                <View style={styles.locActionRow}>
                  <Pressable
                    style={styles.locActionBtnPrimary}
                    onPress={async () => {
                      showToast('Detecting current GPS location...', 'info');
                      await fetchCurrentLocation();
                      setIsLocationModalOpen(false);
                    }}
                  >
                    <Navigation size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
                    <Text style={styles.locActionBtnPrimaryText}>Use Current GPS</Text>
                  </Pressable>

                  <Pressable
                    style={styles.locActionBtnSecondary}
                    onPress={() => setModalView('map')}
                  >
                    <MapPin size={13} color="#0066FF" style={{ marginRight: 5 }} />
                    <Text style={styles.locActionBtnSecondaryText}>Pin on Map</Text>
                  </Pressable>
                </View>

                {/* Saved Address Card */}
                <Pressable
                  style={styles.savedAddrCompactCard}
                  onPress={() => {
                    setIsLocationModalOpen(false);
                    showToast('Location selected', 'success');
                  }}
                >
                  <View style={styles.savedAddrCompactLeft}>
                    <View style={styles.savedAddrTagRow}>
                      <MapPin size={12} color="#0066FF" style={{ marginRight: 4 }} />
                      <Text style={styles.savedAddrTag}>Current Address</Text>
                      <View style={styles.expressMiniBadge}>
                        <Text style={styles.expressMiniBadgeText}>⚡ 10-15m</Text>
                      </View>
                    </View>
                    <Text style={styles.savedAddrCompactText} numberOfLines={1}>
                      {currentAddress.street || 'Kalyanagar, Bengaluru 560043'}
                    </Text>
                  </View>
                  <View style={styles.savedAddrActionPill}>
                    <Text style={styles.savedAddrActionText}>Selected</Text>
                  </View>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  /* Compact Top Header */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.md,
    paddingTop: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeftCol: {
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  brandLogoImg: {
    width: 84,
    height: 24,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  locationPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderRadius: 8,
    maxWidth: '94%',
  },
  locationText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  headerRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
    top: -3,
    right: -3,
    backgroundColor: '#0066FF',
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '900',
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#34C759',
    borderRadius: 8,
    width: 15,
    height: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '900',
  },

  /* Compact Location Modal Styles */
  locModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  locModalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  locModalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    ...SHADOWS.lg,
    elevation: 10,
  },
  locModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  locModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  locModalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locModalSub: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 15,
    marginBottom: 12,
  },
  locActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  locActionBtnPrimary: {
    flex: 1,
    height: 38,
    backgroundColor: '#0066FF',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  locActionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  locActionBtnSecondary: {
    flex: 1,
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#0066FF',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locActionBtnSecondaryText: {
    color: '#0066FF',
    fontSize: 12,
    fontWeight: '800',
  },
  savedAddrCompactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
  },
  savedAddrCompactLeft: {
    flex: 1,
    marginRight: 8,
  },
  savedAddrTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  savedAddrTag: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginRight: 6,
  },
  expressMiniBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  expressMiniBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0066FF',
  },
  savedAddrCompactText: {
    fontSize: 11,
    color: '#64748B',
  },
  savedAddrActionPill: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  savedAddrActionText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0066FF',
  },
  mapActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  mapBackBtn: {
    flex: 1,
    height: 36,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapBackBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  mapConfirmBtn: {
    flex: 2,
    height: 36,
    backgroundColor: '#0066FF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapConfirmBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
