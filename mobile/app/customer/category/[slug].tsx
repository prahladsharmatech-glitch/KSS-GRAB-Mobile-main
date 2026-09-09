import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  StyleSheet,
  RefreshControl,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { get } from '../../../services/api';
import { Product } from '../../../types';
import { products as localProducts } from '../../../data/products';
import { ProductCard } from '../../../components/ProductCard';
import { SearchAutocomplete } from '../../../components/SearchAutocomplete';
import { CustomerTopHeader } from '../../../components/CustomerTopHeader';
import { LoadingView } from '../../../components/LoadingView';
import { EmptyState } from '../../../components/EmptyState';
import { useCart } from '../../../context/CartContext';
import { useToast } from '../../../context/ToastContext';
import { COLORS, SPACING, SHADOWS } from '../../../constants/theme';
import { getCanonicalSlug } from '../../../data/categories';
import { getValidImage, optimizeImageUrl, DEFAULT_FALLBACK_IMAGE } from '../../../services/cloudinary';
import {
  ArrowLeft,
  Search,
  MapPin,
  Bell,
  Calendar,
  ChevronDown,
  SlidersHorizontal,
  Sparkles,
  Zap,
  Grid,
  X,
  Check,
} from 'lucide-react-native';

const CATEGORY_TOP_NAV = [
  { id: 'all', label: 'All', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645084/grabit_media/fresh_groceries_basket_only.png', slug: 'all' },
  { id: 'produce', label: 'Fresh', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645128/grabit_media/apples_real.jpg', slug: 'produce' },
  { id: 'dairy-bakery', label: 'Dairy', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645078/grabit_media/butter_real.jpg', slug: 'dairy-bakery' },
  { id: 'snacks-munchies', label: 'Snacks', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645100/grabit_media/lays_magic_masala.png', slug: 'snacks-munchies' },
  { id: 'beverages', label: 'Drinks', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645111/grabit_media/coca_cola_real.jpg', slug: 'beverages' },
  { id: 'staples', label: 'Atta', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645070/grabit_media/atta_real.jpg', slug: 'staples' },
  { id: 'chocolates', label: 'Sweets', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645118/grabit_media/cadbury_silk_real.jpg', slug: 'chocolates' },
  { id: 'personal-care', label: 'Care', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645135/grabit_media/dettol_handwash_real.jpg', slug: 'personal-care' },
  { id: 'household', label: 'Household', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645057/grabit_media/surf_excel_real.jpg', slug: 'household' },
  { id: 'tea-coffee', label: 'Tea & Coffee', image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=300', slug: 'tea-coffee' },
  { id: 'instant-food', label: 'Instant Food', image: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=300', slug: 'instant-food' },
  { id: 'biscuits', label: 'Biscuits', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645050/grabit_media/oreo_biscuits_real.jpg', slug: 'biscuits' },
  { id: 'oil', label: 'Oils & Ghee', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645142/grabit_media/fortune_oil_real.jpg', slug: 'oil' },
  { id: 'electronics', label: 'Electronics', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645110/grabit_media/electronics_hero_transparent.png', slug: 'electronics' },
  { id: 'fashion', label: 'Fashion', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645079/grabit_media/sneakers.jpg', slug: 'fashion' },
  { id: 'baby-care', label: 'Baby Care', image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=300', slug: 'baby-care' },
  { id: 'pet-care', label: 'Pet Care', image: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=300', slug: 'pet-care' },
  { id: 'beauty-cosmetics', label: 'Beauty', image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300', slug: 'beauty-cosmetics' },
  { id: 'health-wellness', label: 'Pharma', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300', slug: 'health-wellness' },
  { id: 'meat-seafood', label: 'Meat & Seafood', image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=300', slug: 'meat-seafood' },
  { id: 'home-kitchen', label: 'Kitchen', image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=300', slug: 'home-kitchen' },
  { id: 'stationery-office', label: 'Stationery', image: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=300', slug: 'stationery-office' },
  { id: 'sports-fitness', label: 'Fitness', image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=300', slug: 'sports-fitness' },
  { id: 'toys-games', label: 'Toys', image: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=300', slug: 'toys-games' },
  { id: 'pooja-needs', label: 'Pooja', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300', slug: 'pooja-needs' },
];

interface SubCategoryConfig {
  id: string;
  label: string;
  image?: string;
}

interface CategoryConfig {
  id: string;
  title: string;
  subtitle: string;
  placeholder: string;
  bannerBg: string;
  bannerTextColor: string;
  bannerSubColor: string;
  badgeBg: string;
  badgeTextColor: string;
  bannerImage: string;
  subcategories: SubCategoryConfig[];
}

const CATEGORY_CONFIGS: Record<string, CategoryConfig> = {
  'produce': {
    id: 'produce',
    title: 'Fresh Fruits & Veggies',
    subtitle: 'Farm fresh fruits, vegetables & healthy eggs delivered fast.',
    placeholder: 'Search fresh apples, tomatoes, bananas...',
    bannerBg: '#064E3B',
    bannerTextColor: '#FFFFFF',
    bannerSubColor: '#D1FAE5',
    badgeBg: 'rgba(255, 255, 255, 0.18)',
    badgeTextColor: '#34D399',
    bannerImage: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645111/grabit_media/fresh_produce_splash_transparent.png',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Fresh Fruits', label: 'Fresh Fruits', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645128/grabit_media/apples_real.jpg' },
      { id: 'Fresh Vegetables', label: 'Fresh Vegetables', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645093/grabit_media/fresh_red_apples_real.jpg' },
    ],
  },
  'dairy-bakery': {
    id: 'dairy-bakery',
    title: 'Dairy & Bakery',
    subtitle: 'Fresh milk, butter, paneer, cheese & daily bakery essentials.',
    placeholder: 'Search Amul butter, milk, paneer, bread...',
    bannerBg: '#FFF3D6',
    bannerTextColor: '#78350F',
    bannerSubColor: '#92400E',
    badgeBg: 'rgba(217, 119, 6, 0.18)',
    badgeTextColor: '#D97706',
    bannerImage: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645098/grabit_media/dairy_hero_transparent.png',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Milk & Butter', label: 'Milk & Butter', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645078/grabit_media/butter_real.jpg' },
      { id: 'Cheese & Paneer', label: 'Cheese & Paneer', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645086/grabit_media/amul_butter_real.jpg' },
      { id: 'Fresh Bread', label: 'Fresh Bread', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645070/grabit_media/brown_bread_real.jpg' },
    ],
  },
  'snacks-munchies': {
    id: 'snacks-munchies',
    title: 'Snacks & Munchies',
    subtitle: 'Crispy, crunchy & delicious snacks for every craving.',
    placeholder: "Search Lay's, Doritos, Kurkure, snacks...",
    bannerBg: '#FFEDD5',
    bannerTextColor: '#0F172A',
    bannerSubColor: '#475569',
    badgeBg: '#FFFFFF',
    badgeTextColor: '#D97706',
    bannerImage: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645062/grabit_media/category_snacks_feast_hero.png',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Potato Chips', label: 'Potato Chips', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645100/grabit_media/lays_magic_masala.png' },
      { id: 'Tortilla & Corn', label: 'Tortilla & Corn', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645101/grabit_media/combo_munchies.jpg' },
      { id: 'Namkeen & Crunch', label: 'Namkeen & Crunch', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645101/grabit_media/combo_munchies.jpg' },
    ],
  },
  'beverages': {
    id: 'beverages',
    title: 'Cold Drinks & Juices',
    subtitle: 'Chilled soft drinks, fruit juices, energy drinks, tea & coffee.',
    placeholder: 'Search Coca-Cola, Real juice, energy drink...',
    bannerBg: '#FFE3E3',
    bannerTextColor: '#991B1B',
    bannerSubColor: '#B91C1C',
    badgeBg: 'rgba(220, 38, 38, 0.15)',
    badgeTextColor: '#E53935',
    bannerImage: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645114/grabit_media/beverages_hero_transparent.png',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Soft Drinks & Sodas', label: 'Soft Drinks & Sodas', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645111/grabit_media/coca_cola_real.jpg' },
      { id: 'Energy Drinks', label: 'Energy Drinks', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645090/grabit_media/red_bull_real.jpg' },
      { id: 'Fruit Juices', label: 'Fruit Juices', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645100/grabit_media/tropicana_juice_real.jpg' },
    ],
  },
  'staples': {
    id: 'staples',
    title: 'Atta, Rice & Dal',
    subtitle: 'Pure chakki atta, basmati rice, pulses, salt & instant noodles.',
    placeholder: 'Search Aashirvaad atta, basmati rice, dal...',
    bannerBg: '#3D1C06',
    bannerTextColor: '#FFFFFF',
    bannerSubColor: '#FDE68A',
    badgeBg: 'rgba(245, 158, 11, 0.2)',
    badgeTextColor: '#F59E0B',
    bannerImage: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645085/grabit_media/staples_hero_cutout.png',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Atta & Flours', label: 'Atta & Flours', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645070/grabit_media/atta_real.jpg' },
      { id: 'Basmati Rice', label: 'Basmati Rice', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645075/grabit_media/fortune_basmati_real.jpg' },
      { id: 'Dals & Pulses', label: 'Dals & Pulses', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645080/grabit_media/toor_dal_real.jpg' },
      { id: 'Salt & Spices', label: 'Salt & Spices', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645085/grabit_media/tata_salt_real.jpg' },
    ],
  },
  'chocolates': {
    id: 'chocolates',
    title: 'Chocolates & Sweets',
    subtitle: 'Delicious chocolates, hazelnut spreads & sweet treats.',
    placeholder: 'Search Dairy Milk, Ferrero Rocher, KitKat...',
    bannerBg: '#4C1D95',
    bannerTextColor: '#FFFFFF',
    bannerSubColor: '#E9D5FF',
    badgeBg: 'rgba(233, 213, 255, 0.2)',
    badgeTextColor: '#E9D5FF',
    bannerImage: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645104/grabit_media/chocolates_hero_cutout.png',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Premium Chocolates', label: 'Premium Chocolates', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645118/grabit_media/cadbury_silk_real.jpg' },
      { id: 'Wafer Bars', label: 'Wafer Bars', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645095/grabit_media/kitkat_real.jpg' },
      { id: 'Spreads & Gifts', label: 'Spreads & Gifts', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645118/grabit_media/cadbury_silk_real.jpg' },
    ],
  },
  'personal-care': {
    id: 'personal-care',
    title: 'Personal Care',
    subtitle: 'Germ protection handwashes, shampoos, soaps & toothpastes.',
    placeholder: 'Search Dettol, Dove, Colgate...',
    bannerBg: '#064E3B',
    bannerTextColor: '#FFFFFF',
    bannerSubColor: '#A7F3D0',
    badgeBg: 'rgba(52, 211, 153, 0.2)',
    badgeTextColor: '#34D399',
    bannerImage: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645089/grabit_media/personal_care_hero_cutout.png',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Handwash & Hygiene', label: 'Handwash & Hygiene', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645135/grabit_media/dettol_handwash_real.jpg' },
      { id: 'Hair Care', label: 'Hair Care', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645076/grabit_media/dettol_real.jpg' },
      { id: 'Bath & Body Soaps', label: 'Bath & Body Soaps', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645048/grabit_media/combo_hygiene.jpg' },
      { id: 'Oral Care & Skin', label: 'Oral Care & Skin', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645076/grabit_media/dettol_real.jpg' },
    ],
  },
  'household': {
    id: 'household',
    title: 'Household Essentials',
    subtitle: 'Detergents, dishwash gels & surface disinfectants.',
    placeholder: 'Search Surf Excel, Vim, Harpic...',
    bannerBg: '#073B6C',
    bannerTextColor: '#FFFFFF',
    bannerSubColor: '#BAE6FD',
    badgeBg: 'rgba(56, 189, 248, 0.2)',
    badgeTextColor: '#38BDF8',
    bannerImage: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645068/grabit_media/household_hero_cutout.png',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Detergents & Wash', label: 'Detergents & Wash', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645057/grabit_media/surf_excel_real.jpg' },
      { id: 'Dishwash & Cleaners', label: 'Dishwash & Cleaners', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645072/grabit_media/surf_real.jpg' },
      { id: 'Disinfectants', label: 'Disinfectants', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645076/grabit_media/dettol_real.jpg' },
    ],
  },
  'biscuits': {
    id: 'biscuits',
    title: 'Biscuits & Cookies',
    subtitle: 'Crispy biscuits, cookies & tea-time snacks.',
    placeholder: 'Search Oreo, Parle-G, Good Day...',
    bannerBg: '#3B1602',
    bannerTextColor: '#FFFFFF',
    bannerSubColor: '#FDE68A',
    badgeBg: 'rgba(245, 158, 11, 0.2)',
    badgeTextColor: '#F59E0B',
    bannerImage: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645098/grabit_media/biscuits_hero_cutout.png',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Cream Biscuits', label: 'Cream Biscuits', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645050/grabit_media/oreo_biscuits_real.jpg' },
      { id: 'Glucose & Cookies', label: 'Glucose & Cookies', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645088/grabit_media/parle_g_real.jpg' },
    ],
  },
  'oil': {
    id: 'oil',
    title: 'Edible Oils & Ghee',
    subtitle: 'Pure sunflower oil, mustard oil & healthy cooking oils.',
    placeholder: 'Search Fortune oil, Ghee...',
    bannerBg: '#452405',
    bannerTextColor: '#FFFFFF',
    bannerSubColor: '#FEF08A',
    badgeBg: 'rgba(250, 204, 21, 0.2)',
    badgeTextColor: '#FACC15',
    bannerImage: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645122/grabit_media/oil_hero_cutout.png',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Sunflower & Mustard Oil', label: 'Sunflower & Mustard Oil', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645142/grabit_media/fortune_oil_real.jpg' },
      { id: 'Pure Desi Ghee', label: 'Pure Desi Ghee', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645142/grabit_media/fortune_oil_real.jpg' },
      { id: 'Olive & Heart Care Oils', label: 'Olive & Heart Care Oils', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645122/grabit_media/oil_hero_cutout.png' },
    ],
  },
  'electronics': {
    id: 'electronics',
    title: 'Electronics & Gadgets',
    subtitle: 'Premium headphones, speakers, smartwatches & audio gear.',
    placeholder: 'Search headphones, speakers, smartwatches...',
    bannerBg: '#171E38',
    bannerTextColor: '#FFFFFF',
    bannerSubColor: '#BAE6FD',
    badgeBg: 'rgba(56, 189, 248, 0.2)',
    badgeTextColor: '#38BDF8',
    bannerImage: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645107/grabit_media/electronics_hero_cutout.png',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Headphones & TWS', label: 'Headphones & TWS', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645110/grabit_media/electronics_hero_transparent.png' },
      { id: 'Bluetooth Speakers', label: 'Bluetooth Speakers', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645107/grabit_media/electronics_hero_cutout.png' },
      { id: 'Smartwatches', label: 'Smartwatches', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645110/grabit_media/electronics_hero_transparent.png' },
    ],
  },
  'fashion': {
    id: 'fashion',
    title: 'Fashion & Accessories',
    subtitle: 'Trendy sneakers, sunglasses, watches & lifestyle items.',
    placeholder: 'Search sneakers, sunglasses, watches...',
    bannerBg: '#4D0922',
    bannerTextColor: '#FFFFFF',
    bannerSubColor: '#FECDD3',
    badgeBg: 'rgba(251, 113, 133, 0.2)',
    badgeTextColor: '#FB7185',
    bannerImage: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645139/grabit_media/fashion_hero_cutout.png',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Men Running Shoes', label: 'Men Running Shoes', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645079/grabit_media/sneakers.jpg' },
      { id: 'Designer Sunglasses', label: 'Designer Sunglasses', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645079/grabit_media/sneakers.jpg' },
      { id: 'Watches & Wallets', label: 'Watches & Wallets', image: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645079/grabit_media/sneakers.jpg' },
    ],
  },
  'baby-care': {
    id: 'baby-care',
    title: 'Baby Care',
    subtitle: 'Pampers diapers, gentle wipes, baby shampoo & infant cereals.',
    placeholder: 'Search diapers, wipes, baby cereal...',
    bannerBg: '#E0F2FE',
    bannerTextColor: '#0F172A',
    bannerSubColor: '#0369A1',
    badgeBg: 'rgba(2, 132, 199, 0.15)',
    badgeTextColor: '#0284C7',
    bannerImage: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=500&q=80',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Diapers & Wipes', label: 'Diapers & Wipes', image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=300&q=80' },
      { id: 'Baby Bath & Skin', label: 'Baby Bath & Skin', image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300&q=80' },
      { id: 'Baby Food & Cereal', label: 'Baby Food & Cereal', image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=300&q=80' },
    ],
  },
  'pet-care': {
    id: 'pet-care',
    title: 'Pet Care & Food',
    subtitle: 'Pedigree dog food, Whiskas cat food, grooming shampoos & treats.',
    placeholder: 'Search Pedigree, Whiskas, dog food...',
    bannerBg: '#FFEDD5',
    bannerTextColor: '#0F172A',
    bannerSubColor: '#C2410C',
    badgeBg: 'rgba(234, 88, 12, 0.15)',
    badgeTextColor: '#EA580C',
    bannerImage: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=500&q=80',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Dog Food & Treats', label: 'Dog Food & Treats', image: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=300&q=80' },
      { id: 'Cat Food', label: 'Cat Food', image: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=300&q=80' },
      { id: 'Pet Grooming', label: 'Pet Grooming', image: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=300&q=80' },
    ],
  },
  'beauty-cosmetics': {
    id: 'beauty-cosmetics',
    title: 'Beauty & Cosmetics',
    subtitle: 'Niacinamide face serums, kajal, sunscreens & moisturizing creams.',
    placeholder: 'Search serum, sunscreen, lipstick...',
    bannerBg: '#FFE4E6',
    bannerTextColor: '#0F172A',
    bannerSubColor: '#BE123C',
    badgeBg: 'rgba(225, 29, 72, 0.15)',
    badgeTextColor: '#E11D48',
    bannerImage: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500&q=80',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Face Serums & Creams', label: 'Face Serums & Creams', image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=300&q=80' },
      { id: 'Sunscreens & Cleansers', label: 'Sunscreens & Cleansers', image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=300&q=80' },
      { id: 'Makeup & Kajal', label: 'Makeup & Kajal', image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300&q=80' },
    ],
  },
  'health-wellness': {
    id: 'health-wellness',
    title: 'Health & Wellness',
    subtitle: 'Dabur chyawanprash, daily multivitamins, pain relief sprays & first aid.',
    placeholder: 'Search vitamins, Volini, Chyawanprash...',
    bannerBg: '#DCFCE7',
    bannerTextColor: '#0F172A',
    bannerSubColor: '#15803D',
    badgeBg: 'rgba(22, 163, 74, 0.15)',
    badgeTextColor: '#16A34A',
    bannerImage: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&q=80',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Immunity & Ayurveda', label: 'Immunity & Ayurveda', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&q=80' },
      { id: 'Vitamins & Supplements', label: 'Vitamins & Supplements', image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=300&q=80' },
      { id: 'Pain Relief & Devices', label: 'Pain Relief & Devices', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&q=80' },
    ],
  },
  'meat-seafood': {
    id: 'meat-seafood',
    title: 'Meat, Fish & Eggs',
    subtitle: 'Farm fresh chicken, pink salmon steaks & country brown eggs.',
    placeholder: 'Search chicken, eggs, fish, prawns...',
    bannerBg: '#FEE2E2',
    bannerTextColor: '#0F172A',
    bannerSubColor: '#B91C1C',
    badgeBg: 'rgba(220, 38, 38, 0.15)',
    badgeTextColor: '#DC2626',
    bannerImage: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=500&q=80',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Fresh Chicken', label: 'Fresh Chicken', image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=300&q=80' },
      { id: 'Farm Eggs', label: 'Farm Eggs', image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=300&q=80' },
      { id: 'Fish & Seafood', label: 'Fish & Seafood', image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=300&q=80' },
    ],
  },
  'home-kitchen': {
    id: 'home-kitchen',
    title: 'Home & Kitchen',
    subtitle: 'Pressure cookers, stainless steel flasks, non-stick pans & glass lunch containers.',
    placeholder: 'Search cookers, pans, bottles...',
    bannerBg: '#FFEDD5',
    bannerTextColor: '#0F172A',
    bannerSubColor: '#C2410C',
    badgeBg: 'rgba(234, 88, 12, 0.15)',
    badgeTextColor: '#EA580C',
    bannerImage: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=500&q=80',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Cookware & Pans', label: 'Cookware & Pans', image: 'https://images.unsplash.com/photo-1584990347449-39b4b0113c51?w=300&q=80' },
      { id: 'Bottles & Flasks', label: 'Bottles & Flasks', image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=300&q=80' },
      { id: 'Storage & Containers', label: 'Storage & Containers', image: 'https://images.unsplash.com/photo-1584990347449-39b4b0113c51?w=300&q=80' },
    ],
  },
  'stationery-office': {
    id: 'stationery-office',
    title: 'Stationery & Office',
    subtitle: 'Classmate spiral notebooks, Parker pens, artistic marker sets & scientific calculators.',
    placeholder: 'Search notebooks, pens, markers...',
    bannerBg: '#DBEAFE',
    bannerTextColor: '#0F172A',
    bannerSubColor: '#1D4ED8',
    badgeBg: 'rgba(37, 99, 235, 0.15)',
    badgeTextColor: '#2563EB',
    bannerImage: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=500&q=80',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Notebooks & Pads', label: 'Notebooks & Pads', image: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=300&q=80' },
      { id: 'Pens & Markers', label: 'Pens & Markers', image: 'https://images.unsplash.com/photo-1585336261026-7f41539e0ebc?w=300&q=80' },
      { id: 'Calculators', label: 'Calculators', image: 'https://images.unsplash.com/photo-1587145820266-a5951ee6f620?w=300&q=80' },
    ],
  },
  'sports-fitness': {
    id: 'sports-fitness',
    title: 'Sports & Fitness',
    subtitle: 'Yonex carbon rackets, MuscleBlaze 100% whey, gym shaker bottles & yoga mats.',
    placeholder: 'Search rackets, whey protein, yoga mats...',
    bannerBg: '#DCFCE7',
    bannerTextColor: '#0F172A',
    bannerSubColor: '#15803D',
    badgeBg: 'rgba(22, 163, 74, 0.15)',
    badgeTextColor: '#16A34A',
    bannerImage: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&q=80',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Rackets & Balls', label: 'Rackets & Balls', image: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=300&q=80' },
      { id: 'Fitness Supplements', label: 'Fitness Supplements', image: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=300&q=80' },
      { id: 'Gym Shakers & Bottles', label: 'Gym Shakers & Bottles', image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=300&q=80' },
    ],
  },
  'toys-games': {
    id: 'toys-games',
    title: 'Toys & Games',
    subtitle: 'LEGO creative bricks, classic Monopoly, Hot Wheels cars & speed Rubik cubes.',
    placeholder: 'Search LEGO, Monopoly, Hot Wheels...',
    bannerBg: '#F3E8FF',
    bannerTextColor: '#0F172A',
    bannerSubColor: '#7E22CE',
    badgeBg: 'rgba(147, 51, 234, 0.15)',
    badgeTextColor: '#9333EA',
    bannerImage: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=500&q=80',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Building Blocks', label: 'Building Blocks', image: 'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?w=300&q=80' },
      { id: 'Board Games & Puzzles', label: 'Board Games & Puzzles', image: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=300&q=80' },
      { id: 'Diecast Cars & Tracks', label: 'Diecast Cars & Tracks', image: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=300&q=80' },
    ],
  },
  'all': {
    id: 'all',
    title: 'All Products & Categories',
    subtitle: 'Explore our complete catalog of farm fresh groceries, snacks, dairy, electronics & daily essentials.',
    placeholder: 'Search all products, brands, categories...',
    bannerBg: '#0F172A',
    bannerTextColor: '#FFFFFF',
    bannerSubColor: '#94A3B8',
    badgeBg: 'rgba(255, 255, 255, 0.18)',
    badgeTextColor: '#38BDF8',
    bannerImage: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645084/grabit_media/fresh_groceries_basket_only.png',
    subcategories: [{ id: 'All', label: 'All' }],
  },
  'tea-coffee': {
    id: 'tea-coffee',
    title: 'Tea, Coffee & Drinks',
    subtitle: 'Nescafe classic coffee, Brooke Bond Red Label tea & gourmet blends.',
    placeholder: 'Search coffee, tea, Nescafe, Red Label...',
    bannerBg: '#451A03',
    bannerTextColor: '#FFFFFF',
    bannerSubColor: '#FDE68A',
    badgeBg: 'rgba(245, 158, 11, 0.2)',
    badgeTextColor: '#F59E0B',
    bannerImage: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=300',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Instant Coffee', label: 'Instant Coffee', image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=300' },
      { id: 'Premium Tea Powder', label: 'Premium Tea Powder', image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=300' },
    ],
  },
  'instant-food': {
    id: 'instant-food',
    title: 'Instant & Frozen Food',
    subtitle: 'Maggi 2-minute noodles, Yippee, Knorr thick soups & MTR ready to eat curries.',
    placeholder: 'Search Maggi, noodles, soups, instant meals...',
    bannerBg: '#7C2D12',
    bannerTextColor: '#FFFFFF',
    bannerSubColor: '#FFEDD5',
    badgeBg: 'rgba(234, 88, 12, 0.2)',
    badgeTextColor: '#FB923C',
    bannerImage: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=300',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Instant Noodles', label: 'Instant Noodles', image: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=300' },
      { id: 'Soups & Chinese', label: 'Soups & Chinese', image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300' },
      { id: 'Ready to Eat Curries', label: 'Ready to Eat Curries', image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=300' },
    ],
  },
  'pooja-needs': {
    id: 'pooja-needs',
    title: 'Pooja & Spiritual Needs',
    subtitle: 'Cycle pure agarbatti, traditional brass diyas, pure camphor crystals & ghee wicks.',
    placeholder: 'Search agarbatti, diyas, camphor...',
    bannerBg: '#FEF3C7',
    bannerTextColor: '#0F172A',
    bannerSubColor: '#B45309',
    badgeBg: 'rgba(217, 119, 6, 0.15)',
    badgeTextColor: '#D97706',
    bannerImage: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300',
    subcategories: [
      { id: 'All', label: 'All' },
      { id: 'Agarbatti & Incense', label: 'Agarbatti & Incense', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300' },
      { id: 'Brass Diyas & Lamps', label: 'Brass Diyas & Lamps', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300' },
      { id: 'Pure Camphor & Wicks', label: 'Pure Camphor & Wicks', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300' },
    ],
  },
};

// Sub-category matching helper logic matching React Web
const matchesSubCategory = (product: Product, subCat: string, categorySlug: string = '') => {
  if (!subCat || subCat === 'All') return true;

  const directSub = (product as any).subCategory || (product as any).sub_category || (product as any).subcategory || '';
  if (directSub && directSub.toLowerCase().trim() === subCat.toLowerCase().trim()) {
    return true;
  }

  const name = String(product.name || '').toLowerCase();
  const sub = subCat.toLowerCase().trim();
  const cat = String(categorySlug || '').toLowerCase().trim();

  // Beverages
  if (cat.includes('beverage') || cat.includes('drink')) {
    if (sub.includes('soft') || sub.includes('soda')) {
      return name.includes('cola') || name.includes('coke') || name.includes('thums up') || name.includes('sprite') || name.includes('fanta') || name.includes('pepsi') || name.includes('limca') || name.includes('soda');
    }
    if (sub.includes('energy')) return name.includes('red bull') || name.includes('monster') || name.includes('energy');
    if (sub.includes('juice') || sub.includes('fruit')) return name.includes('juice') || name.includes('real') || name.includes('tropicana') || name.includes('maaza') || name.includes('frooti');
  }

  // Dairy
  if (cat.includes('dairy') || cat.includes('bakery')) {
    if (sub.includes('milk') || sub.includes('butter')) return name.includes('milk') || (name.includes('butter') && !name.includes('buttermilk')) || name.includes('taaza');
    if (sub.includes('cheese') || sub.includes('paneer')) return name.includes('paneer') || name.includes('cheese') || name.includes('mozzarella');
    if (sub.includes('bread') || sub.includes('bakery')) return name.includes('bread') || name.includes('loaf') || name.includes('sourdough');
  }

  // Produce
  if (cat.includes('produce') || cat.includes('fruit') || cat.includes('veggie')) {
    if (sub.includes('fruit')) return name.includes('apple') || name.includes('banana') || name.includes('mango') || name.includes('grapes') || name.includes('orange');
    if (sub.includes('veggie') || sub.includes('vegetable')) return name.includes('tomato') || name.includes('potato') || name.includes('onion') || name.includes('capsicum') || name.includes('broccoli');
  }

  // Snacks
  if (cat.includes('snack') || cat.includes('munch')) {
    if (sub.includes('potato') || sub.includes('chip')) return name.includes('chip') || name.includes('lays') || name.includes('pringles') || name.includes('bingo');
    if (sub.includes('tortilla') || sub.includes('corn') || sub.includes('nacho')) return name.includes('dorito') || name.includes('nacho');
    if (sub.includes('namkeen') || sub.includes('crunch')) return name.includes('bhujia') || name.includes('kurkure') || name.includes('sev') || name.includes('cashew');
  }

  // Staples
  if (cat.includes('staple') || cat.includes('atta') || cat.includes('rice') || cat.includes('dal')) {
    if (sub.includes('atta') || sub.includes('flour')) return name.includes('atta') || name.includes('flour') || name.includes('aashirvaad');
    if (sub.includes('rice')) return name.includes('rice') || name.includes('basmati') || name.includes('daawat');
    if (sub.includes('dal')) return name.includes('dal') || name.includes('toor') || name.includes('moong');
    if (sub.includes('salt') || sub.includes('spice')) return name.includes('salt') || name.includes('masala');
  }

  // Chocolates
  if (cat.includes('chocolate') || cat.includes('sweet')) {
    if (sub.includes('premium')) return name.includes('silk') || name.includes('dark') || name.includes('ferrero') || name.includes('cadbury');
    if (sub.includes('wafer')) return name.includes('kitkat') || name.includes('munch') || name.includes('snickers');
    if (sub.includes('spread') || sub.includes('gift')) return name.includes('nutella') || name.includes('spread') || name.includes('celebrations');
  }

  const words = sub.split(' ').map(w => w.replace(/es$/, '').replace(/s$/, '')).filter(w => w.length > 2);
  return words.some(w => name.includes(w));
};

export default function CategoryProductsPage() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { showToast } = useToast();

  const [activeCategoryKey, setActiveCategoryKey] = useState<string>('produce');
  const [products, setProducts] = useState<Product[]>(localProducts);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubcat, setSelectedSubcat] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'relevance' | 'low_high' | 'high_low' | 'rating' | 'discount'>('relevance');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(20);
  const lastFetchRef = useRef<number>(0);

  // Reset pagination window when category, subcategory, search, or sort changes
  useEffect(() => {
    setVisibleCount(20);
  }, [activeCategoryKey, selectedSubcat, searchQuery, sortBy]);

  // Detect active category key from slug using canonical mapper
  useEffect(() => {
    const canonical = getCanonicalSlug(slug || '');
    setActiveCategoryKey(canonical || 'produce');
    setSelectedSubcat('All');
    setVisibleCount(20);
  }, [slug]);

  const activeConfig = CATEGORY_CONFIGS[activeCategoryKey] || {
    id: activeCategoryKey,
    title: (slug || 'Category').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    subtitle: `Explore fresh products & top offers in ${slug}.`,
    placeholder: `Search ${slug}...`,
    bannerBg: '#064E3B',
    bannerTextColor: '#FFFFFF',
    bannerSubColor: '#D1FAE5',
    badgeBg: 'rgba(255, 255, 255, 0.18)',
    badgeTextColor: '#34D399',
    bannerImage: 'https://res.cloudinary.com/hmx3azp6/image/upload/v1787645111/grabit_media/fresh_produce_splash_transparent.png',
    subcategories: [{ id: 'All', label: 'All' }],
  };

  const fetchProducts = async () => {
    try {
      const res = await get<any[]>('/products');
      lastFetchRef.current = Date.now();

      let normalized: Product[] = [];
      if (res && Array.isArray(res) && res.length > 0) {
        normalized = res.map((p: any) => {
          const rawCatName =
            (typeof p.categories === 'object' && p.categories?.name)
              ? p.categories.name
              : (Array.isArray(p.categories) && p.categories[0]?.name)
              ? p.categories[0].name
              : p.category || p.category_slug || p.name || '';

          return {
            id: String(p.id),
            name: p.name,
            price: Number(p.price || 0),
            originalPrice: p.originalPrice || p.original_price || Math.round((p.price || 0) * 1.25),
            discountPercent: p.discountPercent || p.discount_percent || 15,
            image: getValidImage(p.image_url || p.image),
            category: getCanonicalSlug(rawCatName),
            inStock: p.inStock ?? (p.stock !== undefined ? p.stock > 0 : true),
            rating: p.rating || 4.8,
            reviewCount: p.reviewCount || p.reviews_count || 120,
            weight: p.weight || '1 pack',
            deliveryTimeMinutes: p.deliveryTimeMinutes || 10,
          };
        });
      }

      // Merge Cloud DB products with local products (DB items prioritized)
      const mergedMap = new Map<string, Product>();
      localProducts.forEach((lp) => mergedMap.set(String(lp.id), lp));
      normalized.forEach((np) => mergedMap.set(String(np.id), np));

      setProducts(Array.from(mergedMap.values()));
    } catch {
      setProducts(localProducts);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [activeCategoryKey, slug]);

  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastFetchRef.current > 30000) {
        fetchProducts();
      }
    }, [activeCategoryKey, slug])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts().finally(() => setRefreshing(false));
  };

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    let list = activeCategoryKey === 'all'
      ? [...products]
      : products.filter((p) => {
          const pCat = getCanonicalSlug(p.category || (p as any).category_slug || (p as any).categories?.name || '');
          return pCat === activeCategoryKey;
        });

    if (list.length === 0) {
      list = activeCategoryKey === 'all'
        ? [...localProducts]
        : localProducts.filter((p) => getCanonicalSlug(p.category || '') === activeCategoryKey);
    }

    // Filter by subcategory chip
    if (selectedSubcat && selectedSubcat !== 'All') {
      list = list.filter((p) => matchesSubCategory(p, selectedSubcat, activeCategoryKey));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      list = list.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase().trim()));
    }

    // Sort
    if (sortBy === 'low_high') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'high_low') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'discount') {
      list.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));
    }

    return list;
  }, [products, activeCategoryKey, selectedSubcat, searchQuery, sortBy]);

  // Paginate first 20 products initially, then append next 20 on scroll
  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 400;
    if (isCloseToBottom && visibleCount < filteredProducts.length) {
      setVisibleCount((prev) => Math.min(prev + 20, filteredProducts.length));
    }
  }, [visibleCount, filteredProducts.length]);

  if (isLoading && products.length === 0) {
    return <LoadingView message={`Fetching ${activeConfig.title}...`} />;
  }

  return (
    <View style={styles.container}>
      {/* 1. Top Header Bar */}
      <CustomerTopHeader />

      <View style={styles.topHeaderContainer}>
        {/* Search Bar Input Row */}
        <View style={styles.searchRow}>
          <Pressable style={styles.searchBackBtn} onPress={() => router.back()}>
            <ArrowLeft size={18} color="#475569" />
          </Pressable>
          <SearchAutocomplete
            placeholder={activeConfig.placeholder}
            onSearchSubmit={(q) => setSearchQuery(q)}
            style={{ flex: 1 }}
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0066FF']} />
        }
      >
        {/* 2. Top Category Pills Strip (23 Categories matching React Web Header) */}
        <View style={styles.topCatContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topCatScroll}>
            {CATEGORY_TOP_NAV.map((cat) => {
              const isActive = activeCategoryKey === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  style={styles.topCatItem}
                  onPress={() => {
                    if (cat.id === 'all') {
                      router.push('/customer/categories' as any);
                    } else {
                      setActiveCategoryKey(cat.id);
                      router.push(`/customer/category/${cat.id}` as any);
                    }
                  }}
                >
                  <View style={[styles.topCatImgCircle, isActive && styles.topCatImgCircleActive]}>
                    <Image
                      source={{ uri: optimizeImageUrl(cat.image, 150) }}
                      style={styles.topCatImg}
                      resizeMode="contain"
                      fadeDuration={0}
                    />
                  </View>
                  <Text style={[styles.topCatText, isActive && styles.topCatTextActive]}>{cat.label}</Text>
                  {isActive ? <View style={styles.activeTopBar} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* 3. Category Hero Banner */}
        <View style={[styles.verticalHeroCard, { backgroundColor: activeConfig.bannerBg }]}>
          <View style={[styles.verticalHeroOfferBadge, { backgroundColor: activeConfig.badgeBg }]}>
            <Sparkles size={13} color={activeConfig.badgeTextColor} style={{ marginRight: 6 }} />
            <Text style={[styles.verticalHeroOfferText, { color: activeConfig.badgeTextColor }]}>
              SPECIAL OFFER • UP TO 30% OFF
            </Text>
          </View>

          <Text style={[styles.verticalHeroTitle, { color: activeConfig.bannerTextColor }]}>
            {activeConfig.title}
          </Text>

          <Text style={[styles.verticalHeroSubtitle, { color: activeConfig.bannerSubColor }]}>
            {activeConfig.subtitle}
          </Text>

          <Image
            source={{ uri: optimizeImageUrl(activeConfig.bannerImage, 600) }}
            style={styles.verticalHeroImg}
            resizeMode="contain"
            fadeDuration={0}
          />
        </View>

        {/* 4. Sub-Category Filter Cards */}
        {activeConfig.subcategories.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subCatRow}>
            {activeConfig.subcategories.map((sub) => {
              const isSelected = selectedSubcat === sub.id;
              return (
                <Pressable
                  key={sub.id}
                  style={[styles.subCatCard, isSelected && styles.subCatCardActive]}
                  onPress={() => setSelectedSubcat(sub.id)}
                >
                  {sub.id === 'All' ? (
                    <View style={styles.subCatIconWrapper}>
                      <Grid size={18} color={isSelected ? '#0066FF' : '#64748B'} />
                    </View>
                  ) : (
                    <Image
                      source={{ uri: optimizeImageUrl(sub.image || '', 200) }}
                      style={styles.subCatThumbImg}
                      resizeMode="contain"
                      fadeDuration={0}
                    />
                  )}
                  <Text style={[styles.subCatText, isSelected && styles.subCatTextActive]} numberOfLines={2}>
                    {sub.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* 5. Products Section Heading & Sort/Filter Controls */}
        <View style={styles.productsSectionHeader}>
          <Text style={styles.sectionHeadingTitle}>Available Products</Text>

          <View style={styles.filterControlsRow}>
            {/* Filter Pill */}
            <Pressable style={styles.filterControlBtn} onPress={() => setIsFilterModalOpen(true)}>
              <SlidersHorizontal size={13} color="#0F172A" style={{ marginRight: 5 }} />
              <Text style={styles.filterControlText}>Filters</Text>
            </Pressable>

            {/* Sort Pill */}
            <Pressable
              style={styles.filterControlBtn}
              onPress={() => {
                const nextSort = sortBy === 'relevance' ? 'low_high' : sortBy === 'low_high' ? 'high_low' : sortBy === 'high_low' ? 'rating' : 'relevance';
                setSortBy(nextSort);
                showToast(`Sorted by: ${nextSort.replace('_', ' ')}`, 'info');
              }}
            >
              <Text style={styles.filterControlText}>
                Sort: <Text style={{ fontWeight: '800' }}>{sortBy === 'relevance' ? 'Relevance' : sortBy === 'low_high' ? 'Price: Low' : sortBy === 'high_low' ? 'Price: High' : 'Rating'}</Text>
              </Text>
              <ChevronDown size={13} color="#0F172A" style={{ marginLeft: 4 }} />
            </Pressable>
          </View>
        </View>

        {/* 6. Product Grid */}
        {filteredProducts.length === 0 ? (
          <EmptyState
            title={`No items found in ${activeConfig.title}`}
            subtitle="Try clearing your search query or subcategory filter."
            actionText="Clear Filters"
            onAction={() => {
              setSearchQuery('');
              setSelectedSubcat('All');
            }}
          />
        ) : (
          <>
            <View style={styles.gridContainer}>
              {visibleProducts.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </View>

            {visibleCount < filteredProducts.length && (
              <Pressable
                style={styles.loadMoreBtn}
                onPress={() => setVisibleCount((prev) => Math.min(prev + 20, filteredProducts.length))}
              >
                <Text style={styles.loadMoreText}>
                  Showing {visibleCount} of {filteredProducts.length} items • Load Next 20
                </Text>
              </Pressable>
            )}
          </>
        )}

        {/* 7. Suggest a Product Banner */}
        <View style={styles.suggestCardContainer}>
          <Image
            source={require('../../../assets/suggest-product-3d.png')}
            style={styles.suggest3dGraphic}
            resizeMode="contain"
          />

          <View style={styles.suggestBadgeRow}>
            <Zap size={11} color="#0066FF" style={{ marginRight: 4 }} />
            <Text style={styles.suggestBadgeText}>REQUEST AN ITEM</Text>
          </View>

          <Text style={styles.suggestTitle}>
            Missing your favorite product in {activeConfig.title}?
          </Text>

          <Text style={styles.suggestSubtitle}>
            Tell us what item you'd like to see in {activeConfig.title} and our sourcing team will endeavor to stock it!
          </Text>

          <Pressable
            style={styles.suggestSubmitBtn}
            onPress={() => showToast('Thank you! Item suggestion recorded.', 'success')}
          >
            <Sparkles size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.suggestSubmitText}>Suggest Product</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Filter Modal */}
      <Modal visible={isFilterModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <Pressable style={styles.closeModalBtn} onPress={() => setIsFilterModalOpen(false)}>
              <X size={18} color="#0F172A" />
            </Pressable>

            <Text style={styles.modalTitle}>Filter & Sort Products</Text>

            <Text style={styles.filterSectionTitle}>Subcategory Filter</Text>
            <View style={styles.subcatFilterGrid}>
              {activeConfig.subcategories.map((sub) => (
                <Pressable
                  key={sub.id}
                  style={[styles.filterChip, selectedSubcat === sub.id && styles.filterChipActive]}
                  onPress={() => setSelectedSubcat(sub.id)}
                >
                  <Text style={[styles.filterChipText, selectedSubcat === sub.id && styles.filterChipTextActive]}>
                    {sub.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.filterSectionTitle}>Sort By</Text>
            <View style={styles.subcatFilterGrid}>
              {[
                { id: 'relevance', label: 'Relevance' },
                { id: 'low_high', label: 'Price: Low to High' },
                { id: 'high_low', label: 'Price: High to Low' },
                { id: 'rating', label: 'Rating: High to Low' },
                { id: 'discount', label: 'Discount: High to Low' },
              ].map((opt) => (
                <Pressable
                  key={opt.id}
                  style={[styles.filterChip, sortBy === opt.id && styles.filterChipActive]}
                  onPress={() => setSortBy(opt.id as any)}
                >
                  <Text style={[styles.filterChipText, sortBy === opt.id && styles.filterChipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.applyFilterBtn} onPress={() => setIsFilterModalOpen(false)}>
              <Text style={styles.applyFilterBtnText}>Apply Filters</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeaderContainer: {
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    ...SHADOWS.sm,
    zIndex: 10,
  },
  topLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  headerLogo: {
    width: 70,
    height: 24,
  },
  headerLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    maxWidth: '55%',
  },
  headerLocText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  searchBackBtn: {
    padding: 6,
    marginRight: 4,
  },
  searchInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  scrollContent: {
    paddingBottom: 80,
  },

  /* Top Category Strip */
  topCatContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#DCFCE7',
  },
  topCatScroll: {
    paddingHorizontal: SPACING.md,
  },
  topCatItem: {
    alignItems: 'center',
    marginRight: 14,
    position: 'relative',
    paddingBottom: 4,
  },
  topCatImgCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginBottom: 4,
    padding: 4,
  },
  topCatImgCircleActive: {
    borderColor: '#22C55E',
    borderWidth: 2,
  },
  topCatImg: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  topCatText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  topCatTextActive: {
    color: '#22C55E',
    fontWeight: '900',
  },
  activeTopBar: {
    position: 'absolute',
    bottom: 0,
    width: 20,
    height: 3,
    backgroundColor: '#22C55E',
    borderRadius: 2,
  },

  /* Hero Banner */
  verticalHeroCard: {
    borderRadius: 22,
    margin: SPACING.md,
    padding: 20,
    minHeight: 280,
    alignItems: 'flex-start',
    position: 'relative',
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  verticalHeroOfferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  verticalHeroOfferText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  verticalHeroTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  verticalHeroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 15,
  },
  verticalHeroImg: {
    width: '100%',
    height: 180,
    alignSelf: 'center',
  },

  /* Sub-Category Filter Cards */
  subCatRow: {
    paddingHorizontal: SPACING.md,
    gap: 10,
    marginBottom: 16,
  },
  subCatCard: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 6,
    ...SHADOWS.sm,
  },
  subCatCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#22C55E',
    borderWidth: 2,
  },
  subCatIconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  subCatThumbImg: {
    width: 22,
    height: 22,
  },
  subCatText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  subCatTextActive: {
    color: '#22C55E',
    fontWeight: '900',
  },

  /* Products Header & Controls */
  productsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    marginBottom: 12,
  },
  sectionHeadingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  filterControlsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterControlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  filterControlText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },

  /* Grid Layout */
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    justifyContent: 'space-between',
  },

  /* Suggest a Product Banner */
  suggestCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    margin: SPACING.md,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.md,
    marginTop: 16,
  },
  suggest3dGraphic: {
    width: 90,
    height: 80,
    marginBottom: 8,
  },
  suggestBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  suggestBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0066FF',
    letterSpacing: 0.5,
  },
  suggestTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  suggestSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  suggestSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0066FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    ...SHADOWS.md,
  },
  suggestSubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContentCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    position: 'relative',
  },
  closeModalBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 16,
  },
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
    marginTop: 10,
  },
  subcatFilterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  filterChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#22C55E',
    borderWidth: 1.5,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#22C55E',
    fontWeight: '900',
  },
  applyFilterBtn: {
    backgroundColor: '#0066FF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  applyFilterBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  loadMoreBtn: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.md,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    color: '#0066FF',
    fontWeight: '800',
    fontSize: 13,
  },
});
