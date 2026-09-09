import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useWishlist } from '../../context/WishlistContext';
import { ProductCard } from '../../components/ProductCard';
import { EmptyState } from '../../components/EmptyState';
import { COLORS, SPACING } from '../../constants/theme';
import { Heart } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function WishlistPage() {
  const router = useRouter();
  const { wishlist } = useWishlist();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Heart size={22} color={COLORS.danger} fill={COLORS.danger} style={{ marginRight: 8 }} />
        <Text style={styles.headerTitle}>Your Favorites ({wishlist.length})</Text>
      </View>

      {wishlist.length === 0 ? (
        <EmptyState
          title="No Favorite Products"
          subtitle="Tap the heart icon on any product to save it to your wishlist."
          actionText="Explore Store"
          onAction={() => router.push('/customer' as any)}
        />
      ) : (
        <FlatList
          data={wishlist}
          numColumns={2}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: 80,
  },
});
