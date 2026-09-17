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
import { get, post, patch, del, uploadImage } from '../../services/api';
import * as ImagePicker from 'expo-image-picker';
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
  ArrowLeft,
  Camera,
  UploadCloud,
  Folder,
  Layers,
  Check,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { categories as defaultCategories, getCanonicalSlug } from '../../data/categories';
import { products as defaultProducts } from '../../data/products';
import { getValidImage } from '../../services/cloudinary';
import { getItem, setItem } from '../../services/storage';
import {
  saveCategory as syncSaveCategory,
  deleteCategory as syncDeleteCategory,
  onCatalogUpdate,
  getSynchronizedProducts,
} from '../../services/catalog';

interface SellerCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  image?: string;
  description?: string;
  level?: 'root' | 'subcategory' | 'item_type';
  parent_id?: string | null;
  parent_name?: string;
  product_count?: number;
  is_active: boolean;
}

const SUBCATEGORY_MAP: Record<string, Array<{ name: string; icon: string; image?: string }>> = {
  'produce': [
    { name: 'Fresh Fruits', icon: '🍎', image: 'apples-real.jpg' },
    { name: 'Fresh Vegetables', icon: '🥦', image: 'fresh-red-apples.jpg' },
    { name: 'Exotic & Organic', icon: '🥑', image: 'fresh-fruits-veggies-hero-transparent.png' },
  ],
  'dairy-bakery': [
    { name: 'Milk & Butter', icon: '🥛', image: 'amul-butter-real.jpg' },
    { name: 'Cheese & Paneer', icon: '🧀', image: 'combo_cheese.jpg' },
    { name: 'Fresh Bread & Buns', icon: '🍞', image: 'brown_bread_real.jpg' },
  ],
  'snacks-munchies': [
    { name: 'Potato Chips', icon: '🥔', image: 'lays-magic-masala.png' },
    { name: 'Tortilla & Corn Nachos', icon: '🌽', image: 'subcat-tortilla-corn.jpg' },
    { name: 'Namkeen & Crunch', icon: '🥨', image: 'subcat-namkeen.jpg' },
  ],
  'beverages': [
    { name: 'Soft Drinks & Sodas', icon: '🥤', image: 'coca-cola-real.jpg' },
    { name: 'Energy & Health Drinks', icon: '⚡', image: 'red_bull_real.jpg' },
    { name: 'Fresh Fruit Juices', icon: '🧃', image: 'tropicana_juice_real.jpg' },
  ],
  'staples': [
    { name: 'Atta & Flours', icon: '🌾', image: 'aashirvaad-atta-real.jpg' },
    { name: 'Basmati & Regular Rice', icon: '🍚', image: 'fortune_basmati_real.jpg' },
    { name: 'Dals & Pulses', icon: '🥣', image: 'toor_dal_real.jpg' },
  ],
  'chocolates': [
    { name: 'Premium Chocolates', icon: '🍫', image: 'cadbury-silk-real.jpg' },
    { name: 'Wafer Bars & Candies', icon: '🍬', image: 'kitkat_real.jpg' },
    { name: 'Spreads & Gift Boxes', icon: '🎁', image: 'cadbury-dairy-milk-silk.jpg' },
  ],
  'personal-care': [
    { name: 'Handwash & Sanitizers', icon: '🧴', image: 'dettol-handwash-real.jpg' },
    { name: 'Hair Care & Shampoos', icon: '💇', image: 'combo_hygiene.jpg' },
    { name: 'Bath Soaps & Skincare', icon: '🧼', image: 'dettol_real.jpg' },
  ],
  'household': [
    { name: 'Detergents & Fabric Care', icon: '🧺', image: 'surf-excel-real.jpg' },
    { name: 'Dishwash & Kitchen Cleaners', icon: '🍽️', image: 'surf_real.jpg' },
    { name: 'Floor & Surface Cleaners', icon: '🧹', image: 'dettol_real.jpg' },
  ],
  'tea-coffee': [
    { name: 'Instant & Filter Coffee', icon: '☕', image: 'subcat-instant-coffee.jpg' },
    { name: 'Tea Powder & Green Tea', icon: '🍵', image: 'combo_tea.jpg' },
  ],
  'biscuits': [
    { name: 'Cream Biscuits', icon: '🍪', image: 'oreo-biscuits-real.jpg' },
    { name: 'Cookies & Rusks', icon: '🧇', image: 'parle_g_real.jpg' },
  ],
  'instant-food': [
    { name: 'Instant Noodles & Pasta', icon: '🍜', image: 'maggi_noodles_real.jpg' },
    { name: 'Ready-to-Eat Curries & Soups', icon: '🍲', image: 'instant-noodles-hero-transparent.png' },
  ],
  'oil': [
    { name: 'Cooking & Refined Oil', icon: '🛢️', image: 'fortune-oil-real.jpg' },
    { name: 'Desi Ghee & Butter Oil', icon: '🧈', image: 'fortune_oil_real.jpg' },
  ],
  'electronics': [
    { name: 'Headphones & TWS Audio', icon: '🎧', image: 'subcat-headphones.jpg' },
    { name: 'Smartwatches & Accessories', icon: '⌚', image: 'electronics-hero-banner.jpg' },
  ],
  'fashion': [
    { name: 'Sneakers & Casual Shoes', icon: '👟', image: 'sneakers.jpg' },
    { name: 'Eyewear & Accessories', icon: '🕶️', image: 'sneakers.jpg' },
  ],
  'baby-care': [
    { name: 'Diapers & Gentle Wipes', icon: '👶', image: 'category-baby-care.jpg' },
    { name: 'Baby Food & Bath Care', icon: '🍼', image: 'category-baby-care.jpg' },
  ],
  'pet-care': [
    { name: 'Dog Food & Chew Treats', icon: '🐶', image: 'category-pet-care.jpg' },
    { name: 'Cat Food & Pet Grooming', icon: '🐱', image: 'category-pet-care.jpg' },
  ],
  'beauty-cosmetics': [
    { name: 'Face Serums & Moisturizers', icon: '💄', image: 'subcat-face-serums.jpg' },
    { name: 'Makeup & Beauty Essentials', icon: '💅', image: 'category-beauty-cosmetics.jpg' },
  ],
  'health-wellness': [
    { name: 'Vitamins & Immunity Boosters', icon: '💊', image: 'category-health-wellness.jpg' },
    { name: 'First Aid & Pain Relief', icon: '🩹', image: 'category-health-wellness.jpg' },
  ],
  'meat-seafood': [
    { name: 'Fresh Poultry & Chicken', icon: '🍗', image: 'banner-chicken-eggs.jpg' },
    { name: 'Farm Brown & White Eggs', icon: '🥚', image: 'banner-chicken-eggs.jpg' },
    { name: 'Fish & Fresh Seafood', icon: '🐟', image: 'banner-fresh-meat-section.jpg' },
  ],
  'home-kitchen': [
    { name: 'Cookware & Non-Stick Pans', icon: '🍳', image: 'category-home-kitchen.jpg' },
    { name: 'Water Bottles & Glass Flasks', icon: '🍶', image: 'category-home-kitchen.jpg' },
  ],
  'stationery-office': [
    { name: 'Notebooks, Diaries & Pads', icon: '📓', image: 'category-stationery-office.jpg' },
    { name: 'Pens, Markers & Art Sets', icon: '✒️', image: 'category-stationery-office.jpg' },
  ],
  'sports-fitness': [
    { name: 'Sports Gear & Badminton', icon: '🏸', image: 'category-sports-fitness.jpg' },
    { name: 'Whey Protein & Gym Shakers', icon: '🏋️', image: 'category-sports-fitness.jpg' },
  ],
  'toys-games': [
    { name: 'Building Bricks & Blocks', icon: '🧱', image: 'category-toys-games.jpg' },
    { name: 'Board Games & Puzzles', icon: '🎲', image: 'category-toys-games.jpg' },
  ],
  'pooja-needs': [
    { name: 'Agarbatti & Dhoop Sticks', icon: '🪔', image: 'category-pooja-needs.jpg' },
    { name: 'Camphor, Diyas & Wicks', icon: '🕯️', image: 'category-pooja-needs.jpg' },
  ],
};

