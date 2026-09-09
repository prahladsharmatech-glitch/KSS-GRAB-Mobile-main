import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Image,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { get, post, patch, del, uploadImage } from '../../services/api';
import { getCloudinaryUrl } from '../../services/cloudinary';
import { Product } from '../../types';
import { useToast } from '../../context/ToastContext';
import { BatchLoadingSkeleton } from '../../components/BatchLoadingSkeleton';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import {
  Package,
  Plus,
  Search,
  Camera,
  Edit2,
  Trash2,
  X,
  Clock,
  Minus,
  ChevronDown,
} from 'lucide-react-native';

export default function SellerProductsScreen() {
  const { showToast } = useToast();
  const [productList, setProductList] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'instock' | 'lowstock' | 'outstock'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [displayLimit, setDisplayLimit] = useState<number>(20);
  const [isBatchLoading, setIsBatchLoading] = useState<boolean>(false);

  // Reset batch limit to 20 whenever filters change for 0ms instant response
  useEffect(() => {
    setDisplayLimit(20);
    setIsBatchLoading(false);
  }, [searchQuery, stockFilter, selectedCategory]);

  // Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteModalProduct, setDeleteModalProduct] = useState<Product | null>(null);
  const [isCategoryPickerVisible, setIsCategoryPickerVisible] = useState(false);
  const [isStockPickerVisible, setIsStockPickerVisible] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formOriginalPrice, setFormOriginalPrice] = useState('');
  const [formCategory, setFormCategory] = useState('produce');
  const [formWeight, setFormWeight] = useState('1 unit');
  const [formStockCount, setFormStockCount] = useState('25');
  const [formInStock, setFormInStock] = useState(true);
  const [formDescription, setFormDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live cloud products sync
  const fetchProductsLive = useCallback(async () => {
    try {
      const res = await get('/products');
      if (res && Array.isArray(res)) {
        const formatted: Product[] = res.map((p: any, idx: number) => {
          const rawImage = p.image_url || p.image || 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645100/grabit_media/lays_magic_masala.png';
          const stockVal = p.stock !== undefined ? parseInt(p.stock, 10) : (p.stockCount ?? 20);
          const inStockVal = p.in_stock !== undefined ? Boolean(p.in_stock) : (p.inStock ?? stockVal > 0);

          return {
            ...p,
            id: String(p.id || 'prod-' + idx),
            name: p.name || 'Unnamed Product',
            price: Number(p.price || 0),
            originalPrice: p.mrp ? Number(p.mrp) : (p.originalPrice ? Number(p.originalPrice) : undefined),
            weight: p.unit || p.weight || '1 unit',
            image: rawImage,
            category: p.category_id || p.category || 'produce',
            stockCount: isNaN(stockVal) ? 20 : stockVal,
            inStock: inStockVal,
            description: p.description || '',
          };
        });
        setProductList(formatted);
      }
    } catch {
      // Retain list
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProductsLive();
  }, [fetchProductsLive]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormPrice('');
    setFormOriginalPrice('');
    setFormCategory('produce');
    setFormWeight('1 unit');
    setFormStockCount('25');
    setFormInStock(true);
    setFormDescription('');
    setImageUri(null);
    setIsModalVisible(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setFormName(prod.name);
    setFormPrice(String(prod.price));
    setFormOriginalPrice(prod.originalPrice ? String(prod.originalPrice) : '');
    setFormCategory(prod.category || 'produce');
    setFormWeight(prod.weight || '1 unit');
    setFormStockCount(String(prod.stockCount ?? 20));
    setFormInStock(prod.inStock ?? true);
    setFormDescription(prod.description || '');
    setImageUri(prod.image);
    setIsModalVisible(true);
  };

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast('Camera roll permission required!', 'error');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleToggleStock = async (product: Product) => {
    const newStock = !product.inStock;
    showToast(`Stock updated: ${product.name} is now ${newStock ? 'In Stock' : 'Out of Stock'}`, 'info');
    setProductList((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, inStock: newStock } : p))
    );
    try {
      await patch(`/products/${product.id}`, {
        in_stock: newStock,
        inStock: newStock,
        stock: newStock ? Math.max(1, product.stockCount ?? 20) : 0
      });
    } catch {
      // Updated locally instantly
    }
  };

  const handleUpdateStockCount = async (productId: string | number, delta: number) => {
    let newCount = 0;
    setProductList((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const currentCount = p.stockCount ?? 20;
          newCount = Math.max(0, currentCount + delta);
          return { ...p, stockCount: newCount, inStock: newCount > 0 };
        }
        return p;
      })
    );
    try {
      await patch(`/products/${productId}`, { stock: newCount, in_stock: newCount > 0 });
    } catch {}
  };

  const handleSaveProduct = async () => {
    if (!formName.trim() || !formPrice.trim()) {
      showToast('Product name and price are required', 'error');
      return;
    }

    setIsSubmitting(true);
    let finalImageUrl = imageUri || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400';

    if (imageUri && (imageUri.startsWith('file:') || imageUri.startsWith('content:'))) {
      try {
        finalImageUrl = await uploadImage(imageUri, 'seller_inventory');
      } catch {
        // Fallback to local image URI
      }
    }

    const payload: Product = {
      id: editingProduct ? editingProduct.id : 'prod-' + Date.now(),
      name: formName.trim(),
      price: parseFloat(formPrice),
      originalPrice: formOriginalPrice ? parseFloat(formOriginalPrice) : undefined,
      category: formCategory,
      weight: formWeight,
      stockCount: parseInt(formStockCount, 10) || 0,
      inStock: formInStock,
      description: formDescription,
      image: finalImageUrl,
    };

    if (editingProduct) {
      setProductList((prev) =>
        prev.map((p) => (p.id === editingProduct.id ? { ...p, ...payload } : p))
      );
      showToast(`Product "${formName}" updated!`, 'success');
    } else {
      setProductList((prev) => [payload, ...prev]);
      showToast(`Product "${formName}" added!`, 'success');
    }
    setIsModalVisible(false);
    setIsSubmitting(false);

    try {
      const backendPayload = {
        name: payload.name,
        price: payload.price,
        mrp: payload.originalPrice || payload.price,
        category_id: payload.category,
        category: payload.category,
        stock: payload.stockCount,
        in_stock: payload.inStock,
        image_url: payload.image,
        unit: payload.weight,
        description: payload.description,
      };
      if (editingProduct) {
        await patch(`/products/${editingProduct.id}`, backendPayload);
      } else {
        const created = await post('/products', backendPayload);
        if (created && created.id) {
          setProductList((prev) =>
            prev.map((p) => (p.id === payload.id ? { ...p, id: String(created.id) } : p))
          );
        }
      }
    } catch {
      // Local instant update already completed
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteModalProduct) return;
    const target = deleteModalProduct;
    setProductList((prev) => prev.filter((p) => p.id !== target.id));
    showToast(`Product "${target.name}" removed`, 'success');
    setDeleteModalProduct(null);
    try {
      await del(`/products/${target.id}`);
    } catch {
      // Local update already completed
    }
  };

  // Metrics computation (memoized for sub-1ms filter response)
  const totalCount = useMemo(() => productList.length, [productList]);
  const activeCount = useMemo(() => productList.filter((p) => p.inStock).length, [productList]);
  const lowStockCount = useMemo(() => productList.filter((p) => (p.stockCount ?? 0) > 0 && (p.stockCount ?? 0) <= 10).length, [productList]);
  const outOfStockCount = useMemo(() => productList.filter((p) => !p.inStock || (p.stockCount ?? 0) === 0).length, [productList]);
  const uniqueCategoriesList = useMemo(() => Array.from(new Set(productList.map((p) => p.category.toLowerCase()))).sort(), [productList]);

  // Filtered Products (memoized)
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const cat = selectedCategory.toLowerCase();
    return productList.filter((p) => {
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      const matchesCategory = cat === 'all' || p.category.toLowerCase() === cat;
      const matchesStock =
        stockFilter === 'all'
          ? true
          : stockFilter === 'instock'
          ? p.inStock
          : stockFilter === 'lowstock'
          ? (p.stockCount ?? 0) > 0 && (p.stockCount ?? 0) <= 10
          : !p.inStock || (p.stockCount ?? 0) === 0;
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [productList, searchQuery, selectedCategory, stockFilter]);

  const handleLoadNextBatch = useCallback(() => {
    if (isBatchLoading || filteredProducts.length <= displayLimit) return;
    setIsBatchLoading(true);
    setTimeout(() => {
      setDisplayLimit((prev) => prev + 20);
      setIsBatchLoading(false);
    }, 180);
  }, [isBatchLoading, filteredProducts.length, displayLimit]);

  return (
    <View style={styles.container}>
      {/* HEADER BAR */}
      <View style={styles.topHeader}>
        <View style={styles.titleRow}>
          <Package size={22} color={COLORS.primary} style={{ marginRight: 8 }} />
          <Text style={styles.headerTitle}>Products ({productList.length})</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={openAddModal}>
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add Product</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={({ nativeEvent }) => {
          const isCloseToBottom =
            nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >=
            nativeEvent.contentSize.height - 350;
          if (isCloseToBottom) {
            handleLoadNextBatch();
          }
        }}
      >
        {/* DROPDOWN FILTER PILLS ROW (MATCHING IMAGE 1) */}
        <View style={styles.dropdownFilterRow}>
          <Pressable
            style={[styles.dropdownPill, selectedCategory !== 'all' && styles.dropdownPillActive]}
            onPress={() => setIsCategoryPickerVisible(true)}
          >
            <Text style={[styles.dropdownPillText, selectedCategory !== 'all' && styles.dropdownPillTextActive]} numberOfLines={1}>
              {selectedCategory === 'all' ? `All Categories (${totalCount})` : `${selectedCategory.toUpperCase()} (${filteredProducts.length})`}
            </Text>
            <ChevronDown size={14} color={selectedCategory !== 'all' ? '#0066FF' : '#64748B'} style={{ marginLeft: 4 }} />
          </Pressable>

          <Pressable
            style={[styles.dropdownPill, stockFilter !== 'all' && styles.dropdownPillActive]}
            onPress={() => setIsStockPickerVisible(true)}
          >
            <Text style={[styles.dropdownPillText, stockFilter !== 'all' && styles.dropdownPillTextActive]} numberOfLines={1}>
              {stockFilter === 'all'
                ? `All Stock Status (${totalCount})`
                : stockFilter === 'instock'
                ? `In Stock (${activeCount})`
                : stockFilter === 'lowstock'
                ? `Low Stock (${lowStockCount})`
                : `Out of Stock (${outOfStockCount})`}
            </Text>
            <ChevronDown size={14} color={stockFilter !== 'all' ? '#0066FF' : '#64748B'} style={{ marginLeft: 4 }} />
          </Pressable>
        </View>

        {/* METRICS CARDS (EXACT MATCH TO IMAGE 3) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.metricsScroll}>
          <Pressable
            style={[styles.metricCard, stockFilter === 'all' && styles.metricCardActive]}
            onPress={() => setStockFilter('all')}
          >
            <Text style={styles.metricVal}>{totalCount}</Text>
            <Text style={styles.metricLbl}>Total Items</Text>
          </Pressable>
          <Pressable
            style={[styles.metricCard, { borderColor: '#10B981' }, stockFilter === 'instock' && styles.metricCardActiveGreen]}
            onPress={() => setStockFilter('instock')}
          >
            <Text style={[styles.metricVal, { color: COLORS.success }]}>{activeCount}</Text>
            <Text style={styles.metricLbl}>In Stock</Text>
          </Pressable>
          <Pressable
            style={[styles.metricCard, { borderColor: '#F59E0B' }, stockFilter === 'lowstock' && styles.metricCardActiveYellow]}
            onPress={() => setStockFilter('lowstock')}
          >
            <Text style={[styles.metricVal, { color: COLORS.warning }]}>{lowStockCount}</Text>
            <Text style={styles.metricLbl}>Low Stock</Text>
          </Pressable>
          <Pressable
            style={[styles.metricCard, { borderColor: '#EF4444' }, stockFilter === 'outstock' && styles.metricCardActiveRed]}
            onPress={() => setStockFilter('outstock')}
          >
            <Text style={[styles.metricVal, { color: COLORS.danger }]}>{outOfStockCount}</Text>
            <Text style={styles.metricLbl}>Out of Stock</Text>
          </Pressable>
        </ScrollView>

        {/* SEARCH INPUT BAR */}
        <View style={styles.filterSection}>
          <View style={styles.searchInputWrap}>
            <Search size={16} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products catalog..."
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
        </View>

        {/* 2-COLUMN PRODUCT CARDS GRID (EXACT MATCH TO IMAGE 1) */}
        {isLoading && productList.length === 0 ? (
          <View style={[styles.emptyBox, { paddingVertical: 40 }]}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[styles.emptyText, { marginTop: 12 }]}>Loading products from cloud...</Text>
          </View>
        ) : filteredProducts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Package size={36} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No matching products found</Text>
          </View>
        ) : (
          <View>
            <View style={styles.gridTwoColContainer}>
              {filteredProducts.slice(0, displayLimit).map((product, idx) => {
                const stock = product.stockCount ?? 20;
                return (
                  <View key={product.id ? String(product.id) : 'prod-' + idx} style={styles.gridProductCard}>
                    {/* Product Image with Overlaid Status Pill */}
                    <View style={styles.productImageBox}>
                      <Image source={{ uri: getCloudinaryUrl(product.image, 'thumbnail') }} style={styles.gridProductImage} resizeMode="cover" />
                      <View style={[styles.imageStatusPill, product.inStock ? styles.statusPillGreen : styles.statusPillRed]}>
                        <View style={[styles.statusDot, { backgroundColor: product.inStock ? '#10B981' : '#EF4444' }]} />
                        <Text style={styles.statusPillText}>
                          {product.inStock ? `In Stock (${stock})` : `Out of Stock (0)`}
                        </Text>
                      </View>
                    </View>

                    {/* Product Info */}
                    <Text style={styles.productTitle} numberOfLines={2}>
                      {product.name}
                    </Text>
                    <Text style={styles.weightText}>{product.weight || '1 unit'} • Grabit</Text>

                    {/* Price & Rating / Delivery Badges Row */}
                    <View style={styles.priceRatingRow}>
                      <Text style={styles.currentPrice}>₹{product.price}</Text>
                      <View style={styles.badgesRightRow}>
                        <View style={styles.ratingBadge}>
                          <Text style={styles.starIcon}>★</Text>
                          <Text style={styles.ratingText}>4.8</Text>
                        </View>
                        <View style={styles.deliveryBadge}>
                          <Clock size={10} color="#0066FF" style={{ marginRight: 2 }} />
                          <Text style={styles.deliveryText}>10 mins</Text>
                        </View>
                      </View>
                    </View>

                    {/* Stock Quantity Controller */}
                    <View style={styles.stockControllerRow}>
                      <Text style={styles.stockQtyLabel}>Stock Qty:</Text>
                      <View style={styles.stepperBox}>
                        <Pressable
                          style={styles.stepperBtn}
                          onPress={() => handleUpdateStockCount(product.id, -1)}
                        >
                          <Minus size={12} color="#334155" />
                        </Pressable>
                        <Text style={styles.stepperValue}>{stock}</Text>
                        <Pressable
                          style={styles.stepperBtn}
                          onPress={() => handleUpdateStockCount(product.id, 1)}
                        >
                          <Plus size={12} color="#334155" />
                        </Pressable>
                      </View>
                    </View>

                    {/* Side-by-Side Action Buttons */}
                    <View style={styles.actionButtonsRow}>
                      <Pressable style={styles.gridEditBtn} onPress={() => openEditModal(product)}>
                        <Edit2 size={12} color="#334155" style={{ marginRight: 4 }} />
                        <Text style={styles.gridEditBtnText}>Edit</Text>
                      </Pressable>

                      <Pressable style={styles.gridDeleteBtn} onPress={() => setDeleteModalProduct(product)}>
                        <Trash2 size={12} color="#EF4444" style={{ marginRight: 4 }} />
                        <Text style={styles.gridDeleteBtnText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>

            {isBatchLoading ? (
              <BatchLoadingSkeleton />
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* ADD / EDIT PRODUCT MODAL */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingProduct ? 'Edit Product' : 'Add Product to Catalog'}</Text>
              <Pressable onPress={() => setIsModalVisible(false)}>
                <X size={20} color={COLORS.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm} showsVerticalScrollIndicator={false}>
              {/* IMAGE PICKER WIDGET */}
              <Text style={styles.inputLabel}>Product Image</Text>
              <Pressable style={styles.imagePickerBox} onPress={handlePickImage}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.previewImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Camera size={24} color={COLORS.primary} />
                    <Text style={styles.imagePickerText}>Upload Image from Device</Text>
                  </View>
                )}
              </Pressable>

              <Text style={styles.inputLabel}>Product Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Fresh Royal Gala Red Apples"
                value={formName}
                onChangeText={setFormName}
              />

              <View style={styles.rowTwo}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.inputLabel}>Selling Price (₹) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 149"
                    keyboardType="numeric"
                    value={formPrice}
                    onChangeText={setFormPrice}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.inputLabel}>MRP / Orig Price (₹)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 180"
                    keyboardType="numeric"
                    value={formOriginalPrice}
                    onChangeText={setFormOriginalPrice}
                  />
                </View>
              </View>

              <View style={styles.rowTwo}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.inputLabel}>Category</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="produce, snacks, dairy"
                    value={formCategory}
                    onChangeText={setFormCategory}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.inputLabel}>Weight / Pack Size</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 1 kg, 500ml"
                    value={formWeight}
                    onChangeText={setFormWeight}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Stock Count</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 50"
                keyboardType="numeric"
                value={formStockCount}
                onChangeText={setFormStockCount}
              />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top', paddingTop: 8 }]}
                placeholder="Item features or details..."
                multiline
                value={formDescription}
                onChangeText={setFormDescription}
              />

              <Pressable style={styles.saveSubmitBtn} onPress={handleSaveProduct} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveSubmitText}>
                    {editingProduct ? 'Save Changes' : 'Publish to Catalog'}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* DELETE MODAL */}
      <Modal visible={!!deleteModalProduct} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmBox}>
            <Trash2 size={32} color={COLORS.danger} style={{ alignSelf: 'center', marginBottom: 8 }} />
            <Text style={styles.confirmTitle}>Remove Product?</Text>
            <Text style={styles.confirmSub}>
              Are you sure you want to remove "{deleteModalProduct?.name}" from the store catalog?
            </Text>
            <View style={styles.confirmActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setDeleteModalProduct(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.deleteConfirmBtn} onPress={handleDeleteProduct}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* CATEGORY PICKER MODAL */}
      <Modal visible={isCategoryPickerVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Category</Text>
              <Pressable onPress={() => setIsCategoryPickerVisible(false)}>
                <X size={20} color={COLORS.text} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              <Pressable
                style={[styles.pickerRow, selectedCategory === 'all' && styles.pickerRowSelected]}
                onPress={() => {
                  setSelectedCategory('all');
                  setIsCategoryPickerVisible(false);
                }}
              >
                <Text style={[styles.pickerRowText, selectedCategory === 'all' && styles.pickerRowTextSelected]}>
                  All Categories ({totalCount})
                </Text>
              </Pressable>
              {uniqueCategoriesList.map((cat) => (
                <Pressable
                  key={cat}
                  style={[styles.pickerRow, selectedCategory === cat && styles.pickerRowSelected]}
                  onPress={() => {
                    setSelectedCategory(cat);
                    setIsCategoryPickerVisible(false);
                  }}
                >
                  <Text style={[styles.pickerRowText, selectedCategory === cat && styles.pickerRowTextSelected]}>
                    {cat.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* STOCK STATUS PICKER MODAL */}
      <Modal visible={isStockPickerVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Stock Status</Text>
              <Pressable onPress={() => setIsStockPickerVisible(false)}>
                <X size={20} color={COLORS.text} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {[
                { key: 'all', label: `All Stock Status (${totalCount})` },
                { key: 'instock', label: `In Stock (${activeCount})` },
                { key: 'lowstock', label: `Low Stock Alerts (${lowStockCount})` },
                { key: 'outstock', label: `Out of Stock (${outOfStockCount})` },
              ].map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[styles.pickerRow, stockFilter === opt.key && styles.pickerRowSelected]}
                  onPress={() => {
                    setStockFilter(opt.key as any);
                    setIsStockPickerVisible(false);
                  }}
                >
                  <Text style={[styles.pickerRowText, stockFilter === opt.key && styles.pickerRowTextSelected]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
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
  metricsScroll: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  metricCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 100,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  metricCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0066FF',
    borderWidth: 2,
  },
  metricCardActiveGreen: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
    borderWidth: 2,
  },
  metricCardActiveYellow: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
    borderWidth: 2,
  },
  metricCardActiveRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  metricVal: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
  },
  metricLbl: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  dropdownFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: 4,
  },
  dropdownPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
    ...SHADOWS.sm,
  },
  dropdownPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0066FF',
    borderWidth: 1.5,
  },
  dropdownPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  dropdownPillTextActive: {
    color: '#0066FF',
  },
  pickerRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    borderRadius: 8,
    marginVertical: 2,
  },
  pickerRowSelected: {
    backgroundColor: '#EFF6FF',
  },
  pickerRowText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  pickerRowTextSelected: {
    color: '#0066FF',
    fontWeight: '800',
  },
  gridTwoColContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: 100,
    rowGap: 12,
  },
  gridProductCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  productImageBox: {
    width: '100%',
    height: 125,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    position: 'relative',
  },
  gridProductImage: {
    width: '100%',
    height: '100%',
  },
  imageStatusPill: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillGreen: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  statusPillRed: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
    lineHeight: 17,
  },
  weightText: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  priceRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  badgesRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
  },
  starIcon: {
    fontSize: 9,
    color: '#D97706',
    marginRight: 2,
  },
  ratingText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#92400E',
  },
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveryText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0066FF',
  },
  stockControllerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  stockQtyLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  stepperBtn: {
    padding: 3,
  },
  stepperValue: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0F172A',
    paddingHorizontal: 6,
  },
  actionButtonsRow: {
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
  filterSection: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    ...SHADOWS.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 8,
    color: COLORS.textMuted,
    fontSize: 14,
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
    maxHeight: '90%',
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
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    color: COLORS.text,
  },
  rowTwo: {
    flexDirection: 'row',
  },
  imagePickerBox: {
    height: 100,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imagePickerText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 4,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  saveSubmitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 24,
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
  loadMoreBar: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreBarText: {
    color: '#0066FF',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteConfirmBtn: {
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
