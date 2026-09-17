import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '../types';
import { searchProducts } from '../data/products';
import { getSynchronizedProducts, getSynchronizedCategories, onCatalogUpdate } from '../services/catalog';
import { optimizeImageUrl, getValidImage, DEFAULT_FALLBACK_IMAGE } from '../services/cloudinary';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import ProductSuggestionModal from './ProductSuggestionModal';
import {
  Search,
  X,
  ArrowRight,
  ChevronRight,
  Lightbulb,
  Clock,
  Sparkles,
  Tag,
  Compass,
  Package,
} from 'lucide-react-native';

const OFTEN_SEARCHED_KEY = '@grabit_often_searched';

const ALL_CATEGORY_KEYS = [
  { slug: 'produce', name: 'Fresh Fruits & Veggies', words: ['fruits', 'veggies', 'vegetables', 'apple', 'banana', 'tomato', 'onion', 'produce'] },
  { slug: 'dairy-bakery', name: 'Dairy & Bakery', words: ['dairy', 'milk', 'cheese', 'butter', 'bread', 'paneer', 'bakery', 'dahi', 'curd'] },
  { slug: 'beverages', name: 'Cold Drinks & Juices', words: ['beverages', 'drinks', 'coke', 'pepsi', 'juice', 'soda', 'cold drink'] },
  { slug: 'snacks-munchies', name: 'Snacks & Munchies', words: ['snacks', 'munchies', 'chips', 'lays', 'kurkure', 'namkeen', 'biscuit'] },
  { slug: 'staples', name: 'Atta, Rice & Dal', words: ['staples', 'atta', 'rice', 'dal', 'flour', 'pulses', 'chawal', 'wheat'] },
  { slug: 'chocolates', name: 'Chocolates & Sweets', words: ['chocolate', 'chocolates', 'sweets', 'cadbury', 'silk', 'mithai'] },
  { slug: 'personal-care', name: 'Personal Care', words: ['personal care', 'soap', 'shampoo', 'toothpaste', 'brush', 'body wash'] },
  { slug: 'baby-care', name: 'Baby Care', words: ['baby', 'baby care', 'diaper', 'diapers', 'pampers', 'wipes', 'cerelac'] },
  { slug: 'pet-care', name: 'Pet Care & Food', words: ['pet', 'pet care', 'dog', 'cat', 'dog food', 'cat food', 'pedigree', 'whiskas'] },
  { slug: 'beauty-cosmetics', name: 'Beauty & Cosmetics', words: ['beauty', 'cosmetics', 'makeup', 'lipstick', 'kajal', 'skin'] },
  { slug: 'health-wellness', name: 'Health & Wellness', words: ['health', 'wellness', 'pharmacy', 'medicine', 'vitamins', 'dettol'] },
  { slug: 'meat-seafood', name: 'Meat & Seafood', words: ['meat', 'chicken', 'fish', 'eggs', 'egg', 'seafood', 'mutton'] },
  { slug: 'home-kitchen', name: 'Home & Kitchen', words: ['home', 'kitchen', 'cookware', 'pan', 'cooker', 'flask', 'bottle'] },
  { slug: 'stationery-office', name: 'Stationery & Office', words: ['stationery', 'office', 'notebook', 'pen', 'pencil', 'book', 'paper'] },
  { slug: 'sports-fitness', name: 'Sports & Fitness', words: ['sports', 'fitness', 'cricket', 'badminton', 'gym', 'yoga', 'protein'] },
  { slug: 'toys-games', name: 'Toys & Games', words: ['toys', 'games', 'game', 'puzzle', 'board game', 'toy'] },
  { slug: 'pooja-needs', name: 'Pooja Needs', words: ['pooja', 'agarbatti', 'diya', 'incense', 'camphor', 'dhoop', 'puja'] },
];

