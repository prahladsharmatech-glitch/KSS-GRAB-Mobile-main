/**
 * Unified Order ID formatting and UUID generation utility for GrabIt.
 * Guarantees 100% consistent order ID formatting (e.g. GB-A3F1E7) across:
 * Customer Portal, Seller Portal, Rider Portal, Admin Portal, and Notifications.
 *
 * Strategy:
 * 1. If an order already has an assigned human-readable display ID (e.g. GB-XXXXXX),
 *    preserve it permanently so that UI data refreshes never alter the Order ID shown to the user.
 * 2. If deriving from canonical UUID (rawId/id), use the first 6 hex chars (dashes stripped)
 *    to match the backend convention: UUID "a3f1e7b2-..." -> "GB-A3F1E7".
 */

export function generateOrderUuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
    return (crypto as any).randomUUID();
  }
  const hex = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${hex()}${hex()}-${hex()}-4${hex().substring(1)}-8${hex().substring(1)}-${hex()}${hex()}${hex()}`;
}

export function formatDisplayOrderId(orderOrId: any): string {
  if (!orderOrId) return 'GB-000000';

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (typeof orderOrId === 'string') {
    const s = orderOrId.trim();
    if (/^(GB|ORD)-[a-zA-Z0-9]{4,12}$/i.test(s)) {
      return `GB-${s.replace(/^(GB|ORD)-/i, '').toUpperCase()}`;
    }
    if (uuidPattern.test(s)) {
      return `GB-${s.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
    }
    const clean = s.replace(/^(GB|ORD)-?/i, '').replace(/[^a-zA-Z0-9]/g, '');
    if (!clean) return 'GB-000000';
    return `GB-${(clean.length >= 6 ? clean.slice(0, 6) : clean).toUpperCase()}`;
  }

  if (typeof orderOrId === 'object') {
    // 1. If an explicit display ID already exists, ALWAYS preserve it!
    const existingDisplay =
      orderOrId.displayId ||
      orderOrId.display_id ||
      orderOrId.orderNumber ||
      orderOrId.order_number;

    if (existingDisplay && typeof existingDisplay === 'string') {
      const s = existingDisplay.trim();
      if (/^(GB|ORD)-[a-zA-Z0-9]{4,12}$/i.test(s)) {
        return `GB-${s.replace(/^(GB|ORD)-/i, '').toUpperCase()}`;
      }
    }

    // 2. Otherwise derive from canonical UUID (rawId or id)
    const rawId = String(orderOrId.rawId || orderOrId.id || orderOrId.order_id || '').trim();
    if (rawId && uuidPattern.test(rawId)) {
      return `GB-${rawId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
    }

    // 3. Fallback to any identifier string
    const fallbackStr = String(existingDisplay || rawId || '');
    const clean = fallbackStr.replace(/^(GB|ORD)-?/i, '').replace(/[^a-zA-Z0-9]/g, '');
    if (!clean) return 'GB-000000';
    return `GB-${(clean.length >= 6 ? clean.slice(0, 6) : clean).toUpperCase()}`;
  }

  return 'GB-000000';
}

export function isSameOrderId(order1: any, order2: any): boolean {
  if (!order1 || !order2) return false;

  const extractKeys = (item: any): string[] => {
    if (typeof item === 'string') return [item];
    if (typeof item === 'object') {
      return [
        item.id,
        item.rawId,
        item.displayId,
        item.display_id,
        item.orderNumber,
        item.order_number,
        item.order_id,
      ]
        .filter((k) => k !== undefined && k !== null && String(k).trim() !== '')
        .map((k) => String(k).trim());
    }
    return [];
  };

  const keys1 = extractKeys(order1);
  const keys2 = extractKeys(order2);

  for (const k1 of keys1) {
    for (const k2 of keys2) {
      if (k1.toLowerCase() === k2.toLowerCase()) return true;

      const clean1 = k1.replace(/^(GB|ORD)-?/i, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const clean2 = k2.replace(/^(GB|ORD)-?/i, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (clean1 && clean2) {
        if (clean1 === clean2) return true;
        if (clean1.length >= 6 && clean2.length >= 6 && clean1.slice(0, 6) === clean2.slice(0, 6)) {
          return true;
        }
      }
    }
  }

  return false;
}

