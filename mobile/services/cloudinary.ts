const CLOUDINARY_CLOUD_NAME = 'hmx3azp6';
const BASE_URL = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export type ImageTransformation = 'thumbnail' | 'original' | 'medium';

export const DEFAULT_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80';

// Canonical mapping of filename variations to verified high-res CDN asset URLs
export const ASSET_FILENAME_MAP: Record<string, string> = {
  // Banners (Uploaded from C:\Users\HP\Desktop\Akash\Grabit\frontend\public)
  'banner-fruits-veggies.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789066607/grabit_media/banner_fruits_veggies.png',
  'banner-pharmacy.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789066627/grabit_media/banner_pharmacy.png',
  'banner-meat.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789066630/grabit_media/banner_meat.png',
  'banner-exclusive-deals.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789066633/grabit_media/banner_exclusive_deals.jpg',
  'banner-fresh-vegetables-section.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789066635/grabit_media/banner_fresh_vegetables_section.jpg',
  'banner-fresh-fruits.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789066638/grabit_media/banner_fresh_fruits.jpg',
  'banner-leafy-greens-section.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789066640/grabit_media/banner_leafy_greens_section.jpg',
  'banner-chicken-eggs.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789066642/grabit_media/banner_chicken_eggs.jpg',
  'banner-fresh-meat-section.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789066644/grabit_media/banner_fresh_meat_section.jpg',
  'banner-snacks-cravings-full.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789066647/grabit_media/banner_snacks_cravings_full.jpg',
  'banner-skincare-sale.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789066649/grabit_media/banner_skincare_sale.png',
  'banner-vip-savings.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789066651/grabit_media/banner_vip_savings.png',

  // Deal Banners matching exact user screenshots
  'deal-banner-snacks-vibrant.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789066654/grabit_media/deal_banner_snacks_vibrant.jpg',
  'deal-banner-beverages.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645106/grabit_media/deal_banner_beverages.jpg',
  'deal-banner-dryfruits.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645065/grabit_media/deal_banner_dryfruits.jpg',
  'deal-banner-chocolates.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645124/grabit_media/deal_banner_chocolates.jpg',
  'deal-banner-dairy.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645097/grabit_media/deal_banner_dairy.jpg',
  'deal-banner-household.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645056/grabit_media/deal_banner_household.jpg',
  'deal-banner-snacks.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645070/grabit_media/deal_banner_snacks.jpg',

  // Categories
  'category-baby-care.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067213/grabit_media/category_baby_care.jpg',
  'category-beauty-cosmetics.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067215/grabit_media/category_beauty_cosmetics.jpg',
  'category-health-wellness.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067216/grabit_media/category_health_wellness.jpg',
  'category-home-kitchen.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067217/grabit_media/category_home_kitchen.jpg',
  'category-meat-seafood.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067218/grabit_media/category_meat_seafood.jpg',
  'category-pet-care.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067219/grabit_media/category_pet_care.jpg',
  'category-pooja-needs.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067220/grabit_media/category_pooja_needs.jpg',
  'category-snacks-banner.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645053/grabit_media/category_snacks_banner.png',
  'category-snacks-feast-hero.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067222/grabit_media/category_snacks_feast_hero.png',
  'category-sports-fitness.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067223/grabit_media/category_sports_fitness.jpg',
  'category-stationery-office.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067224/grabit_media/category_stationery_office.jpg',
  'category-toys-games.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067225/grabit_media/category_toys_games.jpg',
  'electronics-hero-banner.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_500,q_auto,f_auto/grabit_media/electronics_hero_cutout.png',
  'sneakers.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_500,q_auto,f_auto/grabit_media/sneakers.jpg',
  'vip-gift-box-3d.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067813/grabit_media/vip_gift_box_3d.png',
  'vip-gift-box-3d.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067815/grabit_media/vip_gift_box_3d.jpg',
  'suggest-product-3d.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067817/grabit_media/suggest_product_3d.png',
  'banner-vip-savings.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789066651/grabit_media/banner_vip_savings.png',
  'incentive_3d_trophy.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067820/grabit_media/incentive_3d_trophy.png',
  'grabit-logo.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067981/grabit_media/grabit_logo.png',
  'grabit_light_login_banner.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067982/grabit_media/grabit_light_login_banner.jpg',
  'instant-noodles-hero-transparent.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067891/grabit_media/instant_noodles_hero_transparent.png',
  'subcat-atta-flours.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067933/grabit_media/subcat_atta_flours.jpg',
  'subcat-chocolates.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067933/grabit_media/subcat_chocolates.jpg',
  'subcat-face-serums.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067934/grabit_media/subcat_face_serums.jpg',
  'subcat-fresh-fruits.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067935/grabit_media/subcat_fresh_fruits.jpg',
  'subcat-fresh-vegetables.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067937/grabit_media/subcat_fresh_vegetables.jpg',
  'subcat-headphones.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067937/grabit_media/subcat_headphones.jpg',
  'subcat-instant-coffee.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067939/grabit_media/subcat_instant_coffee.jpg',
  'subcat-milk-butter.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067940/grabit_media/subcat_milk_butter.jpg',
  'subcat-namkeen.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067942/grabit_media/subcat_namkeen.jpg',
  'subcat-potato-chips.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067943/grabit_media/subcat_potato_chips.jpg',
  'subcat-soft-drinks.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067943/grabit_media/subcat_soft_drinks.jpg',
  'subcat-tortilla-corn.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789067944/grabit_media/subcat_tortilla_corn.jpg',

  // Products
  'fresh-red-apples.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/fresh_red_apples_real.jpg',
  'fresh_red_apples.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/fresh_red_apples_real.jpg',
  'fresh_red_apples_real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/fresh_red_apples_real.jpg',
  'apples-real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/apples_real.jpg',
  'apples_real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/apples_real.jpg',
  'lays-cream-onion.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/lays_cream_onion.png',
  'lays_cream_onion.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/lays_cream_onion.png',
  'amul-butter-real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/amul_butter_real.jpg',
  'coca-cola-real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/coca_cola_real.jpg',
  'aashirvaad-atta-real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/atta_real.jpg',
  'cadbury-silk-real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/cadbury_silk_real.jpg',
  'dettol-handwash-real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/dettol_handwash_real.jpg',
  'surf-excel-real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/surf_excel_real.jpg',
  'oreo-biscuits-real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/oreo_biscuits_real.jpg',
  'fortune-oil-real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/fortune_oil_real.jpg',
  'fresh-fruits-veggies-hero-transparent.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/v1789066607/grabit_media/banner_fruits_veggies.png',
  'cadbury-dairy-milk-silk.jpg': 'https://images.unsplash.com/photo-1548907040-4baa42d10919?w=300&q=80',
  'ferrero-rocher.jpg': 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=300&q=80',
};