export interface SearchAutocompleteProps {
  placeholder?: string;
  initialQuery?: string;
  autoFocus?: boolean;
  onSearchSubmit?: (query: string) => void;
  style?: any;
}

export function SearchAutocomplete({
  placeholder = 'Search for milk, butter, chips, snacks...',
  initialQuery = '',
  autoFocus = false,
  onSearchSubmit,
  style,
}: SearchAutocompleteProps) {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [oftenSearched, setOftenSearched] = useState<Array<{ query: string; count: number; timestamp: number }>>([]);
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [suggestCategory, setSuggestCategory] = useState('Snacks & Munchies');
  const [syncedProducts, setSyncedProducts] = useState<Product[]>([]);
  const [dynamicCategories, setDynamicCategories] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [prods, cats] = await Promise.all([
          getSynchronizedProducts(),
          getSynchronizedCategories(),
        ]);
        if (isMounted) {
          if (prods && prods.length > 0) setSyncedProducts(prods);
          if (cats && cats.length > 0) setDynamicCategories(cats);
        }
      } catch {}
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [isSearchFocused]);

  useEffect(() => {
    const unsub = onCatalogUpdate(() => {
      getSynchronizedProducts().then(setSyncedProducts).catch(() => {});
      getSynchronizedCategories().then(setDynamicCategories).catch(() => {});
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (initialQuery !== undefined) {
      setSearchQuery(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    loadOftenSearched();
  }, [isSearchFocused]);

  const loadOftenSearched = async () => {
    try {
      const raw = await AsyncStorage.getItem(OFTEN_SEARCHED_KEY);
      if (raw) {
        setOftenSearched(JSON.parse(raw));
      } else {
        setOftenSearched([]);
      }
    } catch {
      setOftenSearched([]);
    }
  };

  const trackCustomerSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    try {
      const raw = await AsyncStorage.getItem(OFTEN_SEARCHED_KEY);
      const history: Array<{ query: string; count: number; timestamp: number }> = raw ? JSON.parse(raw) : [];
      const existing = history.find((h) => h.query.toLowerCase() === trimmed.toLowerCase());
      const newCount = existing ? (existing.count || 1) + 1 : 1;
      const filtered = history.filter((h) => h.query.toLowerCase() !== trimmed.toLowerCase());
      const updated = [{ query: trimmed, count: newCount, timestamp: Date.now() }, ...filtered].slice(0, 8);
      setOftenSearched(updated);
      await AsyncStorage.setItem(OFTEN_SEARCHED_KEY, JSON.stringify(updated));
    } catch {}
  };

  const clearOftenSearched = async () => {
    try {
      await AsyncStorage.removeItem(OFTEN_SEARCHED_KEY);
      setOftenSearched([]);
    } catch {}
  };

  // 1. Matching Products scored by search algorithm
  const matchingProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const source = syncedProducts.length > 0 ? syncedProducts : [];
    if (source.length > 0) {
      const tokens = q.split(/\s+/).filter(Boolean);
      const matched = source.filter((p) => {
        const name = (p.name || '').toLowerCase();
        const brand = (p.brand || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        return tokens.every((t) => name.includes(t) || brand.includes(t) || cat.includes(t));
      });
      if (matched.length > 0) return matched.slice(0, 5);
    }
    return searchProducts(searchQuery.trim()).slice(0, 5);
  }, [searchQuery, syncedProducts]);

  // 2. Category Suggestions matching React Web Header.jsx
  const categorySuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const baseSuggestions = ALL_CATEGORY_KEYS.filter((c) => {
      return (
        c.slug.includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.words.some((w) => q.includes(w) || w.includes(q))
      );
    });

    const dynamicSuggestions = dynamicCategories
      .filter((c) => {
        const name = (c.name || '').toLowerCase();
        const slug = (c.slug || '').toLowerCase();
        return name.includes(q) || slug.includes(q);
      })
      .map((c) => ({
        slug: c.slug || c.id,
        name: c.name,
        words: [c.name.toLowerCase()],
      }));

    const combined = [...dynamicSuggestions, ...baseSuggestions];
    const seen = new Set<string>();
    const unique = combined.filter((c) => {
      if (seen.has(c.slug)) return false;
      seen.add(c.slug);
      return true;
    });

    return unique.slice(0, 2);
  }, [searchQuery, dynamicCategories]);

  // 3. Brand Suggestions matching React Web Header.jsx
  const brandSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return Array.from(
      new Set(matchingProducts.map((p) => p.brand).filter(Boolean) as string[])
    ).slice(0, 3);
  }, [searchQuery, matchingProducts]);

  const handleExecuteSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    trackCustomerSearch(trimmed);
    setIsSearchFocused(false);
    Keyboard.dismiss();

    if (onSearchSubmit) {
      onSearchSubmit(trimmed);
    } else {
      router.push(`/customer/search?q=${encodeURIComponent(trimmed)}` as any);
    }
  };

  const handleSelectProduct = (product: Product) => {
    trackCustomerSearch(product.name);
    setIsSearchFocused(false);
    Keyboard.dismiss();
    router.push(`/customer/product/${product.id}` as any);
  };

  const handleSelectCategory = (categorySlug: string) => {
    setIsSearchFocused(false);
    Keyboard.dismiss();
    router.push(`/customer/category/${categorySlug}` as any);
  };

  const handleSelectBrand = (brand: string) => {
    setSearchQuery(brand);
    handleExecuteSearch(brand);
  };

  const showDropdown = isSearchFocused && (searchQuery.trim().length > 0 || oftenSearched.length > 0);

  return (
    <View style={[styles.wrapper, style]}>
      {/* ── Search Input Box ── */}
      <View style={[styles.inputBox, isSearchFocused && styles.inputBoxFocused]}>
        <Search size={16} color="#64748B" style={{ marginRight: 8 }} />
        <TextInput
          ref={inputRef}
          style={styles.textInput}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          autoFocus={autoFocus}
          onFocus={() => setIsSearchFocused(true)}
          onChangeText={(txt) => {
            setSearchQuery(txt);
            setIsSearchFocused(true);
          }}
          onSubmitEditing={() => handleExecuteSearch(searchQuery)}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable
            style={styles.clearBtn}
            onPress={() => {
              setSearchQuery('');
              setIsSearchFocused(true);
              inputRef.current?.focus();
            }}
          >
            <X size={13} color="#64748B" />
          </Pressable>
        )}
      </View>

      {/* ── Dropdown Overlay ── */}
      {showDropdown && (
        <View style={styles.dropdownCard}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.dropdownScrollContent}
          >
            {/* Case A: Often & Recently Searched (Empty Query) */}
            {searchQuery.trim().length === 0 ? (
              <View style={styles.recentContainer}>
                <View style={styles.recentHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Clock size={12} color="#64748B" style={{ marginRight: 6 }} />
                    <Text style={styles.recentHeaderTitle}>RECENT SEARCHES</Text>
                  </View>
                  <Pressable onPress={clearOftenSearched} hitSlop={8}>
                    <Text style={styles.clearText}>Clear all</Text>
                  </Pressable>
                </View>

                <View style={styles.recentPillsGrid}>
                  {oftenSearched.map((item) => (
                    <Pressable
                      key={item.query}
                      style={({ pressed }) => [
                        styles.recentPill,
                        pressed && { backgroundColor: '#E2E8F0' },
                      ]}
                      onPress={() => {
                        setSearchQuery(item.query);
                        handleExecuteSearch(item.query);
                      }}
                    >
                      <Clock size={11} color="#64748B" style={{ marginRight: 5 }} />
                      <Text style={styles.recentPillText}>{item.query}</Text>
                      {item.count > 1 && (
                        <View style={styles.recentCountBadge}>
                          <Text style={styles.recentCountText}>{item.count}x</Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              /* Case B: Autocomplete Results for Active Query */
              <View>
                {/* 1. Category & Brand Quick Filter Chips */}
                {(categorySuggestions.length > 0 || brandSuggestions.length > 0) && (
                  <View style={styles.quickFiltersContainer}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.quickFiltersScroll}
                    >
                      {categorySuggestions.map((c) => (
                        <Pressable
                          key={c.slug}
                          style={({ pressed }) => [
                            styles.categoryPill,
                            pressed && { opacity: 0.8 },
                          ]}
                          onPress={() => handleSelectCategory(c.slug)}
                        >
                          <Compass size={12} color="#0071E3" style={{ marginRight: 5 }} />
                          <Text style={styles.categoryPillText}>
                            In <Text style={{ fontWeight: '800', color: '#0071E3' }}>{c.name}</Text>
                          </Text>
                          <ArrowRight size={10} color="#0071E3" style={{ marginLeft: 4 }} />
                        </Pressable>
                      ))}

                      {brandSuggestions.map((b) => (
                        <Pressable
                          key={b}
                          style={({ pressed }) => [
                            styles.brandPill,
                            pressed && { opacity: 0.8 },
                          ]}
                          onPress={() => handleSelectBrand(b)}
                        >
                          <Tag size={11} color="#64748B" style={{ marginRight: 5 }} />
                          <Text style={styles.brandPillText}>{b}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* 2. Product Matches Section Header */}
                {matchingProducts.length > 0 && (
                  <View style={styles.sectionHeadingRow}>
                    <Package size={12} color="#64748B" style={{ marginRight: 6 }} />
                    <Text style={styles.sectionHeadingText}>
                      PRODUCTS ({matchingProducts.length})
                    </Text>
                  </View>
                )}

                {/* 3. Product List or Empty State */}
                {matchingProducts.length === 0 ? (
                  <View style={styles.noMatchCard}>
                    <Text style={styles.noMatchTitle}>No matches for "{searchQuery}"</Text>
                    <Text style={styles.noMatchSub}>
                      Can't find what you're looking for? Suggest it to us!
                    </Text>
                    <Pressable
                      style={styles.suggestMatchBtn}
                      onPress={() => {
                        setIsSearchFocused(false);
                        setIsSuggestionModalOpen(true);
                      }}
                    >
                      <Lightbulb size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.suggestMatchBtnText}>
                        Suggest "{searchQuery}" to Grabit
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.productsListContainer}>
                    {matchingProducts.map((prod) => {
                      const rawImage = prod.image_url || prod.image;
                      const validImg = getValidImage(rawImage);
                      const imgUri = optimizeImageUrl(validImg, 150);
                      const hasDiscount = prod.originalPrice && prod.originalPrice > prod.price;
                      const discountPct = hasDiscount
                        ? Math.round(((prod.originalPrice! - prod.price) / prod.originalPrice!) * 100)
                        : 0;

                      return (
                        <Pressable
                          key={prod.id}
                          style={({ pressed }) => [
                            styles.productRow,
                            pressed && styles.productRowPressed,
                          ]}
                          onPress={() => handleSelectProduct(prod)}
                        >
                          <View style={styles.productThumbBox}>
                            <Image
                              source={{ uri: imgUri || DEFAULT_FALLBACK_IMAGE }}
                              style={styles.productThumbImg}
                              resizeMode="contain"
                              fadeDuration={0}
                            />
                          </View>

                          <View style={styles.productInfoCol}>
                            <Text style={styles.productName} numberOfLines={1}>
                              {prod.name}
                            </Text>
                            <View style={styles.productMetaRow}>
                              <Text style={styles.productWeight}>{prod.weight || '1 pack'}</Text>
                              <View style={styles.metaDot} />
                              <Text style={styles.productPrice}>₹{prod.price}</Text>
                              {hasDiscount && (
                                <Text style={styles.productMrp}>₹{prod.originalPrice}</Text>
                              )}
                              {hasDiscount && discountPct > 0 && (
                                <View style={styles.discountBadge}>
                                  <Text style={styles.discountBadgeText}>{discountPct}% OFF</Text>
                                </View>
                              )}
                            </View>
                          </View>

                          <View style={styles.chevronBox}>
                            <ChevronRight size={14} color="#94A3B8" />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* 4. View all results for query */}
                <Pressable
                  style={({ pressed }) => [
                    styles.viewAllRow,
                    pressed && { backgroundColor: '#E0F2FE' },
                  ]}
                  onPress={() => handleExecuteSearch(searchQuery)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Search size={14} color="#0071E3" style={{ marginRight: 8 }} />
                    <Text style={styles.viewAllText}>
                      View all results for "{searchQuery}"
                    </Text>
                  </View>
                  <ArrowRight size={13} color="#0071E3" />
                </Pressable>

                {/* 5. Suggest a Product link */}
                <Pressable
                  style={({ pressed }) => [
                    styles.suggestFooterRow,
                    pressed && { backgroundColor: '#F1F5F9' },
                  ]}
                  onPress={() => {
                    setIsSearchFocused(false);
                    setIsSuggestionModalOpen(true);
                  }}
                >
                  <Lightbulb size={13} color="#64748B" style={{ marginRight: 6 }} />
                  <Text style={styles.suggestFooterText}>
                    Can't find an item?{' '}
                    <Text style={styles.suggestFooterHighlight}>Suggest a product →</Text>
                  </Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Suggestion Modal */}
      <ProductSuggestionModal
        isOpen={isSuggestionModalOpen}
        onClose={() => setIsSuggestionModalOpen(false)}
        prefillQuery={searchQuery}
        prefillCategory={suggestCategory}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 9999,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    height: 42,
    paddingHorizontal: 12,
    ...SHADOWS.sm,
  },
  inputBoxFocused: {
    borderColor: '#0071E3',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
    fontWeight: '500',
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },

  /* Dropdown Card */
  dropdownCard: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxHeight: 400,
    zIndex: 99999,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  dropdownScrollContent: {
    paddingBottom: 4,
  },

  /* Often & Recently Searched */
  recentContainer: {
    paddingVertical: 4,
  },
  recentHeaderRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  clearText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  recentPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  recentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  recentPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  recentCountBadge: {
    marginLeft: 5,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  recentCountText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#475569',
  },

  /* Quick Filter Chips (Categories & Brands) */
  quickFiltersContainer: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  quickFiltersScroll: {
    paddingHorizontal: 14,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  categoryPillText: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '600',
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  brandPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },

  /* Section Heading */
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  sectionHeadingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },

  /* Products List */
  productsListContainer: {
    flexDirection: 'column',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 12,
  },
  productRowPressed: {
    backgroundColor: '#F8FAFC',
  },
  productThumbBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  productThumbImg: {
    width: 38,
    height: 38,
  },
  productInfoCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 3,
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  productWeight: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
  },
  productPrice: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  productMrp: {
    fontSize: 11,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  discountBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#059669',
  },
  chevronBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Empty State / No Match */
  noMatchCard: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginHorizontal: 14,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noMatchTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  noMatchSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 12,
  },
  suggestMatchBtn: {
    backgroundColor: '#0071E3',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  suggestMatchBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  /* Bottom Actions */
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F7FF',
    borderTopWidth: 1,
    borderTopColor: '#DBEAFE',
    paddingVertical: 11,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  viewAllText: {
    color: '#0071E3',
    fontSize: 12.5,
    fontWeight: '800',
  },
  suggestFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  suggestFooterText: {
    color: '#64748B',
    fontSize: 11.5,
    fontWeight: '500',
  },
  suggestFooterHighlight: {
    color: '#0071E3',
    fontWeight: '700',
  },
});
export default SearchAutocomplete;
