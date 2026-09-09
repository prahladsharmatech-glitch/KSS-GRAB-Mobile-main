import { getItem, setItem } from '../services/storage';
import { get } from '../services/api';

export interface UserNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  created_at: string;
  link?: string;
  category?: 'active' | 'orders' | 'promo' | 'system' | string;
  statusBadge?: string;
  statusColor?: string;
  statusBg?: string;
  iconType?: 'package' | 'truck' | 'refund' | 'security' | string;
  unread: boolean;
  orderId?: string;
  actionText?: string;
}

const getStorageKey = (phone?: string) => {
  const digits = (phone || '').replace(/\D/g, '');
  const cleanPhone = digits.length >= 10 ? digits.slice(-10) : digits;
  return cleanPhone ? `grabit_user_notifications_${cleanPhone}` : 'grabit_user_notifications_guest';
};

const formatTimeAgo = (dateStr?: string) => {
  if (!dateStr) return 'Just now';
  const now = Date.now();
  const created = new Date(dateStr).getTime();
  const diffMs = now - created;
  if (isNaN(created) || diffMs < 60000) return 'Just now';
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

export async function getRealUserNotifications(phone?: string): Promise<UserNotification[]> {
  try {
    const storageKey = getStorageKey(phone);
    let notifs = await getItem<UserNotification[]>(storageKey);

    const readIds = (await getItem<string[]>('grabit_read_notifications')) || [];
    const dismissedIds = (await getItem<string[]>('grabit_dismissed_notifications')) || [];

    // If notifications list is empty, sync from real orders
    if (!notifs || !Array.isArray(notifs) || notifs.length === 0) {
      const digits = (phone || '').replace(/\D/g, '');
      const cleanPhone = digits.length >= 10 ? digits.slice(-10) : digits;
      const orderStorageKey = cleanPhone ? `grabit_orders_${cleanPhone}` : 'grabit_orders';

      const [localOrders, globalOrders] = await Promise.all([
        getItem<any[]>(orderStorageKey),
        getItem<any[]>('grabit_orders'),
      ]);

      let ordersList = [...(localOrders || []), ...(globalOrders || [])];

      if (ordersList.length === 0) {
        const fetchPath = cleanPhone ? `/orders/user/${cleanPhone}` : '/orders/';
        const apiRes = await get<any[]>(fetchPath).catch(() => []);
        if (Array.isArray(apiRes) && apiRes.length > 0) {
          ordersList = apiRes;
        }
      }

      if (ordersList.length > 0) {
        const uniqueOrdersMap = new Map<string, any>();
        ordersList.forEach((o) => {
          const rawId = String(o.id || o.rawId || o.order_number || o.orderNumber || '');
          if (rawId && !uniqueOrdersMap.has(rawId)) {
            uniqueOrdersMap.set(rawId, o);
          }
        });

        const generated: UserNotification[] = Array.from(uniqueOrdersMap.values()).map((o, idx) => {
          const cleanDisplayId = String(o.orderNumber || o.order_number || o.id || '').replace(/^GB-?/i, '');
          const formattedId = cleanDisplayId.length > 5 ? cleanDisplayId.slice(0, 8).toUpperCase() : cleanDisplayId.toUpperCase() || '4B9385F1';
          const orderNum = `ORD-${formattedId}`;
          const st = String(o.status || 'placed').toLowerCase();

          let title = 'Order Placed';
          let message = `Order #${orderNum} received. Store is preparing your items.`;
          let statusBadge = '⚡ ~15-20 min';
          let iconType: 'package' | 'truck' | 'refund' = 'package';
          let statusColor = '#0071E3';
          let statusBg = '#EFF6FF';

          if (st === 'delivered') {
            title = 'Order Delivered';
            message = `Order #${orderNum} delivered safely to your address.`;
            statusBadge = '✓ Delivered';
            iconType = 'package';
            statusColor = '#10B981';
            statusBg = '#ECFDF5';
          } else if (st === 'out_for_delivery' || st === 'out-for-delivery' || st === 'picked_up') {
            title = 'Out for Delivery';
            message = `Order #${orderNum} is on the way with your rider.`;
            statusBadge = '🛵 ~5-10 min';
            iconType = 'truck';
            statusColor = '#0071E3';
            statusBg = '#EFF6FF';
          } else if (st === 'cancelled') {
            title = 'Order Cancelled';
            message = `Order #${orderNum} was cancelled. Refund processed.`;
            statusBadge = '✕ Refund Credited';
            iconType = 'refund';
            statusColor = '#DC2626';
            statusBg = '#FEF2F2';
          }

          return {
            id: `notif-order-${o.id || idx}`,
            title,
            message,
            time: formatTimeAgo(o.created_at),
            created_at: o.created_at || new Date().toISOString(),
            link: `/customer/order/${o.rawId || o.id}`,
            category: 'active',
            statusBadge,
            statusColor,
            statusBg,
            iconType,
            unread: idx === 0,
            orderId: o.rawId || o.id,
          };
        });

        notifs = generated;
        await setItem(storageKey, generated);
      }
    }

    if (!notifs || !Array.isArray(notifs)) return [];

    return notifs
      .filter((n) => n && n.id && !dismissedIds.includes(n.id))
      .map((n) => ({
        ...n,
        time: formatTimeAgo(n.created_at),
        unread: !readIds.includes(n.id),
      }));
  } catch (err) {
    console.warn('getRealUserNotifications error:', err);
    return [];
  }
}

export async function addUserNotification({
  title = 'Order Placed',
  message = '',
  link = '/customer/orders',
  category = 'active',
  statusBadge = '⚡ ~15-20 min',
  statusColor = '#0071E3',
  statusBg = '#EFF6FF',
  iconType = 'package',
  orderId = '',
  phone = '',
}: {
  title?: string;
  message?: string;
  link?: string;
  category?: string;
  statusBadge?: string;
  statusColor?: string;
  statusBg?: string;
  iconType?: 'package' | 'truck' | 'refund' | 'security' | string;
  orderId?: string;
  phone?: string;
}) {
  try {
    const storageKey = getStorageKey(phone);
    const existing = (await getItem<UserNotification[]>(storageKey)) || [];

    let cleanOrderId = orderId;
    if (cleanOrderId && cleanOrderId.length > 10 && cleanOrderId.includes('-')) {
      cleanOrderId = `ORD-${cleanOrderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}`;
    }

    const newNotif: UserNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      message: cleanOrderId && message.includes(orderId) ? message.replace(orderId, cleanOrderId) : message,
      time: 'Just now',
      created_at: new Date().toISOString(),
      link,
      category,
      statusBadge,
      statusColor,
      statusBg,
      iconType,
      unread: true,
      orderId,
    };

    const updated = [newNotif, ...existing.filter((n) => n.id !== newNotif.id)].slice(0, 20);
    await setItem(storageKey, updated);
  } catch (err) {
    console.warn('addUserNotification error:', err);
  }
}

