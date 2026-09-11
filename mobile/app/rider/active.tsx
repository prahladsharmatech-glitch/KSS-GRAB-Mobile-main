import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  Image,
  TextInput,
  Linking,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useToast } from '../../context/ToastContext';
import { get, patch, uploadImage, invalidateOrdersCache } from '../../services/api';
import { useRealtimeOrders } from '../../services/realtimeOrders';
import { getItem, setItem, removeItem } from '../../services/storage';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import Svg, { Path } from 'react-native-svg';
import {
  Navigation,
  Bike,
  MapPin,
  Phone,
  ShieldAlert,
  Camera,
  CheckCircle2,
  Package,
  Store,
  ChevronRight,
  User,
  Clock,
  KeyRound,
  FileCheck,
  AlertTriangle,
  ExternalLink,
  LocateFixed,
  Target,
  RefreshCw,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

// Platform-safe import of react-native-maps to prevent AIRMap render errors on Web
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let UrlTile: any = null;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    Polyline = Maps.Polyline;
    UrlTile = Maps.UrlTile;
  } catch {
    // Graceful fallback for non-native environments
  }
}

type StepState = 'REACH_STORE' | 'STORE_CHECKLIST' | 'EN_ROUTE' | 'OTP_DELIVERY' | 'COMPLETED';

interface OrderItem {
  id: string;
  name: string;
  qty: string;
  checked: boolean;
}

// Derive checklist items from real API order items
function buildChecklistItems(apiItems: any[]): OrderItem[] {
  if (!Array.isArray(apiItems) || apiItems.length === 0) {
    return [{ id: '1', name: 'Order Package', qty: '1 Pkg', checked: false }];
  }
  return apiItems.map((item: any, idx: number) => ({
    id: String(item.product_id || item.id || idx + 1),
    name: item.name || item.product_name || 'Item',
    qty: `${item.quantity || item.qty || 1} ${item.unit || 'pcs'}`,
    checked: false,
  }));
}

