import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Share,
  Platform,
} from 'react-native';
import { get, patch } from '../../services/api';
import { Order } from '../../types';
export { Order };
import { useToast } from '../../context/ToastContext';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import {
  ShoppingBag,
  Search,
  CheckCircle,
  PackageCheck,
  Truck,
  Clock,
  Share2,
  Phone,
  MapPin,
  CreditCard,
  X,
  FileText,
  Printer,
  UserCheck,
  Bike,
  RefreshCw,
} from 'lucide-react-native';

export interface FleetRider {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  rating: number;
  distance: string;
}

export const FLEET_RIDERS: FleetRider[] = [
  {
    id: 'd7e8f9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2b',
    name: 'Thabee',
    phone: '+919080841727',
    vehicle: 'Electric Scooter (TN 09 AB 1234)',
    rating: 4.9,
    distance: '0.4 km away',
  },
  {
    id: 'd7e8f9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2a',
    name: 'Karthik Rider',
    phone: '+919999900003',
    vehicle: 'Hero Splendor (TN 01 XY 9876)',
    rating: 4.8,
    distance: '0.8 km away',
  },
  {
    id: 'RDR-3003',
    name: 'Rahul Sharma',
    phone: '+919876543210',
    vehicle: 'TVS NTORQ (TN 07 CA 5544)',
    rating: 4.7,
    distance: '1.2 km away',
  },
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ORD-9821',
    customer_name: 'Ananya Roy',
    customer_phone: '9840123456',
    address: 'Flat 402, Green Valley Apartments, Anna Nagar, Chennai',
    items: [
      { id: 'p1', name: 'Amul Taaza Milk 1L', quantity: 2, price: 56 },
      { id: 'p2', name: 'Fresh Organic Tomatoes 1kg', quantity: 1, price: 40 },
      { id: 'p3', name: 'Modern Whole Wheat Bread 400g', quantity: 1, price: 45 },
    ],
    subtotal: 197,
    delivery_fee: 25,
    discount: 0,
    total: 222,
    status: 'PLACED',
    payment_method: 'UPI Instant',
    payment_status: 'PAID',
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'ORD-9820',
    customer_name: 'Venkatesh K.',
    customer_phone: '9710987654',
    address: 'Plot 12, 3rd Cross St, T. Nagar, Chennai',
    items: [
      { id: 'p4', name: 'Aashirvaad Shuddh Chakki Atta 5kg', quantity: 1, price: 285 },
      { id: 'p5', name: 'Fortune Sunlite Sunflower Oil 1L', quantity: 2, price: 165 },
    ],
    subtotal: 615,
    delivery_fee: 30,
    discount: 20,
    total: 625,
    status: 'PREPARING',
    payment_method: 'Credit Card',
    payment_status: 'PAID',
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'ORD-9819',
    customer_name: 'Priya Sundaram',
    customer_phone: '9940112233',
    address: 'No. 88, Beach Road, Besant Nagar, Chennai',
    items: [
      { id: 'p6', name: 'Cadbury Dairy Milk Silk 150g', quantity: 3, price: 175 },
      { id: 'p7', name: 'Lays Magic Masala Chips 50g', quantity: 4, price: 20 },
    ],
    subtotal: 605,
    delivery_fee: 20,
    discount: 15,
    total: 610,
    status: 'READY_FOR_PICKUP',
    rider_id: 'd7e8f9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2b',
    rider_name: 'Thabee',
    rider_phone: '+919080841727',
    payment_method: 'GPay',
    payment_status: 'PAID',
    created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
    id: 'ORD-9818',
    customer_name: 'Suresh Raina',
    customer_phone: '9884055667',
    address: 'Door 15, Lake View Road, Velachery, Chennai',
    items: [
      { id: 'p8', name: 'Surf Excel Easy Wash Detergent 1kg', quantity: 1, price: 140 },
      { id: 'p9', name: 'Vim Dishwash Liquid 500ml', quantity: 1, price: 110 },
    ],
    subtotal: 250,
    delivery_fee: 25,
    discount: 0,
    total: 275,
    status: 'OUT_FOR_DELIVERY',
    rider_id: 'd7e8f9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2a',
    rider_name: 'Karthik Rider',
    rider_phone: '+919999900003',
    payment_method: 'Cash on Delivery',
    payment_status: 'PENDING',
    created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
  },
  {
    id: 'ORD-9815',
    customer_name: 'Meera Rajesh',
    customer_phone: '9790234567',
    address: 'Villa 5, Silver Oak Enclave, OMR, Chennai',
    items: [
      { id: 'p10', name: 'Nescafe Classic Instant Coffee 100g', quantity: 1, price: 320 },
      { id: 'p11', name: 'Amul Butter 500g', quantity: 1, price: 275 },
    ],
    subtotal: 595,
    delivery_fee: 0,
    discount: 50,
    total: 545,
    status: 'DELIVERED',
    rider_id: 'd7e8f9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2b',
    rider_name: 'Thabee',
    rider_phone: '+919080841727',
    payment_method: 'Paytm',
    payment_status: 'PAID',
    created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  },
];


