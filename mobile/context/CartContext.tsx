import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, Product } from '../types';
import { getItem, setItem } from '../services/storage';

export interface Coupon {
  code: string;
  title: string;
  description: string;
  minOrder: number;
  discountType: 'fixed' | 'free_delivery';
  discountValue: number;
  badge: string;
}

export const AVAILABLE_COUPONS: Coupon[] = [
  {
    code: 'GRABIT50',
    title: '₹50 Instant Discount',
    description: 'Get Flat ₹50 OFF on orders above ₹149',
    minOrder: 149,
    discountType: 'fixed',
    discountValue: 50,
    badge: 'POPULAR'
  },
  {
    code: 'WELCOME100',
    title: '₹100 New User Discount',
    description: 'Get Flat ₹100 OFF on orders above ₹299',
    minOrder: 299,
    discountType: 'fixed',
    discountValue: 100,
    badge: 'NEW USER'
  },
  {
    code: 'SAVEMORE',
    title: '₹20 Promo Discount',
    description: 'Flat ₹20 OFF on orders above ₹99',
    minOrder: 99,
    discountType: 'fixed',
    discountValue: 20,
    badge: 'PROMO'
  },
  {
    code: 'FREESHIP',
    title: 'Free Express Delivery',
    description: 'Waive ₹30 express delivery fee on your order',
    minOrder: 0,
    discountType: 'free_delivery',
    discountValue: 30,
    badge: 'FREE DELIVERY'
  }
];

interface CartContextType {
  cart: CartItem[];
  items: CartItem[];
  addToCart: (product: Product | Product[], qty?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalAmount: number;
  itemTotal: number;
  mrpTotal: number;
  discount: number;
  deliveryFee: number;
  toPay: number;
  appliedCoupon: Coupon | null;
  couponDiscount: number;
  discountAmount: number;
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;
  AVAILABLE_COUPONS: Coupon[];
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    const saved = await getItem<CartItem[]>('grabit_cart');
    if (saved && Array.isArray(saved)) {
      setCart(saved);
    }
    const savedCoupon = await getItem<Coupon>('grabit_applied_coupon');
    if (savedCoupon && savedCoupon.code) {
      setAppliedCoupon(savedCoupon);
    }
  };

  const persistCart = async (newCart: CartItem[]) => {
    setCart(newCart);
    await setItem('grabit_cart', newCart);
  };

  const addToCart = (product: Product | Product[], qty = 1) => {
    const productsToAdd = Array.isArray(product) ? product : [product];
    let updatedCart = [...cart];

    productsToAdd.forEach((p) => {
      const existingIndex = updatedCart.findIndex((item) => String(item.product.id) === String(p.id));
      if (existingIndex > -1) {
        updatedCart[existingIndex] = {
          ...updatedCart[existingIndex],
          quantity: updatedCart[existingIndex].quantity + qty,
        };
      } else {
        updatedCart.push({ product: p, quantity: qty });
      }
    });

    persistCart(updatedCart);
  };

  const removeFromCart = (productId: string) => {
    const updated = cart.filter((item) => item.product.id !== productId);
    persistCart(updated);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    const updated = cart.map((item) =>
      item.product.id === productId ? { ...item, quantity } : item
    );
    persistCart(updated);
  };

  const clearCart = () => {
    setCart([]);
    setAppliedCoupon(null);
    Promise.all([
      setItem('grabit_cart', []),
      setItem('grabit_applied_coupon', null),
    ]).catch((e) => console.warn('Cart clearing storage error:', e));
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const itemTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const mrpTotal = cart.reduce((sum, item) => sum + (item.product.originalPrice || item.product.price) * item.quantity, 0);
  const discount = Math.max(0, mrpTotal - itemTotal);

  const deliveryFee = itemTotal >= 100 || itemTotal === 0 ? 0 : 30;

  // Auto invalidate coupon if conditions no longer met
  useEffect(() => {
    if (!appliedCoupon) return;
    if (appliedCoupon.discountType === 'free_delivery' && (itemTotal >= 100 || deliveryFee === 0)) {
      setAppliedCoupon(null);
      setItem('grabit_applied_coupon', null);
    } else if (appliedCoupon.minOrder && itemTotal < appliedCoupon.minOrder && cart.length > 0) {
      setAppliedCoupon(null);
      setItem('grabit_applied_coupon', null);
    }
  }, [appliedCoupon, itemTotal, deliveryFee, cart.length]);

  let couponDiscount = 0;
  if (appliedCoupon && itemTotal >= (appliedCoupon.minOrder || 0)) {
    if (appliedCoupon.discountType === 'fixed') {
      couponDiscount = Math.min(appliedCoupon.discountValue, itemTotal);
    } else if (appliedCoupon.discountType === 'free_delivery') {
      couponDiscount = deliveryFee;
    }
  }

  const toPay = Math.max(0, itemTotal + deliveryFee - couponDiscount);

  const applyCoupon = (codeToApply: string) => {
    if (!codeToApply || !codeToApply.trim()) {
      return { success: false, message: 'Please enter a valid coupon code' };
    }
    const cleanCode = codeToApply.trim().toUpperCase();
    let coupon = AVAILABLE_COUPONS.find(c => c.code === cleanCode);
    if (!coupon) {
      if (cleanCode === 'SAVEMORE' || cleanCode === 'GRABIT20') {
        coupon = {
          code: cleanCode,
          title: '₹20 Promo Discount',
          description: 'Flat ₹20 OFF on your order',
          minOrder: 99,
          discountType: 'fixed',
          discountValue: 20,
          badge: 'PROMO'
        };
      } else {
        return { success: false, message: `Invalid coupon code "${cleanCode}"` };
      }
    }

    if (itemTotal < coupon.minOrder) {
      const diff = coupon.minOrder - itemTotal;
      return { success: false, message: `Add ₹${diff} more items to apply code ${cleanCode}` };
    }

    if (coupon.discountType === 'free_delivery' && (deliveryFee === 0 || itemTotal >= 100)) {
      return {
        success: false,
        message: 'Your order already qualifies for FREE delivery! No coupon needed.'
      };
    }

    setAppliedCoupon(coupon);
    setItem('grabit_applied_coupon', coupon);
    return { success: true, message: `Coupon "${coupon.code}" applied successfully!` };
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setItem('grabit_applied_coupon', null);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        items: cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalAmount: itemTotal,
        itemTotal,
        mrpTotal,
        discount,
        deliveryFee,
        toPay,
        appliedCoupon,
        couponDiscount,
        discountAmount: couponDiscount,
        applyCoupon,
        removeCoupon,
        AVAILABLE_COUPONS,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
