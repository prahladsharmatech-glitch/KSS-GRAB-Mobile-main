import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  StyleSheet,
} from 'react-native';
import { categories as staticCategories, CategoryItem } from '../../data/categories';
import { useCart } from '../../context/CartContext';
import { useLocation } from '../../context/LocationContext';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { useRouter } from 'expo-router';
import { get } from '../../services/api';
import { getCloudinaryUrl, getValidImage, optimizeImageUrl, DEFAULT_FALLBACK_IMAGE } from '../../services/cloudinary';
import {
  Search,
  MapPin,
  Bell,
  ShoppingBag,
  ArrowLeft,
  Zap,
} from 'lucide-react-native';
import { SearchAutocomplete } from '../../components/SearchAutocomplete';
import { CustomerTopHeader } from '../../components/CustomerTopHeader';

const LOCAL_CATEGORY_IMAGES: Record<string, any> = {
  'coca-cola-real.jpg': require('../../assets/coca-cola-real.jpg'),
  'aashirvaad-atta-real.jpg': require('../../assets/aashirvaad-atta-real.jpg'),
  'amul-butter-real.jpg': require('../../assets/amul-butter-real.jpg'),
  'combo-munchies.jpg': require('../../assets/combo-munchies.jpg'),
  'cadbury-silk-real.jpg': require('../../assets/cadbury-silk-real.jpg'),
  'dettol-handwash-real.jpg': require('../../assets/dettol-handwash-real.jpg'),
  'fortune-oil-real.jpg': require('../../assets/fortune-oil-real.jpg'),
  'apples-real.jpg': require('../../assets/apples-real.jpg'),
  'deal-banner-household.jpg': require('../../assets/deal-banner-household.jpg'),
};

const getCatImgSource = (imgStr?: string) => {
  if (!imgStr || typeof imgStr !== 'string') return { uri: DEFAULT_FALLBACK_IMAGE };
  const clean = getValidImage(imgStr);
  if (clean === DEFAULT_FALLBACK_IMAGE) return { uri: DEFAULT_FALLBACK_IMAGE };

  const filename = clean.split('/').pop()?.split('?')[0] || '';
  if (LOCAL_CATEGORY_IMAGES[clean]) return LOCAL_CATEGORY_IMAGES[clean];
  if (LOCAL_CATEGORY_IMAGES[filename]) return LOCAL_CATEGORY_IMAGES[filename];

  return { uri: optimizeImageUrl(clean, 300) };
};

const QUICK_SUB_CHIPS = ['Cookies', 'Frozen Food', '& Ghee'];

export default function CategoriesPage() {
  const router = useRouter();
  const { totalItems } = useCart();
  const { currentAddress, fetchCurrentLocation } = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [allCategories, setAllCategories] = useState<CategoryItem[]>(staticCategories);
  const lastFetchRef = useRef<number>(0);

  useEffect(() => {
    if (Date.now() - lastFetchRef.current > 30000) {
      fetchBackendCategories();
    }
  }, []);

  const fetchBackendCategories = async () => {
    try {
      const res = await get('/categories');
      lastFetchRef.current = Date.now();
      if (res && Array.isArray(res) && res.length > 0) {
        const mergedMap = new Map<string, CategoryItem>();
        staticCategories.forEach((cat) => mergedMap.set(cat.name.toLowerCase().trim(), cat));
        res.forEach((cat: any) => {
          const key = (cat.name || '').toLowerCase().trim();
          if (key) {
            const existing = mergedMap.get(key);
            const validImg = getValidImage(cat.image_url || cat.image || existing?.image);
            mergedMap.set(key, {
              id: cat.id || existing?.id || key,
              name: cat.name || existing?.name || '',
              slug: cat.slug || existing?.slug || key.replace(/\s+/g, '-'),
              icon: cat.icon || existing?.icon || '🛍️',
              image: validImg,
              itemCount: cat.itemCount || existing?.itemCount || 20,
            });
          }
        });
        setAllCategories(Array.from(mergedMap.values()));
      }
    } catch {
      // Fallback to staticCategories if backend call fails
    }
  };

  const filteredCategories = allCategories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

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

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── 3. SEARCH CATEGORIES INPUT BOX ── */}
        <View style={styles.catSearchInputContainer}>
          <Search size={16} color="#0066FF" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.catSearchInput}
            placeholder="Search categories..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* ── 4. FIRST 9 CATEGORIES GRID (3-COLUMN) ── */}
        <View style={styles.threeColumnGrid}>
          {filteredCategories.slice(0, 9).map((cat) => (
            <Pressable
              key={cat.id}
              style={styles.gridCard}
              onPress={() => router.push(`/customer/category/${cat.slug}` as any)}
            >
              <View style={styles.imageBox}>
                <Image
                  source={getCatImgSource(cat.image)}
                  style={styles.catImage}
                  resizeMode="cover"
                  fadeDuration={0}
                />
              </View>
              <Text style={styles.catTitle} numberOfLines={2}>
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── 5. QUICK SUB-CHIPS STRIP ── */}
        {filteredCategories.length >= 9 && (
          <View style={styles.quickSubRow}>
            {QUICK_SUB_CHIPS.map((chip, idx) => (
              <View key={idx} style={styles.quickSubPill}>
                <Text style={styles.quickSubText}>{chip}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── 6. REMAINING CATEGORIES GRID (3-COLUMN) ── */}
        <View style={styles.threeColumnGrid}>
          {filteredCategories.slice(9).map((cat) => (
            <Pressable
              key={cat.id}
              style={styles.gridCard}
              onPress={() => router.push(`/customer/category/${cat.slug}` as any)}
            >
              <View style={styles.imageBox}>
                <Image
                  source={getCatImgSource(cat.image)}
                  style={styles.catImage}
                  resizeMode="cover"
                  fadeDuration={0}
                />
              </View>
              <Text style={styles.catTitle} numberOfLines={2}>
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </View>

        {filteredCategories.length === 0 && (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateTitle}>No categories found</Text>
            <Text style={styles.emptyStateSub}>Try searching for another term like "Snacks" or "Produce"</Text>
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

  /* Category Filter Search Input */
  catSearchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    height: 42,
    paddingHorizontal: 12,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  catSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },

  /* 3 Column Grid */
  threeColumnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  gridCard: {
    width: '31.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  imageBox: {
    width: '100%',
    height: 80,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  catImage: {
    width: '100%',
    height: '100%',
  },
  catTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 14,
    height: 28,
  },

  /* Quick Sub Chips */
  quickSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: SPACING.md,
    gap: 8,
  },
  quickSubPill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  quickSubText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },

  emptyStateContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
});
