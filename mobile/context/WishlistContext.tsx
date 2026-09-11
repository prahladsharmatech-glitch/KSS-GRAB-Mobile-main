import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Product } from '../types';
import { getItem, setItem } from '../services/storage';

interface WishlistContextType {
  wishlist: Product[];
  toggleWishlist: (product: Product) => void;
  isInWishlist: (productId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wishlist, setWishlist] = useState<Product[]>([]);

  useEffect(() => {
    let isMounted = true;
    getItem<Product[]>('grabit_wishlist').then((saved) => {
      if (isMounted && saved && Array.isArray(saved)) {
        setWishlist(saved);
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleWishlist = useCallback((product: Product) => {
    const pIdStr = String(product.id);
    setWishlist((prev) => {
      let updated: Product[];
      if (prev.some((p) => String(p.id) === pIdStr)) {
        updated = prev.filter((p) => String(p.id) !== pIdStr);
      } else {
        updated = [...prev, product];
      }
      setItem('grabit_wishlist', updated);
      return updated;
    });
  }, []);

  const wishlistIdSet = useMemo(() => new Set(wishlist.map((p) => String(p.id))), [wishlist]);
  const isInWishlist = useCallback((productId: string) => wishlistIdSet.has(String(productId)), [wishlistIdSet]);

  const value = useMemo(() => ({
    wishlist,
    toggleWishlist,
    isInWishlist
  }), [wishlist, toggleWishlist, isInWishlist]);

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within WishlistProvider');
  return context;
};
