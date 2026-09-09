import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get } from '../../../services/api';
import { Product } from '../../../types';
import { products as localProducts } from '../../../data/products';
import { useCart } from '../../../context/CartContext';
import { useWishlist } from '../../../context/WishlistContext';
import { useToast } from '../../../context/ToastContext';
import { LoadingView } from '../../../components/LoadingView';
import { COLORS, SPACING, SHADOWS } from '../../../constants/theme';
import {
  ArrowLeft,
  Heart,
  Share2,
  Clock,
  ShieldCheck,
  Truck,
  Plus,
  Minus,
  Search,
  Bell,
  Calendar,
  MapPin,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Star,
  Zap,
  RotateCcw,
  CheckCircle2,
  ShoppingBag,
  Home,
  Grid,
  TrendingUp,
  User,
  Leaf,
} from 'lucide-react-native';
import { SearchAutocomplete } from '../../../components/SearchAutocomplete';

import { getCloudinaryUrl, getValidImage, optimizeImageUrl, DEFAULT_FALLBACK_IMAGE } from '../../../services/cloudinary';

const LOCAL_PRODUCT_IMAGES: Record<string, any> = {
  'coca-cola-real.jpg': require('../../../assets/coca-cola-real.jpg'),
  'aashirvaad-atta-real.jpg': require('../../../assets/aashirvaad-atta-real.jpg'),
  'atta-real.jpg': require('../../../assets/aashirvaad-atta-real.jpg'),
  'amul-butter-real.jpg': require('../../../assets/amul-butter-real.jpg'),
  'butter-real.jpg': require('../../../assets/butter-real.jpg'),
  'combo-munchies.jpg': require('../../../assets/combo-munchies.jpg'),
  'cadbury-silk-real.jpg': require('../../../assets/cadbury-silk-real.jpg'),
  'dettol-handwash-real.jpg': require('../../../assets/dettol-handwash-real.jpg'),
  'dettol-real.jpg': require('../../../assets/dettol-handwash-real.jpg'),
  'fortune-oil-real.jpg': require('../../../assets/fortune-oil-real.jpg'),
  'apples-real.jpg': require('../../../assets/apples-real.jpg'),
  'fresh-red-apples-real.jpg': require('../../../assets/apples-real.jpg'),
};

