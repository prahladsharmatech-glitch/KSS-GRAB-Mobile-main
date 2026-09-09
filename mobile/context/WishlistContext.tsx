import React, { createContext, useContext, useState, useEffect } from 'react';
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
    loadWishlist();
  }, []);

  const loadWishlist = async () => {
    const saved = await getItem<Product[]>('grabit_wishlist');
    if (saved && Array.isArray(saved)) setWishlist(saved);
  };

  const toggleWishlist = async (product: Product) => {
    let updated: Product[];
    if (wishlist.some((p) => p.id === product.id)) {
      updated = wishlist.filter((p) => p.id !== product.id);
    } else {
      updated = [...wishlist, product];
    }
    setWishlist(updated);
    await setItem('grabit_wishlist', updated);
  };

  const isInWishlist = (productId: string) => wishlist.some((p) => p.id === productId);

  return (
    <WishlistContext.Provider value={{ wishlist, toggleWishlist, isInWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within WishlistProvider');
  return context;
};
