import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  const saveTimeoutRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getItem<CartItem[]>('grabit_cart'),
      getItem<Coupon>('grabit_applied_coupon'),
    ]).then(([savedCart, savedCoupon]) => {
      if (!isMounted) return;
      if (savedCart && Array.isArray(savedCart)) {
        setCart(savedCart);
      }
      if (savedCoupon && savedCoupon.code) {
        setAppliedCoupon(savedCoupon);
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Debounced asynchronous storage write to avoid blocking the JS thread on rapid button clicks
  const scheduleStoragePersist = useCallback((updatedCart: CartItem[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setItem('grabit_cart', updatedCart);
    }, 150);
  }, []);

  const addToCart = useCallback((product: Product | Product[], qty = 1) => {
    const productsToAdd = Array.isArray(product) ? product : [product];
    setCart((prevCart) => {
      const updated = [...prevCart];
      productsToAdd.forEach((p) => {
        const pIdStr = String(p.id);
        const existingIndex = updated.findIndex((item) => String(item.product.id) === pIdStr);
        if (existingIndex > -1) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + qty,
          };
        } else {
          updated.push({ product: p, quantity: qty });
        }
      });
      scheduleStoragePersist(updated);
      return updated;
    });
  }, [scheduleStoragePersist]);

  const removeFromCart = useCallback((productId: string) => {
    const pIdStr = String(productId);
    setCart((prevCart) => {
      const updated = prevCart.filter((item) => String(item.product.id) !== pIdStr);
      scheduleStoragePersist(updated);
      return updated;
    });
  }, [scheduleStoragePersist]);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    const pIdStr = String(productId);
    setCart((prevCart) => {
      let updated: CartItem[];
      if (quantity <= 0) {
        updated = prevCart.filter((item) => String(item.product.id) !== pIdStr);
      } else {
        const idx = prevCart.findIndex((item) => String(item.product.id) === pIdStr);
        if (idx > -1) {
          updated = [...prevCart];
          updated[idx] = { ...updated[idx], quantity };
        } else {
          updated = prevCart;
        }
      }
      scheduleStoragePersist(updated);
      return updated;
    });
  }, [scheduleStoragePersist]);

  const clearCart = useCallback(() => {
    setCart([]);
    setAppliedCoupon(null);
    setItem('grabit_cart', []);
    setItem('grabit_applied_coupon', null);
  }, []);

  // Single-pass memoized calculation of cart totals
  const { totalItems, itemTotal, mrpTotal, discount, deliveryFee } = useMemo(() => {
    let tItems = 0;
    let iTotal = 0;
    let mTotal = 0;
    for (let i = 0; i < cart.length; i++) {
      const item = cart[i];
      const q = item.quantity;
      tItems += q;
      iTotal += item.product.price * q;
      const pOrig = (item.product as any).originalPrice || (item.product as any).original_price || (item.product as any).mrp || item.product.price;
      mTotal += pOrig * q;
    }
    const disc = Math.max(0, mTotal - iTotal);
    const dFee = iTotal >= 500 || iTotal === 0 ? 0 : 30;
    return {
      totalItems: tItems,
      itemTotal: iTotal,
      mrpTotal: mTotal,
      discount: disc,
      deliveryFee: dFee,
    };
  }, [cart]);

  // Auto invalidate coupon if conditions no longer met
  useEffect(() => {
    if (!appliedCoupon) return;
    if (appliedCoupon.discountType === 'free_delivery' && (itemTotal >= 500 || deliveryFee === 0)) {
      setAppliedCoupon(null);
      setItem('grabit_applied_coupon', null);
    } else if (appliedCoupon.minOrder && itemTotal < appliedCoupon.minOrder && cart.length > 0) {
      setAppliedCoupon(null);
      setItem('grabit_applied_coupon', null);
    }
  }, [appliedCoupon, itemTotal, deliveryFee, cart.length]);

  const { couponDiscount, toPay } = useMemo(() => {
    let cDiscount = 0;
    if (appliedCoupon && itemTotal >= (appliedCoupon.minOrder || 0)) {
      if (appliedCoupon.discountType === 'fixed') {
        cDiscount = Math.min(appliedCoupon.discountValue, itemTotal);
      } else if (appliedCoupon.discountType === 'free_delivery') {
        cDiscount = deliveryFee;
      }
    }
    return {
      couponDiscount: cDiscount,
      toPay: Math.max(0, itemTotal + deliveryFee - cDiscount),
    };
  }, [appliedCoupon, itemTotal, deliveryFee]);

  const applyCoupon = useCallback((codeToApply: string) => {
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

    if (coupon.discountType === 'free_delivery' && (deliveryFee === 0 || itemTotal >= 500)) {
      return {
        success: false,
        message: 'Your order already qualifies for FREE delivery! No coupon needed.'
      };
    }

    setAppliedCoupon(coupon);
    setItem('grabit_applied_coupon', coupon);
    return { success: true, message: `Coupon "${coupon.code}" applied successfully!` };
  }, [itemTotal, deliveryFee]);

  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setItem('grabit_applied_coupon', null);
  }, []);

  const contextValue = useMemo(() => ({
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
  }), [
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    totalItems,
    itemTotal,
    mrpTotal,
    discount,
    deliveryFee,
    toPay,
    appliedCoupon,
    couponDiscount,
    applyCoupon,
    removeCoupon,
  ]);

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