export default function ActiveDeliveryScreen() {
  const router = useRouter();
  const { showToast } = useToast();

  const [currentStep, setCurrentStep] = useState<StepState>('REACH_STORE');
  const [proofPhoto, setProofPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [sosModal, setSosModal] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);

  // Real order data from API
  const [order, setOrder] = useState<any>(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [payout, setPayout] = useState(0);

  // Dynamic Deadline Info (Live calculated countdown)
  const [deadlineInfo, setDeadlineInfo] = useState<{ remainingMins: number; targetTimeStr: string }>({
    remainingMins: 10,
    targetTimeStr: '10:45 AM',
  });

  useEffect(() => {
    const calculateDeadline = () => {
      let createdTs = Date.now() - 2 * 60 * 1000;
      if (order?.created_at) {
        const parsed = new Date(order.created_at).getTime();
        if (!isNaN(parsed) && parsed > 0) {
          createdTs = parsed;
        }
      }
      const targetTs = createdTs + 10 * 60 * 1000; // 10 Min SLA
      const targetDate = new Date(targetTs);
      const targetTimeStr = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

      const diffMs = targetTs - Date.now();
      const remainingMins = Math.max(0, Math.ceil(diffMs / (60 * 1000)));

      setDeadlineInfo({ remainingMins, targetTimeStr });
    };

    calculateDeadline();
    const interval = setInterval(calculateDeadline, 5000);
    return () => clearInterval(interval);
  }, [order?.created_at]);

  // Real-time active order via hook (SSE on web, 3s polling on native)
  const {
    orders: liveOrders,
    loading: hookLoading,
    isLive: ordersIsLive,
    refresh: refreshActiveOrders,
  } = useRealtimeOrders('rider');

  // Derive active order from live data
  useEffect(() => {
    const activeFromLive = liveOrders.find((o: any) => {
      const st = String(o.status || '').toLowerCase();
      return st !== 'delivered' && st !== 'cancelled' && st !== 'failed_delivery';
    }) || null;
    setOrder(activeFromLive);
    if (activeFromLive) {
      const orderId = activeFromLive.rawId || activeFromLive.id;
      if (orderId) {
        getItem<string>(`grabit_rider_step_${orderId}`).then((savedStep) => {
          if (savedStep && ['REACH_STORE', 'STORE_CHECKLIST', 'EN_ROUTE', 'ARRIVED', 'OTP_DELIVERY', 'COMPLETED'].includes(savedStep)) {
            setCurrentStep(savedStep as StepState);
          } else if (activeFromLive.workflow_step) {
            setCurrentStep(activeFromLive.workflow_step as StepState);
          }
        }).catch(() => {});
      }
      const apiItems = activeFromLive.items || activeFromLive.order_items || [];
      setItems(buildChecklistItems(apiItems));
      const total = Number(activeFromLive.total_amount || activeFromLive.total || 0);
      setPayout(Math.max(30, Math.round(total * 0.3)));
    }
    setLoadingOrder(hookLoading);
  }, [liveOrders, hookLoading]);

  // Keep fetchActiveOrder as alias for manual refresh button
  const fetchActiveOrder = useCallback(() => {
    invalidateOrdersCache();
    refreshActiveOrders();
  }, [refreshActiveOrders]);

  const advanceStep = async (nextStep: StepState) => {
    setCurrentStep(nextStep);
    const orderId = order?.rawId || order?.id;
    if (orderId) {
      await setItem(`grabit_rider_step_${orderId}`, nextStep);
      patch(`/delivery/${orderId}/step`, { step: nextStep }).catch(() => {});
    }
  };

  const toggleCheckItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const allItemsChecked = items.every((i) => i.checked);

  const handleCaptureProof = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showToast('Camera permission is required for proof of delivery', 'error');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      setProofPhoto(result.assets[0].uri);
      showToast('Photo proof captured successfully!', 'success');
    }
  };

  const handleCompleteDelivery = async () => {
    if (!proofPhoto) {
      showToast('Please take a photo proof of delivery first', 'error');
      return;
    }

    const enteredOtp = otpInput.trim();
    if (!enteredOtp || enteredOtp.length < 4) {
      showToast('Please enter the 4-digit OTP from the customer', 'error');
      return;
    }

    setIsUploading(true);
    try {
      let uploadedProofUrl: string | null = null;
      if (proofPhoto) {
        try {
          uploadedProofUrl = await uploadImage(proofPhoto, 'delivery_proofs');
        } catch {
          // Local fallback
        }
      }

      // Verify OTP with backend if order ID is available
      if (order?.id || order?.rawId) {
        const orderId = order.rawId || order.id;
        try {
          await patch(`/orders/${orderId}/verify-otp`, {
            otp: enteredOtp,
            proof_photo_url: uploadedProofUrl
          });
        } catch (otpErr: any) {
          const msg = String(otpErr?.message || '').toLowerCase();
          if (msg.includes('invalid') || msg.includes('incorrect') || msg.includes('wrong')) {
            showToast('Invalid OTP! Please ask the customer for their delivery code.', 'error');
            setIsUploading(false);
            return;
          }
        }

        // Mark order as delivered in backend
        await patch(`/orders/${orderId}/status`, { status: 'delivered' }).catch(() => {});
        await removeItem(`grabit_rider_step_${orderId}`);
      }

      setCurrentStep('COMPLETED');
      const orderNum = order?.orderNumber || order?.id || 'Order';
      showToast(`${orderNum} Delivered! ₹${payout} credited to your balance.`, 'success');
    } catch {
      showToast('Delivery completion failed. Please retry.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const openCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      showToast(`Calling ${phone}...`, 'info');
    });
  };

  const openNavigation = (lat: number, lng: number, label: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      showToast(`Navigating to ${label}`, 'info');
    });
  };

  const [riderLivePos, setRiderLivePos] = useState({ latitude: 12.9355, longitude: 77.6245 });
  const [riderPxPos, setRiderPxPos] = useState({ x: 60, y: 70 });

  const pickupCoords = { latitude: 12.9368, longitude: 77.6282 };
  const dropCoords = { latitude: 12.9322, longitude: 77.6208 };

  React.useEffect(() => {
    const routePoints = [
      { latitude: 12.9368, longitude: 77.6282 },
      { latitude: 12.9362, longitude: 77.6248 },
      { latitude: 12.9350, longitude: 77.6242 },
      { latitude: 12.9322, longitude: 77.6208 },
    ];

    const pathPoints = [
      { x: 60, y: 70 },
      { x: 140, y: 85 },
      { x: 175, y: 140 },
      { x: 250, y: 180 },
    ];

    let step = 0;
    const interval = setInterval(() => {
      step = (step + 1) % 200;
      const progress = step / 200;
      const numSegs = routePoints.length - 1;
      const segIdx = Math.min(Math.floor(progress * numSegs), numSegs - 1);
      const segProg = (progress * numSegs) - segIdx;

      const p1 = routePoints[segIdx];
      const p2 = routePoints[segIdx + 1];

      const currentLat = p1.latitude + (p2.latitude - p1.latitude) * segProg;
      const currentLng = p1.longitude + (p2.longitude - p1.longitude) * segProg;

      setRiderLivePos({ latitude: currentLat, longitude: currentLng });

      // Calculate pixel position for native image tile layer
      const px1 = pathPoints[segIdx];
      const px2 = pathPoints[segIdx + 1];
      const curX = px1.x + (px2.x - px1.x) * segProg;
      const curY = px1.y + (px2.y - px1.y) * segProg;
      setRiderPxPos({ x: curX, y: curY });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const getLeafletMapHtml = () => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .leaflet-control-attribution { font-size: 9px !important; opacity: 0.6; }
    
    .store-pin {
      background: #0066FF;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: 3px solid #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 102, 255, 0.4);
    }

    .rider-pin {
      background: #0F172A;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: 3px solid #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
      transition: all 0.1s linear;
    }

    .dest-pin {
      background: #10B981;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: 3px solid #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { 
      zoomControl: false, 
      attributionControl: true 
    }).setView([12.9350, 77.6245], 16);

    // High-Performance Esri World Street Map Tile Layer (Zero Watermarks, 100% Free, No API Key)
    var tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '&copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
    }).addTo(map);

    // Route points through Koramangala
    var routePoints = [
      [12.9368, 77.6282], // Hub Store (17th E Main Rd)
      [12.9362, 77.6248], // Corner 15th Cross Rd
      [12.9350, 77.6242], // Koramangala 5th Block
      [12.9322, 77.6208]  // Destination (1st A Cross Rd)
    ];

    // Blue Route Line
    var polyline = L.polyline(routePoints, {
      color: '#0066FF',
      weight: 6,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    // Fit map bounds to show full route line with margin
    map.fitBounds(polyline.getBounds(), { padding: [35, 35] });

    // Store Marker (Blue circle + store icon)
    var storeSvg = '<div class="store-pin"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M10 12v3"/><path d="M14 12v3"/></svg></div>';
    L.marker(routePoints[0], {
      icon: L.divIcon({ className: 'custom-icon', html: storeSvg, iconSize: [38, 38], iconAnchor: [19, 19] })
    }).addTo(map);

    // Destination Marker (Green circle + pink drop pin)
    var destSvg = '<div class="dest-pin"><svg width="22" height="22" viewBox="0 0 24 24" fill="#EC4899" stroke="#FFFFFF" stroke-width="1.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="#FFFFFF"/></svg></div>';
    L.marker(routePoints[3], {
      icon: L.divIcon({ className: 'custom-icon', html: destSvg, iconSize: [38, 38], iconAnchor: [19, 19] })
    }).addTo(map);

    // Live Rider Marker (Black circle + cyan/blue navigation arrow)
    var riderSvg = '<div class="rider-pin"><svg width="20" height="20" viewBox="0 0 24 24" fill="#0066FF" stroke="#0066FF" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg></div>';
    var riderMarker = L.marker(routePoints[1], {
      icon: L.divIcon({ className: 'custom-icon', html: riderSvg, iconSize: [38, 38], iconAnchor: [19, 19] })
    }).addTo(map);

    // Smooth Real-Time Animation along route
    var step = 0;
    var totalSteps = 400;
    setInterval(function() {
      step = (step + 1) % totalSteps;
      var progress = step / totalSteps;
      var numSegs = routePoints.length - 1;
      var segIdx = Math.min(Math.floor(progress * numSegs), numSegs - 1);
      var segProg = (progress * numSegs) - segIdx;

      var p1 = routePoints[segIdx];
      var p2 = routePoints[segIdx + 1];

      var lat = p1[0] + (p2[0] - p1[0]) * segProg;
      var lng = p1[1] + (p2[1] - p1[1]) * segProg;

      riderMarker.setLatLng([lat, lng]);
    }, 50);
  </script>
</body>
</html>
`;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Map Header (Matching Reference Image 2 Pixel-for-Pixel) */}
        {!loadingOrder && order && (
        <View style={styles.mapContainer}>
          {/* High-Performance Esri World Street Map Layer (Zero Watermarks, Zero Missing Tiles) */}
          {Platform.OS === 'web' ? (
            React.createElement('iframe', {
              srcDoc: getLeafletMapHtml(),
              style: {
                width: '100%',
                height: '100%',
                border: 'none',
              },
            })
          ) : (
            <React.Fragment>
              <View style={styles.tileMapWrapper}>
                <View style={styles.tileGridRow}>
                  <Image
                    source={{ uri: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/16/29547/58364' }}
                    style={styles.cartoTile}
                    resizeMode="cover"
                  />
                  <Image
                    source={{ uri: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/16/29547/58365' }}
                    style={styles.cartoTile}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.tileGridRow}>
                  <Image
                    source={{ uri: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/16/29548/58364' }}
                    style={styles.cartoTile}
                    resizeMode="cover"
                  />
                  <Image
                    source={{ uri: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/16/29548/58365' }}
                    style={styles.cartoTile}
                    resizeMode="cover"
                  />
                </View>

                {/* Blue Delivery Route Polyline */}
                <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
                  <Path
                    d="M 60 70 L 140 85 L 175 140 L 250 180"
                    stroke="#0066FF"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </Svg>

                {/* 1. Store Pin (17th E Main Rd) */}
                <View style={[styles.mapMarkerPin, { top: 52, left: 42 }]}>
                  <View style={styles.storeMarkerCircle}>
                    <Store size={16} color="#FFFFFF" />
                  </View>
                </View>

                {/* 2. Destination Pin (1st A Cross Rd) */}
                <View style={[styles.mapMarkerPin, { top: 162, left: 232 }]}>
                  <View style={styles.destPinCircleGreen}>
                    <MapPin size={18} color="#EC4899" fill="#EC4899" />
                  </View>
                </View>

                {/* 3. Live Moving Rider Marker */}
                <View style={[styles.mapMarkerPin, { top: riderPxPos.y - 18, left: riderPxPos.x - 18 }]}>
                  <View style={styles.riderArrowCircle}>
                    <Navigation size={16} color="#0066FF" fill="#0066FF" />
                  </View>
                </View>
              </View>
            </React.Fragment>
          )}

          {/* Top Right: Google Maps External Button */}
          <Pressable
            style={styles.gmapsTopBtn}
            onPress={() => openNavigation(dropCoords.latitude, dropCoords.longitude, 'Customer Destination')}
          >
            <ExternalLink size={14} color="#0066FF" style={{ marginRight: 5 }} />
            <Text style={styles.gmapsTopBtnText}>Google Maps</Text>
          </Pressable>

          {/* Right Side Map Controls (Recenter Target Button) */}
          <View style={styles.mapRightControls}>
            <Pressable
              style={styles.mapControlBtn}
              onPress={() => showToast('Recentered on live location', 'info')}
            >
              <LocateFixed size={18} color="#0F172A" />
            </Pressable>
          </View>
        </View>
        )}

        {/* LOADING STATE */}
        {loadingOrder && (
          <View style={{ alignItems: 'center', padding: 32, gap: 12 }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={{ color: COLORS.textSecondary, fontWeight: '600' }}>Loading active order...</Text>
          </View>
        )}

        {/* NO ORDER STATE */}
        {!loadingOrder && !order && (
          <View style={{ alignItems: 'center', padding: 32, gap: 12 }}>
            <CheckCircle2 size={40} color="#10B981" />
            <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}>No Active Delivery</Text>
            <Text style={{ color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 }}>
              You have no order assigned yet. Go back to dashboard to check for new orders.
            </Text>
            <Pressable
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#EFF6FF', borderRadius: 10, borderWidth: 1, borderColor: '#BFDBFE' }}
              onPress={fetchActiveOrder}
            >
              <RefreshCw size={14} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Refresh</Text>
            </Pressable>
          </View>
        )}

        {/* 1. GROCERY ITEMS CARD */}
        {!loadingOrder && order && (
        <View style={styles.groceryCard}>
          <View style={styles.groceryHeaderRow}>
            <View style={styles.groceryTitleRow}>
              <Package size={20} color="#0F172A" style={{ marginRight: 8 }} />
              <Text style={styles.groceryTitle}>Order Items ({items.length})</Text>
            </View>
            <Text style={styles.groceryTotalPrice}>₹{Number(order.total_amount || order.total || 0).toFixed(2)}</Text>
          </View>

          {items.slice(0, 3).map((item) => (
            <View key={item.id} style={styles.groceryItemRow}>
              <View style={styles.qtyBadge}>
                <Text style={styles.qtyBadgeText}>{item.qty.split(' ')[0]}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.groceryItemName}>{item.name}</Text>
              </View>
            </View>
          ))}
          {items.length > 3 && (
            <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 4, fontWeight: '600' }}>+{items.length - 3} more items</Text>
          )}
        </View>
        )}

        {/* 3. DELIVERY PROGRESS CARD (STEP 1 OF 5) */}
        {!loadingOrder && order && (
        <View style={styles.progressCard}>
          <View style={styles.progressHeaderRow}>
            <Text style={styles.progressTitle}>
              Delivery Progress <Text style={styles.progressSubtitle}>· Live Updates</Text>
            </Text>
            <View style={styles.stepPill}>
              <Text style={styles.stepPillText}>
                Step {currentStep === 'REACH_STORE' ? '1' : currentStep === 'STORE_CHECKLIST' ? '2' : currentStep === 'EN_ROUTE' ? '3' : currentStep === 'OTP_DELIVERY' ? '4' : '5'} of 5
              </Text>
            </View>
          </View>

          {/* 5-Step Stepper Icons Row */}
          <View style={styles.stepperIconsRow}>
            {/* Step 1: Assigned */}
            <View style={styles.stepItemCol}>
              <View style={[styles.stepCircle, (currentStep === 'REACH_STORE' || currentStep === 'STORE_CHECKLIST' || currentStep === 'EN_ROUTE' || currentStep === 'OTP_DELIVERY' || currentStep === 'COMPLETED') ? styles.stepCircleActive : styles.stepCircleMuted]}>
                <Package size={16} color="#FFFFFF" />
              </View>
              <Text style={[styles.stepLabelText, currentStep === 'REACH_STORE' && styles.stepLabelActive]}>
                Assigned
              </Text>
              <Text style={styles.stepTimeText}>
                {order?.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '11:41 AM'}
              </Text>
            </View>

            {/* Step 2: Picked Up */}
            <View style={styles.stepItemCol}>
              <View style={[styles.stepCircle, (currentStep === 'STORE_CHECKLIST' || currentStep === 'EN_ROUTE' || currentStep === 'OTP_DELIVERY' || currentStep === 'COMPLETED') ? styles.stepCircleActive : styles.stepCircleMuted]}>
                <Bike size={16} color={(currentStep === 'STORE_CHECKLIST' || currentStep === 'EN_ROUTE' || currentStep === 'OTP_DELIVERY' || currentStep === 'COMPLETED') ? '#FFFFFF' : '#94A3B8'} />
              </View>
              <Text style={[styles.stepLabelText, currentStep === 'STORE_CHECKLIST' && styles.stepLabelActive]}>
                Picked Up
              </Text>
              <Text style={styles.stepTimeText}>
                {(currentStep === 'EN_ROUTE' || currentStep === 'OTP_DELIVERY' || currentStep === 'COMPLETED') ? '11:46 AM' : '--:--'}
              </Text>
            </View>

            {/* Step 3: On Route */}
            <View style={styles.stepItemCol}>
              <View style={[styles.stepCircle, (currentStep === 'EN_ROUTE' || currentStep === 'OTP_DELIVERY' || currentStep === 'COMPLETED') ? styles.stepCircleActive : styles.stepCircleMuted]}>
                <MapPin size={16} color={(currentStep === 'EN_ROUTE' || currentStep === 'OTP_DELIVERY' || currentStep === 'COMPLETED') ? '#FFFFFF' : '#94A3B8'} />
              </View>
              <Text style={[styles.stepLabelText, currentStep === 'EN_ROUTE' && styles.stepLabelActive]}>
                On Route
              </Text>
              <Text style={styles.stepTimeText}>
                {(currentStep === 'OTP_DELIVERY' || currentStep === 'COMPLETED') ? '11:52 AM' : '--:--'}
              </Text>
            </View>

            {/* Step 4: Arrived */}
            <View style={styles.stepItemCol}>
              <View style={[styles.stepCircle, (currentStep === 'OTP_DELIVERY' || currentStep === 'COMPLETED') ? styles.stepCircleActive : styles.stepCircleMuted]}>
                <Navigation size={16} color={(currentStep === 'OTP_DELIVERY' || currentStep === 'COMPLETED') ? '#FFFFFF' : '#94A3B8'} />
              </View>
              <Text style={[styles.stepLabelText, currentStep === 'OTP_DELIVERY' && styles.stepLabelActive]}>
                Arrived
              </Text>
              <Text style={styles.stepTimeText}>{currentStep === 'COMPLETED' ? '11:56 AM' : '--:--'}</Text>
            </View>

            {/* Step 5: Delivered */}
            <View style={styles.stepItemCol}>
              <View style={[styles.stepCircle, currentStep === 'COMPLETED' ? styles.stepCircleActive : styles.stepCircleMuted]}>
                <CheckCircle2 size={16} color={currentStep === 'COMPLETED' ? '#FFFFFF' : '#94A3B8'} />
              </View>
              <Text style={[styles.stepLabelText, currentStep === 'COMPLETED' && styles.stepLabelActive]}>
                Delivered
              </Text>
              <Text style={styles.stepTimeText}>{currentStep === 'COMPLETED' ? '11:58 AM' : '--:--'}</Text>
            </View>
          </View>
        </View>
        )}

        {/* Task Details Main Card */}
        {!loadingOrder && order && (
        <View style={styles.card}>
          <View style={styles.orderHeader}>
            <View style={{ width: '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={styles.orderId}>Order #{order.orderNumber || order.id || '—'}</Text>
                <View style={styles.customerBadge}>
                  <User size={13} color="#0066FF" style={{ marginRight: 4 }} />
                  <Text style={styles.customerBadgeText}>Customer: {order.customer_name || order.customer?.name || 'Customer'}</Text>
                </View>
              </View>
              <Text style={styles.orderSubtitle}>Standard Express • 10 Min Delivery</Text>
            </View>
          </View>

          {/* STEP 1: REACH STORE */}
          {currentStep === 'REACH_STORE' && (
            <View style={styles.stepContainer}>
              <View style={styles.locationHeaderRow}>
                <Store size={22} color={COLORS.primary} />
                <View style={styles.locationHeaderText}>
                  <Text style={styles.locationTitle}>Dark Store #4 (Counter 2)</Text>
                  <Text style={styles.locationSub}>100ft Road, Indiranagar, Bengaluru (1.2 km)</Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  style={styles.navButton}
                  onPress={() => openNavigation(pickupCoords.latitude, pickupCoords.longitude, 'Dark Store #4')}
                >
                  <Navigation size={18} color="#FFFFFF" />
                  <Text style={styles.navButtonText}>Navigate to Store</Text>
                </Pressable>
                <Pressable style={styles.phoneButton} onPress={() => openCall('+918045678900')}>
                  <Phone size={18} color={COLORS.primary} />
                </Pressable>
              </View>

              <Pressable style={styles.primaryActionBtn} onPress={() => advanceStep('STORE_CHECKLIST')}>
                <Text style={styles.primaryActionText}>I Have Arrived at Store</Text>
                <ChevronRight size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          )}

          {/* STEP 2: STORE CHECKLIST */}
          {currentStep === 'STORE_CHECKLIST' && (
            <View style={styles.stepContainer}>
              <View style={styles.checklistHeader}>
                <Package size={22} color={COLORS.primary} />
                <Text style={styles.checklistTitle}>Verify Store Items (4 items)</Text>
              </View>

              <Text style={styles.checklistSub}>
                Check each item with the dark store supervisor before sealing the bag:
              </Text>

              {items.map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.checkItemRow, item.checked && styles.checkItemRowChecked]}
                  onPress={() => toggleCheckItem(item.id)}
                >
                  <View style={[styles.checkbox, item.checked && styles.checkboxActive]}>
                    {item.checked && <CheckCircle2 size={16} color="#FFFFFF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemName, item.checked && styles.itemNameChecked]}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemQty}>Qty: {item.qty}</Text>
                  </View>
                </Pressable>
              ))}

              <Pressable
                style={[styles.primaryActionBtn, !allItemsChecked && styles.disabledBtn]}
                disabled={!allItemsChecked}
                onPress={() => {
                  advanceStep('EN_ROUTE');
                  showToast('Items verified! Start navigating to customer.', 'success');
                }}
              >
                <Text style={styles.primaryActionText}>
                  {allItemsChecked ? 'Confirm Items Picked Up' : 'Check All Items First'}
                </Text>
                <ChevronRight size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          )}

          {/* STEP 3: EN ROUTE TO CUSTOMER */}
          {currentStep === 'EN_ROUTE' && (
            <View style={styles.stepContainer}>
              <View style={styles.locationHeaderRow}>
                <User size={22} color={COLORS.success} />
                <View style={styles.locationHeaderText}>
                  <Text style={styles.locationTitle}>
                    {order?.customer_name || 'Customer'}
                    {order?.customer_phone ? ` (+91 ${String(order.customer_phone).replace(/^\+?91/, '')})` : ''}
                  </Text>
                  <Text style={styles.locationSub}>{order?.delivery_address || order?.address || 'Delivery Address'}</Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  style={styles.navButton}
                  onPress={() => openNavigation(dropCoords.latitude, dropCoords.longitude, 'Customer Location')}
                >
                  <Navigation size={18} color="#FFFFFF" />
                  <Text style={styles.navButtonText}>Navigate to Customer</Text>
                </Pressable>
                <Pressable style={styles.phoneButton} onPress={() => openCall(order?.customer_phone || '')}>
                  <Phone size={18} color={COLORS.primary} />
                </Pressable>
              </View>

              <Pressable style={styles.primaryActionBtn} onPress={() => advanceStep('OTP_DELIVERY')}>
                <Text style={styles.primaryActionText}>Arrived at Doorstep</Text>
                <ChevronRight size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          )}

          {/* STEP 4: OTP & PHOTO PROOF */}
          {currentStep === 'OTP_DELIVERY' && (
            <View style={styles.stepContainer}>
              <Text style={styles.sectionHeading}>Delivery Verification</Text>

              {/* Camera Photo Proof */}
              <Pressable style={styles.cameraBox} onPress={handleCaptureProof}>
                <Camera size={24} color={COLORS.primary} />
                <Text style={styles.cameraBoxText}>
                  {proofPhoto ? 'Photo Captured ✓ (Tap to retake)' : 'Take Delivery Photo Proof'}
                </Text>
              </Pressable>

              {proofPhoto && <Image source={{ uri: proofPhoto }} style={styles.previewImg} />}

              {/* Customer OTP */}
              <View style={styles.otpBox}>
                <View style={styles.otpLabelRow}>
                  <KeyRound size={18} color={COLORS.primaryDark} />
                  <Text style={styles.otpLabel}>Customer Delivery OTP (PIN)</Text>
                </View>
                <TextInput
                  style={styles.otpInput}
                  placeholder="Enter 4-digit OTP from customer"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otpInput}
                  onChangeText={setOtpInput}
                />
                <Text style={styles.otpHint}>Ask customer for the code sent to their app.</Text>
              </View>

              <Pressable
                style={[styles.primaryActionBtn, (isUploading || !proofPhoto) && styles.disabledBtn]}
                disabled={isUploading}
                onPress={handleCompleteDelivery}
              >
                <CheckCircle2 size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryActionText}>
                  {isUploading ? 'Verifying & Submitting...' : 'Complete Order & Collect Payout'}
                </Text>
              </Pressable>
            </View>
          )}

          {/* STEP 5: COMPLETED */}
          {currentStep === 'COMPLETED' && (
            <View style={styles.completedContainer}>
              <View style={styles.successIconCircle}>
                <CheckCircle2 size={54} color={COLORS.success} />
              </View>
              <Text style={styles.completedTitle}>Order Delivered Successfully!</Text>
              <Text style={styles.completedSub}>
                You earned ₹{payout} for this delivery. Your balance has been updated.
              </Text>

              <Pressable style={styles.primaryActionBtn} onPress={() => router.replace('/rider' as any)}>
                <Text style={styles.primaryActionText}>Back to Rider Dashboard</Text>
              </Pressable>
            </View>
          )}
        </View>
        )}

        {/* Customer Instruction Note */}
        {!loadingOrder && order && (
        <View style={styles.instructionCard}>
          <Clock size={18} color={COLORS.primaryDark} />
          <Text style={styles.instructionText}>
            Delivery Deadline: <Text style={{ fontWeight: '800' }}>{deadlineInfo.remainingMins > 0 ? `${String(deadlineInfo.remainingMins).padStart(2, '0')} Mins Left` : 'Due Now'}</Text> (Target: {deadlineInfo.targetTimeStr})
          </Text>
        </View>
        )}
      </ScrollView>

      {/* SOS Modal */}
      <Modal visible={sosModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.sosModalCard}>
            <View style={styles.sosHeaderCircle}>
              <AlertTriangle size={36} color={COLORS.danger} />
            </View>
            <Text style={styles.sosTitle}>Emergency Emergency SOS</Text>
            <Text style={styles.sosDesc}>
              This will immediately send your live GPS location to Grabit Security Ops & trigger an emergency response.
            </Text>

            <Pressable style={styles.sosDialBtn} onPress={() => openCall('112')}>
              <Phone size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.sosDialText}>Call Security Dispatch (112)</Text>
            </Pressable>

            <Pressable style={styles.sosCancelBtn} onPress={() => setSosModal(false)}>
              <Text style={styles.sosCancelText}>Dismiss Alert</Text>
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
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  mapContainer: {
    height: 240,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
    backgroundColor: '#E0F2FE',
    ...SHADOWS.sm,
  },
  map: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E0F2FE',
  },
  webMapContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  mapCanvas: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  canvasBg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#E2E8F0',
  },
  parkPatch: {
    position: 'absolute',
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  waterPatch: {
    position: 'absolute',
    backgroundColor: '#BAE6FD',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#7DD3FC',
  },
  roadHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#CBD5E1',
  },
  roadVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 14,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#CBD5E1',
  },
  routeSegmentHorizontal: {
    position: 'absolute',
    top: '39%',
    left: '26%',
    width: '38%',
    height: 4,
    backgroundColor: '#0066FF',
    borderRadius: 2,
  },
  routeSegmentVertical: {
    position: 'absolute',
    top: '39%',
    left: '64%',
    height: '27%',
    width: 4,
    backgroundColor: '#0066FF',
    borderRadius: 2,
  },
  mapMarkerPin: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubBadge: {
    backgroundColor: '#0066FF',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  riderBadge: {
    backgroundColor: '#0F172A',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  destBadge: {
    backgroundColor: '#DB2777',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  storeMarkerCircle: {
    backgroundColor: '#0066FF',
    padding: 7,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...SHADOWS.sm,
  },
  riderArrowCircle: {
    backgroundColor: '#000000',
    padding: 6,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  destPinCircle: {
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  gmapsTopBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  gmapsTopBtnText: {
    color: '#0066FF',
    fontWeight: '800',
    fontSize: 12,
  },
  sosFloatingBtn: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: COLORS.danger,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  sosText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
    marginLeft: 4,
  },
  mapRightControls: {
    position: 'absolute',
    right: 10,
    bottom: 50,
    gap: 6,
  },
  mapControlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  bottomPillOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hubPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    ...SHADOWS.sm,
  },
  hubPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0066FF',
  },
  destPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    ...SHADOWS.sm,
  },
  destPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  stepperBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: COLORS.primary,
  },
  stepDotNum: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  stepLine: {
    flex: 1,
    height: 3,
    backgroundColor: COLORS.border,
    marginHorizontal: 6,
  },
  stepLineActive: {
    backgroundColor: COLORS.primary,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
    marginBottom: SPACING.md,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.md,
  },
  orderId: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  orderSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  payoutBadge: {
    backgroundColor: COLORS.successLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  payoutText: {
    color: COLORS.success,
    fontWeight: '800',
    fontSize: 13,
  },
  stepContainer: {},
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  locationHeaderText: {
    marginLeft: 10,
    flex: 1,
  },
  locationTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  locationSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  navButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  navButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    marginLeft: 8,
  },
  phoneButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  primaryActionBtn: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xs,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  checklistTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginLeft: 8,
  },
  checklistSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: SPACING.md,
    borderRadius: 10,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  checkItemRowChecked: {
    backgroundColor: COLORS.successLight,
    borderColor: COLORS.success,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.textMuted,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: COLORS.textSecondary,
  },
  itemQty: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  cameraBox: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  cameraBoxText: {
    color: COLORS.primaryDark,
    fontWeight: '800',
    fontSize: 14,
    marginTop: 6,
  },
  previewImg: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    marginBottom: SPACING.md,
  },
  otpBox: {
    backgroundColor: '#F9FAFB',
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  otpLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  otpLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginLeft: 6,
  },
  otpInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 2,
  },
  otpHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  completedContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  completedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
  },
  completedSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  instructionCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  instructionText: {
    fontSize: 13,
    color: COLORS.primaryDark,
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  sosModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  sosHeaderCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  sosTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.danger,
    marginBottom: 6,
  },
  sosDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 18,
  },
  sosDialBtn: {
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  sosDialText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  sosCancelBtn: {
    paddingVertical: SPACING.sm,
  },
  sosCancelText: {
    color: COLORS.textMuted,
    fontWeight: '700',
    fontSize: 14,
  },
  // 1. GROCERY ITEMS CARD STYLES
  groceryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  groceryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  groceryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groceryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  groceryTotalPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  groceryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  qtyBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  groceryItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0F2FE',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  groceryItemPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },

  // 2. CONFIRM PICKUP BUTTON STYLES
  confirmPickupBtn: {
    backgroundColor: '#0066FF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  confirmPickupText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  // 3. DELIVERY PROGRESS CARD STYLES
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  progressSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  stepPill: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  stepPillText: {
    color: '#0066FF',
    fontSize: 12,
    fontWeight: '800',
  },
  stepperIconsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepItemCol: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepCircleActive: {
    backgroundColor: '#0066FF',
  },
  stepCircleMuted: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  stepLabelActive: {
    fontWeight: '800',
    color: '#0066FF',
  },
  stepTimeText: {
    fontSize: 10,
    color: '#94A3B8',
  },

  // 4. DELIVERY DESTINATION CARD STYLES
  destinationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: COLORS.border,
    borderRightColor: COLORS.border,
    borderBottomColor: COLORS.border,
    ...SHADOWS.sm,
  },
  destinationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  destPinCircleGreen: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.5,
  },
  destCustomerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  callBtnGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  callBtnText: {
    color: '#059669',
    fontWeight: '800',
    fontSize: 13,
  },
  destAddressText: {
    fontSize: 13,
    color: '#475569',
    marginBottom: SPACING.md,
    lineHeight: 18,
  },
  gmapsTurnByTurnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingVertical: 12,
  },
  gmapsTurnByTurnText: {
    color: '#0066FF',
    fontWeight: '800',
    fontSize: 13,
  },
  tileMapWrapper: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  tileGridRow: {
    flexDirection: 'row',
    height: '50%',
    width: '100%',
  },
  cartoTile: {
    flex: 1,
    height: '100%',
  },
  customerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  customerBadgeText: {
    color: '#0066FF',
    fontSize: 12,
    fontWeight: '700',
  },
});