function buildProductCounts(prodsRes: any): Map<string, number> {
  const prodCountsByCat = new Map<string, number>();

  for (const p of defaultProducts) {
    const cId = String(p.category || p.category_slug || '');
    const slug = getCanonicalSlug(cId);
    if (cId) {
      prodCountsByCat.set(cId, (prodCountsByCat.get(cId) || 0) + 1);
      prodCountsByCat.set(cId.toLowerCase(), (prodCountsByCat.get(cId.toLowerCase()) || 0) + 1);
    }
    if (slug) {
      prodCountsByCat.set(slug, (prodCountsByCat.get(slug) || 0) + 1);
    }
  }

  if (Array.isArray(prodsRes)) {
    for (const p of prodsRes) {
      const cId = String(p.category_id || p.category || '');
      const slug = getCanonicalSlug(cId);
      if (cId) {
        prodCountsByCat.set(cId, (prodCountsByCat.get(cId) || 0) + 1);
        prodCountsByCat.set(cId.toLowerCase(), (prodCountsByCat.get(cId.toLowerCase()) || 0) + 1);
      }
      if (slug) {
        prodCountsByCat.set(slug, (prodCountsByCat.get(slug) || 0) + 1);
      }
    }
  }

  return prodCountsByCat;
}

function getBaseSellerCategories(prodCountsByCat?: Map<string, number>): SellerCategory[] {
  const allCats: SellerCategory[] = [];

  defaultCategories.forEach((cat, idx) => {
    const slug = cat.slug || getCanonicalSlug(cat.name || '') || 'category-' + idx;
    const catId = String(cat.id || 'cat-' + idx);
    const rawImage = cat.image ? getValidImage(cat.image) : undefined;
    const pCount = prodCountsByCat
      ? (prodCountsByCat.get(catId) || prodCountsByCat.get(slug) || prodCountsByCat.get(cat.name.toLowerCase()) || cat.itemCount || 12)
      : (cat.itemCount || 12);

    const rootCat: SellerCategory = {
      id: catId,
      name: cat.name,
      slug,
      icon: cat.icon || '📦',
      image: rawImage,
      level: 'root',
      parent_id: null,
      product_count: pCount,
      is_active: true,
    };
    allCats.push(rootCat);

    const subs = SUBCATEGORY_MAP[slug];
    if (subs && subs.length > 0) {
      subs.forEach((sub, sIdx) => {
        const subImage = sub.image ? getValidImage(sub.image) : undefined;
        allCats.push({
          id: `${catId}-sub-${sIdx + 1}`,
          name: sub.name,
          slug: `${slug}-${sub.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          icon: sub.icon || '📁',
          image: subImage,
          level: 'subcategory',
          parent_id: catId,
          parent_name: cat.name,
          product_count: Math.max(1, Math.round(pCount / (subs.length + 1))),
          is_active: true,
        });
      });
    }
  });

  return allCats;
}

export default function SellerCategoriesScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [categoryList, setCategoryList] = useState<SellerCategory[]>(() => getBaseSellerCategories());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'tree'>('grid');

  // Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SellerCategory | null>(null);
  const [deleteModalCat, setDeleteModalCat] = useState<SellerCategory | null>(null);

  // Form inputs
  const [classification, setClassification] = useState<'main' | 'sub'>('main');
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formIcon, setFormIcon] = useState('📦');
  const [formImage, setFormImage] = useState('');
  const [formInitialSubCat, setFormInitialSubCat] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [formLevel, setFormLevel] = useState<'root' | 'subcategory' | 'item_type'>('root');
  const [formParentId, setFormParentId] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handlePickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.granted) {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: true,
          aspect: [4, 3],
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          setFormImage(result.assets[0].uri);
        }
      } else {
        showToast('Photo gallery permission is required to add an image', 'error');
      }
    } catch {
      showToast('Could not open image picker', 'error');
    }
  };

  // Live cloud categories fetch with product count cross-referencing and fallback
  const fetchCategoriesLive = useCallback(async () => {
    try {
      const [stored, catsRes, allProds] = await Promise.all([
        getItem<SellerCategory[]>('grabit_seller_categories').catch(() => null),
        get('/categories').catch(() => []),
        getSynchronizedProducts().catch(() => defaultProducts),
      ]);

      const prodCountsByCat = buildProductCounts(allProds);
      const baseDefaults = getBaseSellerCategories(prodCountsByCat);

      // Unified map ensuring all default and custom categories are maintained
      const mergedMap = new Map<string, SellerCategory>();

      // 1. Base defaults (all 18 root categories + subcategories)
      for (const def of baseDefaults) {
        mergedMap.set(def.slug.toLowerCase(), def);
        mergedMap.set(String(def.id), def);
      }

      // 2. Cloud categories (overlay by slug or id)
      if (Array.isArray(catsRes) && catsRes.length > 0) {
        for (const cat of catsRes) {
          const catId = String(cat.id || 'cat-' + (cat.slug || ''));
          const rawImage = (cat.image_url && cat.image_url.trim()) || (cat.image && cat.image.trim()) || '';
          const slug = cat.slug || getCanonicalSlug(cat.name || '') || catId;
          const pCount = prodCountsByCat.get(catId) || prodCountsByCat.get(slug) || prodCountsByCat.get(String(cat.name || '').toLowerCase()) || 0;
          const existing = mergedMap.get(slug.toLowerCase()) || mergedMap.get(catId);

          const item: SellerCategory = {
            id: catId,
            name: cat.name || existing?.name || 'Unnamed Category',
            slug,
            icon: cat.icon || existing?.icon || '📦',
            image: rawImage ? getValidImage(rawImage) : existing?.image,
            level: cat.level || existing?.level || 'root',
            parent_id: cat.parent_id ? String(cat.parent_id) : (existing?.parent_id || null),
            parent_name: existing?.parent_name,
            product_count: pCount || existing?.product_count || 0,
            is_active: cat.is_active ?? existing?.is_active ?? true,
          };
          mergedMap.set(slug.toLowerCase(), item);
          mergedMap.set(catId, item);
        }
      }

      // 3. Stored seller categories (highest priority overlay)
      if (Array.isArray(stored) && stored.length > 0) {
        for (const sc of stored) {
          const catId = String(sc.id);
          const slug = sc.slug || getCanonicalSlug(sc.name || '');
          const existing = mergedMap.get(slug.toLowerCase()) || mergedMap.get(catId);
          const pCount = prodCountsByCat.get(catId) || prodCountsByCat.get(slug) || sc.product_count || existing?.product_count || 0;

          const item: SellerCategory = {
            ...(existing || {}),
            ...sc,
            id: catId,
            name: sc.name || existing?.name || 'Category',
            image: sc.image !== undefined ? sc.image : existing?.image,
            slug,
            product_count: pCount,
            is_active: sc.is_active ?? existing?.is_active ?? true,
          };
          mergedMap.set(slug.toLowerCase(), item);
          mergedMap.set(catId, item);
        }
      }

      // Collect unique categories preserving root + subcategory hierarchy
      const uniqueList: SellerCategory[] = [];
      const seenIds = new Set<string>();
      for (const cat of mergedMap.values()) {
        if (!seenIds.has(cat.id)) {
          seenIds.add(cat.id);
          uniqueList.push(cat);
        }
      }

      setCategoryList(uniqueList);
    } catch {
      // Retain populated list
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategoriesLive();
  }, [fetchCategoriesLive]);

  useEffect(() => {
    const unsub = onCatalogUpdate(() => {
      fetchCategoriesLive();
    });
    return unsub;
  }, [fetchCategoriesLive]);

  const openAddModal = () => {
    setEditingCategory(null);
    setClassification('main');
    setFormName('');
    setFormSlug('');
    setFormIcon('📦');
    setFormImage('');
    setFormInitialSubCat('');
    setFormDescription('');
    setFormLevel('root');
    setFormParentId('');
    setFormIsActive(true);
    setIsModalVisible(true);
  };

  const openEditModal = (cat: SellerCategory) => {
    setEditingCategory(cat);
    const isSub = cat.level === 'subcategory' || !!cat.parent_id;
    setClassification(isSub ? 'sub' : 'main');
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormIcon(cat.icon || (isSub ? '📁' : '📦'));
    setFormImage(cat.image || '');
    setFormInitialSubCat('');
    setFormDescription(cat.description || '');
    setFormLevel(cat.level || (isSub ? 'subcategory' : 'root'));
    setFormParentId(cat.parent_id || '');
    setFormIsActive(cat.is_active);
    setIsModalVisible(true);
  };

  const handleSaveCategory = async () => {
    if (!formName.trim()) {
      showToast(classification === 'sub' ? 'Sub-category name is required' : 'Category name is required', 'error');
      return;
    }

    if (classification === 'sub' && !formParentId) {
      if (rootCategories.length > 0) {
        setFormParentId(rootCategories[0].id);
      } else {
        showToast('Please select a parent main category', 'error');
        return;
      }
    }

    setIsSubmitting(true);
    let finalImageUrl = formImage.trim();
    if (finalImageUrl && (finalImageUrl.startsWith('file:') || finalImageUrl.startsWith('content:'))) {
      try {
        setIsUploadingImage(true);
        const uploaded = await uploadImage(finalImageUrl, 'categories');
        if (uploaded) {
          finalImageUrl = uploaded;
        }
      } catch (e) {
        // Fallback to local image URI if offline or upload fails
      } finally {
        setIsUploadingImage(false);
      }
    }

    const effectiveParentId = classification === 'sub' ? (formParentId || (rootCategories[0]?.id || null)) : null;
    const slug = formSlug.trim() || formName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const parentCat = effectiveParentId ? categoryList.find((c) => c.id === effectiveParentId) : undefined;

    const payload: SellerCategory = {
      id: editingCategory ? editingCategory.id : 'cat-' + Date.now(),
      name: formName.trim(),
      slug,
      icon: formIcon || (classification === 'sub' ? '📁' : '📦'),
      image: finalImageUrl ? getValidImage(finalImageUrl) : '',
      description: formDescription.trim() || undefined,
      level: classification === 'sub' ? 'subcategory' : 'root',
      parent_id: effectiveParentId,
      parent_name: parentCat?.name,
      is_active: formIsActive,
      product_count: editingCategory?.product_count || 0,
    };

    let updatedList: SellerCategory[];
    if (editingCategory) {
      updatedList = categoryList.map((c) =>
        String(c.id) === String(editingCategory.id) || (c.slug && c.slug === editingCategory.slug)
          ? { ...c, ...payload, image: payload.image }
          : c
      );
      setCategoryList(updatedList);
      showToast(
        classification === 'sub'
          ? `Sub-category "${formName}" updated!`
          : `Category "${formName}" updated!`,
        'success'
      );
    } else {
      updatedList = [payload, ...categoryList];

      // If creating a main category and user supplied an initial sub-category, auto-create it!
      if (classification === 'main' && formInitialSubCat.trim()) {
        const subName = formInitialSubCat.trim();
        const subSlug = subName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const subPayload: SellerCategory = {
          id: 'cat-' + (Date.now() + 1),
          name: subName,
          slug: subSlug,
          icon: '📁',
          level: 'subcategory',
          parent_id: payload.id,
          parent_name: payload.name,
          is_active: true,
          product_count: 0,
        };
        updatedList = [subPayload, ...updatedList];
        syncSaveCategory(subPayload).catch(() => {});
      }

      setCategoryList(updatedList);
      showToast(
        classification === 'sub'
          ? `Sub-category "${formName}" created!`
          : `Category "${formName}" created!`,
        'success'
      );
    }
    await setItem('grabit_seller_categories', updatedList).catch(() => {});
    setIsModalVisible(false);
    setIsSubmitting(false);

    try {
      await syncSaveCategory(payload);
    } catch {
      // Local instant update already completed
    }
  };

  const handleToggleActive = async (cat: SellerCategory) => {
    const nextState = !cat.is_active;
    const updated = categoryList.map((c) => (c.id === cat.id ? { ...c, is_active: nextState } : c));
    setCategoryList(updated);
    await setItem('grabit_seller_categories', updated).catch(() => {});
    showToast(`Category "${cat.name}" is now ${nextState ? 'Active' : 'Inactive'}`, 'info');
    try {
      await syncSaveCategory({ ...cat, is_active: nextState });
    } catch {}
  };

  const handleDeleteCategory = async () => {
    if (!deleteModalCat) return;
    const target = deleteModalCat;
    const updated = categoryList.filter((c) => c.id !== target.id && c.parent_id !== target.id);
    setCategoryList(updated);
    await setItem('grabit_seller_categories', updated).catch(() => {});
    showToast(`Category "${target.name}" deleted`, 'success');
    setDeleteModalCat(null);

    try {
      await syncDeleteCategory(target.id);
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
        <View style={styles.headerTitleRow}>
          <Pressable
            style={styles.backBtnCircle}
            onPress={() => router.replace('/seller')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={18} color="#0F172A" />
          </Pressable>
          <Grid size={22} color={COLORS.primary} style={{ marginRight: 8 }} />
          <Text style={styles.headerTitle}>Categories ({rootCategories.length})</Text>
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
            {(searchQuery.trim() ? filteredCategories : filteredCategories.filter((c) => c.level === 'root' || !c.parent_id)).map((item, idx) => {
              const subCount = categoryList.filter((c) => c.parent_id === item.id).length || 3;
              const isEditingThis = editingCategory?.id === item.id;
              return (
                <Pressable
                  key={item.id ? String(item.id) : 'cat-' + idx}
                  style={[
                    styles.gridCategoryCard,
                    isEditingThis && styles.gridCategoryCardEditing,
                  ]}
                  onPress={() => openEditModal(item)}
                >
                  {/* Category Image with Overlaid Active Status Badge */}
                  <View style={styles.catImageBox}>
                    {item.image ? (
                      <Image source={{ uri: getValidImage(item.image) }} style={styles.gridCatImage} resizeMode="cover" />
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

                    {isEditingThis ? (
                      <View style={styles.editingPillBadge}>
                        <Text style={styles.editingPillText}>Editing</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Category Title & Subtitle */}
                  <Text style={[styles.catTitle, isEditingThis && { color: COLORS.primary }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.catSubTitle} numberOfLines={1}>
                    {item.name} essentials
                  </Text>

                  {/* Item Stats & Active Toggle Switch */}
                  <View style={styles.statsToggleRow}>
                    <View style={styles.statsIconsRow}>
                      <Text style={styles.statsText}>🥞 {subCount}</Text>
                      <Text style={[styles.statsText, { marginLeft: 6 }]}>📦 {item.product_count ?? 12}</Text>
                    </View>

                    <Pressable
                      style={[styles.activePillSwitch, item.is_active && styles.activePillSwitchOn]}
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        handleToggleActive(item);
                      }}
                    >
                      <View style={[styles.switchDot, item.is_active && styles.switchDotOn]} />
                      <Text style={[styles.switchText, item.is_active && styles.switchTextOn]}>
                        {item.is_active ? 'Active' : 'Off'}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Side-by-Side Action Buttons */}
                  <View style={styles.cardActionsRow}>
                    <Pressable
                      style={[styles.gridEditBtn, isEditingThis && styles.gridEditBtnActive]}
                      onPress={() => openEditModal(item)}
                    >
                      <Edit2 size={12} color={isEditingThis ? COLORS.primary : '#334155'} style={{ marginRight: 4 }} />
                      <Text style={[styles.gridEditBtnText, isEditingThis && { color: COLORS.primary, fontWeight: '800' }]}>
                        {isEditingThis ? 'Editing' : 'Edit'}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.gridDeleteBtn}
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        setDeleteModalCat(item);
                      }}
                    >
                      <Trash2 size={12} color="#EF4444" style={{ marginRight: 4 }} />
                      <Text style={styles.gridDeleteBtnText}>Delete</Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            })}
            {filteredCategories.length === 0 ? (
              <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>No categories found</Text>
                <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>Try searching with another term</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      ) : (
        /* TREE VIEW MODE */
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {rootCategories.map((root) => {
            const subcats = categoryList.filter((c) => c.parent_id === root.id);
            const isEditingRoot = editingCategory?.id === root.id;
            return (
              <View key={root.id} style={[styles.treeCard, isEditingRoot && styles.treeCardEditing]}>
                <Pressable style={styles.treeHeader} onPress={() => openEditModal(root)}>
                  {root.image ? (
                    <Image source={{ uri: getValidImage(root.image) }} style={styles.treeThumb} resizeMode="cover" />
                  ) : (
                    <Text style={styles.iconEmoji}>{root.icon || '📦'}</Text>
                  )}
                  <Text style={[styles.treeTitle, isEditingRoot && { color: COLORS.primary }]}>{root.name}</Text>
                  {isEditingRoot ? (
                    <View style={styles.treeEditingBadge}>
                      <Text style={styles.treeEditingBadgeText}>Editing</Text>
                    </View>
                  ) : null}
                  <Pressable style={{ marginLeft: 'auto' }} onPress={() => openEditModal(root)}>
                    <Edit2 size={14} color={COLORS.primary} />
                  </Pressable>
                </Pressable>
                {subcats.length > 0 ? (
                  <View style={styles.subList}>
                    {subcats.map((sub) => {
                      const isEditingSub = editingCategory?.id === sub.id;
                      return (
                        <Pressable
                          key={sub.id}
                          style={[styles.subRow, isEditingSub && styles.subRowEditing]}
                          onPress={() => openEditModal(sub)}
                        >
                          <ChevronRight size={14} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
                          {sub.image ? (
                            <Image source={{ uri: getValidImage(sub.image) }} style={styles.subThumb} resizeMode="cover" />
                          ) : (
                            <Text style={styles.subEmoji}>{sub.icon || '📁'}</Text>
                          )}
                          <Text style={[styles.subName, isEditingSub && { color: COLORS.primary, fontWeight: '700' }]}>
                            {sub.name}
                          </Text>
                          {isEditingSub ? (
                            <View style={[styles.treeEditingBadge, { marginLeft: 8 }]}>
                              <Text style={styles.treeEditingBadgeText}>Editing</Text>
                            </View>
                          ) : null}
                          <Pressable style={{ marginLeft: 'auto' }} onPress={() => openEditModal(sub)}>
                            <Edit2 size={12} color={COLORS.textSecondary} />
                          </Pressable>
                        </Pressable>
                      );
                    })}
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
              {/* Category Classification */}
              <Text style={styles.inputLabel}>Category Classification</Text>
              <View style={styles.classificationContainer}>
                <Pressable
                  style={[
                    styles.classificationBtn,
                    classification === 'main' && styles.classificationBtnActive,
                  ]}
                  onPress={() => {
                    setClassification('main');
                    setFormLevel('root');
                  }}
                >
                  <Folder
                    size={17}
                    color={classification === 'main' ? COLORS.primary : COLORS.textSecondary}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.classificationBtnText,
                      classification === 'main' && styles.classificationBtnTextActive,
                    ]}
                  >
                    Main Category
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.classificationBtn,
                    classification === 'sub' && styles.classificationBtnActive,
                  ]}
                  onPress={() => {
                    setClassification('sub');
                    setFormLevel('subcategory');
                    if (!formParentId && rootCategories.length > 0) {
                      setFormParentId(rootCategories[0].id);
                    }
                  }}
                >
                  <Layers
                    size={17}
                    color={classification === 'sub' ? COLORS.primary : COLORS.textSecondary}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.classificationBtnText,
                      classification === 'sub' && styles.classificationBtnTextActive,
                    ]}
                  >
                    Sub Category
                  </Text>
                </Pressable>
              </View>

              {/* If Sub Category: Select Parent Main Category */}
              {classification === 'sub' ? (
                <View style={{ marginTop: 10, marginBottom: 4 }}>
                  <Text style={styles.inputLabel}>Select Main Category *</Text>
                  <Text style={styles.helperText}>Choose the main category this sub-category belongs under</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                    {rootCategories.map((rCat) => {
                      const isSelected = formParentId === rCat.id;
                      return (
                        <Pressable
                          key={rCat.id}
                          style={[
                            styles.parentChip,
                            isSelected && styles.parentChipActive,
                          ]}
                          onPress={() => setFormParentId(rCat.id)}
                        >
                          <Text style={{ fontSize: 14, marginRight: 6 }}>{rCat.icon || '📁'}</Text>
                          <Text
                            style={[
                              styles.parentChipText,
                              isSelected && styles.parentChipTextActive,
                            ]}
                          >
                            {rCat.name}
                          </Text>
                          {isSelected ? (
                            <Check size={13} color={COLORS.primary} style={{ marginLeft: 4 }} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {/* Category Name */}
              <Text style={styles.inputLabel}>
                {classification === 'sub' ? 'Sub Category Name *' : 'Category Name *'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={classification === 'sub' ? 'e.g. Milk & Cream, Exotic Fruits' : 'e.g. Fresh Fruits & Veggies'}
                placeholderTextColor={COLORS.textMuted}
                value={formName}
                onChangeText={setFormName}
              />

              {/* Slug Identifier */}
              <Text style={styles.inputLabel}>Slug Identifier</Text>
              <TextInput
                style={styles.input}
                placeholder={classification === 'sub' ? 'e.g. milk-cream' : 'e.g. fresh-produce'}
                placeholderTextColor={COLORS.textMuted}
                value={formSlug}
                onChangeText={setFormSlug}
              />

              {/* Category Emoji Icon */}
              <Text style={styles.inputLabel}>Category Emoji Icon</Text>
              <TextInput
                style={styles.input}
                placeholder={classification === 'sub' ? 'e.g. 🥛' : 'e.g. 🍎'}
                placeholderTextColor={COLORS.textMuted}
                value={formIcon}
                onChangeText={setFormIcon}
              />

              {/* If Main Category: Sub Category (Optional) */}
              {classification === 'main' && !editingCategory ? (
                <View style={{ marginTop: 6 }}>
                  <Text style={styles.inputLabel}>Sub Category (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Milk & Cream, Exotic Fruits, Cold Drinks"
                    placeholderTextColor={COLORS.textMuted}
                    value={formInitialSubCat}
                    onChangeText={setFormInitialSubCat}
                  />
                  <Text style={styles.helperText}>
                    Optionally create an initial sub-category nested directly inside this category.
                  </Text>
                </View>
              ) : null}

              {/* Description (Optional) */}
              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={styles.textAreaInput}
                placeholder="Short summary of items included under this category..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
                value={formDescription}
                onChangeText={setFormDescription}
              />

              {/* Category Image (Optional) */}
              <Text style={styles.inputLabel}>Category Image (Optional)</Text>
              <Pressable style={styles.imagePickerBox} onPress={handlePickImage}>
                {formImage ? (
                  <View style={styles.previewContainer}>
                    <Image source={{ uri: getValidImage(formImage) }} style={styles.previewImage} resizeMode="cover" />
                    <View style={styles.changeImageOverlay}>
                      <Camera size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.changeImageText}>Change</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <View style={styles.cameraIconCircle}>
                      <Camera size={22} color={COLORS.primary} />
                    </View>
                    <Text style={styles.imagePickerText}>Upload Image from Device</Text>
                    <Text style={styles.imagePickerSub}>Tap to select from photo gallery</Text>
                  </View>
                )}
              </Pressable>
              {formImage ? (
                <Pressable style={styles.removeImageBtn} onPress={() => setFormImage('')}>
                  <X size={13} color="#EF4444" style={{ marginRight: 4 }} />
                  <Text style={styles.removeImageText}>Remove Image</Text>
                </Pressable>
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
                    {editingCategory
                      ? 'Save Changes'
                      : classification === 'sub'
                      ? 'Create Sub-Category'
                      : 'Create Category'}
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtnCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
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
  gridCategoryCardEditing: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: '#F8FAFC',
    ...SHADOWS.md,
  },
  editingPillBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  editingPillText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
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
  gridEditBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
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
  treeCardEditing: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
    backgroundColor: '#F8FAFC',
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
  treeEditingBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  treeEditingBadgeText: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '800',
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
  subRowEditing: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
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
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    width: '100%',
    maxWidth: 560,
    padding: SPACING.md,
    ...SHADOWS.lg,
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
  imagePickerBox: {
    height: 125,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 4,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  cameraIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  imagePickerText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
  },
  imagePickerSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  previewContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  changeImageOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeImageText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  removeImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  removeImageText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
  },
  classificationContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  classificationBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 9,
  },
  classificationBtnActive: {
    backgroundColor: '#FFFFFF',
    ...SHADOWS.sm,
  },
  classificationBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  classificationBtnTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  helperText: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 8,
    lineHeight: 16,
  },
  textAreaInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 70,
    textAlignVertical: 'top',
  },
});
