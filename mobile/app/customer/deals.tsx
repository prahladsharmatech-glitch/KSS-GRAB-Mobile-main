import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CustomerTopHeader } from '../../components/CustomerTopHeader';
import { ProductCard } from '../../components/ProductCard';
import { Product } from '../../types';
import { get } from '../../services/api';
import { products as localProducts } from '../../data/products';
import { getCloudinaryUrl, getValidImage } from '../../services/cloudinary';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import {
  ArrowLeft,
  Search,
  Sparkles,
  Tag,
  ShieldCheck,
  Zap,
} from 'lucide-react-native';

const CURATED_DEALS: Product[] = [
  {
    id: '401',
    name: 'Aashirvaad Shudh Chakki Atta 5kg',
    weight: '5kg',
    price: 235,
    originalPrice: 310,
    discountPercent: 24,
    rating: 4.9,
    reviewCount: 2450,
    image: getValidImage('aashirvaad-atta-real.jpg'),
    category: 'staples',
    brand: 'Aashirvaad',
    inStock: true,
  },
  {
    id: '402',
    name: 'Fortune Sunlite Refined Sunflower Oil 1L Pouch',
    weight: '1L',
    price: 135,
    originalPrice: 175,
    discountPercent: 23,
    rating: 4.8,
    reviewCount: 1890,
    image: getValidImage('fortune-oil-real.jpg'),
    category: 'oil',
    brand: 'Fortune',
    inStock: true,
  },
  {
    id: '403',
    name: 'Fortune Everyday Premium Basmati Rice 5kg',
    weight: '5kg',
    price: 349,
    originalPrice: 520,
    discountPercent: 33,
    rating: 4.8,
    reviewCount: 1340,
    image: getValidImage('aashirvaad-atta-real.jpg'),
    category: 'staples',
    brand: 'Fortune',
    inStock: true,
  },
  {
    id: '404',
    name: 'Tata Salt Vacuum Evaporated Iodized Salt 1kg',
    weight: '1kg',
    price: 24,
    originalPrice: 28,
    discountPercent: 14,
    rating: 4.9,
    reviewCount: 3100,
    image: getValidImage('aashirvaad-atta-real.jpg'),
    category: 'staples',
    brand: 'Tata',
    inStock: true,
  },
  {
    id: '405',
    name: 'Cadbury Dairy Milk Silk Chocolate Bar 150g',
    weight: '150g',
    price: 139,
    originalPrice: 175,
    discountPercent: 20,
    rating: 4.9,
    reviewCount: 4200,
    image: getValidImage('cadbury-silk-real.jpg'),
    category: 'chocolates',
    brand: 'Cadbury',
    inStock: true,
  },
  {
    id: '406',
    name: 'Nescafé Classic Instant Coffee Jar 200g',
    weight: '200g',
    price: 549,
    originalPrice: 690,
    discountPercent: 20,
    rating: 4.9,
    reviewCount: 2980,
    image: getValidImage('nescafe-coffee-real.jpg'),
    category: 'beverages',
    brand: 'Nescafé',
    inStock: true,
  },
  {
    id: '407',
    name: "Lay's Spanish Tomato Tango Chips (Pack of 3)",
    weight: '150g',
    price: 50,
    originalPrice: 65,
    discountPercent: 23,
    rating: 4.8,
    reviewCount: 1950,
    image: getValidImage('lays_magic_masala.png'),
    category: 'snacks-munchies',
    brand: "Lay's",
    inStock: true,
  },
  {
    id: '408',
    name: 'Real Fruit Power Mixed Fruit Juice 1L Tetra',
    weight: '1L',
    price: 99,
    originalPrice: 140,
    discountPercent: 29,
    rating: 4.8,
    reviewCount: 1620,
    image: getValidImage('coca-cola-real.jpg'),
    category: 'beverages',
    brand: 'Real',
    inStock: true,
  },
  {
    id: '409',
    name: 'Dove Cream Beauty Bathing Soap (Pack of 4 x 100g)',
    weight: '400g',
    price: 199,
    originalPrice: 260,
    discountPercent: 23,
    rating: 4.9,
    reviewCount: 2890,
    image: getValidImage('dettol-handwash-real.jpg'),
    category: 'personal-care',
    brand: 'Dove',
    inStock: true,
  },
  {
    id: '410',
    name: 'Dettol Antiseptic Liquid Disinfectant 550ml',
    weight: '550ml',
    price: 215,
    originalPrice: 265,
    discountPercent: 19,
    rating: 4.9,
    reviewCount: 3450,
    image: getValidImage('dettol-handwash-real.jpg'),
    category: 'personal-care',
    brand: 'Dettol',
    inStock: true,
  },
  {
    id: '411',
    name: 'Surf Excel Easy Wash Detergent Powder 1kg',
    weight: '1kg',
    price: 135,
    originalPrice: 160,
    discountPercent: 15,
    rating: 4.8,
    reviewCount: 1780,
    image: getValidImage('surf-excel-real.jpg'),
    category: 'household',
    brand: 'Surf Excel',
    inStock: true,
  },
];

