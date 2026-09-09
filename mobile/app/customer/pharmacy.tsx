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
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react-native';
import { ProductCard } from '../../components/ProductCard';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { products as localProducts } from '../../data/products';
import { get } from '../../services/api';
import { Product } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const subcategories = [
  { id: 'all', label: '🏥 All Pharmacy & Wellness' },
  { id: 'cold', label: '🤧 Cold, Cough & Flu' },
  { id: 'pain', label: '⚡ Pain Relief & Ointments' },
  { id: 'digestive', label: '🍋 Antacids & Digestion' },
  { id: 'firstaid', label: '🩹 First Aid & Hygiene' },
  { id: 'vitamins', label: '💊 Vitamins & Supplements' },
];

const EXTRA_PHARMACY_ITEMS: Product[] = [
  {
    id: '201',
    name: 'Vicks VapoRub Balm 50g Relief from Cold',
    weight: '50g',
    price: 155,
    originalPrice: 175,
    discountPercent: 11,
    rating: 4.9,
    reviewCount: 1240,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80',
    category: 'pharmacy',
    subcat: 'cold',
    brand: 'Vicks',
    inStock: true,
    stock_quantity: 60,
  } as any,
  {
    id: '202',
    name: 'Moov Fast Pain Relief Ointment 50g',
    weight: '50g',
    price: 165,
    originalPrice: 190,
    discountPercent: 13,
    rating: 4.8,
    reviewCount: 980,
    image: 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=400&q=80',
    category: 'pharmacy',
    subcat: 'pain',
    brand: 'Moov',
    inStock: true,
    stock_quantity: 45,
  } as any,
  {
    id: '203',
    name: 'Eno Fizzy Lemon Fast Relief Sachets (Pack of 6)',
    weight: '30g',
    price: 60,
    originalPrice: 72,
    discountPercent: 17,
    rating: 4.9,
    reviewCount: 1450,
    image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=400&q=80',
    category: 'pharmacy',
    subcat: 'digestive',
    brand: 'Eno',
    inStock: true,
    stock_quantity: 80,
  } as any,
  {
    id: '204',
    name: 'Revital H Daily Health Supplement 30 Capsules',
    weight: '30 Caps',
    price: 310,
    originalPrice: 360,
    discountPercent: 14,
    rating: 4.8,
    reviewCount: 760,
    image: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=400&q=80',
    category: 'pharmacy',
    subcat: 'vitamins',
    brand: 'Revital',
    inStock: true,
    stock_quantity: 35,
  } as any,
  {
    id: '205',
    name: 'Hansaplast Waterproof First Aid Bandages (20 Pcs)',
    weight: '20 Pcs',
    price: 75,
    originalPrice: 90,
    discountPercent: 17,
    rating: 4.9,
    reviewCount: 1120,
    image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&q=80',
    category: 'pharmacy',
    subcat: 'firstaid',
    brand: 'Hansaplast',
    inStock: true,
    stock_quantity: 90,
  } as any,
];

export default function PharmacyPage() {
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
        const res = await get('/products?category=health-wellness');
        if (isMounted && Array.isArray(res)) {
          const formatted: Product[] = res.map((p: any) => ({
            ...p,
            id: String(p.id),
            name: p.name,
            price: Number(p.price || 0),
            originalPrice: p.originalPrice || p.original_price || Math.round((p.price || 0) * 1.25),
            discountPercent: p.discountPercent || p.discount_percent || 15,
            image: p.image_url || p.image,
            category: 'pharmacy',
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

  const pharmacyCatalog = useMemo(() => {
    const base = localProducts.filter(
      (p) =>
        p.category === 'personal-care' ||
        p.category === 'health-wellness' ||
        (p.name &&
          (p.name.toLowerCase().includes('dettol') ||
            p.name.toLowerCase().includes('soap') ||
            p.name.toLowerCase().includes('toothpaste')))
    );

    const merged = [...base, ...EXTRA_PHARMACY_ITEMS];
    apiProducts.forEach((ap) => {
      if (!merged.some((m) => m.id === ap.id)) {
        merged.push(ap);
      }
    });

    return merged;
  }, [apiProducts]);

  const filteredProducts = useMemo(() => {
    return pharmacyCatalog.filter((p) => {
      const matchSearch =
        !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (selectedSubcat === 'all') return matchSearch;
      if (selectedSubcat === 'cold')
        return matchSearch && (p.name.toLowerCase().includes('vicks') || (p as any).subcat === 'cold');
      if (selectedSubcat === 'pain')
        return matchSearch && (p.name.toLowerCase().includes('moov') || (p as any).subcat === 'pain');
      if (selectedSubcat === 'digestive')
        return matchSearch && (p.name.toLowerCase().includes('eno') || (p as any).subcat === 'digestive');
      if (selectedSubcat === 'firstaid')
        return (
          matchSearch &&
          (p.name.toLowerCase().includes('dettol') ||
            p.name.toLowerCase().includes('hansaplast') ||
            (p as any).subcat === 'firstaid')
        );
      if (selectedSubcat === 'vitamins')
        return matchSearch && (p.name.toLowerCase().includes('revital') || (p as any).subcat === 'vitamins');
      return matchSearch;
    });
  }, [pharmacyCatalog, selectedSubcat, searchQuery]);

  return (
    <View style={styles.container}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={COLORS.text} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <ShieldCheck size={20} color="#7C3AED" style={{ marginRight: 6 }} />
          <Text style={styles.headerTitle}>Pharmacy & Wellness</Text>
        </View>
      </View>

      {/* ── SEARCH BAR ── */}
      <View style={styles.searchSection}>
        <View style={styles.searchInputContainer}>
          <Search size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search medicines, cough syrup, pain relief, vitamins..."
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
          <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
        ) : filteredProducts.length > 0 ? (
          <View style={styles.mainCard}>
            {/* Embedded Pharmacy Hero Graphic Banner */}
            <Image
              source={require('../../assets/banner-pharmacy.png')}
              style={styles.bannerImage}
              resizeMode="cover"
            />

            <View style={styles.titleSection}>
              <Text style={styles.cardTitle}>💊 Pharmacy & Health Essentials</Text>
              <Text style={styles.cardSubtitle}>
                100% Genuine OTC medicines, syrups, pain relief & wellness items delivered with care.
              </Text>
            </View>

            <View style={styles.grid}>
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} width="48.5%" />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <ShoppingBag size={48} color="#6B21A8" style={{ marginBottom: 12, opacity: 0.5 }} />
            <Text style={styles.emptyTitle}>No medicines found</Text>
            <Text style={styles.emptySubtitle}>
              Try searching for another product or resetting your search query.
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
    backgroundColor: '#FBF9FE',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9D5FF',
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
    color: '#581C87',
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
    borderColor: '#E9D5FF',
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
    borderColor: '#E9D5FF',
  },
  pillActive: {
    backgroundColor: '#6B21A8',
    borderColor: '#6B21A8',
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
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    ...SHADOWS.sm,
  },
  bannerImage: {
    width: '100%',
    height: 150,
    borderRadius: 15,
    marginBottom: 20,
  },
  titleSection: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#581C87',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
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
    borderColor: '#F3E8FF',
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
    backgroundColor: '#6B21A8',
    borderRadius: 8,
  },
  resetBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
