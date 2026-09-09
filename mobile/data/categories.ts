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
    "id": "all",
    "name": "All",
    "slug": "all",
    "icon": "\ud83d\udecd\ufe0f",
    "image": "https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/fresh_groceries_basket_only.png",
    "itemCount": 142,
    "stock": 7153
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
    "id": 8,
    "name": "Fresh Fruits & Veggies",
    "slug": "produce",
    "icon": "\ud83c\udf4e",
    "image": "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&q=80",
    "itemCount": 7,
    "stock": 410
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
    "icon": "\ud83c\udfa7",
    "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80",
    "itemCount": 5,
    "stock": 180
  },
  {
    "id": 14,
    "name": "Fashion & Accessories",
    "slug": "fashion",
    "icon": "\ud83d\udc5f",
    "image": "https://res.cloudinary.com/hmx3azp6/image/upload/c_fill,w_300,q_auto,f_auto/grabit_media/sneakers.jpg",
    "itemCount": 5,
    "stock": 130
  },
  {
    "id": 15,
    "name": "Baby Care",
    "slug": "baby-care",
    "icon": "\ud83d\udc76",
    "image": "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400&q=80",
    "itemCount": 5,
    "stock": 210
  },
  {
    "id": 16,
    "name": "Pet Care & Food",
    "slug": "pet-care",
    "icon": "\ud83d\udc3e",
    "image": "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&q=80",
    "itemCount": 5,
    "stock": 175
  },
  {
    "id": 17,
    "name": "Beauty & Cosmetics",
    "slug": "beauty-cosmetics",
    "icon": "\ud83d\udc84",
    "image": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80",
    "itemCount": 5,
    "stock": 265
  },
  {
    "id": 18,
    "name": "Health & Wellness",
    "slug": "health-wellness",
    "icon": "\ud83d\udc8a",
    "image": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
    "itemCount": 5,
    "stock": 230
  },
  {
    "id": 19,
    "name": "Meat, Fish & Eggs",
    "slug": "meat-seafood",
    "icon": "\ud83c\udf57",
    "image": "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&q=80",
    "itemCount": 5,
    "stock": 215
  },
  {
    "id": 20,
    "name": "Home & Kitchen",
    "slug": "home-kitchen",
    "icon": "\ud83c\udf73",
    "image": "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&q=80",
    "itemCount": 5,
    "stock": 175
  },
  {
    "id": 21,
    "name": "Stationery & Office",
    "slug": "stationery-office",
    "icon": "\ud83d\udcdd",
    "image": "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=400&q=80",
    "itemCount": 5,
    "stock": 225
  },
  {
    "id": 22,
    "name": "Sports & Fitness",
    "slug": "sports-fitness",
    "icon": "\ud83c\udfcb\ufe0f",
    "image": "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&q=80",
    "itemCount": 5,
    "stock": 180
  },
  {
    "id": 23,
    "name": "Toys & Games",
    "slug": "toys-games",
    "icon": "\ud83e\udde9",
    "image": "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=400&q=80",
    "itemCount": 5,
    "stock": 180
  },
  {
    "id": 24,
    "name": "Pooja & Spiritual",
    "slug": "pooja-needs",
    "icon": "\ud83e\ude94",
    "image": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&q=80",
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
