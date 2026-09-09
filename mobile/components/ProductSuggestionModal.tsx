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
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import {
  X,
  Lightbulb,
  PackagePlus,
  Clock,
  Sparkles,
  ChevronDown,
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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'suggest' | 'my-requests'>('suggest');
  const [productName, setProductName] = useState(prefillQuery);
  const [category, setCategory] = useState(prefillCategory || 'Snacks & Munchies');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [brand, setBrand] = useState('');
  const [notes, setNotes] = useState('');
  const [contact, setContact] = useState(user?.phone || '+919999900001');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mySuggestions, setMySuggestions] = useState<ProductSuggestion[]>([]);

  useEffect(() => {
    if (prefillQuery) setProductName(prefillQuery);
    if (prefillCategory) setCategory(prefillCategory);
    if (user?.phone) setContact(user.phone);
  }, [prefillQuery, prefillCategory, isOpen, user]);

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
      customer_phone: contact.trim() || '+919999900001',
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
          {/* Header matching Screenshot */}
          <View style={styles.modalHeader}>
            <View style={styles.headerIconCircle}>
              <Lightbulb size={20} color="#FFFFFF" />
            </View>
            <View style={styles.headerTextCol}>
              <Text style={styles.headerTitle}>Suggest a Product</Text>
              <Text style={styles.headerSub}>Can't find an item? Request it and we'll stock it for you!</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <X size={16} color="#64748B" />
            </Pressable>
          </View>

          {/* Tab Switcher */}
          <View style={styles.tabBar}>
            <Pressable
              style={[styles.tabBtn, activeTab === 'suggest' && styles.tabBtnActive]}
              onPress={() => setActiveTab('suggest')}
            >
              <PackagePlus size={15} color={activeTab === 'suggest' ? '#0066FF' : '#64748B'} />
              <Text style={[styles.tabBtnText, activeTab === 'suggest' && styles.tabBtnTextActive]}>
                New Suggestion
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabBtn, activeTab === 'my-requests' && styles.tabBtnActive]}
              onPress={() => setActiveTab('my-requests')}
            >
              <Clock size={15} color={activeTab === 'my-requests' ? '#0066FF' : '#64748B'} />
              <Text style={[styles.tabBtnText, activeTab === 'my-requests' && styles.tabBtnTextActive]}>
                My Requests ({mySuggestions.length})
              </Text>
            </Pressable>
          </View>

          {/* Tab Content */}
          <ScrollView contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {activeTab === 'suggest' ? (
              <View style={styles.formContainer}>
                {/* Field 1: Product Name */}
                <Text style={styles.inputLabel}>
                  Product Name <Text style={styles.reqStar}>*</Text>
                </Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="e.g. Oat Milk 1L, Doritos Cool Ranch, Orga"
                  placeholderTextColor="#94A3B8"
                  value={productName}
                  onChangeText={setProductName}
                />

                {/* Field 2 & 3: Category and Brand in Side-by-Side Row */}
                <View style={styles.rowTwoCols}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Category</Text>
                    <Pressable
                      style={styles.dropdownSelectBtn}
                      onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                    >
                      <Text style={styles.dropdownSelectText} numberOfLines={1}>
                        {category}
                      </Text>
                      <ChevronDown size={14} color="#64748B" />
                    </Pressable>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>
                      Brand / Variant <Text style={styles.subtleOptional}>(Optional)</Text>
                    </Text>
                    <TextInput
                      style={styles.inputBox}
                      placeholder="e.g. Oatly, Amul, 5"
                      placeholderTextColor="#94A3B8"
                      value={brand}
                      onChangeText={setBrand}
                    />
                  </View>
                </View>

                {/* Category Dropdown Expandable Options */}
                {showCategoryPicker && (
                  <View style={styles.categoryDropdownList}>
                    {CATEGORIES_LIST.map((c) => (
                      <Pressable
                        key={c}
                        style={[styles.categoryDropdownItem, category === c && styles.categoryDropdownItemActive]}
                        onPress={() => {
                          setCategory(c);
                          setShowCategoryPicker(false);
                        }}
                      >
                        <Text style={[styles.categoryDropdownText, category === c && styles.categoryDropdownTextActive]}>
                          {c}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {/* Field 4: Additional Notes / Details */}
                <Text style={styles.inputLabel}>
                  Additional Notes / Details <Text style={styles.subtleOptional}>(Optional)</Text>
                </Text>
                <TextInput
                  style={[styles.inputBox, styles.textAreaBox]}
                  placeholder="Tell us why you want this product or any specific packaging details..."
                  placeholderTextColor="#94A3B8"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                />

                {/* Field 5: Your Phone / Contact */}
                <Text style={styles.inputLabel}>
                  Your Phone / Contact <Text style={styles.subtleOptional}>(To notify you when stocked)</Text>
                </Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="+919999900001"
                  placeholderTextColor="#94A3B8"
                  value={contact}
                  onChangeText={setContact}
                  keyboardType="phone-pad"
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
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.lg,
  },
  modalHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#0066FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  headerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 14,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    gap: 6,
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#0066FF',
    backgroundColor: '#FFFFFF',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#0066FF',
    fontWeight: '900',
  },
  bodyContent: {
    padding: 16,
  },
  formContainer: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  reqStar: {
    color: '#EF4444',
  },
  subtleOptional: {
    fontSize: 11,
    fontWeight: '400',
    color: '#94A3B8',
  },
  inputBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 10,
  },
  dropdownSelectBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownSelectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    marginRight: 4,
  },
  categoryDropdownList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    maxHeight: 160,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  categoryDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  categoryDropdownItemActive: {
    backgroundColor: '#EFF6FF',
  },
  categoryDropdownText: {
    fontSize: 12,
    color: '#334155',
  },
  categoryDropdownTextActive: {
    color: '#0066FF',
    fontWeight: '800',
  },
  textAreaBox: {
    height: 72,
    textAlignVertical: 'top',
  },
  submitBtn: {
    marginTop: 8,
    backgroundColor: '#0066FF',
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
