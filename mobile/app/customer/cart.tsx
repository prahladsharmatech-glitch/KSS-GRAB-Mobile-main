import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../context/LocationContext';
import { useToast } from '../../context/ToastContext';
import { EmptyState } from '../../components/EmptyState';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { optimizeImageUrl, DEFAULT_FALLBACK_IMAGE } from '../../services/cloudinary';
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
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function CartPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentAddress, fetchCurrentLocation } = useLocation();
  const {
    cart,
    updateQuantity,
    totalItems,
    totalAmount,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    discountAmount,
  } = useCart();
  const { showToast } = useToast();

  const [couponInput, setCouponInput] = useState('');

  const deliveryFee = totalAmount > 200 ? 0 : 25;
  const computedDiscount = discountAmount > 0 ? discountAmount : 5;
  const grandTotal = Math.max(0, totalAmount + deliveryFee - computedDiscount);

  const handleApplyCoupon = () => {
    if (!couponInput) return;
    const res = applyCoupon(couponInput);
    if (res.success) {
      showToast(res.message, 'success');
      setCouponInput('');
    } else {
      showToast(res.message, 'error');
    }
  };

  if (cart.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.topHeader}>
          <View style={styles.headerLeftRow}>
            <Pressable style={styles.brandContainer} onPress={() => router.push('/customer' as any)}>
              <View style={styles.brandIcon}>
                <Zap size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.brandName}>GrabIt</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.searchHeaderRow}>
          <Pressable style={styles.backBtnCircle} onPress={() => router.back()}>
            <ArrowLeft size={18} color="#1E293B" />
          </Pressable>
          <Pressable style={styles.globalSearchBar} onPress={() => router.push('/customer/search' as any)}>
            <Search size={16} color="#94A3B8" style={{ marginRight: 6 }} />
            <Text style={styles.globalSearchPlaceholder}>Search for milk, butter, chips, snacks...</Text>
          </Pressable>
        </View>

        <EmptyState
          title="Your Cart is Empty"
          subtitle="Looks like you haven't added any items to your cart yet."
          actionText="Start Shopping"
          onAction={() => router.push('/customer' as any)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── 1. TOP HEADER ROW ── */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeftRow}>
          <Pressable style={styles.brandContainer} onPress={() => router.push('/customer' as any)}>
            <View style={styles.brandIcon}>
              <Zap size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.brandName}>GrabIt</Text>
          </Pressable>

          <Pressable style={styles.locationPill} onPress={fetchCurrentLocation}>
            <MapPin size={13} color="#0066FF" />
            <Text style={styles.locationText} numberOfLines={1}>
              {currentAddress.street || 'Kalyanagar, Bengaluru'}
            </Text>
            <Text style={styles.locationChevron}>v</Text>
          </Pressable>
        </View>

        <View style={styles.headerRightIcons}>
          <Pressable style={styles.iconCircle} onPress={() => router.push('/customer/notifications' as any)}>
            <Bell size={18} color="#0066FF" />
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

      {/* ── 2. BACK BUTTON & GLOBAL SEARCH BAR ── */}
      <View style={styles.searchHeaderRow}>
        <Pressable style={styles.backBtnCircle} onPress={() => router.back()}>
          <ArrowLeft size={18} color="#1E293B" />
        </Pressable>

        <Pressable style={styles.globalSearchBar} onPress={() => router.push('/customer/search' as any)}>
          <Search size={16} color="#94A3B8" style={{ marginRight: 6 }} />
          <Text style={styles.globalSearchPlaceholder} numberOfLines={1}>
            Search for milk, butter, chips, snacks...
          </Text>
        </Pressable>
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
                <Lock size={18} color="#6B21A8" />
              </View>
              <Text style={styles.lockTitle}>Login to view coupons</Text>
              <Text style={styles.lockSub}>
                Log in to see 100+ coupons & unlocked bank cashback offers
              </Text>
            </View>
          ) : appliedCoupon ? (
            <View style={styles.appliedCouponBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Tag size={16} color="#059669" style={{ marginRight: 6 }} />
                <View>
                  <Text style={styles.appliedCouponCode}>{appliedCoupon.code} APPLIED</Text>
                  <Text style={styles.appliedCouponSub}>Saved ₹{discountAmount} on this order</Text>
                </View>
              </View>
              <Pressable onPress={removeCoupon}>
                <Text style={styles.removeCouponText}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.couponInputRow}>
              <TextInput
                style={styles.couponInput}
                placeholder="Enter Code (e.g. GRABIT50)"
                placeholderTextColor="#94A3B8"
                value={couponInput}
                onChangeText={setCouponInput}
                autoCapitalize="characters"
              />
              <Pressable style={styles.applyBtn} onPress={handleApplyCoupon}>
                <Text style={styles.applyBtnText}>APPLY</Text>
              </Pressable>
            </View>
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
                <Text style={styles.itemWeight}>{product.weight || '1 unit'}</Text>
              </View>

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
            <Text style={styles.billLineVal}>₹{totalAmount}</Text>
          </View>

          <View style={styles.billLineRow}>
            <Text style={[styles.billLineLabel, { color: '#059669' }]}>Product Discount</Text>
            <Text style={[styles.billLineVal, { color: '#059669', fontWeight: '800' }]}>
              -₹{computedDiscount}
            </Text>
          </View>

          <View style={styles.billLineRow}>
            <Text style={styles.billLineLabel}>Delivery Charge</Text>
            <Text style={[styles.billLineVal, { color: '#059669', fontWeight: '900' }]}>
              {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
            </Text>
          </View>

          <View style={styles.dividerLine} />

          <View style={styles.billLineRow}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalVal}>₹{grandTotal}</Text>
          </View>

          {/* Cream Info Banner */}
          <View style={styles.creamInfoBox}>
            <Text style={styles.creamInfoText}>
              Log in to see your exact total. Applicable charges and discounts will be calculated based on your delivery details.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ── 7. STICKY BOTTOM ACTION FOOTER ── */}
      <View style={styles.stickyFooter}>
        <Pressable
          style={styles.actionMagentaBtn}
          onPress={() => {
            if (!user) {
              router.push('/login' as any);
            } else {
              router.push('/customer/checkout' as any);
            }
          }}
        >
          <Text style={styles.actionMagentaBtnText}>
            {!user ? 'Login to Proceed' : 'Proceed to Checkout'}
          </Text>
        </Pressable>
      </View>
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

  /* Search Header Row */
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
    flex: 1,
  },

  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 110,
  },

  pageTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: SPACING.md,
  },

  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: SPACING.md,
  },

  /* Coupons Lock Box */
  couponsLockBox: {
    backgroundColor: '#FAF5FF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E9D8FD',
    borderStyle: 'dashed',
    padding: SPACING.md,
    alignItems: 'center',
  },
  lockIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  lockTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 4,
  },
  lockSub: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },

  couponInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    height: 42,
    marginRight: SPACING.sm,
    fontSize: 13,
    color: '#0F172A',
  },
  applyBtn: {
    backgroundColor: '#0066FF',
    paddingHorizontal: SPACING.md,
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  appliedCouponBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: SPACING.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  appliedCouponCode: {
    fontSize: 13,
    fontWeight: '800',
    color: '#047857',
  },
  appliedCouponSub: {
    fontSize: 11,
    color: '#065F46',
  },
  removeCouponText: {
    color: '#EF4444',
    fontWeight: '800',
    fontSize: 12,
  },

  /* Delivering in Minutes Card */
  deliveringHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  clockIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  deliveringTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  deliveringSub: {
    fontSize: 12,
    color: '#64748B',
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
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

  /* Pink Soft Stepper */
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

  /* Add More Items Row */
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

  /* Bill Summary */
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

  /* Sticky Footer */
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
});

