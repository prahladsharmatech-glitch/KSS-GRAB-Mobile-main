import { Platform } from 'react-native';
import { getSecureItem, getItem } from './storage';
import { UserProfile } from '../types';

export function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'web' || typeof window !== 'undefined') {
    return 'http://localhost:8000/api';
  }
  return 'http://10.0.2.2:8000/api';
}

const API_BASE_URL = getApiBaseUrl();

if (__DEV__) {
  console.log(`[API] Connection URL: ${API_BASE_URL}`);
}

let cachedAuthToken: string | null = null;
let lastTokenFetchTime = 0;

export function invalidateAuthTokenCache() {
  cachedAuthToken = null;
  lastTokenFetchTime = 0;
}

export function setCachedAuthToken(token: string | null) {
  cachedAuthToken = token;
  lastTokenFetchTime = Date.now();
}

export function setAuthTokenCache(token: string | null) {
  setCachedAuthToken(token);
}

export async function getAuthToken(forceRefresh = false): Promise<string | null> {
  const now = Date.now();
  if (!forceRefresh && cachedAuthToken !== null && now - lastTokenFetchTime < 60000) {
    return cachedAuthToken;
  }

  try {
    const [sessionToken, jwtToken, sellerToken, userStr] = await Promise.all([
      getSecureItem('grabit_session'),
      getSecureItem('grabit_jwt'),
      getSecureItem('grabit_seller_access'),
      getItem<UserProfile>('grabit_user'),
    ]);

    if (sessionToken) {
      cachedAuthToken = sessionToken;
      lastTokenFetchTime = now;
      return sessionToken;
    }

    if (jwtToken) {
      cachedAuthToken = jwtToken;
      lastTokenFetchTime = now;
      return jwtToken;
    }

    if (sellerToken) {
      cachedAuthToken = sellerToken;
      lastTokenFetchTime = now;
      return sellerToken;
    }

    if (userStr?.role) {
      let fallback = 'demo-seller-token';
      if (userStr.role === 'admin') fallback = 'demo-admin-token';
      else if (userStr.role === 'seller') fallback = 'demo-seller-token';
      else if (['delivery_agent', 'delivery_partner', 'rider'].includes(userStr.role)) fallback = 'demo-delivery-token';
      else if (userStr.role === 'customer') fallback = 'demo-customer-token';
      cachedAuthToken = fallback;
      lastTokenFetchTime = now;
      return fallback;
    }

    cachedAuthToken = 'demo-seller-token';
    lastTokenFetchTime = now;
    return cachedAuthToken;
  } catch {
    cachedAuthToken = 'demo-seller-token';
    lastTokenFetchTime = now;
    return cachedAuthToken;
  }
}

// In-memory response cache for instant GET operations
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 15000;

export function clearApiCache() {
  apiCache.clear();
}

const SUPABASE_REST_URL = 'https://vhcmjwuhdcdxqmyjvqpz.supabase.co/rest/v1';
const SUPABASE_ANON_KEY = 'sb_publishable__liWsDpEneX70mTGaYabSQ_B8J-B3fy';

export async function fetchDirectFromSupabase<T>(path: string): Promise<T | null> {
  try {
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    const [route, queryString] = cleanPath.split('?');

    let endpoint = '';
    if (route === 'products' || route === 'products/') {
      endpoint = `${SUPABASE_REST_URL}/products?select=*,categories(id,name)&order=created_at.desc`;
      if (queryString) {
        const params = new URLSearchParams(queryString);
        const q = params.get('q');
        if (q) {
          endpoint += `&name=ilike.*${encodeURIComponent(q)}*`;
        }
      }
    } else if (route.startsWith('products/')) {
      const prodId = route.split('/')[1];
      if (prodId) {
        endpoint = `${SUPABASE_REST_URL}/products?id=eq.${encodeURIComponent(prodId)}&select=*,categories(id,name)`;
      }
    } else if (route === 'categories' || route === 'categories/') {
      endpoint = `${SUPABASE_REST_URL}/categories?select=*&order=name`;
    }

    if (!endpoint) return null;

    const res = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        if (route.startsWith('products/') && data.length > 0) {
          return data[0] as T;
        }
        return data as T;
      }
      return data as T;
    }
  } catch (cloudErr) {
    if (__DEV__) console.log('[Supabase Direct Fetch] Cloud query error:', cloudErr);
  }
  return null;
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T | null> {
  const isGet = !options.method || options.method === 'GET';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();

  const isDeliveryPath = cleanPath.startsWith('/delivery') || cleanPath.includes('/verify-otp') || cleanPath.includes('/step');

  if (isGet && !isDeliveryPath) {
    const cached = apiCache.get(cleanPath);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data as T;
    }
  }

  const isPublicGet = isGet && (
    cleanPath.startsWith('/orders') ||
    cleanPath.startsWith('/products') ||
    cleanPath.startsWith('/categories') ||
    cleanPath.startsWith('/admin') ||
    cleanPath.startsWith('/users') ||
    cleanPath.startsWith('/store') ||
    cleanPath.startsWith('/tickets')
  );

  let token = isPublicGet && cachedAuthToken ? cachedAuthToken : await getAuthToken();
  if (isDeliveryPath) {
    const riderToken = await getSecureItem('grabit_rider_token').catch(() => null);
    if (riderToken) {
      token = riderToken;
    } else if (!token || token === 'demo-seller-token' || token === 'demo-customer-token') {
      token = 'demo-delivery-token';
    }
  }

  const timeoutMs = isGet ? 3000 : 15000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${cleanPath}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (response.status === 204) return null;
    if ((response.status === 401 || response.status === 403) && isGet) {
      if (cleanPath.startsWith('/products') || cleanPath.startsWith('/categories')) {
        return await fetchDirectFromSupabase<T>(cleanPath);
      }
      return null;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (isGet && (cleanPath.startsWith('/products') || cleanPath.startsWith('/categories'))) {
        const cloudData = await fetchDirectFromSupabase<T>(cleanPath);
        if (cloudData) return cloudData;
      }
      throw new Error(data.detail || `Server error (${response.status})`);
    }

    if (isGet && data && !isDeliveryPath) {
      apiCache.set(cleanPath, { data, timestamp: Date.now() });
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (isGet) {
      const stale = apiCache.get(cleanPath);
      if (stale) return stale.data as T;
      if (cleanPath.startsWith('/products') || cleanPath.startsWith('/categories')) {
        const cloudData = await fetchDirectFromSupabase<T>(cleanPath);
        if (cloudData) return cloudData;
      }
      return null;
    }

    throw err;
  }
}

export const get = <T = any>(path: string) => api<T>(path);
export const post = <T = any>(path: string, body: any) => {
  clearApiCache();
  return api<T>(path, { method: 'POST', body: JSON.stringify(body) });
};
export const patch = <T = any>(path: string, body: any) => {
  clearApiCache();
  return api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
};
export const del = <T = any>(path: string) => {
  clearApiCache();
  return api<T>(path, { method: 'DELETE' });
};

export async function uploadImage(fileUri: string, folder: string = 'grabit_media'): Promise<string> {
  const token = await getAuthToken();
  const formData = new FormData();
  const baseUrl = getApiBaseUrl();

  const filename = fileUri.split('/').pop() || 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  // @ts-ignore RN FormData file handling
  formData.append('file', { uri: fileUri, name: filename, type });
  formData.append('folder', folder);

  const response = await fetch(`${baseUrl}/uploads/image`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || 'Image upload failed.');
  }

  return data.url;
}
