const CLOUDINARY_CLOUD_NAME = 'hmx3azp6';
const BASE_URL = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export type ImageTransformation = 'thumbnail' | 'original' | 'medium';

export const DEFAULT_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300&q=80';

// Canonical mapping of filename variations to verified 200 OK CDN asset URLs
export const ASSET_FILENAME_MAP: Record<string, string> = {
  'fresh-red-apples.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/fresh_red_apples_real.jpg',
  'fresh_red_apples.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/fresh_red_apples_real.jpg',
  'fresh_red_apples_real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/fresh_red_apples_real.jpg',
  'apples-real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/apples_real.jpg',
  'apples_real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/apples_real.jpg',
  'fresh-fruits-veggies-hero-transparent.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/fresh_produce_splash_transparent.png',
  'fresh_produce_splash_transparent.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/fresh_produce_splash_transparent.png',
  'lays-cream-onion.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/lays_cream_onion.png',
  'lays_cream_onion.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/lays_cream_onion.png',
  'doritos-nacho.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/doritos_nacho.png',
  'doritos_nacho.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/doritos_nacho.png',
  'lays-magic-masala.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/lays_magic_masala.png',
  'lays_magic_masala.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/lays_magic_masala.png',
  'snack-pringles-1.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/combo_munchies.jpg',
  'lays-sizzlin-hot.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/lays_magic_masala.png',
  'amul-butter-real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/amul_butter_real.jpg',
  'amul_butter_real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/amul_butter_real.jpg',
  'butter-real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/butter_real.jpg',
  'butter_real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/butter_real.jpg',
  'coca-cola-real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/coca_cola_real.jpg',
  'coca_cola_real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/coca_cola_real.jpg',
  'aashirvaad-atta-real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/atta_real.jpg',
  'atta_real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/atta_real.jpg',
  'cadbury-silk-real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/cadbury_silk_real.jpg',
  'cadbury_silk_real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/cadbury_silk_real.jpg',
  'dettol-handwash-real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/dettol_handwash_real.jpg',
  'dettol_handwash_real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/dettol_handwash_real.jpg',
  'surf-excel-real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/surf_excel_real.jpg',
  'surf_excel_real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/surf_excel_real.jpg',
  'deal-banner-household.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/surf_excel_real.jpg',
  'deal_banner_household.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/surf_excel_real.jpg',
  'household.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/surf_excel_real.jpg',
  'household-essentials.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/surf_excel_real.jpg',
  'category-household-essentials.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/surf_excel_real.jpg',
  'oreo-biscuits-real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/oreo_biscuits_real.jpg',
  'oreo_biscuits_real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/oreo_biscuits_real.jpg',
  'fortune-oil-real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/fortune_oil_real.jpg',
  'fortune_oil_real.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/fortune_oil_real.jpg',
  'electronics-hero-banner.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/electronics_hero_cutout.png',
  'electronics_hero_transparent.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/electronics_hero_transparent.png',
  'electronics_hero_cutout.png': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/electronics_hero_cutout.png',
  'sneakers.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/sneakers.jpg',
  'combo-munchies.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/combo_munchies.jpg',
  'combo_munchies.jpg': 'https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/combo_munchies.jpg',
  'category-baby-care.jpg': 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=300',
  'category_baby_care.jpg': 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=300',
  'category-pet-care.jpg': 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=300',
  'category_pet_care.jpg': 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=300',
  'category-beauty-cosmetics.jpg': 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300',
  'category_beauty_cosmetics.jpg': 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300',
  'category-health-wellness.jpg': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300',
  'category_health_wellness.jpg': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300',
  'category-meat-seafood.jpg': 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=300',
  'category_meat_seafood.jpg': 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=300',
  'category-home-kitchen.jpg': 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=300',
  'category_home_kitchen.jpg': 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=300',
  'category-stationery-office.jpg': 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=300',
  'category_stationery_office.jpg': 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=300',
  'category-sports-fitness.jpg': 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=300',
  'category_sports_fitness.jpg': 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=300',
  'category-toys-games.jpg': 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=300',
  'category_toys_games.jpg': 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=300',
  'category-pooja-needs.jpg': 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300',
  'category_pooja_needs.jpg': 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300',
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

  // Ensure path doesn't start with leading slash if concatenating
  const cleanPath = clean.startsWith('/') ? clean.substring(1) : clean;

  // If it's a versioned path like v1234/folder/id, use it directly
  // Otherwise, assume it's in grabit_media folder
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
