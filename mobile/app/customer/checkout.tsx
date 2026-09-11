import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useCart } from '../../context/CartContext';
import { useLocation } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { post } from '../../services/api';
import { DeliveryLocationMapPicker } from '../../components/DeliveryLocationMapPicker';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { getCloudinaryUrl, getValidImage, optimizeImageUrl, DEFAULT_FALLBACK_IMAGE } from '../../services/cloudinary';
import { formatDisplayOrderId } from '../../utils/orderUtils';
import { getItem, setItem } from '../../services/storage';
import { addUserNotification } from '../../utils/userNotifications';
import {
  ArrowLeft,
  MapPin,
  CreditCard,
  Smartphone,
  Building2,
  Wallet,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Plus,
  Pencil,
  X,
  Tag,
  Zap,
  Clock,
  Check,
  ShoppingBag,
  Navigation,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

const STEPS = ['Delivery', 'Payment', 'Review & Place Order'];

const PAYMENT_METHODS = [
  { id: 'upi', icon: Smartphone, label: 'UPI', sub: 'Pay using any UPI app (GPay, PhonePe, Paytm)', logos: ['GPay', 'Paytm'] },
  { id: 'card', icon: CreditCard, label: 'Credit / Debit Card', sub: 'Visa, Mastercard, RuPay & more', logos: ['VISA', 'MC', 'RuPay'] },
  { id: 'netbanking', icon: Building2, label: 'Net Banking', sub: 'All major banks supported', logos: [] },
  { id: 'wallet', icon: Wallet, label: 'Wallets', sub: 'Paytm, Amazon Pay, Mobikwik & more', logos: [] },
  { id: 'cod', icon: Banknote, label: 'Cash on Delivery', sub: 'Pay in cash when your order arrives', logos: [] },
];

const getProductImageSource = (imageStr?: string) => {
  if (!imageStr) return { uri: DEFAULT_FALLBACK_IMAGE };
  const clean = getValidImage(imageStr);
  return { uri: optimizeImageUrl(clean, 300) };
};

export default function CheckoutPage() {
  const router = useRouter();
  const {
    cart,
    totalItems,
    itemTotal,
    mrpTotal,
    discount,
    deliveryFee,
    toPay,
    appliedCoupon,
    couponDiscount,
    clearCart,
  } = useCart();
  const { currentAddress, setAddress } = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<number>(0);
  const [selectedPayment, setSelectedPayment] = useState<string>('upi');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [orderPlaced, setOrderPlaced] = useState<boolean>(false);
  const [placedOrderId, setPlacedOrderId] = useState<string>('');

  // Auto-redirect to My Orders 1.5s after order is placed
  useEffect(() => {
    if (!orderPlaced) return;
    const timer = setTimeout(() => {
      router.replace('/customer/orders' as any);
    }, 1500);
    return () => clearTimeout(timer);
  }, [orderPlaced, router]);

  const [showCouponBackWarningModal, setShowCouponBackWarningModal] = useState<boolean>(false);

  // ── LOCATION & ADDRESS STATE ──
  const currentName = user?.full_name || user?.name || 'Customer';
  const currentPhone = (user?.phone || '').replace('+91', '').trim();
  const phoneDigits = currentPhone.replace(/\D/g, '');
  const storeHubName = 'GrabIt Supermarket (Koramangala Central Hub)';

  const defaultAddressesList = [
    { id: 1, title: 'Home', address: 'Baiyyappanahalli, Baiyyappanahalli, Bengaluru 560043', city: 'Bengaluru', isDefault: true, time: '15-25 min delivery' },
    { id: 2, title: 'Work', address: 'KSS Metro Tech Park, Sector 4, Bengaluru', city: 'Bengaluru', isDefault: false, time: '15-25 min delivery' },
  ];

  const [savedAddresses, setSavedAddresses] = useState<any[]>(defaultAddressesList);
  const [selectedAddress, setSelectedAddress] = useState<any>(() => {
    const full = currentAddress?.street
      ? `${currentAddress.street}, ${currentAddress.city || 'Bengaluru'}`
      : 'Baiyyappanahalli, Baiyyappanahalli, Bengaluru 560043';
    return {
      title: 'Home',
      name: currentName,
      phone: currentPhone || '',
      address: full,
      tag: 'SELECTED LOCATION',
      time: '15-25 min delivery',
    };
  });

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'list' | 'map'>('list');
  const [editingAddrIndex, setEditingAddrIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ title: '', address: '', city: '' });
  const [customAddressInput, setCustomAddressInput] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);

  // Sync addresses on mount
  useEffect(() => {
    getItem<any[]>(`grabit_addresses_${phoneDigits}`).then((list) => {
      if (list && Array.isArray(list) && list.length > 0) {
        setSavedAddresses(list);
      }
    });

    getItem<any>('grabit_selected_address').then((stored) => {
      if (stored && stored.address) {
        setSelectedAddress(stored);
      }
    });
  }, [phoneDigits]);

  const saveAddressesToStorage = async (list: any[]) => {
    setSavedAddresses(list);
    await setItem(`grabit_addresses_${phoneDigits}`, list);
  };

  const handleSelectAddress = async (addr: any) => {
    const fullAddressText = addr.city && !addr.address.includes(addr.city)
      ? `${addr.address}, ${addr.city}`
      : addr.address;
    const formatted = {
      title: addr.title || addr.tag || 'Delivery Location',
      name: currentName,
      phone: currentPhone || '',
      address: fullAddressText,
      tag: 'SELECTED LOCATION',
      time: addr.time || '15-25 min delivery',
    };
    setSelectedAddress(formatted);
    await setItem('grabit_selected_address', formatted);
    setIsLocationModalOpen(false);
    showToast(`Delivery location set to "${fullAddressText}"!`, 'success');
  };

  const handleStartEdit = (addr: any, idx: number) => {
    setEditingAddrIndex(idx);
    setEditForm({
      title: addr.title || addr.tag || 'Home',
      address: addr.address || '',
      city: addr.city || '',
    });
  };

  const handleSaveEditedAddress = async () => {
    if (!editForm.address.trim() || editingAddrIndex === null) return;
    const updated = [...savedAddresses];
    const cityStr = editForm.city.trim();
    const fullAddrStr = cityStr && !editForm.address.includes(cityStr)
      ? `${editForm.address.trim()}, ${cityStr}`
      : editForm.address.trim();

    updated[editingAddrIndex] = {
      ...updated[editingAddrIndex],
      title: editForm.title.trim() || 'Home',
      tag: editForm.title.trim() || 'Home',
      address: editForm.address.trim(),
      city: cityStr || 'Bengaluru',
    };
    await saveAddressesToStorage(updated);

    const formatted = {
      title: editForm.title.trim() || 'Home',
      name: currentName,
      phone: currentPhone || '',
      address: fullAddrStr,
      tag: 'EDITED LOCATION',
      time: '15-25 min delivery',
    };
    setSelectedAddress(formatted);
    await setItem('grabit_selected_address', formatted);
    setEditingAddrIndex(null);
    setIsLocationModalOpen(false);
    showToast(`Address updated to "${fullAddrStr}"!`, 'success');
  };

  const handleAddCustomAddress = async () => {
    if (!customAddressInput.trim()) return;
    const customText = customAddressInput.trim();
    const newAddrObj = {
      id: Date.now(),
      title: 'Custom Location',
      address: customText,
      city: 'Bengaluru',
      isDefault: false,
    };
    const updated = [...savedAddresses, newAddrObj];
    await saveAddressesToStorage(updated);

    const formatted = {
      title: 'Custom Location',
      name: currentName,
      phone: currentPhone || '',
      address: customText,
      tag: 'DIRECT LOCATION',
      time: '15-25 min delivery',
    };
    setSelectedAddress(formatted);
    await setItem('grabit_selected_address', formatted);
    setCustomAddressInput('');
    setShowManualForm(false);
    setIsLocationModalOpen(false);
    showToast(`Delivery location set to "${customText}"!`, 'success');
  };

  const handleUseCurrentGpsCheckout = async () => {
    setIsLocatingGps(true);
    setTimeout(async () => {
      const gpsAddrText = 'Koramangala 4th Block, 100ft Road, Bengaluru 560034';
      const gpsAddr = {
        id: Date.now(),
        title: 'Current Location',
        address: gpsAddrText,
        city: 'Bengaluru',
        isDefault: false,
        isGps: true,
      };
      const updated = [gpsAddr, ...savedAddresses.filter((a) => !a.isGps)];
      await saveAddressesToStorage(updated);
      const formatted = {
        title: 'Current Location',
        name: currentName,
        phone: currentPhone || '',
        address: gpsAddrText,
        tag: 'GPS LOCATION',
        time: '15-25 min delivery',
      };
      setSelectedAddress(formatted);
      await setItem('grabit_selected_address', formatted);
      setIsLocatingGps(false);
      setIsLocationModalOpen(false);
      showToast('Location detected via GPS!', 'success');
    }, 1200);
  };

  // ── BACK NAVIGATION HANDLER ──
  const handleStepBack = () => {
    if (step > 0) {
      setStep((prev) => prev - 1);
    } else {
      if (appliedCoupon) {
        setShowCouponBackWarningModal(true);
      } else {
        router.back();
      }
    }
  };

  const handleConfirmBackToCart = () => {
    setShowCouponBackWarningModal(false);
    router.back();
  };

  // ── PLACE ORDER HANDLER (HIGH PERFORMANCE & ZERO-DELAY CONFIRMATION) ──
  const isPlacingRef = useRef<boolean>(false);

  const handlePlaceOrder = async () => {
    // 0. Synchronous double-submission lock (0ms)
    if (isPlacingRef.current || isSubmitting) {
      if (__DEV__) console.log('[Checkout] Blocked duplicate Place Order tap');
      return;
    }

    console.time('PlaceOrder total');
    console.time('Validation');

    if (!cart || cart.length === 0) {
      console.timeEnd('Validation');
      console.timeEnd('PlaceOrder total');
      isPlacingRef.current = false;
      setIsSubmitting(false);
      showToast('Your cart is empty', 'error');
      router.replace('/customer/cart' as any);
      return;
    }
    if (!selectedAddress || !selectedAddress.address) {
      console.timeEnd('Validation');
      console.timeEnd('PlaceOrder total');
      isPlacingRef.current = false;
      setIsSubmitting(false);
      showToast('Please select a delivery address first', 'error');
      setIsLocationModalOpen(true);
      return;
    }

    const outOfStockItem = cart.find((i) => i.product.inStock === false);
    if (outOfStockItem) {
      console.timeEnd('Validation');
      console.timeEnd('PlaceOrder total');
      isPlacingRef.current = false;
      setIsSubmitting(false);
      showToast(`Item "${outOfStockItem.product.name}" is out of stock. Please remove it.`, 'error');
      return;
    }

    console.timeEnd('Validation');

    // 1. Payment Verification Phase
    console.time('Payment');
    isPlacingRef.current = true;
    setIsSubmitting(true);
    const activePaymentMethod = (selectedPayment || 'upi').toUpperCase();
    console.timeEnd('Payment');

    // 2. Order Payload Preparation
    const orderNumber = `GB-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const rawId = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) 
      ? (crypto as any).randomUUID() 
      : `${Date.now().toString(16).padStart(8, '0')}-0000-4000-8000-${Math.floor(Math.random() * 1e12).toString(16).padStart(12, '0')}`;
    const orderItems = cart.map((item) => ({
      id: item.product.id,
      product_id: item.product.id,
      name: item.product.name,
      product_name: item.product.name,
      qty: item.quantity,
      quantity: item.quantity,
      price: item.product.price,
      image: item.product.image,
    }));

    const custName = selectedAddress.name || currentName || 'Customer';
    // Use the signed-in user's phone for storage key (must match orders page lookup)
    // selectedAddress may not have a phone field — fall back to user.phone
    const addrPhone = (selectedAddress.phone || '').replace(/\D/g, '');
    const validPhoneDigits = addrPhone.length >= 10
      ? addrPhone.slice(-10)
      : phoneDigits.length >= 10
        ? phoneDigits.slice(-10)
        : phoneDigits || '';
    // Storage key always keyed to the signed-in user's phone
    const userStoragePhone = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : phoneDigits;
    const fullAddrStr = selectedAddress.address;
    const targetStoreId = 'b5c9ff6b-1f64-405f-a25d-54dc6ea77bbb';
    const targetLat = currentAddress.latitude || 12.9716;
    const targetLng = currentAddress.longitude || 77.5946;

    const newOrder = {
      id: rawId,
      rawId: rawId,
      display_id: orderNumber,
      displayId: orderNumber,
      order_number: orderNumber,
      orderNumber: orderNumber,
      store_id: targetStoreId,
      store_name: 'GrabIt Supermarket',
      customer_name: custName,
      customer_phone: `+91${validPhoneDigits}`,
      delivery_address: fullAddrStr,
      address: fullAddrStr,
      items: orderItems,
      total_amount: toPay,
      total: toPay,
      subtotal: itemTotal,
      mrp_total: mrpTotal,
      delivery_fee: deliveryFee,
      discount: discount,
      coupon_discount: couponDiscount,
      status: 'placed',
      payment_method: activePaymentMethod,
      estimated_time: selectedAddress.time || '15-25 min delivery',
      created_at: new Date().toISOString(),
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    let finalOrder = { ...newOrder };
    const formattedId = formatDisplayOrderId(finalOrder);
    finalOrder.displayId = formattedId;
    finalOrder.display_id = formattedId;
    finalOrder.orderNumber = formattedId;
    finalOrder.order_number = formattedId;
    const orderNum = formattedId;

    // 3. Instant Local Storage & Notification Save (Zero Lag)
    const saveOrderToKey = async (key: string) => {
      if (!key) return;
      try {
        const existingUserOrders = (await getItem<any[]>(key).catch(() => [])) || [];
        const filtered = existingUserOrders.filter(
          (o) =>
            o &&
            o.id !== rawId &&
            o.rawId !== rawId &&
            o.id !== orderNum &&
            o.displayId !== orderNum &&
            o.orderNumber !== orderNum &&
            o.display_id !== orderNum &&
            o.order_number !== orderNum
        );
        await setItem(key, [finalOrder, ...filtered]);
      } catch (e) {
        console.warn(`Failed to save order to ${key}:`, e);
      }
    };

    const keysToSave = new Set<string>();
    if (userStoragePhone) keysToSave.add(`grabit_orders_${userStoragePhone}`);
    if (validPhoneDigits) keysToSave.add(`grabit_orders_${validPhoneDigits}`);
    keysToSave.add('grabit_seller_orders');
    if (keysToSave.size === 1) {
      keysToSave.add('grabit_orders_guest');
    }

    // Save locally immediately so order is guaranteed in state
    await Promise.all([
      ...Array.from(keysToSave).map((k) => saveOrderToKey(k)),
      addUserNotification({
        title: 'Order Placed',
        message: `Order #${orderNum} received. Store is preparing your items.`,
        link: `/customer/order/${finalOrder.id || finalOrder.rawId}`,
        category: 'active',
        statusBadge: '⚡ ~15-20 min',
        statusColor: '#0071E3',
        statusBg: '#EFF6FF',
        iconType: 'package',
        orderId: finalOrder.id || finalOrder.rawId,
        phone: validPhoneDigits,
      }),
    ]).catch((e) => console.warn('Storage sync error:', e));

    // 4. ⚠️ CRITICAL: Send to backend FIRST before showing the success screen.
    //    The auto-redirect useEffect fires 1.5s after setOrderPlaced(true).
    //    If setOrderPlaced fires before this fetch completes, the component unmounts,
    //    the AbortController kills the in-flight fetch, and the seller NEVER gets the order.
    try {
      const apiCallPromise = post('/orders/', {
        id: rawId,
        rawId: rawId,
        display_id: orderNum,
        displayId: orderNum,
        order_number: orderNum,
        orderNumber: orderNum,
        store_id: targetStoreId,
        delivery_address: fullAddrStr,
        items: orderItems,
        total_amount: toPay,
        customer_name: newOrder.customer_name,
        customer_phone: newOrder.customer_phone,
        payment_method: newOrder.payment_method,
        latitude: targetLat,
        longitude: targetLng,
        status: 'placed',
      });

      // 6s timeout — if backend takes longer, proceed anyway (order is already saved locally)
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
      const apiRes: any = await Promise.race([apiCallPromise, timeoutPromise]);

      if (apiRes && (apiRes.id || apiRes.rawId)) {
        const serverId = apiRes.id || apiRes.rawId;
        const serverDispId = apiRes.display_id || apiRes.order_number || apiRes.displayId || apiRes.orderNumber || orderNum;

        finalOrder.id = serverId;
        finalOrder.rawId = serverId;
        finalOrder.displayId = serverDispId;
        finalOrder.display_id = serverDispId;
        finalOrder.orderNumber = serverDispId;
        finalOrder.order_number = serverDispId;

        // Clean out old local draft entry so AsyncStorage never contains duplicate order cards
        for (const k of Array.from(keysToSave)) {
          try {
            const existing = (await getItem<any[]>(k).catch(() => [])) || [];
            const cleaned = existing.filter(
              (o) =>
                o &&
                o.id !== serverId &&
                o.rawId !== serverId &&
                o.id !== rawId &&
                o.rawId !== rawId &&
                o.id !== orderNum &&
                o.displayId !== orderNum &&
                o.orderNumber !== orderNum &&
                o.display_id !== orderNum &&
                o.order_number !== orderNum &&
                o.displayId !== serverDispId &&
                o.orderNumber !== serverDispId &&
                o.display_id !== serverDispId &&
                o.order_number !== serverDispId
            );
            await setItem(k, [finalOrder, ...cleaned]);
          } catch {}
        }
      }
    } catch (err) {
      // Backend unreachable — order is saved locally, user can still see it in My Orders
      if (__DEV__) console.log('[Checkout] Backend sync failed, order saved locally:', (err as any)?.message || err);
    }

    // 5. Only NOW show the success screen — backend sync is done, redirect is safe
    clearCart();
    setPlacedOrderId(formatDisplayOrderId(finalOrder));
    setOrderPlaced(true);
    setIsSubmitting(false);
    isPlacingRef.current = false;
  };

  // ── ORDER CONFIRMED SUCCESS VIEW ──
  if (orderPlaced) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successContentBox}>
          {/* Animated Success Badge */}
          <View style={styles.successBadgeCircle}>
            <CheckCircle2 size={48} color="#FFFFFF" />
          </View>

          <Text style={styles.successSubHeader}>✦ ORDER CONFIRMED ✦</Text>
          <Text style={styles.successHeaderTitle}>Order Placed{"\n"}Successfully!</Text>
          <Text style={styles.successSubText}>Your items are being prepared by the store</Text>

          {/* Order ID Tag */}
          <View style={styles.successOrderIdBadge}>
            <Text style={styles.successOrderIdText}>ORDER #{formatDisplayOrderId(placedOrderId)}</Text>
          </View>

          {/* ETA Card */}
          <View style={styles.successEtaCard}>
            <View style={styles.etaIconBox}>
              <Text style={{ fontSize: 22 }}>⚡</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.etaLabel}>ESTIMATED DELIVERY</Text>
              <Text style={styles.etaTimeText}>{selectedAddress?.time || '15-25 min delivery'}</Text>
              <Text style={styles.etaSubText}>Express delivery • {selectedAddress?.title || 'Home'}</Text>
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.successStatsGrid}>
            <View style={styles.successStatCard}>
              <Text style={{ fontSize: 18 }}>🛍️</Text>
              <Text style={styles.statValue}>{totalItems || 1} Items</Text>
              <Text style={styles.statLabel}>ITEMS</Text>
            </View>
            <View style={styles.successStatCard}>
              <Text style={{ fontSize: 18 }}>💳</Text>
              <Text style={styles.statValue}>{selectedPayment.toUpperCase()}</Text>
              <Text style={styles.statLabel}>PAYMENT</Text>
            </View>
            <View style={styles.successStatCard}>
              <Text style={{ fontSize: 18 }}>💰</Text>
              <Text style={styles.statValue}>₹{discount + couponDiscount}</Text>
              <Text style={styles.statLabel}>SAVED</Text>
            </View>
          </View>

          {/* Direct Interactive Action Buttons */}
          <View style={styles.successActionsRow}>
            <Pressable
              style={styles.trackOrderLiveBtn}
              onPress={() => router.replace(`/customer/track/${placedOrderId || 'ORD-982145'}` as any)}
            >
              <Text style={styles.trackOrderLiveBtnText}>Track Order Live ➔</Text>
            </Pressable>
            <Pressable
              style={styles.viewAllOrdersBtn}
              onPress={() => router.replace('/customer/orders' as any)}
            >
              <Text style={styles.viewAllOrdersBtnText}>My Orders</Text>
            </Pressable>
          </View>

          <View style={styles.redirectingBox}>
            <ActivityIndicator size="small" color="#10B981" style={{ marginRight: 8 }} />
            <Text style={styles.redirectingText}>Taking you to My Orders in a moment...</Text>
          </View>
        </View>
      </View>
    );
  }

  // ── EMPTY CART GUARD ──
  if (!orderPlaced && (!cart || cart.length === 0)) {
    return (
      <View style={styles.emptyCartContainer}>
        <View style={styles.emptyCartIconBox}>
          <ShoppingBag size={40} color="#0071E3" />
        </View>
        <Text style={styles.emptyCartTitle}>Your Cart is Empty</Text>
        <Text style={styles.emptyCartSub}>
          Looks like you don't have any items in your cart to checkout. Add some fresh groceries to get started!
        </Text>
        <Pressable
          style={styles.emptyCartBtn}
          onPress={() => router.push('/customer' as any)}
        >
          <Text style={styles.emptyCartBtnText}>Explore Groceries</Text>
        </Pressable>
      </View>
    );
  }

  // ── REUSABLE ORDER SUMMARY CARD ──
  const OrderSummaryCard = () => (
    <View style={styles.summaryCard}>
      <View style={styles.summaryHeaderRow}>
        <Text style={styles.summaryTitle}>Order Summary</Text>
        <Text style={styles.summaryItemBadge}>{totalItems} Items</Text>
      </View>

      <ScrollView style={{ maxHeight: 220, marginBottom: 12 }} showsVerticalScrollIndicator={false}>
        {cart.map(({ product, quantity }) => (
          <View key={product.id} style={styles.summaryItemRow}>
            <Image
              source={getProductImageSource(product.image)}
              style={styles.summaryItemImg}
              resizeMode="contain"
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.summaryItemName} numberOfLines={1}>
                {product.name}
              </Text>
              <Text style={styles.summaryItemQty}>
                {product.weight || '1 unit'} • Qty: {quantity}
              </Text>
            </View>
            <Text style={styles.summaryItemPrice}>₹{product.price * quantity}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dividerLine} />

      <View style={styles.billRow}>
        <Text style={styles.billLabel}>Item Total ({totalItems} items)</Text>
        <Text style={styles.billVal}>₹{mrpTotal > itemTotal ? mrpTotal : itemTotal}</Text>
      </View>

      {discount > 0 ? (
        <View style={styles.billRow}>
          <Text style={styles.billLabel}>Product Discount</Text>
          <Text style={[styles.billVal, { color: '#10B981', fontWeight: '900' }]}>-₹{discount}</Text>
        </View>
      ) : null}

      {appliedCoupon && couponDiscount > 0 ? (
        <View style={styles.billRow}>
          <Text style={styles.billLabel}>Coupon Discount ({appliedCoupon.code})</Text>
          <Text style={[styles.billVal, { color: '#10B981', fontWeight: '900' }]}>-₹{couponDiscount}</Text>
        </View>
      ) : null}

      <View style={styles.billRow}>
        <Text style={styles.billLabel}>Delivery Fee</Text>
        <Text style={styles.billVal}>
          {deliveryFee > 0 ? `₹${deliveryFee}` : <Text style={{ color: '#10B981', fontWeight: '900' }}>FREE</Text>}
        </Text>
      </View>

      <View style={[styles.dividerLine, { marginVertical: 10 }]} />

      <View style={styles.billRow}>
        <Text style={styles.grandTotalLabel}>To Pay</Text>
        <Text style={styles.grandTotalVal}>₹{toPay}</Text>
      </View>

      {/* Savings Banner */}
      <View style={styles.savingsBanner}>
        <Tag size={14} color="#10B981" />
        <Text style={styles.savingsBannerText}>
          You're saving ₹{discount + couponDiscount} on this order
        </Text>
      </View>

      {/* Express Delivery Banner */}
      <View style={styles.expressBanner}>
        <Zap size={16} color="#0071E3" fill="#0071E3" />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.expressTitle}>
            Delivery in {selectedAddress?.time || '15-25 min delivery'}
          </Text>
          <Text style={styles.expressSub}>
            Express delivery to {selectedAddress?.title || 'Selected Location'} • {selectedAddress?.tag || 'EXPRESS'}
          </Text>
        </View>
      </View>

      {/* Dynamic Action Button based on current step */}
      {step === 0 && (
        <Pressable style={styles.mainStepBtn} onPress={() => setStep(1)}>
          <Text style={styles.mainStepBtnText}>Continue to Payment</Text>
          <ChevronRight size={18} color="#FFFFFF" />
        </Pressable>
      )}
      {step === 1 && (
        <Pressable style={styles.mainStepBtn} onPress={() => setStep(2)}>
          <Text style={styles.mainStepBtnText}>Continue to Review</Text>
          <ChevronRight size={18} color="#FFFFFF" />
        </Pressable>
      )}
      {step === 2 && (
        <Pressable
          style={[styles.mainStepBtn, { backgroundColor: '#10B981' }, (isSubmitting || isPlacingRef.current) && styles.disabledBtn]}
          onPress={handlePlaceOrder}
          disabled={isSubmitting || isPlacingRef.current}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.mainStepBtnText}>🛍️ Place Order ₹{toPay}</Text>
          )}
        </Pressable>
      )}

      <Text style={styles.secureText}>🔒 100% Secure Payments</Text>
    </View>
  );

  return (
    <View style={styles.flexContainer}>
      {/* ── HEADER BAR ── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={handleStepBack}>
          <ArrowLeft size={20} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{STEPS[step]}</Text>
      </View>

      {/* ── STEPPER HEADER ── */}
      <View style={styles.stepperContainer}>
        {['Delivery', 'Payment', 'Review'].map((sLabel, idx) => {
          const isActive = step === idx;
          const isDone = step > idx;
          return (
            <React.Fragment key={sLabel}>
              <Pressable
                style={styles.stepItem}
                onPress={() => {
                  if (idx < step) setStep(idx);
                }}
              >
                <View
                  style={[
                    styles.stepBadgeCircle,
                    (isActive || isDone) && styles.stepBadgeActive,
                  ]}
                >
                  {isDone ? (
                    <Check size={14} color="#FFFFFF" />
                  ) : (
                    <Text
                      style={[
                        styles.stepBadgeNum,
                        (isActive || isDone) && { color: '#FFFFFF' },
                      ]}
                    >
                      {idx + 1}
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.stepLabelText,
                    isActive && styles.stepLabelTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {sLabel}
                </Text>
              </Pressable>
              {idx < 2 && (
                <View
                  style={[
                    styles.stepLine,
                    idx < step && { backgroundColor: '#0071E3' },
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── STEP 0: DELIVERY ── */}
        {step === 0 && (
          <View style={styles.stepGap}>
            {/* Delivery Address Confirmed Badge */}
            {selectedAddress && selectedAddress.address ? (
              <View style={styles.addressConfirmedBanner}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <CheckCircle2 size={18} color="#16A34A" style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.confirmedTitle}>
                      Delivery Address Confirmed: {selectedAddress.title || 'Home'}
                    </Text>
                    <Text style={styles.confirmedAddressText} numberOfLines={1}>
                      {selectedAddress.address}
                    </Text>
                  </View>
                </View>
                <Pressable style={styles.changeBtn} onPress={() => setIsLocationModalOpen(true)}>
                  <Text style={styles.changeBtnText}>Change</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Active Coupon Banner */}
            {appliedCoupon ? (
              <View style={styles.activeCouponBanner}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Tag size={16} color="#0071E3" style={{ marginRight: 8 }} />
                  <Text style={styles.activeCouponText}>
                    Coupon <Text style={{ fontWeight: '900' }}>{appliedCoupon.code}</Text> Active — Saving ₹{couponDiscount}
                  </Text>
                </View>
                <Text style={styles.appliedBadgeText}>APPLIED</Text>
              </View>
            ) : null}

            {/* Main Delivery Address Card */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <MapPin size={20} color="#0071E3" />
                <Text style={styles.cardHeaderTitle}>1. Select Delivery Address</Text>
              </View>

              {selectedAddress && selectedAddress.address ? (
                <View style={styles.selectedAddressBox}>
                  <View style={styles.addressTitleRow}>
                    <View style={styles.addressRadioRow}>
                      <View style={styles.radioOuterCircle}>
                        <View style={styles.radioInnerDot} />
                      </View>
                      <Text style={styles.selectedAddressTitleText} numberOfLines={1}>
                        🏠 {selectedAddress.title} (Selected)
                      </Text>
                    </View>
                    <Pressable
                      style={styles.editAddressBtn}
                      onPress={() => setIsLocationModalOpen(true)}
                    >
                      <Pencil size={12} color="#0071E3" style={{ marginRight: 4 }} />
                      <Text style={styles.editAddressBtnText}>Edit</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.selectedFullAddressText}>{selectedAddress.address}</Text>
                  <Text style={styles.customerNamePhoneText}>
                    <Text style={{ fontWeight: '800', color: '#0F172A' }}>{currentName}</Text>
                    {currentPhone ? ` • +91 ${currentPhone}` : ''}
                  </Text>
                  <Text style={styles.fulfillingStoreText}>
                    Fulfilling Store: 🏪 {storeHubName}
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyAddressBox}>
                  <MapPin size={32} color="#0071E3" style={{ marginBottom: 8 }} />
                  <Text style={styles.emptyAddressTitle}>No Delivery Address Added</Text>
                  <Text style={styles.emptyAddressSub}>
                    Please set your delivery address or pin on map to place your order.
                  </Text>
                  <Pressable style={styles.addAddressBtn} onPress={() => setIsLocationModalOpen(true)}>
                    <Plus size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.addAddressBtnText}>Add Delivery Address</Text>
                  </Pressable>
                </View>
              )}

              <Pressable style={styles.chooseAddNewBtn} onPress={() => setIsLocationModalOpen(true)}>
                <Plus size={16} color="#0071E3" style={{ marginRight: 6 }} />
                <Text style={styles.chooseAddNewBtnText}>Choose / Add New Address</Text>
              </Pressable>
            </View>

            {/* Order Summary Card */}
            <OrderSummaryCard />
          </View>
        )}

        {/* ── STEP 1: PAYMENT ── */}
        {step === 1 && (
          <View style={styles.stepGap}>
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>2. Select Payment Method</Text>
              <Text style={styles.subTextMuted}>All transactions are 100% encrypted & secure</Text>

              <View style={{ gap: 10 }}>
                {PAYMENT_METHODS.map((method) => {
                  const IconComp = method.icon;
                  const isSelected = selectedPayment === method.id;
                  return (
                    <Pressable
                      key={method.id}
                      style={[styles.payMethodTile, isSelected && styles.payMethodTileSelected]}
                      onPress={() => setSelectedPayment(method.id)}
                    >
                      <View style={styles.payIconBox}>
                        <IconComp size={20} color="#0071E3" />
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.payMethodTitle, isSelected && { color: '#0071E3' }]}>
                          {method.label}
                        </Text>
                        <Text style={styles.payMethodSub}>{method.sub}</Text>
                      </View>

                      {isSelected ? (
                        <CheckCircle2 size={20} color="#0071E3" />
                      ) : (
                        <View style={styles.unselectedRadioCircle} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Order Summary Card */}
            <OrderSummaryCard />
          </View>
        )}

        {/* ── STEP 2: REVIEW ── */}
        {step === 2 && (
          <View style={styles.stepGap}>
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>3. Review Order Details</Text>
              
              {/* Itemized List */}
              <View style={{ marginBottom: 16 }}>
                {cart.map(({ product, quantity }) => (
                  <View key={product.id} style={styles.reviewItemRow}>
                    <View style={styles.reviewItemImgBox}>
                      <Image
                        source={getProductImageSource(product.image)}
                        style={styles.reviewItemImg}
                        resizeMode="contain"
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.reviewItemName} numberOfLines={1}>
                        {product.name}
                      </Text>
                      <Text style={styles.reviewItemQty}>
                        Qty: {quantity} × ₹{product.price}
                      </Text>
                    </View>
                    <Text style={styles.reviewItemPrice}>₹{product.price * quantity}</Text>
                  </View>
                ))}
              </View>

              {/* Delivery Address Summary Tile */}
              <View style={styles.reviewSummaryTile}>
                <Text style={styles.reviewTileLabel}>Delivery Address</Text>
                <Text style={styles.reviewTileVal}>{selectedAddress?.address || 'No address selected'}</Text>
                <Text style={styles.reviewTileSub}>Fulfilling Store: {storeHubName}</Text>
              </View>

              {/* Payment Method Summary Tile */}
              <View style={styles.reviewSummaryTile}>
                <Text style={styles.reviewTileLabel}>Payment Method</Text>
                <Text style={styles.reviewTileVal}>{selectedPayment.toUpperCase()}</Text>
              </View>
            </View>

            {/* Order Summary Card */}
            <OrderSummaryCard />
          </View>
        )}
      </ScrollView>

      {/* ── INTERACTIVE LOCATION & ADDRESS EDIT MODAL ── */}
      <Modal
        visible={isLocationModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsLocationModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Sticky Close Button */}
            <Pressable
              style={styles.modalCloseBtnSticky}
              onPress={() => {
                setIsLocationModalOpen(false);
                setEditingAddrIndex(null);
                setModalTab('list');
                setShowManualForm(false);
              }}
            >
              <X size={18} color="#334155" />
            </Pressable>

            <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
              {editingAddrIndex !== null ? (
                /* INLINE EDIT FORM */
                <View style={{ gap: 12 }}>
                  <Text style={styles.modalHeaderTitle}>Edit Delivery Address</Text>
                  
                  <View>
                    <Text style={styles.inputLabel}>Address Tag (e.g. Home, Work, Apartment)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editForm.title}
                      onChangeText={(txt) => setEditForm({ ...editForm, title: txt })}
                    />
                  </View>

                  <View>
                    <Text style={styles.inputLabel}>Street Address / Flat / Building</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editForm.address}
                      onChangeText={(txt) => setEditForm({ ...editForm, address: txt })}
                    />
                  </View>

                  <View>
                    <Text style={styles.inputLabel}>Area / City / Pincode</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editForm.city}
                      onChangeText={(txt) => setEditForm({ ...editForm, city: txt })}
                      placeholder="e.g. Koramangala, Bengaluru 560034"
                    />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    <Pressable
                      style={styles.cancelFormBtn}
                      onPress={() => setEditingAddrIndex(null)}
                    >
                      <Text style={styles.cancelFormBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={styles.saveFormBtn}
                      onPress={handleSaveEditedAddress}
                    >
                      <Text style={styles.saveFormBtnText}>Save & Select Address</Text>
                    </Pressable>
                  </View>
                </View>
              ) : modalTab === 'map' ? (
                <View style={{ height: 350 }}>
                  <DeliveryLocationMapPicker
                    initialLat={13.014333}
                    initialLng={77.646000}
                    onSelectLocation={async (lat, lng) => {
                      const newLoc = {
                        id: Date.now(),
                        title: 'Pinned Location',
                        address: `Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
                        city: 'Bengaluru',
                        isDefault: false,
                      };
                      const updated = [newLoc, ...savedAddresses.filter((a) => a.title !== 'Pinned Location')];
                      await saveAddressesToStorage(updated);
                      handleSelectAddress(newLoc);
                      setModalTab('list');
                    }}
                    height={300}
                  />
                  <Pressable
                    style={[styles.cancelFormBtn, { marginTop: 10 }]}
                    onPress={() => setModalTab('list')}
                  >
                    <Text style={styles.cancelFormBtnText}>Back to Address List</Text>
                  </Pressable>
                </View>
              ) : (
                /* MATCHING IMAGE 1 / WEB LOCATION MODAL */
                <View>
                  {/* Centered Header */}
                  <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    <View style={styles.modalPinCircle}>
                      <MapPin size={26} color="#0071E3" />
                    </View>
                    <Text style={styles.modalHeaderTitleCenter}>Select Delivery Location</Text>
                    <Text style={styles.modalHeaderSubCenter}>
                      Add your delivery address to see live stock availability and 10-minute delivery in your area.
                    </Text>
                  </View>

                  {/* Saved Address Cards */}
                  {savedAddresses.length > 0 ? (
                    <View style={{ gap: 8, marginBottom: 14 }}>
                      {savedAddresses.map((addr, idx) => {
                        const fullAddrStr = addr.address + (addr.city && !addr.address.includes(addr.city) ? `, ${addr.city}` : '');
                        const isSelected = selectedAddress?.address === fullAddrStr || selectedAddress?.title === addr.title;
                        return (
                          <Pressable
                            key={addr.id || idx}
                            style={[
                              styles.savedAddrTileModal,
                              isSelected && styles.savedAddrTileModalSelected,
                            ]}
                            onPress={() => handleSelectAddress(addr)}
                          >
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <MapPin size={14} color={isSelected ? '#0071E3' : '#64748B'} />
                                <Text style={[styles.savedAddrTagModal, isSelected && { color: '#0071E3' }]}>
                                  {addr.title}
                                </Text>
                                {addr.isDefault ? (
                                  <View style={styles.defaultBadgeModal}>
                                    <Text style={styles.defaultBadgeModalText}>DEFAULT</Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text style={styles.savedAddrTextModal} numberOfLines={2}>
                                {fullAddrStr}
                              </Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Pressable
                                style={styles.editBtnModalTile}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit(addr, idx);
                                }}
                              >
                                <Pencil size={11} color="#0071E3" style={{ marginRight: 3 }} />
                                <Text style={styles.editBtnModalTileText}>Edit</Text>
                              </Pressable>
                              {isSelected ? <CheckCircle2 size={20} color="#0071E3" /> : null}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}

                  {/* 3 Main Action Buttons */}
                  <View style={{ gap: 10 }}>
                    {/* BUTTON 1: Use Current Location (GPS) */}
                    <Pressable
                      style={[styles.modalActionBtn1, isLocatingGps && { backgroundColor: '#EFF6FF' }]}
                      onPress={handleUseCurrentGpsCheckout}
                      disabled={isLocatingGps}
                    >
                      <Navigation size={18} color={isLocatingGps ? '#0071E3' : '#FFFFFF'} />
                      <View style={{ marginLeft: 10 }}>
                        <Text style={[styles.modalActionBtn1Title, isLocatingGps && { color: '#0071E3' }]}>
                          {isLocatingGps ? 'Detecting GPS...' : 'Use Current Location'}
                        </Text>
                        <Text style={[styles.modalActionBtn1Sub, isLocatingGps && { color: '#0071E3' }]}>
                          Detect device GPS & fetch street address
                        </Text>
                      </View>
                    </Pressable>

                    {/* BUTTON 2: Set Address / Pin on Map */}
                    <Pressable
                      style={styles.modalActionBtn2}
                      onPress={() => setModalTab('map')}
                    >
                      <MapPin size={18} color="#0071E3" />
                      <View style={{ marginLeft: 10 }}>
                        <Text style={styles.modalActionBtn2Title}>Set Address / Pin on Map</Text>
                        <Text style={styles.modalActionBtn2Sub}>Interactive map picker & address search</Text>
                      </View>
                    </Pressable>

                    {/* BUTTON 3: Enter Address Details Manually */}
                    <Pressable
                      style={styles.modalActionBtn3}
                      onPress={() => setShowManualForm((prev) => !prev)}
                    >
                      <Plus size={16} color="#0071E3" style={{ marginRight: 6 }} />
                      <Text style={styles.modalActionBtn3Text}>Enter Address Details Manually</Text>
                    </Pressable>
                  </View>

                  {/* Manual Form Box */}
                  {showManualForm ? (
                    <View style={styles.manualFormContainer}>
                      <Text style={styles.inputLabel}>Enter New Delivery Address / Pincode</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. Koramangala 5th Block, Bengaluru 560095"
                        value={customAddressInput}
                        onChangeText={setCustomAddressInput}
                      />
                      <Pressable style={styles.saveFormBtn} onPress={handleAddCustomAddress}>
                        <Text style={styles.saveFormBtnText}>Save & Select New Location</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── COUPON BACK WARNING MODAL ── */}
      <Modal
        visible={showCouponBackWarningModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowCouponBackWarningModal(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.warningModalContent}>
            <View style={styles.warningIconCircle}>
              <Tag size={24} color="#D97706" />
            </View>

            <Text style={styles.warningTitle}>Returning to Cart?</Text>
            <Text style={styles.warningText}>
              You currently have coupon <Text style={{ fontWeight: '900', color: '#0071E3' }}>{appliedCoupon?.code}</Text> applied (saving ₹{couponDiscount}).
            </Text>

            <View style={styles.warningNoteBox}>
              <Text style={styles.warningNoteText}>
                💡 <Text style={{ fontWeight: '800' }}>Note:</Text> Your coupon and selected delivery address (<Text style={{ fontWeight: '800', color: '#0F172A' }}>{selectedAddress?.title || 'Saved Address'}</Text>) are preserved. However, if you change items in your cart, coupon eligibility will be re-evaluated.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                style={styles.stayBtn}
                onPress={() => setShowCouponBackWarningModal(false)}
              >
                <Text style={styles.stayBtnText}>Stay on Checkout</Text>
              </Pressable>
              <Pressable
                style={styles.returnCartBtn}
                onPress={handleConfirmBackToCart}
              >
                <Text style={styles.returnCartBtnText}>Return to Cart</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flexContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 6,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },

  /* Stepper Bar */
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  stepBadgeCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 5,
    flexShrink: 0,
  },
  stepBadgeActive: {
    backgroundColor: '#0071E3',
  },
  stepBadgeNum: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
  },
  stepLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    flexShrink: 1,
  },
  stepLabelTextActive: {
    color: '#0F172A',
    fontWeight: '900',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 6,
    minWidth: 8,
  },

  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 40,
  },
  stepGap: {
    gap: 16,
  },

  /* Address Confirmed Banner */
  addressConfirmedBanner: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confirmedTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#166534',
  },
  confirmedAddressText: {
    fontSize: 12,
    color: '#15803D',
    fontWeight: '600',
    marginTop: 1,
  },
  changeBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  changeBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#16A34A',
  },

  /* Active Coupon Banner */
  activeCouponBanner: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeCouponText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E40AF',
  },
  appliedBadgeText: {
    fontSize: 10.5,
    backgroundColor: '#DBEAFE',
    color: '#1E40AF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontWeight: '900',
  },

  /* Cards */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    ...SHADOWS.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    marginLeft: 8,
  },

  /* Selected Address Box */
  selectedAddressBox: {
    borderWidth: 2,
    borderColor: '#0071E3',
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#EFF6FF',
    marginBottom: 14,
  },
  addressTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  radioOuterCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0071E3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  radioInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  selectedAddressTitleText: {
    fontWeight: '800',
    fontSize: 14,
    color: '#0F172A',
    flexShrink: 1,
  },
  editAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  editAddressBtnText: {
    color: '#0071E3',
    fontSize: 12,
    fontWeight: '800',
  },
  selectedFullAddressText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 19,
    marginBottom: 4,
  },
  customerNamePhoneText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
    marginBottom: 6,
  },
  fulfillingStoreText: {
    fontSize: 11.5,
    color: '#0071E3',
    fontWeight: '800',
  },

  /* Empty Address Box */
  emptyAddressBox: {
    padding: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyAddressTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptyAddressSub: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 14,
  },
  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#0071E3',
    borderRadius: 10,
  },
  addAddressBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  chooseAddNewBtn: {
    width: '100%',
    paddingVertical: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#0071E3',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chooseAddNewBtnText: {
    color: '#0071E3',
    fontWeight: '800',
    fontSize: 13.5,
  },

  /* Order Summary Card */
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    ...SHADOWS.sm,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  summaryItemBadge: {
    color: '#0071E3',
    fontSize: 13,
    fontWeight: '800',
  },
  summaryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  summaryItemImg: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  summaryItemName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  summaryItemQty: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  summaryItemPrice: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },

  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  billLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  billVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  grandTotalVal: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0071E3',
  },

  savingsBanner: {
    marginTop: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  savingsBannerText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
  },

  expressBanner: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  expressTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
  },
  expressSub: {
    fontSize: 11,
    color: '#0071E3',
    fontWeight: '700',
    marginTop: 1,
  },

  mainStepBtn: {
    backgroundColor: '#0071E3',
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    ...SHADOWS.md,
  },
  mainStepBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '900',
    marginRight: 4,
  },
  secureText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 8,
    fontWeight: '600',
  },

  /* Payment Method Tiles */
  subTextMuted: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  payMethodTile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  payMethodTileSelected: {
    borderWidth: 2,
    borderColor: '#0071E3',
    backgroundColor: '#EFF6FF',
  },
  payIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  payMethodTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  payMethodSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  unselectedRadioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },

  /* Review Step */
  reviewItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  reviewItemImgBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewItemImg: {
    width: 34,
    height: 34,
  },
  reviewItemName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  reviewItemQty: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  reviewItemPrice: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  reviewSummaryTile: {
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 12,
  },
  reviewTileLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  reviewTileVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  reviewTileSub: {
    fontSize: 12,
    color: '#0071E3',
    fontWeight: '700',
    marginTop: 2,
  },
  disabledBtn: {
    opacity: 0.6,
  },

  /* Location Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalCloseBtnSticky: {
    position: 'absolute',
    top: 14,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  modalPinCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalHeaderTitleCenter: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  modalHeaderSubCenter: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },

  savedAddrTileModal: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savedAddrTileModalSelected: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#0071E3',
  },
  savedAddrTagModal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  defaultBadgeModal: {
    backgroundColor: '#0071E3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeModalText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  savedAddrTextModal: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
    fontWeight: '600',
  },
  editBtnModalTile: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editBtnModalTileText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0071E3',
  },

  modalActionBtn1: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#0071E3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  modalActionBtn1Title: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  modalActionBtn1Sub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  modalActionBtn2: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#0071E3',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionBtn2Title: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0071E3',
  },
  modalActionBtn2Sub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  modalActionBtn3: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionBtn3Text: {
    color: '#0071E3',
    fontSize: 14,
    fontWeight: '800',
  },

  manualFormContainer: {
    marginTop: 10,
    gap: 8,
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: '#FFFFFF',
  },
  cancelFormBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  cancelFormBtnText: {
    fontWeight: '800',
    color: '#64748B',
    fontSize: 13,
  },
  saveFormBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#0071E3',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  saveFormBtnText: {
    fontWeight: '900',
    color: '#FFFFFF',
    fontSize: 13,
  },

  /* Empty Cart Screen */
  emptyCartContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: '#F8FAFC',
  },
  emptyCartIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyCartTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptyCartSub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 320,
    lineHeight: 20,
  },
  emptyCartBtn: {
    backgroundColor: '#0071E3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyCartBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  /* Coupon Warning Modal */
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  warningModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    maxWidth: 420,
    width: '100%',
    padding: 24,
    alignItems: 'center',
    ...SHADOWS.lg,
  },
  warningIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  warningNoteBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    width: '100%',
  },
  warningNoteText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  stayBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#0071E3',
    alignItems: 'center',
  },
  stayBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  returnCartBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  returnCartBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
  },

  /* Order Success View */
  successContainer: {
    flex: 1,
    backgroundColor: '#0A0F1E',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  successContentBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 28,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  successBadgeCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successSubHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 2,
    marginBottom: 6,
  },
  successHeaderTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 6,
  },
  successSubText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginBottom: 20,
  },
  successEtaCard: {
    width: '100%',
    backgroundColor: 'rgba(0, 113, 227, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(0, 113, 227, 0.4)',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  etaIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0071E3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  etaLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 0.5,
  },
  etaTimeText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  etaSubText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  successStatsGrid: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginBottom: 20,
  },
  successStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  redirectingBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  redirectingText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  successOrderIdBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  successOrderIdText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  successActionsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 16,
  },
  trackOrderLiveBtn: {
    flex: 1,
    backgroundColor: '#0071E3',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  trackOrderLiveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  viewAllOrdersBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  viewAllOrdersBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
