import React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { ProductCard } from '../../components/ProductCard';
import { COLORS, SPACING } from '../../constants/theme';
import { Flame, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { products as localProducts } from '../../data/products';

export default function ChickenMeatPage() {
  const router = useRouter();
  const meatItems = localProducts.filter((p) => p.category === 'meat-seafood');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={COLORS.text} />
        </Pressable>
        <Flame size={22} color="#DC2626" style={{ marginRight: 6 }} />
        <Text style={styles.headerTitle}>Fresh Chicken & Meat</Text>
      </View>

      <FlatList
        data={meatItems.length > 0 ? meatItems : localProducts.slice(0, 5)}
        numColumns={2}
        keyExtractor={(item) => String(item.id)}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <ProductCard product={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEF2F2',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#DC2626',
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: 80,
  },
});
