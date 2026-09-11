import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { get, post } from '../services/api';
import { getItem, setItem } from '../services/storage';

// ─── Types ────────────────────────────────────────────────────────
export type DutyStatus = 'ONLINE' | 'OFFLINE' | 'ON_DELIVERY';

/** Shape of a single day's local attendance record */
interface LocalAttendanceRecord {
  punchIn: string;
  punchOut?: string;
  status: 'PRESENT';
}

/** Map of date strings (YYYY-MM-DD) to attendance records */
export type LocalAttendanceLog = Record<string, LocalAttendanceRecord>;

interface RiderDutyContextValue {
  /** Current duty status: ONLINE, OFFLINE, or ON_DELIVERY */
  dutyStatus: DutyStatus;
  /** Whether the rider is online (ONLINE or ON_DELIVERY) */
  isOnline: boolean;
  /** Partner code, e.g. "RDR-700B" */
  partnerCode: string;
  /** Punch-in timestamp string */
  punchInTime: string;
  /** Full rider profile object from backend */
  rider: any;
  /** Toggle duty on/off — persists to storage + calls backend */
  toggleDuty: (goOnline: boolean) => Promise<void>;
  /** Re-sync duty state from backend + storage */
  refreshDutyStatus: () => Promise<void>;
  /** Clean up duty state before logout — ends shift + clears state */
  cleanupOnLogout: () => Promise<void>;
  /** Get local attendance log from AsyncStorage */
  getLocalAttendanceLog: () => Promise<LocalAttendanceLog>;
}

const RiderDutyContext = createContext<RiderDutyContextValue | undefined>(undefined);

// ─── Storage keys ─────────────────────────────────────────────────
const STORAGE_KEY = '@grabit_rider_is_online';
const ATTENDANCE_LOG_KEY = '@grabit_attendance_log';

// ─── Helpers ──────────────────────────────────────────────────────
function parseBool(val: any): boolean {
  return val === true || val === 'true' || String(val).toLowerCase() === 'true';
}

function getTodayDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function getUserPhone(): Promise<string> {
  try {
    const userStr = await getItem<any>('grabit_user').catch(() => null);
    if (userStr && userStr.phone) {
      return String(userStr.phone).trim();
    }
  } catch {}
  return '';
}