export const getCloudinaryUrl = (path?: string | null, transformation: ImageTransformation = 'original'): string => {
  if (!path || typeof path !== 'string') {
    return DEFAULT_FALLBACK_IMAGE;
  }

  const clean = path.trim();
  if (
    !clean ||
    clean === 'null' ||
    clean === 'undefined' ||
    clean === '/null' ||
    clean === '/undefined' ||
    clean.endsWith('/null') ||
    clean.endsWith('/undefined')
  ) {
    return DEFAULT_FALLBACK_IMAGE;
  }

  const filename = clean.split('/').pop()?.split('?')[0] || '';
  if (ASSET_FILENAME_MAP[filename]) {
    return ASSET_FILENAME_MAP[filename];
  }

  // Also try dash to underscore conversion
  const underscoreName = filename.replace(/-/g, '_');
  if (ASSET_FILENAME_MAP[underscoreName]) {
    return ASSET_FILENAME_MAP[underscoreName];
  }

  const dashName = filename.replace(/_/g, '-');
  if (ASSET_FILENAME_MAP[dashName]) {
    return ASSET_FILENAME_MAP[dashName];
  }

  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    if (clean.endsWith('/null') || clean.endsWith('/undefined')) {
      return DEFAULT_FALLBACK_IMAGE;
    }
    return clean;
  }

  let transformString = '';
  switch (transformation) {
    case 'thumbnail':
      transformString = 'c_fill,h_300,w_300,q_auto,f_auto';
      break;
    case 'medium':
      transformString = 'c_fill,h_500,w_500,q_auto,f_auto';
      break;
    default:
      transformString = 'q_auto,f_auto';
  }

  const cleanPath = clean.startsWith('/') ? clean.substring(1) : clean;
  const finalPath = cleanPath.includes('/') ? cleanPath : `grabit_media/${cleanPath.replace(/-/g, '_')}`;

  return `${BASE_URL}/${transformString}/${finalPath}`;
};

export const getValidImage = (img?: any, fallback: string = DEFAULT_FALLBACK_IMAGE): string => {
  if (!img || typeof img !== 'string') return fallback;
  const clean = img.trim();
  if (
    !clean ||
    clean === 'null' ||
    clean === 'undefined' ||
    clean === '/null' ||
    clean === '/undefined' ||
    clean.endsWith('/null') ||
    clean.endsWith('/undefined')
  ) {
    return fallback;
  }

  const filename = clean.split('/').pop()?.split('?')[0] || '';
  if (ASSET_FILENAME_MAP[filename]) {
    return ASSET_FILENAME_MAP[filename];
  }

  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean;
  }

  return getCloudinaryUrl(clean, 'thumbnail');
};

export const optimizeImageUrl = (url: string, width: number = 300): string => {
  if (!url || typeof url !== 'string') return DEFAULT_FALLBACK_IMAGE;
  const clean = url.trim();

  if (
    clean === 'null' ||
    clean === 'undefined' ||
    clean === '/null' ||
    clean === '/undefined' ||
    clean.endsWith('/null') ||
    clean.endsWith('/undefined')
  ) {
    return DEFAULT_FALLBACK_IMAGE;
  }

  const filename = clean.split('/').pop()?.split('?')[0] || '';
  if (ASSET_FILENAME_MAP[filename]) {
    return ASSET_FILENAME_MAP[filename];
  }

  if (clean.includes('images.unsplash.com')) {
    if (clean.includes('w=')) {
      return clean.replace(/w=\d+/, `w=${width}`);
    }
    return clean.includes('?') ? `${clean}&w=${width}&q=80` : `${clean}?w=${width}&q=80`;
  }

  if (clean.includes('res.cloudinary.com') && clean.includes('/upload/')) {
    if (!clean.includes('/q_auto') && !clean.includes('/c_fill')) {
      return clean.replace('/upload/', `/upload/c_fill,w_${width},q_auto,f_auto/`);
    }
    return clean;
  }

  return getCloudinaryUrl(clean, 'thumbnail');
};
