import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { get, patch } from '../../../services/api';
import { wsClient } from '../../../services/websocket';
import { Order } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { LoadingView } from '../../../components/LoadingView';
import { COLORS, SPACING, SHADOWS } from '../../../constants/theme';
import { ArrowLeft, Bike, Phone, MapPin, CheckCircle2, Clock } from 'lucide-react-native';

export default function OrderTrackingPage() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { showToast } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [riderCoords, setRiderCoords] = useState({ latitude: 12.9725, longitude: 77.5955 });
  const [destCoords] = useState({ latitude: 12.9716, longitude: 77.5946 });

  useEffect(() => {
    get(`/orders/${orderId}`)
      .then((res) => {
        if (res && res.id) setOrder(res);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));

    // Connect to WebSocket for live delivery rider location stream
    wsClient.connect();
    const unsubscribe = wsClient.on('rider_location', (data: any) => {
      if (data.latitude && data.longitude) {
        setRiderCoords({ latitude: data.latitude, longitude: data.longitude });
      }
    });

    return () => {
      unsubscribe();
      wsClient.disconnect();
    };
  }, [orderId]);

  const handleCancelOrder = async () => {
    try {
      await patch(`/orders/${orderId}/status`, { status: 'cancelled' });
      showToast('Order cancelled successfully', 'success');
      router.replace('/customer/orders' as any);
    } catch {
      showToast('Failed to cancel order. Please contact support.', 'error');
    }
  };

  const isCancellable = order && ['placed', 'preparing', 'ready', 'confirmed'].includes(order.status.toLowerCase());

  if (isLoading) return <LoadingView message="Connecting to Rider GPS Tracking..." />;

  const displayOrder: Order = order || {
    id: orderId || 'ORD-982145',
    items: [
      { product_id: 'p1', name: 'Amul Taaza Toned Milk (1L)', price: 54, quantity: 2 },
      { product_id: 'p4', name: "Lay's Magic Masala Chips", price: 20, quantity: 1 },
    ],
    subtotal: 128,
    delivery_fee: 0,
    discount: 10,
    total: 118,
    status: 'OUT_FOR_DELIVERY',
    payment_method: 'UPI',
    payment_status: 'COMPLETED',
    rider_name: 'Rahul Sharma (Fastest Agent)',
    rider_phone: '+919876543210',
    created_at: '2 mins ago',
    estimated_delivery_time: '7 Mins',
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Live Delivery Tracking</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Map View showing Rider Marker & Destination */}
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: (riderCoords.latitude + destCoords.latitude) / 2,
              longitude: (riderCoords.longitude + destCoords.longitude) / 2,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            }}
          >
            <Marker coordinate={riderCoords} title="Delivery Rider">
              <View style={styles.riderMarker}>
                <Bike size={20} color="#FFFFFF" />
              </View>
            </Marker>

            <Marker coordinate={destCoords} title="Your Delivery Address">
              <View style={styles.destMarker}>
                <MapPin size={20} color={COLORS.primaryDark} />
              </View>
            </Marker>

            <Polyline
              coordinates={[riderCoords, destCoords]}
              strokeColor={COLORS.primary}
              strokeWidth={4}
            />
          </MapView>
        </View>

        {/* ETA & Status Banner */}
        <View style={styles.etaCard}>
          <View style={styles.etaLeft}>
            <Text style={styles.etaSub}>ARRIVING IN</Text>
            <Text style={styles.etaVal}>{displayOrder.estimated_delivery_time || '8 Mins'}</Text>
          </View>
          <View style={styles.pulseBadge}>
            <Clock size={16} color={COLORS.primaryDark} />
            <Text style={styles.pulseText}>ON TIME</Text>
          </View>
        </View>

        {/* Rider Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Assigned Delivery Partner</Text>
          <View style={styles.riderRow}>
            <View style={styles.riderAvatar}>
              <Bike size={24} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={styles.riderName}>{displayOrder.rider_name || 'Rider Partner'}</Text>
              <Text style={styles.riderSub}>EV Scooter • Verified Biometrics</Text>
            </View>
            <Pressable style={styles.callBtn}>
              <Phone size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Order Items Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order #{displayOrder.id}</Text>
          {displayOrder.items.map((i, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemName}>
                {i.quantity}x {i.name}
              </Text>
              <Text style={styles.itemPrice}>₹{i.price * i.quantity}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.itemRow}>
            <Text style={styles.totalLabel}>Total Paid ({displayOrder.payment_method})</Text>
            <Text style={styles.totalVal}>₹{displayOrder.total}</Text>
          </View>
        </View>

        {isCancellable && (
          <Pressable style={styles.cancelBtn} onPress={handleCancelOrder}>
            <Text style={styles.cancelBtnText}>Cancel Order</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 6,
    marginRight: SPACING.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 80,
  },
  mapContainer: {
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  riderMarker: {
    backgroundColor: COLORS.primaryDark,
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  destMarker: {
    backgroundColor: COLORS.primaryLight,
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  etaCard: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 16,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  etaLeft: {},
  etaSub: {
    color: COLORS.secondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  etaVal: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
  },
  pulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  pulseText: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  riderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  riderAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  riderSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  callBtn: {
    backgroundColor: COLORS.primary,
    padding: 10,
    borderRadius: 20,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  itemName: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xs + 4,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  totalVal: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  cancelBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  cancelBtnText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '800',
  },
});
