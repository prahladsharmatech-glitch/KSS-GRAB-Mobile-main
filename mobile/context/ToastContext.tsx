import React, { createContext, useContext, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';

interface ToastContextType {
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <View
          style={[
            styles.toastContainer,
            toast.type === 'success' && styles.success,
            toast.type === 'error' && styles.error,
          ]}
        >
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    backgroundColor: COLORS.text,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    ...SHADOWS.lg,
  },
  success: {
    backgroundColor: COLORS.primaryDark,
  },
  error: {
    backgroundColor: COLORS.danger,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
