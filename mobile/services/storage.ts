import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Securely store sensitive keys (e.g. JWT tokens)
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (err) {
    await AsyncStorage.setItem(key, value);
  }
}

/**
 * Retrieve sensitive keys
 */
export async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(key);
    } else {
      const val = await SecureStore.getItemAsync(key);
      if (val) return val;
      return await AsyncStorage.getItem(key);
    }
  } catch (err) {
    return await AsyncStorage.getItem(key);
  }
}

/**
 * Remove sensitive keys
 */
export async function removeSecureItem(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
      await AsyncStorage.removeItem(key);
    }
  } catch (err) {
    await AsyncStorage.removeItem(key);
  }
}

/**
 * Regular persistent storage for cart, preferences, address
 */
export async function setItem<T>(key: string, value: T): Promise<void> {
  try {
    const stringified = typeof value === 'string' ? value : JSON.stringify(value);
    await AsyncStorage.setItem(key, stringified);
  } catch (e) {
    console.warn('Storage setItem failed:', e);
  }
}

export async function getItem<T>(key: string): Promise<T | null> {
  try {
    const val = await AsyncStorage.getItem(key);
    if (!val) return null;
    try {
      return JSON.parse(val) as T;
    } catch {
      return val as unknown as T;
    }
  } catch {
    return null;
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.warn('Storage removeItem failed:', e);
  }
}

export async function clearAllLegacyOrderStorage(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      'grabit_orders',
      'grabit_orders_guest',
      'grabit_recent_orders',
      'grabit_seller_orders',
      'grabit_user_notifications_guest',
      'grabit_read_notifications',
      'grabit_dismissed_notifications',
    ]);
  } catch {
    // Ignore error
  }
}

export async function purgeLocalOrderStorage(phone?: string): Promise<void> {
  try {
    const digits = (phone || '').replace(/\D/g, '');
    const cleanPhone = digits.length >= 10 ? digits.slice(-10) : digits;
    const keysToRemove = [
      'grabit_orders',
      'grabit_orders_guest',
      'grabit_recent_orders',
      'grabit_seller_orders',
      'grabit_user_notifications_guest',
      'grabit_read_notifications',
      'grabit_dismissed_notifications',
    ];
    if (cleanPhone) {
      keysToRemove.push(`grabit_orders_${cleanPhone}`);
      keysToRemove.push(`grabit_user_notifications_${cleanPhone}`);
    }
    await AsyncStorage.multiRemove(keysToRemove);
  } catch {
    // Ignore error
  }
}

