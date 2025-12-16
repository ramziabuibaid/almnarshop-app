'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useShop } from '@/context/ShopContext';
import { useAdminAuth } from '@/context/AdminAuthContext';
import AdminLayout from '@/components/admin/AdminLayout';
import ProductFormModal from '@/components/admin/ProductFormModal';
import MarketingCardGenerator from '@/components/admin/MarketingCardGenerator';
import { Plus, Edit, Image as ImageIcon, Loader2, Package, ChevronLeft, ChevronRight, Filter, X, Search, ChevronDown, Sparkles, CheckCircle2, ArrowUp, ArrowDown, Trash } from 'lucide-react';
import { Product } from '@/types';
import { getDirectImageUrl } from '@/lib/utils';
import { deleteProduct } from '@/lib/api';

const PRODUCTS_PER_PAGE = 20;

type SortField = 'name' | 'id' | 'barcode' | 'salePrice' | 'costPrice' | 'stock' | null;
type SortDirection = 'asc' | 'desc';

interface FilterState {
  type: string;
  brand: string;
  size: string;
  color: string;
}

export default function ProductsManagerPage() {
  const { admin } = useAdminAuth();
  const { products, loadProducts, loading } = useShop();
  const [searchQuery, setSearchQuery] = useState('');
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isMarketingModalOpen, setIsMarketingModalOpen] = useState(false);
  const [marketingProduct, setMarketingProduct] = useState<Product | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FilterState>({
    type: '',
    brand: '',
    size: '',
    color: '',
  });
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'saving' | 'success' | null }>({ message: '', type: null });
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteState, setDeleteState] = useState<{
    loading: boolean;
    error: string;
    status: 'idle' | 'blocked' | 'deleted';
    references: {
      cashInvoices: string[];
      onlineOrders: string[];
      shopInvoices: string[];
      warehouseInvoices: string[];
      quotations: string[];
    } | null;
  }>({
    loading: false,
    error: '',
    status: 'idle',
    references: null,
  });

  // Check if user has permission to view cost
  const canViewCost = admin?.is_super_admin || admin?.permissions?.viewCost === true;

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleAddNew = () => {
    setSelectedProduct(null);
    setIsModalOpen(true);
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
    // Clear toast when modal closes
    setToast({ message: '', type: null });
  };

  const handleSaveSuccess = async () => {
    // Show success toast and refresh products list
    setToast({ message: 'Product Saved Successfully', type: 'success' });
    await loadProducts();
    
    // Auto-hide toast after 3 seconds
    setTimeout(() => {
      setToast({ message: '', type: null });
    }, 3000);
  };

  const handleGenerateAd = (product: Product) => {
    setMarketingProduct(product);
    setIsMarketingModalOpen(true);
  };

  const handleMarketingModalClose = () => {
    setIsMarketingModalOpen(false);
    setMarketingProduct(null);
  };

  const handleDeleteClick = (product: Product) => {
    setDeleteTarget(product);
    setDeleteState({
      loading: false,
      error: '',
      status: 'idle',
      references: null,
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const productId = deleteTarget.ProductID || deleteTarget.id;
    if (!productId) {
      setDeleteState((prev) => ({ ...prev, error: 'ProductID مفقود لهذا الصنف.' }));
      return;
    }

    setDeleteState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const result = await deleteProduct(productId);
      if (result.status === 'blocked') {
        setDeleteState({
          loading: false,
          error: '',
          status: 'blocked',
          references: result.references || null,
        });
        return;
      }

      setDeleteState({
        loading: false,
        error: '',
        status: 'deleted',
        references: null,
      });
      await loadProducts();
      // Close modal after showing success message for 1.5 seconds
      setTimeout(() => {
        setDeleteTarget(null);
        setDeleteState({
          loading: false,
          error: '',
          status: 'idle',
          references: null,
        });
      }, 1500);
    } catch (err: any) {
      setDeleteState({
        loading: false,
        error: err?.message || 'فشل في حذف المنتج. حاول مرة أخرى.',
        status: 'idle',
        references: null,
      });
    }
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteState({
      loading: false,
      error: '',
      status: 'idle',
      references: null,
    });
  };

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Apply search - supports multiple words (e.g., "ثلاجة سامسونج" will find products with both words)
    if (searchQuery.trim()) {
      // Split search query into individual words
      const searchWords = searchQuery
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0);
      
      filtered = filtered.filter((p) => {
        // Safely convert all values to strings and create searchable text
        const name = String(p.name || p.Name || '').toLowerCase();
        const id = String(p.id || p.ProductID || '').toLowerCase();
        const barcode = String(p.barcode || p.Barcode || '').toLowerCase();
        const brand = String(p.brand || p.Brand || '').toLowerCase();
        
        // Combine all searchable fields into one text
        const searchableText = `${name} ${id} ${barcode} ${brand}`;
        
        // Check if ALL search words are found in the searchable text
        return searchWords.every(word => searchableText.includes(word));
      });
    }

    // Apply filters
    if (filters.type) {
      filtered = filtered.filter((p) => (p.type || p.Type) === filters.type);
    }
    if (filters.brand) {
      filtered = filtered.filter((p) => (p.brand || p.Brand) === filters.brand);
    }
    if (filters.size) {
      filtered = filtered.filter((p) => (p.size || p.Size) === filters.size);
    }
    if (filters.color) {
      filtered = filtered.filter((p) => (p.color || p.Color) === filters.color);
    }

    // Apply sorting
    const sorted = [...filtered];
    if (sortField) {
      sorted.sort((a, b) => {
        let comparison = 0;
        
        switch (sortField) {
          case 'name':
            comparison = (a.name || a.Name || '').localeCompare(b.name || b.Name || '', 'en', { sensitivity: 'base' });
            break;
          case 'id':
            const idA = String(a.id || a.ProductID || '').toLowerCase();
            const idB = String(b.id || b.ProductID || '').toLowerCase();
            // Try numeric comparison first, then string comparison
            const numA = parseInt(idA);
            const numB = parseInt(idB);
            if (!isNaN(numA) && !isNaN(numB)) {
              comparison = numA - numB;
            } else {
              comparison = idA.localeCompare(idB, 'en', { sensitivity: 'base' });
            }
            break;
          case 'barcode':
            const barcodeA = String(a.barcode || a.Barcode || '').toLowerCase();
            const barcodeB = String(b.barcode || b.Barcode || '').toLowerCase();
            // Try numeric comparison first, then string comparison
            const barcodeNumA = parseInt(barcodeA);
            const barcodeNumB = parseInt(barcodeB);
            if (!isNaN(barcodeNumA) && !isNaN(barcodeNumB)) {
              comparison = barcodeNumA - barcodeNumB;
            } else {
              comparison = barcodeA.localeCompare(barcodeB, 'en', { sensitivity: 'base' });
            }
            break;
          case 'salePrice':
            comparison = (a.price || a.SalePrice || 0) - (b.price || b.SalePrice || 0);
            break;
          case 'costPrice':
            const costA = parseFloat(String(a.CostPrice || 0)) || 0;
            const costB = parseFloat(String(b.CostPrice || 0)) || 0;
            comparison = costA - costB;
            break;
          case 'stock':
            const stockA = (a.CS_War || 0) + (a.CS_Shop || 0);
            const stockB = (b.CS_War || 0) + (b.CS_Shop || 0);
            comparison = stockA - stockB;
            break;
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return sorted;
  }, [products, searchQuery, filters, sortField, sortDirection]);

  // Reset to page 1 when filters, search, or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, sortField, sortDirection]);

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    // Prevent sorting by costPrice if user doesn't have permission
    if (field === 'costPrice' && !canViewCost) {
      return;
    }
    
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with ascending direction
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get sort icon for column header
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={14} className="inline-block ml-1" />
    ) : (
      <ArrowDown size={14} className="inline-block ml-1" />
    );
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const endIndex = startIndex + PRODUCTS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Cascading Filters - Each filter shows only options available based on other selected filters
  const availableTypes = useMemo(() => {
    let filtered = products;
    
    // Apply other filters (excluding type)
    if (filters.brand) {
      filtered = filtered.filter((p) => (p.brand || p.Brand) === filters.brand);
    }
    if (filters.size) {
      filtered = filtered.filter((p) => (p.size || p.Size) === filters.size);
    }
    if (filters.color) {
      filtered = filtered.filter((p) => (p.color || p.Color) === filters.color);
    }
    
    const types = new Set<string>();
    filtered.forEach((p) => {
      if (p.type || p.Type) types.add(p.type || p.Type || '');
    });
    return Array.from(types).sort();
  }, [products, filters.brand, filters.size, filters.color]);

  const availableBrands = useMemo(() => {
    let filtered = products;
    
    // Apply other filters (excluding brand)
    if (filters.type) {
      filtered = filtered.filter((p) => (p.type || p.Type) === filters.type);
    }
    if (filters.size) {
      filtered = filtered.filter((p) => (p.size || p.Size) === filters.size);
    }
    if (filters.color) {
      filtered = filtered.filter((p) => (p.color || p.Color) === filters.color);
    }
    
    const brands = new Set<string>();
    filtered.forEach((p) => {
      if (p.brand || p.Brand) brands.add(p.brand || p.Brand || '');
    });
    return Array.from(brands).sort();
  }, [products, filters.type, filters.size, filters.color]);

  const availableSizes = useMemo(() => {
    let filtered = products;
    
    // Apply other filters (excluding size)
    if (filters.type) {
      filtered = filtered.filter((p) => (p.type || p.Type) === filters.type);
    }
    if (filters.brand) {
      filtered = filtered.filter((p) => (p.brand || p.Brand) === filters.brand);
    }
    if (filters.color) {
      filtered = filtered.filter((p) => (p.color || p.Color) === filters.color);
    }
    
    const sizes = new Set<string>();
    filtered.forEach((p) => {
      if (p.size || p.Size) sizes.add(p.size || p.Size || '');
    });
    return Array.from(sizes).sort();
  }, [products, filters.type, filters.brand, filters.color]);

  const availableColors = useMemo(() => {
    let filtered = products;
    
    // Apply other filters (excluding color)
    if (filters.type) {
      filtered = filtered.filter((p) => (p.type || p.Type) === filters.type);
    }
    if (filters.brand) {
      filtered = filtered.filter((p) => (p.brand || p.Brand) === filters.brand);
    }
    if (filters.size) {
      filtered = filtered.filter((p) => (p.size || p.Size) === filters.size);
    }
    
    const colors = new Set<string>();
    filtered.forEach((p) => {
      if (p.color || p.Color) colors.add(p.color || p.Color || '');
    });
    return Array.from(colors).sort();
  }, [products, filters.type, filters.brand, filters.size]);

  // Reset dependent filters when parent filter changes
  useEffect(() => {
    setFilters((prev) => {
      const updated = { ...prev };
      let changed = false;

      if (updated.type && !availableTypes.includes(updated.type)) {
        updated.type = '';
        updated.brand = '';
        updated.size = '';
        updated.color = '';
        changed = true;
      }
      if (updated.brand && !availableBrands.includes(updated.brand)) {
        updated.brand = '';
        updated.size = '';
        updated.color = '';
        changed = true;
      }
      if (updated.size && !availableSizes.includes(updated.size)) {
        updated.size = '';
        updated.color = '';
        changed = true;
      }
      if (updated.color && !availableColors.includes(updated.color)) {
        updated.color = '';
        changed = true;
      }

      return changed ? updated : prev;
    });
  }, [availableTypes, availableBrands, availableSizes, availableColors]);

  // SearchableSelect Component
  interface SearchableSelectProps {
    label: string;
    value: string;
    options: string[];
    onChange: (value: string) => void;
    placeholder?: string;
  }

  function SearchableSelect({ label, value, options, onChange, placeholder = 'All' }: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const filteredOptions = useMemo(() => {
      if (!searchQuery.trim()) return options;
      const query = searchQuery.toLowerCase();
      return options.filter(opt => opt.toLowerCase().includes(query));
    }, [options, searchQuery]);

    const selectedOption = value ? options.find(opt => opt === value) : null;

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          setSearchQuery('');
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div className="relative" ref={containerRef}>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          {label}
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-left flex items-center justify-between"
          >
            <span className={selectedOption ? 'text-gray-900 font-medium' : 'text-gray-700'}>
              {selectedOption || placeholder}
            </span>
            <ChevronDown size={16} className={`text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isOpen && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
              <div className="p-2 border-b border-gray-200">
                <div className="relative">
                  <Search size={16} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full pl-8 pr-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm text-gray-900 placeholder:text-gray-500"
                    autoFocus
                  />
                </div>
              </div>
              <div className="overflow-y-auto max-h-48">
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors text-gray-900 ${
                    !value ? 'bg-gray-100 font-medium' : ''
                  }`}
                >
                  {placeholder}
                </button>
                {filteredOptions.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-600">No results found</div>
                ) : (
                  filteredOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        onChange(option);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors text-gray-900 ${
                        value === option ? 'bg-gray-100 font-medium' : ''
                      }`}
                    >
                      {option}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const handleImageError = (productId: string) => {
    setImageErrors((prev) => ({ ...prev, [productId]: true }));
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Products</h1>
            <p className="text-gray-600 mt-1">
              Manage your product inventory ({filteredProducts.length} products)
              {totalPages > 1 && ` - Page ${currentPage} of ${totalPages}`}
            </p>
          </div>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            <Plus size={20} />
            Add New Product
          </button>
        </div>

        {/* Search and Filters Bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search by name, ID, barcode, or brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-500"
            />
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="md:hidden p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Filter size={20} className="text-gray-700" />
            </button>
          </div>

          {/* Filters - Desktop */}
          <div className="hidden md:grid md:grid-cols-4 gap-4">
            <SearchableSelect
              label="Type"
              value={filters.type}
              options={availableTypes}
              onChange={(value) => {
                const newFilters = { ...filters, type: value };
                if (!value) {
                  newFilters.brand = '';
                  newFilters.size = '';
                  newFilters.color = '';
                }
                setFilters(newFilters);
              }}
              placeholder="All Types"
            />
            <SearchableSelect
              label="Brand"
              value={filters.brand}
              options={availableBrands}
              onChange={(value) => {
                const newFilters = { ...filters, brand: value };
                if (!value) {
                  newFilters.size = '';
                  newFilters.color = '';
                }
                setFilters(newFilters);
              }}
              placeholder="All Brands"
            />
            <SearchableSelect
              label="Size"
              value={filters.size}
              options={availableSizes}
              onChange={(value) => {
                const newFilters = { ...filters, size: value };
                if (!value) {
                  newFilters.color = '';
                }
                setFilters(newFilters);
              }}
              placeholder="All Sizes"
            />
            <SearchableSelect
              label="Color"
              value={filters.color}
              options={availableColors}
              onChange={(value) => setFilters(prev => ({ ...prev, color: value }))}
              placeholder="All Colors"
            />
          </div>

          {/* Reset Filters */}
          <div className="flex items-center justify-end">
            <button
              onClick={() => setFilters({ type: '', brand: '', size: '', color: '' })}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Mobile Filters Drawer */}
        {isFilterOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-[60] md:hidden"
              onClick={() => setIsFilterOpen(false)}
            />
            <div className="fixed top-0 right-0 h-full w-80 bg-white shadow-xl z-[70] overflow-y-auto md:hidden">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Filters</h2>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} className="text-gray-600" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <SearchableSelect
                  label="Type"
                  value={filters.type}
                  options={availableTypes}
                  onChange={(value) => {
                    const newFilters = { ...filters, type: value };
                    if (!value) {
                      newFilters.brand = '';
                      newFilters.size = '';
                      newFilters.color = '';
                    }
                    setFilters(newFilters);
                  }}
                  placeholder="All Types"
                />
                <SearchableSelect
                  label="Brand"
                  value={filters.brand}
                  options={availableBrands}
                  onChange={(value) => {
                    const newFilters = { ...filters, brand: value };
                    if (!value) {
                      newFilters.size = '';
                      newFilters.color = '';
                    }
                    setFilters(newFilters);
                  }}
                  placeholder="All Brands"
                />
                <SearchableSelect
                  label="Size"
                  value={filters.size}
                  options={availableSizes}
                  onChange={(value) => {
                    const newFilters = { ...filters, size: value };
                    if (!value) {
                      newFilters.color = '';
                    }
                    setFilters(newFilters);
                  }}
                  placeholder="All Sizes"
                />
                <SearchableSelect
                  label="Color"
                  value={filters.color}
                  options={availableColors}
                  onChange={(value) => setFilters(prev => ({ ...prev, color: value }))}
                  placeholder="All Colors"
                />
                <button
                  onClick={() => {
                    setFilters({ type: '', brand: '', size: '', color: '' });
                    setIsFilterOpen(false);
                  }}
                  className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </>
        )}

        {/* Products Table */}
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Loading products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Package size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No products found</p>
            {searchQuery && (
              <p className="text-gray-500 text-sm mt-2">
                Try adjusting your search query
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Image
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        Name
                        {getSortIcon('name')}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                      onClick={() => handleSort('id')}
                    >
                      <div className="flex items-center">
                        ID / Barcode
                        {getSortIcon('id')}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                      onClick={() => handleSort('salePrice')}
                    >
                      <div className="flex items-center">
                        Sale Price
                        {getSortIcon('salePrice')}
                      </div>
                    </th>
                    {canViewCost && (
                      <th 
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                        onClick={() => handleSort('costPrice')}
                      >
                        <div className="flex items-center">
                          Cost Price
                          {getSortIcon('costPrice')}
                        </div>
                      </th>
                    )}
                    <th 
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                      onClick={() => handleSort('stock')}
                    >
                      <div className="flex items-center">
                        Stock
                        {getSortIcon('stock')}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedProducts.map((product) => {
                    const rawImageUrl = product.image || product.Image || product.ImageUrl || '';
                    const imageUrl = getDirectImageUrl(rawImageUrl);
                    const hasImageError = imageErrors[product.id] || !imageUrl;
                    
                    return (
                      <tr
                        key={product.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        {/* Image */}
                        <td className="px-4 py-3">
                          <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                            {hasImageError ? (
                              <ImageIcon size={24} className="text-gray-300" />
                            ) : (
                              <img
                                src={imageUrl}
                                alt={product.name}
                                className="object-contain w-full h-full"
                                onError={() => handleImageError(product.id)}
                                loading="lazy"
                              />
                            )}
                          </div>
                        </td>

                        {/* Name */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {product.name || product.Name || 'N/A'}
                          </div>
                          {(product.brand || product.Brand) && (
                            <div className="text-sm text-gray-500 mt-1">
                              {product.brand || product.Brand}
                            </div>
                          )}
                        </td>

                        {/* ID / Barcode */}
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900 font-mono">
                            {product.id || product.ProductID || 'N/A'}
                          </div>
                          {product.barcode && (
                            <div className="text-xs text-gray-500 mt-1">
                              {product.barcode}
                            </div>
                          )}
                        </td>

                        {/* Sale Price */}
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-gray-900">
                            ₪{parseFloat(product.price || product.SalePrice || 0).toFixed(2)}
                          </div>
                        </td>

                        {/* Cost Price */}
                        {canViewCost && (
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-600">
                              {product.CostPrice !== undefined && product.CostPrice !== null && product.CostPrice !== '' ? (
                                `₪${parseFloat(String(product.CostPrice || 0)).toFixed(2)}`
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </div>
                          </td>
                        )}

                        {/* Stock */}
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-600">
                            {(product.CS_War !== undefined && product.CS_War !== null) || 
                             (product.CS_Shop !== undefined && product.CS_Shop !== null) ? (
                              <div className="flex flex-col gap-1">
                                {product.CS_War !== undefined && product.CS_War !== null && (
                                  <span className="text-xs text-gray-500">
                                    W: <span className={`font-medium ${
                                      (product.CS_War || 0) > 0 ? 'text-green-700' : 'text-red-700'
                                    }`}>{product.CS_War || 0}</span>
                                  </span>
                                )}
                                {product.CS_Shop !== undefined && product.CS_Shop !== null && (
                                  <span className="text-xs text-gray-500">
                                    S: <span className={`font-medium ${
                                      (product.CS_Shop || 0) > 0 ? 'text-green-700' : 'text-red-700'
                                    }`}>{product.CS_Shop || 0}</span>
                                  </span>
                                )}
                                {(product.CS_War || 0) + (product.CS_Shop || 0) > 0 && (
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                                      ((product.CS_War || 0) + (product.CS_Shop || 0)) > 0
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                  >
                                    Total: {(product.CS_War || 0) + (product.CS_Shop || 0)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(product)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Edit Product"
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={() => handleGenerateAd(product)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Generate Marketing Ad"
                            >
                              <Sparkles size={18} />
                            </button>
                          <button
                            onClick={() => handleDeleteClick(product)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Product"
                          >
                            <Trash size={18} />
                          </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} products
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={20} />
                Previous
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
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-2 rounded-lg transition-colors ${
                        currentPage === pageNum
                          ? 'bg-gray-900 text-white'
                          : 'border border-gray-300 hover:bg-gray-50'
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
                className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Delete confirmation modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white w-full max-w-lg rounded-lg shadow-2xl p-6 relative">
              <button
                onClick={closeDeleteModal}
                className="absolute top-3 right-3 p-2 rounded-full hover:bg-gray-100"
              >
                <X size={20} />
              </button>

              <h3 className="text-xl font-semibold text-gray-900 mb-2">حذف المنتج</h3>
              <p className="text-sm text-gray-600 mb-4">
                هل أنت متأكد من حذف المنتج "{deleteTarget.Name || deleteTarget.name || deleteTarget.ProductID}"؟
                سيتم منع الحذف إذا كان المنتج مستخدمًا في الفواتير أو العروض.
              </p>

              {deleteState.error && (
                <div className="mb-3 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
                  {deleteState.error}
                </div>
              )}

              {deleteState.status === 'deleted' && (
                <div className="mb-3 p-3 rounded-lg bg-green-50 text-green-700 text-sm border border-green-200">
                  تم حذف المنتج بنجاح.
                </div>
              )}

              {deleteState.status === 'blocked' && deleteState.references && (
                <div className="mb-3 p-3 rounded-lg bg-yellow-50 text-yellow-800 text-sm border border-yellow-200 space-y-2">
                  <div className="font-semibold">لا يمكن الحذف لوجود ارتباطات:</div>
                  {deleteState.references.cashInvoices.length > 0 && (
                    <div>فواتير نقدية: {deleteState.references.cashInvoices.join(', ')}</div>
                  )}
                  {deleteState.references.onlineOrders.length > 0 && (
                    <div>فواتير أونلاين: {deleteState.references.onlineOrders.join(', ')}</div>
                  )}
                  {deleteState.references.shopInvoices.length > 0 && (
                    <div>فواتير المحل: {deleteState.references.shopInvoices.join(', ')}</div>
                  )}
                  {deleteState.references.warehouseInvoices.length > 0 && (
                    <div>فواتير المخزن: {deleteState.references.warehouseInvoices.join(', ')}</div>
                  )}
                  {deleteState.references.quotations.length > 0 && (
                    <div>عروض سعرية: {deleteState.references.quotations.join(', ')}</div>
                  )}
                  <p className="text-xs text-gray-600">
                    عدّل الفواتير أو استبدل المنتج بمنتج آخر ثم حاول الحذف مجددًا.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={closeDeleteModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={deleteState.loading}
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteState.loading || deleteState.status === 'blocked' || deleteState.status === 'deleted'}
                  className="px-4 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {deleteState.loading ? 'جاري الحذف...' : 'تأكيد الحذف'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Product Form Modal */}
      <ProductFormModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        product={selectedProduct}
        onSuccess={handleSaveSuccess}
        onSaving={() => setToast({ message: 'Saving...', type: 'saving' })}
      />

      {/* Toast Notification */}
      {toast.type && (
        <div className="fixed bottom-4 right-4 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl min-w-[200px] ${
              toast.type === 'saving'
                ? 'bg-blue-600 text-white'
                : 'bg-green-600 text-white'
            }`}
          >
            {toast.type === 'saving' ? (
              <Loader2 size={20} className="animate-spin flex-shrink-0" />
            ) : (
              <CheckCircle2 size={20} className="flex-shrink-0" />
            )}
            <span className="font-medium text-sm">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Marketing Card Generator Modal */}
      <MarketingCardGenerator
        product={marketingProduct}
        isOpen={isMarketingModalOpen}
        onClose={handleMarketingModalClose}
      />
    </AdminLayout>
  );
}

