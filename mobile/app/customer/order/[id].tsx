import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Linking,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useCart } from '../../../context/CartContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { get, patch } from '../../../services/api';
import { getItem, setItem } from '../../../services/storage';
import { products } from '../../../data/products';
import { getValidImage, optimizeImageUrl, DEFAULT_FALLBACK_IMAGE } from '../../../services/cloudinary';
import { COLORS, SPACING, SHADOWS } from '../../../constants/theme';
import {
  ArrowLeft,
  Clock,
  MapPin,
  MessageSquare,
  HelpCircle,
  X,
  Send,
  PhoneCall,
  Check,
  Zap,
  Phone,
  CheckCircle2,
  RefreshCw,
  Star,
  AlertCircle,
} from 'lucide-react-native';

const LOCAL_PRODUCT_IMAGES: Record<string, any> = {
  'coca-cola-real.jpg': require('../../../assets/coca-cola-real.jpg'),
  'aashirvaad-atta-real.jpg': require('../../../assets/aashirvaad-atta-real.jpg'),
  'atta-real.jpg': require('../../../assets/aashirvaad-atta-real.jpg'),
  'amul-butter-real.jpg': require('../../../assets/amul-butter-real.jpg'),
  'butter-real.jpg': require('../../../assets/amul-butter-real.jpg'),
  'combo-munchies.jpg': require('../../../assets/combo-munchies.jpg'),
  'cadbury-silk-real.jpg': require('../../../assets/cadbury-silk-real.jpg'),
  'dettol-handwash-real.jpg': require('../../../assets/dettol-handwash-real.jpg'),
  'dettol-real.jpg': require('../../../assets/dettol-handwash-real.jpg'),
  'fortune-oil-real.jpg': require('../../../assets/fortune-oil-real.jpg'),
  'apples-real.jpg': require('../../../assets/apples-real.jpg'),
};

const resolveProductImage = (imageStr?: string) => {
  if (!imageStr || typeof imageStr !== 'string') return { uri: DEFAULT_FALLBACK_IMAGE };
  const clean = getValidImage(imageStr);
  if (clean === DEFAULT_FALLBACK_IMAGE) return { uri: DEFAULT_FALLBACK_IMAGE };

  const filename = clean.split('/').pop()?.split('?')[0] || '';
  if (LOCAL_PRODUCT_IMAGES[clean]) return LOCAL_PRODUCT_IMAGES[clean];
  if (LOCAL_PRODUCT_IMAGES[filename]) return LOCAL_PRODUCT_IMAGES[filename];

  return { uri: optimizeImageUrl(clean, 200) };
};

const canCancelOrder = (statusStr?: string) => {
  const st = String(statusStr || '').toLowerCase();
  return st === 'placed' || st === 'preparing' || st === 'confirmed' || st === 'pending' || st === 'packed' || st === 'ready' || st === 'ready_for_pickup';
};

const ORDER_CYCLE_STAGES = [
  { key: 'placed', label: 'Placed', fullLabel: 'Order Placed', desc: 'Order received & verified', icon: '🛒' },
  { key: 'preparing', label: 'Preparing', fullLabel: 'Store Packing', desc: 'Fresh Mart is packing your items', icon: '🍳' },
  { key: 'ready', label: 'Ready', fullLabel: 'Ready for Pickup', desc: 'Packed & awaiting rider pickup', icon: '📦' },
  { key: 'out_for_delivery', label: 'On the Way', fullLabel: 'Out for Delivery', desc: 'Rider is on the way to your door', icon: '🛵' },
  { key: 'delivered', label: 'Delivered', fullLabel: 'Order Delivered', desc: 'Delivered safely to your doorstep', icon: '🎉' },
];

const getStepIndex = (statusStr?: string) => {
  const st = String(statusStr || '').toLowerCase();
  if (st === 'delivered') return 4;
  if (st === 'out_for_delivery' || st === 'out-for-delivery' || st === 'picked_up') return 3;
  if (st === 'ready' || st === 'ready_for_pickup') return 2;
  if (st === 'preparing' || st === 'confirmed') return 1;
  if (st === 'cancelled') return -1;
  return 0;
};

const matchesOrder = (o: any, target: string) => {
  if (!o || !target) return false;
  const t = String(target).trim();
  const tNorm = t.toLowerCase().replace(/^(ord|gb)-?/i, '').replace(/[^a-z0-9]/g, '');

  const oId = String(o.id || '').trim();
  const oRawId = String(o.rawId || '').trim();
  const oNum = String(o.order_number || o.orderNumber || '').trim();
  const oDisp = String(o.displayId || '').trim();

  if (oId === t || oRawId === t || oNum === t || oDisp === t) return true;

  const cleanOId = oId.replace(/[^a-zA-Z0-9]/g, '');
  const cleanORaw = oRawId.replace(/[^a-zA-Z0-9]/g, '');
  const dispOId = `ORD-${cleanOId.slice(0, 8).toUpperCase()}`;
  const dispORaw = `ORD-${cleanORaw.slice(0, 8).toUpperCase()}`;
  const gbOId = `GB-${cleanOId.slice(0, 4).toUpperCase()}`;
  const gbORaw = `GB-${cleanORaw.slice(0, 4).toUpperCase()}`;
  const upperT = t.toUpperCase();
  if (upperT === dispOId || upperT === dispORaw || upperT === gbOId || upperT === gbORaw) return true;

  const normId = cleanOId.toLowerCase().replace(/^(ord|gb)/i, '');
  const normRaw = cleanORaw.toLowerCase().replace(/^(ord|gb)/i, '');
  const normNum = String(oNum).replace(/[^a-zA-Z0-9]/g, '').toLowerCase().replace(/^(ord|gb)/i, '');
  if (normId === tNorm || normRaw === tNorm || normNum === tNorm) return true;

  if (tNorm.length >= 6 && (normId.length >= 6 || normRaw.length >= 6)) {
    if (normId.startsWith(tNorm) || normRaw.startsWith(tNorm)) return true;
  }

  return false;
};

