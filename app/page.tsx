'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { Search, ShoppingCart, User, X } from 'lucide-react';
import { useShop } from '@/context/ShopContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import CartDrawer from '@/components/CartDrawer';
import HeroBanner from '@/components/store/HeroBanner';
import TrustFeatures from '@/components/store/TrustFeatures';
import CategoryHighlights from '@/components/store/CategoryHighlights';
import FlashSaleSection from '@/components/store/FlashSaleSection';
import AnnouncementBar from '@/components/store/AnnouncementBar';
import StoreFooter from '@/components/store/StoreFooter';

function HomeContent() {
  const { cart, user, loading, products, loadProducts } = useShop();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMounted) {
      loadProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted]);

  useEffect(() => {
    document.title = 'المتجر - My Shop';
  }, []);

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const handleCategoryClick = (category: string) => {
    router.push(`/shop?type=${encodeURIComponent(category)}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/shop');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl" suppressHydrationWarning>
      <AnnouncementBar />
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm" suppressHydrationWarning>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3" suppressHydrationWarning>
          <div className="flex items-center gap-2 sm:gap-3" suppressHydrationWarning>
            <div className={`flex-shrink-0 transition-all duration-300 md:block ${isSearchExpanded ? 'hidden md:block' : 'block'}`}>
              <button onClick={() => router.push('/')} className="cursor-pointer">
                <Image
                  src="/logo just name.png"
                  alt="ALMNAR"
                  width={120}
                  height={40}
                  className="h-7 sm:h-8 md:h-10 w-auto object-contain"
                  priority
                />
              </button>
            </div>

            <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 relative min-w-0" suppressHydrationWarning>
              <button type="submit" className="absolute right-2.5 sm:right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 sm:w-5 sm:h-5">
                <Search size={18} />
              </button>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="بحث عن منتجات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-8 sm:pr-10 pl-3 sm:pl-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-gray-900 placeholder:text-gray-500 text-right text-sm sm:text-base"
                dir="rtl"
                suppressHydrationWarning
              />
            </form>

            <div className="md:hidden flex items-center gap-2 flex-1" suppressHydrationWarning>
              {!isSearchExpanded ? (
                <button
                  onClick={() => {
                    setIsSearchExpanded(true);
                    setTimeout(() => {
                      if (searchInputRef.current) {
                        searchInputRef.current.focus();
                      }
                    }, 100);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                  aria-label="Search"
                >
                  <Search size={20} className="text-gray-700" />
                </button>
              ) : (
                <form onSubmit={handleSearchSubmit} className="flex-1 relative min-w-0 flex items-center gap-2">
                  <button type="submit" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <Search size={18} />
                  </button>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="بحث عن منتجات..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 pr-8 pl-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-gray-900 placeholder:text-gray-500 text-right text-base"
                    dir="rtl"
                    autoFocus
                    suppressHydrationWarning
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsSearchExpanded(false);
                      setSearchQuery('');
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                    aria-label="Close search"
                  >
                    <X size={20} className="text-gray-700" />
                  </button>
                </form>
              )}
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              aria-label="Cart"
              suppressHydrationWarning
            >
              <ShoppingCart size={20} className="text-gray-700 sm:w-6 sm:h-6" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-gray-900 text-white text-[10px] sm:text-xs font-bold rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center" suppressHydrationWarning>
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </button>

            {(user?.Role === 'Admin' || user?.role === 'Admin') && (
              <button
                onClick={() => router.push('/admin')}
                className="hidden sm:flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-xs sm:text-sm"
                suppressHydrationWarning
              >
                <span>Admin Panel</span>
              </button>
            )}

            <button
              onClick={() => router.push(user ? '/profile' : '/login')}
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              aria-label="Profile"
              title={user ? 'الملف الشخصي' : 'تسجيل الدخول'}
              suppressHydrationWarning
            >
              <User size={20} className="text-gray-700 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
      </header>

      <HeroBanner />
      <TrustFeatures />
      <CategoryHighlights onCategoryClick={handleCategoryClick} />
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <FlashSaleSection />
      </div>

      {/* Footer */}
      <StoreFooter />

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">جاري التحميل...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
