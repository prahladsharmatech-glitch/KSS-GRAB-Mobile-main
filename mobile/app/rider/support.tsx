import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking, Modal } from 'react-native';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import {
  Phone,
  LifeBuoy,
  ShieldAlert,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react-native';
import { useToast } from '../../context/ToastContext';

interface FAQItem {
  id: string;
  q: string;
  a: string;
}

const RIDER_FAQS: FAQItem[] = [
  {
    id: '1',
    q: 'Customer is not answering the door or phone call.',
    a: 'Attempt calling twice via the rider app. If unreachable after 3 minutes, tap "Customer Unreachable" on active delivery screen. Dispatch will contact the customer directly.',
  },
  {
    id: '2',
    q: 'Dark Store item is out of stock or missing.',
    a: 'Inform the dark store supervisor immediately at counter 2. They will update the inventory system or swap with an approved replacement.',
  },
  {
    id: '3',
    q: 'How and when are daily payouts transferred?',
    a: 'Payouts are automatically transferred to your registered UPI VPA every night at 11 PM. You can also view itemized breakdowns in the Delivery History tab.',
  },
  {
    id: '4',
    q: 'What happens if my EV scooter battery drops below 10%?',
    a: 'Head to the nearest Grabit Swappable Battery Hub listed in your dashboard. Battery swaps are 100% free for Grabit partner riders.',
  },
];

export default function RiderSupportScreen() {
  const { showToast } = useToast();
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [sosModal, setSosModal] = useState(false);

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  const callSupport = () => {
    Linking.openURL('tel:1800889921').catch(() => {
      showToast('Calling Partner Support 1800-88-9921...', 'info');
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.headerCard}>
        <LifeBuoy size={28} color={COLORS.primaryDark} />
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.headerTitle}>Rider Partner Support</Text>
          <Text style={styles.headerSub}>24/7 dedicated help center for delivery partners</Text>
        </View>
      </View>

      {/* Call Hotline Banner */}
      <Pressable style={styles.callCard} onPress={callSupport}>
        <View style={styles.phoneIconCircle}>
          <Phone size={24} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Text style={styles.callTitle}>Partner Toll-Free Hotline</Text>
          <Text style={styles.callSub}>1800-88-9921 • Available 24/7</Text>
        </View>
        <Text style={styles.callBtnText}>CALL NOW</Text>
      </Pressable>

      {/* Live Chat Support */}
      <Pressable
        style={styles.chatCard}
        onPress={() => showToast('Opening Grabit Rider Live Support Chat...', 'info')}
      >
        <MessageCircle size={22} color={COLORS.primaryDark} />
        <Text style={styles.chatTitle}>Start Live Chat with Dispatch Lead</Text>
      </Pressable>

      {/* Emergency SOS Banner */}
      <Pressable style={styles.sosCard} onPress={() => setSosModal(true)}>
        <ShieldAlert size={22} color={COLORS.danger} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.sosTitle}>Emergency Security Helpline</Text>
          <Text style={styles.sosSub}>Tap for immediate emergency assistance</Text>
        </View>
      </Pressable>

      {/* FAQ Section */}
      <View style={styles.faqSection}>
        <View style={styles.faqHeader}>
          <HelpCircle size={20} color={COLORS.primaryDark} />
          <Text style={styles.faqHeaderTitle}>Frequently Asked Questions</Text>
        </View>

        {RIDER_FAQS.map((faq) => {
          const isOpen = expandedFaq === faq.id;
          return (
            <View key={faq.id} style={styles.faqItem}>
              <Pressable style={styles.faqQuestionRow} onPress={() => toggleFaq(faq.id)}>
                <Text style={styles.faqQuestion}>{faq.q}</Text>
                {isOpen ? (
                  <ChevronUp size={18} color={COLORS.primary} />
                ) : (
                  <ChevronDown size={18} color={COLORS.textMuted} />
                )}
              </Pressable>

              {isOpen && (
                <View style={styles.faqAnswerBox}>
                  <Text style={styles.faqAnswer}>{faq.a}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* SOS Modal */}
      <Modal visible={sosModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.sosModalCard}>
            <AlertTriangle size={48} color={COLORS.danger} />
            <Text style={styles.sosModalTitle}>Emergency Emergency SOS</Text>
            <Text style={styles.sosModalDesc}>
              This will trigger a priority broadcast to Grabit Safety Ops & local emergency service 112.
            </Text>

            <Pressable style={styles.sosCallBtn} onPress={() => Linking.openURL('tel:112')}>
              <Phone size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.sosCallText}>Call Security Helpline (112)</Text>
            </Pressable>

            <Pressable style={styles.dismissBtn} onPress={() => setSosModal(false)}>
              <Text style={styles.dismissText}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
    paddingBottom: 100,
    backgroundColor: COLORS.background,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  callCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    ...SHADOWS.sm,
  },
  phoneIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  callSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  callBtnText: {
    backgroundColor: COLORS.success,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  chatCard: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 14,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  chatTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginLeft: 8,
  },
  sosCard: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 14,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sosTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.danger,
  },
  sosSub: {
    fontSize: 12,
    color: COLORS.danger,
    opacity: 0.8,
  },
  faqSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  faqHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginLeft: 8,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  faqQuestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  faqQuestion: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  faqAnswerBox: {
    backgroundColor: '#F9FAFB',
    padding: SPACING.sm,
    borderRadius: 8,
    marginBottom: SPACING.xs,
  },
  faqAnswer: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  sosModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  sosModalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.danger,
    marginTop: SPACING.md,
  },
  sosModalDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginVertical: SPACING.md,
    lineHeight: 18,
  },
  sosCallBtn: {
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: SPACING.xs,
  },
  sosCallText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  dismissBtn: {
    paddingVertical: SPACING.xs,
  },
  dismissText: {
    color: COLORS.textMuted,
    fontWeight: '700',
  },
});

