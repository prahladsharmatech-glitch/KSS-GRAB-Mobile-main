import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get } from '../../services/api';
import { Product } from '../../types';
import { searchProducts as localSearch } from '../../data/products';
import { ProductCard } from '../../components/ProductCard';
import { EmptyState } from '../../components/EmptyState';
import { LoadingView } from '../../components/LoadingView';
import { getValidImage } from '../../services/cloudinary';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { ArrowLeft } from 'lucide-react-native';
import { SearchAutocomplete } from '../../components/SearchAutocomplete';

export default function SearchResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q || '');
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'rating'>('rating');
  const [results, setResults] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (params.q) {
      setQuery(params.q);
    }
  }, [params.q]);

  useEffect(() => {
    const fetchSearchResults = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      try {
        const res = await get<Product[]>(`/products?q=${encodeURIComponent(query)}`);
        let finalResults: Product[] = [];

        if (res && Array.isArray(res) && res.length > 0) {
          finalResults = res.map((p: any) => ({
            ...p,
            id: String(p.id),
            name: p.name,
            price: p.price,
            originalPrice: p.originalPrice || p.original_price || Math.round(p.price * 1.25),
            discountPercent: p.discountPercent || p.discount_percent || 15,
            image: getValidImage(p.image || p.image_url),
            category: p.category || p.categories?.name || 'produce',
            inStock: p.inStock ?? (p.stock !== undefined ? p.stock > 0 : true),
          }));
        } else {
          // Fallback to local search
          const local = localSearch(query);
          if (local && local.length > 0) {
            finalResults = local;
          } else {
            // Even more broad fallback from all local products
            finalResults = localSearch(query.split(' ')[0]) || [];
          }
        }

        const sorted = [...finalResults].sort((a, b) => {
          if (sortBy === 'price_asc') return a.price - b.price;
          if (sortBy === 'price_desc') return b.price - a.price;
          return (b.rating || 0) - (a.rating || 0);
        });
        setResults(sorted);
      } catch {
        setResults(localSearch(query));
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchSearchResults, 300);
    return () => clearTimeout(timer);
  }, [query, sortBy]);

  const handleSearch = (text: string) => {
    setQuery(text);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={COLORS.text} />
        </Pressable>

        <SearchAutocomplete
          initialQuery={query}
          autoFocus={!params.q}
          onSearchSubmit={(q) => setQuery(q)}
          style={{ flex: 1 }}
        />
      </View>

      {query.trim().length > 0 && (
        <View style={styles.resultHeader}>
          <Text style={styles.resultTitle}>
            Results for "{query}" ({results.length})
          </Text>
          <View style={styles.sortRow}>
            <Pressable onPress={() => setSortBy('rating')} style={[styles.sortBtn, sortBy === 'rating' && styles.sortBtnActive]}>
              <Text style={[styles.sortBtnText, sortBy === 'rating' && styles.sortBtnTextActive]}>Rating</Text>
            </Pressable>
            <Pressable onPress={() => setSortBy('price_asc')} style={[styles.sortBtn, sortBy === 'price_asc' && styles.sortBtnActive]}>
              <Text style={[styles.sortBtnText, sortBy === 'price_asc' && styles.sortBtnTextActive]}>Price Low</Text>
            </Pressable>
            <Pressable onPress={() => setSortBy('price_desc')} style={[styles.sortBtn, sortBy === 'price_desc' && styles.sortBtnActive]}>
              <Text style={[styles.sortBtnText, sortBy === 'price_desc' && styles.sortBtnTextActive]}>Price High</Text>
            </Pressable>
          </View>
        </View>
      )}

      {isLoading ? (
        <LoadingView message="Searching for products..." />
      ) : results.length === 0 ? (
        <EmptyState
          title={`No results for "${query}"`}
          subtitle="Try searching for another grocery item like milk, chips, apples, or bread."
          actionText="Clear Search"
          onAction={() => handleSearch('')}
        />
      ) : (
        <FlatList
          data={results}
          numColumns={2}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={5}
          removeClippedSubviews={true}
          renderItem={({ item }) => <ProductCard product={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 6,
    marginRight: SPACING.xs,
  },
  searchInputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    height: 42,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  resultHeader: {
    padding: SPACING.md,
  },
  sortRow: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
  },
  sortBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  sortBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDark,
  },
  sortBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  sortBtnTextActive: {
    color: '#FFFFFF',
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: 80,
  },
});
