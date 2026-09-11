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
  Flame,
} from 'lucide-react-native';
import { ProductCard } from '../../components/ProductCard';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { products as localProducts } from '../../data/products';
import { get } from '../../services/api';
import { getCloudinaryUrl } from '../../services/cloudinary';
import { Product } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MEAT_ITEMS_CATALOG: Product[] = [
  {
    id: '301',
    name: 'Fresh Tender Chicken Curry Cut 500g',
    weight: '500g',
    price: 165,
    originalPrice: 195,
    discountPercent: 15,
    rating: 4.9,
    reviewCount: 1420,
    image: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&q=80',
    category: 'meat',
    subcat: 'chicken',
    cut: 'curry',
    brand: 'Grabit Meat',
    inStock: true,
    stock_quantity: 50,
  } as any,
  {
    id: '302',
    name: 'Fresh Antibiotic-Free Chicken Breast Boneless 400g',
    weight: '400g',
    price: 220,
    originalPrice: 260,
    discountPercent: 15,
    rating: 4.9,
    reviewCount: 980,
    image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&q=80',
    category: 'meat',
    subcat: 'chicken',
    cut: 'boneless',
    brand: 'Grabit Meat',
    inStock: true,
    stock_quantity: 40,
  } as any,
  {
    id: '306',
    name: 'Fresh Juicy Chicken Drumsticks 500g',
    weight: '500g',
    price: 185,
    originalPrice: 210,
    discountPercent: 12,
    rating: 4.8,
    reviewCount: 730,
    image: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=400&q=80',
    category: 'meat',
    subcat: 'chicken',
    cut: 'drumsticks',
    brand: 'Grabit Meat',
    inStock: true,
    stock_quantity: 45,
  } as any,
  {
    id: '305',
    name: 'Farm Fresh Brown Protein Eggs (Pack of 12)',
    weight: '12 Eggs',
    price: 110,
    originalPrice: 130,
    discountPercent: 15,
    rating: 4.9,
    reviewCount: 2150,
    image: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=400&q=80',
    category: 'meat',
    subcat: 'eggs',
    cut: 'whole',
    brand: 'Grabit Farm',
    inStock: true,
    stock_quantity: 80,
  } as any,
  {
    id: '307',
    name: 'Farm Fresh White Table Eggs (Pack of 30)',
    weight: '30 Eggs',
    price: 199,
    originalPrice: 240,
    discountPercent: 17,
    rating: 4.8,
    reviewCount: 1890,
    image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400&q=80',
    category: 'meat',
    subcat: 'eggs',
    cut: 'whole',
    brand: 'Grabit Farm',
    inStock: true,
    stock_quantity: 90,
  } as any,
  {
    id: '303',
    name: 'Fresh Rich Mutton Curry Cut (Rich Meat) 500g',
    weight: '500g',
    price: 449,
    originalPrice: 520,
    discountPercent: 14,
    rating: 4.8,
    reviewCount: 670,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80',
    category: 'meat',
    subcat: 'mutton',
    cut: 'curry',
    brand: 'Grabit Meat',
    inStock: true,
    stock_quantity: 25,
  } as any,
  {
    id: '308',
    name: 'Fresh Premium Mutton Biryani Cut 500g',
    weight: '500g',
    price: 480,
    originalPrice: 550,
    discountPercent: 13,
    rating: 4.9,
    reviewCount: 810,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80',
    category: 'meat',
    subcat: 'mutton',
    cut: 'curry',
    brand: 'Grabit Meat',
    inStock: true,
    stock_quantity: 30,
  } as any,
  {
    id: '309',
    name: 'Fresh Fine Mutton Minced (Keema) 250g',
    weight: '250g',
    price: 260,
    originalPrice: 300,
    discountPercent: 13,
    rating: 4.7,
    reviewCount: 420,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80',
    category: 'meat',
    subcat: 'mutton',
    cut: 'minced',
    brand: 'Grabit Meat',
    inStock: true,
    stock_quantity: 20,
  } as any,
  {
    id: '304',
    name: 'Fresh Rohu Fish Steaks Cut 500g',
    weight: '500g',
    price: 195,
    originalPrice: 230,
    discountPercent: 15,
    rating: 4.7,
    reviewCount: 540,
    image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80',
    category: 'meat',
    subcat: 'fish',
    cut: 'steaks',
    brand: 'Grabit Seafood',
    inStock: true,
    stock_quantity: 30,
  } as any,
];

