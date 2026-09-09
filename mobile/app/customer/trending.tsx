import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  StyleSheet,
  Modal,
} from 'react-native';
import { useCart } from '../../context/CartContext';
import { useLocation } from '../../context/LocationContext';
import { ProductCard } from '../../components/ProductCard';
import { get } from '../../services/api';
import { Product } from '../../types';
import { products as localProducts } from '../../data/products';
import { getCanonicalSlug } from '../../data/categories';
import { getValidImage } from '../../services/cloudinary';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { useRouter } from 'expo-router';
import {
  Search,
  MapPin,
  Bell,
  ShoppingBag,
  ArrowLeft,
  Zap,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Check,
  Sparkles,
  ArrowRight,
  Grid,
  X,
} from 'lucide-react-native';
import { CustomerTopHeader } from '../../components/CustomerTopHeader';
import { SearchAutocomplete } from '../../components/SearchAutocomplete';

export default function CustomerTrendingPage() {
  const router = useRouter();
  const { totalItems } = useCart();
  const { currentAddress, fetchCurrentLocation } = useLocation();

  const [productsList, setProductsList] = useState<Product[]>(localProducts);
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortOption, setSortOption] = useState('Relevance');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filters & Refine Modal States
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState('All Categories');
  const [modalPriceRange, setModalPriceRange] = useState<string | null>(null);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(20);

  useEffect(() => {
    setVisibleCount(20);
  }, [activeCategory, sortOption, searchQuery, modalPriceRange]);

  useEffect(() => {
    fetchTrendingProducts();
  }, []);

  const fetchTrendingProducts = async () => {
    try {
      const res = await get<any[]>('/products?limit=30');
      if (res && Array.isArray(res) && res.length > 0) {
        const normalized: Product[] = res.map((p: any) => {
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

        setProductsList(Array.from(mergedMap.values()));
      }
    } catch {
      setProductsList(localProducts);
    }
  };

  const sortOptionsList = [
    'Relevance',
    'Price: Low to High',
    'Price: High to Low',
    'Rating',
    'Discount',
  ];

  const categoryOptions = [
    'All Categories',
    'Atta, Rice & Dal',
    'Cold Drinks & Juices',
    'Household Essentials',
    'Snacks & Munchies',
    'Dairy & Bakery',
    'Fresh Produce',
    'Personal Care',
  ];

  const priceRangeOptions = [
    'Under ₹50',
    '₹50 - ₹100',
    '₹100 - ₹200',
    'Above ₹200',
  ];

  const quickFilterTabs = [
    { id: 'All', label: 'All', isGridIcon: true },
    { id: 'Atta, Rice & Dal', label: 'Atta, Rice & Dal', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/atta_real.jpg' },
    { id: 'Cold Drinks & Juices', label: 'Cold Drinks & Juices', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/coca_cola_real.jpg' },
    { id: 'Household Essentials', label: 'Household Essentials', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/surf_excel_real.jpg' },
  ];

  const applyPriceFilter = (p: Product, range: string | null) => {
    if (!range) return true;
    if (range === 'Under ₹50') return p.price < 50;
    if (range === '₹50 - ₹100') return p.price >= 50 && p.price <= 100;
    if (range === '₹100 - ₹200') return p.price > 100 && p.price <= 200;
    if (range === 'Above ₹200') return p.price > 200;
    return true;
  };

  const applyCategoryFilter = (p: Product, cat: string) => {
    if (cat === 'All' || cat === 'All Categories') return true;
    const pCatLower = (p.category || '').toLowerCase();
    const pNameLower = p.name.toLowerCase();

    if (cat === 'Atta, Rice & Dal') return pCatLower.includes('staple') || pCatLower.includes('atta') || pNameLower.includes('atta') || pNameLower.includes('rice') || pNameLower.includes('dal');
    if (cat === 'Cold Drinks & Juices') return pCatLower.includes('beverage') || pCatLower.includes('drink') || pNameLower.includes('coke') || pNameLower.includes('sprite') || pNameLower.includes('juice');
    if (cat === 'Household Essentials') return pCatLower.includes('household') || pNameLower.includes('surf') || pNameLower.includes('vim') || pNameLower.includes('harpic') || pNameLower.includes('lizol') || pNameLower.includes('colin');
    if (cat === 'Snacks & Munchies') return pCatLower.includes('snack') || pNameLower.includes('lays') || pNameLower.includes('chips') || pNameLower.includes('kurkure') || pNameLower.includes('pringles');
    if (cat === 'Dairy & Bakery') return pCatLower.includes('dairy') || pNameLower.includes('butter') || pNameLower.includes('milk') || pNameLower.includes('cheese') || pNameLower.includes('paneer') || pNameLower.includes('bread');
    if (cat === 'Fresh Produce') return pCatLower.includes('produce') || pNameLower.includes('apple') || pNameLower.includes('banana') || pNameLower.includes('tomato');
    if (cat === 'Personal Care') return pCatLower.includes('personal') || pNameLower.includes('dettol') || pNameLower.includes('shampoo');
    return true;
  };

  const filteredProducts = productsList.filter((p) => {
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = applyCategoryFilter(p, activeCategory);
    const matchesPrice = applyPriceFilter(p, modalPriceRange);
    return matchesSearch && matchesCat && matchesPrice;
  });

  const previewCount = productsList.filter((p) => {
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = applyCategoryFilter(p, modalCategory);
    const matchesPrice = applyPriceFilter(p, modalPriceRange);
    return matchesSearch && matchesCat && matchesPrice;
  }).length;

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortOption === 'Price: Low to High') return a.price - b.price;
    if (sortOption === 'Price: High to Low') return b.price - a.price;
    if (sortOption === 'Rating') return (b.rating || 0) - (a.rating || 0);
    if (sortOption === 'Discount') return (b.discountPercent || 0) - (a.discountPercent || 0);
    return 0;
  });

  const visibleProducts = sortedProducts.slice(0, visibleCount);

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 400;
    if (isCloseToBottom && visibleCount < sortedProducts.length) {
      setVisibleCount((prev) => Math.min(prev + 20, sortedProducts.length));
    }
  };

  return (
    <View style={styles.container}>
      {/* ── 1. EXACT HOME PAGE TOP HEADER ── */}
      <CustomerTopHeader />

      {/* ── 2. BACK BUTTON & GLOBAL SEARCH BAR ── */}
      <View style={[styles.searchHeaderRow, { zIndex: 9999 }]}>
        <Pressable style={styles.backBtnCircle} onPress={() => router.back()}>
          <ArrowLeft size={18} color="#1E293B" />
        </Pressable>

        <View style={{ flex: 1, zIndex: 9999 }}>
          <SearchAutocomplete placeholder="Search for milk, butter, chips, snacks..." />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
      >
        {/* ── 3. TRENDING PRODUCTS HEADER ── */}
        <View style={styles.titleSection}>
          <Text style={styles.titleText}>Trending Products</Text>
          <Text style={styles.subtitleText}>
            Handpicked top-rated products delivered fast to your doorstep
          </Text>
        </View>

        {/* ── 4. FILTERS & SORT BAR ── */}
        <View style={styles.filterSortRow}>
          <Pressable style={styles.filterBtnPill} onPress={() => setIsFilterModalOpen(true)}>
            <SlidersHorizontal size={14} color="#0F172A" style={{ marginRight: 6 }} />
            <Text style={styles.filterBtnText}>Filters & Refine</Text>
          </Pressable>

          <Pressable
            style={[styles.sortBtnPill, isSortOpen && styles.sortBtnPillActive]}
            onPress={() => setIsSortOpen((prev) => !prev)}
          >
            <Text style={[styles.sortBtnText, isSortOpen && styles.sortBtnTextActive]}>
              Sort: <Text style={{ color: isSortOpen ? '#0066FF' : '#0F172A', fontWeight: '800' }}>{sortOption}</Text>
            </Text>
            {isSortOpen ? (
              <ChevronUp size={14} color="#0066FF" style={{ marginLeft: 4 }} />
            ) : (
              <ChevronDown size={14} color="#0F172A" style={{ marginLeft: 4 }} />
            )}
          </Pressable>

          {/* Sort Dropdown Popup Menu matching design reference 1:1 */}
          {isSortOpen && (
            <View style={styles.sortDropdown}>
              {sortOptionsList.map((option) => {
                const isSelected = sortOption === option;
                return (
                  <Pressable
                    key={option}
                    style={[styles.sortOptionItem, isSelected && styles.sortOptionItemActive]}
                    onPress={() => {
                      setSortOption(option);
                      setIsSortOpen(false);
                    }}
                  >
                    <Text style={[styles.sortOptionText, isSelected && styles.sortOptionTextActive]}>
                      {option}
                    </Text>
                    {isSelected && <Check size={16} color="#0066FF" />}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* ── 5. QUICK CATEGORY FILTER STRIP ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catFilterStrip}>
          {quickFilterTabs.map((tab) => {
            const isActive = activeCategory === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={[styles.catFilterCard, isActive && styles.catFilterCardActive]}
                onPress={() => setActiveCategory(tab.id)}
              >
                <View style={styles.catFilterIconBox}>
                  {tab.isGridIcon ? (
                    <Grid size={20} color={isActive ? '#0066FF' : '#475569'} />
                  ) : (
                    <Image source={{ uri: tab.image }} style={styles.catFilterThumb} resizeMode="contain" />
                  )}
                </View>
                <Text
                  style={[styles.catFilterLabel, isActive && styles.catFilterLabelActive]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── 6. 2-COLUMN TRENDING PRODUCT GRID ── */}
        <View style={styles.productGrid}>
          {visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </View>

        {visibleCount < sortedProducts.length && (
          <Pressable
            style={styles.loadMoreBtn}
            onPress={() => setVisibleCount((prev) => Math.min(prev + 20, sortedProducts.length))}
          >
            <Text style={styles.loadMoreText}>
              Showing {visibleCount} of {sortedProducts.length} items • Load Next 20
            </Text>
          </Pressable>
        )}

        {/* ── 7. EXACT SCREENSHOT PAGE 3 GRABIT PLUS VIP BANNER ── */}
        <View style={styles.vipBannerCard}>
          <View style={styles.vipLeftContent}>
            <View style={styles.vipHeaderRow}>
              <Text style={styles.vipTitle}>GrabIt Plus</Text>
              <View style={styles.vipBadge}>
                <Text style={styles.vipBadgeText}>VIP</Text>
              </View>
            </View>
            <Text style={styles.vipSubtitle}>
              Enjoy unlimited FREE deliveries & exclusive discounts on all orders above ₹99.
            </Text>
            <Pressable style={styles.joinVipBtn} onPress={() => router.push('/customer/deals' as any)}>
              <Text style={styles.joinVipBtnText}>Join GrabIt Plus →</Text>
            </Pressable>
          </View>

          <Image
            source={{ uri: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645053/grabit_media/login_hero.jpg' }}
            style={styles.vipRiderImage}
            resizeMode="contain"
          />
        </View>
      </ScrollView>

      {/* ── 8. FILTERS & REFINE BOTTOM SHEET MODAL ── */}
      <Modal
        visible={isFilterModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setIsFilterModalOpen(false)} />
          <View style={styles.filterModalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleLeft}>
                <SlidersHorizontal size={20} color="#0066FF" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitleText}>Filters & Refine</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setIsFilterModalOpen(false)}>
                <X size={16} color="#64748B" />
              </Pressable>
            </View>

            <View style={styles.modalDivider} />

            {/* Category Dropdown Section */}
            <Text style={styles.modalSectionLabel}>Category</Text>
            <Pressable
              style={styles.categoryDropdownSelector}
              onPress={() => setIsCategoryDropdownOpen((prev) => !prev)}
            >
              <View style={styles.categorySelectorLeft}>
                <Text style={{ fontSize: 16, marginRight: 8 }}>🛍️</Text>
                <Text style={styles.categorySelectorText}>{modalCategory}</Text>
              </View>
              {isCategoryDropdownOpen ? (
                <ChevronUp size={18} color="#0066FF" />
              ) : (
                <ChevronDown size={18} color="#0066FF" />
              )}
            </Pressable>

            {/* Expanded Category Dropdown List */}
            {isCategoryDropdownOpen && (
              <View style={styles.categoryDropdownMenu}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
                  {categoryOptions.map((cat) => (
                    <Pressable
                      key={cat}
                      style={[styles.catOptionRow, modalCategory === cat && styles.catOptionRowActive]}
                      onPress={() => {
                        setModalCategory(cat);
                        setIsCategoryDropdownOpen(false);
                      }}
                    >
                      <Text style={[styles.catOptionText, modalCategory === cat && styles.catOptionTextActive]}>
                        {cat}
                      </Text>
                      {modalCategory === cat && <Check size={16} color="#0066FF" />}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Price Range Section */}
            <Text style={[styles.modalSectionLabel, { marginTop: 16 }]}>Price Range</Text>
            <View style={styles.priceGridContainer}>
              {priceRangeOptions.map((range) => {
                const isSelected = modalPriceRange === range;
                return (
                  <Pressable
                    key={range}
                    style={[styles.priceRangePill, isSelected && styles.priceRangePillActive]}
                    onPress={() => setModalPriceRange(isSelected ? null : range)}
                  >
                    <Text style={[styles.priceRangeText, isSelected && styles.priceRangeTextActive]}>
                      {range}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalDivider} />

            {/* Modal Action Buttons Row */}
            <View style={styles.modalActionRow}>
              <Pressable
                style={styles.modalResetBtn}
                onPress={() => {
                  setModalCategory('All Categories');
                  setModalPriceRange(null);
                  setActiveCategory('All');
                }}
              >
                <Text style={styles.modalResetBtnText}>Reset</Text>
              </Pressable>

              <Pressable
                style={styles.modalApplyBtn}
                onPress={() => {
                  if (modalCategory === 'All Categories') {
                    setActiveCategory('All');
                  } else {
                    setActiveCategory(modalCategory);
                  }
                  setIsFilterModalOpen(false);
                }}
              >
                <Text style={styles.modalApplyBtnText}>Apply ({previewCount})</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0066FF',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  brandIcon: {
    marginRight: 4,
  },
  brandName: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: -0.5,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    maxWidth: 160,
  },
  locationText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 4,
    marginRight: 4,
  },
  locationChevron: {
    fontSize: 10,
    color: '#0066FF',
    fontWeight: '800',
  },
  headerRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    position: 'relative',
    ...SHADOWS.sm,
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },

  /* Search Header Row */
  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  backBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  globalSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    height: 38,
    paddingHorizontal: 10,
  },
  globalSearchPlaceholder: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },

  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 100,
  },

  /* Title Section */
  titleSection: {
    marginBottom: SPACING.md,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  subtitleText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },

  /* Filter & Sort Row */
  filterSortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: 12,
    position: 'relative',
    zIndex: 100,
  },
  filterBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    ...SHADOWS.sm,
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  sortBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    ...SHADOWS.sm,
  },
  sortBtnPillActive: {
    borderColor: '#0066FF',
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
  },
  sortBtnText: {
    fontSize: 13,
    color: '#64748B',
  },
  sortBtnTextActive: {
    color: '#0066FF',
  },

  /* Sort Dropdown Popup */
  sortDropdown: {
    position: 'absolute',
    top: 44,
    right: 0,
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 9999,
    ...SHADOWS.lg,
    elevation: 8,
  },
  sortOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  sortOptionItemActive: {
    backgroundColor: '#EFF6FF',
  },
  sortOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  sortOptionTextActive: {
    color: '#0066FF',
    fontWeight: '800',
  },

  /* Horizontal Category Filter Strip */
  catFilterStrip: {
    marginBottom: SPACING.lg,
  },
  catFilterCard: {
    width: 84,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    ...SHADOWS.sm,
  },
  catFilterCardActive: {
    borderWidth: 2,
    borderColor: '#0066FF',
    backgroundColor: '#EFF6FF',
  },
  catFilterIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  catFilterThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  catFilterLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 12,
    minHeight: 24,
  },
  catFilterLabelActive: {
    color: '#0066FF',
    fontWeight: '900',
  },

  /* Product Grid */
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },

  /* GrabIt Plus VIP Banner Card matching PDF page 3 */
  vipBannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    ...SHADOWS.sm,
  },
  vipLeftContent: {
    flex: 1,
    marginRight: 12,
  },
  vipHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  vipTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0066FF',
    marginRight: 6,
  },
  vipBadge: {
    backgroundColor: '#10B981',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  vipBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  vipSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 12,
  },
  joinVipBtn: {
    backgroundColor: '#0066FF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  joinVipBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  vipRiderImage: {
    width: 90,
    height: 90,
  },

  /* Modal Bottom Sheet */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  filterModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: 36,
    ...SHADOWS.lg,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  modalTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: SPACING.md,
  },
  modalSectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  categoryDropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  categorySelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categorySelectorText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  categoryDropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    marginTop: 6,
    paddingVertical: 4,
    ...SHADOWS.sm,
  },
  catOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  catOptionRowActive: {
    backgroundColor: '#EFF6FF',
  },
  catOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  catOptionTextActive: {
    color: '#0066FF',
    fontWeight: '800',
  },
  priceGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  priceRangePill: {
    width: '48%',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  priceRangePillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0066FF',
  },
  priceRangeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  priceRangeTextActive: {
    color: '#0066FF',
    fontWeight: '800',
  },
  modalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: SPACING.sm,
  },
  modalResetBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalResetBtnText: {
    color: '#EF4444',
    fontWeight: '800',
    fontSize: 14,
  },
  modalApplyBtn: {
    flex: 2,
    height: 48,
    backgroundColor: '#0066FF',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  modalApplyBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  loadMoreBtn: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.md,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    color: '#0066FF',
    fontWeight: '800',
    fontSize: 13,
  },
});
