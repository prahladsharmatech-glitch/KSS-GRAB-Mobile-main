import React from 'react';
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, ShoppingBag, ArrowLeft } from 'lucide-react-native';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { ProductCard } from '../../components/ProductCard';
import { CustomerTopHeader } from '../../components/CustomerTopHeader';
import { SearchAutocomplete } from '../../components/SearchAutocomplete';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';

export default function WishlistPage() {
  const router = useRouter();
  const { wishlist } = useWishlist();
  const { addToCart, cart } = useCart();
  const { showToast } = useToast();

  const getItemQty = (productId: string) => {
    const found = cart.find((item) => String(item.product.id) === String(productId));
    return found ? found.quantity : 0;
  };

  const handleAddAllToCart = () => {
    if (!wishlist || wishlist.length === 0) return;

    let addedCount = 0;
    let outOfStockCount = 0;
    let alreadyInCartCount = 0;

    wishlist.forEach((item) => {
      const itemRecord = item as any;
      const isOutOfStock =
        itemRecord.inStock === false ||
        itemRecord.stock_quantity === 0 ||
        itemRecord.isOutOfStock === true;

      if (isOutOfStock) {
        outOfStockCount++;
        return;
      }

      const currentQty = getItemQty(item.id);
      if (currentQty > 0) {
        alreadyInCartCount++;
        return;
      }

      addToCart(item);
      addedCount++;
    });

    if (addedCount > 0) {
      let msg = `Added ${addedCount} saved ${addedCount === 1 ? 'item' : 'items'} to Cart!`;
      if (alreadyInCartCount > 0) msg += ` (${alreadyInCartCount} already in cart)`;
      if (outOfStockCount > 0) msg += ` (${outOfStockCount} out of stock)`;
      showToast(msg);
    } else if (alreadyInCartCount > 0 && outOfStockCount === 0) {
      showToast('All available items are already in your cart.');
    } else if (outOfStockCount > 0) {
      showToast('Saved items could not be added because they are out of stock.');
    }
  };

  return (
    <View style={styles.container}>
      {/* ── 1. TOP HEADER ── */}
      <CustomerTopHeader />

      {/* ── 2. BACK BUTTON & GLOBAL SEARCH BAR ── */}
      <View style={[styles.searchHeaderRow, { zIndex: 9999 }]}>
        <Pressable style={styles.backBtnCircle} onPress={() => router.back()}>
          <ArrowLeft size={18} color="#1E293B" />
        </Pressable>
        <View style={{ flex: 1, zIndex: 9999 }}>
          <SearchAutocomplete placeholder="Search saved items or products..." />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── 3. MY SAVED WISHLIST HEADER CARD ── */}
        <View style={styles.headerCard}>
          <View style={styles.headerTitleRow}>
            <Heart size={20} color="#E53935" fill="#E53935" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>My Saved Wishlist</Text>
              <Text style={styles.headerSubtitle}>
                {wishlist.length} {wishlist.length === 1 ? 'item' : 'items'} saved for later
              </Text>
            </View>
          </View>

          {wishlist.length > 0 && (
            <TouchableOpacity
              style={styles.addAllBtn}
              activeOpacity={0.8}
              onPress={handleAddAllToCart}
            >
              <ShoppingBag size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.addAllBtnText}>Add All to Cart</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── 4. WISHLIST ITEMS / EMPTY STATE ── */}
        {wishlist.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.pinkCircleBadge}>
              <Heart size={32} color="#E53935" />
            </View>
            <Text style={styles.emptyTitle}>Your Wishlist is Empty</Text>
            <Text style={styles.emptySubtitle}>
              Tap the heart icon on any product to save items you love for later.
            </Text>
            <TouchableOpacity
              style={styles.exploreBtn}
              activeOpacity={0.85}
              onPress={() => router.push('/customer' as any)}
            >
              <ArrowLeft size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.exploreBtnText}>Explore Products</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.gridWrapper}>
            {wishlist.map((item) => (
              <View key={item.id} style={styles.cardCol}>
                <ProductCard product={item} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: SPACING.xs,
  },
  backBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    ...SHADOWS.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 180,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  addAllBtn: {
    backgroundColor: '#0F9D58',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  addAllBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 36,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  pinkCircleBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 22,
    maxWidth: 280,
  },
  exploreBtn: {
    backgroundColor: '#0066FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  gridWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  cardCol: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
});
