import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { HelpCircle, Phone, Mail, MessageSquare, ChevronRight } from 'lucide-react-native';

const FAQS = [
  { q: 'How does 10-minute delivery work?', a: 'We operate micro-fulfillment dark stores located within 2km of your address.' },
  { q: 'What is the return & refund policy?', a: 'Instant 100% refund for damaged or missing items within 15 minutes.' },
  { q: 'How can I contact my delivery rider?', a: 'Once an order is assigned, call/chat buttons appear in live tracking.' },
];

export default function HelpPage() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <HelpCircle size={24} color={COLORS.primaryDark} style={{ marginRight: 8 }} />
        <Text style={styles.headerTitle}>Help & Support</Text>
      </View>

      <View style={styles.contactRow}>
        <Pressable style={styles.contactCard}>
          <Phone size={24} color={COLORS.primary} />
          <Text style={styles.contactTitle}>Call Us</Text>
          <Text style={styles.contactSub}>24/7 Helpline</Text>
        </Pressable>

        <Pressable style={styles.contactCard}>
          <MessageSquare size={24} color={COLORS.primary} />
          <Text style={styles.contactTitle}>Live Chat</Text>
          <Text style={styles.contactSub}>Instant AI Bot</Text>
        </Pressable>

        <Pressable style={styles.contactCard}>
          <Mail size={24} color={COLORS.primary} />
          <Text style={styles.contactTitle}>Email</Text>
          <Text style={styles.contactSub}>support@grabit.in</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

      {FAQS.map((faq, idx) => (
        <View key={idx} style={styles.faqCard}>
          <Text style={styles.question}>{faq.q}</Text>
          <Text style={styles.answer}>{faq.a}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    paddingBottom: 80,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  contactCard: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  contactTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 6,
  },
  contactSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  question: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  answer: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
});