type OrderTab = 'ALL' | 'PLACED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export default function SellerOrdersScreen() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [activeTab, setActiveTab] = useState<OrderTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [fleetRiders, setFleetRiders] = useState<FleetRider[]>(FLEET_RIDERS);
  const [loading, setLoading] = useState(false);

  // Packing Slip & Reassign Modal State
  const [selectedPackingSlip, setSelectedPackingSlip] = useState<Order | null>(null);
  const [selectedReassignOrder, setSelectedReassignOrder] = useState<Order | null>(null);

  // Fetch real orders from backend with fallback
  const fetchOrdersSilent = useCallback(async () => {
    try {
      const res = await get('/store/orders');
      let apiOrders: Order[] = [];
      if (res && Array.isArray(res) && res.length > 0) {
        apiOrders = res.map((o: any, idx: number) => ({
          ...o,
          id: String(o.id || o._id || 'ORD-' + idx),
          status: String(o.status || 'PLACED').toUpperCase() as Order['status'],
          items: Array.isArray(o.items) ? o.items : [],
          subtotal: Number(o.subtotal || o.total || 0),
          delivery_fee: Number(o.delivery_fee || 0),
          discount: Number(o.discount || 0),
          total: Number(o.total || o.total_amount || 0),
          payment_method: o.payment_method || 'Online Payment',
          payment_status: o.payment_status || 'PAID',
        }));
      } else if (res && Array.isArray(res?.orders) && res.orders.length > 0) {
        apiOrders = res.orders.map((o: any, idx: number) => ({
          ...o,
          id: String(o.id || o._id || 'ORD-' + idx),
          status: String(o.status || 'PLACED').toUpperCase() as Order['status'],
          items: Array.isArray(o.items) ? o.items : [],
          subtotal: Number(o.subtotal || o.total || 0),
          delivery_fee: Number(o.delivery_fee || 0),
          discount: Number(o.discount || 0),
          total: Number(o.total || o.total_amount || 0),
          payment_method: o.payment_method || 'Online Payment',
          payment_status: o.payment_status || 'PAID',
        }));
      }

      if (apiOrders.length > 0) {
        setOrders(apiOrders);
      } else {
        setOrders((prev) => (prev.length > 0 ? prev : INITIAL_ORDERS));
      }
    } catch {
      setOrders((prev) => (prev.length > 0 ? prev : INITIAL_ORDERS));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch real riders from backend with fallback
  const fetchRiders = useCallback(async () => {
    try {
      const res = await get('/delivery/riders');
      if (res && Array.isArray(res) && res.length > 0) {
        const mapped: FleetRider[] = res.map((r: any) => ({
          id: r.id || r.phone,
          name: r.full_name || r.name || 'Rider',
          phone: r.phone || '',
          vehicle: r.vehicle_type || 'Delivery Vehicle',
          rating: Number(r.rating || 4.8),
          distance: r.distance || 'Nearby',
        }));
        setFleetRiders(mapped);
      } else {
        setFleetRiders((prev) => (prev.length > 0 ? prev : FLEET_RIDERS));
      }
    } catch {
      setFleetRiders((prev) => (prev.length > 0 ? prev : FLEET_RIDERS));
    }
  }, []);

  useEffect(() => {
    fetchOrdersSilent();
    fetchRiders();
    // Refresh every 15 seconds
    const interval = setInterval(() => { fetchOrdersSilent(); fetchRiders(); }, 15000);
    return () => clearInterval(interval);
  }, [fetchOrdersSilent, fetchRiders]);

  const handleUpdateStatus = async (orderId: string, newStatus: Order['status']) => {
    showToast(`Order ${orderId} updated to ${newStatus}`, 'success');
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
    try {
      await patch(`/orders/${orderId}/status`, { status: newStatus.toLowerCase() });
    } catch {
      // Instant local state already updated
    }
  };

  const handleAssignRider = async (order: Order, rider: FleetRider) => {
    const nextStatus = order.status === 'PLACED' || order.status === 'PREPARING' ? 'READY_FOR_PICKUP' : order.status;
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? {
              ...o,
              rider_id: rider.id,
              rider_name: rider.name,
              rider_phone: rider.phone,
              status: nextStatus,
            }
          : o
      )
    );

    setSelectedReassignOrder(null);
    showToast(`Order ${order.id} reassigned to ${rider.name}`, 'success');

    try {
      await patch(`/orders/${order.id}/status`, {
        status: nextStatus.toLowerCase(),
        delivery_agent_id: rider.id,
        rider_name: rider.name,
      });
    } catch {
      // Local instant state updated
    }
  };

  const generatePackingSlipHtml = (order: Order) => {
    const dateStr = new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const itemsRows = (order.items || [])
      .map(
        (it) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 4px; text-align: center; font-size: 13px;">[  ]</td>
          <td style="padding: 8px 4px; font-weight: 600; font-size: 13px; color: #1e293b;">${it.name}</td>
          <td style="padding: 8px 4px; text-align: center; font-weight: bold; font-size: 13px; color: #0f172a;">${it.quantity}</td>
          <td style="padding: 8px 4px; text-align: right; font-weight: 600; font-size: 13px; color: #0f172a;">₹${it.price * it.quantity}</td>
        </tr>
      `
      )
      .join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Order Slip #${order.id}</title>
      <style>
        @media print {
          body { margin: 0; padding: 12px; }
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 16px;
          max-width: 480px;
          margin-left: auto;
          margin-right: auto;
        }
        .header-box {
          text-align: center;
          border-bottom: 2px dashed #cbd5e1;
          padding-bottom: 12px;
          margin-bottom: 12px;
        }
        .brand-title {
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 0.5px;
          color: #0066FF;
        }
        .brand-sub {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
          font-weight: 500;
        }
        .order-badge {
          display: inline-block;
          background: #eff6ff;
          color: #0066FF;
          font-weight: 800;
          font-size: 14px;
          padding: 4px 12px;
          border-radius: 6px;
          margin-top: 8px;
        }
        .section-header {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          color: #475569;
          letter-spacing: 0.5px;
          margin-top: 14px;
          margin-bottom: 6px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 4px;
        }
        .info-table {
          width: 100%;
          font-size: 12px;
          margin-bottom: 8px;
        }
        .info-table td {
          padding: 2px 0;
        }
        .info-label {
          color: #64748b;
          width: 90px;
        }
        .info-val {
          font-weight: 600;
          color: #0f172a;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }
        .items-table th {
          background: #f8fafc;
          border-bottom: 1px solid #cbd5e1;
          text-align: left;
          font-size: 11px;
          text-transform: uppercase;
          color: #475569;
          padding: 6px 4px;
        }
        .summary-box {
          margin-top: 12px;
          border-top: 2px dashed #cbd5e1;
          padding-top: 10px;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #475569;
          margin-bottom: 4px;
        }
        .grand-row {
          display: flex;
          justify-content: space-between;
          font-size: 15px;
          font-weight: 900;
          color: #0f172a;
          border-top: 1.5px solid #0f172a;
          padding-top: 6px;
          margin-top: 6px;
        }
        .barcode-container {
          text-align: center;
          margin-top: 16px;
          padding: 10px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #fafafa;
        }
        .barcode-text {
          font-family: monospace;
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 3px;
          color: #0f172a;
        }
        .footer-note {
          text-align: center;
          font-size: 10px;
          color: #94a3b8;
          margin-top: 16px;
        }
      </style>
    </head>
    <body>
      <div class="header-box">
        <div class="brand-title">GRABIT SUPERMARKET</div>
        <div class="brand-sub">Vendor Fulfillment Center • Dark Store #882</div>
        <div class="order-badge">ORDER REF: ${order.id}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 6px;">Printed: ${dateStr}</div>
      </div>

      <div class="section-header">Customer & Dispatch Details</div>
      <table class="info-table">
        <tr>
          <td class="info-label">Customer:</td>
          <td class="info-val">${order.customer_name || 'Customer'}</td>
        </tr>
        <tr>
          <td class="info-label">Phone:</td>
          <td class="info-val">+91 ${order.customer_phone || '9999900000'}</td>
        </tr>
        <tr>
          <td class="info-label">Address:</td>
          <td class="info-val">${order.address || 'Store Pickup / Express'}</td>
        </tr>
        <tr>
          <td class="info-label">Payment:</td>
          <td class="info-val">${order.payment_method} &bull; ${order.payment_status}</td>
        </tr>
      </table>

      <div class="section-header">Packing Items Checklist</div>
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">[ ]</th>
            <th>Item Description</th>
            <th style="width: 40px; text-align: center;">Qty</th>
            <th style="width: 70px; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <div class="summary-box">
        <div class="summary-row"><span>Subtotal</span><span>₹${order.subtotal}</span></div>
        <div class="summary-row"><span>Delivery Fee</span><span>₹${order.delivery_fee}</span></div>
        ${order.discount ? `<div class="summary-row"><span>Discount</span><span>-₹${order.discount}</span></div>` : ''}
        <div class="grand-row"><span>TOTAL PAYABLE</span><span>₹${order.total}</span></div>
      </div>

      <div class="barcode-container">
        <div class="barcode-text">||| | |||| | ||| |||| | |||</div>
        <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-top: 4px;">VERIFIED & PACKED BY GRABIT</div>
      </div>

      <div class="footer-note">
        Thank you for fulfilling with Grabit Seller Portal.<br/>
        Please attach this order slip to the customer delivery package.
      </div>
    </body>
    </html>
    `;
  };

  const handlePrintPackingSlip = async (order: Order) => {
    try {
      const html = generatePackingSlipHtml(order);
      if (typeof window !== 'undefined' && typeof window.open === 'function') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 250);
          showToast(`Printing Order Slip #${order.id}...`, 'success');
          return;
        }
      }

      // Native fallback: Share order packing slip text
      const itemsList = (order.items || [])
        .map((it) => `- ${it.name} x${it.quantity} (₹${it.price * it.quantity})`)
        .join('\n');
      const shareText = `GRABIT ORDER SLIP #${order.id}\nCustomer: ${order.customer_name || 'Customer'}\nPhone: ${order.customer_phone || ''}\nAddress: ${order.address || ''}\n\nITEMS:\n${itemsList}\n\nTotal: ₹${order.total}`;

      await Share.share({
        title: `Order Slip #${order.id}`,
        message: shareText,
      });
      showToast(`Order Slip #${order.id} generated`, 'success');
    } catch {
      showToast('Printing failed or cancelled', 'error');
    }
  };

  const handleSharePackingSlip = async (order: Order) => {
    try {
      const slipText = `GRABIT STORE PACKING SLIP\nOrder ID: ${order.id}\nCustomer: ${order.customer_name}\nPhone: ${order.customer_phone}\nItems:\n${(order.items || [])
        .map((it) => `- ${it.quantity}x ${it.name} (₹${it.price})`)
        .join('\n')}\nTotal: ₹${order.total}`;
      await Share.share({ message: slipText, title: `Packing Slip ${order.id}` });
    } catch {
      showToast('Sharing failed', 'error');
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesTab = activeTab === 'ALL' || order.status === activeTab;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      order.id.toLowerCase().includes(q) ||
      (order.customer_name || '').toLowerCase().includes(q) ||
      (order.customer_phone || '').includes(q);
    return matchesTab && matchesSearch;
  });

  const getStatusBadgeStyle = (status: Order['status']) => {
    switch (status) {
      case 'PLACED':
        return { bg: '#FEF3C7', text: '#D97706' };
      case 'PREPARING':
        return { bg: '#DBEAFE', text: '#2563EB' };
      case 'READY_FOR_PICKUP':
        return { bg: '#E0E7FF', text: '#4F46E5' };
      case 'OUT_FOR_DELIVERY':
        return { bg: '#FCE7F3', text: '#DB2777' };
      case 'DELIVERED':
        return { bg: '#D1FAE5', text: '#059669' };
      case 'CANCELLED':
        return { bg: '#FEE2E2', text: '#DC2626' };
      default:
        return { bg: '#F1F5F9', text: '#475569' };
    }
  };

  return (
    <View style={styles.container}>
      {/* HEADER BAR */}
      <View style={styles.topHeader}>
        <View style={styles.titleRow}>
          <ShoppingBag size={22} color={COLORS.primary} style={{ marginRight: 8 }} />
          <Text style={styles.headerTitle}>Live Orders ({orders.length})</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={fetchOrdersSilent}>
          <Clock size={16} color={COLORS.primary} />
        </Pressable>
      </View>

      {/* SEARCH BAR */}
      <View style={styles.searchSection}>
        <View style={styles.searchInputWrap}>
          <Search size={16} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Order ID, customer, or phone..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')}>
              <X size={16} color={COLORS.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* STATUS TABS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScrollContainer}
        contentContainerStyle={styles.tabsScrollContent}
      >
        {(
          [
            { key: 'ALL', label: 'All Orders' },
            { key: 'PLACED', label: 'Placed' },
            { key: 'PREPARING', label: 'Packing' },
            { key: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
            { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
            { key: 'DELIVERED', label: 'Delivered' },
            { key: 'CANCELLED', label: 'Cancelled' },
          ] as const
        ).map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tabChip, activeTab === tab.key && styles.tabChipActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ORDERS LIST */}
      {filteredOrders.length === 0 ? (
        <View style={styles.emptyBox}>
          <ShoppingBag size={36} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No orders in this status</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const badge = getStatusBadgeStyle(item.status);
            return (
              <View style={styles.orderCard}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.orderId}>{item.id}</Text>
                    <Text style={styles.timeText}>{item.created_at}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusText, { color: badge.text }]}>{item.status}</Text>
                  </View>
                </View>

                {/* Customer Details */}
                <View style={styles.customerBox}>
                  <Text style={styles.custName}>Customer: {item.customer_name || 'Customer'}</Text>
                  <View style={styles.detailRow}>
                    <Phone size={12} color={COLORS.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={styles.detailText}>+91 {item.customer_phone || '9999900000'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MapPin size={12} color={COLORS.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={styles.detailText} numberOfLines={1}>
                      {item.address}
                    </Text>
                  </View>

                  {/* Assigned Rider Info Banner */}
                  {(item.rider_name || item.status === 'READY_FOR_PICKUP' || item.status === 'OUT_FOR_DELIVERY') && (
                    <View style={styles.riderBannerRow}>
                      <Bike size={13} color="#0066FF" style={{ marginRight: 5 }} />
                      <Text style={styles.riderBannerText} numberOfLines={1}>
                        Rider: <Text style={styles.riderNameBold}>{item.rider_name || 'Karthik Rider'}</Text>
                        <Text style={{ color: COLORS.textSecondary }}> (+91 {item.rider_phone || '9876543210'})</Text>
                      </Text>
                    </View>
                  )}
                </View>

                {/* Items List */}
                <View style={styles.itemsContainer}>
                  {(item.items || []).map((it, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <Text style={styles.itemQty}>{it.quantity}x</Text>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {it.name}
                      </Text>
                      <Text style={styles.itemPrice}>₹{it.price * it.quantity}</Text>
                    </View>
                  ))}
                </View>

                {/* Payment & Total */}
                <View style={styles.paymentRow}>
                  <View style={styles.payBadge}>
                    <CreditCard size={12} color={COLORS.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={styles.payText}>
                      {item.payment_method} • {item.payment_status}
                    </Text>
                  </View>
                  <Text style={styles.totalText}>Total: ₹{item.total}</Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.cardActions}>
                  <Pressable
                    style={styles.printQuickBtn}
                    onPress={() => handlePrintPackingSlip(item)}
                  >
                    <Printer size={14} color="#0066FF" style={{ marginRight: 4 }} />
                    <Text style={styles.printQuickBtnText}>Print</Text>
                  </Pressable>

                  <Pressable
                    style={styles.slipBtn}
                    onPress={() => setSelectedPackingSlip(item)}
                  >
                    <FileText size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
                    <Text style={styles.slipBtnText}>Slip</Text>
                  </Pressable>

                  {(item.status === 'READY_FOR_PICKUP' || item.status === 'OUT_FOR_DELIVERY' || item.rider_name || item.rider_id) && (
                    <Pressable
                      style={styles.reassignBtn}
                      onPress={() => setSelectedReassignOrder(item)}
                    >
                      <UserCheck size={14} color="#0066FF" style={{ marginRight: 4 }} />
                      <Text style={styles.reassignBtnText}>Reassign</Text>
                    </Pressable>
                  )}

                  {item.status === 'PLACED' && (
                    <Pressable
                      style={styles.acceptBtn}
                      onPress={() => handleUpdateStatus(item.id, 'PREPARING')}
                    >
                      <PackageCheck size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.actionBtnText}>Accept & Pack</Text>
                    </Pressable>
                  )}

                  {item.status === 'PREPARING' && (
                    <Pressable
                      style={styles.readyBtn}
                      onPress={() => handleUpdateStatus(item.id, 'READY_FOR_PICKUP')}
                    >
                      <CheckCircle size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.actionBtnText}>Mark Ready</Text>
                    </Pressable>
                  )}

                  {item.status === 'READY_FOR_PICKUP' && (
                    <Pressable
                      style={styles.dispatchBtn}
                      onPress={() => handleUpdateStatus(item.id, 'OUT_FOR_DELIVERY')}
                    >
                      <Truck size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.actionBtnText}>Handover Rider</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* PACKING SLIP MODAL */}
      <Modal visible={!!selectedPackingSlip} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.slipContainer}>
            <View style={styles.slipHeader}>
              <Text style={styles.slipTitle}>Merchant Packing Slip</Text>
              <Pressable onPress={() => setSelectedPackingSlip(null)}>
                <X size={20} color={COLORS.text} />
              </Pressable>
            </View>

            {selectedPackingSlip ? (
              <ScrollView contentContainerStyle={styles.slipBody} showsVerticalScrollIndicator={false}>
                {/* Store Header */}
                <View style={styles.slipStoreCard}>
                  <Text style={styles.slipStoreTitle}>GRABIT SUPERMARKET #4</Text>
                  <Text style={styles.slipStoreSub}>Vendor Fulfillment Center • Dark Store #882</Text>
                  <Text style={styles.slipOrderTag}>ORDER REF: {selectedPackingSlip.id}</Text>
                </View>

                {/* Customer Details */}
                <View style={styles.slipSection}>
                  <Text style={styles.slipSectionTitle}>Customer & Dispatch Info</Text>
                  <Text style={styles.slipText}>Name: {selectedPackingSlip.customer_name}</Text>
                  <Text style={styles.slipText}>Phone: +91 {selectedPackingSlip.customer_phone}</Text>
                  <Text style={styles.slipText}>Address: {selectedPackingSlip.address}</Text>
                </View>

                {/* Items List */}
                <View style={styles.slipSection}>
                  <Text style={styles.slipSectionTitle}>Order Items Checklist</Text>
                  {(selectedPackingSlip.items || []).map((it, idx) => (
                    <View key={idx} style={styles.slipItemRow}>
                      <Text style={styles.slipItemQty}>[  ] {it.quantity}x</Text>
                      <Text style={styles.slipItemName}>{it.name}</Text>
                      <Text style={styles.slipItemVal}>₹{it.price * it.quantity}</Text>
                    </View>
                  ))}
                  <View style={styles.slipTotalRow}>
                    <Text style={styles.slipTotalLbl}>Subtotal:</Text>
                    <Text style={styles.slipTotalVal}>₹{selectedPackingSlip.subtotal}</Text>
                  </View>
                  <View style={styles.slipTotalRow}>
                    <Text style={styles.slipTotalLbl}>Delivery Fee:</Text>
                    <Text style={styles.slipTotalVal}>₹{selectedPackingSlip.delivery_fee}</Text>
                  </View>
                  <View style={[styles.slipTotalRow, { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 4, marginTop: 4 }]}>
                    <Text style={styles.slipFinalLbl}>Total Payable:</Text>
                    <Text style={styles.slipFinalVal}>₹{selectedPackingSlip.total}</Text>
                  </View>
                </View>

                {/* Barcode & Verification */}
                <View style={styles.barcodeBox}>
                  <Text style={styles.barcodeCode}>||| | |||| | ||| |||| | |||</Text>
                  <Text style={styles.barcodeSub}>SCAN TO CONFIRM PACKING</Text>
                </View>

                <View style={styles.slipActionsRow}>
                  <Pressable
                    style={styles.printSlipBtn}
                    onPress={() => handlePrintPackingSlip(selectedPackingSlip)}
                  >
                    <Printer size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.printSlipText}>Print Order Slip</Text>
                  </Pressable>

                  <Pressable
                    style={styles.shareSlipOutlineBtn}
                    onPress={() => handleSharePackingSlip(selectedPackingSlip)}
                  >
                    <Share2 size={16} color="#0066FF" style={{ marginRight: 6 }} />
                    <Text style={styles.shareSlipOutlineText}>Share Text</Text>
                  </Pressable>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* REASSIGN RIDER MODAL */}
      <Modal visible={!!selectedReassignOrder} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.reassignModalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Bike size={18} color="#0066FF" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Reassign Rider ({selectedReassignOrder?.id})</Text>
              </View>
              <Pressable onPress={() => setSelectedReassignOrder(null)}>
                <X size={20} color={COLORS.text} />
              </Pressable>
            </View>

            <Text style={styles.reassignSubTitle}>
              Select an available delivery partner to handover order package:
            </Text>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {fleetRiders.length === 0 ? (
                <View style={{ alignItems: 'center', padding: 24 }}>
                  <Text style={{ color: COLORS.textMuted, fontSize: 13, fontWeight: '600' }}>No riders available at the moment.</Text>
                </View>
              ) : fleetRiders.map((r) => {
                const isCurrent =
                  selectedReassignOrder?.rider_id === r.id ||
                  selectedReassignOrder?.rider_name === r.name;
                return (
                  <Pressable
                    key={r.id}
                    style={[styles.riderRow, isCurrent && styles.riderRowSelected]}
                    onPress={() => handleAssignRider(selectedReassignOrder!, r)}
                  >
                    <View style={styles.riderAvatar}>
                      <Bike size={18} color={isCurrent ? '#0066FF' : '#475569'} />
                    </View>

                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={[styles.riderName, isCurrent && styles.riderNameSelected]}>{r.name}</Text>
                        {isCurrent ? (
                          <View style={styles.currentBadge}>
                            <Text style={styles.currentBadgeText}>Assigned</Text>
                          </View>
                        ) : (
                          <Text style={styles.riderRating}>★ {r.rating}</Text>
                        )}
                      </View>

                      <Text style={styles.riderSubText}>
                        {r.vehicle} &bull; {r.distance}
                      </Text>
                      <Text style={styles.riderPhoneText}>+91 {r.phone}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  refreshBtn: {
    padding: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
  },
  searchSection: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    backgroundColor: '#FFFFFF',
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  tabsScrollContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabsScrollContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabChip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.background,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  tabChipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primaryBorder,
  },
  tabText: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: 16,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  listContent: {
    padding: SPACING.md,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  orderId: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
  },
  timeText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  customerBox: {
    paddingVertical: 8,
  },
  custName: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  detailText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  itemsContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 8,
    marginVertical: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  itemQty: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    width: 24,
  },
  itemName: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text,
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
  },
  payBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  payText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  totalText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  slipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    marginRight: 8,
  },
  slipBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  readyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.success,
  },
  dispatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#8B5CF6',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 8,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  slipContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    padding: SPACING.md,
  },
  slipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  slipTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  slipBody: {
    paddingVertical: 12,
  },
  slipStoreCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  slipStoreTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
  },
  slipStoreSub: {
    fontSize: 11,
    color: COLORS.primaryDark,
    marginTop: 2,
    fontWeight: '600',
  },
  slipOrderTag: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
    marginTop: 6,
  },
  slipSection: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  slipSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
  },
  slipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginVertical: 1,
  },
  slipItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  slipItemQty: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    width: 45,
  },
  slipItemName: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text,
  },
  slipItemVal: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  slipTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  slipTotalLbl: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  slipTotalVal: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  slipFinalLbl: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
  },
  slipFinalVal: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primary,
  },
  barcodeBox: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginVertical: 8,
  },
  barcodeCode: {
    fontSize: 18,
    letterSpacing: 2,
    fontWeight: '900',
    color: '#000',
  },
  barcodeSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  slipActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  printSlipBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0066FF',
    borderRadius: 10,
    height: 46,
    marginRight: 8,
    ...SHADOWS.sm,
  },
  printSlipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  shareSlipOutlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#0066FF',
    borderRadius: 10,
    height: 46,
  },
  shareSlipOutlineText: {
    color: '#0066FF',
    fontSize: 14,
    fontWeight: '700',
  },
  printQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    marginRight: 6,
  },
  printQuickBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0066FF',
  },
  reassignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0066FF',
    marginRight: 6,
  },
  reassignBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0066FF',
  },
  riderBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  riderBannerText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  riderNameBold: {
    fontWeight: '800',
    color: COLORS.text,
  },
  reassignModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: SPACING.md,
    width: '100%',
    maxHeight: '80%',
    ...SHADOWS.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  reassignSubTitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  riderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  riderRowSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0066FF',
    borderWidth: 1.5,
  },
  riderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  riderName: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  riderNameSelected: {
    color: '#0066FF',
  },
  riderSubText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  riderPhoneText: {
    fontSize: 10.5,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  riderRating: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  currentBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
});
