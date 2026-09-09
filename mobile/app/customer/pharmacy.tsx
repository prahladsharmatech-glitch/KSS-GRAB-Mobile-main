import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { ProductCard } from '../../components/ProductCard';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { ShieldCheck, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { products as localProducts } from '../../data/products';

export default function PharmacyPage() {
  const router = useRouter();
  const pharmaItems = localProducts.filter((p) => p.category === 'health-wellness');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={COLORS.text} />
        </Pressable>
        <ShieldCheck size={22} color="#7C3AED" style={{ marginRight: 6 }} />
        <Text style={styles.headerTitle}>Pharmacy & Wellness</Text>
      </View>

      <FlatList
        data={pharmaItems.length > 0 ? pharmaItems : localProducts.slice(0, 5)}
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
    backgroundColor: '#F5F3FF',
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
    color: '#7C3AED',
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: 80,
  },
});
