'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, ShoppingCart, User, Loader2, Image as ImageIcon } from 'lucide-react';
import { useShop } from '@/context/ShopContext';
import Image from 'next/image';
import CartDrawer from '@/components/CartDrawer';
import { getDirectImageUrl } from '@/lib/utils';
import Link from 'next/link';

interface StoreHeaderProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onFilterClick?: () => void;
  filterActiveCount?: number;
  showSearch?: boolean;
}

export default function StoreHeader({
  searchQuery = '',
  onSearchChange,
  onFilterClick,
  filterActiveCount = 0,
  showSearch = true,
}: StoreHeaderProps) {
  const { cart, user, products } = useShop();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Show search results only in product pages (when onSearchChange is not provided)
  const shouldShowSearchResults = !onSearchChange;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false);
        setIsSearchFocused(false);
      }
    };

    if (shouldShowSearchResults && isSearchFocused) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isSearchFocused, shouldShowSearchResults]);

  const cartItemCount = isMounted ? cart.reduce((sum, item) => sum + item.quantity, 0) : 0;

  // Filter products based on search query
  const searchResults = useMemo(() => {
    if (!shouldShowSearchResults || !localSearchQuery.trim() || products.length === 0) {
      return [];
    }

    const query = localSearchQuery.toLowerCase().trim();
    const searchWords = query.split(/\s+/).filter((word) => word.length > 0);

    return products
      .filter((p) => {
        const name = String(p.name || p.Name || '').toLowerCase();
        const brand = String(p.brand || p.Brand || '').toLowerCase();
        const type = String(p.type || p.Type || '').toLowerCase();
        const id = String(p.id || p.ProductID || '').toLowerCase();
        const searchableText = `${name} ${brand} ${type} ${id}`;
        return searchWords.every((word) => searchableText.includes(word));
      })
      .slice(0, 8); // Limit to 8 results
  }, [localSearchQuery, products, shouldShowSearchResults]);

  const handleSearchChange = (query: string) => {
    setLocalSearchQuery(query);
    if (onSearchChange) {
      onSearchChange(query);
    } else {
      // In product pages, show search results
      setShowSearchResults(query.trim().length > 0);
    }
  };

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
    if (shouldShowSearchResults && localSearchQuery.trim()) {
      setShowSearchResults(true);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localSearchQuery.trim()) {
      router.push(`/?search=${encodeURIComponent(localSearchQuery)}`);
      setShowSearchResults(false);
      setIsSearchFocused(false);
    } else {
      router.push('/');
    }
  };

  const handleSearchBlur = () => {
    // Delay hiding results to allow clicking on them
    setTimeout(() => {
      if (!searchContainerRef.current?.contains(document.activeElement)) {
        setShowSearchResults(false);
        setIsSearchFocused(false);
      }
    }, 200);
  };

  const handleProductClick = () => {
    setShowSearchResults(false);
    setIsSearchFocused(false);
    setLocalSearchQuery('');
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Company Logo (Just Name) */}
            <div className="flex-shrink-0">
              <button
                onClick={() => router.push('/')}
                className="cursor-pointer"
              >
                <Image
                  src="/logo just name.png"
                  alt="ALMNAR"
                  width={120}
                  height={40}
                  className="h-8 md:h-10 w-auto object-contain"
                  priority
                />
              </button>
            </div>

            {/* Search Bar */}
            {showSearch && (
              <div ref={searchContainerRef} className="flex-1 relative">
                <form onSubmit={handleSearchSubmit}>
                  <Search
                    size={20}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10"
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="بحث عن منتجات..."
                    value={localSearchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={handleSearchFocus}
                    onBlur={handleSearchBlur}
                    className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-gray-900 placeholder:text-gray-500 text-right"
                    dir="rtl"
                  />
                </form>

                {/* Search Results Dropdown - Only in product pages */}
                {shouldShowSearchResults && showSearchResults && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto" dir="rtl">
                    <div className="p-2">
                      <div className="text-xs font-semibold text-gray-500 px-2 py-1 mb-1">
                        نتائج البحث ({searchResults.length})
                      </div>
                      {searchResults.map((product) => {
                        const productId = product.id || product.ProductID || '';
                        const productName = product.name || product.Name || '';
                        const productPrice = product.price || product.SalePrice || 0;
                        const imageUrl = getDirectImageUrl(product.image || product.Image || '');

                        return (
                          <Link
                            key={productId}
                            href={`/product/${encodeURIComponent(productId)}`}
                            onClick={handleProductClick}
                            className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-b-0"
                          >
                            {imageUrl ? (
                              <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                                <img
                                  src={imageUrl}
                                  alt={productName}
                                  className="object-contain w-full h-full"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <ImageIcon size={24} className="text-gray-300" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-gray-900 text-sm line-clamp-1 mb-1">
                                {productName}
                              </h3>
                              {product.brand && (
                                <p className="text-xs text-gray-500 mb-1">
                                  {product.brand}
                                </p>
                              )}
                              <p className="text-sm font-semibold text-gray-900">
                                ₪{productPrice.toFixed(2)}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                      {searchResults.length >= 8 && (
                        <Link
                          href={`/?search=${encodeURIComponent(localSearchQuery)}`}
                          onClick={handleProductClick}
                          className="block text-center py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg border-t border-gray-200 mt-2"
                        >
                          عرض جميع النتائج
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {/* No Results Message */}
                {shouldShowSearchResults && showSearchResults && localSearchQuery.trim() && searchResults.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 p-4" dir="rtl">
                    <p className="text-sm text-gray-600 text-center">
                      لم يتم العثور على منتجات
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Filter Button - Mobile only */}
            {onFilterClick && showSearch && (
              <button
                onClick={onFilterClick}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors relative"
                aria-label="Filter"
              >
                <Filter size={24} className="text-gray-700" />
                {filterActiveCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-gray-900 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {filterActiveCount}
                  </span>
                )}
              </button>
            )}

            {/* Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Cart"
            >
              <ShoppingCart size={24} className="text-gray-700" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-gray-900 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </button>

            {/* Admin Panel Button - Only for Admin users */}
            {user && (user.Role === 'Admin' || user.role === 'Admin') && (
              <button
                onClick={() => router.push('/admin')}
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm"
              >
                <span>Admin Panel</span>
              </button>
            )}

            {/* Profile Button */}
            <button
              onClick={() => router.push(user ? '/profile' : '/login')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Profile"
              title={user ? 'الملف الشخصي' : 'تسجيل الدخول'}
            >
              <User size={24} className="text-gray-700" />
            </button>
          </div>
        </div>
      </header>

      {/* Cart Drawer */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
