import { getItem, setItem } from './storage';
import { get, post, patch, del, clearApiCache } from './api';
import { Product, Category } from '../types';
import { categories as defaultCategories, getCanonicalSlug } from '../data/categories';
import { products as defaultProducts } from '../data/products';
import { getValidImage } from './cloudinary';

export const SELLER_PRODUCTS_KEY = 'grabit_seller_products';
export const SELLER_CATEGORIES_KEY = 'grabit_seller_categories';

// In-memory catalog cache with 30s TTL to eliminate redundant network & disk waterfalls
let cachedSyncedProducts: Product[] | null = null;
let lastProductsFetchTime = 0;
let inFlightProductsPromise: Promise<Product[]> | null = null;

let cachedSyncedCategories: Category[] | null = null;
let lastCategoriesFetchTime = 0;
let inFlightCategoriesPromise: Promise<Category[]> | null = null;

const CATALOG_CACHE_TTL = 30000; // 30s

export function invalidateCatalogMemoryCache() {
  cachedSyncedProducts = null;
  lastProductsFetchTime = 0;
  inFlightProductsPromise = null;
  cachedSyncedCategories = null;
  lastCategoriesFetchTime = 0;
  inFlightCategoriesPromise = null;
}

// Event emitter for real-time cross-screen synchronization
type CatalogListener = () => void;
const catalogListeners = new Set<CatalogListener>();

export function onCatalogUpdate(listener: CatalogListener): () => void {
  catalogListeners.add(listener);
  return () => {
    catalogListeners.delete(listener);
  };
}

export function notifyCatalogUpdated() {
  invalidateCatalogMemoryCache();
  clearApiCache();
  catalogListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn('[Catalog] Error in catalog update listener:', e);
    }
  });
}

