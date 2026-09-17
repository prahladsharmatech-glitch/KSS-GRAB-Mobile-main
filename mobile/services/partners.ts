import { get, post, postDirectToSupabase, fetchDirectFromSupabase } from './api';
import { getItem, setItem } from './storage';

export interface FleetRider {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  rating: number;
  distance: string;
  status?: string;
  is_online?: boolean;
  battery?: number;
}

export const BASE_FLEET_RIDERS: FleetRider[] = [
  {
    id: 'd7e8f9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2b',
    name: 'Thabee',
    phone: '+919080841727',
    vehicle: 'Electric Scooter (TN 09 AB 1234)',
    rating: 4.9,
    distance: '0.4 km away',
    status: 'AVAILABLE',
    is_online: true,
    battery: 92,
  },
  {
    id: 'd7e8f9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2a',
    name: 'Karthik Rider',
    phone: '+919999900003',
    vehicle: 'Hero Splendor (TN 01 XY 9876)',
    rating: 4.8,
    distance: '0.8 km away',
    status: 'AVAILABLE',
    is_online: true,
    battery: 88,
  },
  {
    id: 'RDR-3003',
    name: 'Rahul Sharma',
    phone: '+919876543210',
    vehicle: 'TVS NTORQ (TN 07 CA 5544)',
    rating: 4.7,
    distance: '1.2 km away',
    status: 'AVAILABLE',
    is_online: true,
    battery: 79,
  },
];

export const PARTNERS_KEY = 'grabit_partners';
export const SELLER_FLEET_KEY = 'grabit_seller_fleet_riders';

// ── Pub/Sub and Memory Cache for Instant Multi-Portal Sync ──
let cachedRiders: FleetRider[] | null = null;
let lastRidersFetchTime = 0;
let inFlightRidersPromise: Promise<FleetRider[]> | null = null;
const RIDERS_CACHE_TTL = 15000; // 15s

export const invalidateRidersCache = () => {
  cachedRiders = null;
  lastRidersFetchTime = 0;
  inFlightRidersPromise = null;
};

type PartnersListener = () => void;
const partnersListeners = new Set<PartnersListener>();

export const onPartnersUpdate = (listener: PartnersListener): (() => void) => {
  partnersListeners.add(listener);
  return () => {
    partnersListeners.delete(listener);
  };
};

export const notifyPartnersUpdated = () => {
  invalidateRidersCache();
  partnersListeners.forEach((l) => {
    try {
      l();
    } catch (e) {
      console.warn('[PartnersSync] Listener notification error:', e);
    }
  });
};

/**
 * Normalizes any raw partner/rider object into a valid FleetRider.
 */
export const normalizeFleetRider = (r: any, idx = 0): FleetRider => {
  const rid = String(r.id || r._id || r.phone || `rider_${idx}`);
  const rName = String(r.name || r.full_name || r.store_name || 'Rider');
  const rPhone = String(r.phone || '');
  const rVehicle = String(
    r.vehicle || r.vehicle_type || (r.plate_number ? `EV Scooter (${r.plate_number})` : 'EV 2-Wheeler')
  );
  const rRating = typeof r.rating === 'number' ? r.rating : 4.9;
  const rDistance = String(r.distance || '0.6 km away');
  const isOnline = Boolean(
    r.is_online || r.agent_status === 'AVAILABLE' || r.presence_status === 'PRESENT' || r.status === 'AVAILABLE' || r.status === 'PRESENT'
  );

  return {
    id: rid,
    name: rName,
    phone: rPhone,
    vehicle: rVehicle,
    rating: rRating,
    distance: rDistance,
    status: isOnline ? 'AVAILABLE' : 'BUSY',
    is_online: isOnline,
    battery: r.battery ?? 85,
  };
};

/**
 * Returns a unified, deduplicated list of riders combining:
 * 1. Base fleet defaults (BASE_FLEET_RIDERS)
 * 2. Locally persisted admin partners (grabit_partners)
 * 3. Locally persisted seller fleet riders (grabit_seller_fleet_riders)
 * 4. Live backend API (/delivery/riders)
 * 5. Direct Supabase profiles query (fallback if API unreachable)
 */