const CANCEL_REASONS = [
  'Placed order by mistake',
  'Need to change delivery address or phone',
  'Forgot to add essential items',
  'Delivery time is taking too long',
  'Other reason',
];

const ISSUE_OPTIONS = [
  'Late Delivery / Delay',
  'Missing or Incorrect Item',
  'Damaged / Spilled Product',
  'Driver Behavior Issue',
  'Other Inquiry',
];

const REVIEW_TAGS = ['Fast Delivery', 'Fresh Products', 'Friendly Partner', 'Accurate Items', 'Great Packaging'];

export default function OrderDetailsPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [supportModalOpen, setSupportModalOpen] = useState<boolean>(false);
  const [issueSubmitted, setIssueSubmitted] = useState<boolean>(false);
  const [selectedIssueType, setSelectedIssueType] = useState<string>('');

  const [chatModalOpen, setChatModalOpen] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<any[]>([
    {
      id: 1,
      sender: 'agent',
      text: 'Hello! 👋 I am your GrabIt Support Assistant. How can I help you with this order today?',
      time: 'Just now',
    },
  ]);
  const [chatInput, setChatInput] = useState<string>('');

  const [cancelModalOpen, setCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('Placed order by mistake');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // Review section state
  const [rating, setRating] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Fast Delivery', 'Fresh Products']);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [reviewSubmitted, setReviewSubmitted] = useState<boolean>(false);

  const formatOrderData = useCallback((found: any) => {
    const st = String(found.status || '').toLowerCase();
    const step = getStepIndex(st);

    let rawItems: any[] = [];
    if (Array.isArray(found.items)) {
      rawItems = found.items;
    } else {
      try {
        rawItems = JSON.parse(found.items || '[]');
      } catch {
        rawItems = [];
      }
    }

    const cleanDisplayId = String(found.orderNumber || found.id || '').replace(/^GB-?/i, '');
    const formattedId = cleanDisplayId.length > 5 ? cleanDisplayId.slice(0, 6).toUpperCase() : cleanDisplayId.toUpperCase() || 'A64BF';

    const dateStr = found.created_at
      ? new Date(found.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : found.date || '8 Sept 2026';
    const timeStr = found.created_at
      ? new Date(found.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : found.time || '03:52 PM';

    return {
      ...found,
      id: found.id,
      rawId: found.rawId || found.id,
      displayId: `GB-${formattedId}`,
      date: `${dateStr}, ${timeStr}`,
      status: st,
      normStatus: st === 'out_for_delivery' ? 'out-for-delivery' : st,
      statusLabel: st.replace(/_/g, ' ').toUpperCase(),
      eta: found.estimated_time || found.eta || '10-15 min express delivery',
      trackerStep: step,
      items: rawItems.map((it: any) => ({
        id: it.id || it.product_id,
        name: it.name || it.product_name || 'Grocery Item',
        qty: Number(it.qty || it.quantity) || 1,
        price: Number(it.price || it.unit_price) || 70,
        image: it.image || it.image_url || 'apples-real.jpg',
      })),
      totalItems: rawItems.reduce((acc: number, it: any) => acc + (Number(it.qty || it.quantity) || 1), 0) || 1,
      total: Number(found.total_amount || found.total) || 70,
      address: found.delivery_address || found.address || 'Baiyyappanahalli, Bengaluru 560043',
      paymentMethod: (found.payment_method || 'UPI').toUpperCase(),
      subtotal: Number(found.subtotal || found.total_amount || found.total) || 70,
      mrp_total: Number(found.mrp_total) || Number(found.total_amount || found.total) || 70,
      discount: Number(found.discount) || 0,
      coupon_discount: Number(found.coupon_discount) || 0,
      delivery_fee: Number(found.delivery_fee) || 0,
      delivery_agent_name: found.delivery_agent_name || found.rider_name || 'Karthik Rider',
      delivery_agent_phone: found.delivery_agent_phone || '+91 9999900003',
      delivery_vehicle: found.delivery_vehicle || 'Speedy Express • Hero Electric (KA 01 EQ 4421)',
      delivery_rating: found.delivery_rating || '⭐ 4.9 Rating (420+ deliveries)',
    };
  }, []);

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    try {
      const rawPhone = (user?.phone || '').replace(/\D/g, '');
      const phoneDigits = rawPhone.length >= 10 ? rawPhone.slice(-10) : rawPhone;
      const storageKey = `grabit_orders_${phoneDigits || '9999900004'}`;

      // 1. Storage fast lookup
      const [localUserOrders, globalOrders] = await Promise.all([
        getItem<any[]>(storageKey),
        getItem<any[]>('grabit_orders'),
      ]);
      const mergedLocal = [...(localUserOrders || []), ...(globalOrders || [])];
      const foundLocal = mergedLocal.find((o) => matchesOrder(o, id));
      if (foundLocal) {
        setOrder(formatOrderData(foundLocal));
        setLoading(false);
      }

      // 2. Fetch fresh from backend API
      const fetchPath = phoneDigits ? `/orders/user/${phoneDigits}` : '/orders/';
      const apiRes = await get<any[]>(fetchPath).catch(() => []);
      if (Array.isArray(apiRes)) {
        const foundApi = apiRes.find((o) => matchesOrder(o, id));
        if (foundApi) {
          setOrder(formatOrderData(foundApi));
        }
      }
    } catch {
      // Ignore network sync err
    } finally {
      setLoading(false);
    }
  }, [id, user?.phone, formatOrderData]);

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 4000);
    return () => clearInterval(interval);
  }, [fetchOrder]);

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const userMsg = { id: Date.now(), sender: 'user', text: chatInput.trim(), time: 'Just now' };
    setChatMessages((prev) => [...prev, userMsg]);
    const inputClean = chatInput.toLowerCase();
    setChatInput('');

    setTimeout(() => {
      let replyText = 'Our customer support team has logged your query. An agent will contact you shortly if needed!';
      const riderName = order?.delivery_agent_name || 'Karthik Rider';
      const orderStatus = (order?.status || '').toLowerCase();

      if (inputClean.includes('rider') || inputClean.includes('driver') || inputClean.includes('location')) {
        if (orderStatus === 'out_for_delivery' || orderStatus === 'assigned' || orderStatus === 'picked_up') {
          replyText = `🛵 ${riderName} is en-route with your order. You can track live updates on your tracking screen.`;
        } else if (orderStatus === 'delivered') {
          replyText = `✅ Your order was marked as delivered by ${riderName}. If you need any assistance, please tap "Need Help?".`;
        } else {
          replyText = '📦 Your order is being packed at the store. A delivery partner will be assigned as soon as packing is complete.';
        }
      } else if (inputClean.includes('cancel')) {
        if (orderStatus === 'out_for_delivery' || orderStatus === 'delivered') {
          replyText = '⚠️ Orders currently out for delivery or delivered cannot be cancelled automatically. Please contact support.';
        } else {
          replyText = 'ℹ️ You can cancel your order directly using the "Cancel Order" button before the store finishes packing.';
        }
      } else if (inputClean.includes('item') || inputClean.includes('missing') || inputClean.includes('wrong') || inputClean.includes('damage')) {
        replyText = "📦 We're very sorry for any trouble with your items! Our support team has logged your ticket to resolve this quickly.";
      }

      setChatMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'agent', text: replyText, time: 'Just now' }]);
    }, 800);
  };

  const handleReorder = () => {
    if (!order || !order.items) return;
    const itemList = Array.isArray(order.items) ? order.items : [];
    itemList.forEach((it: any) => {
      const matchedProd = products.find(
        (p) =>
          String(p.id) === String(it.id) ||
          p.name.toLowerCase().trim() === it.name.toLowerCase().trim()
      );
      if (matchedProd) {
        addToCart(matchedProd, it.qty);
      } else {
        addToCart(
          {
            id: it.id || `p-${Date.now()}`,
            name: it.name,
            price: it.price,
            originalPrice: Math.round(it.price * 1.25),
            discountPercent: 20,
            image: it.image,
            category: 'produce',
            inStock: true,
          },
          it.qty
        );
      }
    });
    showToast(`${itemList.length} items added back to your cart! 🛒`, 'success');
    router.push('/customer/cart' as any);
  };

  const handleConfirmCancel = async () => {
    if (!order) return;
    setIsCancelling(true);
    const targetId = order.rawId || order.id || id;
    const finalReason = cancelReason || 'Cancelled by customer';

    try {
      await patch(`/orders/${targetId}/status`, {
        status: 'cancelled',
        cancellation_reason: finalReason,
      }).catch(() => {});

      const updateList = (list: any[]) =>
        (list || []).map((o) => {
          if (o.id === order.id || o.rawId === targetId || o.id === targetId) {
            return {
              ...o,
              status: 'cancelled',
              cancellation_reason: finalReason,
              cancelled_at: new Date().toISOString(),
            };
          }
          return o;
        });

      const rawPhone = (user?.phone || '').replace(/\D/g, '');
      const phoneDigits = rawPhone.length >= 10 ? rawPhone.slice(-10) : rawPhone;
      const storageKey = `grabit_orders_${phoneDigits || '9999900004'}`;

      const [localUserOrders, globalOrders] = await Promise.all([
        getItem<any[]>(storageKey),
        getItem<any[]>('grabit_orders'),
      ]);
      await Promise.all([
        setItem(storageKey, updateList(localUserOrders || [])),
        setItem('grabit_orders', updateList(globalOrders || [])),
      ]);

      setOrder((prev: any) => ({
        ...prev,
        status: 'cancelled',
        cancellation_reason: finalReason,
        trackerStep: -1,
      }));

      showToast(`Order #${order.displayId || id} has been cancelled.`, 'info');
      setCancelModalOpen(false);
    } catch {
      showToast('Failed to cancel order. Please try again.', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReviewSubmit = () => {
    setReviewSubmitted(true);
    showToast('Thank you for your rating! ⭐', 'success');
  };

  if (loading && !order) {
    return (
      <View style={styles.centerLoading}>
        <ActivityIndicator size="large" color="#0071E3" />
        <Text style={styles.centerLoadingText}>Fetching live order tracking details...</Text>
      </View>
    );
  }

  const currentStepIndex = order ? getStepIndex(order.status) : 0;
  const isDelivered = order?.status === 'delivered';
  const isCancelled = order?.status === 'cancelled';
  const isRiderAssigned = Boolean(
    order?.delivery_agent_id ||
    order?.deliveryAgent ||
    currentStepIndex >= 3 ||
    ['out_for_delivery', 'out-for-delivery', 'picked_up', 'delivered'].includes(String(order?.status || '').toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* ── 1. TOP NAV BAR ── */}
      <View style={styles.topNavBar}>
        <View style={styles.topNavLeft}>
          <Pressable style={styles.backBtnCircle} onPress={() => router.push('/customer/orders' as any)}>
            <ArrowLeft size={20} color="#0F172A" />
          </Pressable>
          <View>
            <Text style={styles.topNavSub}>ORDER TRACKING</Text>
            <Text style={styles.topNavTitle}>{order?.displayId || `Order #${id}`}</Text>
          </View>
        </View>

        <Pressable style={styles.helpBtnPill} onPress={() => setSupportModalOpen(true)}>
          <HelpCircle size={15} color="#0071E3" />
          <Text style={styles.helpBtnText}>Need Help?</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── 2. HERO LIVE ETA CARD ── */}
        <View
          style={[
            styles.heroEtaCard,
            isCancelled && styles.heroEtaCardCancelled,
            isDelivered && styles.heroEtaCardDelivered,
          ]}
        >
          {/* Header pill inside card */}
          <View
            style={[
              styles.heroStatusPill,
              isCancelled && styles.heroStatusPillCancelled,
              isDelivered && styles.heroStatusPillDelivered,
            ]}
          >
            <Zap size={13} color={isCancelled ? '#DC2626' : isDelivered ? '#16A34A' : '#FFD700'} fill={isCancelled ? '#DC2626' : isDelivered ? '#16A34A' : '#FFD700'} />
            <Text
              style={[
                styles.heroStatusPillText,
                isCancelled && styles.heroStatusTextCancelled,
                isDelivered && styles.heroStatusTextDelivered,
              ]}
            >
              {isCancelled ? 'ORDER CANCELLED' : isDelivered ? 'DELIVERED SUCCESSFULLY' : 'EXPRESS DELIVERY IN PROGRESS'}
            </Text>
          </View>

          {/* Main Title & Subtitle */}
          <Text style={[styles.heroMainTitle, isCancelled && { color: '#991B1B' }, isDelivered && { color: '#166534' }]}>
            {isCancelled ? 'Order Was Cancelled' : isDelivered ? 'Delivered To Your Door' : 'Arriving in 10 - 15 Mins'}
          </Text>
          <Text style={[styles.heroSubTitle, isCancelled && { color: '#7F1D1D' }, isDelivered && { color: '#14532D' }]}>
            {isCancelled
              ? 'Refund issued to your payment account.'
              : isDelivered
              ? `Delivered on ${order?.date}`
              : 'Store partner Fresh Mart is fulfilling your order en-route.'}
          </Text>

          {/* Estimated Arrival Box */}
          {!isCancelled && !isDelivered && (
            <View style={styles.heroEstimatedBox}>
              <Clock size={24} color="#FFFFFF" />
              <View>
                <Text style={styles.heroEstimatedSub}>ESTIMATED ARRIVAL</Text>
                <Text style={styles.heroEstimatedTime}>10:45 AM</Text>
              </View>
            </View>
          )}

          {/* 5-Step Stepper inside Hero */}
          {!isCancelled && (
            <View style={[styles.stepperContainer, isDelivered && { borderTopColor: '#DCFCE7' }]}>
              <View style={styles.stepperGrid}>
                {ORDER_CYCLE_STAGES.map((stg, idx) => {
                  const isDone = currentStepIndex >= idx;
                  const isCurrent = currentStepIndex === idx;

                  return (
                    <View key={stg.key} style={styles.stepperCol}>
                      <View
                        style={[
                          styles.stepperCircle,
                          isDone && (isDelivered ? styles.stepperCircleDoneGreen : styles.stepperCircleDoneWhite),
                          isCurrent && styles.stepperCircleCurrent,
                        ]}
                      >
                        {isDone ? (
                          <Check size={isCurrent ? 16 : 13} color={isDelivered ? '#FFFFFF' : '#0071E3'} strokeWidth={3} />
                        ) : (
                          <Text style={styles.stepperNum}>{idx + 1}</Text>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.stepperLabel,
                          isDone && { opacity: 1, fontWeight: '800' },
                          isCurrent && { fontWeight: '900' },
                          isDelivered && { color: '#166534' },
                        ]}
                        numberOfLines={1}
                      >
                        {stg.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* ── 3. ASSIGNED DELIVERY PARTNER CARD ── */}
        {!isCancelled && (
          isRiderAssigned ? (
            <View style={styles.sectionCard}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardHeaderLabel}>ASSIGNED DELIVERY PARTNER</Text>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedBadgeText}>🟢 Verified Partner</Text>
                </View>
              </View>

              <View style={styles.riderInfoRow}>
                <View style={styles.riderAvatarSquare}>
                  <Text style={{ fontSize: 24 }}>🛵</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.riderName}>{order?.delivery_agent_name || 'Karthik Rider'}</Text>
                  <Text style={styles.riderVehicle}>{order?.delivery_vehicle || 'Speedy Express • Hero Electric (KA 01 EQ 4421)'}</Text>
                  <Text style={styles.riderRating}>{order?.delivery_rating || '⭐ 4.9 Rating (420+ deliveries)'}</Text>
                </View>
              </View>

              <View style={styles.riderActionsRow}>
                <Pressable
                  style={styles.riderCallBtn}
                  onPress={() => {
                    showToast('Calling rider Karthik (+91 9999900003)... 📞', 'info');
                    Linking.openURL('tel:+919999900003').catch(() => {});
                  }}
                >
                  <PhoneCall size={15} color="#FFFFFF" />
                  <Text style={styles.riderCallBtnText}>Call</Text>
                </Pressable>

                <Pressable style={styles.riderChatBtn} onPress={() => setChatModalOpen(true)}>
                  <MessageSquare size={15} color="#FFFFFF" />
                  <Text style={styles.riderChatBtnText}>Chat</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={[styles.sectionCard, styles.assigningPartnerCard]}>
              <View style={styles.assigningPartnerIcon}>
                <Text style={{ fontSize: 22 }}>⏳</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.assigningPartnerTitle}>Assigning Nearby Delivery Partner...</Text>
                <Text style={styles.assigningPartnerSub}>
                  Store is packing your items. Live partner details and GPS route will show as soon as a delivery partner is assigned.
                </Text>
              </View>
            </View>
          )
        )}

        {/* ── 4. LIVE SIMULATED ROUTE MAP ── */}
        {!isCancelled && isRiderAssigned && (
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.sectionTitle}>Live Route View</Text>
              <Text style={styles.routeDistanceText}>1.2 km away</Text>
            </View>

            <View style={styles.mapVisualContainer}>
              <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                <Path
                  d="M 30 110 Q 140 20 280 90"
                  stroke="#0071E3"
                  strokeWidth="3.5"
                  strokeDasharray="6, 6"
                  fill="none"
                />
              </Svg>

              {/* Store Pin */}
              <View style={styles.mapStorePin}>
                <View style={styles.pinTagDark}><Text style={styles.pinTagText}>Store</Text></View>
                <View style={styles.storePinDot} />
              </View>

              {/* Moving Rider Pin */}
              <View style={styles.mapRiderPin}>
                <View style={styles.riderPinBubble}>
                  <Text style={styles.riderPinBubbleText}>🛵 Rider</Text>
                </View>
              </View>

              {/* Home Pin */}
              <View style={styles.mapHomePin}>
                <View style={styles.pinTagGreen}><Text style={styles.pinTagText}>Home</Text></View>
                <View style={styles.homePinDot} />
              </View>
            </View>
          </View>
        )}

        {/* ── 5. ORDER ITEMS BREAKDOWN ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Order Items ({order?.items?.length || 0})</Text>

          <View style={styles.itemsListCol}>
            {(order?.items || []).map((it: any, idx: number) => {
              const imgSource = resolveProductImage(it.image);
              return (
                <View key={idx} style={[styles.itemRow, idx === order.items.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.itemLeftGroup}>
                    <View style={styles.itemImgSquare}>
                      <Image source={imgSource} style={styles.itemThumb} resizeMode="contain" />
                    </View>
                    <View style={styles.itemTextGroup}>
                      <Text style={styles.itemNameText} numberOfLines={2}>{it.name}</Text>
                      <Text style={styles.itemQtyText}>Qty: {it.qty}</Text>
                    </View>
                  </View>
                  <Text style={styles.itemPriceText}>₹{it.price * it.qty}</Text>
                </View>
              );
            })}
          </View>

          {/* Action Row inside items card */}
          <View style={styles.itemCardActionsRow}>
            {canCancelOrder(order?.status) && !isCancelled && (
              <Pressable
                style={styles.cancelActionBtn}
                onPress={() => {
                  setCancelReason('Placed order by mistake');
                  setCancelModalOpen(true);
                }}
              >
                <X size={15} color="#DC2626" />
                <Text style={styles.cancelActionBtnText}>Cancel Order</Text>
              </Pressable>
            )}

            <Pressable style={styles.reorderActionBtn} onPress={handleReorder}>
              <RefreshCw size={15} color="#0071E3" />
              <Text style={styles.reorderActionBtnText}>Reorder All Items</Text>
            </Pressable>
          </View>
        </View>

        {/* ── 6. CUSTOMER REVIEW / EXPERIENCE SECTION ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Share Your Experience</Text>
          <Text style={styles.reviewSub}>How was your delivery experience with Fresh Mart?</Text>

          {/* 5 Stars */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Pressable key={s} onPress={() => setRating(s)} style={styles.starBtn}>
                <Star
                  size={26}
                  color={s <= rating ? '#F59E0B' : '#CBD5E1'}
                  fill={s <= rating ? '#F59E0B' : 'transparent'}
                />
              </Pressable>
            ))}
          </View>

          {/* Compliment Tags */}
          <View style={styles.tagsWrapRow}>
            {REVIEW_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  style={[styles.tagPill, isSelected && styles.tagPillActive]}
                  onPress={() => {
                    setSelectedTags((prev) =>
                      isSelected ? prev.filter((t) => t !== tag) : [...prev, tag]
                    );
                  }}
                >
                  <Text style={[styles.tagPillText, isSelected && styles.tagPillTextActive]}>{tag}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Feedback Input */}
          <TextInput
            style={styles.reviewInput}
            placeholder="Write a note about the delivery or products..."
            placeholderTextColor="#94A3B8"
            value={reviewComment}
            onChangeText={setReviewComment}
            multiline
          />

          <Pressable
            style={[styles.submitReviewBtn, reviewSubmitted && styles.submitReviewBtnDone]}
            onPress={handleReviewSubmit}
            disabled={reviewSubmitted}
          >
            <Text style={styles.submitReviewBtnText}>
              {reviewSubmitted ? '✓ Review Submitted!' : 'Submit Review'}
            </Text>
          </Pressable>
        </View>

        {/* ── 7. DELIVERY ADDRESS CARD ── */}
        <View style={styles.sectionCard}>
          <View style={styles.addressTitleRow}>
            <MapPin size={18} color="#0071E3" />
            <Text style={styles.sectionTitle}>Delivery Address</Text>
          </View>
          <Text style={styles.addressTag}>Home</Text>
          <Text style={styles.addressBody}>
            {order?.address || 'Baiyyappanahalli, Bengaluru 560043'}
          </Text>
        </View>

        {/* ── 8. PAYMENT BREAKDOWN CARD ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Payment Details</Text>

          <View style={styles.billLinesCol}>
            <View style={styles.billLine}>
              <Text style={styles.billLabel}>Item Total</Text>
              <Text style={styles.billVal}>
                ₹{order?.mrp_total || order?.subtotal || order?.total}
              </Text>
            </View>

            {Number(order?.discount) > 0 && (
              <View style={styles.billLine}>
                <Text style={styles.billLabel}>Product Discount</Text>
                <Text style={[styles.billVal, { color: '#16A34A' }]}>-₹{order.discount}</Text>
              </View>
            )}

            {Number(order?.coupon_discount) > 0 && (
              <View style={styles.billLine}>
                <Text style={styles.billLabel}>Coupon Discount</Text>
                <Text style={[styles.billVal, { color: '#16A34A' }]}>-₹{order.coupon_discount}</Text>
              </View>
            )}

            <View style={styles.billLine}>
              <Text style={styles.billLabel}>Delivery Fee</Text>
              <Text style={[styles.billVal, { color: (Number(order?.delivery_fee) || 0) === 0 ? '#16A34A' : '#0F172A' }]}>
                {(Number(order?.delivery_fee) || 0) === 0 ? 'FREE' : `₹${order.delivery_fee}`}
              </Text>
            </View>

            <View style={[styles.billLine, styles.billTotalLine]}>
              <Text style={styles.billTotalLabel}>Total Amount Paid</Text>
              <Text style={styles.billTotalVal}>₹{order?.total || 0}</Text>
            </View>
          </View>

          <View style={styles.paymentMethodBox}>
            <Text style={styles.paymentMethodLabel}>Payment Method</Text>
            <Text style={styles.paymentMethodVal}>{order?.paymentMethod || 'UPI'} ✓</Text>
          </View>
        </View>

        {/* ── 9. QUICK CUSTOMER SUPPORT CARD ── */}
        <View style={styles.supportDarkCard}>
          <View style={styles.supportHeaderRow}>
            <HelpCircle size={20} color="#38BDF8" />
            <Text style={styles.supportDarkTitle}>Need Help with Order?</Text>
          </View>
          <Text style={styles.supportDarkSub}>
            Our 24/7 GrabIt Customer Care is here to assist with order changes, delays, or issues.
          </Text>

          <Pressable style={styles.chatSupportBtn} onPress={() => setChatModalOpen(true)}>
            <MessageSquare size={16} color="#FFFFFF" />
            <Text style={styles.chatSupportBtnText}>Live Chat Support Assistant</Text>
          </Pressable>

          <Pressable
            style={styles.callSupportBtn}
            onPress={() => {
              showToast('Connecting to GrabIt 24/7 Support Care (+91 1800-419-4722)... 📞', 'info');
              Linking.openURL('tel:+9118004194722').catch(() => {});
            }}
          >
            <Phone size={16} color="#FFFFFF" />
            <Text style={styles.callSupportBtnText}>Call Support (+91 1800-419-4722)</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── 10. LIVE CHAT SUPPORT MODAL ── */}
      <Modal visible={chatModalOpen} transparent animationType="slide">
        <View style={styles.chatModalOverlay}>
          <View style={styles.chatModalSheet}>
            {/* Modal Header */}
            <View style={styles.chatModalHeader}>
              <View style={styles.chatHeaderInfo}>
                <View style={styles.greenLiveDot} />
                <View>
                  <Text style={styles.chatHeaderTitle}>GrabIt Live Support</Text>
                  <Text style={styles.chatHeaderSub}>Online • Typically replies instantly</Text>
                </View>
              </View>
              <Pressable onPress={() => setChatModalOpen(false)} style={styles.chatCloseBtn}>
                <X size={18} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* Chat Body */}
            <ScrollView style={styles.chatBody} contentContainerStyle={styles.chatBodyContent}>
              {chatMessages.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.chatBubble,
                    msg.sender === 'user' ? styles.chatBubbleUser : styles.chatBubbleAgent,
                  ]}
                >
                  <Text style={[styles.chatBubbleText, msg.sender === 'user' && { color: '#FFFFFF' }]}>
                    {msg.text}
                  </Text>
                </View>
              ))}
            </ScrollView>

            {/* Quick Chips */}
            <View style={styles.quickChipsWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickChipsRow}
              >
                {['Where is rider?', 'Missing item', 'Cancel order', 'Talk to human agent'].map((opt, i) => (
                  <Pressable
                    key={i}
                    style={styles.chipPill}
                    onPress={() => setChatInput(opt)}
                  >
                    <Text style={styles.chipPillText}>{opt}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Input Bar */}
            <View style={styles.chatInputBar}>
              <TextInput
                style={styles.chatInput}
                placeholder="Type your message..."
                placeholderTextColor="#94A3B8"
                value={chatInput}
                onChangeText={setChatInput}
                onSubmitEditing={handleSendMessage}
              />
              <Pressable style={styles.sendBtn} onPress={handleSendMessage}>
                <Send size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 11. NEED HELP / ISSUE MODAL ── */}
      <Modal visible={supportModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.supportModalCard}>
            <View style={styles.supportModalTop}>
              <Text style={styles.supportModalTitle}>Need Help with Order?</Text>
              <Pressable onPress={() => setSupportModalOpen(false)}>
                <X size={18} color="#64748B" />
              </Pressable>
            </View>

            {issueSubmitted ? (
              <View style={styles.issueSuccessBox}>
                <CheckCircle2 size={44} color="#16A34A" />
                <Text style={styles.issueSuccessTitle}>Ticket Submitted!</Text>
                <Text style={styles.issueSuccessSub}>
                  Our GrabIt resolution team is reviewing your report. You will receive an update in under 5 minutes.
                </Text>
                <Pressable
                  style={styles.backToTrackingBtn}
                  onPress={() => {
                    setIssueSubmitted(false);
                    setSupportModalOpen(false);
                  }}
                >
                  <Text style={styles.backToTrackingBtnText}>Back to Tracking</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Text style={styles.issuePromptText}>
                  Select an issue regarding <Text style={{ fontWeight: '800' }}>{order?.displayId || id}</Text>:
                </Text>

                <View style={styles.issueListCol}>
                  {ISSUE_OPTIONS.map((issue) => {
                    const isSelected = selectedIssueType === issue;
                    return (
                      <Pressable
                        key={issue}
                        style={[styles.issueOptionItem, isSelected && styles.issueOptionItemActive]}
                        onPress={() => setSelectedIssueType(issue)}
                      >
                        <Text style={[styles.issueOptionText, isSelected && styles.issueOptionTextActive]}>
                          {issue}
                        </Text>
                        {isSelected && <Check size={16} color="#0071E3" />}
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.issueModalActionsRow}>
                  <Pressable style={styles.issueCancelBtn} onPress={() => setSupportModalOpen(false)}>
                    <Text style={styles.issueCancelBtnText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    style={styles.issueSubmitBtn}
                    onPress={() => {
                      if (!selectedIssueType) {
                        showToast('Please select an issue type first!', 'info');
                        return;
                      }
                      setIssueSubmitted(true);
                    }}
                  >
                    <Text style={styles.issueSubmitBtnText}>Submit Ticket</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ── 12. CANCEL ORDER CONFIRMATION MODAL ── */}
      <Modal visible={cancelModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.cancelModalCard}>
            <View style={styles.cancelModalHeader}>
              <View style={styles.cancelIconCircle}>
                <AlertCircle size={24} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cancelModalTitle}>
                  Cancel Order #{order?.displayId || id}?
                </Text>
                <Text style={styles.cancelModalSub}>
                  Are you sure you want to cancel this order? Once cancelled, this action cannot be undone.
                </Text>
              </View>
              <Pressable
                onPress={() => !isCancelling && setCancelModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <X size={16} color="#64748B" />
              </Pressable>
            </View>

            {/* Refund banner */}
            <View style={styles.refundBanner}>
              <Check size={18} color="#16A34A" style={{ marginRight: 8, flexShrink: 0 }} />
              <Text style={styles.refundBannerText}>
                A 100% full refund of{' '}
                <Text style={{ fontWeight: '800' }}>₹{order?.total || 0}</Text> will be credited to your
                original payment source within 15-30 minutes.
              </Text>
            </View>

            {/* Reason list */}
            <Text style={styles.reasonHeaderLabel}>Reason for cancellation:</Text>
            <View style={styles.reasonsList}>
              {CANCEL_REASONS.map((reason) => {
                const isChecked = cancelReason === reason;
                return (
                  <Pressable
                    key={reason}
                    style={[styles.reasonOption, isChecked && styles.reasonOptionActive]}
                    onPress={() => setCancelReason(reason)}
                  >
                    <View style={[styles.radioCircle, isChecked && styles.radioCircleActive]}>
                      {isChecked ? <View style={styles.radioInnerDot} /> : null}
                    </View>
                    <Text style={[styles.reasonOptionText, isChecked && styles.reasonOptionTextActive]}>
                      {reason}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Actions */}
            <View style={styles.cancelModalActionsRow}>
              <Pressable
                style={styles.keepOrderBtn}
                onPress={() => !isCancelling && setCancelModalOpen(false)}
                disabled={isCancelling}
              >
                <Text style={styles.keepOrderBtnText}>Keep Order</Text>
              </Pressable>

              <Pressable
                style={styles.confirmCancelBtn}
                onPress={handleConfirmCancel}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmCancelBtnText}>Yes, Cancel Order</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  topNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topNavSub: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  topNavTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  helpBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  helpBtnText: {
    color: '#0071E3',
    fontSize: 12,
    fontWeight: '800',
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 100,
    gap: 16,
  },

  /* ── 2. Hero Card ── */
  heroEtaCard: {
    backgroundColor: '#0071E3',
    borderRadius: 24,
    padding: 20,
    ...SHADOWS.md,
  },
  heroEtaCardDelivered: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  heroEtaCardCancelled: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  heroStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  heroStatusPillDelivered: {
    backgroundColor: '#DCFCE7',
  },
  heroStatusPillCancelled: {
    backgroundColor: '#FEE2E2',
  },
  heroStatusPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroStatusTextDelivered: {
    color: '#166534',
  },
  heroStatusTextCancelled: {
    color: '#DC2626',
  },
  heroMainTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSubTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 14,
  },
  heroEstimatedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    marginBottom: 14,
  },
  heroEstimatedSub: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    opacity: 0.8,
  },
  heroEstimatedTime: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  stepperContainer: {
    marginTop: 6,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  stepperGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepperCol: {
    alignItems: 'center',
    width: '18%',
  },
  stepperCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepperCircleDoneWhite: {
    backgroundColor: '#FFFFFF',
  },
  stepperCircleDoneGreen: {
    backgroundColor: '#16A34A',
  },
  stepperCircleCurrent: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  stepperNum: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '900',
  },
  stepperLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    opacity: 0.65,
    textAlign: 'center',
  },

  /* Section Card standard */
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    ...SHADOWS.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  verifiedBadgeText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '800',
  },
  riderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  riderAvatarSquare: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#0071E3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  riderVehicle: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  riderRating: {
    fontSize: 11.5,
    color: '#0071E3',
    fontWeight: '800',
    marginTop: 1,
  },
  riderActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  riderCallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 10,
  },
  riderCallBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  riderChatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0071E3',
    borderRadius: 12,
    paddingVertical: 10,
  },
  riderChatBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },

  /* Assigning Partner Card */
  assigningPartnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  assigningPartnerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assigningPartnerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  assigningPartnerSub: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 16,
  },

  /* Map View */
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  routeDistanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0071E3',
  },
  mapVisualContainer: {
    height: 160,
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    position: 'relative',
    overflow: 'hidden',
    marginTop: 6,
  },
  mapStorePin: {
    position: 'absolute',
    left: 20,
    bottom: 25,
    alignItems: 'center',
  },
  storePinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pinTagDark: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  pinTagGreen: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  pinTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  mapRiderPin: {
    position: 'absolute',
    left: '46%',
    top: '35%',
    alignItems: 'center',
  },
  riderPinBubble: {
    backgroundColor: '#0071E3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#0071E3',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  riderPinBubbleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  mapHomePin: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    alignItems: 'center',
  },
  homePinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  /* Items breakdown */
  itemsListCol: {
    marginTop: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  itemTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  itemImgSquare: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  itemThumb: {
    width: 36,
    height: 36,
  },
  itemNameText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    flexShrink: 1,
  },
  itemQtyText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  itemPriceText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    flexShrink: 0,
    textAlign: 'right',
    marginLeft: 6,
  },
  itemCardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  cancelActionBtnText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 12.5,
  },
  reorderActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  reorderActionBtnText: {
    color: '#0071E3',
    fontWeight: '800',
    fontSize: 12.5,
  },

  /* Review Section */
  reviewSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 10,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  starBtn: {
    padding: 2,
  },
  tagsWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tagPill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tagPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0071E3',
  },
  tagPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  tagPillTextActive: {
    color: '#0071E3',
    fontWeight: '800',
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 10,
    fontSize: 12.5,
    color: '#0F172A',
    minHeight: 50,
    marginBottom: 12,
  },
  submitReviewBtn: {
    backgroundColor: '#0071E3',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  submitReviewBtnDone: {
    backgroundColor: '#10B981',
  },
  submitReviewBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },

  /* Delivery Address */
  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  addressTag: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  addressBody: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
  },

  /* Payment details */
  billLinesCol: {
    marginTop: 10,
    gap: 8,
  },
  billLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  billLabel: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '600',
  },
  billVal: {
    fontSize: 12.5,
    color: '#0F172A',
    fontWeight: '700',
  },
  billTotalLine: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  billTotalLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  billTotalVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0071E3',
  },
  paymentMethodBox: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentMethodLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
  },
  paymentMethodVal: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
  },

  /* Quick customer support */
  supportDarkCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 18,
    ...SHADOWS.md,
  },
  supportHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  supportDarkTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  supportDarkSub: {
    fontSize: 11.5,
    color: '#94A3B8',
    lineHeight: 16,
    marginBottom: 14,
  },
  chatSupportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0071E3',
    borderRadius: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  chatSupportBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  callSupportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  callSupportBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },

  /* Live Chat Modal */
  chatModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  chatModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    overflow: 'hidden',
  },
  chatModalHeader: {
    backgroundColor: '#0071E3',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  greenLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  chatHeaderTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  chatHeaderSub: {
    fontSize: 10.5,
    color: '#FFFFFF',
    opacity: 0.85,
  },
  chatCloseBtn: {
    padding: 4,
  },
  chatBody: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  chatBodyContent: {
    padding: 16,
    gap: 10,
  },
  chatBubble: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: 16,
    ...SHADOWS.sm,
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#0071E3',
    borderBottomRightRadius: 2,
  },
  chatBubbleAgent: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 2,
  },
  chatBubbleText: {
    fontSize: 13.5,
    color: '#0F172A',
    lineHeight: 19,
    fontWeight: '500',
  },
  quickChipsWrapper: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 6,
  },
  quickChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  chipPill: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'center',
  },
  chipPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0071E3',
  },
  chatInputBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0071E3',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Support / Issue Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  supportModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    ...SHADOWS.md,
  },
  supportModalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  supportModalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  issuePromptText: {
    fontSize: 12.5,
    color: '#64748B',
    marginBottom: 12,
  },
  issueListCol: {
    gap: 8,
    marginBottom: 16,
  },
  issueOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  issueOptionItemActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0071E3',
    borderWidth: 1.5,
  },
  issueOptionText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  issueOptionTextActive: {
    color: '#0071E3',
    fontWeight: '800',
  },
  issueModalActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  issueCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  issueCancelBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  issueSubmitBtn: {
    flex: 1,
    backgroundColor: '#0071E3',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  issueSubmitBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  issueSuccessBox: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  issueSuccessTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 10,
    marginBottom: 6,
  },
  issueSuccessSub: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  backToTrackingBtn: {
    backgroundColor: '#0071E3',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backToTrackingBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  /* Cancel Confirmation Modal */
  cancelModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    ...SHADOWS.md,
  },
  cancelModalHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  cancelIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelModalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  cancelModalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refundBanner: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  refundBannerText: {
    flex: 1,
    fontSize: 11.5,
    color: '#166534',
    fontWeight: '600',
    lineHeight: 16,
  },
  reasonHeaderLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 8,
  },
  reasonsList: {
    gap: 6,
    marginBottom: 16,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reasonOptionActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0071E3',
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleActive: {
    borderColor: '#0071E3',
  },
  radioInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0071E3',
  },
  reasonOptionText: {
    fontSize: 12.5,
    color: '#334155',
    fontWeight: '600',
  },
  reasonOptionTextActive: {
    color: '#0071E3',
    fontWeight: '800',
  },
  cancelModalActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  keepOrderBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  keepOrderBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  confirmCancelBtn: {
    flex: 1.3,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  confirmCancelBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  centerLoading: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  centerLoadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
});