export default function ExclusiveDealsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [productsList, setProductsList] = useState<Product[]>(CURATED_DEALS);

  useEffect(() => {
    fetchBackendDeals();
  }, []);

  const fetchBackendDeals = async () => {
    try {
      const res = await get<any[]>('/products?limit=50');
      if (res && Array.isArray(res) && res.length > 0) {
        const dealProducts: Product[] = res
          .filter((p: any) => (p.discount_percent || p.discountPercent || 0) >= 15 || p.mrp > p.price)
          .map((p: any) => ({
            ...p,
            id: String(p.id),
            name: p.name,
            price: Number(p.price || 0),
            originalPrice: p.originalPrice || p.original_price || Math.round((p.price || 0) * 1.25),
            discountPercent: p.discountPercent || p.discount_percent || 15,
            image: getValidImage(p.image_url || p.image),
            inStock: p.inStock ?? (p.stock !== undefined ? p.stock > 0 : true),
            rating: p.rating || 4.8,
            reviewCount: p.reviewCount || 150,
          }));

        const mergedMap = new Map<string, Product>();
        CURATED_DEALS.forEach((cp) => mergedMap.set(String(cp.id), cp));
        dealProducts.forEach((dp) => mergedMap.set(String(dp.id), dp));
        setProductsList(Array.from(mergedMap.values()));
      }
    } catch {
      // Keep CURATED_DEALS
    }
  };

  const filteredDeals = useMemo(() => {
    return productsList.filter((p) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return p.name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q));
    });
  }, [productsList, searchQuery]);

  return (
    <View style={styles.container}>
      {/* ── 1. EXACT HOME PAGE TOP HEADER ── */}
      <CustomerTopHeader />

      {/* ── 2. BACK BUTTON & DEALS SEARCH BAR ── */}
      <View style={styles.searchHeaderRow}>
        <Pressable style={styles.backBtnCircle} onPress={() => router.back()}>
          <ArrowLeft size={18} color="#1E293B" />
        </Pressable>

        <View style={styles.searchInputContainer}>
          <Search size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search 60% OFF deals, groceries, snacks, soaps..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── 3. EXCLUSIVE DEALS & OFFERS HERO BANNER ── */}
        <View style={styles.heroBannerCard}>
          <Image
            source={{ uri: getCloudinaryUrl('banner-exclusive-deals.png') }}
            style={styles.heroImage}
            resizeMode="cover"
          />

          <View style={styles.bannerInfoSection}>
            <View style={styles.savingsPill}>
              <Sparkles size={12} color="#6B21A8" style={{ marginRight: 4 }} />
              <Text style={styles.savingsPillText}>UNBEATABLE MEGA SAVINGS</Text>
            </View>

            <Text style={styles.bannerTitle}>Exclusive Deals & Offers</Text>
            <Text style={styles.bannerSubtitle}>
              Groceries, Snacks, Beverages, Personal Care & Household Essentials at guaranteed lowest prices.
            </Text>
          </View>
        </View>

        {/* ── 4. 2-COLUMN ALL DEALS PRODUCT GRID ── */}
        {filteredDeals.length > 0 ? (
          <View style={styles.productGrid}>
            {filteredDeals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Tag size={44} color="#6B21A8" style={{ alignSelf: 'center', marginBottom: 12, opacity: 0.5 }} />
            <Text style={styles.emptyTitle}>No deal products found</Text>
            <Text style={styles.emptySub}>Try searching for another product or resetting your search query.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6FE',
  },
  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#F8F6FE',
    gap: 10,
  },
  backBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8B4FE',
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...SHADOWS.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 40,
  },
  heroBannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    padding: 14,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  heroImage: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    marginBottom: 14,
  },
  bannerInfoSection: {
    marginBottom: 4,
  },
  savingsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  savingsPillText: {
    color: '#6B21A8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#4C1D95',
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
});
