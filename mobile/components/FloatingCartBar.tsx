import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useCart } from '../context/CartContext';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import { ShoppingBag, ArrowRight } from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';

export const FloatingCartBar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { totalItems, totalAmount } = useCart();
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Hide on cart or checkout screens or until mounted
  if (!isMounted || totalItems === 0 || pathname.includes('/cart') || pathname.includes('/checkout')) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.cartBar} onPress={() => router.push('/customer/cart' as any)}>
        <View style={styles.leftInfo}>
          <View style={styles.iconCircle}>
            <ShoppingBag size={17} color="#FFFFFF" />
            <View style={styles.greenBadge}>
              <Text style={styles.greenBadgeText}>{totalItems}</Text>
            </View>
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.itemCountText}>
              {totalItems} {totalItems === 1 ? 'ITEM' : 'ITEMS'}
            </Text>
            <Text style={styles.priceText}>₹{totalAmount}</Text>
          </View>
        </View>

        <View style={styles.rightAction}>
          <Text style={styles.viewCartText}>View Cart</Text>
          <ArrowRight size={14} color="#FFFFFF" />
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 68,
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 999,
    alignItems: 'center',
  },
  cartBar: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#0066FF',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...SHADOWS.lg,
  },
  leftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    position: 'relative',
  },
  greenBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#34C759',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greenBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
  },
  textContainer: {},
  itemCountText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  priceText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  rightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  viewCartText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
    marginRight: 4,
  },
});
