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
import { optimizeImageUrl, DEFAULT_FALLBACK_IMAGE } from '../services/cloudinary';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import ProductSuggestionModal from './ProductSuggestionModal';
import {
  Search,
  X,
  ArrowRight,
  Lightbulb,
  Clock,
  Sparkles,
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
    return searchProducts(searchQuery.trim()).slice(0, 5);
  }, [searchQuery]);

  // 2. Category Suggestions matching React Web Header.jsx
  const categorySuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return ALL_CATEGORY_KEYS.filter((c) => {
      return (
        c.slug.includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.words.some((w) => q.includes(w) || w.includes(q))
      );
    }).slice(0, 2);
  }, [searchQuery]);

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
              <View>
                <View style={styles.recentHeaderRow}>
                  <Text style={styles.recentHeaderTitle}>🔍 Often & Recently Searched</Text>
                  <Pressable onPress={clearOftenSearched}>
                    <Text style={styles.clearText}>Clear</Text>
                  </Pressable>
                </View>

                <View style={styles.recentPillsGrid}>
                  {oftenSearched.map((item) => (
                    <Pressable
                      key={item.query}
                      style={styles.recentPill}
                      onPress={() => {
                        setSearchQuery(item.query);
                        handleExecuteSearch(item.query);
                      }}
                    >
                      <Clock size={12} color="#1E40AF" style={{ marginRight: 4 }} />
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
                {/* 1. Category Suggestions */}
                {categorySuggestions.length > 0 && (
                  <View style={styles.categoryPillsRow}>
                    {categorySuggestions.map((c) => (
                      <Pressable
                        key={c.slug}
                        style={styles.catExplorePill}
                        onPress={() => handleSelectCategory(c.slug)}
                      >
                        <Text style={styles.catExploreText}>
                          📁 Explore in <Text style={{ fontWeight: '900' }}>{c.name}</Text>
                        </Text>
                        <ArrowRight size={11} color="#1E40AF" style={{ marginLeft: 4 }} />
                      </Pressable>
                    ))}
                  </View>
                )}

                {/* 2. Brand Suggestions */}
                {brandSuggestions.length > 0 && (
                  <View style={styles.brandPillsRow}>
                    {brandSuggestions.map((b) => (
                      <Pressable
                        key={b}
                        style={styles.brandPill}
                        onPress={() => handleSelectBrand(b)}
                      >
                        <Text style={styles.brandPillText}>
                          🏷️ Brand: <Text style={{ fontWeight: '900', color: '#0F172A' }}>{b}</Text>
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {/* 3. Product Suggestions Section Header */}
                <View style={styles.sectionHeadingRow}>
                  <Text style={styles.sectionHeadingText}>
                    PRODUCT SUGGESTIONS ({matchingProducts.length})
                  </Text>
                </View>

                {/* 4. Product List or Empty State */}
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
                      const imgUri = optimizeImageUrl(prod.image, 150);
                      return (
                        <Pressable
                          key={prod.id}
                          style={styles.productRow}
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
                              <Text style={styles.productDot}>•</Text>
                              <Text style={styles.productPrice}>₹{prod.price}</Text>
                              {prod.originalPrice && prod.originalPrice > prod.price ? (
                                <Text style={styles.productMrp}>₹{prod.originalPrice}</Text>
                              ) : null}
                            </View>
                          </View>

                          <ArrowRight size={14} color="#94A3B8" />
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* 5. View all results for query */}
                <Pressable
                  style={styles.viewAllRow}
                  onPress={() => handleExecuteSearch(searchQuery)}
                >
                  <Text style={styles.viewAllText}>
                    View all results for "{searchQuery}"
                  </Text>
                  <ArrowRight size={14} color="#0071E3" style={{ marginLeft: 6 }} />
                </Pressable>

                {/* 6. Suggest a Product link */}
                <Pressable
                  style={styles.suggestFooterRow}
                  onPress={() => {
                    setIsSearchFocused(false);
                    setIsSuggestionModalOpen(true);
                  }}
                >
                  <Lightbulb size={14} color="#0071E3" style={{ marginRight: 6 }} />
                  <Text style={styles.suggestFooterText}>
                    Can't find an item? Suggest a product to Grabit
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
    maxHeight: 440,
    zIndex: 99999,
    overflow: 'hidden',
    ...SHADOWS.lg,
    elevation: 20,
  },
  dropdownScrollContent: {
    paddingVertical: 10,
  },

  /* Often & Recently Searched */
  recentHeaderRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0071E3',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  recentPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  recentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  recentPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
  },
  recentCountBadge: {
    marginLeft: 6,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  recentCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E3A8A',
  },

  /* Category Explore Pills */
  categoryPillsRow: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 6,
  },
  catExplorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  catExploreText: {
    fontSize: 11.5,
    color: '#1E40AF',
  },

  /* Brand Pills */
  brandPillsRow: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  brandPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  brandPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },

  /* Section Heading */
  sectionHeadingRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  sectionHeadingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },

  /* Product Rows */
  productsListContainer: {
    flexDirection: 'column',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 12,
  },
  productThumbBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    padding: 2,
  },
  productThumbImg: {
    width: 32,
    height: 32,
  },
  productInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
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
  productDot: {
    fontSize: 11,
    color: '#94A3B8',
  },
  productPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0071E3',
  },
  productMrp: {
    fontSize: 10.5,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },

  /* Empty State / No Match */
  noMatchCard: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 6,
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
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderTopWidth: 1,
    borderTopColor: '#BFDBFE',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  viewAllText: {
    color: '#0071E3',
    fontSize: 12.5,
    fontWeight: '900',
  },
  suggestFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  suggestFooterText: {
    color: '#0071E3',
    fontSize: 12,
    fontWeight: '800',
  },
});
export default SearchAutocomplete;
