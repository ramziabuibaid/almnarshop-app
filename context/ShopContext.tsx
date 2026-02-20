'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getProducts, getActiveCampaignWithProducts } from '@/lib/api';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  [key: string]: any;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image?: string;
  image2?: string;
  image3?: string;
  type?: string;
  brand?: string;
  size?: string;
  color?: string;
  description?: string;
  [key: string]: any;
}

interface User {
  id: string;
  email: string;
  name?: string;
  balance?: number;
  Role?: 'Admin' | 'Staff' | 'Customer';
  [key: string]: any;
}

interface ShopContextType {
  cart: CartItem[];
  user: User | null;
  products: Product[];
  loading: boolean;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  logout: () => void;
  setUser: (user: User | null) => void;
  setProducts: (products: Product[]) => void;
  loadProducts: () => Promise<void>;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export function ShopProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Log products changes (only when products are first loaded)
  useEffect(() => {
    if (products.length > 0) {
      console.log('[ShopContext] Products loaded successfully:', products.length);
    }
  }, [products.length]);

  // Mark component as mounted (client-side only)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load user and cart from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedUser = localStorage.getItem('shop_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        // Ensure Role is set, default to Customer
        if (!parsedUser.Role && !parsedUser.role) {
          parsedUser.Role = 'Customer';
        }

        // Check if user data should be kept (if rememberMe was true)
        // localStorage persists indefinitely, so we just restore the user
        // Remove metadata fields before setting user
        const { savedAt, ...userData } = parsedUser;
        setUser(userData);
        console.log('[ShopContext] User restored from localStorage');
      } catch (e) {
        console.error('Failed to parse saved user:', e);
        // Clear corrupted data
        localStorage.removeItem('shop_user');
      }
    }

    // Load cart from localStorage
    const savedCart = localStorage.getItem('shop_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error('Failed to parse saved cart:', e);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined' || !isMounted) return;
    localStorage.setItem('shop_cart', JSON.stringify(cart));
  }, [cart, isMounted]);

  // Save user to localStorage whenever it changes (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined' || !isMounted) return;
    if (user) {
      // Save user data with metadata
      const userDataToSave = {
        ...user,
        savedAt: Date.now(),
        // If rememberMe is true, the data will persist indefinitely
        // If false, we could add expiration logic here if needed
      };
      localStorage.setItem('shop_user', JSON.stringify(userDataToSave));
      console.log('[ShopContext] User saved to localStorage with rememberMe:', user.rememberMe);
    } else {
      localStorage.removeItem('shop_user');
      console.log('[ShopContext] User removed from localStorage');
    }
  }, [user, isMounted]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      console.log('[ShopContext] Loading products...');
      const fetchedProducts = await getProducts({ forStore: true });
      console.log('[ShopContext] Products loaded:', fetchedProducts.length);

      const activeCampaign = await getActiveCampaignWithProducts();
      let finalProducts = fetchedProducts;

      if (activeCampaign && activeCampaign.products && activeCampaign.products.length > 0) {
        console.log('[ShopContext] Found active campaign with products:', activeCampaign.products.length);
        finalProducts = fetchedProducts.map(product => {
          const campaignProduct = activeCampaign.products.find((cp: any) => cp.product_id === product.id || cp.id === product.id);
          if (campaignProduct && campaignProduct.offer_price) {
            return {
              ...product,
              originalPrice: product.SalePrice || product.price || 0,
              campaignPrice: campaignProduct.offer_price
            };
          }
          return product;
        });
      }

      setProducts(finalProducts);
    } catch (error: any) {
      console.error('[ShopContext] Failed to load products:', error?.message || error);
      // Set empty array on error to prevent UI issues
      setProducts([]);
    } finally {
      // Always set loading to false, even if there's an error
      setLoading(false);
    }
  }, []);

  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        return prevCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const logout = () => {
    setUser(null);
    clearCart();
  };

  // Wrapper for setUser to add logging and ensure Role
  const setUserWithLogging = (newUser: User | null) => {
    if (newUser && !newUser.Role && !newUser.role) {
      newUser.Role = 'Customer';
    }
    console.log('[ShopContext] Setting user:', newUser);
    setUser(newUser);
  };

  const value: ShopContextType = {
    cart,
    user,
    products,
    loading,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    logout,
    setUser: setUserWithLogging,
    setProducts,
    loadProducts,
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const context = useContext(ShopContext);
  if (context === undefined) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
}

