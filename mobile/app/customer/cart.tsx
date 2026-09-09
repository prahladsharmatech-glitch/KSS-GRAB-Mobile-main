import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
} from 'react-native';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../context/LocationContext';
import { useToast } from '../../context/ToastContext';
import { EmptyState } from '../../components/EmptyState';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { optimizeImageUrl } from '../../services/cloudinary';
import {
  Search,
  MapPin,
  Bell,
  ShoppingBag,
  ArrowLeft,
  Zap,
  Lock,
  Clock,
  FileText,
  Plus,
  Minus,
  Tag,
  CheckCircle2,
  X,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { CustomerTopHeader } from '../../components/CustomerTopHeader';
import { SearchAutocomplete } from '../../components/SearchAutocomplete';

export default function CartPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentAddress, fetchCurrentLocation } = useLocation();
  const {
    cart,
    updateQuantity,
    totalItems,
    itemTotal,
    mrpTotal,
    discount,
    deliveryFee,
    toPay,
    appliedCoupon,
    couponDiscount,
    applyCoupon,
    removeCoupon,
    AVAILABLE_COUPONS,
  } = useCart();
  const { showToast } = useToast();

  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [couponInputCode, setCouponInputCode] = useState('');
  const [couponFeedback, setCouponFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const couponTimerRef = useRef<any>(null);

  const availableCouponsCount = (AVAILABLE_COUPONS || []).filter(
    (c) => !(c.discountType === 'free_delivery' && (deliveryFee === 0 || itemTotal >= 100))
  ).length;

  const maxSavings = Math.max(
    ...(AVAILABLE_COUPONS || []).map((c) =>
      c.discountType === 'free_delivery' ? (deliveryFee || 30) : c.discountValue
    ),
    100
  );

  const handleCloseCouponModal = () => {
    if (couponTimerRef.current) {
      clearTimeout(couponTimerRef.current);
      couponTimerRef.current = null;
    }
    setIsCouponModalOpen(false);
    setCouponFeedback(null);
    setCouponInputCode('');
  };

  const handleApplyCouponCode = (code: string) => {
    if (couponTimerRef.current) {
      clearTimeout(couponTimerRef.current);
      couponTimerRef.current = null;
    }
    const res = applyCoupon(code);
    if (res.success) {
      setCouponFeedback({ type: 'success', text: res.message });
      showToast(res.message, 'success');
      couponTimerRef.current = setTimeout(() => {
        setIsCouponModalOpen(false);
        setCouponFeedback(null);
        setCouponInputCode('');
        couponTimerRef.current = null;
      }, 1200);
    } else {
      setCouponFeedback({ type: 'error', text: res.message });
      showToast(res.message, 'error');
    }
  };

  if (cart.length === 0) {
    return (
      <View style={styles.container}>
        <CustomerTopHeader />

        <View style={[styles.searchHeaderRow, { zIndex: 9999 }]}>
          <Pressable style={styles.backBtnCircle} onPress={() => router.back()}>
            <ArrowLeft size={18} color="#1E293B" />
          </Pressable>
          <View style={{ flex: 1, zIndex: 9999 }}>
            <SearchAutocomplete placeholder="Search for milk, butter, chips, snacks..." />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.pageTitle}>Cart (0 Items)</Text>

          <View style={styles.emptyCartCard}>
            <View style={styles.cartIconBadge}>
              <ShoppingBag size={34} color="#64748B" />
            </View>
            <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
            <Text style={styles.emptyCartSubtitle}>
              Add items from the store to continue shopping
            </Text>
            <TouchableOpacity
              style={styles.startShoppingBtn}
              activeOpacity={0.85}
              onPress={() => router.push('/customer' as any)}
            >
              <Text style={styles.startShoppingBtnText}>Start Shopping</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── 1. EXACT HOME PAGE TOP HEADER ── */}
      <CustomerTopHeader />

      {/* ── 2. BACK BUTTON & GLOBAL SEARCH BAR ── */}
      <View style={[styles.searchHeaderRow, { zIndex: 9999 }]}>
        <Pressable style={styles.backBtnCircle} onPress={() => router.back()}>
          <ArrowLeft size={18} color="#1E293B" />
        </Pressable>

        <View style={{ flex: 1, zIndex: 9999 }}>
          <SearchAutocomplete placeholder="Search for milk, butter, chips, snacks..." />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── 3. PAGE TITLE ── */}
        <Text style={styles.pageTitle}>Cart ({totalItems} Items)</Text>

        {/* ── 4. COUPONS & OFFERS CARD ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardSectionTitle}>Coupons & offers</Text>

          {!user ? (
            <View style={styles.couponsLockBox}>
              <View style={styles.lockIconCircle}>
                <Lock size={18} color="#111827" />
              </View>
              <Text style={styles.lockTitle}>Login to view coupons</Text>
              <Text style={styles.lockSub}>
                Log in to see 100+ coupons & unlocked bank cashback offers
              </Text>
            </View>
          ) : appliedCoupon ? (
            <View style={styles.appliedCouponBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                <CheckCircle2 size={20} color="#10B981" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.appliedCouponTitle}>
                    Coupon "{appliedCoupon.code}" Applied!
                  </Text>
                  <Text style={styles.appliedCouponSub}>
                    {appliedCoupon.discountType === 'free_delivery'
                      ? 'Free Express Delivery unlocked'
                      : `Saved extra ₹${couponDiscount} on this order`}
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.removeCouponBtn}
                onPress={() => {
                  removeCoupon();
                  showToast('Coupon removed', 'info');
                }}
              >
                <Text style={styles.removeCouponText}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.unlockedCouponBanner}
              onPress={() => setIsCouponModalOpen(true)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <Tag size={20} color="#10B981" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.unlockedCouponTitle}>
                    {availableCouponsCount} Coupons Available
                  </Text>
                  <Text style={styles.unlockedCouponSub}>
                    Save up to ₹{maxSavings} extra with promo codes
                  </Text>
                </View>
              </View>
              <Text style={styles.applyArrowText}>Apply →</Text>
            </Pressable>
          )}
        </View>

        {/* ── 5. DELIVERING IN MINUTES & CART ITEMS CARD ── */}
        <View style={styles.sectionCard}>
          <View style={styles.deliveringHeader}>
            <View style={styles.clockIconCircle}>
              <Clock size={16} color="#0F172A" />
            </View>
            <View>
              <Text style={styles.deliveringTitle}>Delivering in minutes</Text>
              <Text style={styles.deliveringSub}>{totalItems} items</Text>
            </View>
          </View>

          {/* Cart Item List */}
          {cart.map(({ product, quantity }) => (
            <View key={product.id} style={styles.itemRow}>
              <Image
                source={{ uri: optimizeImageUrl(product.image, 200) }}
                style={styles.itemImage}
                resizeMode="contain"
              />

              <View style={styles.itemDetails}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {product.name}
                </Text>
                <Text style={styles.itemWeight}>
                  {(product as any).unit || (product as any).weight || '1 unit'} • ₹{product.price}
                </Text>
              </View>

              {/* Pink Soft Stepper */}
              <View style={styles.qtyPinkStepper}>
                <Pressable
                  style={styles.pinkStepperBtn}
                  onPress={() => updateQuantity(product.id, quantity - 1)}
                >
                  <Minus size={13} color="#E11D48" />
                </Pressable>
                <Text style={styles.pinkQtyText}>{quantity}</Text>
                <Pressable
                  style={styles.pinkStepperBtn}
                  onPress={() => updateQuantity(product.id, quantity + 1)}
                >
                  <Plus size={13} color="#E11D48" />
                </Pressable>
              </View>

              <Text style={styles.itemTotalPrice}>₹{product.price * quantity}</Text>
            </View>
          ))}

          {/* Forgot Something Link */}
          <View style={styles.addMoreRow}>
            <Text style={styles.addMoreText}>
              Forgot something?{' '}
              <Text style={styles.addMoreLink} onPress={() => router.push('/customer' as any)}>
                Add More Items
              </Text>
            </Text>
          </View>
        </View>

        {/* ── 6. BILL SUMMARY CARD ── */}
        <View style={styles.sectionCard}>
          <View style={styles.billHeaderRow}>
            <FileText size={18} color="#0F172A" style={{ marginRight: 6 }} />
            <Text style={styles.billHeaderTitle}>Bill Summary</Text>
          </View>

          <View style={styles.billLineRow}>
            <Text style={styles.billLineLabel}>Item Total</Text>
            <Text style={styles.billLineVal}>₹{itemTotal}</Text>
          </View>

          {discount > 0 ? (
            <View style={styles.billLineRow}>
              <Text style={[styles.billLineLabel, { color: '#059669' }]}>Product Discount</Text>
              <Text style={[styles.billLineVal, { color: '#059669', fontWeight: '800' }]}>
                -₹{discount}
              </Text>
            </View>
          ) : null}

          {appliedCoupon && couponDiscount > 0 ? (
            <View style={styles.billLineRow}>
              <Text style={[styles.billLineLabel, { color: '#059669', fontWeight: '700' }]}>
                Coupon Discount ({appliedCoupon.code})
              </Text>
              <Text style={[styles.billLineVal, { color: '#059669', fontWeight: '900' }]}>
                -₹{couponDiscount}
              </Text>
            </View>
          ) : null}

          <View style={styles.billLineRow}>
            <Text style={styles.billLineLabel}>Delivery Charge</Text>
            <Text style={[styles.billLineVal, { color: deliveryFee === 0 ? '#059669' : '#0F172A', fontWeight: '900' }]}>
              {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
            </Text>
          </View>

          <View style={styles.dividerLine} />

          <View style={styles.billLineRow}>
            <Text style={styles.grandTotalLabel}>To Pay</Text>
            <Text style={styles.grandTotalVal}>₹{toPay}</Text>
          </View>

          {/* Cream Info Banner */}
          <View style={styles.creamInfoBox}>
            <Text style={styles.creamInfoText}>
              Applicable charges and discounts will be calculated based on your delivery details.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ── 7. STICKY BOTTOM ACTION FOOTER ── */}
      <View style={styles.stickyFooter}>
        <Pressable
          style={styles.actionMagentaBtn}
          onPress={() => router.push('/customer/checkout' as any)}
        >
          <Text style={styles.actionMagentaBtnText}>
            PROCEED TO CHECKOUT • ₹{toPay}
          </Text>
        </Pressable>
      </View>

      {/* ── 🌟 INTERACTIVE COUPONS & OFFERS MODAL ── */}
      <Modal
        visible={isCouponModalOpen}
        transparent
        animationType="slide"
        onRequestClose={handleCloseCouponModal}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCloseCouponModal}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Pressable style={styles.modalCloseBtn} onPress={handleCloseCouponModal}>
              <X size={16} color="#0F172A" />
            </Pressable>

            <View style={styles.modalHeaderRow}>
              <Tag size={22} color="#0071E3" style={{ marginRight: 8 }} />
              <Text style={styles.modalHeaderTitle}>Coupons & Offers</Text>
            </View>

            {/* Custom Promo Code Input Box */}
            <View style={styles.modalInputRow}>
              <TextInput
                style={styles.modalInput}
                placeholder="ENTER PROMO CODE (e.g. GRABIT50)"
                placeholderTextColor="#94A3B8"
                value={couponInputCode}
                onChangeText={(t) => setCouponInputCode(t.toUpperCase())}
                autoCapitalize="characters"
              />
              <Pressable
                style={styles.modalApplyBtn}
                onPress={() => handleApplyCouponCode(couponInputCode)}
              >
                <Text style={styles.modalApplyBtnText}>Apply</Text>
              </Pressable>
            </View>

            {couponFeedback ? (
              <View
                style={[
                  styles.feedbackBanner,
                  couponFeedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
                ]}
              >
                <Text
                  style={[
                    styles.feedbackText,
                    couponFeedback.type === 'success' ? styles.feedbackSuccessText : styles.feedbackErrorText,
                  ]}
                >
                  {couponFeedback.text}
                </Text>
              </View>
            ) : null}

            {/* Available Coupons List */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              <Text style={styles.availableSectionHeading}>Available Coupons for You</Text>

              {(AVAILABLE_COUPONS || []).map((c) => {
                const isFreeDeliveryAlready = c.discountType === 'free_delivery' && itemTotal >= 100;
                const isEligible = itemTotal >= c.minOrder && !isFreeDeliveryAlready;
                const isCurrent = appliedCoupon?.code === c.code;

                return (
                  <View
                    key={c.code}
                    style={[styles.couponCardItem, isCurrent && styles.couponCardItemActive]}
                  >
                    <View style={styles.couponCardHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={styles.badgePill}>
                          <Text style={styles.badgePillText}>{c.badge}</Text>
                        </View>
                        <Text style={styles.couponTitle}>{c.title}</Text>
                        <Text style={styles.couponDesc}>{c.description}</Text>
                      </View>

                      {isFreeDeliveryAlready ? (
                        <View style={styles.freeDelBadge}>
                          <Text style={styles.freeDelBadgeText}>FREE DELIVERY</Text>
                        </View>
                      ) : isEligible ? (
                        <Pressable
                          style={[styles.couponActionBtn, isCurrent && styles.couponActionBtnApplied]}
                          onPress={() => handleApplyCouponCode(c.code)}
                        >
                          <Text style={styles.couponActionBtnText}>
                            {isCurrent ? 'APPLIED' : 'APPLY'}
                          </Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={styles.lockedBadge}
                          onPress={() => {
                            const diff = c.minOrder - itemTotal;
                            setCouponFeedback({
                              type: 'error',
                              text: `Add ₹${diff} more items to apply code ${c.code}`,
                            });
                          }}
                        >
                          <Text style={styles.lockedBadgeText}>LOCKED</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0066FF',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  brandIcon: {
    marginRight: 4,
  },
  brandName: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: -0.5,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    maxWidth: 160,
  },
  locationText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 4,
    marginRight: 4,
  },
  locationChevron: {
    fontSize: 10,
    color: '#0066FF',
    fontWeight: '800',
  },
  headerRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    position: 'relative',
    ...SHADOWS.sm,
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },

  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  backBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  globalSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    height: 38,
    paddingHorizontal: 10,
  },
  globalSearchPlaceholder: {
    fontSize: 12,
    color: '#64748B',
  },

  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 110,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: SPACING.md,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 12,
  },

  /* Coupons & Offers Banner */
  couponsLockBox: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1.5,
    borderColor: '#E9D5FF',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  lockTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
  },
  lockSub: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 2,
  },

  unlockedCouponBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
  },
  unlockedCouponTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#065F46',
  },
  unlockedCouponSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
    marginTop: 2,
  },
  applyArrowText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#10B981',
  },

  appliedCouponBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
  },
  appliedCouponTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#065F46',
  },
  appliedCouponSub: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#047857',
    marginTop: 2,
  },
  removeCouponBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  removeCouponText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EF4444',
  },

  /* Delivering Header */
  deliveringHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  clockIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deliveringTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  deliveringSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    marginRight: 10,
  },
  itemDetails: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  itemWeight: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  qtyPinkStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginRight: 10,
  },
  pinkStepperBtn: {
    padding: 2,
  },
  pinkQtyText: {
    color: '#E11D48',
    fontWeight: '900',
    fontSize: 12,
    marginHorizontal: 8,
  },
  itemTotalPrice: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    minWidth: 45,
    textAlign: 'right',
  },

  addMoreRow: {
    alignItems: 'center',
    paddingTop: SPACING.md,
  },
  addMoreText: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '500',
  },
  addMoreLink: {
    color: '#FF0055',
    fontWeight: '800',
  },

  billHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  billHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  billLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  billLineLabel: {
    fontSize: 13,
    color: '#475569',
  },
  billLineVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: SPACING.sm,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  grandTotalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },

  creamInfoBox: {
    backgroundColor: '#FEFCE8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FEF08A',
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  creamInfoText: {
    fontSize: 11,
    color: '#854D0E',
    lineHeight: 16,
  },

  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    ...SHADOWS.lg,
  },
  actionMagentaBtn: {
    backgroundColor: '#FF0055',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionMagentaBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
    position: 'relative',
    ...SHADOWS.lg,
  },
  modalCloseBtn: {
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
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modalInput: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalApplyBtn: {
    backgroundColor: '#0071E3',
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalApplyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  feedbackBanner: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  feedbackSuccess: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  feedbackError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '800',
  },
  feedbackSuccessText: {
    color: '#065F46',
  },
  feedbackErrorText: {
    color: '#991B1B',
  },

  availableSectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  couponCardItem: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  couponCardItemActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#0071E3',
  },
  couponCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  badgePill: {
    backgroundColor: '#DBEAFE',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#1E40AF',
  },
  couponTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  couponDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  couponActionBtn: {
    backgroundColor: '#0071E3',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  couponActionBtnApplied: {
    backgroundColor: '#10B981',
  },
  couponActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  freeDelBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  freeDelBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  lockedBadge: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  lockedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },

  emptyCartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 36,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  cartIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyCartTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyCartSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 22,
    maxWidth: 280,
  },
  startShoppingBtn: {
    backgroundColor: '#0066FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  startShoppingBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