export default function ChickenMeatPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [apiProducts, setApiProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setIsLoading(true);
        const res = await get('/products?category=meat-seafood');
        if (isMounted && Array.isArray(res)) {
          const formatted: Product[] = res.map((p: any) => ({
            ...p,
            id: String(p.id),
            name: p.name,
            price: Number(p.price || 0),
            originalPrice: p.originalPrice || p.original_price || Math.round((p.price || 0) * 1.25),
            discountPercent: p.discountPercent || p.discount_percent || 15,
            image: p.image_url || p.image,
            category: 'meat',
            inStock: p.inStock ?? true,
            rating: p.rating || 4.8,
            reviewCount: p.reviewCount || 100,
          }));
          setApiProducts(formatted);
        }
      } catch (err) {
        // Fallback
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const meatCatalog = useMemo(() => {
    const base = localProducts.filter(
      (p) => p.category === 'meat-seafood' || p.category === 'meat'
    );
    const merged = [...MEAT_ITEMS_CATALOG, ...base];
    apiProducts.forEach((ap) => {
      if (!merged.some((m) => m.id === ap.id)) {
        merged.push(ap);
      }
    });
    return merged;
  }, [apiProducts]);

  const filteredProducts = useMemo(() => {
    return meatCatalog.filter((p) => {
      return !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [meatCatalog, searchQuery]);

  const chickenEggsList = useMemo(() => {
    return filteredProducts.filter(
      (p) =>
        (p as any).subcat === 'chicken' ||
        (p as any).subcat === 'eggs' ||
        p.name.toLowerCase().includes('chicken') ||
        p.name.toLowerCase().includes('egg')
    );
  }, [filteredProducts]);

  const meatList = useMemo(() => {
    return filteredProducts.filter(
      (p) =>
        (p as any).subcat === 'mutton' ||
        (p as any).subcat === 'fish' ||
        p.name.toLowerCase().includes('mutton') ||
        p.name.toLowerCase().includes('keema') ||
        p.name.toLowerCase().includes('fish') ||
        p.name.toLowerCase().includes('meat')
    );
  }, [filteredProducts]);

  return (
    <View style={styles.container}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={COLORS.text} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Flame size={20} color="#DC2626" style={{ marginRight: 6 }} />
          <Text style={styles.headerTitle}>Fresh Chicken & Meat</Text>
        </View>
      </View>

      {/* ── SEARCH BAR ── */}
      <View style={styles.searchSection}>
        <View style={styles.searchInputContainer}>
          <Search size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search fresh chicken, eggs, mutton, fish..."
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

      {/* ── MAIN CONTENT AREA ── */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#DC2626" style={{ marginTop: 40 }} />
        ) : filteredProducts.length > 0 ? (
          searchQuery ? (
            <View style={styles.grid}>
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} width="48.5%" />
              ))}
            </View>
          ) : (
            <View style={{ gap: 24 }}>
              {/* SECTION 1: FRESH CHICKEN & FARM EGGS */}
              {chickenEggsList.length > 0 && (
                <View style={styles.sectionCardChicken}>
                  <Image
                    source={{ uri: getCloudinaryUrl('banner-chicken-eggs.jpg') }}
                    style={styles.sectionBannerImage}
                    resizeMode="cover"
                  />
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionEmoji}>🍗</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sectionTitleChicken}>Fresh Chicken & Farm Eggs</Text>
                      <Text style={styles.sectionSubtitle}>
                        100% Antibiotic-free farm chicken cuts & fresh protein eggs
                      </Text>
                    </View>
                  </View>
                  <View style={styles.grid}>
                    {chickenEggsList.map((product) => (
                      <ProductCard key={product.id} product={product} width="48.5%" />
                    ))}
                  </View>
                </View>
              )}

              {/* SECTION 2: FRESH MEAT & MUTTON CUTS */}
              {meatList.length > 0 && (
                <View style={styles.sectionCardMeat}>
                  <Image
                    source={{ uri: getCloudinaryUrl('banner-fresh-meat-section.jpg') }}
                    style={styles.sectionBannerImage}
                    resizeMode="cover"
                  />
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionEmoji}>🥩</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sectionTitleMeat}>Fresh Meat & Mutton Cuts</Text>
                      <Text style={styles.sectionSubtitle}>
                        Tender mutton curry cuts, biryani cuts, minced keema & fresh fish
                      </Text>
                    </View>
                  </View>
                  <View style={styles.grid}>
                    {meatList.map((product) => (
                      <ProductCard key={product.id} product={product} width="48.5%" />
                    ))}
                  </View>
                </View>
              )}
            </View>
          )
        ) : (
          <View style={styles.emptyContainer}>
            <Flame size={48} color="#DC2626" style={{ marginBottom: 12, opacity: 0.5 }} />
            <Text style={styles.emptyTitle}>No meat products found</Text>
            <Text style={styles.emptySubtitle}>
              Try searching for another item or resetting your search query.
            </Text>
            <Pressable
              style={styles.resetBtn}
              onPress={() => setSearchQuery('')}
            >
              <Text style={styles.resetBtnText}>Reset Search</Text>
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
    backgroundColor: '#FFFDF9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
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
    color: '#DC2626',
  },
  searchSection: {
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    paddingBottom: 10,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
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
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 100,
  },
  sectionCardChicken: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    ...SHADOWS.sm,
  },
  sectionCardMeat: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FEE2E2',
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
  sectionTitleChicken: {
    fontSize: 17,
    fontWeight: '800',
    color: '#9A3412',
  },
  sectionTitleMeat: {
    fontSize: 17,
    fontWeight: '800',
    color: '#991B1B',
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
    borderColor: '#FEE2E2',
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
    backgroundColor: '#DC2626',
    borderRadius: 8,
  },
  resetBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
