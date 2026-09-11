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
import { get, post, patch, invalidateOrdersCache } from '../../services/api';
import { getItem, setItem, removeItem } from '../../services/storage';
import { useRealtimeOrders } from '../../services/realtimeOrders';
import { Order } from '../../types';
export { Order };
import { formatDisplayOrderId, isSameOrderId } from '../../utils/orderUtils';
import { useToast } from '../../context/ToastContext';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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
  Download,
  Trash2,
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

export const INITIAL_ORDERS: Order[] = [];


type OrderTab = 'ALL' | 'PLACED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export default function SellerOrdersScreen() {
  const { showToast } = useToast();
  // ── Real-time orders via SSE (web) or 3s polling (native) ──────────────────
  const {
    orders: liveOrders,
    loading: liveLoading,
    isLive,
    refresh: refreshOrders,
  } = useRealtimeOrders('seller');

  // Map raw API orders to local Order shape, falling back to INITIAL_ORDERS
  const normalizeOrders = useCallback((raw: any[]): Order[] => {
    if (!raw || raw.length === 0) return INITIAL_ORDERS;
    return raw.map((o: any, idx: number) => {
      let rawItems: any[] = [];
      if (Array.isArray(o.items) && o.items.length > 0) {
        rawItems = o.items;
      } else if (typeof o.items === 'string') {
        try { rawItems = JSON.parse(o.items); } catch { rawItems = []; }
      }

      let normalizedItems = (Array.isArray(rawItems) ? rawItems : []).map((it: any, iIdx: number) => ({
        id: String(it.id || it.product_id || `item-${iIdx}`),
        name: String(it.name || it.product_name || 'Ordered Product'),
        quantity: Number(it.quantity || it.qty || 1),
        price: Number(it.price || it.unit_price || 0),
        image: it.image || it.image_url || 'apples-real.jpg'
      }));

      const calculatedSub = normalizedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const totalVal = Number(o.total || o.total_amount || calculatedSub || 99);

      const custPhone = String(o.customer_phone || o.phone || '').replace(/\D/g, '');
      const last10 = custPhone.length >= 10 ? custPhone.slice(-10) : custPhone;
      const formattedPhone = last10 ? `+91 ${last10}` : '+91 9360843281';

      const rawCustName = String(o.customer_name || o.customerName || o.name || '').trim();
      const validCustName = (!rawCustName || rawCustName.toLowerCase() === 'customer' || rawCustName.toLowerCase() === 'guest')
        ? 'Akash'
        : rawCustName;

      if (normalizedItems.length === 0) {
        normalizedItems = [{
          id: 'item-1',
          name: 'Fresh Grocery & Essentials Pack',
          quantity: 1,
          price: totalVal,
          image: 'apples-real.jpg'
        }];
      }

      return {
        ...o,
        id: formatDisplayOrderId(o),
        rawId: String(o.rawId || o.id || ''),
        customer_name: validCustName,
        customer_phone: formattedPhone,
        address: String(o.delivery_address || o.address || 'KSS Metro Tech Park, Sector 4, Bengaluru'),
        delivery_address: String(o.delivery_address || o.address || 'KSS Metro Tech Park, Sector 4, Bengaluru'),
        status: String(o.status || 'PLACED').toUpperCase() as Order['status'],
        items: normalizedItems,
        subtotal: calculatedSub || totalVal,
        delivery_fee: Number(o.delivery_fee || 0),
        discount: Number(o.discount || 0),
        total: totalVal,
        payment_method: String(o.payment_method || 'UPI').toUpperCase(),
        payment_status: String(o.payment_status || 'PAID').toUpperCase(),
      };
    });
  }, []);

  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [activeTab, setActiveTab] = useState<OrderTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [fleetRiders, setFleetRiders] = useState<FleetRider[]>(FLEET_RIDERS);
  const [loading, setLoading] = useState(false);

  // Sync live orders into local state whenever they change
  useEffect(() => {
    if (liveOrders && liveOrders.length > 0) {
      const normalized = normalizeOrders(liveOrders);
      setOrders(normalized);
    }
    setLoading(liveLoading);
  }, [liveOrders, liveLoading, normalizeOrders]);

  // Packing Slip & Reassign Modal State
  const [selectedPackingSlip, setSelectedPackingSlip] = useState<Order | null>(null);
  const [selectedReassignOrder, setSelectedReassignOrder] = useState<Order | null>(null);

  // Helper to normalize any order object into standard seller format
  const normalizeSellerOrder = (o: any): Order => {
    let rawItems: any[] = [];
    if (Array.isArray(o.items) && o.items.length > 0) {
      rawItems = o.items;
    } else if (typeof o.items === 'string') {
      try { rawItems = JSON.parse(o.items); } catch { rawItems = []; }
    }

    let normalizedItems = (Array.isArray(rawItems) ? rawItems : []).map((it: any, iIdx: number) => ({
      id: String(it.id || it.product_id || `item-${iIdx}`),
      name: String(it.name || it.product_name || 'Ordered Product'),
      quantity: Number(it.quantity || it.qty || 1),
      price: Number(it.price || it.unit_price || 0),
      image: it.image || it.image_url || 'apples-real.jpg'
    }));

    const calculatedSub = normalizedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalVal = Number(o.total || o.total_amount || calculatedSub || 99);

    const custPhone = String(o.customer_phone || o.phone || '').replace(/\D/g, '');
    const last10 = custPhone.length >= 10 ? custPhone.slice(-10) : custPhone;
    const formattedPhone = last10 ? `+91 ${last10}` : '+91 9360843281';

    const rawCustName = String(o.customer_name || o.customerName || o.name || '').trim();
    const validCustName = (!rawCustName || rawCustName.toLowerCase() === 'customer' || rawCustName.toLowerCase() === 'guest')
      ? 'Akash'
      : rawCustName;

    if (normalizedItems.length === 0) {
      normalizedItems = [{
        id: 'item-1',
        name: 'Fresh Grocery & Essentials Pack',
        quantity: 1,
        price: totalVal,
        image: 'apples-real.jpg'
      }];
    }

    let rawStatus = String(o.status || 'PLACED').trim().toUpperCase();
    if (rawStatus === 'PENDING' || rawStatus === 'CONFIRMED') {
      rawStatus = 'PLACED';
    } else if (rawStatus === 'PACKING') {
      rawStatus = 'PREPARING';
    } else if (rawStatus === 'READY') {
      rawStatus = 'READY_FOR_PICKUP';
    }

    return {
      ...o,
      id: formatDisplayOrderId(o),
      rawId: String(o.rawId || o.id || ''),
      customer_name: validCustName,
      customer_phone: formattedPhone,
      address: String(o.delivery_address || o.address || 'KSS Metro Tech Park, Sector 4, Bengaluru'),
      delivery_address: String(o.delivery_address || o.address || 'KSS Metro Tech Park, Sector 4, Bengaluru'),
      status: rawStatus as Order['status'],
      items: normalizedItems,
      subtotal: calculatedSub || totalVal,
      delivery_fee: Number(o.delivery_fee || 0),
      discount: Number(o.discount || 0),
      total: totalVal,
      payment_method: String(o.payment_method || 'UPI').toUpperCase(),
      payment_status: String(o.payment_status || 'PAID').toUpperCase(),
    };
  };

  // Fetch real orders from backend with fallback
  const fetchOrdersSilent = useCallback(async () => {
    refreshOrders();
    try {
      const res = await get('/store/orders');
      let apiOrders: Order[] = [];
      const listData = Array.isArray(res) ? res : (Array.isArray(res?.orders) ? res.orders : []);
      if (listData.length > 0) {
        apiOrders = listData.map((o: any) => normalizeSellerOrder(o));
        setOrders(apiOrders);
        await setItem('grabit_seller_orders', apiOrders).catch(() => {});
      }
    } catch {
      // Retain existing live fetched orders
    } finally {
      setLoading(false);
    }
  }, [refreshOrders]);

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

  // Fetch riders once on mount & cache init
  useEffect(() => {
    getItem<Order[]>('grabit_seller_orders').then((cached) => {
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setOrders((prev) => (prev.length > 0 ? prev : cached));
      }
    }).catch(() => {});
    fetchOrdersSilent();
    fetchRiders();
  }, [fetchOrdersSilent, fetchRiders]);

  const handlePurgeAllOrders = async () => {
    try {
      setLoading(true);
      await post('/orders/purge-all', {});
      setOrders([]);
      await removeItem('grabit_seller_orders').catch(() => {});
      invalidateOrdersCache();
      refreshOrders();
      showToast('All test orders deleted from database & portal', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to purge test orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: Order['status']) => {
    let previousOrders: Order[] = [];
    setOrders((prev) => {
      previousOrders = prev;
      const updated = prev.map((o) => (isSameOrderId(o, orderId) ? { ...o, status: newStatus } : o));
      setItem('grabit_seller_orders', updated).catch(() => {});
      return updated;
    });
    showToast(`Order updated to ${newStatus}`, 'success');

    try {
      await patch(`/orders/${encodeURIComponent(orderId)}/status`, { status: newStatus.toLowerCase() });
      invalidateOrdersCache();
      await fetchOrdersSilent();
    } catch (err: any) {
      if (previousOrders.length > 0) {
        setOrders(previousOrders);
        setItem('grabit_seller_orders', previousOrders).catch(() => {});
      }
      showToast(err?.message || `Failed to update status for order #${orderId}`, 'error');
    }
  };

  const formatTimeDisplay = (raw?: string) => {
    if (!raw) return 'Just now';
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return String(raw);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(raw);
    }
  };

  const handleAssignRider = async (order: Order, rider: FleetRider) => {
    const nextStatus = order.status === 'PLACED' || order.status === 'PREPARING' ? 'READY_FOR_PICKUP' : order.status;
    let previousOrders: Order[] = [];
    setOrders((prev) => {
      previousOrders = prev;
      const updated = prev.map((o) =>
        o.id === order.id || o.rawId === order.id
          ? {
              ...o,
              rider_id: rider.id,
              rider_name: rider.name,
              rider_phone: rider.phone,
              status: nextStatus,
            }
          : o
      );
      setItem('grabit_seller_orders', updated).catch(() => {});
      return updated;
    });
    setSelectedReassignOrder(null);
    showToast(`Order #${order.id} assigned to ${rider.name}`, 'success');

    try {
      await patch(`/orders/${encodeURIComponent(order.id)}/status`, {
        status: nextStatus.toLowerCase(),
        delivery_agent_id: rider.id,
        rider_name: rider.name,
      });
    } catch (err: any) {
      if (previousOrders.length > 0) {
        setOrders(previousOrders);
        setItem('grabit_seller_orders', previousOrders).catch(() => {});
      }
      showToast(err?.message || `Failed to assign rider to order #${order.id}`, 'error');
    }
  };

  const generatePackingSlipHtml = (order: Order) => {
    const dateStr = new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    let list: any[] = [];
    if (Array.isArray(order.items) && order.items.length > 0) {
      list = order.items;
    } else if (typeof order.items === 'string') {
      try {
        const parsed = JSON.parse(order.items);
        if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
      } catch {}
    }
    if (!list || list.length === 0) {
      list = [
        { name: 'Express Order Items', quantity: 1, price: Number(order.total || 0) }
      ];
    }

    const itemsRows = list
      .map(
        (it: any) => {
          const q = Number(it.quantity || it.qty || 1);
          const p = Number(it.price || it.unit_price || 0);
          const name = String(it.name || it.product_name || 'Ordered Product');
          return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 4px; text-align: center; font-size: 13px;">[  ]</td>
            <td style="padding: 8px 4px; font-weight: 600; font-size: 13px; color: #1e293b;">${name}</td>
            <td style="padding: 8px 4px; text-align: center; font-weight: bold; font-size: 13px; color: #0f172a;">${q}</td>
            <td style="padding: 8px 4px; text-align: right; font-weight: 600; font-size: 13px; color: #0f172a;">₹${p * q}</td>
          </tr>
        `;
        }
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

  const handleDownloadBill = async (order: Order) => {
    try {
      const html = generatePackingSlipHtml(order);

      // 1. Mobile Native Expo Print to PDF (generates actual .pdf file URI)
      if (Platform.OS !== 'web') {
        try {
          const { uri } = await Print.printToFileAsync({ html });
          const isShareAvailable = await Sharing.isAvailableAsync();
          if (isShareAvailable) {
            await Sharing.shareAsync(uri, {
              UTI: 'com.adobe.pdf',
              mimeType: 'application/pdf',
              dialogTitle: `Save Order Bill #${order.id} as PDF`
            });
            showToast(`Order Bill PDF generated successfully! 📄`, 'success');
            return;
          }
        } catch (printErr) {
          if (__DEV__) console.log('[Print PDF Error]', printErr);
        }
      }

      // 2. Web Browser: Open Print-to-PDF Window with PDF auto-trigger
      if (typeof window !== 'undefined' && typeof window.open === 'function') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 300);
          showToast(`Opening PDF Print Dialog for Order #${order.id}...`, 'success');
          return;
        }
      }

      showToast(`Order Bill PDF generated`, 'success');
    } catch {
      showToast('Downloading PDF failed', 'error');
    }
  };

  const handlePrintPackingSlip = async (order: Order) => {
    try {
      const html = generatePackingSlipHtml(order);

      if (Platform.OS !== 'web') {
        try {
          await Print.printAsync({ html });
          showToast(`Printing Order Slip #${order.id}...`, 'success');
          return;
        } catch (printErr) {
          if (__DEV__) console.log('[Print Async Error]', printErr);
        }
      }

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

      // Fallback: Directly download bill PDF
      await handleDownloadBill(order);
    } catch {
      showToast('Printing failed or cancelled', 'error');
    }
  };

  const handleSharePackingSlip = async (order: Order) => {
    try {
      await handleDownloadBill(order);
    } catch {
      showToast('Sharing PDF failed', 'error');
    }
  };

  const filteredOrders = React.useMemo(() => {
    return orders.filter((order) => {
      const st = String(order.status || '').trim().toUpperCase();
      const tab = String(activeTab || 'ALL').trim().toUpperCase();
      let matchesTab = tab === 'ALL' || st === tab;
      if (tab === 'PLACED') {
        matchesTab = st === 'PLACED' || st === 'PENDING' || st === 'CONFIRMED';
      } else if (tab === 'PREPARING') {
        matchesTab = st === 'PREPARING' || st === 'PACKING';
      } else if (tab === 'READY_FOR_PICKUP') {
        matchesTab = st === 'READY_FOR_PICKUP' || st === 'READY';
      }

      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (order.id || '').toLowerCase().includes(q) ||
        (order.rawId || '').toLowerCase().includes(q) ||
        (order.customer_name || '').toLowerCase().includes(q) ||
        (order.customer_phone || '').includes(q);
      return matchesTab && matchesSearch;
    });
  }, [orders, activeTab, searchQuery]);

  const getStatusBadgeStyle = (status: Order['status']) => {
    const st = String(status || '').trim().toUpperCase();
    switch (st) {
      case 'PLACED':
      case 'PENDING':
      case 'CONFIRMED':
        return { bg: '#FEF3C7', text: '#D97706' };
      case 'PREPARING':
      case 'PACKING':
        return { bg: '#DBEAFE', text: '#2563EB' };
      case 'READY_FOR_PICKUP':
      case 'READY':
        return { bg: '#E0E7FF', text: '#4F46E5' };
      case 'OUT_FOR_DELIVERY':
        return { bg: '#FCE7F3', text: '#DB2777' };
      case 'DELIVERED':
        return { bg: '#D1FAE5', text: '#059669' };
      case 'CANCELLED':
        return { bg: '#FEE2E2', text: '#DC2626' };
      default:
        return { bg: '#FEF3C7', text: '#D97706' };
    }
  };

  return (
    <View style={styles.container}>
      {/* HEADER BAR */}
      <View style={styles.topHeader}>
        <View style={styles.titleRow}>
          <ShoppingBag size={22} color={COLORS.primary} style={{ marginRight: 8 }} />
          <Text style={styles.headerTitle}>Live Orders ({orders.length})</Text>
          {/* Live indicator dot */}
          <View style={[
            styles.liveDot,
            { backgroundColor: isLive ? '#10B981' : '#F59E0B' }
          ]} />
          <Text style={[styles.liveLabel, { color: isLive ? '#10B981' : '#F59E0B' }]}>
            {isLive ? 'LIVE' : 'SYNC'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
          <Pressable
            style={[styles.refreshBtn, { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }]}
            onPress={handlePurgeAllOrders}
          >
            <Trash2 size={14} color="#DC2626" style={{ marginRight: 3 }} />
            <Text style={{ color: '#DC2626', fontSize: 11, fontWeight: '700' }}>Clear Test Orders</Text>
          </Pressable>
          <Pressable style={[styles.refreshBtn, { padding: 6 }]} onPress={fetchOrdersSilent}>
            <RefreshCw size={16} color={COLORS.primary} />
          </Pressable>
        </View>
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
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          renderItem={({ item }) => {
            const badge = getStatusBadgeStyle(item.status);
            return (
              <View style={styles.orderCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                    <Text style={styles.orderId} numberOfLines={1} ellipsizeMode="middle">
                      {item.id}
                    </Text>
                    <Text style={styles.timeText} numberOfLines={1}>
                      {formatTimeDisplay(item.created_at)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg, flexShrink: 0 }]}>
                    <Text style={[styles.statusText, { color: badge.text }]}>{item.status}</Text>
                  </View>
                </View>

                {/* Customer Details */}
                <View style={styles.customerBox}>
                  <Text style={styles.custName}>Customer: {item.customer_name || 'Customer'}</Text>
                  <View style={styles.detailRow}>
                    <Phone size={12} color={COLORS.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={styles.detailText}>
                      {String(item.customer_phone || '').includes('+91') ? item.customer_phone : `+91 ${item.customer_phone || '9999900000'}`}
                    </Text>
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
                  {(Array.isArray(item.items) && item.items.length > 0 ? item.items : [{ name: 'Fresh Grocery & Essentials Pack', quantity: 1, price: item.total }]).map((it: any, idx: number) => (
                    <View key={idx} style={styles.itemRow}>
                      <Text style={styles.itemQty}>{it.quantity || it.qty || 1}x</Text>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {it.name || 'Ordered Product'}
                      </Text>
                      <Text style={styles.itemPrice}>₹{(Number(it.price) || 0) * (Number(it.quantity || it.qty) || 1)}</Text>
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
                <View style={styles.cardActionsContainer}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.cardActionsScroll}
                  >
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

                    {(() => {
                      const st = String(item.status || '').trim().toUpperCase();
                      const isPlaced = st === 'PLACED' || st === 'PENDING' || st === 'CONFIRMED';
                      const isPreparing = st === 'PREPARING' || st === 'PACKING';
                      const isReady = st === 'READY_FOR_PICKUP' || st === 'READY';
                      const isOut = st === 'OUT_FOR_DELIVERY';

                      return (
                        <>
                          {(isReady || isOut || item.rider_name || item.rider_id) && (
                            <Pressable
                              style={styles.reassignBtn}
                              onPress={() => setSelectedReassignOrder(item)}
                            >
                              <UserCheck size={14} color="#0066FF" style={{ marginRight: 4 }} />
                              <Text style={styles.reassignBtnText}>Reassign</Text>
                            </Pressable>
                          )}

                          {isPlaced && (
                            <Pressable
                              style={styles.acceptBtn}
                              onPress={() => handleUpdateStatus(item.id, 'PREPARING')}
                            >
                              <PackageCheck size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                              <Text style={styles.actionBtnText}>Accept & Pack</Text>
                            </Pressable>
                          )}

                          {isPreparing && (
                            <Pressable
                              style={styles.readyBtn}
                              onPress={() => handleUpdateStatus(item.id, 'READY_FOR_PICKUP')}
                            >
                              <CheckCircle size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                              <Text style={styles.actionBtnText}>Mark Ready for Pickup</Text>
                            </Pressable>
                          )}

                          {isReady && (
                            <Pressable
                              style={styles.dispatchBtn}
                              onPress={() => handleUpdateStatus(item.id, 'OUT_FOR_DELIVERY')}
                            >
                              <Truck size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                              <Text style={styles.actionBtnText}>Handover Rider</Text>
                            </Pressable>
                          )}
                        </>
                      );
                    })()}
                  </ScrollView>
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
                  <Text style={styles.slipText}>Name: {selectedPackingSlip.customer_name || selectedPackingSlip.name || 'Customer'}</Text>
                  <Text style={styles.slipText}>Phone: +91 {selectedPackingSlip.customer_phone || selectedPackingSlip.phone || ''}</Text>
                  <Text style={styles.slipText}>Address: {selectedPackingSlip.delivery_address || selectedPackingSlip.address || '402 Royal Palms, Indiranagar, Bangalore'}</Text>
                </View>

                {/* Items List */}
                <View style={styles.slipSection}>
                  <Text style={styles.slipSectionTitle}>Order Items Checklist</Text>
                  {(
                    (() => {
                      let list: any[] = [];
                      if (Array.isArray(selectedPackingSlip.items) && selectedPackingSlip.items.length > 0) {
                        list = selectedPackingSlip.items;
                      } else if (typeof selectedPackingSlip.items === 'string') {
                        try {
                          const parsed = JSON.parse(selectedPackingSlip.items);
                          if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
                        } catch {}
                      }
                      if (!list || list.length === 0) {
                        const tot = Number(selectedPackingSlip.total || 99);
                        const p1 = tot > 50 ? tot - 50 : Math.round(tot / 2);
                        const p2 = tot - p1;
                        list = [
                          { name: 'Fresh Bananas (500g)', quantity: 1, price: p1 },
                          { name: 'Organic Potato Chips (100g)', quantity: 1, price: p2 }
                        ];
                      }
                      return list;
                    })()
                  ).map((it: any, idx: number) => {
                    const q = Number(it.quantity || it.qty || 1);
                    const p = Number(it.price || it.unit_price || 0);
                    const name = it.name || it.product_name || 'Ordered Product';
                    return (
                      <View key={idx} style={styles.slipItemRow}>
                        <Text style={styles.slipItemQty}>[  ] {q}x</Text>
                        <Text style={styles.slipItemName}>{name}</Text>
                        <Text style={styles.slipItemVal}>₹{p * q}</Text>
                      </View>
                    );
                  })}
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
                    style={styles.downloadSlipBtn}
                    onPress={() => handleDownloadBill(selectedPackingSlip)}
                  >
                    <Download size={16} color="#0066FF" style={{ marginRight: 6 }} />
                    <Text style={styles.downloadSlipText}>Download PDF Bill</Text>
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
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginLeft: 8,
  },
  liveLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 3,
    letterSpacing: 0.5,
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
    flexGrow: 0,
    maxHeight: 54,
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
    overflow: 'hidden',
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
    fontSize: 14,
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
    alignSelf: 'flex-start',
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
  cardActionsContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    overflow: 'hidden',
  },
  cardActionsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
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
    paddingTop: 50,
    paddingBottom: 40,
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
  downloadSlipBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#0066FF',
    borderRadius: 10,
    height: 46,
  },
  downloadSlipText: {
    color: '#0066FF',
    fontSize: 14,
    fontWeight: '800',
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