export async function markNotificationAsRead(id: string) {
  if (!id) return;
  try {
    const existing = (await getItem<string[]>('grabit_read_notifications')) || [];
    if (!existing.includes(id)) {
      await setItem('grabit_read_notifications', [...existing, id]);
    }
  } catch (err) {
    console.warn('markNotificationAsRead error:', err);
  }
}

export async function markAllNotificationsAsRead(phone?: string) {
  try {
    const notifs = await getRealUserNotifications(phone);
    const ids = notifs.map((n) => n.id);
    await setItem('grabit_read_notifications', ids);
  } catch (err) {
    console.warn('markAllNotificationsAsRead error:', err);
  }
}

export async function dismissNotification(id: string, phone?: string) {
  if (!id) return;
  try {
    const existingDismissed = (await getItem<string[]>('grabit_dismissed_notifications')) || [];
    if (!existingDismissed.includes(id)) {
      await setItem('grabit_dismissed_notifications', [...existingDismissed, id]);
    }

    const storageKey = getStorageKey(phone);
    const notifs = (await getItem<UserNotification[]>(storageKey)) || [];
    const updated = notifs.filter((n) => n.id !== id);
    await setItem(storageKey, updated);
  } catch (err) {
    console.warn('dismissNotification error:', err);
  }
}

export async function clearAllNotifications(phone?: string) {
  try {
    const storageKey = getStorageKey(phone);
    await Promise.all([
      setItem(storageKey, []),
      setItem('grabit_read_notifications', []),
      setItem('grabit_dismissed_notifications', []),
    ]);
  } catch (err) {
    console.warn('clearAllNotifications error:', err);
  }
}
