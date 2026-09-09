import { Platform } from 'react-native';
import { getSecureItem, getItem } from './storage';
import { UserProfile } from '../types';

// Default host URL based on platform
const getHostUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'web') return 'http://localhost:8000/api';
  return 'http://10.0.2.2:8000/api';
};

const API_BASE_URL = getHostUrl();

if (__DEV__) {
  console.log(`[API] Connection URL: ${API_BASE_URL}`);
}

let _cachedToken: string | null = null;
let _tokenCachedAt: number = 0;

export function invalidateAuthTokenCache() {
  _cachedToken = null;
  _tokenCachedAt = 0;
}

export function setCachedAuthToken(token: string | null) {
  _cachedToken = token;
  _tokenCachedAt = Date.now();
}

export async function getAuthToken(): Promise<string | null> {
  const now = Date.now();
  if (_cachedToken !== null && now - _tokenCachedAt < 60000) {
    return _cachedToken;
  }
  try {
    const [sessionToken, jwtToken, sellerToken, userStr] = await Promise.all([
      getSecureItem('grabit_session'),
      getSecureItem('grabit_jwt'),
      getSecureItem('grabit_seller_access'),
      getItem<UserProfile>('grabit_user'),
    ]);

    let token: string | null = sessionToken || jwtToken || sellerToken || null;
    if (!token && userStr?.role) {
      if (userStr.role === 'admin') token = 'demo-admin-token';
      else if (userStr.role === 'seller') token = 'demo-seller-token';
      else if (['delivery_agent', 'delivery_partner', 'rider'].includes(userStr.role)) token = 'demo-delivery-token';
      else if (userStr.role === 'customer') token = 'demo-customer-token';
    }

    _cachedToken = token;
    _tokenCachedAt = now;
    return token;
  } catch {
    return null;
  }
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
  const token = await getAuthToken();
  const isGet = !options.method || options.method === 'GET';

  const isPublicGet = isGet && (
    path.startsWith('/orders') ||
    path.startsWith('/products') ||
    path.startsWith('/categories') ||
    path.startsWith('/admin') ||
    path.startsWith('/users') ||
    path.startsWith('/store') ||
    path.startsWith('/tickets')
  );

  if (isGet && !token && !isPublicGet) return null;

  const timeoutMs = isGet ? 3000 : (path.startsWith('/auth') ? 3500 : (path.startsWith('/orders') ? 6000 : 15000));
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const perfLabel = `[API Perf] ${options.method || 'GET'} ${path}`;

  if (__DEV__) console.time(perfLabel);

  try {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const startTime = Date.now();
    const response = await fetch(`${API_BASE_URL}${cleanPath}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    const networkTime = Date.now() - startTime;
    clearTimeout(timeoutId);

    if (response.status === 204) {
      if (__DEV__) console.timeEnd(perfLabel);
      return null;
    }
    if ((response.status === 401 || response.status === 403) && isGet) {
      if (__DEV__) console.timeEnd(perfLabel);
      if (cleanPath.startsWith('/products') || cleanPath.startsWith('/categories')) {
        return await fetchDirectFromSupabase<T>(cleanPath);
      }
      return null;
    }

    const jsonStartTime = Date.now();
    const data = await response.json().catch(() => ({}));
    const parseTime = Date.now() - jsonStartTime;

    if (__DEV__) {
      console.timeEnd(perfLabel);
      console.log(`[API Metrics] ${cleanPath} | Network: ${networkTime}ms | JSON Parse: ${parseTime}ms`);
    }

    if (!response.ok) {
      if (isGet && (cleanPath.startsWith('/products') || cleanPath.startsWith('/categories'))) {
        const cloudData = await fetchDirectFromSupabase<T>(cleanPath);
        if (cloudData) return cloudData;
      }
      throw new Error(data.detail || `Server error (${response.status})`);
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (__DEV__) console.timeEnd(perfLabel);

    if (isGet && (path.startsWith('/products') || path.startsWith('/categories'))) {
      const cloudData = await fetchDirectFromSupabase<T>(path);
      if (cloudData) return cloudData;
      return null;
    }

    const errString = String(err).toLowerCase();
    const isAbort = err.name === 'AbortError' ||
                    errString.includes('abort') ||
                    errString.includes('cancel');

    if (isGet) {
      return null;
    }

    if (isAbort) {
      throw new Error('Request timed out. Please check your network connectivity.');
    }
    throw err;
  }
}

export const get = <T = any>(path: string) => api<T>(path);
export const post = <T = any>(path: string, body: any) => api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const patch = <T = any>(path: string, body: any) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const del = <T = any>(path: string) => api<T>(path, { method: 'DELETE' });

export async function uploadImage(fileUri: string, folder: string = 'grabit_media'): Promise<string> {
  const token = await getAuthToken();
  const formData = new FormData();
  
  const filename = fileUri.split('/').pop() || 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  // @ts-ignore RN FormData file handling
  formData.append('file', { uri: fileUri, name: filename, type });
  formData.append('folder', folder);

  const response = await fetch(`${API_BASE_URL}/uploads/image`, {
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
