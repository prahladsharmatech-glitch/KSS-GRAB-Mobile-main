import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { Zap, Flame, Award, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function DealsPage() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerBanner}>
        <Zap size={28} color={COLORS.secondary} />
        <Text style={styles.headerTitle}>Diwali & Festive Mega Offers</Text>
        <Text style={styles.headerSub}>Flat 50% OFF + Zero Delivery Charge</Text>
      </View>

      <View style={styles.dealCard}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>CODE: GRABIT50</Text>
        </View>
        <Text style={styles.dealTitle}>Flat ₹50 Instant Discount</Text>
        <Text style={styles.dealSub}>Valid on all orders above ₹200</Text>
        <Pressable style={styles.useBtn} onPress={() => router.push('/customer/cart' as any)}>
          <Text style={styles.useBtnText}>Use Coupon in Cart</Text>
        </Pressable>
      </View>

      <View style={styles.dealCard}>
        <View style={[styles.badge, { backgroundColor: COLORS.accent }]}>
          <Text style={styles.badgeText}>CODE: WELCOME100</Text>
        </View>
        <Text style={styles.dealTitle}>Welcome Offer ₹100 Off</Text>
        <Text style={styles.dealSub}>For first-time quick commerce mobile orders</Text>
        <Pressable style={styles.useBtn} onPress={() => router.push('/customer/cart' as any)}>
          <Text style={styles.useBtnText}>Use Coupon in Cart</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    paddingBottom: 80,
  },
  headerBanner: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 16,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: SPACING.xs,
  },
  headerSub: {
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: '700',
    marginTop: 4,
  },
  dealCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  badge: {
    backgroundColor: COLORS.primaryDark,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: SPACING.xs,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  dealTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  dealSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
    marginBottom: SPACING.md,
  },
  useBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  useBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