// ─── Provider ─────────────────────────────────────────────────────
export const RiderDutyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dutyStatus, setDutyStatus] = useState<DutyStatus>('OFFLINE');
  const [partnerCode, setPartnerCode] = useState<string>('RDR-700B');
  const [punchInTime, setPunchInTime] = useState<string>('--');
  const [rider, setRider] = useState<any>(null);

  // ── Get local attendance log ──────────────────────────────────
  const getLocalAttendanceLog = useCallback(async (): Promise<LocalAttendanceLog> => {
    try {
      const log = await getItem<LocalAttendanceLog>(ATTENDANCE_LOG_KEY).catch(() => null);
      return log || {};
    } catch {
      return {};
    }
  }, []);

  // ── Save a punch-in record to local attendance log ────────────
  const savePunchInRecord = useCallback(async (timeStr: string) => {
    try {
      const dateStr = getTodayDateStr();
      const log = await getLocalAttendanceLog();
      log[dateStr] = {
        punchIn: timeStr,
        status: 'PRESENT',
      };
      await setItem(ATTENDANCE_LOG_KEY, log).catch(() => {});
    } catch {}
  }, [getLocalAttendanceLog]);

  // ── Save a punch-out record to local attendance log ───────────
  const savePunchOutRecord = useCallback(async () => {
    try {
      const dateStr = getTodayDateStr();
      const log = await getLocalAttendanceLog();
      if (log[dateStr]) {
        log[dateStr].punchOut = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        await setItem(ATTENDANCE_LOG_KEY, log).catch(() => {});
      }
    } catch {}
  }, [getLocalAttendanceLog]);

  // ── Fetch current status from backend (correct endpoint) ──────
  const refreshDutyStatus = useCallback(async () => {
    try {
      // 1. Read local persisted state first (authoritative user action)
      const storedVal = await getItem<any>(STORAGE_KEY).catch(() => null);
      const isLocallyOnline = parseBool(storedVal);

      // 2. Query backend for partner code, live delivery counts, and telemetry
      const res: any = await get('/delivery/presence-status').catch(() => null);

      if (res && res.user) {
        const u = res.user;
        setRider(u);

        // Update partner code
        const code = u.partner_id || u.partnerId || u.agentId || u.id || '';
        if (code) {
          const cleanCode = String(code).replace(/-/g, '').slice(-4).toUpperCase();
          setPartnerCode(code.startsWith('RDR-') ? code : `RDR-${cleanCode}`);
        }

        const activeCount = Number(u.active_deliveries_count || 0);

        if (activeCount > 0) {
          setDutyStatus('ON_DELIVERY');
        } else if (isLocallyOnline) {
          // Rider explicitly punched in: NEVER auto-punch out
          setDutyStatus('ONLINE');
        } else if (u.is_online) {
          // Backend says online
          setDutyStatus('ONLINE');
          await setItem(STORAGE_KEY, 'true').catch(() => {});
        } else {
          setDutyStatus('OFFLINE');
        }

        // Update punch-in time if available
        if (u.punch_in_time && u.punch_in_time !== '--') {
          setPunchInTime(u.punch_in_time);
        }
        return;
      }

      // 3. Fallback: if backend fails/unreachable, respect local storage
      if (isLocallyOnline) {
        setDutyStatus((prev) => (prev === 'ON_DELIVERY' ? 'ON_DELIVERY' : 'ONLINE'));
      } else {
        setDutyStatus('OFFLINE');
      }
    } catch {
      // Silently fail — keep current state
    }
  }, []);

  // ── Toggle duty on/off ────────────────────────────────────────
  const toggleDuty = useCallback(async (goOnline: boolean) => {
    // Optimistic update
    setDutyStatus(goOnline ? 'ONLINE' : 'OFFLINE');

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (goOnline) {
      setPunchInTime(timeStr);
    } else {
      setPunchInTime('--');
    }

    // Persist to AsyncStorage immediately
    await setItem(STORAGE_KEY, goOnline ? 'true' : 'false').catch(() => {});

    // Save to local attendance log
    if (goOnline) {
      await savePunchInRecord(timeStr);
    } else {
      await savePunchOutRecord();
    }

    // Get user's phone for backend identification
    const phone = await getUserPhone();

    // Call correct backend endpoint with phone for proper rider identification
    try {
      await post('/delivery/presence', {
        phone,
        status: goOnline ? 'AVAILABLE' : 'UNAVAILABLE',
      });
    } catch {
      // Backend call failed — keep optimistic state since we saved to storage + local log
    }
  }, [savePunchInRecord, savePunchOutRecord]);

  // ── Cleanup before logout ─────────────────────────────────────
  const cleanupOnLogout = useCallback(async () => {
    // End the shift on the backend
    const phone = await getUserPhone();
    try {
      await post('/delivery/presence', {
        phone,
        status: 'UNAVAILABLE',
      });
    } catch {}

    // Save punch-out record to local log (attendance persists across logout)
    await savePunchOutRecord();

    // Clear duty status (but NOT the attendance log — that should persist)
    await setItem(STORAGE_KEY, 'false').catch(() => {});

    // Reset context state
    setDutyStatus('OFFLINE');
    setPunchInTime('--');
  }, [savePunchOutRecord]);

  // ── Initial sync on mount ─────────────────────────────────────
  useEffect(() => {
    // Read from AsyncStorage first for instant UI, then sync from backend
    getItem<any>(STORAGE_KEY)
      .then((val) => {
        if (parseBool(val)) {
          setDutyStatus((prev) => (prev === 'ON_DELIVERY' ? 'ON_DELIVERY' : 'ONLINE'));
        }
      })
      .catch(() => {});

    refreshDutyStatus();
  }, [refreshDutyStatus]);

  const isOnline = dutyStatus === 'ONLINE' || dutyStatus === 'ON_DELIVERY';

  return (
    <RiderDutyContext.Provider
      value={{
        dutyStatus,
        isOnline,
        partnerCode,
        punchInTime,
        rider,
        toggleDuty,
        refreshDutyStatus,
        cleanupOnLogout,
        getLocalAttendanceLog,
      }}
    >
      {children}
    </RiderDutyContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────
export function useRiderDuty(): RiderDutyContextValue {
  const ctx = useContext(RiderDutyContext);
  if (!ctx) {
    throw new Error('useRiderDuty must be used within a <RiderDutyProvider>');
  }
  return ctx;
}
