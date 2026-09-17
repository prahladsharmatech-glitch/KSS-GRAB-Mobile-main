/**
 * Unified Order ID formatting utility for GrabIt.
 * Guarantees 100% consistent order ID formatting (e.g. GB-A3F1E7) across:
 * Customer Portal, Seller Portal, Rider Portal, Admin Portal, and Notifications.
 *
 * Strategy: Always derive the display alias from the canonical UUID (rawId/id).
 * The backend uses the first 6 hex chars of the UUID (dashes stripped) as the
 * display code, e.g. UUID "a3f1e7b2-..." → "GB-A3F1E7".
 * This function mirrors that logic so ALL portals show the same ID.
 */
export function formatDisplayOrderId(orderOrId: any): string {
  if (!orderOrId) return 'GB-000000';

  let uuidStr = '';
  let displayStr = '';

  if (typeof orderOrId === 'string') {
    displayStr = orderOrId;
  } else if (typeof orderOrId === 'object') {
    displayStr = String(
      orderOrId.display_id ||
      orderOrId.displayId ||
      orderOrId.order_number ||
      orderOrId.orderNumber ||
      orderOrId.rawId ||
      orderOrId.id ||
      orderOrId.order_id ||
      ''
    );
  }

  // If we have a valid UUID, derive display from its first 6 hex chars (same as backend)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidStr && uuidPattern.test(uuidStr.trim())) {
    const hex6 = uuidStr.replace(/-/g, '').slice(0, 6).toUpperCase();
    return `GB-${hex6}`;
  }

  // Fallback: strip any GB/ORD prefix, take first 6 alphanumeric chars
  const clean = displayStr.replace(/^(GB|ORD)-?/i, '').replace(/[^a-zA-Z0-9]/g, '');
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