const resolveProductImage = (imageStr?: any) => {
  if (!imageStr || typeof imageStr !== 'string') return { uri: DEFAULT_FALLBACK_IMAGE };
  const clean = getValidImage(imageStr);
  if (clean === DEFAULT_FALLBACK_IMAGE) return { uri: DEFAULT_FALLBACK_IMAGE };

  const filename = clean.split('/').pop()?.split('?')[0] || '';
  if (LOCAL_PRODUCT_IMAGES[clean]) return LOCAL_PRODUCT_IMAGES[clean];
  if (LOCAL_PRODUCT_IMAGES[filename]) return LOCAL_PRODUCT_IMAGES[filename];

  return { uri: optimizeImageUrl(clean, 400) };
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProductDetailPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cart, addToCart, updateQuantity } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { showToast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [selectedPackIndex, setSelectedPackIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'details' | 'reviews' | 'nutritional'>('details');
  const [isHighlightsExpanded, setIsHighlightsExpanded] = useState<boolean>(false);
  const [isInfoExpanded, setIsInfoExpanded] = useState<boolean>(false);

  useEffect(() => {
    // Check local data first for instant 0ms rendering
    const localItem = localProducts.find((p) => String(p.id) === String(id));
    if (localItem) {
      setProduct(localItem);
      setIsLoading(false);
    }

    // Background fetch for fresh API data
    get(`/products/${id}`)
      .then((res: any) => {
        if (res && res.id) {
          setProduct({
            ...res,
            id: String(res.id),
            image: res.image || res.image_url,
            originalPrice: res.originalPrice || res.original_price || Math.round(res.price * 1.25),
            discountPercent: res.discountPercent || res.discount_percent || 15,
            rating: res.rating || 4.8,
            reviewsCount: res.reviewsCount || res.reviews_count || 97,
          });
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [id]);

  // Fallback item
  const localItem = localProducts.find((p) => String(p.id) === String(id));
  const item = product || localItem || {
    id: id || 'p1',
    name: 'Fresh Farm Red Onions (1 kg)',
    price: 28,
    originalPrice: 40,
    discountPercent: 30,
    weight: '1 kg',
    image: 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=800',
    category: 'produce',
    description: 'High quality fresh farm red onions. Handpicked and hygienically packed for optimal freshness.',
    deliveryTimeMinutes: 10,
    rating: 4.5,
    reviewsCount: 97,
  };

  if (isLoading && !item) return <LoadingView message="Fetching Product Details..." />;

  const cartItem = cart.find((ci) => ci.product.id === item.id);
  const qty = cartItem ? cartItem.quantity : 0;
  const isWishlisted = isInWishlist(item.id);

  // Gallery image variants
  const galleryImages = [
    item.image,
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80',
    'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=400&q=80',
    'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&q=80',
  ];

  // Pack size options
  const packOptions = [
    {
      size: '1 kg',
      price: item.price,
      mrp: item.originalPrice || Math.round(item.price * 1.4),
      discount: `${item.discountPercent || 30}% OFF`,
      tag: '',
    },
    {
      size: '5 kg Value Pack',
      price: Math.round(item.price * 4.4),
      mrp: Math.round((item.originalPrice || item.price * 1.4) * 5),
      discount: '34% OFF',
      tag: 'VALUE',
    },
    {
      size: '10 kg Mega Pack',
      price: Math.round(item.price * 8.4),
      mrp: Math.round((item.originalPrice || item.price * 1.4) * 10),
      discount: '40% OFF',
      tag: 'MEGA',
    },
  ];

  const selectedPack = packOptions[selectedPackIndex];
  const currentPrice = selectedPack.price;
  const currentMRP = selectedPack.mrp;
  const savingsAmount = currentMRP - currentPrice;

  // Bundle items for "Frequently Bought Together"
  const bundleItems = [
    item,
    localProducts[1] || item,
    localProducts[2] || item,
  ];
  const bundlePrice = 1320;
  const bundleMRP = 1552;
  const bundleSavings = bundleMRP - bundlePrice;

  // Similar products
  const similarProducts = localProducts.filter((p) => p.id !== item.id).slice(0, 4);

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeaderContainer}>
        <View style={styles.topLocationRow}>
          {/* Logo */}
          <Image
            source={require('../../../assets/grabit-logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />

          {/* Location Trigger */}
          <Pressable style={styles.headerLocBtn} onPress={() => router.push('/customer' as any)}>
            <MapPin size={14} color="#0066FF" style={{ marginRight: 4 }} />
            <Text style={styles.headerLocText} numberOfLines={1}>
              Rabyappanahalli, Bengaluru
            </Text>
            <ChevronDown size={14} color="#0066FF" style={{ marginLeft: 2 }} />
          </Pressable>

          {/* Right Action Icons */}
          <View style={styles.headerIconsRow}>
            <Pressable style={styles.headerIconBtn} onPress={() => router.push('/customer/notifications' as any)}>
              <Bell size={18} color="#0066FF" />
            </Pressable>
            <Pressable style={styles.headerIconBtn} onPress={() => router.push('/customer/cart' as any)}>
              <Calendar size={18} color="#0066FF" />
            </Pressable>
          </View>
        </View>

        {/* Search Bar Row */}
        <View style={[styles.searchRow, { zIndex: 9999 }]}>
          <Pressable style={styles.searchBackBtn} onPress={() => router.back()}>
            <ArrowLeft size={18} color="#475569" />
          </Pressable>
          <View style={{ flex: 1, zIndex: 9999 }}>
            <SearchAutocomplete placeholder="Search for milk, butter, chips, snacks..." />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Main Product Image Carousel */}
        <View style={styles.galleryCard}>
          {/* Top Left Discount Tag */}
          <View style={styles.saveTagBadge}>
            <Text style={styles.saveTagText}>SAVE {selectedPack.discount}</Text>
          </View>

          {/* Top Right Actions (Wishlist & Share) */}
          <View style={styles.topGalleryActions}>
            <Pressable style={styles.galleryActionCircle} onPress={() => toggleWishlist(item)}>
              <Heart
                size={18}
                color={isWishlisted ? '#EF4444' : '#64748B'}
                fill={isWishlisted ? '#EF4444' : 'transparent'}
              />
            </Pressable>
            <Pressable
              style={styles.galleryActionCircle}
              onPress={() => showToast('Product link copied to clipboard', 'info')}
            >
              <Share2 size={18} color="#64748B" />
            </Pressable>
          </View>

          {/* Main Image */}
          <View style={styles.mainImageWrapper}>
            <Image
              source={resolveProductImage(galleryImages[selectedImageIndex])}
              style={styles.mainImage}
              resizeMode="contain"
              fadeDuration={0}
            />

            {/* Left Carousel Arrow */}
            <Pressable
              style={[styles.carouselArrow, styles.carouselArrowLeft]}
              onPress={() =>
                setSelectedImageIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1))
              }
            >
              <ChevronLeft size={18} color="#475569" />
            </Pressable>

            {/* Right Carousel Arrow */}
            <Pressable
              style={[styles.carouselArrow, styles.carouselArrowRight]}
              onPress={() =>
                setSelectedImageIndex((prev) => (prev === galleryImages.length - 1 ? 0 : prev + 1))
              }
            >
              <ChevronRight size={18} color="#475569" />
            </Pressable>

            {/* Counter Pill */}
            <View style={styles.counterPill}>
              <Text style={styles.counterPillText}>
                {selectedImageIndex + 1}/{galleryImages.length}
              </Text>
            </View>
          </View>

          {/* Thumbnail Gallery Row */}
          <View style={styles.thumbnailRow}>
            {galleryImages.map((imgUri, idx) => {
              const isSelected = selectedImageIndex === idx;
              return (
                <Pressable
                  key={idx}
                  style={[styles.thumbnailBox, isSelected && styles.thumbnailBoxActive]}
                  onPress={() => setSelectedImageIndex(idx)}
                >
                  <Image source={resolveProductImage(imgUri)} style={styles.thumbnailImg} resizeMode="cover" fadeDuration={0} />
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Product Title & Rating */}
        <View style={styles.productDetailsContainer}>
          <Text style={styles.productTitle}>{item.name}</Text>

          {/* Ratings Pill */}
          <View style={styles.ratingRow}>
            <View style={styles.ratingGreenBadge}>
              <Text style={styles.ratingBadgeText}>4.5</Text>
              <Star size={11} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 2 }} />
            </View>
            <Text style={styles.ratingSubText}>
              97 Verified Ratings & 2 Reviews <Text style={{ color: '#0066FF' }}>→</Text>
            </Text>
          </View>

          {/* Select Pack Size Section */}
          <View style={styles.packSection}>
            <Text style={styles.packSectionTitle}>SELECT PACK SIZE</Text>
            <View style={styles.packRow}>
              {packOptions.map((pack, index) => {
                const isSelected = selectedPackIndex === index;
                return (
                  <Pressable
                    key={index}
                    style={[styles.packCard, isSelected && styles.packCardActive]}
                    onPress={() => setSelectedPackIndex(index)}
                  >
                    <Text style={[styles.packSizeText, isSelected && styles.packSizeTextActive]}>
                      {pack.size}
                    </Text>
                    <Text style={[styles.packPriceText, isSelected && styles.packPriceTextActive]}>
                      ₹{pack.price}
                    </Text>
                    <View style={[styles.packDiscBadge, isSelected && styles.packDiscBadgeActive]}>
                      <Text style={[styles.packDiscText, isSelected && styles.packDiscTextActive]}>
                        {pack.discount}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Pricing & Savings Box */}
          <View style={styles.priceCard}>
            <View style={styles.priceTopLine}>
              <Text style={styles.mainPriceText}>₹{currentPrice}</Text>
              <Text style={styles.mrpText}>MRP ₹{currentMRP}</Text>
              <View style={styles.savingsPill}>
                <Text style={styles.savingsPillText}>SAVE ₹{savingsAmount} ({selectedPack.discount})</Text>
              </View>
            </View>
            <Text style={styles.priceTaxSub}>
              Includes of all taxes • Best Price Guaranteed for {selectedPack.size}
            </Text>
          </View>

          {/* Express Delivery Banner */}
          <View style={styles.expressBannerCard}>
            <View style={styles.expressBannerLeftIcon}>
              <Zap size={18} color="#FFFFFF" fill="#FFFFFF" />
            </View>
            <View style={styles.expressBannerTextCol}>
              <Text style={styles.expressBannerTitle}>Superfast 30-45 Min Express Delivery</Text>
              <Text style={styles.expressBannerSub}>
                Delivering in Rabyappanahalli, Bengaluru 560048 • <Text style={{ color: '#0066FF', fontWeight: '700' }}>Tap to change</Text>
              </Text>
            </View>
          </View>

          {/* Dual Action Buttons Row */}
          <View style={styles.actionButtonsRow}>
            {qty === 0 ? (
              <Pressable
                style={styles.addCartPrimaryBtn}
                onPress={() => {
                  addToCart({ ...item, price: currentPrice, weight: selectedPack.size });
                  showToast(`Added ${selectedPack.size} to cart!`, 'success');
                }}
              >
                <ShoppingBag size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.addCartPrimaryText}>ADD TO CART</Text>
              </Pressable>
            ) : (
              <View style={styles.actionQtyStepper}>
                <Pressable
                  style={styles.actionStepperBtn}
                  onPress={() => updateQuantity(item.id, qty - 1)}
                >
                  <Minus size={16} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.actionQtyVal}>{qty}</Text>
                <Pressable
                  style={styles.actionStepperBtn}
                  onPress={() => updateQuantity(item.id, qty + 1)}
                >
                  <Plus size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            )}

            <Pressable
              style={styles.buyNowBtn}
              onPress={() => {
                if (qty === 0) {
                  addToCart({ ...item, price: currentPrice, weight: selectedPack.size });
                }
                router.push('/customer/checkout' as any);
              }}
            >
              <Zap size={18} color="#FFFFFF" fill="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.buyNowText}>BUY NOW</Text>
            </Pressable>
          </View>

          {/* 3 Trust Badges */}
          <View style={styles.trustBadgesRow}>
            <View style={styles.trustItem}>
              <ShieldCheck size={22} color="#0066FF" />
              <Text style={styles.trustItemTitle}>100% Original</Text>
              <Text style={styles.trustItemSub}>Directly from brand</Text>
            </View>
            <View style={styles.trustItemDivider} />
            <View style={styles.trustItem}>
              <Leaf size={22} color="#10B981" />
              <Text style={styles.trustItemTitle}>Freshness Guaranteed</Text>
              <Text style={styles.trustItemSub}>Hygienically packed</Text>
            </View>
            <View style={styles.trustItemDivider} />
            <View style={styles.trustItem}>
              <RotateCcw size={22} color="#F59E0B" />
              <Text style={styles.trustItemTitle}>Easy Returns</Text>
              <Text style={styles.trustItemSub}>Instant refund to wallet</Text>
            </View>
          </View>

          {/* Details / Reviews / Nutritional Tabs */}
          <View style={styles.tabHeaderRow}>
            <Pressable
              style={[styles.tabHeadBtn, activeTab === 'details' && styles.tabHeadBtnActive]}
              onPress={() => setActiveTab('details')}
            >
              <Text style={[styles.tabHeadText, activeTab === 'details' && styles.tabHeadTextActive]}>
                Product Details
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabHeadBtn, activeTab === 'reviews' && styles.tabHeadBtnActive]}
              onPress={() => setActiveTab('reviews')}
            >
              <Text style={[styles.tabHeadText, activeTab === 'reviews' && styles.tabHeadTextActive]}>
                Customer Reviews
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabHeadBtn, activeTab === 'nutritional' && styles.tabHeadBtnActive]}
              onPress={() => setActiveTab('nutritional')}
            >
              <Text style={[styles.tabHeadText, activeTab === 'nutritional' && styles.tabHeadTextActive]}>
                Nutritional
              </Text>
            </Pressable>
          </View>

          {/* Tab Content */}
          {activeTab === 'details' && (
            <View style={styles.tabBodyContainer}>
              {/* Highlights Block */}
              <Text style={styles.infoBlockHeading}>Highlights</Text>
              <View style={styles.infoGrid}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Brand</Text>
                  <Text style={styles.infoValueBold}>GrabIt Fresh</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Product Type</Text>
                  <Text style={styles.infoValue}>{item.category || 'produce'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Dietary Preference</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.vegDotIcon}>
                      <View style={styles.vegDotInner} />
                    </View>
                    <Text style={[styles.infoValueBold, { marginLeft: 6 }]}>Veg</Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Flavour</Text>
                  <Text style={styles.infoValue}>Fresh Farm Selection</Text>
                </View>

                {isHighlightsExpanded && (
                  <>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Storage Instruction</Text>
                      <Text style={styles.infoValue}>Store in a cool dry place</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Shelf Life</Text>
                      <Text style={styles.infoValue}>7 Days from Packing</Text>
                    </View>
                  </>
                )}
              </View>

              <Pressable
                style={styles.viewMorePillBtn}
                onPress={() => setIsHighlightsExpanded(!isHighlightsExpanded)}
              >
                <Text style={styles.viewMorePillText}>
                  {isHighlightsExpanded ? 'View Less ▲' : 'View More ▼'}
                </Text>
              </Pressable>

              {/* Information Block */}
              <Text style={[styles.infoBlockHeading, { marginTop: 20 }]}>Information</Text>
              <Text style={styles.infoSubText}>
                Disclaimer:{'\n'}
                All images are for representational purposes only. It is advised that you read the label and manufacturing details, directions for use, allergen information, health and nutritional claims before consuming the product.
              </Text>

              {isInfoExpanded && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.infoSubTextBold}>Customer Care Details:</Text>
                  <Text style={styles.infoSubText}>In case of any issue, contact us.</Text>
                  <Text style={styles.infoSubTextLink}>E-mail address: support@grabitnow.com</Text>
                </View>
              )}

              <Pressable
                style={styles.viewMorePillBtn}
                onPress={() => setIsInfoExpanded(!isInfoExpanded)}
              >
                <Text style={styles.viewMorePillText}>
                  {isInfoExpanded ? 'View Less ▲' : 'View More ▼'}
                </Text>
              </Pressable>
            </View>
          )}

          {activeTab === 'reviews' && (
            <View style={styles.tabBodyContainer}>
              <Text style={styles.infoBlockHeading}>Customer Reviews (97)</Text>
              <View style={styles.reviewCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.reviewerName}>Ramesh K.</Text>
                  <View style={styles.ratingGreenBadge}>
                    <Text style={styles.ratingBadgeText}>5.0 ★</Text>
                  </View>
                </View>
                <Text style={styles.reviewComment}>Extremely fresh onions, delivered within 12 minutes! Super crisp quality.</Text>
              </View>
              <View style={styles.reviewCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.reviewerName}>Priya Sharma</Text>
                  <View style={styles.ratingGreenBadge}>
                    <Text style={styles.ratingBadgeText}>4.0 ★</Text>
                  </View>
                </View>
                <Text style={styles.reviewComment}>Good value pack. Delivered on time and clean packaging.</Text>
              </View>
            </View>
          )}

          {activeTab === 'nutritional' && (
            <View style={styles.tabBodyContainer}>
              <Text style={styles.infoBlockHeading}>Nutritional Information (per 100g)</Text>
              <View style={styles.infoGrid}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Energy</Text>
                  <Text style={styles.infoValueBold}>40 kcal</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Carbohydrates</Text>
                  <Text style={styles.infoValue}>9.3 g</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Protein</Text>
                  <Text style={styles.infoValue}>1.1 g</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Dietary Fiber</Text>
                  <Text style={styles.infoValue}>1.7 g</Text>
                </View>
              </View>
            </View>
          )}

          {/* Frequently Bought Together (Smart Bundle Card) */}
          <View style={styles.smartBundleCard}>
            <View style={styles.bundleHeaderRow}>
              <View style={styles.bundleBadge}>
                <Text style={styles.bundleBadgeText}>SMART BUNDLE</Text>
              </View>
              <Text style={styles.bundleTitle}>Frequently Bought Together</Text>
            </View>

            {/* Product Thumbnails Row */}
            <View style={styles.bundleThumbRow}>
              <Image source={resolveProductImage(item.image)} style={styles.bundleImg} fadeDuration={0} />
              <Text style={styles.bundlePlus}>+</Text>
              <Image source={resolveProductImage(bundleItems[1].image)} style={styles.bundleImg} fadeDuration={0} />
              <Text style={styles.bundlePlus}>+</Text>
              <Image source={resolveProductImage(bundleItems[2].image)} style={styles.bundleImg} fadeDuration={0} />
            </View>

            <View style={styles.bundlePriceRow}>
              <Text style={styles.bundlePriceLabel}>Bundle Price (3 Items):</Text>
              <Text style={styles.bundleMainPrice}>₹{bundlePrice}</Text>
              <Text style={styles.bundleMrpPrice}>₹{bundleMRP}</Text>
              <Text style={styles.bundleSaveText}>Save ₹{bundleSavings}</Text>
            </View>

            <Pressable
              style={styles.addBundleBtn}
              onPress={() => {
                bundleItems.forEach((b) => addToCart(b));
                showToast('Added 3 items bundle to cart!', 'success');
              }}
            >
              <Text style={styles.addBundleBtnText}>Add 3 Items to Cart (₹{bundlePrice})</Text>
            </Pressable>
          </View>

          {/* Similar Products You Might Like */}
          <View style={styles.similarSection}>
            <View style={styles.similarHeaderRow}>
              <Text style={styles.similarTitle}>Similar Products You Might Like</Text>
              <Pressable onPress={() => router.push('/customer/categories' as any)}>
                <Text style={styles.similarViewAll}>View All</Text>
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarScroll}>
              {similarProducts.map((simItem) => (
                <Pressable
                  key={simItem.id}
                  style={styles.simCard}
                  onPress={() => router.push(`/customer/product/${simItem.id}` as any)}
                >
                  <View style={styles.simDiscBadge}>
                    <Text style={styles.simDiscText}>{simItem.discountPercent || 15}% OFF</Text>
                  </View>
                  <Image source={resolveProductImage(simItem.image)} style={styles.simImg} resizeMode="contain" fadeDuration={0} />
                  <Text style={styles.simName} numberOfLines={2}>{simItem.name}</Text>

                  <View style={styles.simRatingRow}>
                    <Text style={styles.simRatingText}>★ 4.5</Text>
                  </View>

                  <View style={styles.simPriceRow}>
                    <Text style={styles.simPrice}>₹{simItem.price}</Text>
                    {simItem.originalPrice ? (
                      <Text style={styles.simMrp}>₹{simItem.originalPrice}</Text>
                    ) : null}
                  </View>

                  <Pressable
                    style={styles.simAddBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      addToCart(simItem);
                      showToast(`Added ${simItem.name} to cart`, 'success');
                    }}
                  >
                    <Text style={styles.simAddBtnText}>Add to Cart</Text>
                  </Pressable>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeaderContainer: {
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    ...SHADOWS.sm,
    zIndex: 10,
  },
  topLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  headerLogo: {
    width: 70,
    height: 24,
  },
  headerLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    maxWidth: '55%',
  },
  headerLocText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  searchBackBtn: {
    padding: 6,
    marginRight: 6,
  },
  searchInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchPlaceholder: {
    fontSize: 13,
    color: '#64748B',
  },
  scrollContent: {
    paddingBottom: 80,
  },

  /* Gallery Styling */
  galleryCard: {
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    position: 'relative',
  },
  saveTagBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 5,
  },
  saveTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  topGalleryActions: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
    zIndex: 5,
  },
  galleryActionCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...SHADOWS.sm,
  },
  mainImageWrapper: {
    width: '100%',
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  mainImage: {
    width: '75%',
    height: '90%',
  },
  carouselArrow: {
    position: 'absolute',
    top: '45%',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  carouselArrowLeft: {
    left: 12,
  },
  carouselArrowRight: {
    right: 12,
  },
  counterPill: {
    position: 'absolute',
    bottom: 8,
    right: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  counterPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  thumbnailRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  thumbnailBox: {
    width: 54,
    height: 54,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  thumbnailBoxActive: {
    borderColor: '#0066FF',
    borderWidth: 2,
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
  },

  /* Product Info */
  productDetailsContainer: {
    padding: SPACING.md,
  },
  productTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 25,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  ratingGreenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  ratingBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  ratingSubText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },

  /* Pack Selector */
  packSection: {
    marginBottom: 16,
  },
  packSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  packRow: {
    flexDirection: 'row',
    gap: 8,
  },
  packCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  packCardActive: {
    backgroundColor: '#F0F7FF',
    borderColor: '#0066FF',
  },
  packSizeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  packSizeTextActive: {
    color: '#0066FF',
  },
  packPriceText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  packPriceTextActive: {
    color: '#0066FF',
  },
  packDiscBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  packDiscBadgeActive: {
    backgroundColor: '#DBEAFE',
  },
  packDiscText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  packDiscTextActive: {
    color: '#0066FF',
  },

  /* Price Card */
  priceCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  priceTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainPriceText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    marginRight: 8,
  },
  mrpText: {
    fontSize: 14,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  savingsPill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  savingsPillText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '800',
  },
  priceTaxSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },

  /* Express Delivery Banner */
  expressBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 16,
  },
  expressBannerLeftIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  expressBannerTextCol: {
    flex: 1,
  },
  expressBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
  },
  expressBannerSub: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
  },

  /* Dual Action Buttons */
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  addCartPrimaryBtn: {
    flex: 1,
    height: 46,
    backgroundColor: '#0066FF',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
  },
  addCartPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  actionQtyStepper: {
    flex: 1,
    height: 46,
    backgroundColor: '#0066FF',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  actionStepperBtn: {
    padding: 6,
  },
  actionQtyVal: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  buyNowBtn: {
    flex: 1,
    height: 46,
    backgroundColor: '#10B981',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
  },
  buyNowText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  /* Trust Badges */
  trustBadgesRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 20,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  trustItem: {
    flex: 1,
    alignItems: 'center',
  },
  trustItemTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  trustItemSub: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
  },
  trustItemDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E2E8F0',
  },

  /* Tabs Section */
  tabHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  tabHeadBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabHeadBtnActive: {
    backgroundColor: '#FFFFFF',
    ...SHADOWS.sm,
  },
  tabHeadText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabHeadTextActive: {
    color: '#0066FF',
  },
  tabBodyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 20,
  },
  infoBlockHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  infoGrid: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 12,
    color: '#0F172A',
  },
  infoValueBold: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  vegDotIcon: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
  },
  vegDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  viewMorePillBtn: {
    alignSelf: 'center',
    marginTop: 10,
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
  },
  viewMorePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E53E3E',
  },
  infoSubText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  infoSubTextBold: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  infoSubTextLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0066FF',
    marginTop: 2,
  },
  reviewCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  reviewerName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  reviewComment: {
    fontSize: 11,
    color: '#475569',
    marginTop: 4,
  },

  /* Frequently Bought Together (Smart Bundle Card) */
  smartBundleCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    marginBottom: 20,
  },
  bundleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bundleBadge: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
  },
  bundleBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  bundleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#78350F',
  },
  bundleThumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  bundleImg: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  bundlePlus: {
    fontSize: 18,
    fontWeight: '900',
    color: '#D97706',
  },
  bundlePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 6,
  },
  bundlePriceLabel: {
    fontSize: 11,
    color: '#78350F',
  },
  bundleMainPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  bundleMrpPrice: {
    fontSize: 12,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  bundleSaveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  addBundleBtn: {
    backgroundColor: '#FF6B00',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  addBundleBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  /* Similar Products */
  similarSection: {
    marginBottom: 20,
  },
  similarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  similarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  similarViewAll: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0066FF',
  },
  similarScroll: {
    gap: 12,
  },
  simCard: {
    width: 145,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  simDiscBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#DC2626',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 2,
  },
  simDiscText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  simImg: {
    width: '100%',
    height: 90,
    marginBottom: 6,
  },
  simName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 16,
    height: 32,
  },
  simRatingRow: {
    marginVertical: 4,
  },
  simRatingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  simPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  simPrice: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  simMrp: {
    fontSize: 10,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  simAddBtn: {
    borderWidth: 1,
    borderColor: '#0066FF',
    borderRadius: 8,
    paddingVertical: 5,
    alignItems: 'center',
  },
  simAddBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0066FF',
  },

  /* Fixed Bottom Nav Bar */
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 55,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    zIndex: 100,
  },
  bottomNavTab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomNavText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
});
