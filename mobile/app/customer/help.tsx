import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Linking,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ShieldCheck,
  Truck,
  RotateCcw,
  HelpCircle,
  FileText,
  Phone,
  MessageSquare,
  ChevronDown,
  CheckCircle2,
  Search,
  ArrowLeft,
  X,
  LucideIcon,
} from 'lucide-react-native';
import { CustomerTopHeader } from '../../components/CustomerTopHeader';
import { SearchAutocomplete } from '../../components/SearchAutocomplete';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';

interface PolicyItem {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  color: string;
  content?: string;
  faqs?: { q: string; a: string }[];
  details?: string[];
}

const POLICY_DATA: Record<string, PolicyItem> = {
  'help-support': {
    title: 'Help & 24x7 Customer Support',
    subtitle: 'We are here to assist you anytime. Instant resolution within minutes!',
    icon: HelpCircle,
    color: '#0066FF',
    faqs: [
      { q: 'How fast will my Grabit order be delivered?', a: 'Our hyper-local dark stores deliver all grocery & daily essential orders within 20 to 30 minutes in a 5 km radius.' },
      { q: 'What if an item is missing or damaged in my order?', a: 'You can request an instant 1-tap refund or replacement via the App under My Orders -> Issue Report. Refunds are processed in under 10 minutes.' },
      { q: 'How can I contact Grabit Live Support?', a: 'You can reach our 24x7 support team via Live Chat below or call our helpline toll-free at 1800-419-4722.' }
    ]
  },
  'track-order': {
    title: 'Track Your Live Order',
    subtitle: 'Real-time GPS tracking for express 25-min delivery',
    icon: Truck,
    color: '#FF6B00',
    content: 'Enter your 8-digit Order ID below to track your delivery rider in real time.'
  },
  'return-refund': {
    title: 'Return & 100% Refund Policy',
    subtitle: 'Zero questions asked returns on fresh produce & groceries',
    icon: RotateCcw,
    color: '#10B981',
    faqs: [
      { q: 'Can I return fresh fruits and vegetables?', a: 'Yes! If you are unsatisfied with the freshness or quality of any fresh item, you can return it at the time of delivery or report it within 6 hours for an instant refund.' },
      { q: 'When will I receive my refund?', a: 'Refunds to Grabit Wallet are credited instantly. Bank/UPI refunds are processed within 1 to 2 business hours.' }
    ]
  },
  'shipping-policy': {
    title: 'Express Shipping & Delivery Policy',
    subtitle: 'Superfast 25-30 minute delivery within 5 km radius',
    icon: Truck,
    color: '#8B5CF6',
    details: [
      '⚡ 5 KM Delivery Radius: Dedicated micro-fulfillment dark stores ensure lightning-fast delivery.',
      '📦 Delivery Charges: FREE delivery on orders above ₹199. Nominal flat fee of ₹15 on smaller orders.',
      '🌧️ Weather SLA Guarantee: Waterproof gear ensures safe deliveries during heavy rains.'
    ]
  },
  'privacy-policy': {
    title: 'Privacy & Data Protection Policy',
    subtitle: 'Your personal data and payments are secured with 256-bit encryption',
    icon: ShieldCheck,
    color: '#00838F',
    details: [
      '🔒 Data Encryption: Personal details and payment information are encrypted end-to-end.',
      '🛡️ Zero Spam Promise: We NEVER sell or share your phone number or email.',
      '💳 PCI-DSS Compliant: RBI-certified gateway partners for all transactions.'
    ]
  },
  'terms': {
    title: 'Terms of Service',
    subtitle: 'User agreement and terms of operating on Grabit Quick-Commerce Platform',
    icon: FileText,
    color: '#475569',
    details: [
      '1. Acceptance: By accessing Grabit platform, you agree to comply with service terms.',
      '2. Product Availability: Subject to real-time inventory in your nearest dark store.',
      '3. Pricing: All prices listed include applicable GST taxes.'
    ]
  },
  'cookies': {
    title: 'Cookie Preferences & Policy',
    subtitle: 'How we use cookies to deliver a fast, personalized shopping experience',
    icon: FileText,
    color: '#64748B',
    details: [
      'Session Cookies: Used to save your active cart items and profile preferences.',
      'Location Cookies: Enables precise 5 km dark store routing for sub-30 minute delivery.'
    ]
  }
};

