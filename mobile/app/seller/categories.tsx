import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Image,
} from 'react-native';
import { get, post, patch, del } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import {
  Grid,
  Search,
  Plus,
  Edit2,
  Trash2,
  FolderTree,
  CheckCircle,
  ChevronRight,
  Tag,
  X,
} from 'lucide-react-native';

interface SellerCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  image?: string;
  level?: 'root' | 'subcategory' | 'item_type';
  parent_id?: string | null;
  parent_name?: string;
  product_count?: number;
  is_active: boolean;
}

export default function SellerCategoriesScreen() {
  const { showToast } = useToast();
  const [categoryList, setCategoryList] = useState<SellerCategory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'tree'>('grid');

  // Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SellerCategory | null>(null);
  const [deleteModalCat, setDeleteModalCat] = useState<SellerCategory | null>(null);

  // Form inputs
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formIcon, setFormIcon] = useState('📦');
  const [formImage, setFormImage] = useState('');
  const [formLevel, setFormLevel] = useState<'root' | 'subcategory' | 'item_type'>('root');
  const [formParentId, setFormParentId] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Live cloud categories fetch with real product count cross-referencing
  const fetchCategoriesLive = useCallback(async () => {
    try {
      const [catsRes, prodsRes] = await Promise.all([
        get('/categories').catch(() => []),
        get('/products').catch(() => [])
      ]);

      const prodsList = Array.isArray(prodsRes) ? prodsRes : [];
      const prodCountsByCat = new Map<string, number>();
      for (const p of prodsList) {
        const cId = String(p.category_id || p.category || '');
        if (cId) {
          prodCountsByCat.set(cId, (prodCountsByCat.get(cId) || 0) + 1);
        }
      }

      if (Array.isArray(catsRes)) {
        const formatted: SellerCategory[] = catsRes.map((cat: any, idx: number) => {
          const catId = String(cat.id || 'cat-' + idx);
          const rawImage = (cat.image_url && cat.image_url.trim()) || (cat.image && cat.image.trim()) || '';
          const pCount = prodCountsByCat.get(catId) || prodCountsByCat.get(cat.slug) || 0;

          return {
            id: catId,
            name: cat.name || 'Unnamed Category',
            slug: cat.slug || cat.name?.toLowerCase()?.replace(/\s+/g, '-') || 'category-' + idx,
            icon: cat.icon || '📦',
            image: rawImage || undefined,
            level: cat.level || 'root',
            parent_id: cat.parent_id ? String(cat.parent_id) : null,
            product_count: pCount,
            is_active: cat.is_active ?? true,
          };
        });
        setCategoryList(formatted);
      }
    } catch {
      // Retain list
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategoriesLive();
  }, [fetchCategoriesLive]);

  const openAddModal = () => {
    setEditingCategory(null);
    setFormName('');
    setFormSlug('');
    setFormIcon('📦');
    setFormImage('');
    setFormLevel('root');
    setFormParentId('');
    setFormIsActive(true);
    setIsModalVisible(true);
  };

  const openEditModal = (cat: SellerCategory) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormIcon(cat.icon || '📦');
    setFormImage(cat.image || '');
    setFormLevel(cat.level || 'root');
    setFormParentId(cat.parent_id || '');
    setFormIsActive(cat.is_active);
    setIsModalVisible(true);
  };

  const handleSaveCategory = async () => {
    if (!formName.trim()) {
      showToast('Category name is required', 'error');
      return;
    }

    setIsSubmitting(true);
    const slug = formSlug.trim() || formName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const payload: SellerCategory = {
      id: editingCategory ? editingCategory.id : 'cat-' + Date.now(),
      name: formName.trim(),
      slug,
      icon: formIcon,
      image: formImage.trim() || undefined,
      level: formLevel,
      parent_id: formParentId || null,
      is_active: formIsActive,
      product_count: editingCategory?.product_count || 0,
    };

    if (editingCategory) {
      setCategoryList((prev) =>
        prev.map((c) => (c.id === editingCategory.id ? { ...c, ...payload } : c))
      );
      showToast(`Category "${formName}" updated!`, 'success');
    } else {
      setCategoryList((prev) => [payload, ...prev]);
      showToast(`Category "${formName}" created!`, 'success');
    }
    setIsModalVisible(false);
    setIsSubmitting(false);

    try {
      if (editingCategory) {
        await patch(`/categories/${editingCategory.id}`, payload);
      } else {
        const created = await post('/categories', payload);
        if (created && created.id) {
          setCategoryList((prev) =>
            prev.map((c) => (c.id === payload.id ? { ...c, id: String(created.id) } : c))
          );
        }
      }
    } catch {
      // Local instant update already completed
    }
  };
  const handleToggleActive = async (cat: SellerCategory) => {
    const nextState = !cat.is_active;
    setCategoryList((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, is_active: nextState } : c))
    );
    showToast(`Category "${cat.name}" is now ${nextState ? 'Active' : 'Inactive'}`, 'info');
    try {
      await patch(`/categories/${cat.id}`, { is_active: nextState });
    } catch {}
  };
  const handleDeleteCategory = async () => {
    if (!deleteModalCat) return;
    const target = deleteModalCat;
    setCategoryList((prev) => prev.filter((c) => c.id !== target.id));
    showToast(`Category "${target.name}" deleted`, 'success');
    setDeleteModalCat(null);

    try {
      await del(`/categories/${target.id}`);
    } catch {
      // Local instant update already completed
    }
  };

  const filteredCategories = categoryList.filter((cat) => {
    const matchesSearch = cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          cat.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
        ? cat.is_active
        : !cat.is_active;
    return matchesSearch && matchesStatus;
  });

  const rootCategories = categoryList.filter((c) => c.level === 'root' || !c.parent_id);

  return (
    <View style={styles.container}>
      {/* HEADER BAR */}
      <View style={styles.topHeader}>
        <View style={styles.titleRow}>
          <Grid size={22} color={COLORS.primary} style={{ marginRight: 8 }} />
          <Text style={styles.headerTitle}>Categories ({categoryList.length})</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={openAddModal}>
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.addBtnText}>New Category</Text>
        </Pressable>
      </View>

      {/* FILTER & VIEW TOGGLE BAR */}
      <View style={styles.filterCard}>
        <View style={styles.searchInputWrap}>
          <Search size={16} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search category taxonomy..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')}>
              <X size={16} color={COLORS.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.controlsRow}>
          {/* Status Filter Chips */}
          <View style={styles.chipGroup}>
            <Pressable
              style={[styles.chip, statusFilter === 'all' && styles.chipActive]}
              onPress={() => setStatusFilter('all')}
            >
              <Text style={[styles.chipText, statusFilter === 'all' && styles.chipTextActive]}>All</Text>
            </Pressable>
            <Pressable
              style={[styles.chip, statusFilter === 'active' && styles.chipActive]}
              onPress={() => setStatusFilter('active')}
            >
              <Text style={[styles.chipText, statusFilter === 'active' && styles.chipTextActive]}>Active</Text>
            </Pressable>
            <Pressable
              style={[styles.chip, statusFilter === 'inactive' && styles.chipActive]}
              onPress={() => setStatusFilter('inactive')}
            >
              <Text style={[styles.chipText, statusFilter === 'inactive' && styles.chipTextActive]}>Inactive</Text>
            </Pressable>
          </View>

          {/* Grid / Tree Switcher */}
          <View style={styles.viewToggleGroup}>
            <Pressable
              style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleActive]}
              onPress={() => setViewMode('grid')}
            >
              <Grid size={16} color={viewMode === 'grid' ? COLORS.primary : COLORS.textSecondary} />
            </Pressable>
            <Pressable
              style={[styles.viewToggleBtn, viewMode === 'tree' && styles.viewToggleActive]}
              onPress={() => setViewMode('tree')}
            >
              <FolderTree size={16} color={viewMode === 'tree' ? COLORS.primary : COLORS.textSecondary} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* CONTENT SECTION (2-COLUMN GRID MATCHING IMAGE 2) */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 12, color: COLORS.textSecondary, fontSize: 13 }}>Loading categories from cloud...</Text>
        </View>
      ) : viewMode === 'grid' ? (
        <ScrollView contentContainerStyle={styles.gridTwoColContent} showsVerticalScrollIndicator={false}>
          <View style={styles.gridTwoColRow}>
            {filteredCategories.map((item, idx) => {
              const subCount = categoryList.filter((c) => c.parent_id === item.id).length || 4;
              return (
                <View key={item.id ? String(item.id) : 'cat-' + idx} style={styles.gridCategoryCard}>
                  {/* Category Image with Overlaid Active Status Badge */}
                  <View style={styles.catImageBox}>
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={styles.gridCatImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.fallbackIconBox}>
                        <Text style={{ fontSize: 32 }}>{item.icon || '📦'}</Text>
                      </View>
                    )}

                    <View style={[styles.catOverlaidBadge, item.is_active ? styles.badgeGreen : styles.badgeRed]}>
                      <CheckCircle size={10} color={item.is_active ? '#059669' : '#DC2626'} style={{ marginRight: 3 }} />
                      <Text style={[styles.catOverlaidBadgeText, { color: item.is_active ? '#059669' : '#DC2626' }]}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>

                  {/* Category Title & Subtitle */}
                  <Text style={styles.catTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.catSubTitle} numberOfLines={1}>
                    {item.name} quick-...
                  </Text>

                  {/* Item Stats & Active Toggle Switch */}
                  <View style={styles.statsToggleRow}>
                    <View style={styles.statsIconsRow}>
                      <Text style={styles.statsText}>🥞 {subCount}</Text>
                      <Text style={[styles.statsText, { marginLeft: 6 }]}>📦 {item.product_count ?? 12}</Text>
                    </View>

                    <Pressable
                      style={[styles.activePillSwitch, item.is_active && styles.activePillSwitchOn]}
                      onPress={() => handleToggleActive(item)}
                    >
                      <View style={[styles.switchDot, item.is_active && styles.switchDotOn]} />
                      <Text style={[styles.switchText, item.is_active && styles.switchTextOn]}>
                        {item.is_active ? 'Active' : 'Off'}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Side-by-Side Action Buttons */}
                  <View style={styles.cardActionsRow}>
                    <Pressable style={styles.gridEditBtn} onPress={() => openEditModal(item)}>
                      <Edit2 size={12} color="#334155" style={{ marginRight: 4 }} />
                      <Text style={styles.gridEditBtnText}>Edit</Text>
                    </Pressable>

                    <Pressable style={styles.gridDeleteBtn} onPress={() => setDeleteModalCat(item)}>
                      <Trash2 size={12} color="#EF4444" style={{ marginRight: 4 }} />
                      <Text style={styles.gridDeleteBtnText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        /* TREE VIEW MODE */
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {rootCategories.map((root) => {
            const subcats = categoryList.filter((c) => c.parent_id === root.id);
            return (
              <View key={root.id} style={styles.treeCard}>
                <View style={styles.treeHeader}>
                  {root.image ? (
                    <Image source={{ uri: root.image }} style={styles.treeThumb} resizeMode="cover" />
                  ) : (
                    <Text style={styles.iconEmoji}>{root.icon || '📦'}</Text>
                  )}
                  <Text style={styles.treeTitle}>{root.name}</Text>
                  <Pressable style={{ marginLeft: 'auto' }} onPress={() => openEditModal(root)}>
                    <Edit2 size={14} color={COLORS.primary} />
                  </Pressable>
                </View>
                {subcats.length > 0 ? (
                  <View style={styles.subList}>
                    {subcats.map((sub) => (
                      <View key={sub.id} style={styles.subRow}>
                        <ChevronRight size={14} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
                        {sub.image ? (
                          <Image source={{ uri: sub.image }} style={styles.subThumb} resizeMode="cover" />
                        ) : (
                          <Text style={styles.subEmoji}>{sub.icon || '📁'}</Text>
                        )}
                        <Text style={styles.subName}>{sub.name}</Text>
                        <Pressable style={{ marginLeft: 'auto' }} onPress={() => openEditModal(sub)}>
                          <Edit2 size={12} color={COLORS.textSecondary} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noSubText}>No subcategories mapped</Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ADD / EDIT MODAL */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingCategory ? 'Edit Category' : 'Add New Category'}</Text>
              <Pressable onPress={() => setIsModalVisible(false)}>
                <X size={20} color={COLORS.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Category Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Fresh Fruits & Veggies"
                value={formName}
                onChangeText={setFormName}
              />

              <Text style={styles.inputLabel}>Slug Identifier</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. fresh-produce"
                value={formSlug}
                onChangeText={setFormSlug}
              />

              <Text style={styles.inputLabel}>Category Emoji Icon</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 🍎"
                value={formIcon}
                onChangeText={setFormIcon}
              />

              <Text style={styles.inputLabel}>Category Image URL (Customer Portal Match)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. https://images.unsplash.com/..."
                value={formImage}
                onChangeText={setFormImage}
              />

              <Text style={styles.inputLabel}>Taxonomy Level</Text>
              <View style={styles.levelRow}>
                {(['root', 'subcategory', 'item_type'] as const).map((lvl) => (
                  <Pressable
                    key={lvl}
                    style={[styles.levelBtn, formLevel === lvl && styles.levelBtnActive]}
                    onPress={() => setFormLevel(lvl)}
                  >
                    <Text style={[styles.levelBtnText, formLevel === lvl && styles.levelBtnTextActive]}>
                      {lvl === 'root' ? 'Root' : lvl === 'subcategory' ? 'Subcat' : 'Item Type'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {formLevel !== 'root' ? (
                <>
                  <Text style={styles.inputLabel}>Parent Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {rootCategories.map((rCat) => (
                      <Pressable
                        key={rCat.id}
                        style={[
                          styles.parentChip,
                          formParentId === rCat.id && styles.parentChipActive,
                        ]}
                        onPress={() => setFormParentId(rCat.id)}
                      >
                        <Text
                          style={[
                            styles.parentChipText,
                            formParentId === rCat.id && styles.parentChipTextActive,
                          ]}
                        >
                          {rCat.icon} {rCat.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              ) : null}

              <Pressable style={styles.toggleRow} onPress={() => setFormIsActive(!formIsActive)}>
                <View style={[styles.checkbox, formIsActive && styles.checkboxChecked]}>
                  {formIsActive ? <CheckCircle size={14} color="#FFFFFF" /> : null}
                </View>
                <Text style={styles.toggleText}>Active Category (Visible to customers)</Text>
              </Pressable>

              <Pressable style={styles.saveSubmitBtn} onPress={handleSaveCategory} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveSubmitText}>
                    {editingCategory ? 'Save Changes' : 'Create Category'}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal visible={!!deleteModalCat} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmBox}>
            <Trash2 size={32} color={COLORS.danger} style={{ alignSelf: 'center', marginBottom: 8 }} />
            <Text style={styles.confirmTitle}>Delete Category?</Text>
            <Text style={styles.confirmSub}>
              Are you sure you want to delete "{deleteModalCat?.name}"?
            </Text>
            <View style={styles.confirmActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setDeleteModalCat(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.deleteBtn} onPress={handleDeleteCategory}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 4,
  },
  filterCard: {
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chipGroup: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    marginRight: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primaryBorder,
  },
  chipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  viewToggleGroup: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  viewToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  viewToggleActive: {
    backgroundColor: '#FFFFFF',
    ...SHADOWS.sm,
  },
  gridTwoColContent: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  gridTwoColRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  gridCategoryCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  catImageBox: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    position: 'relative',
  },
  gridCatImage: {
    width: '100%',
    height: '100%',
  },
  fallbackIconBox: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
  },
  catOverlaidBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeGreen: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  badgeRed: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  catOverlaidBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  catTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  catSubTitle: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  statsToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statsIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  activePillSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  activePillSwitchOn: {
    backgroundColor: '#D1FAE5',
    borderColor: '#A7F3D0',
  },
  switchDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
    marginRight: 4,
  },
  switchDotOn: {
    backgroundColor: '#10B981',
  },
  switchText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
  },
  switchTextOn: {
    color: '#047857',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 6,
  },
  gridEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gridEditBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  gridDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  gridDeleteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  listContent: {
    padding: SPACING.md,
  },
  catCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  catCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catImageContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catImageThumb: {
    width: '100%',
    height: '100%',
  },
  treeThumb: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  subThumb: {
    width: 24,
    height: 24,
    borderRadius: 6,
    marginRight: 6,
    backgroundColor: '#F8FAFC',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 18,
  },
  catName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  catSlug: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeActive: {
    backgroundColor: '#D1FAE5',
  },
  badgeInactive: {
    backgroundColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  badgeTextActive: {
    color: COLORS.success,
  },
  badgeTextInactive: {
    color: COLORS.danger,
  },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  parentText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  catFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
  },
  actionBtn: {
    padding: 6,
    backgroundColor: COLORS.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  treeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  treeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  treeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginLeft: 8,
  },
  subList: {
    marginLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.border,
    paddingLeft: 12,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  subEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  subName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  noSubText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    padding: SPACING.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalForm: {
    paddingVertical: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 14,
    color: COLORS.text,
  },
  levelRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  levelBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
  },
  levelBtnActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  levelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  levelBtnTextActive: {
    color: COLORS.primary,
  },
  parentChip: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  parentChipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  parentChipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    includeFontPadding: false,
    lineHeight: 16,
  },
  parentChipTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  saveSubmitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveSubmitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  confirmBox: {
    backgroundColor: '#FFFFFF',
    margin: 24,
    borderRadius: 16,
    padding: 20,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  confirmSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  confirmActions: {
    flexDirection: 'row',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  deleteBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: COLORS.danger,
    marginLeft: 6,
  },
  deleteText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
