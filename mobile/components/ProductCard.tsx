import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Product } from '../types';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import { Heart, Plus, Minus, Star } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { getCloudinaryUrl, DEFAULT_FALLBACK_IMAGE, optimizeImageUrl } from '../services/cloudinary';

const LOCAL_PRODUCT_IMAGES: Record<string, any> = {
  'coca-cola-real.jpg': require('../assets/coca-cola-real.jpg'),
  'aashirvaad-atta-real.jpg': require('../assets/aashirvaad-atta-real.jpg'),
  'atta-real.jpg': require('../assets/aashirvaad-atta-real.jpg'),
  'amul-butter-real.jpg': require('../assets/amul-butter-real.jpg'),
  'butter-real.jpg': require('../assets/amul-butter-real.jpg'),
  'combo-munchies.jpg': require('../assets/combo-munchies.jpg'),
  'cadbury-silk-real.jpg': require('../assets/cadbury-silk-real.jpg'),
  'dettol-handwash-real.jpg': require('../assets/dettol-handwash-real.jpg'),
  'dettol-real.jpg': require('../assets/dettol-handwash-real.jpg'),
  'fortune-oil-real.jpg': require('../assets/fortune-oil-real.jpg'),
  'apples-real.jpg': require('../assets/apples-real.jpg'),
};

const getProductImageSource = (imageStr?: string) => {
  if (!imageStr || typeof imageStr !== 'string') {
    return { uri: DEFAULT_FALLBACK_IMAGE };
  }

  const clean = imageStr.trim();
  if (!clean || clean === 'null' || clean === 'undefined' || clean.endsWith('/null') || clean.endsWith('/undefined')) {
    return { uri: DEFAULT_FALLBACK_IMAGE };
  }

  const filename = clean.split('/').pop()?.split('?')[0] || '';
  if (LOCAL_PRODUCT_IMAGES[clean]) return LOCAL_PRODUCT_IMAGES[clean];
  if (LOCAL_PRODUCT_IMAGES[filename]) return LOCAL_PRODUCT_IMAGES[filename];

  return { uri: optimizeImageUrl(clean, 300) };
};

interface ProductCardProps {
  product: Product;
  width?: number | string;
}

const ProductCardComponent: React.FC<ProductCardProps> = ({ product, width }) => {
  const router = useRouter();
  const { cart, addToCart, updateQuantity } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [imageError, setImageError] = React.useState(false);

  const cartItem = cart.find((i) => i.product.id === product.id);
  const qty = cartItem ? cartItem.quantity : 0;
  const isWishlisted = isInWishlist(product.id);
  const isOutOfStock = product.inStock === false;

  const rawImg = product.image || (product as any).image_url;
  const imageSource = imageError
    ? { uri: DEFAULT_FALLBACK_IMAGE }
    : getProductImageSource(rawImg);

  return (
    <Pressable
      style={[
        styles.card,
        width ? { width: width as any, marginRight: typeof width === 'number' ? 12 : 0 } : null,
      ]}
      onPress={() => router.push(`/customer/product/${product.id}` as any)}
    >
      {/* Top Left Discount or Stock Badge */}
      {isOutOfStock ? (
        <View style={styles.stockBadge}>
          <Text style={styles.stockBadgeText}>OUT OF STOCK</Text>
        </View>
      ) : product.discountPercent && product.discountPercent > 0 ? (
        <View
          style={[
            styles.discountBadge,
            product.discountPercent <= 10
              ? { backgroundColor: '#10B981' }
              : { backgroundColor: '#EF4444' },
          ]}
        >
          <Text style={styles.discountBadgeText}>{product.discountPercent}% OFF</Text>
        </View>
      ) : null}

      {/* Top Right Wishlist Heart */}
      <Pressable
        style={styles.wishlistBtn}
        onPress={(e) => {
          e.stopPropagation();
          toggleWishlist(product);
        }}
      >
        <Heart
          size={14}
          color={isWishlisted ? '#FF3B30' : '#94A3B8'}
          fill={isWishlisted ? '#FF3B30' : 'transparent'}
        />
      </Pressable>

      {/* Product Image Container */}
      <View style={styles.imageContainer}>
        <Image
          source={imageSource}
          style={styles.image}
          resizeMode="contain"
          fadeDuration={0}
          progressiveRenderingEnabled={true}
          onError={() => setImageError(true)}
        />
      </View>

      {/* Product Information */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {product.name}
        </Text>

        <Text style={styles.weightText} numberOfLines={1}>
          {product.weight || '250g'}
        </Text>

        {/* Price Row */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{product.price}</Text>
          {product.originalPrice ? (
            <Text style={styles.originalPrice}>₹{product.originalPrice}</Text>
          ) : null}
        </View>

        {/* Rating & Add to Cart Action Row */}
        <View style={styles.actionRow}>
          <View style={styles.ratingBadge}>
            <Star size={11} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.ratingText}>{product.rating || 5}</Text>
          </View>

          {isOutOfStock ? (
            <View style={styles.disabledAddBtn}>
              <Text style={styles.disabledAddBtnText}>Out of Stock</Text>
            </View>
          ) : qty === 0 ? (
            <Pressable
              style={styles.addBtn}
              onPress={(e) => {
                e.stopPropagation();
                addToCart(product);
              }}
            >
              <Text style={styles.addBtnText}>Add to Cart</Text>
            </Pressable>
          ) : (
            <View style={styles.qtyStepper}>
              <Pressable
                style={styles.stepperBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  updateQuantity(product.id, qty - 1);
                }}
              >
                <Minus size={12} color="#FFFFFF" />
              </Pressable>

              <Text style={styles.qtyText}>{qty}</Text>

              <Pressable
                style={styles.stepperBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  updateQuantity(product.id, qty + 1);
                }}
              >
                <Plus size={12} color="#FFFFFF" />
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
};

export const ProductCard = React.memo(ProductCardComponent);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    width: '48.5%',
    marginBottom: 12,
    position: 'relative',
    ...SHADOWS.sm,
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF3B30',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 4,
    zIndex: 2,
  },
  discountBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  stockBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#64748B',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 4,
    zIndex: 2,
  },
  stockBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  wishlistBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
    ...SHADOWS.sm,
  },
  imageContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
    marginBottom: 8,
    marginTop: 4,
  },
  image: {
    width: 90,
    height: 90,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 16,
    height: 32,
    marginBottom: 2,
  },
  weightText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  price: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginRight: 6,
  },
  originalPrice: {
    fontSize: 11,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
    marginLeft: 3,
  },
  addBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0066FF',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#0066FF',
    fontSize: 11,
    fontWeight: '800',
  },
  disabledAddBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 5,
    alignItems: 'center',
  },
  disabledAddBtnText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  qtyStepper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0066FF',
    borderRadius: 8,
    paddingHorizontal: 6,
    height: 30,
  },
  stepperBtn: {
    padding: 2,
  },
  qtyText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
});
