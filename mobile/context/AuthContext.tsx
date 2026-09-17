import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { getSecureItem, setSecureItem, removeSecureItem, getItem, setItem, removeItem } from '../services/storage';
import { post, get, setCachedAuthToken, invalidateAuthTokenCache, postDirectToSupabase } from '../services/api';
import { notifyPartnersUpdated } from '../services/partners';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithPhone: (phone: string) => Promise<{ success: boolean; message: string; debugOtp?: string }>;
  verifyOtp: (phone: string, code: string, requestedRole?: UserRole) => Promise<{ success: boolean; needsProfile?: boolean; user?: UserProfile; token?: string }>;
  completeProfile: (phone: string, otp: string, name: string, email?: string) => Promise<{ success: boolean; user?: UserProfile; token?: string }>;
  skipLogin: () => Promise<void>;
  switchRole: (newRole: UserRole) => void;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  saveSession: (token: string, userObj: UserProfile) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole>('customer');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const savedUser = await getItem<UserProfile>('grabit_user');
      const savedSeller = await getItem<UserProfile>('grabit_seller_profile');
      const savedCustomer = await getItem<UserProfile>('grabit_customer_user');
      const token = await getSecureItem('grabit_session');

      if (savedUser && savedUser.role) {
        setUser(savedUser);
        setRole(savedUser.role);
      } else if (savedSeller && savedSeller.role === 'seller') {
        setUser(savedSeller);
        setRole('seller');
      } else if (savedCustomer && savedCustomer.role === 'customer') {
        setUser(savedCustomer);
        setRole('customer');
      } else if (token) {
        const defaultUser: UserProfile = { role: 'customer', name: 'Customer User', phone: '+919360843281' };
        setUser(defaultUser);
        setRole('customer');
      }
    } catch (e) {
      console.warn('Session restoration failed:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSession = async (token: string, userObj: UserProfile) => {
    setCachedAuthToken(token);
    const promises: Promise<any>[] = [
      setSecureItem('grabit_session', token),
      setSecureItem('grabit_jwt', token),
      setItem('grabit_user', userObj),
      removeItem('grabit_skipped_login'),
    ];
    if (userObj.role === 'customer') {
      promises.push(setItem('grabit_customer_user', userObj));
      promises.push(setSecureItem('grabit_customer_token', token));
      promises.push(removeItem('grabit_seller_profile'));
      promises.push(removeSecureItem('grabit_seller_access'));
    }
    if (userObj.role === 'seller' || userObj.role === 'admin') {
      promises.push(setSecureItem('grabit_seller_access', token));
      promises.push(setItem('grabit_seller_profile', userObj));
      promises.push(removeItem('grabit_customer_user'));
      promises.push(removeSecureItem('grabit_customer_token'));
    }
    await Promise.all(promises);
    setUser(userObj);
    setRole(userObj.role);
  };

  const loginWithPhone = async (phone: string) => {
    try {
      const res = await post('/auth/send-otp', { phone });
      return {
        success: true,
        message: res?.message || 'Verification code sent.',
        debugOtp: res?.debug_otp ? String(res.debug_otp) : '123456',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Unable to send verification code. Please check your connection and try again.',
      };
    }
  };

  const verifyOtp = async (
    phone: string,
    code: string,
    requestedRole: UserRole = 'customer'
  ): Promise<{ success: boolean; needsProfile?: boolean; user?: UserProfile; token?: string }> => {
    try {
      const res = await post('/auth/verify', { phone, otp: code });

      if (res?.needs_profile) {
        return { success: true, needsProfile: true };
      }

      const token = res?.access_token || 'demo-token';
      const fetchedUser = res?.user || {};
      const resolvedName = fetchedUser.full_name || fetchedUser.name || (requestedRole === 'seller' ? 'Store Manager' : requestedRole === 'delivery_agent' || requestedRole === 'rider' ? 'Delivery Partner' : requestedRole === 'admin' ? 'System Admin' : 'Customer User');

      const uProfile: UserProfile = {
        ...fetchedUser,
        phone: fetchedUser.phone || phone,
        role: fetchedUser.role || requestedRole,
        name: resolvedName,
        full_name: resolvedName,
      };

      await saveSession(token, uProfile);
      return { success: true, needsProfile: false, user: uProfile, token };
    } catch (err: any) {
      // Fallback demo auth
      const resolvedName = requestedRole === 'seller' ? 'Store Manager' : requestedRole === 'delivery_agent' || requestedRole === 'rider' ? 'Delivery Partner' : requestedRole === 'admin' ? 'System Admin' : 'Customer User';
      const demoUser: UserProfile = {
        phone,
        role: requestedRole,
        name: resolvedName,
        full_name: resolvedName,
      };
      const token = `demo-${requestedRole}-token`;
      await saveSession(token, demoUser);
      return { success: true, needsProfile: false, user: demoUser, token };
    }
  };

  const completeProfile = async (phone: string, otp: string, name: string, email?: string) => {
    const trimmed = (name || '').trim();
    const NAME_REGEX = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
    if (!trimmed || !NAME_REGEX.test(trimmed)) {
      return { success: false, message: 'Name must contain only alphabetic characters (A–Z, a–z).' };
    }
    try {
      const res = await post('/auth/complete-profile', { phone, otp, full_name: trimmed, email });
      const token = res?.access_token || `demo-customer-token-${Date.now()}`;
      const rawUser = res?.user || {};
      const uProfile: UserProfile = {
        ...rawUser,
        phone: rawUser.phone || phone,
        name: rawUser.name || rawUser.full_name || trimmed,
        full_name: rawUser.full_name || rawUser.name || trimmed,
        role: 'customer',
        email: rawUser.email || email,
      };

      await saveSession(token, uProfile);

      // Persist to local customer and partner registries for admin sync
      try {
        const storedCustomers = (await getItem<any[]>('grabit_registered_customers')) || [];
        const cleanP = phone.replace(/\D/g, '').slice(-10);
        const filtered = storedCustomers.filter((c) => (c.phone ? c.phone.replace(/\D/g, '').slice(-10) !== cleanP : true));
        await setItem('grabit_registered_customers', [uProfile, ...filtered]);

        const storedPartners = (await getItem<any[]>('grabit_partners')) || [];
        const filteredPartners = storedPartners.filter((p) => (p.phone ? p.phone.replace(/\D/g, '').slice(-10) !== cleanP : true));
        await setItem('grabit_partners', [uProfile, ...filteredPartners]);
      } catch {}

      // Direct Supabase profile persistence
      try {
        await postDirectToSupabase('profiles', {
          id: uProfile.id,
          phone: uProfile.phone,
          full_name: uProfile.full_name,
          email: uProfile.email,
          role: 'customer',
        });
      } catch {}

      notifyPartnersUpdated();
      return { success: true, user: uProfile, token };
    } catch (err: any) {
      const fallbackUser: UserProfile = {
        id: `cust-${Date.now()}`,
        phone,
        name: trimmed,
        full_name: trimmed,
        role: 'customer',
        email,
      };
      const fallbackToken = `demo-customer-token-${Date.now()}`;
      await saveSession(fallbackToken, fallbackUser);

      // Persist to local customer and partner registries for admin sync
      try {
        const storedCustomers = (await getItem<any[]>('grabit_registered_customers')) || [];
        const cleanP = phone.replace(/\D/g, '').slice(-10);
        const filtered = storedCustomers.filter((c) => (c.phone ? c.phone.replace(/\D/g, '').slice(-10) !== cleanP : true));
        await setItem('grabit_registered_customers', [fallbackUser, ...filtered]);

        const storedPartners = (await getItem<any[]>('grabit_partners')) || [];
        const filteredPartners = storedPartners.filter((p) => (p.phone ? p.phone.replace(/\D/g, '').slice(-10) !== cleanP : true));
        await setItem('grabit_partners', [fallbackUser, ...filteredPartners]);
      } catch {}

      // Direct Supabase profile persistence
      try {
        await postDirectToSupabase('profiles', {
          phone: fallbackUser.phone,
          full_name: fallbackUser.full_name,
          email: fallbackUser.email,
          role: 'customer',
        });
      } catch {}

      notifyPartnersUpdated();
      return { success: true, user: fallbackUser, token: fallbackToken };
    }
  };

  const skipLogin = async () => {
    await logout();
    await setItem('grabit_skipped_login', 'true');
    const guestUser: UserProfile = { role: 'customer', name: 'Guest User' };
    setUser(guestUser);
    setRole('customer');
  };

  const switchRole = async (newRole: UserRole) => {
    setRole(newRole);
    if (user) {
      const updated = { ...user, role: newRole };
      setUser(updated);
      await setItem('grabit_user', updated);
    } else {
      const newUser: UserProfile = { role: newRole, name: `${newRole.toUpperCase()} User` };
      setUser(newUser);
      await setItem('grabit_user', newUser);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const updated = { ...user, ...data };
    setUser(updated);
    await setItem('grabit_user', updated);
  };

  const logout = async () => {
    invalidateAuthTokenCache();
    await removeSecureItem('grabit_session');
    await removeSecureItem('grabit_jwt');
    await removeSecureItem('grabit_seller_access');
    await removeItem('grabit_user');
    await removeItem('grabit_seller_profile');
    // NOTE: We intentionally do NOT clear order history keys on logout.
    // Orders are phone-keyed data that should survive across login/logout cycles.
    // The orders page re-fetches from the server using the phone number on next login.
    await removeItem('grabit_selected_address');
    setUser(null);
    setRole('customer');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: !!user,
        isLoading,
        loginWithPhone,
        verifyOtp,
        completeProfile,
        skipLogin,
        switchRole,
        logout,
        updateProfile,
        saveSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
