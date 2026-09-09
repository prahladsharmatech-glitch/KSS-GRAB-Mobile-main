import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { post } from '../services/api';
import { useToast } from '../context/ToastContext';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import {
  X,
  Lightbulb,
  CheckCircle2,
  PackagePlus,
  Clock,
  Tag,
  MessageSquare,
  Sparkles,
} from 'lucide-react-native';

const CATEGORIES_LIST = [
  'Snacks & Munchies',
  'Dairy & Bakery',
  'Cold Drinks & Juices',
  'Atta, Rice & Dal',
  'Chocolates & Sweets',
  'Personal Care',
  'Household Essentials',
  'Fresh Fruits & Veggies',
  'Tea, Coffee & Drinks',
  'Biscuits & Cookies',
  'Instant & Frozen Food',
  'Edible Oils & Ghee',
  'Electronics & Gadgets',
  'Fashion & Accessories',
  'Other / General',
];

const STORAGE_KEY = '@grabit_product_suggestions';

export interface ProductSuggestion {
  id: string;
  product_name: string;
  category: string;
  brand: string;
  notes: string;
  customer_phone: string;
  created_at: string;
  status: string;
}

interface ProductSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillQuery?: string;
  prefillCategory?: string;
}

export default function ProductSuggestionModal({
  isOpen,
  onClose,
  prefillQuery = '',
  prefillCategory = '',
}: ProductSuggestionModalProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'suggest' | 'my-requests'>('suggest');
  const [productName, setProductName] = useState(prefillQuery);
  const [category, setCategory] = useState(prefillCategory || 'Snacks & Munchies');
  const [brand, setBrand] = useState('');
  const [notes, setNotes] = useState('');
  const [contact, setContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mySuggestions, setMySuggestions] = useState<ProductSuggestion[]>([]);

  useEffect(() => {
    if (prefillQuery) setProductName(prefillQuery);
    if (prefillCategory) setCategory(prefillCategory);
  }, [prefillQuery, prefillCategory, isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadMySuggestions();
    }
  }, [isOpen]);

  const loadMySuggestions = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        setMySuggestions(JSON.parse(raw));
      }
    } catch {
      setMySuggestions([]);
    }
  };

  const saveLocalSuggestion = async (item: ProductSuggestion) => {
    try {
      const current = [...mySuggestions];
      const updated = [item, ...current];
      setMySuggestions(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const handleSubmit = async () => {
    if (!productName.trim()) {
      showToast('Please enter the product name you would like us to stock.', 'error');
      return;
    }

    setIsSubmitting(true);

    const newSuggestion: ProductSuggestion = {
      id: `sug-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      product_name: productName.trim(),
      category: category || 'General',
      brand: brand.trim(),
      notes: notes.trim(),
      customer_phone: contact.trim() || 'Anonymous Customer',
      created_at: new Date().toISOString(),
      status: 'Under Review',
    };

    await saveLocalSuggestion(newSuggestion);

    try {
      await post('/product-suggestions', {
        product_name: newSuggestion.product_name,
        category: newSuggestion.category,
        brand: newSuggestion.brand,
        notes: newSuggestion.notes,
        customer_phone: newSuggestion.customer_phone,
      });
    } catch {
      // Offline fallback
    }

    setIsSubmitting(false);
    showToast(`Thank you! We've recorded your suggestion for "${productName.trim()}". Our team will stock it soon!`, 'success');

    setProductName('');
    setBrand('');
    setNotes('');
    setActiveTab('my-requests');
  };

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconCircle}>
                <Lightbulb size={22} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Suggest a Product</Text>
                <Text style={styles.headerSub}>Can't find an item? Request it and we'll stock it!</Text>
              </View>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <X size={18} color="#64748B" />
            </Pressable>
          </View>

          {/* Tab Switcher */}
          <View style={styles.tabBar}>
            <Pressable
              style={[styles.tabBtn, activeTab === 'suggest' && styles.tabBtnActive]}
              onPress={() => setActiveTab('suggest')}
            >
              <PackagePlus size={15} color={activeTab === 'suggest' ? '#0071E3' : '#64748B'} />
              <Text style={[styles.tabBtnText, activeTab === 'suggest' && styles.tabBtnTextActive]}>
                New Suggestion
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabBtn, activeTab === 'my-requests' && styles.tabBtnActive]}
              onPress={() => setActiveTab('my-requests')}
            >
              <Clock size={15} color={activeTab === 'my-requests' ? '#0071E3' : '#64748B'} />
              <Text style={[styles.tabBtnText, activeTab === 'my-requests' && styles.tabBtnTextActive]}>
                My Requests ({mySuggestions.length})
              </Text>
            </Pressable>
          </View>

          {/* Tab Content */}
          <ScrollView contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {activeTab === 'suggest' ? (
              <View style={styles.formContainer}>
                {/* Product Name */}
                <Text style={styles.inputLabel}>
                  Product Name <Text style={styles.reqStar}>*</Text>
                </Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="e.g. Haldiram Roasted Makhana 100g, Oat Milk..."
                  placeholderTextColor="#94A3B8"
                  value={productName}
                  onChangeText={setProductName}
                />

                {/* Category Pill Selector */}
                <Text style={[styles.inputLabel, { marginTop: 12 }]}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                  {CATEGORIES_LIST.map((c) => {
                    const isSelected = category === c;
                    return (
                      <Pressable
                        key={c}
                        style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                        onPress={() => setCategory(c)}
                      >
                        <Text style={[styles.categoryPillText, isSelected && styles.categoryPillTextActive]}>
                          {c}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Brand */}
                <Text style={[styles.inputLabel, { marginTop: 12 }]}>Brand / Manufacturer (Optional)</Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="e.g. Amul, Nestle, Paper Boat..."
                  placeholderTextColor="#94A3B8"
                  value={brand}
                  onChangeText={setBrand}
                />

                {/* Notes */}
                <Text style={[styles.inputLabel, { marginTop: 12 }]}>Additional Details / Pack Size (Optional)</Text>
                <TextInput
                  style={[styles.inputBox, { height: 70, textAlignVertical: 'top' }]}
                  placeholder="e.g. 500g pouch, Sugar-free variant..."
                  placeholderTextColor="#94A3B8"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />

                {/* Submit Button */}
                <Pressable
                  style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Sparkles size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.submitBtnText}>Submit Product Suggestion</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={styles.myRequestsContainer}>
                {mySuggestions.length === 0 ? (
                  <View style={styles.emptyRequestsBox}>
                    <Lightbulb size={36} color="#CBD5E1" style={{ marginBottom: 8 }} />
                    <Text style={styles.emptyRequestsTitle}>No suggestions submitted yet</Text>
                    <Text style={styles.emptyRequestsSub}>
                      Your requested items will appear here with their sourcing status.
                    </Text>
                  </View>
                ) : (
                  mySuggestions.map((sug) => (
                    <View key={sug.id} style={styles.sugCard}>
                      <View style={styles.sugHeader}>
                        <Text style={styles.sugName}>{sug.product_name}</Text>
                        <View style={styles.sugBadge}>
                          <Text style={styles.sugBadgeText}>{sug.status || 'Under Review'}</Text>
                        </View>
                      </View>
                      <Text style={styles.sugMeta}>
                        📁 {sug.category} {sug.brand ? `• 🏷️ ${sug.brand}` : ''}
                      </Text>
                      {sug.notes ? <Text style={styles.sugNotes}>"{sug.notes}"</Text> : null}
                      <Text style={styles.sugDate}>
                        Submitted {new Date(sug.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.lg,
  },
  modalHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0071E3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  headerSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#0071E3',
    backgroundColor: '#FFFFFF',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#0071E3',
    fontWeight: '900',
  },
  bodyContent: {
    padding: 16,
  },
  formContainer: {},
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  reqStar: {
    color: '#EF4444',
  },
  inputBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  categoryScroll: {
    gap: 6,
    paddingVertical: 4,
  },
  categoryPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0071E3',
    borderWidth: 1.5,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  categoryPillTextActive: {
    color: '#0071E3',
    fontWeight: '900',
  },
  submitBtn: {
    marginTop: 18,
    backgroundColor: '#0071E3',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  myRequestsContainer: {},
  emptyRequestsBox: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyRequestsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyRequestsSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  sugCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
  },
  sugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sugName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  sugBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  sugBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  sugMeta: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  sugNotes: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  sugDate: {
    fontSize: 10,
    color: '#94A3B8',
  },
});