const SUPPORT_CATEGORIES = [
  { id: 'help-support', label: '24x7 Help', icon: HelpCircle, color: '#0066FF' },
  { id: 'track-order', label: 'Track Order', icon: Truck, color: '#FF6B00' },
  { id: 'return-refund', label: 'Refunds', icon: RotateCcw, color: '#10B981' },
  { id: 'shipping-policy', label: 'Shipping', icon: Truck, color: '#8B5CF6' },
  { id: 'privacy-policy', label: 'Privacy', icon: ShieldCheck, color: '#00838F' },
  { id: 'terms', label: 'Terms', icon: FileText, color: '#475569' },
];

export default function HelpPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('help-support');
  const [orderQuery, setOrderQuery] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<any>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [isLiveChatOpen, setIsLiveChatOpen] = useState(false);

  const activePolicy = POLICY_DATA[activeTab] || POLICY_DATA['help-support'];
  const IconComp = activePolicy.icon;

  const handleTrackSearch = () => {
    if (!orderQuery.trim()) return;
    setTrackedOrder({
      id: orderQuery.trim().toUpperCase(),
      status: 'Out for Delivery 🛵',
      eta: '12 Mins Away',
      rider: 'Ramesh Kumar (Grabit Rider #402)',
      phone: '+91 98765 43210',
      items: '3 items (Lay\'s, Amul Butter, Milk)'
    });
  };

  const handleCallSupport = () => {
    Linking.openURL('tel:18004194722');
  };

  return (
    <View style={styles.screen}>
      {/* Top Header */}
      <CustomerTopHeader />

      {/* Back Button & Global Search Bar */}
      <View style={[styles.searchHeaderRow, { zIndex: 9999 }]}>
        <Pressable style={styles.backBtnCircle} onPress={() => router.back()}>
          <ArrowLeft size={18} color="#1E293B" />
        </Pressable>
        <View style={{ flex: 1, zIndex: 9999 }}>
          <SearchAutocomplete placeholder="Search help topics or products..." />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 👑 Hero Banner */}
        <View style={[styles.heroBanner, { backgroundColor: activePolicy.color }]}>
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroIconBadge}>
              <IconComp size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.heroCategoryText}>GRABIT HELP & SUPPORT HUB</Text>
          </View>
          <Text style={styles.heroTitle}>{activePolicy.title}</Text>
          <Text style={styles.heroSubtitle}>{activePolicy.subtitle}</Text>
        </View>

        {/* 📱 Support Categories Grid (3x2) */}
        <View style={styles.gridContainer}>
          {SUPPORT_CATEGORIES.map((item) => {
            const ItemIcon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.8}
                onPress={() => {
                  setActiveTab(item.id);
                  setExpandedFaq(0);
                }}
                style={[
                  styles.categoryCard,
                  isActive
                    ? { borderColor: item.color, borderBottomWidth: 3, ...SHADOWS.sm }
                    : { borderColor: '#E2E8F0' },
                ]}
              >
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: isActive ? `${item.color}18` : '#F1F5F9' },
                  ]}
                >
                  <ItemIcon size={18} color={isActive ? item.color : '#64748B'} />
                </View>
                <Text
                  style={[
                    styles.categoryLabel,
                    { color: isActive ? item.color : '#475569', fontWeight: isActive ? '900' : '700' },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Main Content Area */}
        <View style={styles.contentCard}>
          {/* TRACK ORDER SECTION */}
          {activeTab === 'track-order' && (
            <View>
              <Text style={styles.sectionTitle}>🛵 Live GPS Order Tracking</Text>
              <View style={styles.trackFormRow}>
                <TextInput
                  style={styles.trackInput}
                  placeholder="Enter Order ID (e.g. GBT-1002)"
                  placeholderTextColor="#94A3B8"
                  value={orderQuery}
                  onChangeText={setOrderQuery}
                />
                <TouchableOpacity style={styles.trackBtn} activeOpacity={0.8} onPress={handleTrackSearch}>
                  <Search size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.trackBtnText}>Track</Text>
                </TouchableOpacity>
              </View>

              {trackedOrder ? (
                <View style={styles.trackedResultBox}>
                  <View style={styles.trackedResultHeader}>
                    <Text style={styles.trackedOrderId}>Order {trackedOrder.id}</Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>{trackedOrder.status}</Text>
                    </View>
                  </View>

                  <View style={styles.trackedDetailsList}>
                    <Text style={styles.detailRowText}>
                      <Text style={styles.boldText}>Estimated Arrival: </Text>
                      <Text style={{ color: '#0066FF', fontWeight: '800' }}>{trackedOrder.eta}</Text>
                    </Text>
                    <Text style={styles.detailRowText}>
                      <Text style={styles.boldText}>Rider Assigned: </Text>
                      {trackedOrder.rider}
                    </Text>
                    <Text style={styles.detailRowText}>
                      <Text style={styles.boldText}>Rider Phone: </Text>
                      {trackedOrder.phone}
                    </Text>
                    <Text style={styles.detailRowText}>
                      <Text style={styles.boldText}>Items: </Text>
                      {trackedOrder.items}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.trackHintBox}>
                  <Text style={styles.trackHintText}>
                    💡 Enter <Text style={{ fontWeight: '800', color: '#1E293B' }}>GBT-1002</Text> to test live tracking simulation!
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* EXPANDABLE ACCORDION FAQS */}
          {activePolicy.faqs && (
            <View>
              <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
              {activePolicy.faqs.map((faq, i) => {
                const isOpen = expandedFaq === i;
                return (
                  <TouchableOpacity
                    key={i}
                    activeOpacity={0.85}
                    onPress={() => setExpandedFaq(isOpen ? null : i)}
                    style={styles.faqCard}
                  >
                    <View style={styles.faqHeader}>
                      <View style={styles.faqTitleRow}>
                        <CheckCircle2 size={16} color="#0066FF" style={{ marginRight: 8, marginTop: 1 }} />
                        <Text style={styles.faqQuestion}>{faq.q}</Text>
                      </View>
                      <ChevronDown
                        size={16}
                        color="#64748B"
                        style={{
                          transform: [{ rotate: isOpen ? '180deg' : '0deg' }],
                        }}
                      />
                    </View>

                    {isOpen && (
                      <View style={styles.faqAnswerBox}>
                        <Text style={styles.faqAnswerText}>{faq.a}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* DETAILS BULLET LIST */}
          {activePolicy.details && (
            <View style={styles.detailsContainer}>
              {activePolicy.details.map((detail, i) => (
                <View
                  key={i}
                  style={[styles.detailBulletCard, { borderLeftColor: activePolicy.color }]}
                >
                  <Text style={styles.detailBulletText}>{detail}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 📱 Floating Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.callSupportBtn}
          activeOpacity={0.8}
          onPress={handleCallSupport}
        >
          <Phone size={16} color="#0066FF" style={{ marginRight: 6 }} />
          <Text style={styles.callSupportText}>Call Support</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.liveChatBtn}
          activeOpacity={0.85}
          onPress={() => setIsLiveChatOpen(true)}
        >
          <MessageSquare size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.liveChatText}>Live Chat 24x7</Text>
        </TouchableOpacity>
      </View>

      {/* Live Chat Dialog Modal */}
      <Modal visible={isLiveChatOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <MessageSquare size={20} color="#0066FF" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Grabit Support Assistant</Text>
              </View>
              <Pressable onPress={() => setIsLiveChatOpen(false)} hitSlop={8}>
                <X size={20} color="#64748B" />
              </Pressable>
            </View>
            <Text style={styles.modalBodyText}>
              Connecting to Grabit 24x7 Live Chat Assistant... Our support agents are active 24x7 to assist you.
            </Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              activeOpacity={0.8}
              onPress={() => setIsLiveChatOpen(false)}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: SPACING.xs,
  },
  backBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 110,
  },
  heroBanner: {
    borderRadius: 16,
    padding: SPACING.md + 4,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  heroIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCategoryText: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.88)',
    lineHeight: 18,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: SPACING.md,
  },
  categoryCard: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  trackFormRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  trackInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  trackBtn: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  trackedResultBox: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FFEDD5',
    borderRadius: 12,
    padding: 12,
  },
  trackedResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trackedOrderId: {
    fontSize: 15,
    fontWeight: '900',
    color: '#C2410C',
  },
  statusBadge: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  trackedDetailsList: {
    gap: 4,
  },
  detailRowText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
    color: '#1E293B',
  },
  trackHintBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  trackHintText: {
    fontSize: 12,
    color: '#64748B',
  },
  faqCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 8,
  },
  faqQuestion: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  faqAnswerBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  faqAnswerText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  detailsContainer: {
    gap: 8,
  },
  detailBulletCard: {
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
  },
  detailBulletText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 10,
    ...SHADOWS.md,
  },
  callSupportBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  callSupportText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  liveChatBtn: {
    flex: 1.2,
    backgroundColor: '#0066FF',
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  liveChatText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 400,
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalBodyText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalCloseBtn: {
    backgroundColor: '#0066FF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
