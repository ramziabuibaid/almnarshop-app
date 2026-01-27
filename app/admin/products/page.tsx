'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useRef, useTransition, useCallback } from 'react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import AdminLayout from '@/components/admin/AdminLayout';
import ProductFormModal from '@/components/admin/ProductFormModal';
import MarketingCardGenerator from '@/components/admin/MarketingCardGenerator';
import { DataTable } from '@/components/ui/data-table';
import { Plus, Edit, Edit2, Image as ImageIcon, Loader2, Package, Sparkles, CheckCircle2, Trash, Eye, X, Check, Search, Filter, DollarSign, Warehouse, Store, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Product } from '@/types';
import { getDirectImageUrl } from '@/lib/utils';
import { deleteProduct, getProducts, saveProduct } from '@/lib/api';
import { ColumnDef } from '@tanstack/react-table';
import React from 'react';

// Optimized Mobile Product Card Component
const MobileProductCard = React.memo(({ 
  product, 
  imageErrors, 
  canViewCost, 
  canAccountant, 
  router, 
  handleEdit, 
  handleGenerateAd, 
  handleDeleteClick, 
  handleImageError 
}: {
  product: Product;
  imageErrors: Record<string, boolean>;
  canViewCost: boolean;
  canAccountant: boolean;
  router: any;
  handleEdit: (product: Product) => void;
  handleGenerateAd: (product: Product) => void;
  handleDeleteClick: (product: Product) => void;
  handleImageError: (productId: string) => void;
}) => {
  const productId = product.ProductID || product.id || '';
  const rawImageUrl = product.image || product.Image || product.ImageUrl || '';
  const imageUrl = getDirectImageUrl(rawImageUrl);
  const hasImageError = imageErrors[productId] || !imageUrl;
  const warehouseStock = product.CS_War !== undefined && product.CS_War !== null ? (product.CS_War || 0) : null;
  const shopStock = product.CS_Shop !== undefined && product.CS_Shop !== null ? (product.CS_Shop || 0) : null;
  const totalStock = (warehouseStock || 0) + (shopStock || 0);
  const price = product.price || product.SalePrice || 0;
  const costPrice = canViewCost ? (product.CostPrice || null) : null;
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      {/* Header with Image and Basic Info */}
      <div className="flex items-start gap-3 mb-3">
        {/* Product Image */}
        <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
          {hasImageError || !imageUrl ? (
            <ImageIcon size={24} className="text-gray-300" />
          ) : (
            <img
              src={imageUrl}
              alt={product.name || product.Name || ''}
              className="object-contain w-full h-full"
              onError={() => handleImageError(productId)}
              loading="lazy"
              decoding="async"
            />
          )}
        </div>
        
        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col gap-1 mb-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {productId ? (
                  <button
                    onClick={() => router.push(`/admin/products/${productId}`)}
                    className="text-base font-bold text-gray-900 hover:text-blue-600 hover:underline text-right break-words"
                  >
                    {product.name || product.Name || 'N/A'}
                  </button>
                ) : (
                  <div className="text-base font-bold text-gray-900 text-right break-words">
                    {product.name || product.Name || 'N/A'}
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 mr-2">
                <span className="text-lg font-bold text-gray-900 whitespace-nowrap">
                  ₪{parseFloat(String(price)).toFixed(2)}
                </span>
              </div>
            </div>
            {product.brand || product.Brand ? (
              <div className="text-xs text-gray-500 text-right">
                {product.brand || product.Brand}
              </div>
            ) : null}
          </div>
          
          {/* Product ID and Barcode */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {productId && (
              <span className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-0.5 rounded">
                {productId}
              </span>
            )}
            {product['Shamel No'] && (
              <span className="text-xs text-gray-600 bg-gray-50 px-2 py-0.5 rounded">
                شامل: {product['Shamel No']}
              </span>
            )}
            {(product.barcode || product.Barcode) && (
              <span className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-0.5 rounded">
                {product.barcode || product.Barcode}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stock Information */}
      {(warehouseStock !== null || shopStock !== null) && (
        <div className="mb-3 p-2 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-600 mb-1">المخزون</div>
          <div className="flex items-center gap-3 flex-wrap">
            {warehouseStock !== null && (
              <div className="flex items-center gap-1">
                <Warehouse size={14} className="text-gray-400" />
                <span className="text-xs text-gray-700">
                  مخزن: <span className={`font-semibold ${warehouseStock > 0 ? 'text-green-700' : 'text-red-700'}`}>{warehouseStock}</span>
                </span>
              </div>
            )}
            {shopStock !== null && (
              <div className="flex items-center gap-1">
                <Store size={14} className="text-gray-400" />
                <span className="text-xs text-gray-700">
                  محل: <span className={`font-semibold ${shopStock > 0 ? 'text-green-700' : 'text-red-700'}`}>{shopStock}</span>
                </span>
              </div>
            )}
            {totalStock > 0 && (
              <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                المجموع: {totalStock}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Additional Info */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs text-gray-600">
        {product.type || product.Type ? (
          <div>
            <span className="text-gray-500">النوع:</span> {product.type || product.Type}
          </div>
        ) : null}
        {product.Origin ? (
          <div>
            <span className="text-gray-500">المنشأ:</span> {product.Origin}
          </div>
        ) : null}
        {product.Warranty ? (
          <div>
            <span className="text-gray-500">الضمان:</span> {product.Warranty}
          </div>
        ) : null}
        {costPrice !== null && (
          <div>
            <span className="text-gray-500">التكلفة:</span> <span className="font-semibold">₪{parseFloat(String(costPrice)).toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
        <button
          onClick={() => handleEdit(product)}
          className="flex-1 px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center justify-center gap-2 transition-colors text-sm"
        >
          <Edit size={16} />
          <span>تعديل</span>
        </button>
        <button
          onClick={() => handleGenerateAd(product)}
          className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 transition-colors text-sm"
          title="إنشاء إعلان تسويقي"
        >
          <Sparkles size={16} />
        </button>
        {canAccountant && (
          <button
            onClick={() => handleDeleteClick(product)}
            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 transition-colors text-sm"
            title="حذف المنتج"
          >
            <Trash size={16} />
          </button>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  return (
    prevProps.product.ProductID === nextProps.product.ProductID &&
    prevProps.product.id === nextProps.product.id &&
    prevProps.imageErrors[prevProps.product.ProductID || prevProps.product.id || ''] === 
    nextProps.imageErrors[nextProps.product.ProductID || nextProps.product.id || ''] &&
    prevProps.canViewCost === nextProps.canViewCost &&
    prevProps.canAccountant === nextProps.canAccountant
  );
});

MobileProductCard.displayName = 'MobileProductCard';

export default function ProductsManagerPage() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(''); // For input field - updates immediately
  const [searchQuery, setSearchQuery] = useState(''); // For actual filtering - updates in background
  const [isPending, startTransition] = useTransition();
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isMarketingModalOpen, setIsMarketingModalOpen] = useState(false);
  const [marketingProduct, setMarketingProduct] = useState<Product | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'saving' | 'success' | null }>({ message: '', type: null });
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const tableRef = useRef<any>(null);
  
  // Check if user has permission to view cost
  const canViewCost = admin?.is_super_admin || admin?.permissions?.viewCost === true;
  
  // Load column visibility from localStorage
  const getInitialColumnVisibility = (): Record<string, boolean> => {
    const baseVisibility = {
      T1Price: false,
      T2Price: false,
      Dimention: false,
      // Hide CostPrice by default if user doesn't have permission
      CostPrice: canViewCost ? true : false,
    };
    
    if (typeof window === 'undefined') {
      return baseVisibility;
    }
    
    try {
      const saved = localStorage.getItem('products-table-column-visibility');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...baseVisibility,
          ...parsed,
          // Always hide CostPrice if user doesn't have permission, regardless of saved state
          CostPrice: canViewCost ? (parsed.CostPrice !== false) : false,
        };
      }
    } catch (error) {
      console.error('[ProductsPage] Error loading column visibility:', error);
    }
    
    return baseVisibility;
  };

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(getInitialColumnVisibility);
  const [isColumnVisibilityOpen, setIsColumnVisibilityOpen] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(false);
  const columnVisibilityButtonRef = useRef<HTMLButtonElement>(null);
  
  // Mobile pagination state
  const [mobilePage, setMobilePage] = useState(1);
  const MOBILE_PAGE_SIZE = 20;
  
  // Debounce hook for search
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Debounced search handler
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value); // Update input immediately
    
    // Clear previous timeout
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    // Set new timeout for debounced search
    searchDebounceRef.current = setTimeout(() => {
      startTransition(() => {
        setSearchQuery(value);
        setMobilePage(1); // Reset to first page on search
      });
    }, 300); // 300ms debounce delay
  }, [startTransition]);
  
  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);
  
  // Save column visibility to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // Ensure CostPrice is always hidden if user doesn't have permission
      const visibilityToSave = {
        ...columnVisibility,
        CostPrice: canViewCost ? columnVisibility.CostPrice : false,
      };
      localStorage.setItem('products-table-column-visibility', JSON.stringify(visibilityToSave));
    } catch (error) {
      console.error('[ProductsPage] Error saving column visibility:', error);
    }
  }, [columnVisibility, canViewCost]);
  
  // Ensure CostPrice is always hidden if user doesn't have permission
  useEffect(() => {
    if (!canViewCost && columnVisibility.CostPrice !== false) {
      setColumnVisibility((prev) => ({
        ...prev,
        CostPrice: false,
      }));
    }
  }, [canViewCost, columnVisibility.CostPrice]);
  
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
  // Check if user has accountant permission (for delete)
  const canAccountant = admin?.is_super_admin || admin?.permissions?.accountant === true;
  
  // Inline barcode editing (table)
  const [editingBarcode, setEditingBarcode] = useState<string | null>(null);
  const [editingBarcodeValue, setEditingBarcodeValue] = useState('');
  const [savingBarcode, setSavingBarcode] = useState<string | null>(null);
  
  const enableGlobalSearch = true;

  useLayoutEffect(() => {
    document.title = 'المنتجات';
  }, []);

  // Set page title
  useEffect(() => {
    document.title = 'المنتجات - Products';
  }, []);

  // Handle scroll to hide/show header and check if near bottom
  useEffect(() => {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY || window.pageYOffset;
          const windowHeight = window.innerHeight;
          const documentHeight = document.documentElement.scrollHeight;
          
          // Check if within 200px of bottom for pagination
          const distanceFromBottom = documentHeight - (currentScrollY + windowHeight);
          setIsNearBottom(distanceFromBottom < 200);
          
          // Show/hide header when scrolling with threshold to prevent jitter
          const scrollDelta = currentScrollY - lastScrollY.current;
          const threshold = 10; // Minimum scroll delta to trigger hide/show (increased to reduce jitter)
          
          if (currentScrollY < 80) {
            // Always show header when near top
            setIsHeaderHidden(false);
          } else if (scrollDelta > threshold && currentScrollY > 150) {
            // Hide header when scrolling down past 150px
            setIsHeaderHidden(true);
          } else if (scrollDelta < -threshold && currentScrollY > 80) {
            // Show header when scrolling up (but not at top)
            setIsHeaderHidden(false);
          }
          
          lastScrollY.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check on mount
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Load products on mount
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        const data = await getProducts();
        setProducts(data || []);
      } catch (error) {
        console.error('[ProductsPage] Error loading products:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  // Reload products
  const reloadProducts = async () => {
    try {
      const data = await getProducts();
      setProducts(data || []);
    } catch (error) {
      console.error('[ProductsPage] Error reloading products:', error);
    }
  };

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
    setToast({ message: '', type: null });
  };

  const handleSaveSuccess = async () => {
    setToast({ message: 'Product Saved Successfully', type: 'success' });
    await reloadProducts();
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
      const result = await deleteProduct(productId, admin?.username);
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
      await reloadProducts();
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

  const handleImageError = (productId: string) => {
    setImageErrors((prev) => ({ ...prev, [productId]: true }));
  };

  const handleStartEditBarcode = useCallback((product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    const productId = product.ProductID || product.id || '';
    if (!productId) return;
    setEditingBarcode(productId);
    setEditingBarcodeValue(product.Barcode || product.barcode || '');
  }, []);

  const handleCancelEditBarcode = useCallback(() => {
    setEditingBarcode(null);
    setEditingBarcodeValue('');
  }, []);

  const handleSaveBarcode = useCallback(async (product: Product, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const productId = product.ProductID || product.id || '';
    if (!productId || editingBarcode !== productId) return;
    const barcodeValue = editingBarcodeValue.trim() || null;

    setSavingBarcode(productId);
    setProducts((prev) =>
      prev.map((p) => {
        const pid = p.ProductID || p.id || '';
        if (pid !== productId) return p;
        return { ...p, Barcode: barcodeValue ?? undefined, barcode: barcodeValue ?? undefined };
      })
    );
    setEditingBarcode(null);
    setEditingBarcodeValue('');

    saveProduct({
      ProductID: productId,
      Barcode: barcodeValue,
      Name: product.Name || product.name,
      Type: product.Type || product.type,
      Brand: product.Brand || product.brand,
      Origin: product.Origin || product.origin,
      Warranty: product.Warranty || product.warranty,
      Size: product.Size || product.size,
      Color: product.Color || product.color,
      Dimention: product.Dimention || product.dimention,
      CS_War: product.CS_War,
      CS_Shop: product.CS_Shop,
      CostPrice: product.CostPrice,
      SalePrice: product.SalePrice ?? product.price,
      T1Price: product.T1Price,
      T2Price: product.T2Price,
      'Shamel No': product['Shamel No'],
      Image: product.Image || product.image,
      'Image 2': product['Image 2'] || product.image2,
      'image 3': product['image 3'] || product.image3,
      is_serialized: product.is_serialized ?? product.IsSerialized ?? false,
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'خطأ غير معروف';
      setProducts((prev) =>
        prev.map((p) => {
          const pid = p.ProductID || p.id || '';
          if (pid !== productId) return p;
          return {
            ...p,
            Barcode: product.Barcode ?? product.barcode,
            barcode: product.Barcode ?? product.barcode,
          };
        })
      );
      alert(`فشل حفظ الباركود: ${msg}`);
    }).finally(() => {
      setSavingBarcode(null);
    });
  }, [editingBarcode, editingBarcodeValue]);

  const handleBarcodeKeyDown = useCallback((
    product: Product,
    e: React.KeyboardEvent<HTMLInputElement>,
    onSave: () => void,
    onCancel: () => void
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, []);

  // Define columns for the DataTable
  const columns: ColumnDef<Product>[] = useMemo(
    () => [
      {
        id: 'Image',
        accessorKey: 'Image',
        header: 'الصورة',
        enableSorting: false,
        enableHiding: false,
        enableColumnFilter: false,
        minSize: 100,
        cell: ({ row }) => {
          const product = row.original;
                    const rawImageUrl = product.image || product.Image || product.ImageUrl || '';
                    const imageUrl = getDirectImageUrl(rawImageUrl);
          const productId = product.id || product.ProductID || '';
          const hasImageError = imageErrors[productId] || !imageUrl;
                    
                    return (
                          <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden relative flex items-center justify-center">
                            {hasImageError || !imageUrl ? (
                              <ImageIcon size={24} className="text-gray-300" />
                            ) : (
                              <img
                                src={imageUrl}
                  alt={product.name || product.Name || ''}
                                className="object-contain w-full h-full"
                  onError={() => handleImageError(productId)}
                                loading="lazy"
                                decoding="async"
                              />
                            )}
                          </div>
          );
        },
      },
      {
        id: 'Name',
        accessorKey: 'Name',
        header: 'الاسم',
        enableSorting: true,
        enableHiding: false,
        minSize: 200,
        cell: ({ row }) => {
          const product = row.original;
          const name = product.name || product.Name || 'N/A';
          const brand = product.brand || product.Brand;
          const productId = product.ProductID || product.id || '';
          return (
            <div>
              {productId ? (
                <button
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey) {
                      // Open in new tab when Command/Ctrl is pressed
                      window.open(`/admin/products/${productId}`, '_blank');
                    } else {
                      // Navigate in same tab
                      router.push(`/admin/products/${productId}`);
                    }
                  }}
                  className="text-left font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  title="عرض بروفايل المنتج (اضغط Command/Ctrl لفتح في نافذة جديدة)"
                >
                  {name}
                </button>
              ) : (
                <div className="font-medium text-gray-900">{name}</div>
              )}
              {brand && <div className="text-xs text-gray-500 mt-1">{brand}</div>}
            </div>
          );
        },
      },
      {
        id: 'ProductID',
        accessorKey: 'ProductID',
        header: 'الرمز',
        enableSorting: true,
        minSize: 120,
        cell: ({ row }) => {
          const product = row.original;
          const productId = product.id || product.ProductID || 'N/A';
          const shamelNo = product['Shamel No'] || '';
          return (
            <div className="flex flex-col gap-1">
                          <div className="text-sm text-gray-900 font-mono">
                {productId}
                          </div>
              {shamelNo && (
                <div className="text-xs text-gray-500">
                  شامل: {shamelNo}
                            </div>
                          )}
                          </div>
          );
        },
      },
      {
        id: 'Barcode',
        accessorKey: 'Barcode',
        header: 'الباركود',
        enableSorting: true,
        minSize: 180,
        cell: ({ row }) => {
          const product = row.original;
          const productId = product.ProductID || product.id || '';
          const barcode = product.barcode || product.Barcode || '';
          const isEditing = editingBarcode === productId;
          const isSaving = savingBarcode === productId;
          return (
            <div className="flex items-center gap-2 min-w-0" onClick={(e) => e.stopPropagation()}>
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={editingBarcodeValue}
                    onChange={(e) => setEditingBarcodeValue(e.target.value)}
                    onKeyDown={(e) => handleBarcodeKeyDown(
                      product,
                      e,
                      () => handleSaveBarcode(product),
                      handleCancelEditBarcode
                    )}
                    className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 font-mono"
                    placeholder="أدخل الباركود"
                    autoFocus
                    disabled={isSaving}
                  />
                  <button
                    type="button"
                    onClick={(e) => handleSaveBarcode(product, e)}
                    disabled={isSaving}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50 shrink-0"
                    title="حفظ"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEditBarcode}
                    disabled={isSaving}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 shrink-0"
                    title="إلغاء"
                  >
                    <X size={16} />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 group min-w-0 flex-1">
                  <span className="text-sm text-gray-900 font-mono truncate min-w-0">
                    {barcode || <span className="text-gray-400">—</span>}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleStartEditBarcode(product, e)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    title="تعديل الباركود"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: 'ShamelNo',
        accessorKey: 'Shamel No',
        header: 'شامل رقم',
        enableSorting: true,
        enableColumnFilter: true,
        minSize: 120,
        cell: ({ row }) => {
          const product = row.original;
          const shamelNo = product['Shamel No'] || '';
          return shamelNo ? (
            <div className="text-sm text-gray-900">{shamelNo}</div>
          ) : (
            <span className="text-gray-400 text-sm">—</span>
          );
        },
      },
      {
        id: 'IsSerialized',
        accessorKey: 'is_serialized',
        header: 'رقم تسلسلي',
        enableSorting: true,
        enableColumnFilter: true,
        minSize: 100,
        cell: ({ row }) => {
          const product = row.original;
          const isSerialized = product.is_serialized || product.IsSerialized || false;
          return (
            <div className="flex items-center justify-center">
              {isSerialized ? (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  نعم
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  لا
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'SalePrice',
        accessorKey: 'SalePrice',
        header: 'سعر البيع',
        enableSorting: true,
        minSize: 120,
        cell: ({ row }) => {
          const product = row.original;
          const price = product.price || product.SalePrice || 0;
          return (
                          <div className="text-sm font-semibold text-gray-900">
              ₪{parseFloat(String(price)).toFixed(2)}
                            </div>
          );
        },
      },
      {
        id: 'CostPrice',
        accessorKey: 'CostPrice',
        header: 'سعر التكلفة',
        enableSorting: true,
        enableColumnFilter: true,
        enableHiding: canViewCost, // Only allow hiding if user has permission to view cost
        minSize: 120,
        cell: ({ row }) => {
          const product = row.original;
          if (!canViewCost) return <span className="text-gray-400 text-sm">—</span>;
          const costPrice = product.CostPrice;
          return costPrice !== undefined && costPrice !== null && costPrice !== '' ? (
            <div className="text-sm text-gray-600">₪{parseFloat(String(costPrice)).toFixed(2)}</div>
          ) : (
            <span className="text-gray-400 text-sm">—</span>
          );
        },
      },
      {
        id: 'T1Price',
        accessorKey: 'T1Price',
        header: 'سعر T1',
        enableSorting: true,
        minSize: 100,
        cell: ({ row }) => {
          const product = row.original;
          const t1Price = product.T1Price;
          return t1Price !== undefined && t1Price !== null && t1Price !== '' ? (
            <div className="text-sm text-gray-600">₪{parseFloat(String(t1Price)).toFixed(2)}</div>
          ) : (
            <span className="text-gray-400 text-sm">—</span>
          );
        },
      },
      {
        id: 'T2Price',
        accessorKey: 'T2Price',
        header: 'سعر T2',
        enableSorting: true,
        minSize: 100,
        cell: ({ row }) => {
          const product = row.original;
          const t2Price = product.T2Price;
          return t2Price !== undefined && t2Price !== null && t2Price !== '' ? (
            <div className="text-sm text-gray-600">₪{parseFloat(String(t2Price)).toFixed(2)}</div>
          ) : (
            <span className="text-gray-400 text-sm">—</span>
          );
        },
      },
      {
        id: 'Stock',
        accessorFn: (row) => (row.CS_War || 0) + (row.CS_Shop || 0),
        header: 'المخزون',
        enableSorting: true,
        minSize: 150,
        cell: ({ row }) => {
          const product = row.original;
          const warehouseStock = product.CS_War !== undefined && product.CS_War !== null ? (product.CS_War || 0) : null;
          const shopStock = product.CS_Shop !== undefined && product.CS_Shop !== null ? (product.CS_Shop || 0) : null;
          const total = (warehouseStock || 0) + (shopStock || 0);
          
          if (warehouseStock === null && shopStock === null) {
            return <span className="text-gray-400 text-sm">—</span>;
          }
          
          return (
                          <div className="text-sm text-gray-600">
                              <div className="flex flex-col gap-1">
                {warehouseStock !== null && (
                                  <span className="text-xs text-gray-500">
                                    م: <span className={`font-medium ${
                      warehouseStock > 0 ? 'text-green-700' : 'text-red-700'
                    }`}>{warehouseStock}</span>
                                  </span>
                                )}
                {shopStock !== null && (
                                  <span className="text-xs text-gray-500">
                                    مح: <span className={`font-medium ${
                      shopStock > 0 ? 'text-green-700' : 'text-red-700'
                    }`}>{shopStock}</span>
                                  </span>
                                )}
                {(warehouseStock || 0) + (shopStock || 0) > 0 && (
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                      total > 0
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                  >
                    المجموع: {total}
                                  </span>
                                )}
                              </div>
                          </div>
          );
        },
      },
      {
        id: 'Type',
        accessorKey: 'Type',
        header: 'النوع',
        enableSorting: true,
        minSize: 120,
        cell: ({ row }) => {
          const product = row.original;
          const type = product.type || product.Type || '';
          return type ? (
            <div className="text-sm text-gray-900">{type}</div>
          ) : (
            <span className="text-gray-400 text-sm">—</span>
          );
        },
      },
      {
        id: 'Brand',
        accessorKey: 'Brand',
        header: 'العلامة التجارية',
        enableSorting: true,
        minSize: 150,
        cell: ({ row }) => {
          const product = row.original;
          const brand = product.brand || product.Brand || '';
          return brand ? (
            <div className="text-sm text-gray-900">{brand}</div>
          ) : (
            <span className="text-gray-400 text-sm">—</span>
          );
        },
      },
      {
        id: 'Origin',
        accessorKey: 'Origin',
        header: 'المنشأ',
        enableSorting: true,
        minSize: 120,
        cell: ({ row }) => {
          const product = row.original;
          const origin = product.Origin || '';
          return origin ? (
            <div className="text-sm text-gray-900">{origin}</div>
          ) : (
            <span className="text-gray-400 text-sm">—</span>
          );
        },
      },
      {
        id: 'Warranty',
        accessorKey: 'Warranty',
        header: 'الضمان',
        enableSorting: true,
        minSize: 120,
        cell: ({ row }) => {
          const product = row.original;
          const warranty = product.Warranty || '';
          return warranty ? (
            <div className="text-sm text-gray-900">{warranty}</div>
          ) : (
            <span className="text-gray-400 text-sm">—</span>
          );
        },
      },
      {
        id: 'Size',
        accessorKey: 'Size',
        header: 'الحجم',
        enableSorting: true,
        minSize: 100,
        cell: ({ row }) => {
          const product = row.original;
          const size = product.size || product.Size || '';
          return size ? (
            <div className="text-sm text-gray-900">{size}</div>
          ) : (
            <span className="text-gray-400 text-sm">—</span>
          );
        },
      },
      {
        id: 'Color',
        accessorKey: 'Color',
        header: 'اللون',
        enableSorting: true,
        minSize: 100,
        cell: ({ row }) => {
          const product = row.original;
          const color = product.color || product.Color || '';
          return color ? (
            <div className="text-sm text-gray-900">{color}</div>
          ) : (
            <span className="text-gray-400 text-sm">—</span>
          );
        },
      },
      {
        id: 'Dimention',
        accessorKey: 'Dimention',
        header: 'الأبعاد',
        enableSorting: true,
        minSize: 120,
        cell: ({ row }) => {
          const product = row.original;
          const dimension = product.Dimention || '';
          return dimension ? (
            <div className="text-sm text-gray-900">{dimension}</div>
          ) : (
            <span className="text-gray-400 text-sm">—</span>
          );
        },
      },
      {
        id: 'Actions',
        header: 'الإجراءات',
        enableSorting: false,
        enableHiding: false,
        enableColumnFilter: false,
        minSize: 150,
        cell: ({ row }) => {
          const product = row.original;
          const productId = product.ProductID || product.id || '';
          return (
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
                          {canAccountant && (
                            <button
                              onClick={() => handleDeleteClick(product)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Product"
                            >
                              <Trash size={18} />
                            </button>
                          )}
                          </div>
          );
        },
      },
    ],
    [
      canViewCost,
      canAccountant,
      imageErrors,
      router,
      editingBarcode,
      editingBarcodeValue,
      savingBarcode,
      handleStartEditBarcode,
      handleCancelEditBarcode,
      handleSaveBarcode,
      handleBarcodeKeyDown,
    ]
  );

  // Filter products based on search query (additional to column filters)
  // Optimized with early returns and cached lowercase strings
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) {
      return products;
    }

    const searchWords = searchQuery
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);

    if (searchWords.length === 0) {
      return products;
    }

    // Pre-compute searchable text for better performance
    return products.filter((p) => {
      const name = String(p.name || p.Name || '').toLowerCase();
      const id = String(p.id || p.ProductID || '').toLowerCase();
      const barcode = String(p.barcode || p.Barcode || '').toLowerCase();
      const brand = String(p.brand || p.Brand || '').toLowerCase();

      const searchableText = `${name} ${id} ${barcode} ${brand}`;
      return searchWords.every((word) => searchableText.includes(word));
    });
  }, [products, searchQuery]);
  
  // Paginated products for mobile view
  const paginatedMobileProducts = useMemo(() => {
    const startIndex = (mobilePage - 1) * MOBILE_PAGE_SIZE;
    const endIndex = startIndex + MOBILE_PAGE_SIZE;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, mobilePage]);
  
  const totalMobilePages = Math.ceil(filteredProducts.length / MOBILE_PAGE_SIZE);
  
  // Reset mobile page when filtered products change significantly
  useEffect(() => {
    if (mobilePage > totalMobilePages && totalMobilePages > 0) {
      setMobilePage(1);
    }
  }, [totalMobilePages, mobilePage]);
                  
                  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div
          ref={headerRef}
          className="relative"
          style={{
            maxHeight: isHeaderHidden ? '0' : '300px',
            marginBottom: isHeaderHidden ? '0' : '1.5rem',
            overflow: isHeaderHidden ? 'hidden' : 'visible',
            transitionProperty: 'max-height, margin-bottom',
            transitionDuration: '250ms',
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
            willChange: 'max-height, margin-bottom',
          }}
        >
          <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">المنتجات</h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">
                  إدارة مخزون المنتجات ({products.length} منتج)
                </p>
              </div>
              <button
                onClick={handleAddNew}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                <Plus size={20} />
                <span>إضافة منتج جديد</span>
              </button>
            </div>
          
          {/* Global Search and Column Visibility */}
          {enableGlobalSearch && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1 relative">
                <Search
                  size={18}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="البحث بالاسم، الرمز، الباركود، أو العلامة التجارية..."
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-500 text-sm sm:text-base"
                  dir="rtl"
                />
                {searchInput && (
                  <button
                    onClick={() => handleSearchChange('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              
              {/* Column Visibility Toggle - Desktop Only */}
              {!loading && filteredProducts.length > 0 && (
                <div className="relative hidden md:block">
                    <button
                    ref={columnVisibilityButtonRef}
                    type="button"
                    onClick={() => {
                      setIsColumnVisibilityOpen(!isColumnVisibilityOpen);
                    }}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors text-sm font-medium text-gray-700 whitespace-nowrap cursor-pointer"
                  >
                    <Eye size={16} />
                    <span>الأعمدة</span>
                    {Object.values(columnVisibility).some((v) => !v) && (
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs">
                        {Object.values(columnVisibility).filter((v) => !v).length}
                      </span>
                    )}
                    </button>

                  {isColumnVisibilityOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-[90]"
                        onClick={() => setIsColumnVisibilityOpen(false)}
                      />
                      <div 
                        className="absolute left-0 top-full mt-2 w-64 bg-white border border-gray-300 rounded-lg shadow-lg z-[100] p-3 max-h-96 overflow-y-auto" 
                        dir="rtl"
                        onClick={(e) => e.stopPropagation()}
                        style={{ position: 'absolute' }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-gray-900 text-sm">إظهار/إخفاء الأعمدة</h3>
              <button
                            onClick={() => setIsColumnVisibilityOpen(false)}
                            className="p-1 hover:bg-gray-100 rounded"
              >
                            <X size={16} />
              </button>
            </div>
                        <div className="space-y-2">
                          {columns
                            .filter((col: any) => {
                              // Filter out columns that should not be shown in the visibility list
                              if (col.id === 'Actions' || col.id === 'Image') return false;
                              // Hide CostPrice column from visibility list if user doesn't have permission
                              if (col.id === 'CostPrice' && !canViewCost) return false;
                              // Only show columns that can be hidden/shown
                              return col.enableHiding !== false;
                            })
                            .map((col: any) => {
                              const columnId = col.id || col.accessorKey || col.accessorFn?.toString();
                              const headerText = typeof col.header === 'string' ? col.header : columnId;
                              const isVisible = columnVisibility[columnId] !== false;
                              return (
                                <label
                                  key={columnId}
                                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isVisible}
                                    onChange={(e) => {
                                      setColumnVisibility((prev) => ({
                                        ...prev,
                                        [columnId]: e.target.checked,
                                      }));
                                      // Update table if available
                                      if (tableRef.current) {
                                        const tableColumn = tableRef.current.getAllColumns().find((c: any) => c.id === columnId);
                                        if (tableColumn) {
                                          tableColumn.toggleVisibility(e.target.checked);
                                        }
                                      }
                                    }}
                                    className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                                  />
                                  <span className="text-sm text-gray-700 flex-1">
                                    {headerText}
                                  </span>
                                  {isVisible && <Check size={14} className="text-gray-600" />}
                                </label>
                              );
                            })}
            </div>
          </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block">
          {loading ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">جاري التحميل...</p>
            </div>
          ) : filteredProducts.length === 0 && !searchQuery ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Package size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">لا توجد منتجات</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredProducts}
              enableColumnFilters={true}
              enableGlobalSearch={false}
              pageSize={20}
              enableColumnVisibility={false}
              defaultColumnVisibility={columnVisibility}
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
              tableRef={tableRef}
              hideToolbar={true}
              showStickyPagination={isNearBottom}
              stickyHeaderOffset={0}
            />
          )}
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <div className="flex items-center justify-center gap-2 text-gray-500">
                <Loader2 className="animate-spin" size={20} />
                <span>جاري التحميل...</span>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              {searchQuery ? 'لا توجد نتائج للبحث' : 'لا توجد منتجات'}
            </div>
          ) : isPending ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <div className="flex items-center justify-center gap-2 text-gray-500">
                <Loader2 className="animate-spin" size={20} />
                <span>جاري البحث...</span>
              </div>
            </div>
          ) : (
            <>
              {paginatedMobileProducts.map((product) => {
                const productId = product.ProductID || product.id || '';
                return (
                  <MobileProductCard
                    key={productId}
                    product={product}
                    imageErrors={imageErrors}
                    canViewCost={canViewCost}
                    canAccountant={canAccountant}
                    router={router}
                    handleEdit={handleEdit}
                    handleGenerateAd={handleGenerateAd}
                    handleDeleteClick={handleDeleteClick}
                    handleImageError={handleImageError}
                  />
                );
              })}
              
              {/* Mobile Pagination */}
              {totalMobilePages > 1 && (
                <div className="flex items-center justify-between gap-4 pt-4 pb-2 border-t border-gray-200 bg-white sticky bottom-0 z-10">
                  <button
                    onClick={() => setMobilePage((prev) => Math.max(1, prev - 1))}
                    disabled={mobilePage === 1}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium text-gray-900"
                  >
                    <ChevronRight size={16} />
                    السابق
                  </button>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="font-medium">
                      صفحة {mobilePage} من {totalMobilePages}
                    </span>
                    <span className="text-gray-500">
                      ({filteredProducts.length} منتج)
                    </span>
                  </div>
                  
                  <button
                    onClick={() => setMobilePage((prev) => Math.min(totalMobilePages, prev + 1))}
                    disabled={mobilePage === totalMobilePages}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium text-gray-900"
                  >
                    التالي
                    <ChevronLeft size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Delete confirmation modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
            <div className="bg-white w-full max-w-lg rounded-lg shadow-2xl p-6 relative">
              <button
                onClick={closeDeleteModal}
                className="absolute top-3 left-3 p-2 rounded-full hover:bg-gray-100"
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

              <div className="flex items-center justify-start gap-3 mt-6" dir="rtl">
                <button
                  onClick={confirmDelete}
                  disabled={deleteState.loading || deleteState.status === 'blocked' || deleteState.status === 'deleted'}
                  className="px-4 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {deleteState.loading ? 'جاري الحذف...' : 'تأكيد الحذف'}
                </button>
                <button
                  onClick={closeDeleteModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={deleteState.loading}
                >
                  إلغاء
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
        <div className="fixed bottom-4 left-4 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300" dir="rtl">
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