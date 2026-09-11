export interface CategoryItem {
  id: string | number;
  name: string;
  slug: string;
  icon: string;
  image?: string;
  itemCount?: number;
  stock?: number;
}

export const baseCloudinaryCategories: CategoryItem[] = [
  {
    "id": 8,
    "name": "Fresh Fruits & Veggies",
    "slug": "produce",
    "icon": "🍎",
    "image": "https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/fresh_produce_splash_transparent.png",
    "itemCount": 15,
    "stock": 410
  },
  {
    "id": 1,
    "name": "Snacks & Munchies",
    "slug": "snacks-munchies",
    "icon": "\ud83c\udf7f",
    "image": "https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/combo_munchies.jpg",
    "itemCount": 12,
    "stock": 695
  },
  {
    "id": 2,
    "name": "Dairy & Bakery",
    "slug": "dairy-bakery",
    "icon": "\ud83e\uddc8",
    "image": "https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/combo_cheese.jpg",
    "itemCount": 9,
    "stock": 470
  },
  {
    "id": 3,
    "name": "Cold Drinks & Juices",
    "slug": "beverages",
    "icon": "\ud83e\udd64",
    "image": "https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/coca_cola_real.jpg",
    "itemCount": 6,
    "stock": 415
  },
  {
    "id": 4,
    "name": "Atta, Rice & Dal",
    "slug": "staples",
    "icon": "\ud83c\udf3e",
    "image": "https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/combo_staples.jpg",
    "itemCount": 7,
    "stock": 385
  },
  {
    "id": 5,
    "name": "Chocolates & Sweets",
    "slug": "chocolates",
    "icon": "\ud83c\udf6b",
    "image": "https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/combo_sweets.jpg",
    "itemCount": 7,
    "stock": 328
  },
  {
    "id": 6,
    "name": "Personal Care",
    "slug": "personal-care",
    "icon": "\ud83e\uddfc",
    "image": "https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/combo_hygiene.jpg",
    "itemCount": 5,
    "stock": 265
  },
  {
    "id": 7,
    "name": "Household Essentials",
    "slug": "household",
    "icon": "\ud83e\uddf9",
    "image": "https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/surf_excel_real.jpg",
    "itemCount": 5,
    "stock": 280
  },
  {
    "id": 9,
    "name": "Tea, Coffee & Drinks",
    "slug": "tea-coffee",
    "icon": "\u2615",
    "image": "https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/combo_tea.jpg",
    "itemCount": 6,
    "stock": 300
  },
  {
    "id": 10,
    "name": "Biscuits & Cookies",
    "slug": "biscuits",
    "icon": "\ud83c\udf6a",
    "image": "https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/oreo_biscuits_real.jpg",
    "itemCount": 6,
    "stock": 460
  },
  {
    "id": 11,
    "name": "Instant & Frozen Food",
    "slug": "instant-food",
    "icon": "\ud83c\udf5c",
    "image": "https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/maggi_noodles_real.jpg",
    "itemCount": 6,
    "stock": 330
  },
  {
    "id": 12,
    "name": "Edible Oils & Ghee",
    "slug": "oil",
    "icon": "\ud83d\udee2\ufe0f",
    "image": "https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/fortune_oil_real.jpg",
    "itemCount": 6,
    "stock": 300
  },
  {
    "id": 13,
    "name": "Electronics & Gadgets",
    "slug": "electronics",
    "icon": "🎧",
    "image": "electronics-hero-banner.jpg",
    "itemCount": 5,
    "stock": 180
  },
  {
    "id": 14,
    "name": "Fashion & Accessories",
    "slug": "fashion",
    "icon": "👟",
    "image": "sneakers.jpg",
    "itemCount": 5,
    "stock": 130
  },
  {
    "id": 15,
    "name": "Baby Care",
    "slug": "baby-care",
    "icon": "👶",
    "image": "category-baby-care.jpg",
    "itemCount": 5,
    "stock": 210
  },
  {
    "id": 16,
    "name": "Pet Care & Food",
    "slug": "pet-care",
    "icon": "🐾",
    "image": "category-pet-care.jpg",
    "itemCount": 5,
    "stock": 175
  },
  {
    "id": 17,
    "name": "Beauty & Cosmetics",
    "slug": "beauty-cosmetics",
    "icon": "💄",
    "image": "category-beauty-cosmetics.jpg",
    "itemCount": 5,
    "stock": 265
  },
  {
    "id": 18,
    "name": "Health & Wellness",
    "slug": "health-wellness",
    "icon": "💊",
    "image": "category-health-wellness.jpg",
    "itemCount": 5,
    "stock": 230
  },
  {
    "id": 19,
    "name": "Meat, Fish & Eggs",
    "slug": "meat-seafood",
    "icon": "🍗",
    "image": "category-meat-seafood.jpg",
    "itemCount": 5,
    "stock": 215
  },
  {
    "id": 20,
    "name": "Home & Kitchen",
    "slug": "home-kitchen",
    "icon": "🍳",
    "image": "category-home-kitchen.jpg",
    "itemCount": 5,
    "stock": 175
  },
  {
    "id": 21,
    "name": "Stationery & Office",
    "slug": "stationery-office",
    "icon": "📝",
    "image": "category-stationery-office.jpg",
    "itemCount": 5,
    "stock": 225
  },
  {
    "id": 22,
    "name": "Sports & Fitness",
    "slug": "sports-fitness",
    "icon": "🏋️",
    "image": "category-sports-fitness.jpg",
    "itemCount": 5,
    "stock": 180
  },
  {
    "id": 23,
    "name": "Toys & Games",
    "slug": "toys-games",
    "icon": "🧩",
    "image": "category-toys-games.jpg",
    "itemCount": 5,
    "stock": 180
  },
  {
    "id": 24,
    "name": "Pooja & Spiritual",
    "slug": "pooja-needs",
    "icon": "🪔",
    "image": "category-pooja-needs.jpg",
    "itemCount": 5,
    "stock": 350
  }
];

