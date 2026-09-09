import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Search,
  X,
  Leaf,
  Filter,
  Sparkles,
} from 'lucide-react-native';
import { ProductCard } from '../../components/ProductCard';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { products as localProducts, CatalogProduct } from '../../data/products';
import { get } from '../../services/api';
import { Product } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const subcategories = [
  { id: 'all', label: '🥦 All Produce' },
  { id: 'vegetables', label: '🥕 Fresh Vegetables' },
  { id: 'fruits', label: '🍎 Organic Fruits' },
  { id: 'exotic', label: '🥑 Exotic & Imported' },
  { id: 'greens', label: '🥬 Leafy Greens' },
  { id: 'herbs', label: '🧄 Herbs & Seasonings' },
];

const EXTRA_PRODUCE_ITEMS: Product[] = [
  {
    id: '101',
    name: 'Fresh Hydroponic Baby Spinach 250g',
    weight: '250g',
    price: 45,
    originalPrice: 60,
    discountPercent: 25,
    rating: 4.9,
    reviewCount: 340,
    image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&q=80',
    category: 'produce',
    subcat: 'greens',
    brand: 'Grabit Organic',
    inStock: true,
    stock_quantity: 40,
  } as any,
  {
    id: '102',
    name: 'Organic Hass Avocado 2 Pcs (Imported)',
    weight: '2 Pcs (~300g)',
    price: 199,
    originalPrice: 260,
    discountPercent: 23,
    rating: 4.8,
    reviewCount: 520,
    image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=400&q=80',
    category: 'produce',
    subcat: 'exotic',
    brand: 'Grabit Organic',
    inStock: true,
    stock_quantity: 25,
  } as any,
  {
    id: '103',
    name: 'Fresh Seedless Green Grapes 500g',
    weight: '500g',
    price: 89,
    originalPrice: 120,
    discountPercent: 25,
    rating: 4.9,
    reviewCount: 810,
    image: 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=400&q=80',
    category: 'produce',
    subcat: 'fruits',
    brand: 'Grabit Fresh',
    inStock: true,
    stock_quantity: 50,
  } as any,
  {
    id: '104',
    name: 'Fresh Broccoli Exotic 250g',
    weight: '250g',
    price: 49,
    originalPrice: 70,
    discountPercent: 30,
    rating: 4.7,
    reviewCount: 290,
    image: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=400&q=80',
    category: 'produce',
    subcat: 'vegetables',
    brand: 'Grabit Fresh',
    inStock: true,
    stock_quantity: 35,
  } as any,
  {
    id: '105',
    name: 'Fresh Mint & Coriander Combo Pack',
    weight: '200g',
    price: 25,
    originalPrice: 35,
    discountPercent: 28,
    rating: 4.8,
    reviewCount: 670,
    image: 'https://images.unsplash.com/photo-1608797178974-15b35a640578?w=400&q=80',
    category: 'produce',
    subcat: 'herbs',
    brand: 'Grabit Organic',
    inStock: true,
    stock_quantity: 60,
  } as any,
];