export const getSynchronizedRiders = async (): Promise<FleetRider[]> => {
  const now = Date.now();
  if (cachedRiders && now - lastRidersFetchTime < RIDERS_CACHE_TTL) {
    return cachedRiders;
  }
  if (inFlightRidersPromise) {
    return inFlightRidersPromise;
  }

  inFlightRidersPromise = (async () => {
    const ridersList: FleetRider[] = [];

    // Helper to add riders without duplication
    const addRider = (r: FleetRider) => {
      const cleanPhone = r.phone ? r.phone.replace(/\D/g, '').slice(-10) : '';
      const existingIdx = ridersList.findIndex(
        (existing) =>
          (existing.id && r.id && existing.id === r.id) ||
          (cleanPhone && existing.phone && existing.phone.replace(/\D/g, '').slice(-10) === cleanPhone)
      );
      if (existingIdx >= 0) {
        ridersList[existingIdx] = { ...ridersList[existingIdx], ...r };
      } else {
        ridersList.push(r);
      }
    };

    // 1. Seed with base fleet
    BASE_FLEET_RIDERS.forEach((r) => addRider(r));

    try {
      // 2, 3, 4. Concurrently fetch stored admin partners, seller fleet, and live API riders
      const [storedAdmin, storedSeller, apiRiders] = await Promise.all([
        getItem<any[]>(PARTNERS_KEY).catch(() => null),
        getItem<any[]>(SELLER_FLEET_KEY).catch(() => null),
        get('/delivery/riders').catch(() => null),
      ]);

      if (Array.isArray(storedAdmin)) {
        storedAdmin.forEach((p, idx) => {
          const role = String(p.role || '').toLowerCase();
          if (role === 'delivery_agent' || role === 'rider' || role === 'delivery' || role === 'delivery_partner') {
            addRider(normalizeFleetRider(p, idx));
          }
        });
      }

      if (Array.isArray(storedSeller)) {
        storedSeller.forEach((p, idx) => {
          addRider(normalizeFleetRider(p, idx));
        });
      }

      if (Array.isArray(apiRiders) && apiRiders.length > 0) {
        apiRiders.forEach((r, idx) => {
          addRider(normalizeFleetRider(r, idx));
        });
      } else {
        // 5. Fallback to Supabase query only if live backend returned nothing
        try {
          const cloudRiders = await fetchDirectFromSupabase<any[]>('delivery/riders');
          if (Array.isArray(cloudRiders) && cloudRiders.length > 0) {
            cloudRiders.forEach((r, idx) => {
              addRider(normalizeFleetRider(r, idx));
            });
          }
        } catch {}
      }
    } catch {}

    cachedRiders = ridersList;
    lastRidersFetchTime = Date.now();
    return ridersList;
  })().finally(() => {
    inFlightRidersPromise = null;
  });

  return inFlightRidersPromise;
};

/**
 * Saves a new partner from the Admin Portal into local storage, the backend database,
 * and Supabase profiles, and notifies all listeners across the app.
 */
export const savePartner = async (payload: any): Promise<any> => {
  const isRider = String(payload.role || '').toLowerCase() in {
    delivery_agent: 1,
    rider: 1,
    delivery: 1,
    delivery_partner: 1,
  };

  const partnerRecord = {
    id: payload.id || `partner-${Date.now()}`,
    name: payload.name || payload.full_name || 'Partner',
    full_name: payload.full_name || payload.name || 'Partner',
    phone: payload.phone || '',
    email: payload.email || `${payload.role || 'partner'}@grabit.local`,
    role: isRider ? 'delivery_agent' : (payload.role || 'seller'),
    status: payload.status || 'ACTIVE',
    presence_status: payload.presence_status || 'PRESENT',
    agent_status: payload.agent_status || 'AVAILABLE',
    is_online: true,
    verification_status: 'ADMIN_VERIFIED',
    partnerVerified: true,
    vehicle_type: payload.vehicle_type || (isRider ? 'EV 2-Wheeler' : undefined),
    plate_number: payload.plate_number || (isRider ? 'KA 05 EX 4321' : undefined),
    rating: payload.rating || 4.9,
    distance: payload.distance || '0.4 km away',
    created_at: new Date().toISOString(),
    ...payload,
  };

  // 1. Persist immediately to local storage (PARTNERS_KEY)
  try {
    const current = (await getItem<any[]>(PARTNERS_KEY)) || [];
    const pid = String(partnerRecord.id || '');
    const pphone = partnerRecord.phone ? partnerRecord.phone.replace(/\D/g, '').slice(-10) : '';
    const filtered = current.filter((p) => {
      if (!p) return false;
      const cleanP = p.phone ? String(p.phone).replace(/\D/g, '').slice(-10) : '';
      return String(p.id || '') !== pid && (!pphone || cleanP !== pphone);
    });
    const updated = [partnerRecord, ...filtered];
    await setItem(PARTNERS_KEY, updated);

    // If rider, also immediately update seller fleet cache
    if (isRider) {
      const normalized = normalizeFleetRider(partnerRecord);
      const currentFleet = (await getItem<FleetRider[]>(SELLER_FLEET_KEY)) || [];
      const updatedFleet = [
        normalized,
        ...currentFleet.filter((r) => r.id !== normalized.id && (!pphone || r.phone.replace(/\D/g, '').slice(-10) !== pphone)),
      ];
      await setItem(SELLER_FLEET_KEY, updatedFleet);
    }
  } catch (err) {
    console.warn('[PartnersSync] Local storage save error:', err);
  }

  // 2. Persist to backend API (/users/ and /users)
  try {
    await post('/users/', partnerRecord).catch(() => post('/users', partnerRecord));
  } catch (err) {
    console.warn('[PartnersSync] Backend partner save warning:', err);
  }

  // 3. Direct persistence to Supabase profiles table
  try {
    await postDirectToSupabase('profiles', {
      id: partnerRecord.id,
      phone: partnerRecord.phone,
      full_name: partnerRecord.full_name,
      email: partnerRecord.email,
      role: partnerRecord.role,
    });
  } catch (cloudErr) {
    console.warn('[PartnersSync] Direct Supabase profiles insertion warning:', cloudErr);
  }

  // 4. Emit instant real-time synchronization notification across all portals
  notifyPartnersUpdated();

  return partnerRecord;
};