// Default subcategory definitions for baseline categories
export const BASE_SUBCATEGORY_MAP: Record<string, Array<{ name: string; icon: string; image?: string }>> = {
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

// ==============================================================================
// 1. PRODUCTS SYNCHRONIZATION
// ==============================================================================

export async function getSynchronizedProducts(categoryFilter?: string): Promise<Product[]> {
  const now = Date.now();
  let allProducts: Product[];

  if (cachedSyncedProducts && now - lastProductsFetchTime < CATALOG_CACHE_TTL) {
    allProducts = cachedSyncedProducts;
  } else if (inFlightProductsPromise) {
    allProducts = await inFlightProductsPromise;
  } else {
    inFlightProductsPromise = (async () => {
      try {
        const [storedSellerProducts, cloudProducts] = await Promise.all([
          getItem<Product[]>(SELLER_PRODUCTS_KEY).catch(() => null),
          get<any[]>('/products').catch(() => null),
        ]);

        const productMap = new Map<string, Product>();

        // 1. Base default catalog as foundation
        for (const p of defaultProducts) {
          productMap.set(String(p.id), {
            ...p,
            id: String(p.id),
          });
        }

        // 2. Cloud DB products
        if (Array.isArray(cloudProducts) && cloudProducts.length > 0) {
          for (const p of cloudProducts) {
            const rawCatName =
              (typeof p.categories === 'object' && p.categories?.name)
                ? p.categories.name
                : (Array.isArray(p.categories) && p.categories[0]?.name)
                ? p.categories[0].name
                : p.category || p.category_slug || p.name || '';

            const stockVal = p.stock !== undefined ? parseInt(p.stock, 10) : (p.stockCount ?? 20);
            const inStockVal = p.in_stock !== undefined ? Boolean(p.in_stock) : (p.inStock ?? stockVal > 0);

            productMap.set(String(p.id), {
              id: String(p.id),
              name: p.name || 'Product',
              price: Number(p.price || 0),
              originalPrice: p.mrp ? Number(p.mrp) : (p.originalPrice ? Number(p.originalPrice) : Math.round((p.price || 0) * 1.25)),
              mrp: p.mrp ? Number(p.mrp) : undefined,
              discountPercent: p.discountPercent || p.discount_percent || 15,
              weight: p.unit || p.weight || '1 unit',
              image: getValidImage(p.image_url || p.image),
              category: p.category_id || p.category || getCanonicalSlug(rawCatName),
              subcategory: p.subcategory || p.subCategory,
              brand: p.brand || 'Grabit',
              description: p.description || '',
              rating: p.rating || 4.8,
              reviewCount: p.reviewCount || p.reviews_count || 120,
              deliveryTimeMinutes: p.deliveryTimeMinutes || 10,
              stockCount: isNaN(stockVal) ? 20 : stockVal,
              inStock: inStockVal,
            });
          }
        }

        // 3. Seller-created / seller-edited products (highest priority)
        if (Array.isArray(storedSellerProducts) && storedSellerProducts.length > 0) {
          for (const sp of storedSellerProducts) {
            productMap.set(String(sp.id), {
              ...sp,
              id: String(sp.id),
              image: getValidImage(sp.image),
            });
          }
        }

        const freshList = Array.from(productMap.values());
        cachedSyncedProducts = freshList;
        lastProductsFetchTime = Date.now();
        return freshList;
      } catch (err) {
        console.warn('[Catalog] getSynchronizedProducts error:', err);
        return (cachedSyncedProducts || defaultProducts) as Product[];
      } finally {
        inFlightProductsPromise = null;
      }
    })();

    allProducts = await inFlightProductsPromise;
  }

  if (categoryFilter && categoryFilter !== 'all') {
    const targetSlug = getCanonicalSlug(categoryFilter).toLowerCase();
    return allProducts.filter((p) => {
      const pCat = String(p.category || '').toLowerCase();
      const pCanonical = getCanonicalSlug(pCat).toLowerCase();
      return pCanonical === targetSlug || pCat === targetSlug || pCat === categoryFilter.toLowerCase();
    });
  }

  return allProducts;
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const cleanId = String(id).trim();
  const all = await getSynchronizedProducts();
  return all.find((p) => String(p.id) === cleanId || String(p.id).toLowerCase() === cleanId.toLowerCase());
}

export async function saveProduct(product: Partial<Product>): Promise<Product> {
  const current = (await getItem<Product[]>(SELLER_PRODUCTS_KEY).catch(() => null)) || [];
  
  const id = product.id ? String(product.id) : 'prod-' + Date.now();
  const fullProduct: Product = {
    id,
    name: (product.name || 'Unnamed Product').trim(),
    price: Number(product.price || 0),
    originalPrice: product.originalPrice ? Number(product.originalPrice) : (product.mrp ? Number(product.mrp) : undefined),
    mrp: product.mrp ? Number(product.mrp) : (product.originalPrice ? Number(product.originalPrice) : undefined),
    discountPercent: product.discountPercent ?? 15,
    weight: product.weight || '1 unit',
    image: getValidImage(product.image || 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645100/grabit_media/lays_magic_masala.png'),
    category: product.category || 'produce',
    subcategory: product.subcategory || product.subCategory,
    subCategory: product.subcategory || product.subCategory,
    brand: product.brand || 'Grabit',
    description: product.description || '',
    rating: product.rating || 4.8,
    reviewCount: product.reviewCount || 1,
    deliveryTimeMinutes: product.deliveryTimeMinutes || 10,
    inStock: product.inStock ?? true,
    stockCount: product.stockCount ?? 25,
  };

  const existingIndex = current.findIndex((p) => String(p.id) === id);
  let updated: Product[];
  if (existingIndex >= 0) {
    updated = [...current];
    updated[existingIndex] = { ...updated[existingIndex], ...fullProduct };
  } else {
    updated = [fullProduct, ...current];
  }

  await setItem(SELLER_PRODUCTS_KEY, updated);
  notifyCatalogUpdated();

  // Async cloud sync in background
  (async () => {
    try {
      const backendPayload = {
        name: fullProduct.name,
        price: fullProduct.price,
        mrp: fullProduct.originalPrice || fullProduct.price,
        category_id: fullProduct.category,
        category: fullProduct.category,
        subcategory: fullProduct.subcategory,
        stock: fullProduct.stockCount,
        in_stock: fullProduct.inStock,
        image_url: fullProduct.image,
        unit: fullProduct.weight,
        description: fullProduct.description,
      };

      if (existingIndex >= 0) {
        await patch(`/products/${id}`, backendPayload);
      } else {
        const created = await post('/products', backendPayload);
        if (created && created.id && String(created.id) !== id) {
          // Update local ID if cloud generated a different UUID
          const fresh = (await getItem<Product[]>(SELLER_PRODUCTS_KEY).catch(() => null)) || [];
          const fixed = fresh.map((p) => (String(p.id) === id ? { ...p, id: String(created.id) } : p));
          await setItem(SELLER_PRODUCTS_KEY, fixed);
          notifyCatalogUpdated();
        }
      }
    } catch {
      // Local sync succeeded
    }
  })();

  return fullProduct;
}

export async function deleteProduct(productId: string): Promise<void> {
  const cleanId = String(productId).trim();
  const current = (await getItem<Product[]>(SELLER_PRODUCTS_KEY).catch(() => null)) || [];
  const filtered = current.filter((p) => String(p.id) !== cleanId);
  await setItem(SELLER_PRODUCTS_KEY, filtered);
  notifyCatalogUpdated();

  (async () => {
    try {
      await del(`/products/${cleanId}`);
    } catch {}
  })();
}

export async function updateProductStock(productId: string, stockCount: number, inStock: boolean): Promise<void> {
  const cleanId = String(productId).trim();
  const current = (await getItem<Product[]>(SELLER_PRODUCTS_KEY).catch(() => null)) || [];
  const existing = current.find((p) => String(p.id) === cleanId);

  let updated: Product[];
  if (existing) {
    updated = current.map((p) =>
      String(p.id) === cleanId ? { ...p, stockCount, inStock } : p
    );
  } else {
    // If not already in seller products, find in base catalog and copy over
    const baseItem = defaultProducts.find((p) => String(p.id) === cleanId);
    if (baseItem) {
      updated = [{ ...baseItem, id: cleanId, stockCount, inStock }, ...current];
    } else {
      updated = current;
    }
  }

  await setItem(SELLER_PRODUCTS_KEY, updated);
  notifyCatalogUpdated();

  (async () => {
    try {
      await patch(`/products/${cleanId}`, { stock: stockCount, in_stock: inStock });
    } catch {}
  })();
}

// ==============================================================================
// 2. CATEGORIES AND SUBCATEGORIES SYNCHRONIZATION
// ==============================================================================

export async function getSynchronizedCategories(): Promise<Category[]> {
  const now = Date.now();
  if (cachedSyncedCategories && now - lastCategoriesFetchTime < CATALOG_CACHE_TTL) {
    return cachedSyncedCategories;
  }
  if (inFlightCategoriesPromise) {
    return inFlightCategoriesPromise;
  }

  inFlightCategoriesPromise = (async () => {
    try {
      const [storedSellerCats, cloudCats, allProducts] = await Promise.all([
        getItem<Category[]>(SELLER_CATEGORIES_KEY).catch(() => null),
        get<any[]>('/categories').catch(() => null),
        getSynchronizedProducts().catch(() => defaultProducts as Product[]),
      ]);

      // Product count cross-referencing
      const prodCountsByCat = new Map<string, number>();
      for (const p of allProducts) {
        const cId = String(p.category || '').toLowerCase();
        const slug = getCanonicalSlug(cId);
        if (cId) prodCountsByCat.set(cId, (prodCountsByCat.get(cId) || 0) + 1);
        if (slug) prodCountsByCat.set(slug, (prodCountsByCat.get(slug) || 0) + 1);
      }

      const catMap = new Map<string, Category>();

      // 1. Base default categories (all 24)
      for (const def of defaultCategories) {
        const slug = def.slug || getCanonicalSlug(def.name);
        const catId = String(def.id);
        const count = prodCountsByCat.get(catId) || prodCountsByCat.get(slug) || prodCountsByCat.get(def.name.toLowerCase()) || def.itemCount || 12;
        catMap.set(slug.toLowerCase(), {
          id: catId,
          name: def.name,
          slug,
          icon: def.icon || '📦',
          image: def.image ? getValidImage(def.image) : undefined,
          itemCount: count,
          level: 'root',
          parent_id: null,
          is_active: true,
        });
      }

      // 2. Cloud categories
      if (Array.isArray(cloudCats) && cloudCats.length > 0) {
        for (const cc of cloudCats) {
          const name = cc.name || 'Category';
          const slug = cc.slug || getCanonicalSlug(name);
          const catId = String(cc.id || slug);
          const rawImg = (cc.image_url && cc.image_url.trim()) || (cc.image && cc.image.trim()) || '';
          const count = prodCountsByCat.get(catId) || prodCountsByCat.get(slug) || prodCountsByCat.get(name.toLowerCase()) || 0;

          const existing = catMap.get(slug.toLowerCase());
          catMap.set(slug.toLowerCase(), {
            id: catId,
            name,
            slug,
            icon: cc.icon || existing?.icon || '📦',
            image: rawImg ? getValidImage(rawImg) : existing?.image,
            itemCount: count || existing?.itemCount || 0,
            level: cc.level || existing?.level || 'root',
            parent_id: cc.parent_id || existing?.parent_id || null,
            is_active: cc.is_active ?? existing?.is_active ?? true,
          });
        }
      }

      // 3. Stored seller categories (highest priority)
      if (Array.isArray(storedSellerCats) && storedSellerCats.length > 0) {
        for (const sc of storedSellerCats) {
          const slug = sc.slug || getCanonicalSlug(sc.name);
          const catId = String(sc.id || slug);
          const count = prodCountsByCat.get(catId) || prodCountsByCat.get(slug) || prodCountsByCat.get(sc.name.toLowerCase()) || sc.itemCount || 0;
          const key = slug.toLowerCase();

          catMap.set(key, {
            ...sc,
            id: catId,
            name: sc.name,
            slug,
            icon: sc.icon || '📦',
            image: sc.image ? getValidImage(sc.image) : (sc.image_url ? getValidImage(sc.image_url) : undefined),
            itemCount: count,
            level: sc.level || 'root',
            parent_id: sc.parent_id || null,
            is_active: sc.is_active ?? true,
          });
        }
      }

      // Return all root categories
      const all = Array.from(catMap.values()).filter((c) => c.level === 'root' || !c.parent_id);
      cachedSyncedCategories = all;
      lastCategoriesFetchTime = Date.now();
      return all;
    } catch (err) {
      console.warn('[Catalog] getSynchronizedCategories error:', err);
      return (cachedSyncedCategories || defaultCategories.map((c) => ({
        ...c,
        id: String(c.id),
        level: 'root',
        is_active: true,
      }))) as Category[];
    } finally {
      inFlightCategoriesPromise = null;
    }
  })();

  return inFlightCategoriesPromise;
}

export async function getAllStoredSellerCategories(): Promise<Category[]> {
  const stored = await getItem<Category[]>(SELLER_CATEGORIES_KEY).catch(() => null);
  return Array.isArray(stored) ? stored : [];
}

export async function getSynchronizedSubcategories(
  parentCategorySlugOrId: string
): Promise<Array<{ id: string; label: string; name: string; image?: string; icon?: string }>> {
  const parentSlug = getCanonicalSlug(parentCategorySlugOrId).toLowerCase();
  const results: Array<{ id: string; label: string; name: string; image?: string; icon?: string }> = [
    { id: 'All', label: 'All', name: 'All' },
  ];
  const seenNames = new Set<string>(['all']);

  // 1. Base subcategories
  const baseSubs = BASE_SUBCATEGORY_MAP[parentSlug] || [];
  for (const sub of baseSubs) {
    if (!seenNames.has(sub.name.toLowerCase())) {
      seenNames.add(sub.name.toLowerCase());
      results.push({
        id: sub.name,
        label: sub.name,
        name: sub.name,
        icon: sub.icon,
        image: sub.image ? getValidImage(sub.image) : undefined,
      });
    }
  }

  // 2. Custom seller-created subcategories from storage
  const storedSellerCats = await getAllStoredSellerCategories();
  for (const sc of storedSellerCats) {
    if (sc.level === 'subcategory' && sc.is_active !== false) {
      const matchParent =
        (sc.parent_id && String(sc.parent_id).toLowerCase() === parentCategorySlugOrId.toLowerCase()) ||
        (sc.parent_name && getCanonicalSlug(sc.parent_name).toLowerCase() === parentSlug) ||
        (sc.slug && sc.slug.startsWith(parentSlug));

      if (matchParent && !seenNames.has(sc.name.toLowerCase())) {
        seenNames.add(sc.name.toLowerCase());
        results.push({
          id: sc.name,
          label: sc.name,
          name: sc.name,
          icon: sc.icon || '📁',
          image: sc.image ? getValidImage(sc.image) : undefined,
        });
      }
    }
  }

  return results;
}

export async function saveCategory(category: Partial<Category>): Promise<Category> {
  const current = await getAllStoredSellerCategories();
  const id = category.id ? String(category.id) : 'cat-' + Date.now();
  const name = (category.name || 'Unnamed Category').trim();
  const slug = category.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const fullCategory: Category = {
    id,
    name,
    slug,
    icon: category.icon || '📦',
    image: category.image ? getValidImage(category.image) : (category.image === '' ? '' : undefined),
    image_url: category.image ? getValidImage(category.image) : (category.image === '' ? '' : undefined),
    level: category.level || 'root',
    parent_id: category.parent_id || null,
    parent_name: category.parent_name,
    is_active: category.is_active ?? true,
    itemCount: category.itemCount || 0,
  };

  // Seed with default categories if storage is empty so existing categories are never lost
  const baseList: Category[] = current.length > 0 ? current : defaultCategories.map((def) => ({
    id: String(def.id),
    name: def.name,
    slug: def.slug || getCanonicalSlug(def.name),
    icon: def.icon || '📦',
    image: def.image ? getValidImage(def.image) : undefined,
    image_url: def.image ? getValidImage(def.image) : undefined,
    level: 'root',
    parent_id: null,
    is_active: true,
    itemCount: def.itemCount || 12,
  }));

  const existingIndex = baseList.findIndex((c) => String(c.id) === id || (slug && c.slug === slug));
  let updated: Category[];
  if (existingIndex >= 0) {
    updated = [...baseList];
    updated[existingIndex] = {
      ...updated[existingIndex],
      ...fullCategory,
      image: fullCategory.image !== undefined ? fullCategory.image : updated[existingIndex].image,
      image_url: fullCategory.image_url !== undefined ? fullCategory.image_url : updated[existingIndex].image_url,
    };
  } else {
    updated = [fullCategory, ...baseList];
  }

  await setItem(SELLER_CATEGORIES_KEY, updated);
  notifyCatalogUpdated();

  // Background cloud sync
  (async () => {
    try {
      const payload = {
        name: fullCategory.name,
        slug: fullCategory.slug,
        icon: fullCategory.icon,
        image_url: fullCategory.image,
        level: fullCategory.level,
        parent_id: fullCategory.parent_id,
        is_active: fullCategory.is_active,
      };
      if (existingIndex >= 0) {
        await patch(`/categories/${id}`, payload);
      } else {
        await post('/categories', payload);
      }
    } catch {}
  })();

  return fullCategory;
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const cleanId = String(categoryId).trim();
  const current = await getAllStoredSellerCategories();
  // Remove category and any subcategories that belonged to it
  const filtered = current.filter(
    (c) => String(c.id) !== cleanId && String(c.parent_id) !== cleanId
  );
  await setItem(SELLER_CATEGORIES_KEY, filtered);
  notifyCatalogUpdated();

  (async () => {
    try {
      await del(`/categories/${cleanId}`);
    } catch {}
  })();
}

export async function searchSynchronizedProducts(query: string): Promise<Product[]> {
  const q = (query || '').toLowerCase().trim();
  if (!q) return [];
  const allProds = await getSynchronizedProducts();
  const qTokens = q.split(/\s+/).filter(Boolean);

  return allProds.filter((p) => {
    const name = (p.name || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();
    const sub = String((p as any).subcategory || (p as any).subCategory || '').toLowerCase();
    const brand = String(p.brand || '').toLowerCase();
    const desc = String(p.description || '').toLowerCase();

    return qTokens.every(
      (token) =>
        name.includes(token) ||
        cat.includes(token) ||
        sub.includes(token) ||
        brand.includes(token) ||
        desc.includes(token)
    );
  });
}