export default function FreshProducePage() {
  const router = useRouter();
  const [selectedSubcat, setSelectedSubcat] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [apiProducts, setApiProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setIsLoading(true);
        const res = await get('/products?category=produce');
        if (isMounted && Array.isArray(res)) {
          const formatted: Product[] = res.map((p: any) => ({
            ...p,
            id: String(p.id),
            name: p.name,
            price: Number(p.price || 0),
            originalPrice: p.originalPrice || p.original_price || Math.round((p.price || 0) * 1.25),
            discountPercent: p.discountPercent || p.discount_percent || 15,
            image: p.image_url || p.image,
            category: 'produce',
            inStock: p.inStock ?? true,
            rating: p.rating || 4.8,
            reviewCount: p.reviewCount || 100,
          }));
          setApiProducts(formatted);
        }
      } catch (err) {
        // Fallback to local
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const produceCatalog = useMemo(() => {
    const base = localProducts.filter(
      (p) =>
        p.category === 'produce' ||
        p.category === 'fruits-veggies' ||
        p.category_slug === 'produce' ||
        (p.name &&
          (p.name.toLowerCase().includes('apple') ||
            p.name.toLowerCase().includes('banana') ||
            p.name.toLowerCase().includes('tomato') ||
            p.name.toLowerCase().includes('capsicum') ||
            p.name.toLowerCase().includes('onion')))
    );

    const merged = [...base, ...EXTRA_PRODUCE_ITEMS];
    apiProducts.forEach((ap) => {
      if (!merged.some((m) => m.id === ap.id)) {
        merged.push(ap);
      }
    });

    return merged;
  }, [apiProducts]);

  const filteredProducts = useMemo(() => {
    return produceCatalog.filter((p) => {
      const matchSearch =
        !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (selectedSubcat === 'all') return matchSearch;
      if (selectedSubcat === 'vegetables')
        return (
          matchSearch &&
          (p.name.toLowerCase().includes('tomato') ||
            p.name.toLowerCase().includes('capsicum') ||
            p.name.toLowerCase().includes('onion') ||
            p.name.toLowerCase().includes('broccoli') ||
            (p as any).subcat === 'vegetables')
        );
      if (selectedSubcat === 'fruits')
        return (
          matchSearch &&
          (p.name.toLowerCase().includes('apple') ||
            p.name.toLowerCase().includes('banana') ||
            p.name.toLowerCase().includes('grapes') ||
            (p as any).subcat === 'fruits')
        );
      if (selectedSubcat === 'exotic')
        return (
          matchSearch &&
          (p.name.toLowerCase().includes('avocado') || (p as any).subcat === 'exotic')
        );
      if (selectedSubcat === 'greens')
        return (
          matchSearch &&
          (p.name.toLowerCase().includes('spinach') || (p as any).subcat === 'greens')
        );
      if (selectedSubcat === 'herbs')
        return (
          matchSearch &&
          (p.name.toLowerCase().includes('mint') ||
            p.name.toLowerCase().includes('coriander') ||
            (p as any).subcat === 'herbs')
        );
      return matchSearch;
    });
  }, [produceCatalog, selectedSubcat, searchQuery]);

  // Section items for categorized view
  const vegList = useMemo(() => {
    return produceCatalog.filter((p) => {
      const n = (p.name || '').toLowerCase();
      return (
        n.includes('tomato') ||
        n.includes('capsicum') ||
        n.includes('onion') ||
        n.includes('potato') ||
        n.includes('broccoli') ||
        n.includes('carrot') ||
        (p as any).subcat === 'vegetables'
      );
    });
  }, [produceCatalog]);

  const fruitList = useMemo(() => {
    return produceCatalog.filter((p) => {
      const n = (p.name || '').toLowerCase();
      return (
        n.includes('apple') ||
        n.includes('banana') ||
        n.includes('grape') ||
        n.includes('avocado') ||
        n.includes('orange') ||
        n.includes('mango') ||
        (p as any).subcat === 'fruits' ||
        (p as any).subcat === 'exotic'
      );
    });
  }, [produceCatalog]);

  const greensList = useMemo(() => {
    return produceCatalog.filter((p) => {
      const n = (p.name || '').toLowerCase();
      return (
        n.includes('spinach') ||
        n.includes('mint') ||
        n.includes('coriander') ||
        (p as any).subcat === 'greens' ||
        (p as any).subcat === 'herbs'
      );
    });
  }, [produceCatalog]);

  return (
    <View style={styles.container}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={COLORS.text} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Leaf size={20} color="#166534" style={{ marginRight: 6 }} />
          <Text style={styles.headerTitle}>Fresh Vegetables & Fruits</Text>
        </View>
      </View>

      {/* ── SEARCH BAR ── */}
      <View style={styles.searchSection}>
        <View style={styles.searchInputContainer}>
          <Search size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search fresh vegetables, fruits, herbs..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <X size={18} color="#9CA3AF" />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── SUBCATEGORY PILLS ── */}
      <View style={styles.pillsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
          {subcategories.map((sub) => {
            const isActive = selectedSubcat === sub.id;
            return (
              <Pressable
                key={sub.id}
                style={[styles.pill, isActive && styles.pillActive]}
                onPress={() => setSelectedSubcat(sub.id)}
              >
                <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                  {sub.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── MAIN CONTENT AREA ── */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#166534" style={{ marginTop: 40 }} />
        ) : filteredProducts.length > 0 ? (
          selectedSubcat === 'all' && !searchQuery ? (
            <View style={{ gap: 24 }}>
              {/* SECTION 1: FRESH VEGETABLES */}
              {vegList.length > 0 && (
                <View style={styles.sectionCard}>
                  <Image
                    source={require('../../assets/banner-fresh-vegetables-section.jpg')}
                    style={styles.sectionBannerImage}
                    resizeMode="cover"
                  />
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionEmoji}>🥦</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sectionTitleVeg}>Fresh Vegetables</Text>
                      <Text style={styles.sectionSubtitle}>
                        Farm-picked, pesticide-free daily cooking vegetables
                      </Text>
                    </View>
                  </View>
                  <View style={styles.grid}>
                    {vegList.map((product) => (
                      <ProductCard key={product.id} product={product} width="48.5%" />
                    ))}
                  </View>
                </View>
              )}

              {/* SECTION 2: FARM FRESH FRUITS */}
              {fruitList.length > 0 && (
                <View style={styles.sectionCardFruit}>
                  <Image
                    source={require('../../assets/banner-fresh-fruits.jpg')}
                    style={styles.sectionBannerImage}
                    resizeMode="cover"
                  />
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionEmoji}>🍎</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sectionTitleFruit}>Farm Fresh & Organic Fruits</Text>
                      <Text style={styles.sectionSubtitle}>
                        Sweet, juicy & vitamin-rich seasonal & imported fruits
                      </Text>
                    </View>
                  </View>
                  <View style={styles.grid}>
                    {fruitList.map((product) => (
                      <ProductCard key={product.id} product={product} width="48.5%" />
                    ))}
                  </View>
                </View>
              )}

              {/* SECTION 3: LEAFY GREENS & HERBS */}
              {greensList.length > 0 && (
                <View style={styles.sectionCardGreen}>
                  <Image
                    source={require('../../assets/banner-leafy-greens-section.jpg')}
                    style={styles.sectionBannerImage}
                    resizeMode="cover"
                  />
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionEmoji}>🥬</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sectionTitleVeg}>Leafy Greens & Kitchen Herbs</Text>
                      <Text style={styles.sectionSubtitle}>
                        Hydroponic spinach, fresh mint, coriander & aromatic herbs
                      </Text>
                    </View>
                  </View>
                  <View style={styles.grid}>
                    {greensList.map((product) => (
                      <ProductCard key={product.id} product={product} width="48.5%" />
                    ))}
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.grid}>
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} width="48.5%" />
              ))}
            </View>
          )
        ) : (
          <View style={styles.emptyContainer}>
            <Leaf size={48} color="#166534" style={{ marginBottom: 12, opacity: 0.5 }} />
            <Text style={styles.emptyTitle}>No items found in this filter</Text>
            <Text style={styles.emptySubtitle}>
              Try searching for another produce item or clearing your filter.
            </Text>
            <Pressable
              style={styles.resetBtn}
              onPress={() => {
                setSelectedSubcat('all');
                setSearchQuery('');
              }}
            >
              <Text style={styles.resetBtnText}>Reset Filters</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAF5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EFE2',
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#14532D',
  },
  searchSection: {
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...SHADOWS.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    padding: 0,
  },
  pillsContainer: {
    paddingBottom: 10,
  },
  pillsScroll: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pillActive: {
    backgroundColor: '#166534',
    borderColor: '#166534',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 100,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EFE2',
    ...SHADOWS.sm,
  },
  sectionCardFruit: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    ...SHADOWS.sm,
  },
  sectionCardGreen: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    ...SHADOWS.sm,
  },
  sectionBannerImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  sectionEmoji: {
    fontSize: 24,
  },
  sectionTitleVeg: {
    fontSize: 17,
    fontWeight: '800',
    color: '#14532D',
  },
  sectionTitleFruit: {
    fontSize: 17,
    fontWeight: '800',
    color: '#92400E',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8EFE2',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  resetBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#166534',
    borderRadius: 8,
  },
  resetBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
