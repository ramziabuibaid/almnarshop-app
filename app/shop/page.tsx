'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { Search, Filter, ShoppingCart, User, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useShop } from '@/context/ShopContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import ProductCard from '@/components/store/ProductCard';
import FilterSidebar from '@/components/store/FilterSidebar';
import FilterDrawer from '@/components/store/FilterDrawer';
import ActiveFiltersBar from '@/components/store/ActiveFiltersBar';
import StoreFooter from '@/components/store/StoreFooter';
import ProductGridHeader from '@/components/store/ProductGridHeader';
import CartDrawer from '@/components/CartDrawer';
import AnnouncementBar from '@/components/store/AnnouncementBar';
import { FilterState, SortOption } from '@/components/store/types';

const PRODUCTS_PER_PAGE = 20;

function ShopContent() {
    const { products, loadProducts, cart, user, loading } = useShop();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [searchQuery, setSearchQuery] = useState('');
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [filters, setFilters] = useState<FilterState>({
        selectedTypes: [],
        selectedBrands: [],
        selectedSizes: [],
        selectedColors: [],
        priceRange: { min: 0, max: 10000 },
    });
    const [sortOption, setSortOption] = useState<SortOption>('date-desc');

    useEffect(() => {
        setIsMounted(true);
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Read URL parameters and apply filters
    useEffect(() => {
        if (!isMounted) return;

        const typeParam = searchParams.get('type');
        const searchParam = searchParams.get('search');

        if (typeParam) {
            const decodedType = decodeURIComponent(typeParam);
            setFilters((prev) => ({
                ...prev,
                selectedTypes: [decodedType],
            }));
        }

        if (searchParam) {
            setSearchQuery(decodeURIComponent(searchParam));
        }
    }, [isMounted, searchParams]);

    useEffect(() => {
        document.title = 'الكتالوج - My Shop';
    }, []);

    useEffect(() => {
        if (isMounted) {
            loadProducts();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMounted]);

    const priceRange = useMemo(() => {
        if (products.length === 0) return { min: 0, max: 10000 };
        const prices = products.map((p) => Number(p.sale_price || p.SalePrice || p.price || 0)).filter((p) => p > 0);
        if (prices.length === 0) return { min: 0, max: 10000 };
        return {
            min: Math.min(...prices),
            max: Math.max(...prices),
        };
    }, [products]);

    useEffect(() => {
        if (products.length > 0 && (priceRange.min !== 0 || priceRange.max !== 10000)) {
            setFilters((prev) => {
                if (prev.priceRange.min === 0 && prev.priceRange.max === 10000) {
                    return {
                        ...prev,
                        priceRange: { min: priceRange.min, max: priceRange.max },
                    };
                }
                return prev;
            });
        }
    }, [products.length, priceRange]);

    const filteredProducts = useMemo(() => {
        let filtered = products;

        if (searchQuery.trim()) {
            const searchWords = searchQuery
                .toLowerCase()
                .trim()
                .split(/\s+/)
                .filter((word) => word.length > 0);

            filtered = filtered.filter((p) => {
                const name = String(p.name || p.Name || '').toLowerCase();
                const brand = String(p.brand || p.Brand || '').toLowerCase();
                const type = String(p.type || p.Type || '').toLowerCase();
                const searchableText = `${name} ${brand} ${type}`;
                return searchWords.every((word) => searchableText.includes(word));
            });
        }

        if (filters.selectedTypes.length > 0) {
            filtered = filtered.filter((p) => {
                const type = p.type || p.Type || '';
                return filters.selectedTypes.includes(type);
            });
        }

        if (filters.selectedBrands.length > 0) {
            filtered = filtered.filter((p) => {
                const brand = p.brand || p.Brand || '';
                return filters.selectedBrands.includes(brand);
            });
        }

        if (filters.selectedSizes.length > 0) {
            filtered = filtered.filter((p) => {
                const size = p.size || p.Size || '';
                return filters.selectedSizes.includes(size);
            });
        }

        if (filters.selectedColors.length > 0) {
            filtered = filtered.filter((p) => {
                const color = p.color || p.Color || '';
                return filters.selectedColors.includes(color);
            });
        }

        filtered = filtered.filter((p) => {
            const effectivePrice = Number(p.sale_price || p.SalePrice || p.price || 0);
            return effectivePrice >= filters.priceRange.min && effectivePrice <= filters.priceRange.max;
        });

        const sorted = [...filtered];
        switch (sortOption) {
            case 'name-asc':
                sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'en', { sensitivity: 'base' }));
                break;
            case 'name-desc':
                sorted.sort((a, b) => (b.name || '').localeCompare(a.name || '', 'en', { sensitivity: 'base' }));
                break;
            case 'price-asc':
                sorted.sort((a, b) => {
                    const priceA = Number(a.sale_price || a.SalePrice || a.price || 0);
                    const priceB = Number(b.sale_price || b.SalePrice || b.price || 0);
                    return priceA - priceB;
                });
                break;
            case 'price-desc':
                sorted.sort((a, b) => {
                    const priceA = Number(a.sale_price || a.SalePrice || a.price || 0);
                    const priceB = Number(b.sale_price || b.SalePrice || b.price || 0);
                    return priceB - priceA;
                });
                break;
            case 'date-desc':
                sorted.sort((a, b) => {
                    const aRestock = a.last_restocked_at || a.LastRestockedAt;
                    const aCreated = a.created_at;
                    const aTime = Math.max(
                        aRestock ? new Date(aRestock).getTime() : 0,
                        aCreated ? new Date(aCreated).getTime() : 0
                    );
                    const bRestock = b.last_restocked_at || b.LastRestockedAt;
                    const bCreated = b.created_at;
                    const bTime = Math.max(
                        bRestock ? new Date(bRestock).getTime() : 0,
                        bCreated ? new Date(bCreated).getTime() : 0
                    );
                    return bTime - aTime;
                });
                break;
        }

        return sorted;
    }, [products, searchQuery, filters, sortOption]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filters, sortOption]);

    const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
    const endIndex = startIndex + PRODUCTS_PER_PAGE;
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

    const cartItemCount = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.quantity, 0);
    }, [cart]);

    const activeFilters = useMemo(() => {
        const active: Array<{ key: string; label: string; value: string }> = [];

        filters.selectedTypes.forEach((type) => {
            active.push({ key: `type_${type}`, label: 'النوع', value: type });
        });

        filters.selectedBrands.forEach((brand) => {
            active.push({ key: `brand_${brand}`, label: 'العلامة التجارية', value: brand });
        });

        filters.selectedSizes.forEach((size) => {
            active.push({ key: `size_${size}`, label: 'الحجم', value: size });
        });

        filters.selectedColors.forEach((color) => {
            active.push({ key: `color_${color}`, label: 'اللون', value: color });
        });

        const isPriceFiltered =
            filters.priceRange.min > priceRange.min ||
            filters.priceRange.max < priceRange.max;
        if (isPriceFiltered) {
            active.push({
                key: 'price',
                label: 'السعر',
                value: `₪${filters.priceRange.min.toFixed(2)} - ₪${filters.priceRange.max.toFixed(2)}`,
            });
        }

        return active;
    }, [filters, priceRange]);

    const handleRemoveFilter = (key: string) => {
        if (key === 'price') {
            setFilters((prev) => ({
                ...prev,
                priceRange: { min: priceRange.min, max: priceRange.max },
            }));
        } else if (key.startsWith('type_')) {
            const type = key.replace('type_', '');
            setFilters((prev) => ({
                ...prev,
                selectedTypes: prev.selectedTypes.filter((t) => t !== type),
            }));
        } else if (key.startsWith('brand_')) {
            const brand = key.replace('brand_', '');
            setFilters((prev) => ({
                ...prev,
                selectedBrands: prev.selectedBrands.filter((b) => b !== brand),
            }));
        } else if (key.startsWith('size_')) {
            const size = key.replace('size_', '');
            setFilters((prev) => ({
                ...prev,
                selectedSizes: prev.selectedSizes.filter((s) => s !== size),
            }));
        } else if (key.startsWith('color_')) {
            const color = key.replace('color_', '');
            setFilters((prev) => ({
                ...prev,
                selectedColors: prev.selectedColors.filter((c) => c !== color),
            }));
        }
    };

    const handleClearAllFilters = () => {
        setFilters({
            selectedTypes: [],
            selectedBrands: [],
            selectedSizes: [],
            selectedColors: [],
            priceRange: { min: priceRange.min, max: priceRange.max },
        });
    };

    const updateURL = (newSearchQuery: string) => {
        setSearchQuery(newSearchQuery);
        const params = new URLSearchParams(window.location.search);
        if (newSearchQuery) {
            params.set('search', newSearchQuery);
        } else {
            params.delete('search');
        }
        router.replace(`/shop?${params.toString()}`, { scroll: false });
    };

    return (
        <div className="min-h-screen bg-gray-50" dir="rtl" suppressHydrationWarning>
            <AnnouncementBar />
            <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm" suppressHydrationWarning>
                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3" suppressHydrationWarning>
                    <div className="flex items-center gap-2 sm:gap-3" suppressHydrationWarning>
                        <div className={`flex-shrink-0 transition-all duration-300 md:block ${isSearchExpanded ? 'hidden md:block' : 'block'
                            }`}>
                            <button
                                onClick={() => router.push('/')}
                                className="cursor-pointer"
                            >
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

                        <div className="hidden md:flex flex-1 relative min-w-0" suppressHydrationWarning>
                            <Search
                                size={18}
                                className="absolute right-2.5 sm:right-3 top-1/2 transform -translate-y-1/2 text-gray-400 sm:w-5 sm:h-5 pointer-events-none"
                            />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="بحث عن منتجات..."
                                value={searchQuery}
                                onChange={(e) => updateURL(e.target.value)}
                                className="w-full pr-8 sm:pr-10 pl-3 sm:pl-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-gray-900 placeholder:text-gray-500 text-right text-sm sm:text-base"
                                dir="rtl"
                                suppressHydrationWarning
                            />
                        </div>

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
                                <div className="flex-1 relative min-w-0 flex items-center gap-2">
                                    <Search
                                        size={18}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
                                    />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="بحث عن منتجات..."
                                        value={searchQuery}
                                        onChange={(e) => updateURL(e.target.value)}
                                        className="flex-1 pr-8 pl-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-gray-900 placeholder:text-gray-500 text-right text-base"
                                        dir="rtl"
                                        autoFocus
                                        suppressHydrationWarning
                                    />
                                    <button
                                        onClick={() => {
                                            setIsSearchExpanded(false);
                                            updateURL('');
                                        }}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                                        aria-label="Close search"
                                    >
                                        <X size={20} className="text-gray-700" />
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setIsFilterDrawerOpen(true)}
                            className="md:hidden p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors relative flex-shrink-0"
                            aria-label="Filter"
                            suppressHydrationWarning
                        >
                            <Filter size={20} className="text-gray-700 sm:w-6 sm:h-6" />
                            {(filters.selectedTypes.length > 0 ||
                                filters.selectedBrands.length > 0 ||
                                filters.selectedSizes.length > 0 ||
                                filters.selectedColors.length > 0 ||
                                (filters.priceRange.min > priceRange.min || filters.priceRange.max < priceRange.max)) && (
                                    <span className="absolute -top-0.5 -right-0.5 bg-gray-900 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none" suppressHydrationWarning>
                                        {activeFilters.length > 9 ? '9+' : activeFilters.length}
                                    </span>
                                )}
                        </button>

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

            <main id="products-section" className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8" suppressHydrationWarning>
                <div className="mb-4 sm:mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 text-right mb-2">
                            تصفح جميع المنتجات
                        </h2>
                    </div>
                </div>
                {loading && (
                    <div className="text-center py-8 sm:py-12">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-gray-900 mb-4"></div>
                        <p className="text-gray-500 text-base sm:text-lg">جاري تحميل المنتجات...</p>
                        <p className="text-gray-400 text-sm mt-2">يرجى الانتظار</p>
                    </div>
                )}

                {!loading && (
                    <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
                        <aside className="hidden lg:block">
                            <FilterSidebar filters={filters} onFilterChange={setFilters} />
                        </aside>

                        <div className="flex-1 min-w-0">
                            <div suppressHydrationWarning>
                                <ActiveFiltersBar
                                    filters={activeFilters}
                                    onRemove={handleRemoveFilter}
                                    onClearAll={handleClearAllFilters}
                                />
                            </div>

                            <ProductGridHeader
                                totalResults={filteredProducts.length}
                                showingFrom={startIndex + 1}
                                showingTo={Math.min(endIndex, filteredProducts.length)}
                                sortOption={sortOption}
                                onSortChange={setSortOption}
                            />

                            {filteredProducts.length === 0 ? (
                                <div className="text-center py-8 sm:py-12">
                                    <p className="text-gray-500 text-base sm:text-lg">لم يتم العثور على منتجات</p>
                                    <p className="text-gray-400 text-sm mt-2">جرب تعديل البحث أو الفلاتر</p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                                        {paginatedProducts.map((product) => (
                                            <ProductCard key={product.id} product={product} />
                                        ))}
                                    </div>

                                    {totalPages > 1 && (
                                        <div className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-2">
                                            <button
                                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                                disabled={currentPage === 1}
                                                className="flex items-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-900 text-sm sm:text-base"
                                            >
                                                <ChevronRight size={18} className="text-gray-900 sm:w-5 sm:h-5" />
                                                <span className="hidden sm:inline">السابق</span>
                                            </button>

                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                    let pageNum;
                                                    if (totalPages <= 5) {
                                                        pageNum = i + 1;
                                                    } else if (currentPage <= 3) {
                                                        pageNum = i + 1;
                                                    } else if (currentPage >= totalPages - 2) {
                                                        pageNum = totalPages - 4 + i;
                                                    } else {
                                                        pageNum = currentPage - 2 + i;
                                                    }

                                                    return (
                                                        <button
                                                            key={pageNum}
                                                            onClick={() => {
                                                                setCurrentPage(pageNum);
                                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                                            }}
                                                            className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors text-sm sm:text-base ${currentPage === pageNum
                                                                ? 'bg-gray-900 text-white'
                                                                : 'border border-gray-300 hover:bg-gray-50 text-gray-900'
                                                                }`}
                                                        >
                                                            {pageNum}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <button
                                                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                                disabled={currentPage === totalPages}
                                                className="flex items-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-900 text-sm sm:text-base"
                                            >
                                                <span className="hidden sm:inline">التالي</span>
                                                <ChevronLeft size={18} className="text-gray-900 sm:w-5 sm:h-5" />
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </main>

            <FilterDrawer
                isOpen={isFilterDrawerOpen}
                onClose={() => setIsFilterDrawerOpen(false)}
                filters={filters}
                onFilterChange={setFilters}
            />

            <StoreFooter />

            <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

        </div>
    );
}

export default function ShopPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-gray-600">جاري التحميل...</div>
            </div>
        }>
            <ShopContent />
        </Suspense>
    );
}
