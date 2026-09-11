import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  Image,
  TextInput,
  StyleSheet,
  RefreshControl,
  Modal,
} from 'react-native';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useLocation } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ProductCard } from '../../components/ProductCard';
import { SearchAutocomplete } from '../../components/SearchAutocomplete';
import { NotificationModal } from '../../components/NotificationModal';
import ProductSuggestionModal from '../../components/ProductSuggestionModal';
import { getRealUserNotifications } from '../../utils/userNotifications';
import { get } from '../../services/api';
import { Product, Category } from '../../types';
import { products as localProducts } from '../../data/products';
import { categories as localCategories, getCanonicalSlug } from '../../data/categories';
import { getCloudinaryUrl, getValidImage, optimizeImageUrl, DEFAULT_FALLBACK_IMAGE } from '../../services/cloudinary';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import {
  Search,
  MapPin,
  Bell,
  ShoppingBag,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ArrowRight,
  Star,
  Heart,
  Zap,
  Lightbulb,
  MessageSquare,
  Send,
  CheckCircle2,
  Sparkles,
  X,
  Navigation,
  Edit,
  Plus,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';

const getCategoryIconSource = (cat: any) => {
  const imageStr = cat.image || cat.image_url || '';
  const iconStr = cat.icon || '';
  const slug = (cat.slug || cat.id || '').toLowerCase();
  const canonicalSlug = getCanonicalSlug(slug);

  // 1. Direct Cloudinary or HTTP image URL
  if (typeof imageStr === 'string' && (imageStr.startsWith('http://') || imageStr.startsWith('https://'))) {
    return { uri: optimizeImageUrl(imageStr, 150) };
  }
  if (typeof iconStr === 'string' && (iconStr.startsWith('http://') || iconStr.startsWith('https://'))) {
    return { uri: optimizeImageUrl(iconStr, 150) };
  }

  // 2. Cloudinary asset mapping lookup
  const targetStr = imageStr || iconStr || canonicalSlug || slug;
  if (targetStr) {
    const cloudUrl = getValidImage(targetStr);
    if (cloudUrl && cloudUrl !== DEFAULT_FALLBACK_IMAGE) {
      return { uri: optimizeImageUrl(cloudUrl, 150) };
    }
  }

  return { uri: DEFAULT_FALLBACK_IMAGE };
};

const heroSlides = [
  {
    bg: '#EEF4FF',
    borderColor: '#BFDBFE',
    badge: '⚡ 30-45 MIN EXPRESS DELIVERY',
    badgeColor: '#0066FF',
    title: 'Discover. Shop. Save More.',
    subtitle: 'Top brands, best prices & exclusive hyperlocal offers on everything you love.',
    btn1Text: 'Shop Now',
    btn1Bg: '#0066FF',
    btn1Link: '/customer/categories',
    btn2Text: 'Explore Offers',
    btn2Color: '#0066FF',
    btn2Link: '/customer/trending',
    image: 'https://res.cloudinary.com/hmx3azp6/image/upload/q_auto,f_auto/grabit_media/savings_basket_clock_transparent.png',
  },
  {
    bg: '#DCFCE7',
    borderColor: '#86EFAC',
    badge: '🍃 FARM FRESH GUARANTEED',
    badgeColor: '#059669',
    title: 'Fresh Groceries, Delivered Fresh',
    subtitle: 'Handpicked organic fruits, vegetables & daily essentials delivered to your doorstep.',
    btn1Text: 'Shop Groceries',
    btn1Bg: '#059669',
    btn1Link: '/customer/category/produce',
    btn2Text: 'Explore Deals',
    btn2Color: '#059669',
    btn2Link: '/customer/category/produce',
    image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645084/grabit_media/fresh_groceries_basket_only.png',
  },
  {
    bg: '#FFF7ED',
    borderColor: '#FDBA74',
    badge: '⭐ CRUNCHY. TASTY. IRRESISTIBLE.',
    badgeColor: '#D97706',
    title: 'Snacks for Every Craving',
    subtitle: "From popcorn & crunchy chips to cookies, nachos & treats – we've got it all.",
    btn1Text: 'Shop Snacks',
    btn1Bg: '#D97706',
    btn1Link: '/customer/category/snacks-munchies',
    btn2Text: 'View All',
    btn2Color: '#D97706',
    btn2Link: '/customer/category/snacks-munchies',
    image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645053/grabit_media/category_snacks_banner.png',
  },
];

const quickCatTabs = [
  { id: 'All', label: 'All', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645084/grabit_media/fresh_groceries_basket_only.png', slug: 'all', color: '#0071E3' },
  { id: 'Fresh', label: 'Fresh', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645128/grabit_media/apples_real.jpg', slug: 'produce', color: '#34C759' },
  { id: 'Dairy', label: 'Dairy', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645078/grabit_media/butter_real.jpg', slug: 'dairy-bakery', color: '#0284C7' },
  { id: 'Snacks', label: 'Snacks', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645100/grabit_media/lays_magic_masala.png', slug: 'snacks-munchies', color: '#D97706' },
  { id: 'Drinks', label: 'Drinks', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645111/grabit_media/coca_cola_real.jpg', slug: 'beverages', color: '#FF3B30' },
  { id: 'Atta', label: 'Atta', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645070/grabit_media/atta_real.jpg', slug: 'staples', color: '#65A30D' },
  { id: 'Sweets', label: 'Sweets', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645118/grabit_media/cadbury_silk_real.jpg', slug: 'chocolates', color: '#7E22CE' },
  { id: 'Care', label: 'Care', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645135/grabit_media/dettol_handwash_real.jpg', slug: 'personal-care', color: '#EC4899' },
  { id: 'Household', label: 'Household', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645057/grabit_media/surf_excel_real.jpg', slug: 'household', color: '#2563EB' },
  { id: 'Tea & Coffee', label: 'Tea & Coffee', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645059/grabit_media/tea_coffee_hero_transparent.png', slug: 'tea-coffee', color: '#854D0E' },
  { id: 'Instant Food', label: 'Instant Food', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645080/grabit_media/instant_noodles_hero_transparent.png', slug: 'instant-food', color: '#C2410C' },
  { id: 'Biscuits', label: 'Biscuits', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645050/grabit_media/oreo_biscuits_real.jpg', slug: 'biscuits', color: '#D97706' },
  { id: 'Oils & Ghee', label: 'Oils & Ghee', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645142/grabit_media/fortune_oil_real.jpg', slug: 'oil', color: '#CA8A04' },
  { id: 'Electronics', label: 'Electronics', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645110/grabit_media/electronics_hero_transparent.png', slug: 'electronics', color: '#8B5CF6' },
  { id: 'Fashion', label: 'Fashion', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645079/grabit_media/sneakers.jpg', slug: 'fashion', color: '#F43F5E' },
  { id: 'Baby Care', label: 'Baby Care', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067213/grabit_media/category_baby_care.jpg', slug: 'baby-care', color: '#0284C7' },
  { id: 'Pet Care', label: 'Pet Care', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067219/grabit_media/category_pet_care.jpg', slug: 'pet-care', color: '#EA580C' },
  { id: 'Beauty', label: 'Beauty', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067215/grabit_media/category_beauty_cosmetics.jpg', slug: 'beauty-cosmetics', color: '#E11D48' },
  { id: 'Pharma', label: 'Pharma', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067216/grabit_media/category_health_wellness.jpg', slug: 'health-wellness', color: '#16A34A' },
  { id: 'Meat & Seafood', label: 'Meat & Seafood', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067218/grabit_media/category_meat_seafood.jpg', slug: 'meat-seafood', color: '#DC2626' },
  { id: 'Kitchen', label: 'Kitchen', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067217/grabit_media/category_home_kitchen.jpg', slug: 'home-kitchen', color: '#EA580C' },
  { id: 'Stationery', label: 'Stationery', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067224/grabit_media/category_stationery_office.jpg', slug: 'stationery-office', color: '#2563EB' },
  { id: 'Fitness', label: 'Fitness', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067223/grabit_media/category_sports_fitness.jpg', slug: 'sports-fitness', color: '#16A34A' },
  { id: 'Toys', label: 'Toys', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067225/grabit_media/category_toys_games.jpg', slug: 'toys-games', color: '#9333EA' },
  { id: 'Pooja', label: 'Pooja', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067220/grabit_media/category_pooja_needs.jpg', slug: 'pooja-needs', color: '#D97706' },
];

/**
 * Isolated DealCountdownBadge: maintains its own 1-second interval so the
 * 2000-line CustomerHomeScreen does NOT re-render every second.
 */
const DealCountdownBadge = React.memo(() => {
  const [timeLeft, setTimeLeft] = useState({ hours: '02', minutes: '04', seconds: '49' });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const end = new Date(now);
      end.setHours((Math.floor(now.getHours() / 3) + 1) * 3, 0, 0, 0);
      const diff = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
      const hours = String(Math.floor(diff / 3600)).padStart(2, '0');
      const minutes = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
      const seconds = String(diff % 60).padStart(2, '0');
      setTimeLeft({ hours, minutes, seconds });
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.timerBadge}>
      <Text style={styles.timerBadgeLabel}>Ends in</Text>
      <Text style={styles.timerBadgeVal}>
        {timeLeft.hours} : {timeLeft.minutes} : {timeLeft.seconds}
      </Text>
    </View>
  );
});

/**
 * Isolated HeroCarousel: maintains its own 4-second slide timer so auto-scrolling
 * does NOT cause full CustomerHomeScreen re-renders.
 */
const HeroCarousel = React.memo(() => {
  const router = useRouter();
  const [activeSlide, setActiveSlide] = useState(0);
  const slideTimerRef = useRef<any>(null);
  const touchStartXRef = useRef<number>(0);

  const startSlideTimer = useCallback(() => {
    if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    slideTimerRef.current = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 4000);
  }, []);

  const resetSlideTimer = useCallback(() => {
    startSlideTimer();
  }, [startSlideTimer]);

  const handleNextSlide = useCallback(() => {
    setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    resetSlideTimer();
  }, [resetSlideTimer]);

  const handlePrevSlide = useCallback(() => {
    setActiveSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
    resetSlideTimer();
  }, [resetSlideTimer]);

  const handleDotSelect = useCallback(
    (idx: number) => {
      setActiveSlide(idx);
      resetSlideTimer();
    },
    [resetSlideTimer]
  );

  useEffect(() => {
    startSlideTimer();
    return () => {
      if (slideTimerRef.current) {
        clearInterval(slideTimerRef.current);
        slideTimerRef.current = null;
      }
    };
  }, [startSlideTimer]);

  const currentSlide = heroSlides[activeSlide] || heroSlides[0];

  return (
    <View
      style={[
        styles.heroSlide,
        { backgroundColor: currentSlide.bg, borderColor: currentSlide.borderColor },
      ]}
      onTouchStart={(e) => {
        touchStartXRef.current = e.nativeEvent.pageX;
      }}
      onTouchEnd={(e) => {
        const deltaX = e.nativeEvent.pageX - touchStartXRef.current;
        if (deltaX < -35) {
          handleNextSlide();
        } else if (deltaX > 35) {
          handlePrevSlide();
        }
      }}
    >
      <View style={styles.heroBadge}>
        <Text style={[styles.heroBadgeText, { color: currentSlide.badgeColor }]}>
          {currentSlide.badge}
        </Text>
      </View>

      {currentSlide.title === 'Discover. Shop. Save More.' ? (
        <Text style={styles.heroTitle}>
          Discover. <Text style={{ color: '#0066FF' }}>Shop.</Text> Save More.
        </Text>
      ) : (
        <Text style={styles.heroTitle}>{currentSlide.title}</Text>
      )}

      <Text style={styles.heroSub}>{currentSlide.subtitle}</Text>

      <View style={styles.heroBtnRow}>
        <Pressable
          style={({ pressed }) => [
            styles.heroBtn1,
            { backgroundColor: currentSlide.btn1Bg },
            pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
          ]}
          onPress={() => {
            resetSlideTimer();
            router.push(currentSlide.btn1Link as any);
          }}
        >
          <Text style={styles.heroBtn1Text}>{currentSlide.btn1Text}</Text>
          <ArrowRight size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.heroBtn2,
            { borderColor: currentSlide.btn1Bg },
            pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
          ]}
          onPress={() => {
            resetSlideTimer();
            router.push(currentSlide.btn2Link as any);
          }}
        >
          <Text style={[styles.heroBtn2Text, { color: currentSlide.btn2Color }]}>
            {currentSlide.btn2Text}
          </Text>
        </Pressable>
      </View>

      <Image
        source={typeof currentSlide.image === 'number' || typeof currentSlide.image === 'object' ? currentSlide.image : { uri: optimizeImageUrl(currentSlide.image, 600) }}
        style={styles.heroImage}
        resizeMode="contain"
        fadeDuration={0}
      />

      {/* Left / Right Carousel Arrows */}
      <Pressable
        style={({ pressed }) => [
          styles.carouselArrowLeft,
          pressed && { opacity: 0.6, transform: [{ scale: 0.9 }] },
        ]}
        onPress={handlePrevSlide}
      >
        <ChevronLeft size={16} color="#0F172A" />
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.carouselArrowRight,
          pressed && { opacity: 0.6, transform: [{ scale: 0.9 }] },
        ]}
        onPress={handleNextSlide}
      >
        <ChevronRight size={16} color="#0F172A" />
      </Pressable>

      {/* Carousel Dots */}
      <View style={styles.dotsRow}>
        {heroSlides.map((s, idx) => (
          <Pressable
            key={idx}
            onPress={() => handleDotSelect(idx)}
            hitSlop={8}
            style={[
              styles.dot,
              activeSlide === idx && [
                styles.dotActive,
                { backgroundColor: s.badgeColor || '#0066FF', width: 20 },
              ],
            ]}
          />
        ))}
      </View>
    </View>
  );
});

export default function CustomerHomeScreen() {
  const router = useRouter();
  const { totalItems, addToCart } = useCart();
  const { wishlist } = useWishlist();
  const { currentAddress, fetchCurrentLocation } = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [categories, setCategories] = useState<any[]>(localCategories);
  const [popularProducts, setPopularProducts] = useState<Product[]>(localProducts.slice(0, 8));
  const [snacksProducts, setSnacksProducts] = useState<Product[]>(localProducts.filter(p => p.category?.toLowerCase().includes('snack')).slice(0, 8));
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const [activeTab, setActiveTab] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [userRating, setUserRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isReviewSubmitted, setIsReviewSubmitted] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const lastFetchTimeRef = useRef<number>(0);

  useEffect(() => {
    getRealUserNotifications(user?.phone).then((list) => {
      setUnreadNotifCount(list.filter((n) => n.unread).length);
    });
  }, [user?.phone, isNotifModalOpen]);

  const fetchHomeData = useCallback(async (isMounted: boolean) => {
    try {
      const [catsRes, prodsRes] = await Promise.all([
        get<Category[]>('/categories'),
        get<any[]>('/products'),
      ]);

      if (!isMounted) return;
      lastFetchTimeRef.current = Date.now();

      if (catsRes && Array.isArray(catsRes) && catsRes.length > 0) {
        // Build API lookup map using canonical slug and normalized category name
        const apiCategoryMap = new Map<string, any>();
        catsRes.forEach((c: any) => {
          const rawSlug = c.slug || c.id || '';
          const canonicalKey = getCanonicalSlug(rawSlug);
          const nameKey = (c.name || '').toLowerCase().trim();
          if (canonicalKey) apiCategoryMap.set(canonicalKey, c);
          if (nameKey) apiCategoryMap.set(nameKey, c);
        });

        // Merge API response into localCategories (all 23 entries), preserving Cloudinary URLs, canonical slugs, icons, and names
        const mergedCats = localCategories.map((lc) => {
          const lcCanonical = getCanonicalSlug(lc.slug);
          const lcNameLower = lc.name.toLowerCase().trim();
          const apiMatch = apiCategoryMap.get(lcCanonical) || apiCategoryMap.get(lcNameLower);

          if (!apiMatch) return lc;

          const validApiImage =
            apiMatch.image && typeof apiMatch.image === 'string' && apiMatch.image.trim().length > 0
              ? apiMatch.image.trim()
              : apiMatch.image_url && typeof apiMatch.image_url === 'string' && apiMatch.image_url.trim().length > 0
              ? apiMatch.image_url.trim()
              : null;

          const validApiIcon =
            apiMatch.icon && typeof apiMatch.icon === 'string' && apiMatch.icon.trim().length > 0
              ? apiMatch.icon.trim()
              : null;

          return {
            ...lc,
            ...apiMatch,
            id: lc.id, // Preserve consistent local ID
            name: lc.name, // Keep clean display name
            slug: lcCanonical, // Preserve canonical slug
            image: validApiImage || lc.image, // Prefer valid API image, otherwise preserve local Cloudinary URL
            icon: validApiIcon || lc.icon, // Prefer valid API icon, otherwise preserve local icon
            itemCount: apiMatch.itemCount || apiMatch.item_count || lc.itemCount,
          };
        });

        setCategories(mergedCats);
      }

      if (prodsRes && Array.isArray(prodsRes) && prodsRes.length > 0) {
        const normalized: Product[] = prodsRes.map((p: any) => {
          const rawCatName =
            (typeof p.categories === 'object' && p.categories?.name)
              ? p.categories.name
              : (Array.isArray(p.categories) && p.categories[0]?.name)
              ? p.categories[0].name
              : p.category || p.category_slug || p.name || '';

          return {
            ...p,
            id: String(p.id),
            name: p.name,
            price: Number(p.price || 0),
            originalPrice: p.originalPrice || p.original_price || Math.round((p.price || 0) * 1.25),
            discountPercent: p.discountPercent || p.discount_percent || 15,
            image: getValidImage(p.image_url || p.image),
            category: getCanonicalSlug(rawCatName),
            inStock: p.inStock ?? (p.stock !== undefined ? p.stock > 0 : true),
            rating: p.rating || 4.8,
            reviewCount: p.reviewCount || p.reviews_count || 120,
          };
        });

        const mergedMap = new Map<string, Product>();
        localProducts.forEach((lp) => mergedMap.set(String(lp.id), lp));
        normalized.forEach((np) => mergedMap.set(String(np.id), np));

        const allProds = Array.from(mergedMap.values());
        const sorted = [...allProds].sort((a, b) => (b.rating || 0) - (a.rating || 0));
        setPopularProducts(sorted);
        const snacks = allProds.filter(p => (p.category || '').toLowerCase().includes('snack') || (p.name || '').toLowerCase().includes('maggi') || (p.name || '').toLowerCase().includes('noodle') || (p.name || '').toLowerCase().includes('chip') || (p.name || '').toLowerCase().includes('lays') || (p.name || '').toLowerCase().includes('dorito'));
        setSnacksProducts(snacks.length > 0 ? snacks : sorted);
      }
    } catch (error) {
      if (isMounted) console.log('[Home] API Fetch failed, showing local fallback data');
    } finally {
      if (isMounted) setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchHomeData(isMounted);
    return () => {
      isMounted = false;
    };
  }, [fetchHomeData]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      // Stale cache guard: skip fetching if data was fetched less than 30s ago
      if (Date.now() - lastFetchTimeRef.current > 30000) {
        fetchHomeData(isMounted);
      }
      return () => {
        isMounted = false;
      };
    }, [fetchHomeData])
  );

  useEffect(() => {
    heroSlides.forEach((slide) => {
      if (slide.image) {
        Image.prefetch(optimizeImageUrl(slide.image, 600)).catch(() => {});
      }
    });
  }, []);

  const handleClaimCoupon = () => {
    if (!emailInput || !emailInput.includes('@')) {
      showToast('Please enter a valid email address', 'error');
      return;
    }
    showToast('Flat ₹100 Coupon Code WELCOME100 sent to your email!', 'success');
    setEmailInput('');
  };

  const handleSubmitReview = () => {
    if (userRating === 0) {
      showToast('Please tap a star to rate your experience', 'error');
      return;
    }
    setIsReviewSubmitted(true);
    showToast('Thank you for rating Grabit Supermarket!', 'success');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHomeData(true);
    setRefreshing(false);
  };

  return (
    <View style={styles.flexContainer}>
      {/* ── 1. EXACT SCREENSHOT 1 TOP HEADER ── */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeftCol}>
          <Pressable onPress={() => router.push('/customer' as any)}>
            <Image
              source={{ uri: getCloudinaryUrl('grabit-logo.png') }}
              style={styles.brandLogoImg}
              resizeMode="contain"
            />
          </Pressable>

          <Pressable style={styles.locationPillRow} onPress={() => setIsLocationModalOpen(true)}>
            <MapPin size={13} color="#0066FF" style={{ marginRight: 4 }} />
            <Text style={styles.locationPrefixText}>Pinned Location - </Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {currentAddress.street || 'Kalyanagar, Bengaluru'}
            </Text>
            <ChevronDown size={13} color="#0066FF" style={{ marginLeft: 3 }} />
          </Pressable>
        </View>

        <View style={styles.headerRightIcons}>
          <Pressable style={styles.iconCircle} onPress={() => setIsNotifModalOpen(true)}>
            <Bell size={18} color="#0066FF" />
            {unreadNotifCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
              </View>
            )}
          </Pressable>

          <Pressable style={styles.iconCircle} onPress={() => router.push('/customer/cart' as any)}>
            <ShoppingBag size={18} color="#0066FF" />
            {totalItems > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalItems}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0066FF']} />}
      >
        {/* ── 2. SEARCH INPUT BAR ── */}
        <SearchAutocomplete
          placeholder="Search for milk, butter, chips, snacks..."
          style={{ marginHorizontal: SPACING.md, marginTop: SPACING.sm, marginBottom: SPACING.xs }}
        />

        {/* ── 3. HORIZONTAL QUICK CATEGORIES STRIP ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catStrip}>
          {quickCatTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const imgSrc = typeof tab.image === 'string' ? { uri: optimizeImageUrl(tab.image, 150) } : tab.image;
            return (
              <Pressable
                key={tab.id}
                style={[styles.catTabItem, isActive && styles.catTabItemActive]}
                onPress={() => {
                  setActiveTab(tab.id);
                  if (tab.slug === 'all') {
                    router.push('/customer' as any);
                  } else {
                    router.push(`/customer/category/${tab.slug}` as any);
                  }
                }}
              >
                <View style={[styles.catTabCircle, isActive && styles.catTabCircleActive]}>
                  <Image source={imgSrc} style={styles.catTabImg} resizeMode="contain" fadeDuration={0} />
                </View>
                <Text style={[styles.catTabLabel, isActive && styles.catTabLabelActive]}>
                  {tab.label}
                </Text>
                {isActive ? <View style={styles.activeBar} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── 4. HERO CAROUSEL BANNER ── */}
        <HeroCarousel />

        {/* ── 5. CATEGORIES GRID SECTION ── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <Pressable onPress={() => router.push('/customer/categories' as any)}>
              <Text style={styles.seeAllText}>View all</Text>
            </Pressable>
          </View>

          <View style={styles.categoriesGrid}>
            {categories.slice(0, 8).map((cat) => {
              const imageSource = getCategoryIconSource(cat);
              return (
                <Pressable
                  key={cat.id}
                  style={styles.catGridTile}
                  onPress={() => router.push(`/customer/category/${cat.slug}` as any)}
                >
                  <View style={styles.catGridImageWrapper}>
                    {imageSource ? (
                      <Image source={imageSource} style={styles.catGridImage} resizeMode="contain" fadeDuration={0} />
                    ) : (
                      <Text style={styles.catGridEmoji}>{cat.icon || '🛍️'}</Text>
                    )}
                  </View>
                  <Text style={styles.catGridName} numberOfLines={2}>
                    {cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── 6. EXACT SCREENSHOT 2 PROMO BANNERS GRID ── */}
        <View style={styles.promoStack}>
          {/* Banner 1: Vegetables & Fruits */}
          <Pressable style={styles.promoCardContainer} onPress={() => router.push('/customer/fresh-produce' as any)}>
            <Image
              source={{ uri: getCloudinaryUrl('banner-fruits-veggies.png') }}
              style={styles.promoBannerImage}
              resizeMode="cover"
            />
          </Pressable>

          {/* Banner 2: Pharmacy */}
          <Pressable style={styles.promoCardContainer} onPress={() => router.push('/customer/pharmacy' as any)}>
            <Image
              source={{ uri: getCloudinaryUrl('banner-pharmacy.png') }}
              style={styles.promoBannerImage}
              resizeMode="cover"
            />
          </Pressable>

          {/* Banner 3: Meat */}
          <Pressable style={styles.promoCardContainer} onPress={() => router.push('/customer/chicken-meat' as any)}>
            <Image
              source={{ uri: getCloudinaryUrl('banner-meat.png') }}
              style={styles.promoBannerImage}
              resizeMode="cover"
            />
          </Pressable>
        </View>

        {/* ── 7. POPULAR NEAR YOU GRID ── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular Near You</Text>
            <Pressable onPress={() => router.push('/customer/categories' as any)}>
              <Text style={styles.seeAllText}>View all</Text>
            </Pressable>
          </View>

          <View style={styles.productGrid}>
            {popularProducts.length > 0 ? (
              popularProducts.slice(0, 8).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))
            ) : (
              <View style={styles.emptyProducts}>
                <Text style={styles.emptyProductsText}>No popular products found.</Text>
                <Pressable onPress={() => fetchHomeData(true)} style={styles.retryBtn}>
                  <Text style={styles.retryBtnText}>Retry Fetch</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* ── 8. EXACT SCREENSHOT 3 CRISPY & CRUNCHY BANNER ── */}
        <Pressable
          style={styles.snackBannerCard}
          onPress={() => router.push('/customer/category/snacks-munchies' as any)}
        >
          <Image
            source={{ uri: getCloudinaryUrl('banner-snacks-cravings-full.png') }}
            style={styles.snackBannerFullImg}
            resizeMode="cover"
          />
        </Pressable>

        {/* ── 9. SNACKS & MUNCHIES PRODUCT GRID ── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Snacks & Munchies</Text>
            <Pressable onPress={() => router.push('/customer/category/snacks-munchies' as any)}>
              <Text style={styles.seeAllText}>View all</Text>
            </Pressable>
          </View>

          <View style={styles.productGrid}>
            {snacksProducts.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} width="48.5%" />
            ))}
          </View>
        </View>

        {/* ── 10. EXACT SCREENSHOT 4 & 5 SUPER SAVERS EXCLUSIVE DEAL OFFERS ── */}
        <View style={styles.sectionCard}>
          <View style={styles.dealHeaderRow}>
            <Zap size={18} color="#FF6B00" />
            <Text style={styles.dealSuperTitle}>SUPER SAVERS</Text>
            <Text style={styles.dealMainTitle}>Exclusive Deal Offers</Text>
          </View>

          <View style={styles.dealBannersStack}>
            {/* Offer 1: Snacks Bonanza */}
            <Pressable
              style={styles.dealGraphicCard}
              onPress={() => router.push('/customer/category/snacks-munchies' as any)}
            >
              <Image
                source={{ uri: getCloudinaryUrl('deal-banner-snacks-vibrant.jpg') }}
                style={styles.dealGraphicImg}
                resizeMode="cover"
              />
            </Pressable>

            {/* Offer 2: Fresh Beverages */}
            <Pressable
              style={styles.dealGraphicCard}
              onPress={() => router.push('/customer/category/beverages' as any)}
            >
              <Image
                source={{ uri: getCloudinaryUrl('deal-banner-beverages.jpg') }}
                style={styles.dealGraphicImg}
                resizeMode="cover"
              />
            </Pressable>

            {/* Offer 3: Farm Fresh Dairy */}
            <Pressable
              style={styles.dealGraphicCard}
              onPress={() => router.push('/customer/category/dairy-bakery' as any)}
            >
              <Image
                source={{ uri: getCloudinaryUrl('deal-banner-dairy.jpg') }}
                style={styles.dealGraphicImg}
                resizeMode="cover"
              />
            </Pressable>

            {/* Offer 4: Premium Dry Fruits & Nuts */}
            <Pressable
              style={styles.dealGraphicCard}
              onPress={() => router.push('/customer/category/produce' as any)}
            >
              <Image
                source={{ uri: getCloudinaryUrl('deal-banner-dryfruits.jpg') }}
                style={styles.dealGraphicImg}
                resizeMode="cover"
              />
            </Pressable>

            {/* Offer 5: Chocolates & Sweets */}
            <Pressable
              style={styles.dealGraphicCard}
              onPress={() => router.push('/customer/category/chocolates' as any)}
            >
              <Image
                source={{ uri: getCloudinaryUrl('deal-banner-chocolates.jpg') }}
                style={styles.dealGraphicImg}
                resizeMode="cover"
              />
            </Pressable>

            {/* Offer 6: Household Essentials */}
            <Pressable
              style={styles.dealGraphicCard}
              onPress={() => router.push('/customer/category/household' as any)}
            >
              <Image
                source={{ uri: getCloudinaryUrl('deal-banner-household.jpg') }}
                style={styles.dealGraphicImg}
                resizeMode="cover"
              />
            </Pressable>
          </View>
        </View>

        {/* ── 11. EXACT SCREENSHOT 5 GRABIT DEALS COUNTDOWN SECTION ── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.sectionTitle}>Grabit Deals</Text>
              <DealCountdownBadge />
            </View>
            <Pressable onPress={() => router.push('/customer/deals' as any)}>
              <Text style={styles.seeAllText}>View all</Text>
            </Pressable>
          </View>

          <View style={styles.productGrid}>
            {popularProducts.length > 0 ? (
              popularProducts.slice(0, 6).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))
            ) : (
              <Text style={styles.emptyProductsText}>No deals available right now.</Text>
            )}
          </View>
        </View>

        {/* ── 11.5 EXCLUSIVE DEALS & OFFERS BANNER (UP TO 60% OFF) ── */}
        <Pressable
          style={styles.exclusiveDealsCard}
          onPress={() => router.push('/customer/deals' as any)}
        >
          <Image
            source={{ uri: getCloudinaryUrl('banner-exclusive-deals.png') }}
            style={styles.exclusiveDealsImg}
            resizeMode="cover"
          />
        </Pressable>

        {/* ── 12. EXACT SCREENSHOT 6 MY SAVED WISHLIST SECTION ── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.sectionTitle}>My Saved Wishlist</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{wishlist.length} Item</Text>
              </View>
            </View>
            <Pressable onPress={() => router.push('/customer/wishlist' as any)}>
              <Text style={styles.seeAllText}>View all</Text>
            </Pressable>
          </View>

          {wishlist.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
              {wishlist.map((item) => (
                <ProductCard key={item.id} product={item} width={165} />
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptyWishlistText}>No saved items yet. Tap the heart on products to save them!</Text>
          )}
        </View>

        {/* ── 13. EXACT SCREENSHOT 7 GET FLAT ₹100 COUPON BOX ── */}
        <View style={styles.couponSubscribeCard}>
          <Image
            source={{ uri: getCloudinaryUrl('vip-gift-box-3d.png') }}
            style={styles.coupon3dGiftImage}
            resizeMode="contain"
          />

          <View style={styles.vipSavingsBadge}>
            <Text style={styles.vipSavingsBadgeText}>🎁 VIP SAVINGS</Text>
          </View>

          <Text style={styles.couponTitle}>
            Get Flat <Text style={styles.couponTitleHighlight}>₹100 OFF</Text> Coupon
          </Text>

          <Text style={styles.couponSub}>Subscribe to get secret weekly flash deal alerts in your inbox.</Text>

          <View style={styles.emailRowContainer}>
            <TextInput
              style={styles.emailInput}
              placeholder="Enter email address..."
              placeholderTextColor="#94A3B8"
              value={emailInput}
              onChangeText={setEmailInput}
              keyboardType="email-address"
            />
            <Pressable style={styles.claimBtn} onPress={handleClaimCoupon}>
              <Text style={styles.claimBtnText}>Claim ₹100</Text>
            </Pressable>
          </View>
        </View>

        {/* ── 14. EXACT SCREENSHOT 7 SUGGEST A PRODUCT BOX ── */}
        <View style={styles.suggestCard}>
          <View style={styles.suggestTopRow}>
            <Image
              source={{ uri: getCloudinaryUrl('suggest-product-3d.png') }}
              style={styles.suggest3dGraphic}
              resizeMode="contain"
            />
            <View style={styles.suggestContentRight}>
              <View style={styles.suggestHeaderPill}>
                <Text style={styles.suggestHeaderPillText}>💡 CAN'T FIND AN ITEM?</Text>
              </View>
              <Text style={styles.suggestTitle}>Suggest a Product to Stock</Text>
              <Text style={styles.suggestSub}>
                Tell us what product you're looking for and our sourcing team will endeavor to stock it in your local dark store!
              </Text>
            </View>
          </View>

          <Pressable style={styles.suggestBtn} onPress={() => setIsSuggestModalOpen(true)}>
            <Sparkles size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.suggestBtnText}>Suggest a Product</Text>
          </Pressable>
        </View>

        {/* ── 15. EXACT SCREENSHOT 7 SHARE YOUR EXPERIENCE REVIEW BOX ── */}
        <View style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <MessageSquare size={18} color="#0066FF" />
            <Text style={styles.reviewTitle}>Share Your Experience</Text>
          </View>
          <Text style={styles.reviewSub}>
            We value your feedback! Rate your experience with Grabit Supermarket.
          </Text>

          <Text style={styles.rateLabel}>Rate Grabit Supermarket:</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((starIndex) => (
              <Pressable key={starIndex} onPress={() => setUserRating(starIndex)}>
                <Star
                  size={24}
                  color={starIndex <= userRating ? '#FF9500' : '#CBD5E1'}
                  fill={starIndex <= userRating ? '#FF9500' : 'transparent'}
                  style={{ marginRight: 6 }}
                />
              </Pressable>
            ))}
            <Text style={styles.rateHintText}>{userRating > 0 ? `${userRating}/5 Stars` : 'Tap to rate'}</Text>
          </View>

          <Text style={styles.rateLabel}>Your Review:</Text>
          <TextInput
            style={styles.reviewInput}
            placeholder="Share your experience with quality, packaging, or delivery speed..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
            value={reviewText}
            onChangeText={setReviewText}
          />

          <Pressable style={styles.submitReviewBtn} onPress={handleSubmitReview}>
            <Send size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.submitReviewBtnText}>Submit Review</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── LOCATION SELECTION MODAL MATCHING SCREENSHOT 1:1 ── */}
      <Modal
        visible={isLocationModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLocationModalOpen(false)}
      >
        <View style={styles.locModalOverlay}>
          <Pressable
            style={styles.locModalBackdrop}
            onPress={() => setIsLocationModalOpen(false)}
          />

          <View style={styles.locModalContent}>
            {/* Top Close Button */}
            <Pressable
              style={styles.locModalCloseBtn}
              onPress={() => setIsLocationModalOpen(false)}
            >
              <X size={16} color="#64748B" />
            </Pressable>

            {/* Top Icon Badge */}
            <View style={styles.locModalIconBadge}>
              <MapPin size={22} color="#0066FF" />
            </View>

            {/* Title & Subtitle */}
            <Text style={styles.locModalTitle}>Select Delivery Location</Text>
            <Text style={styles.locModalSub}>
              Add your delivery address to see live stock availability and 10-minute delivery in your area.
            </Text>

            {/* Button 1: Use Current Location */}
            <Pressable
              style={styles.locPrimaryBtn}
              onPress={async () => {
                showToast('Fetching current GPS location...', 'info');
                await fetchCurrentLocation();
                setIsLocationModalOpen(false);
              }}
            >
              <View style={styles.locBtnIconCol}>
                <Navigation size={18} color="#FFFFFF" />
              </View>
              <View style={styles.locBtnTextCol}>
                <Text style={styles.locPrimaryBtnTitle}>Use Current Location</Text>
                <Text style={styles.locPrimaryBtnSub}>Detect device GPS & fetch street address</Text>
              </View>
            </Pressable>

            {/* Button 2: Set Address / Pin on Map */}
            <Pressable
              style={styles.locSecondaryBtn}
              onPress={() => {
                setIsLocationModalOpen(false);
                router.push('/customer/address-picker' as any);
              }}
            >
              <View style={styles.locBtnIconCol}>
                <MapPin size={18} color="#0066FF" />
              </View>
              <View style={styles.locBtnTextCol}>
                <Text style={styles.locSecondaryBtnTitle}>Set Address / Pin on Map</Text>
                <Text style={styles.locSecondaryBtnSub}>Interactive map picker & address search</Text>
              </View>
            </Pressable>

            {/* Divider */}
            <View style={styles.locDividerRow}>
              <View style={styles.locDividerLine} />
              <Text style={styles.locDividerText}>OR CHOOSE FROM SAVED ADDRESSES</Text>
              <View style={styles.locDividerLine} />
            </View>

            {/* Saved Address Card (Pinned Location) */}
            <View style={styles.savedAddrCard}>
              <View style={styles.savedAddrHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MapPin size={16} color="#0066FF" style={{ marginRight: 6 }} />
                  <Text style={styles.savedAddrTitle}>Pinned Location</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Pressable
                    style={styles.editAddrPill}
                    onPress={() => {
                      setIsLocationModalOpen(false);
                      showToast('Opening address edit form...', 'info');
                    }}
                  >
                    <Edit size={11} color="#0066FF" style={{ marginRight: 3 }} />
                    <Text style={styles.editAddrText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={styles.deleteAddrPill}
                    onPress={() => showToast('Address deleted', 'info')}
                  >
                    <Text style={styles.deleteAddrText}>Delete</Text>
                  </Pressable>
                </View>
              </View>

              <Text style={styles.savedAddrMainText}>Kalyanagar, Kalyanagar</Text>
              <Text style={styles.savedAddrExpressBadge}>12-20 min express delivery</Text>
              <Text style={styles.savedAddrSubText}>Bengaluru 560043, Karnataka 560043</Text>
            </View>

            {/* Bottom Dashed Button: Enter Address Details Manually */}
            <Pressable
              style={styles.manualAddrBtn}
              onPress={() => {
                setIsLocationModalOpen(false);
                showToast('Opening manual address form...', 'info');
              }}
            >
              <Plus size={16} color="#0066FF" style={{ marginRight: 6 }} />
              <Text style={styles.manualAddrBtnText}>Enter Address Details Manually</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <NotificationModal
        visible={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
      />

      <ProductSuggestionModal
        isOpen={isSuggestModalOpen}
        onClose={() => setIsSuggestModalOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flexContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 90,
  },

  /* Top Header matching Screenshot 1 */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeftCol: {
    flex: 1,
    marginRight: 8,
  },
  brandLogoImg: {
    width: 110,
    height: 34,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  locationPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  locationPrefixText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  locationText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    maxWidth: 140,
  },
  headerRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    position: 'relative',
    ...SHADOWS.sm,
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#0066FF',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#34C759',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },

  /* Search Bar */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: SPACING.md,
    height: 44,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  searchPlaceholder: {
    color: '#94A3B8',
    fontSize: 13,
  },

  /* Category Strip */
  catStrip: {
    marginVertical: SPACING.xs,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#DCFCE7',
  },
  catTabItem: {
    alignItems: 'center',
    marginRight: 14,
    position: 'relative',
    paddingBottom: 6,
  },
  catTabItemActive: {},
  catTabCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    padding: 4,
    overflow: 'hidden',
  },
  catTabCircleActive: {
    borderColor: '#22C55E',
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  catTabImg: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  catTabIcon: {
    fontSize: 22,
  },
  catTabLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  catTabLabelActive: {
    color: '#22C55E',
    fontWeight: '900',
  },
  activeBar: {
    position: 'absolute',
    bottom: 0,
    width: 20,
    height: 3,
    backgroundColor: '#22C55E',
    borderRadius: 2,
  },

  /* Hero Banner */
  heroSlide: {
    borderRadius: 20,
    borderWidth: 1,
    padding: SPACING.md,
    paddingTop: SPACING.md,
    marginBottom: SPACING.md,
    position: 'relative',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  heroBadge: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#93C5FD',
    alignSelf: 'center',
    marginBottom: 8,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 26,
    textAlign: 'center',
    width: '100%',
  },
  heroSub: {
    fontSize: 11,
    color: '#475569',
    marginTop: 4,
    marginBottom: 8,
    textAlign: 'center',
    width: '90%',
    lineHeight: 16,
  },
  heroBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  heroBtn1: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 10,
    marginRight: 10,
  },
  heroBtn1Text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  heroBtn2: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  heroBtn2Text: {
    fontSize: 13,
    fontWeight: '800',
  },
  heroImage: {
    width: '100%',
    height: 145,
    alignSelf: 'center',
    marginVertical: 6,
  },
  carouselArrowLeft: {
    position: 'absolute',
    left: 8,
    top: '40%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 6,
    zIndex: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  carouselArrowRight: {
    position: 'absolute',
    right: 8,
    top: '40%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 6,
    zIndex: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
    marginHorizontal: 3,
  },
  dotActive: {
    width: 18,
    backgroundColor: '#0066FF',
  },

  /* Section Card General */
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0066FF',
  },

  /* Categories Grid */
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  catGridTile: {
    width: '23%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  catGridImageWrapper: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  catGridEmoji: {
    fontSize: 28,
  },
  catGridImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  catGridName: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 13,
  },

  /* Promo Stack Banners */
  promoStack: {
    marginBottom: SPACING.md,
  },
  promoCardContainer: {
    borderRadius: 16,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    ...SHADOWS.sm,
  },
  promoBannerImage: {
    width: '100%',
    height: 160,
    borderRadius: 16,
  },
  bannerButtonOverlay: {
    position: 'absolute',
    zIndex: 10,
  },
  orderNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  orderNowBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  /* Product Grid */
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  /* Crispy & Crunchy Banner */
  snackBannerCard: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    backgroundColor: '#991B1B',
    ...SHADOWS.md,
  },
  snackBannerFullImg: {
    width: '100%',
    height: undefined,
    aspectRatio: 1024 / 682,
    borderRadius: 18,
  },

  /* Exclusive Deal Offers */
  dealHeaderRow: {
    marginBottom: SPACING.md,
  },
  dealSuperTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FF6B00',
    letterSpacing: 1,
  },
  dealMainTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  dealBannersStack: {
    gap: SPACING.md,
  },
  dealGraphicCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    ...SHADOWS.sm,
  },
  dealGraphicImg: {
    width: '100%',
    height: 140,
    borderRadius: 16,
  },

  /* Timer Badge */
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  timerBadgeLabel: {
    fontSize: 10,
    color: '#64748B',
    marginRight: 4,
  },
  timerBadgeVal: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0066FF',
  },

  /* Exclusive Deals Up to 60% OFF Banner */
  exclusiveDealsCard: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    backgroundColor: '#4C1D95',
    ...SHADOWS.md,
  },
  exclusiveDealsImg: {
    width: '100%',
    height: undefined,
    aspectRatio: 1024 / 682,
    borderRadius: 18,
  },

  /* Wishlist Count Badge */
  countBadge: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginLeft: 8,
  },
  countBadgeText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '900',
  },
  emptyWishlistText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginVertical: SPACING.md,
  },

  /* Coupon Subscribe Box matching Screenshot 7 */
  couponSubscribeCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 24,
    borderColor: '#DBEAFE',
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  coupon3dGiftImage: {
    width: 170,
    height: 140,
    alignSelf: 'center',
    marginBottom: 10,
  },
  vipSavingsBadge: {
    backgroundColor: '#0066FF',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  vipSavingsBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  couponTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  couponTitleHighlight: {
    color: '#0066FF',
  },
  couponSub: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  emailRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#0066FF',
    padding: 4,
    paddingLeft: 12,
  },
  emailInput: {
    flex: 1,
    height: 44,
    fontSize: 13,
    color: '#0F172A',
  },
  claimBtn: {
    backgroundColor: '#0066FF',
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  claimBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  /* Suggest a Product Box matching Screenshot 7 */
  /* Suggest a Product Box matching Screenshot 7 */
  suggestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  suggestTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  suggest3dGraphic: {
    width: 76,
    height: 76,
    marginRight: 12,
  },
  suggestContentRight: {
    flex: 1,
  },
  suggestHeaderPill: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  suggestHeaderPillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0066FF',
    letterSpacing: 0.5,
  },
  suggestTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  suggestSub: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  suggestBtn: {
    backgroundColor: '#0066FF',
    borderRadius: 14,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  suggestBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  /* Share Your Experience Review Box matching Screenshot 7 */
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderTopWidth: 4,
    borderTopColor: '#0066FF',
    ...SHADOWS.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginLeft: 6,
  },
  reviewSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  rateLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  rateHintText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 8,
  },
  reviewInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: SPACING.md,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: SPACING.md,
  },
  submitReviewBtn: {
    backgroundColor: '#0066FF',
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitReviewBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  emptyProducts: {
    width: '100%',
    padding: 20,
    alignItems: 'center',
  },
  emptyProductsText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  retryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#0066FF',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },

  /* Location Selection Modal Styles */
  locModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  locModalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  locModalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: SPACING.lg,
    alignItems: 'center',
    position: 'relative',
    ...SHADOWS.lg,
    elevation: 12,
  },
  locModalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  locModalIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  locModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  locModalSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  locPrimaryBtn: {
    width: '100%',
    backgroundColor: '#0066FF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    ...SHADOWS.sm,
  },
  locSecondaryBtn: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0066FF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  locBtnIconCol: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locBtnTextCol: {
    flex: 1,
  },
  locPrimaryBtnTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  locPrimaryBtnSub: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 1,
  },
  locSecondaryBtnTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0066FF',
  },
  locSecondaryBtnSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  locDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    width: '100%',
  },
  locDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  locDividerText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94A3B8',
    marginHorizontal: 8,
    letterSpacing: 0.5,
  },
  savedAddrCard: {
    width: '100%',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#0066FF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  savedAddrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  savedAddrTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0066FF',
  },
  editAddrPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  editAddrText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0066FF',
  },
  deleteAddrPill: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  deleteAddrText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EF4444',
  },
  savedAddrMainText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 2,
  },
  savedAddrExpressBadge: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0066FF',
    marginBottom: 4,
  },
  savedAddrSubText: {
    fontSize: 11,
    color: '#64748B',
  },
  manualAddrBtn: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualAddrBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0066FF',
  },
});
