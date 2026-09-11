import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCart } from '../../context/CartContext';
import { useLocation } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { get, post, patch } from '../../services/api';
import { getItem, setItem, removeItem, clearAllLegacyOrderStorage, purgeLocalOrderStorage } from '../../services/storage';
import { products } from '../../data/products';
import { getValidImage, optimizeImageUrl, DEFAULT_FALLBACK_IMAGE } from '../../services/cloudinary';
import { NotificationModal } from '../../components/NotificationModal';
import { CustomerTopHeader } from '../../components/CustomerTopHeader';
import { getRealUserNotifications, clearAllNotifications } from '../../utils/userNotifications';
import { formatDisplayOrderId } from '../../utils/orderUtils';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import {
  Zap,
  MapPin,
  Bell,
  ShoppingBag,
  ArrowLeft,
  Search,
  ChevronRight,
  Clock,
  Check,
  CheckCircle,
  Truck,
  Package,
  XCircle,
  AlertCircle,
  Phone,
  HelpCircle,
  RefreshCw,
  X,
  User,
  Star,
  Receipt,
  FileText,
  Trash2,
} from 'lucide-react-native';

const resolveProductImage = (imageStr?: string) => {
  if (!imageStr || typeof imageStr !== 'string') return { uri: DEFAULT_FALLBACK_IMAGE };
  const clean = getValidImage(imageStr);
  return { uri: optimizeImageUrl(clean, 300) };
};

const canCancelOrder = (statusStr?: string) => {
  const st = String(statusStr || '').toLowerCase();
  return st === 'placed' || st === 'preparing' || st === 'confirmed' || st === 'pending' || st === 'packed' || st === 'ready' || st === 'ready_for_pickup';
};

const ORDER_CYCLE_STAGES = [
  { key: 'placed', label: 'Placed', fullLabel: 'Order Placed', desc: 'Order received & payment verified', icon: '🛒' },
  { key: 'preparing', label: 'Preparing', fullLabel: 'Store Preparing', desc: 'Store is picking & packing items', icon: '🍳' },
  { key: 'ready', label: 'Packed', fullLabel: 'Ready for Pickup', desc: 'Packed & awaiting rider pickup', icon: '📦' },
  { key: 'out_for_delivery', label: 'On Way', fullLabel: 'Out for Delivery', desc: 'Rider en-route to your doorstep', icon: '🛵' },
  { key: 'delivered', label: 'Delivered', fullLabel: 'Order Delivered', desc: 'Order delivered safely', icon: '🎉' },
];

const getCycleStepIndex = (statusStr?: string) => {
  const st = String(statusStr || '').toLowerCase();
  if (st === 'delivered') return 4;
  if (st === 'out_for_delivery' || st === 'out-for-delivery' || st === 'picked_up') return 3;
  if (st === 'ready' || st === 'ready_for_pickup') return 2;
  if (st === 'preparing' || st === 'confirmed') return 1;
  if (st === 'placed') return 0;
  return 0;
};

const isOngoingStatus = (status?: string) => {
  const st = String(status || '').toLowerCase();
  return st === 'confirmed' || st === 'out_for_delivery' || st === 'out-for-delivery' || st === 'ready' || st === 'ready_for_pickup' || st === 'placed' || st === 'preparing';
};

const STATUS_TABS = ['All Orders', 'Ongoing', 'Delivered', 'Cancelled'];

const CANCEL_REASONS = [
  'Placed order by mistake',
  'Need to change delivery address or phone',
  'Forgot to add essential items',
  'Delivery time is taking too long',
  'Other reason',
];

