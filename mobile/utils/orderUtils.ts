/**
 * Unified Order ID formatting utility for GrabIt.
 * Guarantees 100% consistent order ID formatting (e.g. GB-6ECD7D) across:
 * Customer Portal, Seller Portal, Rider Portal, Admin Portal, and Notifications.
 */
export function formatDisplayOrderId(orderOrId: any): string {
  if (!orderOrId) return 'GB-000000';
  let str = '';
  if (typeof orderOrId === 'string') {
    str = orderOrId;
  } else if (typeof orderOrId === 'object') {
    str = String(orderOrId.order_number || orderOrId.orderNumber || orderOrId.displayId || orderOrId.id || orderOrId.rawId || '');
  }
  const clean = str.replace(/^(GB|ORD)-?/i, '').replace(/[^a-zA-Z0-9]/g, '');
  if (!clean) return 'GB-000000';
  const code = clean.length >= 6 ? clean.slice(0, 6).toUpperCase() : clean.toUpperCase();
  return `GB-${code}`;
}

export function isSameOrderId(order1: any, order2: any): boolean {
  if (!order1 || !order2) return false;
  const id1 = typeof order1 === 'string' ? order1 : String(order1.id || order1.rawId || order1.order_number || '');
  const id2 = typeof order2 === 'string' ? order2 : String(order2.id || order2.rawId || order2.order_number || '');
  if (!id1 || !id2) return false;
  if (id1.toLowerCase() === id2.toLowerCase()) return true;

  const clean1 = id1.replace(/^(GB|ORD)-?/i, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const clean2 = id2.replace(/^(GB|ORD)-?/i, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (clean1 && clean2) {
    if (clean1 === clean2) return true;
    if (clean1.length >= 6 && clean2.length >= 6 && clean1.slice(0, 6) === clean2.slice(0, 6)) return true;
  }
  return false;
}
