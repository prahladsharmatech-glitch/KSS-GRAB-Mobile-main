export type UserRole = 'customer' | 'seller' | 'rider' | 'delivery_agent' | 'delivery_partner' | 'admin';

export interface UserProfile {
  id?: string;
  phone?: string;
  name?: string;
  full_name?: string;
  email?: string;
  role: UserRole;
  store_name?: string;
  avatar_url?: string;
  is_online?: boolean;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  mrp?: number;
  discountPercent?: number;
  weight?: string;
  image: string;
  category: string;
  brand?: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
  deliveryTimeMinutes?: number;
  inStock?: boolean;
  stockCount?: number;
  storeId?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  itemCount?: number;
  subcategories?: string[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Address {
  id?: string;
  label: string;
  street: string;
  city: string;
  zip: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

export interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface Order {
  id: string;
  customer_name?: string;
  customer_phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  status: 'PENDING' | 'PLACED' | 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  payment_method: 'COD' | 'UPI' | 'CARD';
  payment_status: 'PENDING' | 'COMPLETED' | 'FAILED';
  rider_id?: string;
  rider_name?: string;
  rider_phone?: string;
  rider_latitude?: number;
  rider_longitude?: number;
  created_at: string;
  estimated_delivery_time?: string;
}

export interface DeliveryAgent {
  id: string;
  name: string;
  phone: string;
  vehicle_type: 'bike' | 'scooter' | 'ev';
  vehicle_number: string;
  is_online: boolean;
  active_deliveries_count: number;
  rating: number;
  todays_earnings: number;
  completed_deliveries_today: number;
  current_lat?: number;
  current_lng?: number;
}

export interface SellerDashboardStats {
  today_revenue: number;
  total_orders_today: number;
  pending_orders_count: number;
  top_products: { name: string; sales: number }[];
}

export interface AdminMetrics {
  total_users: number;
  total_sellers: number;
  total_riders: number;
  total_orders: number;
  total_revenue: number;
  active_deliveries: number;
}