export default function OrdersPage() {
  const router = useRouter();
  const { totalItems: cartCount, addToCart } = useCart();
  const { currentAddress, fetchCurrentLocation } = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<string>('All Orders');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // View Details Modal State (matching screenshot)
  const [selectedOrderModal, setSelectedOrderModal] = useState<any | null>(null);

  // Cancellation Modal State
  const [cancellingOrder, setCancellingOrder] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Placed order by mistake');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // Notification Modal State
  const [isNotifModalOpen, setIsNotifModalOpen] = useState<boolean>(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);

  useEffect(() => {
    getRealUserNotifications(user?.phone).then((list) => {
      setUnreadNotifCount(list.filter((n) => n.unread).length);
    });
  }, [user?.phone, isNotifModalOpen]);

  // Only compute phone once the real authenticated user is available.
  // Never fall back to the demo test number — return empty string if not ready.
  const phoneDigits = useMemo(() => {
    const raw = (user?.phone || '').replace(/\D/g, '');
    return raw.length >= 10 ? raw.slice(-10) : '';
  }, [user?.phone]);

  // Pre-load from local storage immediately on mount so new orders show right away
  useEffect(() => {
    // Don't run preload if we don't have a phone yet (e.g. just after login before user resolves)
    // Prevents wiping the order list during the brief window before phoneDigits is available
    if (!phoneDigits) return;

    const preloadFromStorage = async () => {
      try {
        const keysToRead = phoneDigits ? [`grabit_orders_${phoneDigits}`] : ['grabit_orders_guest'];

        const results = await Promise.all(
          keysToRead.map((k) => getItem<any[]>(k).catch(() => []))
        );

        const uniqueMap = new Map<string, any>();
        results.forEach((cached) => {
          if (Array.isArray(cached) && cached.length > 0) {
            cached.forEach((o) => {
              if (o && (o.id || o.rawId)) {
                const oPhone = String(o.customer_phone || o.phone || '').replace(/\D/g, '');
                if (oPhone && phoneDigits && oPhone.length >= 10 && phoneDigits.length >= 10 && oPhone.slice(-10) !== phoneDigits.slice(-10)) {
                  return; // Belongs to a different user account! Do not leak!
                }
                const formatted = formatOrder(o);
                uniqueMap.set(String(formatted.rawId || formatted.id), formatted);
              }
            });
          }
        });

        const list = Array.from(uniqueMap.values());
        if (list.length > 0) {
          list.sort((a, b) => {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return timeB - timeA;
          });
          setOrdersList(list);
          setIsLoading(false);
        }
        // NOTE: Do NOT call setOrdersList([]) here when nothing found.
        // If storage is empty, let loadOrders() handle it after the API responds.
      } catch {}
    };
    preloadFromStorage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneDigits]);

  const formatOrder = useCallback((o: any) => {
    let normStatus = 'placed';
    let step = 0;
    const st = String(o.status || '').toLowerCase();
    if (st === 'delivered' || st === 'completed') { normStatus = 'delivered'; step = 4; }
    else if (st === 'out_for_delivery' || st === 'out-for-delivery' || st === 'picked_up' || st === 'on_way') { normStatus = 'out_for_delivery'; step = 3; }
    else if (st === 'ready_for_pickup' || st === 'ready_for_delivery' || st === 'ready' || st === 'packed') { normStatus = 'ready'; step = 2; }
    else if (st === 'preparing' || st === 'accepted' || st === 'confirmed' || st === 'packing' || st === 'processing') { normStatus = 'preparing'; step = 1; }
    else if (st === 'cancelled' || st === 'rejected') { normStatus = 'cancelled'; step = -1; }
    else { normStatus = 'placed'; step = 0; }

    const rawItems = Array.isArray(o.items)
      ? o.items
      : (() => {
          try {
            return JSON.parse(o.items || '[]');
          } catch {
            return [];
          }
        })();

    const dateStr = o.created_at
      ? new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : o.date || '8 Sept 2026';
    const timeStr = o.created_at
      ? new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : o.time || '01:53 PM';

    const displayId = formatDisplayOrderId(o);

    return {
      ...o,
      id: displayId,
      rawId: o.rawId || o.id,
      displayId: displayId,
      orderNumber: displayId,
      placedDateText: `Placed on ${dateStr}, ${timeStr} • ${(o.payment_method || 'UPI').toUpperCase()}`,
      date: `${dateStr}, ${timeStr}`,
      status: normStatus,
      eta: String(o.estimated_time || o.eta || '15 min').replace(/\s*delivery\s*$/i, '').replace(/^Arriving\s+in\s+/i, '').trim() || '15 min',
      trackerStep: step,
      items: rawItems.map((it: any) => ({
        id: it.id || it.product_id,
        name: it.name || it.product_name || 'Express Grocery Items',
        qty: Number(it.qty || it.quantity) || 1,
        price: Number(it.price || it.unit_price) || 270,
        image: it.image || it.image_url || it.raw_image || 'apples-real.jpg',
      })),
      totalItems: rawItems.length > 0
        ? rawItems.reduce((acc: number, it: any) => acc + (Number(it.qty || it.quantity) || 1), 0)
        : (Number(o.totalItems) || Number(o.total_items) || 0),
      total: Number(o.total_amount || o.total) || 270,
      address: o.delivery_address || o.address || 'Kalyanagar, Kalyanagar, Bengaluru 560043',
      paymentMethod: (o.payment_method || 'UPI').toUpperCase(),
      subtotal: Number(o.subtotal || o.total_amount || o.total) || 270,
      mrp_total: Number(o.mrp_total) || Number(o.total_amount || o.total) || 270,
      discount: Number(o.discount) || 0,
      coupon_discount: Number(o.coupon_discount) || 0,
      delivery_fee: Number(o.delivery_fee) || 0,
    };
  }, []);

  const loadOrders = useCallback(async (isMounted?: { current: boolean }) => {
    // Don't run if phone not yet available — avoids overwriting cached orders with empty list
    if (!phoneDigits) {
      setIsLoading(false);
      return;
    }

    try {
      const keysToRead = phoneDigits ? [`grabit_orders_${phoneDigits}`] : ['grabit_orders_guest'];

      const readPromises = keysToRead.map((key) => getItem<any[]>(key).catch(() => []));
      const apiPromise = get<any[]>(`/orders/user/${phoneDigits}`).catch(() => null);

      const [apiRes, ...localResults] = await Promise.all([
        apiPromise,
        ...readPromises,
      ]);

      if (isMounted && !isMounted.current) return;

      const uniqueMap = new Map<string, any>();

      const findMatchingKey = (fmt: any) => {
        const pKey = String(fmt.rawId || fmt.id);
        if (uniqueMap.has(pKey)) return pKey;
        const dId = String(fmt.displayId || fmt.display_id || fmt.orderNumber || fmt.order_number || fmt.id || '').toUpperCase();
        if (dId && dId.startsWith('GB-')) {
          for (const [k, v] of uniqueMap.entries()) {
            const vDisp = String(v.displayId || v.display_id || v.orderNumber || v.order_number || v.id || '').toUpperCase();
            if (vDisp && (vDisp === dId || v.rawId === fmt.rawId || v.id === fmt.rawId || v.rawId === fmt.id)) return k;
          }
        }
        for (const [k, v] of uniqueMap.entries()) {
          if ((v.rawId && fmt.rawId && v.rawId === fmt.rawId) || (v.id && fmt.id && v.id === fmt.id)) return k;
        }
        return pKey;
      };

      // 1. Populate from local storage first (phone isolated)
      localResults.forEach((orderArray) => {
        if (Array.isArray(orderArray)) {
          orderArray.forEach((o) => {
            if (o && (o.id || o.rawId)) {
              const oPhone = String(o.customer_phone || o.phone || '').replace(/\D/g, '');
              if (oPhone && phoneDigits && oPhone.length >= 10 && phoneDigits.length >= 10 && oPhone.slice(-10) !== phoneDigits.slice(-10)) {
                return; // Belongs to a different user account! Do not leak!
              }
              const formatted = formatOrder(o);
              const key = findMatchingKey(formatted);
              const existing = uniqueMap.get(key);
              if (existing && existing.items && existing.items.length > 0 && (!formatted.items || formatted.items.length === 0)) {
                formatted.items = existing.items;
                formatted.totalItems = existing.totalItems;
              }
              uniqueMap.set(key, formatted);
            }
          });
        }
      });

      // 2. Merge server API orders (overrides local with server-side truth, strictly phone-filtered)
      if (apiRes !== null && Array.isArray(apiRes) && apiRes.length > 0) {
        apiRes.forEach((o) => {
          if (o && (o.id || o.rawId)) {
            const oPhone = String(o.customer_phone || o.phone || '').replace(/\D/g, '');
            if (oPhone && phoneDigits && oPhone.length >= 10 && phoneDigits.length >= 10 && oPhone.slice(-10) !== phoneDigits.slice(-10)) {
              return; // Belongs to a different user account! Do not leak!
            }
            const formatted = formatOrder(o);
            const key = findMatchingKey(formatted);
            const existing = uniqueMap.get(key);
            if (existing && existing.items && existing.items.length > 0 && (!formatted.items || formatted.items.length === 0)) {
              formatted.items = existing.items;
              formatted.totalItems = existing.totalItems;
            }
            uniqueMap.set(key, formatted);
          }
        });
      }

      const rawList = Array.from(uniqueMap.values());
      const deduplicatedList: any[] = [];
      rawList.forEach((o) => {
        const oTime = o.created_at ? new Date(o.created_at).getTime() : 0;
        const dupIndex = deduplicatedList.findIndex((existing) => {
          if (existing.displayId && o.displayId && existing.displayId === o.displayId) return true;
          if (existing.rawId && o.rawId && existing.rawId === o.rawId) return true;
          const exTime = existing.created_at ? new Date(existing.created_at).getTime() : 0;
          const sameTime = Math.abs(oTime - exTime) < 15000;
          const sameTotal = Math.abs(Number(existing.total || 0) - Number(o.total || 0)) < 1;
          return sameTime && sameTotal;
        });
        if (dupIndex === -1) {
          deduplicatedList.push(o);
        } else {
          if (o.items && o.items.length > 0 && (!deduplicatedList[dupIndex].items || deduplicatedList[dupIndex].items.length === 0)) {
            deduplicatedList[dupIndex].items = o.items;
          }
        }
      });

      deduplicatedList.sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });

      // Only clear the list if the server explicitly returned [] (confirmed no orders)
      // If apiRes is null (network error / timeout), keep showing local cached orders
      const apiConfirmedEmpty = apiRes !== null && Array.isArray(apiRes) && apiRes.length === 0;
      if (deduplicatedList.length > 0 || apiConfirmedEmpty) {
        setOrdersList(deduplicatedList);
      }

      if (deduplicatedList.length > 0) {
        await setItem(`grabit_orders_${phoneDigits}`, deduplicatedList).catch(() => {});
      }
    } catch {
      // Network error — silently ignore, keep showing whatever is in state
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [phoneDigits, formatOrder]);

  // Reload every time this screen comes into focus (e.g. after checkout redirect)
  useFocusEffect(
    useCallback(() => {
      const mountGuard = { current: true };
      loadOrders(mountGuard);
      // Poll every 15s (was 3s) — reduces API load while still keeping status fresh
      const interval = setInterval(() => loadOrders(mountGuard), 15000);
      return () => {
        mountGuard.current = false;
        clearInterval(interval);
      };
    }, [loadOrders])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    loadOrders();
  };

  const handleReorder = (order: any) => {
    const itemList = Array.isArray(order.items) ? order.items : [];
    itemList.forEach((item: any) => {
      const matched = products.find(
        (p) =>
          String(p.id) === String(item.id) ||
          p.name.toLowerCase().trim() === item.name.toLowerCase().trim()
      );
      if (matched) {
        addToCart(matched, item.qty);
      } else {
        addToCart(
          {
            id: item.id || `p-${Date.now()}`,
            name: item.name,
            price: item.price,
            originalPrice: Math.round(item.price * 1.25),
            discountPercent: 20,
            image: item.image,
            category: 'produce',
            inStock: true,
          },
          item.qty
        );
      }
    });
    showToast(`Added items from Order #${order.displayId || order.id} to cart! 🛒`, 'success');
    if (selectedOrderModal) setSelectedOrderModal(null);
    router.push('/customer/cart' as any);
  };

  const handleConfirmCancelOrder = async () => {
    if (!cancellingOrder) return;
    setIsCancelling(true);
    const targetId = cancellingOrder.rawId || cancellingOrder.id;
    const finalReason = cancelReason || 'Cancelled by customer';

    try {
      await patch(`/orders/${targetId}/status`, {
        status: 'cancelled',
        cancellation_reason: finalReason,
      }).catch(() => {});

      const updateList = (list: any[]) =>
        (list || []).map((o) => {
          if (o.id === cancellingOrder.id || o.rawId === targetId || o.id === targetId) {
            return {
              ...o,
              status: 'cancelled',
              cancellation_reason: finalReason,
              cancelled_at: new Date().toISOString(),
            };
          }
          return o;
        });

      setOrdersList((prev) => updateList(prev));

      if (phoneDigits) {
        const storageKey = `grabit_orders_${phoneDigits}`;
        const localUserOrders = await getItem<any[]>(storageKey).catch(() => []);
        await setItem(storageKey, updateList(localUserOrders || [])).catch(() => {});
      }

      showToast(`Order #${cancellingOrder.displayId || cancellingOrder.id} has been cancelled.`, 'info');
      setCancellingOrder(null);
      if (selectedOrderModal) setSelectedOrderModal(null);
    } catch {
      showToast('Failed to cancel order. Please try again.', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleClearAllOrders = async () => {
    try {
      await post('/orders/purge-all', {}).catch(() => {});
      await patch('/orders/purge-all', {}).catch(() => {});
      await purgeLocalOrderStorage(user?.phone || phoneDigits).catch(() => {});
      await clearAllNotifications(user?.phone || phoneDigits).catch(() => {});
      await clearAllLegacyOrderStorage().catch(() => {});
      if (phoneDigits) {
        await removeItem(`grabit_orders_${phoneDigits}`).catch(() => {});
        await removeItem(`grabit_user_notifications_${phoneDigits}`).catch(() => {});
      }
      await removeItem('grabit_orders_guest').catch(() => {});
      await removeItem('grabit_recent_orders').catch(() => {});
      await removeItem('grabit_seller_orders').catch(() => {});
      await removeItem('grabit_orders').catch(() => {});
      await removeItem('grabit_user_notifications_guest').catch(() => {});
      setOrdersList([]);
      showToast('All order histories deleted successfully!', 'success');
    } catch {
      setOrdersList([]);
      showToast('Order histories cleared.', 'info');
    }
  };

  const dynamicStats = useMemo(() => {
    const total = ordersList.length;
    const delivered = ordersList.filter((o) => o.status === 'delivered').length;
    const ongoing = ordersList.filter((o) => isOngoingStatus(o.status)).length;
    const cancelled = ordersList.filter((o) => o.status === 'cancelled').length;
    const totalSpent = ordersList.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    return { total, delivered, ongoing, cancelled, totalSpent };
  }, [ordersList]);

  const filteredOrders = useMemo(() => {
    return ordersList.filter((o) => {
      let matchTab = true;
      if (activeTab === 'Ongoing') matchTab = isOngoingStatus(o.status);
      else if (activeTab === 'Delivered') matchTab = o.status === 'delivered';
      else if (activeTab === 'Cancelled') matchTab = o.status === 'cancelled';

      if (!matchTab) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchId = (o.displayId || o.id || '').toLowerCase().includes(q);
      const matchItem = (o.items || []).some((it: any) => (it.name || it.product_name || '').toLowerCase().includes(q));
      return matchId || matchItem;
    });
  }, [ordersList, activeTab, searchQuery]);

  // Selected Order Modal Helper Calculations
  const modalCurrentStep = selectedOrderModal ? getCycleStepIndex(selectedOrderModal.status) : 0;
  const modalActiveStage = selectedOrderModal ? (ORDER_CYCLE_STAGES[modalCurrentStep] || ORDER_CYCLE_STAGES[0]) : ORDER_CYCLE_STAGES[0];
  const isModalCancelled = selectedOrderModal?.status === 'cancelled';
  const isModalOngoing = selectedOrderModal ? isOngoingStatus(selectedOrderModal.status) : false;

  return (
    <View style={styles.container}>
      {/* ── 1. EXACT HOME PAGE TOP HEADER ── */}
      <CustomerTopHeader />

      {/* ── 2. BACK BUTTON & SEARCH ROW ── */}
      <View style={styles.searchHeaderRow}>
        <Pressable style={styles.backBtnCircle} onPress={() => router.back()}>
          <ArrowLeft size={18} color="#1E293B" />
        </Pressable>

        <View style={styles.globalSearchBar}>
          <Search size={16} color="#94A3B8" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search in your orders..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <X size={16} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#0071E3']} />}
      >
        {/* ── 3. PAGE TITLE & CLEAR HISTORY ── */}
        <View style={styles.titleSection}>
          <Text style={styles.titleText}>My Orders</Text>
          {ordersList.length > 0 && (
            <Pressable style={styles.clearHistoryBtn} onPress={handleClearAllOrders}>
              <Trash2 size={13} color="#EF4444" style={{ marginRight: 4 }} />
              <Text style={styles.clearHistoryText}>Clear History</Text>
            </Pressable>
          )}
        </View>

        {/* ── 4. STATUS FILTER TABS ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabsRow}
        >
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <Pressable
                key={tab}
                style={[styles.filterTabPill, isActive && styles.filterTabPillActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                  {tab}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── 5. ORDERS LIST ── */}
        {isLoading && ordersList.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0071E3" />
            <Text style={styles.loadingText}>Fetching your orders...</Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 44, marginBottom: 12 }}>🛍️</Text>
            <Text style={styles.emptyTitle}>No orders found</Text>
            <Text style={styles.emptySub}>
              {searchQuery ? `No orders match "${searchQuery}".` : `You have no orders in "${activeTab}".`}
            </Text>
            <Pressable style={styles.exploreBtn} onPress={() => router.push('/customer' as any)}>
              <Text style={styles.exploreBtnText}>Explore Products & Shop Now</Text>
            </Pressable>
          </View>
        ) : (
          filteredOrders.map((order) => {
            const currentStep = getCycleStepIndex(order.status);
            const isCancelled = order.status === 'cancelled';
            const isOngoing = isOngoingStatus(order.status);
            const activeStage = ORDER_CYCLE_STAGES[currentStep] || ORDER_CYCLE_STAGES[0];

            return (
              <View key={order.rawId || order.id} style={styles.orderCard}>
                {/* Order Top Row */}
                <View style={styles.orderCardTopRow}>
                  <Pressable
                    style={styles.orderIdGroup}
                    onPress={() => setSelectedOrderModal(order)}
                  >
                    <Text style={styles.orderIdText}>Order #{order.displayId || order.id}</Text>
                    <ChevronRight size={16} color="#64748B" style={{ marginLeft: 2 }} />
                  </Pressable>

                  {/* Status Badge */}
                  <View
                    style={[
                      styles.statusBadgePill,
                      (order.status === 'out_for_delivery' || order.status === 'out-for-delivery') && styles.badgeOutForDelivery,
                      (order.status === 'delivered' || order.status === 'completed') && styles.badgeDelivered,
                      (order.status === 'ready' || order.status === 'ready_for_pickup') && styles.badgeReady,
                      (order.status === 'preparing' || order.status === 'confirmed') && styles.badgePreparing,
                      order.status === 'placed' && styles.badgePlaced,
                      order.status === 'cancelled' && styles.badgeCancelled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        (order.status === 'out_for_delivery' || order.status === 'out-for-delivery') && styles.badgeTextOutForDelivery,
                        (order.status === 'delivered' || order.status === 'completed') && styles.badgeTextDelivered,
                        (order.status === 'ready' || order.status === 'ready_for_pickup') && styles.badgeTextReady,
                        (order.status === 'preparing' || order.status === 'confirmed') && styles.badgeTextPreparing,
                        order.status === 'placed' && styles.badgeTextPlaced,
                        order.status === 'cancelled' && styles.badgeTextCancelled,
                      ]}
                    >
                      {(order.status === 'delivered' || order.status === 'completed') && '✓ Delivered'}
                      {(order.status === 'out_for_delivery' || order.status === 'out-for-delivery') && '🛵 Out for Delivery'}
                      {(order.status === 'ready' || order.status === 'ready_for_pickup') && '📦 Ready for Pickup'}
                      {(order.status === 'preparing' || order.status === 'confirmed') && '⏱️ Preparing Order'}
                      {order.status === 'placed' && '⏱ Order Placed'}
                      {order.status === 'cancelled' && '✕ Cancelled'}
                    </Text>
                  </View>
                </View>

                {/* Date & Time */}
                <Text style={styles.orderDateText}>{order.date}</Text>

                {/* ── 5-STEP LIVE TRACKER CYCLE BOX (If Ongoing) ── */}
                {isOngoing && !isCancelled && (
                  <View style={styles.trackerBox}>
                    <View style={styles.trackerHeader}>
                      <View style={styles.trackerLiveDotGroup}>
                        <View style={styles.trackerDot} />
                        <Text style={styles.trackerLiveText} numberOfLines={1}>LIVE TRACKER STATUS</Text>
                      </View>
                      <View style={styles.trackerEtaPill}>
                        <Text style={styles.trackerEtaText} numberOfLines={1}>⚡ ETA: Arriving in {order.eta || '15 min'}</Text>
                      </View>
                    </View>

                    <View style={styles.timelineRow}>
                      <View style={styles.timelineTrackBack} />
                      <View
                        style={[
                          styles.timelineTrackFront,
                          { width: `${(currentStep / 4) * 85 + 5}%` },
                        ]}
                      />

                      <View style={styles.nodesContainer}>
                        {ORDER_CYCLE_STAGES.map((stage, idx) => {
                          const isDone = idx < currentStep;
                          const isCurrent = idx === currentStep;

                          return (
                            <View key={stage.key} style={styles.nodeWrapper}>
                              <View
                                style={[
                                  styles.nodeCircle,
                                  isDone && styles.nodeCircleDone,
                                  isCurrent && styles.nodeCircleCurrent,
                                ]}
                              >
                                {isDone ? (
                                  <Check size={13} color="#FFFFFF" strokeWidth={3} />
                                ) : (
                                  <Text style={[styles.nodeIconText, isCurrent && { color: '#FFFFFF' }]}>
                                    {stage.icon}
                                  </Text>
                                )}
                              </View>
                              <Text
                                style={[
                                  styles.nodeLabel,
                                  isDone && styles.nodeLabelDone,
                                  isCurrent && styles.nodeLabelCurrent,
                                ]}
                                numberOfLines={1}
                              >
                                {stage.label}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>

                    <View style={styles.currentStageBox}>
                      <View style={styles.stageIconSquare}>
                        <Text style={{ fontSize: 18 }}>{activeStage.icon}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.currentStageTitle} numberOfLines={1}>
                          Current Status: {activeStage.fullLabel}
                        </Text>
                        <Text style={styles.currentStageDesc} numberOfLines={1}>
                          {activeStage.desc}
                        </Text>
                      </View>
                      {(order.status === 'out_for_delivery' || order.status === 'ready' || order.delivery_agent_id) && (
                        <View style={styles.riderAssignedBadge}>
                          <Text style={styles.riderAssignedText}>🛵 Rider Assigned</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* ── PRODUCT THUMBNAILS ROW ── */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.thumbnailsScroll}
                >
                  {((order.items && order.items.length > 0)
                    ? order.items
                    : [{ image: 'fresh-fruits-veggies-hero-transparent.png' }]
                  ).map((it: any, idx: number) => {
                    const imgSource = resolveProductImage(it.image || it.image_url);
                    return (
                      <View key={idx} style={styles.thumbnailBox}>
                        <Image source={imgSource} style={styles.thumbnailImg} resizeMode="contain" />
                      </View>
                    );
                  })}
                </ScrollView>

                {/* ── TOTAL ITEMS & AMOUNT SUMMARY ── */}
                <View style={styles.orderSummaryRow}>
                  <Text style={styles.orderSummaryCount}>
                    <Text style={{ fontWeight: '800', color: '#0F172A' }}>{order.totalItems} items</Text> • Total{' '}
                    <Text style={styles.orderSummaryTotal}>₹{order.total}</Text>
                  </Text>
                </View>

                {/* ── ACTION BUTTONS ── */}
                <View style={styles.orderActionsRow}>
                  {canCancelOrder(order.status) && !isCancelled ? (
                    <Pressable
                      style={styles.cancelBtn}
                      onPress={() => {
                        setCancelReason('Placed order by mistake');
                        setCancellingOrder(order);
                      }}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    style={styles.viewDetailsBtn}
                    onPress={() => setSelectedOrderModal(order)}
                  >
                    <Text style={styles.viewDetailsBtnText}>View Details</Text>
                  </Pressable>

                  {isOngoing && !isCancelled ? (
                    <Pressable
                      style={styles.reorderBtn}
                      onPress={() => router.push(`/customer/order/${order.rawId || order.id}` as any)}
                    >
                      <Text style={styles.reorderBtnText}>Track Order</Text>
                    </Pressable>
                  ) : !isCancelled ? (
                    <Pressable style={styles.reorderBtn} onPress={() => handleReorder(order)}>
                      <Text style={styles.reorderBtnText}>Reorder Items</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        )}

        {/* ── 6. BOTTOM ORDER SUMMARY CARD ── */}
        <View style={styles.bottomStatsCard}>
          <Text style={styles.bottomStatsTitle}>Order Summary</Text>

          <View style={styles.bottomStatLine}>
            <Text style={styles.bottomStatLabel}>Total Orders</Text>
            <Text style={styles.bottomStatVal}>{dynamicStats.total}</Text>
          </View>

          <View style={styles.bottomStatLine}>
            <Text style={styles.bottomStatLabel}>Delivered</Text>
            <Text style={[styles.bottomStatVal, { color: '#10B981' }]}>{dynamicStats.delivered}</Text>
          </View>

          <View style={styles.bottomStatLine}>
            <Text style={styles.bottomStatLabel}>Ongoing</Text>
            <Text style={[styles.bottomStatVal, { color: '#0071E3' }]}>{dynamicStats.ongoing}</Text>
          </View>

          <View style={styles.bottomStatLine}>
            <Text style={styles.bottomStatLabel}>Cancelled</Text>
            <Text style={[styles.bottomStatVal, { color: '#EF4444' }]}>{dynamicStats.cancelled}</Text>
          </View>

          <View style={[styles.bottomStatLine, styles.bottomStatLineTotal]}>
            <Text style={styles.bottomStatTotalLabel}>Total Spent</Text>
            <Text style={styles.bottomStatTotalVal}>₹{dynamicStats.totalSpent}</Text>
          </View>
        </View>
      </ScrollView>

      {/* ── 7. VIEW DETAILS MODAL (PIXEL-PERFECT TO USER SCREENSHOT) ── */}
      <Modal visible={!!selectedOrderModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.viewDetailsModalCard}>
            {/* Header: Title & Subtitle + Close Button on Top Right */}
            <View style={styles.modalTopHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitleText}>
                  Order #{selectedOrderModal?.displayId || selectedOrderModal?.id}
                </Text>
                <Text style={styles.modalSubText}>
                  {selectedOrderModal?.placedDateText || selectedOrderModal?.date}
                </Text>
              </View>

              <Pressable
                style={styles.modalCloseCircle}
                onPress={() => setSelectedOrderModal(null)}
              >
                <X size={16} color="#0F172A" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: Dimensions.get('window').height * 0.72 }}>
              {/* ── 1. LIVE TRACKER STATUS BOX ── */}
              {isModalOngoing && !isModalCancelled && (
                <View style={styles.trackerBox}>
                  <View style={styles.trackerHeader}>
                    <View style={styles.trackerLiveDotGroup}>
                      <View style={styles.trackerDot} />
                      <Text style={styles.trackerLiveText} numberOfLines={1}>LIVE TRACKER STATUS</Text>
                    </View>
                    <View style={styles.trackerEtaPill}>
                      <Text style={styles.trackerEtaText} numberOfLines={1}>
                        ⚡ ETA: {selectedOrderModal?.eta ? (selectedOrderModal.eta.toLowerCase().includes('arriving') ? selectedOrderModal.eta : `Arriving in ${selectedOrderModal.eta}`) : 'Arriving in 15 min'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.timelineRow}>
                    <View style={styles.timelineTrackBack} />
                    <View
                      style={[
                        styles.timelineTrackFront,
                        { width: `${(modalCurrentStep / 4) * 85 + 5}%` },
                      ]}
                    />

                    <View style={styles.nodesContainer}>
                      {ORDER_CYCLE_STAGES.map((stage, idx) => {
                        const isDone = idx < modalCurrentStep;
                        const isCurrent = idx === modalCurrentStep;

                        return (
                          <View key={stage.key} style={styles.nodeWrapper}>
                            <View
                              style={[
                                styles.nodeCircle,
                                isDone && styles.nodeCircleDone,
                                isCurrent && styles.nodeCircleCurrent,
                              ]}
                            >
                              {isDone ? (
                                <Check size={13} color="#FFFFFF" strokeWidth={3} />
                              ) : (
                                <Text style={[styles.nodeIconText, isCurrent && { color: '#FFFFFF' }]}>
                                  {stage.icon}
                                </Text>
                              )}
                            </View>
                            <Text
                              style={[
                                styles.nodeLabel,
                                isDone && styles.nodeLabelDone,
                                isCurrent && styles.nodeLabelCurrent,
                              ]}
                              numberOfLines={1}
                            >
                              {stage.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.currentStageBox}>
                    <View style={styles.stageIconSquare}>
                      <Text style={{ fontSize: 18 }}>{modalActiveStage.icon}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.currentStageTitle} numberOfLines={1}>
                        Current Status: {modalActiveStage.fullLabel}
                      </Text>
                      <Text style={styles.currentStageDesc} numberOfLines={1}>
                        {modalActiveStage.desc}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* ── 2. DELIVERY ADDRESS CARD ── */}
              <View style={styles.modalAddressCard}>
                <Text style={styles.modalAddressHeader}>DELIVERY ADDRESS</Text>
                <Text style={styles.modalAddressBody}>
                  {selectedOrderModal?.address || 'Indiranagar, Bangalore'}
                </Text>
              </View>

              {/* ── 3. ORDERED ITEMS LIST ── */}
              {(() => {
                const modalItemsList = (selectedOrderModal?.items && selectedOrderModal.items.length > 0)
                  ? selectedOrderModal.items
                  : [
                      {
                        id: 'express-item-1',
                        name: 'Express Grocery Items',
                        qty: 1,
                        price: Number(selectedOrderModal?.total) || 129,
                        image: 'fresh-fruits-veggies-hero-transparent.png',
                      }
                    ];
                return (
                  <>
                    <Text style={styles.modalItemsSectionTitle}>
                      ORDERED ITEMS ({modalItemsList.length})
                    </Text>

                    <View style={styles.modalItemsList}>
                      {modalItemsList.map((item: any, idx: number) => {
                        const imgSource = resolveProductImage(item.image);
                        const itemQty = Number(item.qty) || 1;
                        const itemPrice = Number(item.price) || Number(selectedOrderModal?.total) || 129;
                        const itemTotal = itemQty * itemPrice;

                        return (
                          <View key={idx} style={styles.modalItemCard}>
                            <View style={styles.modalItemLeft}>
                              <View style={styles.modalItemImgBox}>
                                <Image source={imgSource} style={styles.modalItemImg} resizeMode="contain" />
                              </View>
                              <View style={styles.modalItemTextGroup}>
                                <Text style={styles.modalItemName} numberOfLines={2}>{item.name}</Text>
                                <Text style={styles.modalItemQty}>Qty: {itemQty} × ₹{itemPrice}</Text>
                              </View>
                            </View>
                            <Text style={styles.modalItemTotal}>₹{itemTotal}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </>
                );
              })()}

              {/* ── 4. PRICE BREAKDOWN ── */}
              <View style={styles.modalPriceBreakdown}>
                <View style={styles.modalPriceLine}>
                  <Text style={styles.modalPriceLabel}>Item Total</Text>
                  <Text style={styles.modalPriceVal}>
                    ₹{Number(selectedOrderModal?.mrp_total) > Number(selectedOrderModal?.subtotal || selectedOrderModal?.total)
                      ? selectedOrderModal.mrp_total
                      : ((Number(selectedOrderModal?.subtotal) || Number(selectedOrderModal?.total) || 0) + (Number(selectedOrderModal?.discount) || 0))}
                  </Text>
                </View>

                {Number(selectedOrderModal?.discount) > 0 && (
                  <View style={styles.modalPriceLine}>
                    <Text style={styles.modalPriceLabel}>Product Discount</Text>
                    <Text style={[styles.modalPriceVal, { color: '#16A34A' }]}>-₹{selectedOrderModal.discount}</Text>
                  </View>
                )}

                {Number(selectedOrderModal?.coupon_discount) > 0 && (
                  <View style={styles.modalPriceLine}>
                    <Text style={styles.modalPriceLabel}>Coupon Discount</Text>
                    <Text style={[styles.modalPriceVal, { color: '#16A34A' }]}>-₹{selectedOrderModal.coupon_discount}</Text>
                  </View>
                )}

                <View style={styles.modalPriceLine}>
                  <Text style={styles.modalPriceLabel}>Delivery Fee</Text>
                  <Text style={[styles.modalPriceVal, { color: (Number(selectedOrderModal?.delivery_fee) || 0) === 0 ? '#10B981' : '#0F172A' }]}>
                    {(Number(selectedOrderModal?.delivery_fee) || 0) === 0 ? 'FREE' : `₹${selectedOrderModal.delivery_fee}`}
                  </Text>
                </View>

                <View style={styles.modalTotalLine}>
                  <Text style={styles.modalTotalLabel}>Total Paid</Text>
                  <Text style={styles.modalTotalVal}>₹{selectedOrderModal?.total || 0}</Text>
                </View>
              </View>

              {/* ── 5. MODAL BOTTOM BUTTONS (CANCEL ORDER + TRACK LIVE ORDER) ── */}
              <View style={styles.modalButtonsRow}>
                {canCancelOrder(selectedOrderModal?.status) && !isModalCancelled && (
                  <Pressable
                    style={styles.modalCancelBtn}
                    onPress={() => {
                      const o = selectedOrderModal;
                      setSelectedOrderModal(null);
                      setCancelReason('Placed order by mistake');
                      setCancellingOrder(o);
                    }}
                  >
                    <Text style={styles.modalCancelBtnText}>✕ Cancel Order</Text>
                  </Pressable>
                )}

                <Pressable
                  style={styles.modalTrackBtn}
                  onPress={() => {
                    const targetId = selectedOrderModal?.rawId || selectedOrderModal?.id;
                    setSelectedOrderModal(null);
                    if (isModalOngoing) {
                      router.push(`/customer/order/${targetId}` as any);
                    } else {
                      handleReorder(selectedOrderModal);
                    }
                  }}
                >
                  <Text style={styles.modalTrackBtnText}>
                    {isModalOngoing ? 'Track Live Order' : 'Reorder All Items'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── 8. CANCEL ORDER CONFIRMATION MODAL ── */}
      <Modal visible={!!cancellingOrder} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.cancelModalCard}>
            <View style={styles.cancelModalHeader}>
              <View style={styles.cancelIconCircle}>
                <AlertCircle size={24} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cancelModalTitle}>
                  Cancel Order #{cancellingOrder?.displayId || cancellingOrder?.id}?
                </Text>
                <Text style={styles.cancelModalSub}>
                  Are you sure you want to cancel this order? Once cancelled, this action cannot be undone.
                </Text>
              </View>
              <Pressable
                onPress={() => !isCancelling && setCancellingOrder(null)}
                style={styles.modalCloseBtn}
              >
                <X size={16} color="#64748B" />
              </Pressable>
            </View>

            <View style={styles.refundBanner}>
              <Check size={18} color="#16A34A" style={{ marginRight: 8, flexShrink: 0 }} />
              <Text style={styles.refundBannerText}>
                A 100% full refund of{' '}
                <Text style={{ fontWeight: '800' }}>₹{cancellingOrder?.total || 0}</Text> will be credited
                to your original payment source within 15-30 minutes.
              </Text>
            </View>

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

            <View style={styles.cancelModalActionsRow}>
              <Pressable
                style={styles.keepOrderBtn}
                onPress={() => !isCancelling && setCancellingOrder(null)}
                disabled={isCancelling}
              >
                <Text style={styles.keepOrderBtnText}>Keep Order</Text>
              </Pressable>

              <Pressable
                style={styles.confirmCancelBtn}
                onPress={handleConfirmCancelOrder}
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

      <NotificationModal
        visible={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
      />
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
    backgroundColor: '#0071E3',
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
    fontSize: 14,
    letterSpacing: -0.3,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    maxWidth: 160,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 4,
    marginRight: 2,
    flexShrink: 1,
  },
  locationChevron: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '800',
  },
  headerRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#0071E3',
    borderRadius: 9,
    minWidth: 17,
    height: 17,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
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
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    paddingVertical: 0,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  titleSection: {
    marginTop: 4,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  clearHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  clearHistoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterTabPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    ...SHADOWS.sm,
  },
  filterTabPillActive: {
    backgroundColor: '#0071E3',
    borderColor: '#0071E3',
  },
  filterTabText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
    ...SHADOWS.sm,
  },
  orderCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  orderIdGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderIdText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  orderDateText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 12,
  },
  statusBadgePill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  badgeOutForDelivery: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  badgeTextOutForDelivery: { color: '#0071E3' },
  badgeDelivered: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  badgeTextDelivered: { color: '#10B981' },
  badgeReady: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  badgeTextReady: { color: '#15803D' },
  badgePreparing: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  badgeTextPreparing: { color: '#D97706' },
  badgePlaced: { backgroundColor: '#EEF2F6', borderColor: '#CBD5E1' },
  badgeTextPlaced: { color: '#475569' },
  badgeCancelled: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  badgeTextCancelled: { color: '#EF4444' },
  trackerBox: {
    backgroundColor: '#F0F7FF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    padding: 14,
    marginBottom: 14,
  },
  trackerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  trackerLiveDotGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
  },
  trackerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#0071E3',
    flexShrink: 0,
  },
  trackerLiveText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0071E3',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  trackerEtaPill: {
    backgroundColor: '#DBEAFE',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#93C5FD',
    flexShrink: 0,
  },
  trackerEtaText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#1E40AF',
  },
  timelineRow: {
    position: 'relative',
    marginVertical: 10,
  },
  timelineTrackBack: {
    position: 'absolute',
    top: 14,
    left: 20,
    right: 20,
    height: 3,
    backgroundColor: '#CBD5E1',
    zIndex: 0,
  },
  timelineTrackFront: {
    position: 'absolute',
    top: 14,
    left: 20,
    height: 3,
    backgroundColor: '#0071E3',
    zIndex: 1,
  },
  nodesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  nodeWrapper: {
    alignItems: 'center',
    width: '18%',
  },
  nodeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeCircleDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  nodeCircleCurrent: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0071E3',
    borderColor: '#0071E3',
    shadowColor: '#0071E3',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  nodeIconText: {
    fontSize: 11,
  },
  nodeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  nodeLabelDone: {
    color: '#059669',
  },
  nodeLabelCurrent: {
    color: '#0071E3',
    fontWeight: '900',
  },
  currentStageBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  stageIconSquare: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentStageTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  currentStageDesc: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
    marginTop: 1,
  },
  thumbnailsScroll: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  thumbnailBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  thumbnailImg: {
    width: 38,
    height: 38,
  },
  orderSummaryRow: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    marginBottom: 12,
  },
  orderSummaryCount: {
    fontSize: 13.5,
    color: '#475569',
    fontWeight: '700',
  },
  orderSummaryTotal: {
    color: '#0071E3',
    fontWeight: '900',
    fontSize: 15,
  },
  orderActionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 12.5,
  },
  viewDetailsBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewDetailsBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 12.5,
  },
  reorderBtn: {
    flex: 1,
    backgroundColor: '#0071E3',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12.5,
  },
  trackOrderFullBtn: {
    backgroundColor: '#0071E3',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  trackOrderFullBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  bottomStatsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginTop: 6,
    ...SHADOWS.sm,
  },
  bottomStatsTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 12,
  },
  bottomStatLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  bottomStatLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  bottomStatVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  bottomStatLineTotal: {
    borderBottomWidth: 0,
    paddingTop: 12,
  },
  bottomStatTotalLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  bottomStatTotalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0071E3',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  exploreBtn: {
    backgroundColor: '#0071E3',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  /* ── VIEW DETAILS MODAL STYLES (MATCHING USER SCREENSHOT) ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  viewDetailsModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    ...SHADOWS.lg,
  },
  modalTopHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  modalSubText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  modalCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAddressCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 14,
  },
  modalAddressHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  modalAddressBody: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 18,
  },
  modalItemsSectionTitle: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  modalItemsList: {
    gap: 8,
    marginBottom: 14,
  },
  modalItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  modalItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  modalItemTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  modalItemImgBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  modalItemImg: {
    width: 36,
    height: 36,
  },
  modalItemName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    flexShrink: 1,
  },
  modalItemQty: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  modalItemTotal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    flexShrink: 0,
    textAlign: 'right',
    marginLeft: 6,
  },
  modalPriceBreakdown: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginBottom: 16,
    gap: 6,
  },
  modalPriceLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalPriceLabel: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '600',
  },
  modalPriceVal: {
    fontSize: 12.5,
    color: '#0F172A',
    fontWeight: '800',
  },
  modalTotalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 4,
  },
  modalTotalLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalTotalVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0071E3',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 13,
  },
  modalTrackBtn: {
    flex: 1.3,
    backgroundColor: '#0071E3',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  modalTrackBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },

  /* Cancellation Modal */
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
  riderAssignedBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginLeft: 6,
  },
  riderAssignedText: {
    color: '#1D4ED8',
    fontSize: 10,
    fontWeight: '800',
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
});