export const categories: CategoryItem[] = baseCloudinaryCategories;

export function getCanonicalSlug(slug: string): string {
  if (!slug) return 'produce';
  const clean = slug.toLowerCase().trim();
  if (clean === 'all') return 'all';
  if (clean === 'produce' || clean === 'fresh-produce' || clean === 'fruits-veggies' || clean === 'fresh' || clean.includes('fruit') || clean.includes('veggie') || clean.includes('produce')) return 'produce';
  if (clean === 'dairy' || clean === 'dairy-bakery' || clean.includes('dairy') || clean.includes('bakery')) return 'dairy-bakery';
  if (clean === 'snacks' || clean === 'snacks-munchies' || clean.includes('snack') || clean.includes('munch')) return 'snacks-munchies';
  if (clean === 'drinks' || clean === 'beverages' || clean === 'cold-drinks' || clean.includes('drink') || clean.includes('beverage')) return 'beverages';
  if (clean === 'tea' || clean === 'coffee' || clean === 'tea-coffee' || clean.includes('tea') || clean.includes('coffee')) return 'tea-coffee';
  if (clean === 'instant' || clean === 'noodles' || clean === 'instant-food' || clean.includes('instant') || clean.includes('noodle')) return 'instant-food';
  if (clean === 'atta' || clean === 'staples' || clean.includes('atta') || clean.includes('rice') || clean.includes('dal') || clean.includes('staple')) return 'staples';
  if (clean === 'sweets' || clean === 'chocolates' || clean.includes('chocolate') || clean.includes('sweet')) return 'chocolates';
  if (clean === 'care' || clean === 'personal-care' || clean.includes('personal')) return 'personal-care';
  if (clean === 'household' || clean === 'household-essentials' || clean.includes('house')) return 'household';
  if (clean === 'biscuits' || clean === 'biscuits-cookies' || clean.includes('biscuit') || clean.includes('cookie')) return 'biscuits';
  if (clean === 'oils' || clean === 'oil' || clean === 'edible-oils-ghee' || clean.includes('oil') || clean.includes('ghee')) return 'oil';
  if (clean === 'electronics' || clean === 'electronics-gadgets' || clean.includes('electronic')) return 'electronics';
  if (clean === 'fashion' || clean === 'fashion-accessories' || clean.includes('fashion')) return 'fashion';
  if (clean === 'baby' || clean === 'baby-care' || clean.includes('baby')) return 'baby-care';
  if (clean === 'pet' || clean === 'pet-care' || clean.includes('pet')) return 'pet-care';
  if (clean === 'beauty' || clean === 'beauty-cosmetics' || clean.includes('beauty') || clean.includes('cosmetic')) return 'beauty-cosmetics';
  if (clean === 'pharma' || clean === 'health-wellness' || clean === 'wellness' || clean.includes('pharma') || clean.includes('health')) return 'health-wellness';
  if (clean === 'meat' || clean === 'meat-seafood' || clean === 'chicken-meat' || clean === 'meat-fish' || clean.includes('meat') || clean.includes('chicken') || clean.includes('seafood')) return 'meat-seafood';
  if (clean === 'kitchen' || clean === 'home-kitchen' || clean.includes('kitchen')) return 'home-kitchen';
  if (clean === 'stationery' || clean === 'stationery-office' || clean.includes('stationery')) return 'stationery-office';
  if (clean === 'fitness' || clean === 'sports-fitness' || clean === 'sports' || clean.includes('sport') || clean.includes('fitness')) return 'sports-fitness';
  if (clean === 'toys' || clean === 'toys-games' || clean.includes('toy') || clean.includes('game')) return 'toys-games';
  if (clean === 'pooja' || clean === 'pooja-needs' || clean.includes('pooja')) return 'pooja-needs';
  return clean;
}
