'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useTransition, memo } from 'react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Search, Printer, Loader2, CheckSquare, Square, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '@/types';
import { getProducts, saveProduct } from '@/lib/api';
import LabelsTableRow from '@/components/admin/LabelsTableRow';
import BarcodeScannerInput from '@/components/admin/BarcodeScannerInput';
import CatalogPdfGenerator from '@/components/admin/CatalogPdfGenerator';
import { useRouter } from 'next/navigation';

type LabelType = 'A' | 'B' | 'C' | 'D';
type QuantitySource = 'shop' | 'warehouse' | 'one';
type SortField = 'price' | 'quantity' | null;
type SortDirection = 'asc' | 'desc';

const LABELS_PAGE_SIZE = 50;

export default function LabelsPage() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [labelType, setLabelType] = useState<LabelType>('A');
  const [quantitySource, setQuantitySource] = useState<QuantitySource>('shop'); // shop | warehouse | one
  const useQuantity = quantitySource !== 'one'; // true when repeating by quantity (shop or warehouse)
  const [showZeroQuantity, setShowZeroQuantity] = useState<boolean>(true); // true = إظهار الأصناف ذات الكمية صفر, false = إخفاءها
  const [useQrProductUrl, setUseQrProductUrl] = useState<boolean>(false); // false = QR الباركود/الشامل (افتراضي)، true = QR يفتح صفحة المنتج (لأنواع أ، ب، ج فقط)
  const [showQrInCatalog, setShowQrInCatalog] = useState<boolean>(false); // لنوع د: false = عدم إظهار QR (افتراضي)، true = إظهار QR لفتح صفحة المنتج
  const [showZeroShopCatalog, setShowZeroShopCatalog] = useState<boolean>(true); // لنوع د: إظهار المنتجات التي كميتها صفر في المحل
  const [showZeroWarehouseCatalog, setShowZeroWarehouseCatalog] = useState<boolean>(true); // لنوع د: إظهار المنتجات التي كميتها صفر في المخزن
  const [showPriceInCatalog, setShowPriceInCatalog] = useState<boolean>(true); // لنوع د: إظهار السعر في الكتالوج
  const [hideCatalogHeader, setHideCatalogHeader] = useState<boolean>(false); // لنوع د: الطباعة بلا الترويسة الخاصة بالمعرض
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [editingBarcode, setEditingBarcode] = useState<string | null>(null); // productId being edited
  const [editingBarcodeValue, setEditingBarcodeValue] = useState<string>(''); // temporary value while editing
  const [savingBarcode, setSavingBarcode] = useState<string | null>(null); // productId being saved
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({}); // productId -> custom quantity for printing
  const [editingQuantity, setEditingQuantity] = useState<string | null>(null); // productId being edited
  const [editingQuantityValue, setEditingQuantityValue] = useState<string>(''); // temporary value while editing

  const [labelsPage, setLabelsPage] = useState(1);

  useLayoutEffect(() => {
    document.title = 'طباعة الملصقات';
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (error: unknown) {
      console.error('[LabelsPage] Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Debounce search query for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when filters/sort change
  useEffect(() => {
    setLabelsPage(1);
  }, [debouncedSearchQuery, sortField, sortDirection]);


  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Apply search - supports multiple words (e.g., "ثلاجة سامسونج" will find products with both words)
    if (debouncedSearchQuery.trim()) {
      // Split search query into individual words
      const searchWords = debouncedSearchQuery
        .toLowerCase()
        .split(/\s+/)
        .map(word => word.trim())
        .filter(word => word.length > 0);

      filtered = filtered.filter((p) => {
        // Safely convert all values to strings and create searchable text
        const name = String(p.Name || p.name || '').toLowerCase();
        const id = String(p.ProductID || p.id || '').toLowerCase();
        const shamelNo = String(p['Shamel No'] || p.ShamelNo || p.shamel_no || '').toLowerCase();
        const barcode = String(p.Barcode || p.barcode || '').toLowerCase();
        const brand = String(p.Brand || p.brand || '').toLowerCase();
        const type = String(p.Type || p.type || '').toLowerCase();

        // Combine all searchable fields into one text
        const searchableText = `${name} ${id} ${shamelNo} ${barcode} ${brand} ${type}`;

        // Check if ALL search words are found in the searchable text
        return searchWords.every(word => searchableText.includes(word));
      });
    }

    // Apply sorting
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: number;
        let bValue: number;

        if (sortField === 'price') {
          aValue = a.SalePrice || a.price || 0;
          bValue = b.SalePrice || b.price || 0;
        } else if (sortField === 'quantity') {
          aValue = a.CS_Shop || a.cs_shop || 0;
          bValue = b.CS_Shop || b.cs_shop || 0;
        } else {
          return 0;
        }

        if (sortDirection === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      });
    } else {
      // Default: sort by last restocked / created (newest first)
      filtered = [...filtered].sort((a, b) => {
        const aRestock = a.last_restocked_at || a.LastRestockedAt || a.created_at;
        const aCreated = a.created_at;
        const aTime = Math.max(
          aRestock ? new Date(aRestock).getTime() : 0,
          aCreated ? new Date(aCreated).getTime() : 0
        );
        const bRestock = b.last_restocked_at || b.LastRestockedAt || b.created_at;
        const bCreated = b.created_at;
        const bTime = Math.max(
          bRestock ? new Date(bRestock).getTime() : 0,
          bCreated ? new Date(bCreated).getTime() : 0
        );
        return bTime - aTime;
      });
    }

    return filtered;
  }, [products, debouncedSearchQuery, sortField, sortDirection]);

  const paginatedProducts = useMemo(() => {
    const start = (labelsPage - 1) * LABELS_PAGE_SIZE;
    return filteredProducts.slice(start, start + LABELS_PAGE_SIZE);
  }, [filteredProducts, labelsPage]);

  const totalLabelsPages = Math.max(1, Math.ceil(filteredProducts.length / LABELS_PAGE_SIZE));
  const labelsPageStart = filteredProducts.length === 0 ? 0 : (labelsPage - 1) * LABELS_PAGE_SIZE + 1;
  const labelsPageEnd = Math.min(labelsPage * LABELS_PAGE_SIZE, filteredProducts.length);

  const [isPending, startTransition] = useTransition();

  // Clamp page when filtered list shrinks (e.g. after search)
  useEffect(() => {
    setLabelsPage((p) => (p > totalLabelsPages ? totalLabelsPages : p));
  }, [totalLabelsPages]);

  const toggleProduct = useCallback((productId: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    startTransition(() => {
      if (selectedProducts.size === filteredProducts.length) {
        setSelectedProducts(new Set());
      } else {
        setSelectedProducts(new Set(filteredProducts.map((p) => p.ProductID || p.id || '')));
      }
    });
  }, [selectedProducts.size, filteredProducts]);

  const handleSort = useCallback((field: SortField) => {
    startTransition(() => {
      if (sortField === field) {
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
    });
  }, [sortField, sortDirection]);

  const handleStartEditBarcode = useCallback((product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    const productId = product.ProductID || product.id || '';
    if (!productId) return;
    setEditingBarcode(productId);
    setEditingBarcodeValue(product.Barcode || product.barcode || '');
  }, []);

  const handleCancelEditBarcode = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingBarcode(null);
    setEditingBarcodeValue('');
  }, []);

  const handleSaveBarcode = useCallback(async (product: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const productId = product.ProductID || product.id || '';
    if (!productId || !editingBarcode || editingBarcode !== productId) return;

    setSavingBarcode(productId);
    const barcodeValue = editingBarcodeValue.trim() || null;
    
    // Update local state immediately for instant feedback
    setProducts((prevProducts) =>
      prevProducts.map((p) => {
        const pid = p.ProductID || p.id || '';
        if (pid === productId) {
          return {
            ...p,
            Barcode: barcodeValue || undefined,
            barcode: barcodeValue || undefined,
          };
        }
        return p;
      })
    );
    setEditingBarcode(null);
    setEditingBarcodeValue('');

    // Save to database in background (non-blocking)
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
      SalePrice: product.SalePrice || product.price,
      T1Price: product.T1Price,
      T2Price: product.T2Price,
      'Shamel No': product['Shamel No'],
      Image: product.Image || product.image,
      'Image 2': product['Image 2'] || product.image2,
      'image 3': product['image 3'] || product.image3,
      is_serialized: product.is_serialized || product.IsSerialized || false,
    }).catch((error: any) => {
      console.error('[LabelsPage] Failed to save barcode:', error);
      // Revert on error
      setProducts((prevProducts) =>
        prevProducts.map((p) => {
          const pid = p.ProductID || p.id || '';
          if (pid === productId) {
            return {
              ...p,
              Barcode: product.Barcode || product.barcode || undefined,
              barcode: product.Barcode || product.barcode || undefined,
            };
          }
          return p;
        })
      );
      alert(`فشل حفظ الباركود: ${error.message || 'خطأ غير معروف'}`);
    }).finally(() => {
      setSavingBarcode(null);
    });
  }, [editingBarcode, editingBarcodeValue]);

  const handleBarcodeKeyDown = useCallback((product: Product, e: React.KeyboardEvent<HTMLInputElement>, onSave: () => void, onCancel: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, []);

  const handleStartEditQuantity = useCallback((product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    const productId = product.ProductID || product.id || '';
    if (!productId) return;
    const fallback = quantitySource === 'warehouse'
      ? (product.CS_War ?? product.cs_war ?? 0)
      : (product.CS_Shop ?? product.cs_shop ?? 0);
    const currentQuantity = customQuantities[productId] ?? fallback;
    setEditingQuantity(productId);
    setEditingQuantityValue(String(currentQuantity));
  }, [customQuantities, quantitySource]);

  const handleCancelEditQuantity = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingQuantity(null);
    setEditingQuantityValue('');
  }, []);

  const handleSaveQuantity = useCallback((product: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const productId = product.ProductID || product.id || '';
    if (!productId || !editingQuantity || editingQuantity !== productId) return;

    const quantityValue = parseInt(editingQuantityValue.trim(), 10);
    if (isNaN(quantityValue) || quantityValue < 0) {
      alert('يرجى إدخال رقم صحيح أكبر من أو يساوي صفر');
      return;
    }

    setCustomQuantities((prev) => ({
      ...prev,
      [productId]: quantityValue,
    }));

    setEditingQuantity(null);
    setEditingQuantityValue('');
  }, [editingQuantity, editingQuantityValue]);

  const handleQuantityKeyDown = useCallback((product: Product, e: React.KeyboardEvent<HTMLInputElement>, onSave: () => void, onCancel: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, []);

  const getPrintQuantity = useCallback((product: Product): number => {
    const productId = product.ProductID || product.id || '';
    if (customQuantities[productId] !== undefined) {
      return customQuantities[productId];
    }
    if (quantitySource === 'warehouse') return product.CS_War ?? product.cs_war ?? 0;
    if (quantitySource === 'shop') return product.CS_Shop ?? product.cs_shop ?? 0;
    return 1;
  }, [customQuantities, quantitySource]);

  const selectedProductsList = useMemo(() => {
    const selectedIds = Array.from(selectedProducts);
    if (selectedIds.length === 0) return [];
    
    const filtered = [];
    for (const p of products) {
      const productId = p.ProductID || p.id || '';
      if (selectedProducts.has(productId)) {
        let printQuantity: number;
        if (customQuantities[productId] !== undefined) {
          printQuantity = customQuantities[productId];
        } else if (quantitySource === 'warehouse') {
          printQuantity = p.CS_War ?? p.cs_war ?? 0;
        } else if (quantitySource === 'shop') {
          printQuantity = p.CS_Shop ?? p.cs_shop ?? 0;
        } else {
          printQuantity = 1;
        }
        filtered.push({ ...p, printQuantity });
      }
    }
    return filtered;
  }, [products, selectedProducts, customQuantities, quantitySource]);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProducts, setPdfProducts] = useState<Product[]>([]);

  const handlePrint = () => {
    if (selectedProductsList.length === 0) {
      alert('يرجى تحديد منتج واحد على الأقل للطباعة');
      return;
    }

    // لنوع د: تصفية المنتجات حسب خيارات إظهار الكمية صفر في المحل/المخزن
    const productsToPrint =
      labelType === 'D'
        ? selectedProductsList.filter((p) => {
            const shopQty = (p as any).CS_Shop ?? (p as any).cs_shop ?? 0;
            const warQty = (p as any).CS_War ?? (p as any).cs_war ?? 0;
            const includeByShop = showZeroShopCatalog || shopQty > 0;
            const includeByWarehouse = showZeroWarehouseCatalog || warQty > 0;
            return includeByShop && includeByWarehouse;
          })
        : selectedProductsList;

    if (labelType === 'D' && productsToPrint.length === 0) {
      alert('لا توجد منتجات تطابق الخيارات المحددة. غيّر خيارات إظهار الكميات أو حدد منتجات أخرى.');
      return;
    }

    openPrintWindow(productsToPrint, 'print');
  };

  const handleDownloadPdf = () => {
    if (labelType !== 'D') return;

    if (selectedProductsList.length === 0) {
      alert('يرجى تحديد منتج واحد على الأقل للتنزيل');
      return;
    }

    const productsToPrint = selectedProductsList.filter((p) => {
      const shopQty = (p as any).CS_Shop ?? (p as any).cs_shop ?? 0;
      const warQty = (p as any).CS_War ?? (p as any).cs_war ?? 0;
      const includeByShop = showZeroShopCatalog || shopQty > 0;
      const includeByWarehouse = showZeroWarehouseCatalog || warQty > 0;
      return includeByShop && includeByWarehouse;
    });

    if (productsToPrint.length === 0) {
      alert('لا توجد منتجات تطابق الخيارات المحددة للتنزيل.');
      return;
    }

    // Set products for the hidden renderer and trigger generation
    setPdfProducts(productsToPrint);
    setIsGeneratingPdf(true);
    // Small delay to allow render before capture
    setTimeout(() => {
      const fn = (window as any).__catalogPdfGenerate;
      if (typeof fn === 'function') fn();
    }, 300);
  };

  const openPrintWindow = (productsToPrint: any[], mode: 'print' | 'download') => {
    // Store products and labelType in sessionStorage to avoid URL length limits
    const printData = {
      products: productsToPrint,
      labelType: labelType,
      useQuantity: labelType === 'C' ? useQuantity : true,
      showZeroQuantity: labelType === 'C' ? showZeroQuantity : true,
      useQrProductUrl,
      showQrInCatalog: labelType === 'D' ? showQrInCatalog : undefined,
      showPriceInCatalog: labelType === 'D' ? showPriceInCatalog : undefined,
      hideCatalogHeader: labelType === 'D' ? hideCatalogHeader : undefined,
      mode: mode,
      timestamp: Date.now(),
    };
    
    try {
      const dataString = JSON.stringify(printData);
      localStorage.setItem('labelsPrintData', dataString);
      
      const printUrl = `/admin/labels/print?t=${Date.now()}${mode === 'download' ? '&download=true' : ''}`;
      
      if (mode === 'download') {
        // Use hidden iframe for download
        let iframe = document.getElementById('pdf-download-iframe') as HTMLIFrameElement;
        if (!iframe) {
          iframe = document.createElement('iframe');
          iframe.id = 'pdf-download-iframe';
          iframe.style.display = 'none';
          document.body.appendChild(iframe);
        }
        iframe.src = printUrl;
      } else {
        // Use new window for print
        window.open(printUrl, 'labels-print', 'noopener,noreferrer');
      }
      
      setTimeout(() => {
        // Cleanup localStorage after a bit
        if (mode === 'print') {
          // Keep it longer for the window
        } else {
          localStorage.removeItem('labelsPrintData');
        }
      }, 5000);
    } catch (error: any) {
      console.error('[LabelsPage] Failed to store print data:', error);
      alert('فشل تحضير البيانات. يرجى المحاولة مرة أخرى.');
      setIsGeneratingPdf(false);
    }
  };

  if (!admin) return null;

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-800/50 p-6 no-print" dir="rtl">
        <div className="max-w-7xl mx-auto no-print">
          {/* Header */}
          <div className="mb-8 no-print flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-50 mb-2 tracking-tight">طباعة ملصقات الأسعار</h1>
              <p className="text-gray-600 dark:text-gray-400 font-medium">اختر المنتجات وحدد نوع الملصق للطباعة</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Product Selection */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4 no-print">
              {/* مسح الباركود: ماسح خارجي أو كاميرا — يحدد الصنف تلقائياً ويبقى جاهزاً لمسح جديد */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-200 dark:border-slate-700/50 shadow-sm">
                <label className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-3 font-cairo">مسح الباركود أو رقم الشامل</label>
                <BarcodeScannerInput
                  onProductFound={(product) => {
                    const productId = product.ProductID || product.id || '';
                    if (productId) toggleProduct(productId);
                  }}
                  products={products}
                  placeholder="امسح الباركود أو رقم الشامل..."
                  className="w-full"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-cairo leading-relaxed flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  الماسح الخارجي أو كاميرا الموبايل — كل مسح يحدد/يلغي الصنف ويجهز لمسح التالي
                </p>
              </div>
              {/* بحث نصي عن المنتجات */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                  <input
                    type="text"
                    placeholder="ابحث عن منتج..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-gray-400 dark:text-gray-500" size={32} />
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleAll}
                        className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900"
                      >
                        {selectedProducts.size === filteredProducts.length ? (
                          <CheckSquare size={18} className="text-gray-900 dark:text-gray-100" />
                        ) : (
                          <Square size={18} className="text-gray-400 dark:text-gray-500" />
                        )}
                        <span>تحديد الكل</span>
                      </button>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({selectedProducts.size} منتج محدد)
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto -mx-1 px-1">
                    <table className="w-full border-separate border-spacing-0">
                      <thead className="hidden md:table-header-group">
                        <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30">
                          <th className="text-right py-3 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700 rounded-tr-lg">تحديد</th>
                          <th className="text-right py-3 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">الصورة</th>
                          <th className="text-right py-3 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">الاسم</th>
                          <th className="text-right py-3 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">الباركود</th>
                          {labelType === 'C' && useQuantity && (
                            <th className="text-right py-3 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">الكمية للطباعة</th>
                          )}
                          <th 
                            className="text-right py-3 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors select-none"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSort('price');
                            }}
                          >
                            <div className="flex items-center justify-end gap-1.5">
                              <span>السعر</span>
                              {sortField === 'price' && (
                                sortDirection === 'asc' ? (
                                  <ArrowUp size={12} className="text-blue-600 dark:text-blue-400" />
                                ) : (
                                  <ArrowDown size={12} className="text-blue-600 dark:text-blue-400" />
                                )
                              )}
                            </div>
                          </th>
                          <th 
                            className="text-right py-3 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700 rounded-tl-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors select-none"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSort('quantity');
                            }}
                          >
                            <div className="flex items-center justify-end gap-1.5">
                              <span>المخزون</span>
                              {sortField === 'quantity' && (
                                sortDirection === 'asc' ? (
                                  <ArrowUp size={12} className="text-blue-600 dark:text-blue-400" />
                                ) : (
                                  <ArrowDown size={12} className="text-blue-600 dark:text-blue-400" />
                                )
                              )}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="flex flex-col md:table-row-group">
                        {filteredProducts.length === 0 ? (
                          <tr>
                            <td colSpan={labelType === 'C' && useQuantity ? 7 : 6} className="text-center py-8 text-gray-500 dark:text-gray-400">
                              لا توجد منتجات
                            </td>
                          </tr>
                        ) : (
                          paginatedProducts.map((product) => {
                            const productId = product.ProductID || product.id || '';
                            return (
                              <LabelsTableRow
                                key={productId}
                                product={product}
                                isSelected={selectedProducts.has(productId)}
                                labelType={labelType}
                                useQuantity={useQuantity}
                                quantitySource={quantitySource}
                                editingBarcode={editingBarcode}
                                editingBarcodeValue={editingBarcodeValue}
                                savingBarcode={savingBarcode}
                                editingQuantity={editingQuantity}
                                editingQuantityValue={editingQuantityValue}
                                printQuantity={getPrintQuantity(product)}
                                onToggle={toggleProduct}
                                onStartEditBarcode={handleStartEditBarcode}
                                onCancelEditBarcode={handleCancelEditBarcode}
                                onSaveBarcode={handleSaveBarcode}
                                onBarcodeKeyDown={handleBarcodeKeyDown}
                                onStartEditQuantity={handleStartEditQuantity}
                                onCancelEditQuantity={handleCancelEditQuantity}
                                onSaveQuantity={handleSaveQuantity}
                                onQuantityKeyDown={handleQuantityKeyDown}
                                onBarcodeValueChange={setEditingBarcodeValue}
                                onQuantityValueChange={setEditingQuantityValue}
                              />
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  {filteredProducts.length > 0 && (
                    <div className="flex items-center justify-between gap-4 mt-3 px-1">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        عرض {labelsPageStart}–{labelsPageEnd} من {filteredProducts.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setLabelsPage((p) => Math.max(1, p - 1))}
                          disabled={labelsPage <= 1}
                          className="p-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title="السابق"
                        >
                          <ChevronRight size={18} />
                        </button>
                        <span className="text-sm text-gray-700 dark:text-gray-300 min-w-[5rem] text-center">
                          {labelsPage} / {totalLabelsPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setLabelsPage((p) => Math.min(totalLabelsPages, p + 1))}
                          disabled={labelsPage >= totalLabelsPages}
                          className="p-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title="التالي"
                        >
                          <ChevronLeft size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right Column: Preview & Settings */}
            <div className="lg:col-span-1 space-y-4 no-print">
              {/* Label Type Selector */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4 no-print">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">نوع الملصق</h2>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="labelType"
                      value="A"
                      checked={labelType === 'A'}
                      onChange={(e) => setLabelType(e.target.value as LabelType)}
                      className="w-4 h-4 text-gray-900 dark:text-gray-100 focus:ring-gray-900 dark:focus:ring-gray-100"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">نوع أ - كبير (ثلاجة)</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">A6 - ملصق واحد لكل صفحة</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="labelType"
                      value="B"
                      checked={labelType === 'B'}
                      onChange={(e) => setLabelType(e.target.value as LabelType)}
                      className="w-4 h-4 text-gray-900 dark:text-gray-100 focus:ring-gray-900 dark:focus:ring-gray-100"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">نوع ب - متوسط</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">A6 - 4 ملصقات (2×2)</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="labelType"
                      value="C"
                      checked={labelType === 'C'}
                      onChange={(e) => setLabelType(e.target.value as LabelType)}
                      className="w-4 h-4 text-gray-900 dark:text-gray-100 focus:ring-gray-900 dark:focus:ring-gray-100"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">نوع ج - صغير (رف)</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">A4 - 70mm × 29.7mm</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="labelType"
                      value="D"
                      checked={labelType === 'D'}
                      onChange={(e) => setLabelType(e.target.value as LabelType)}
                      className="w-4 h-4 text-gray-900 dark:text-gray-100 focus:ring-gray-900 dark:focus:ring-gray-100"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">نوع د - كتالوج</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">A4 - صفحة منتج واحدة مع الصورة</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* خيارات الكتالوج — لنوع د فقط: إظهار المنتجات ذات الكمية صفر في المحل / المخزن */}
              {labelType === 'D' && (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4 no-print">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">خيارات الكتالوج</h2>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showZeroShopCatalog}
                        onChange={(e) => setShowZeroShopCatalog(e.target.checked)}
                        className="w-4 h-4 text-gray-900 dark:text-gray-100 focus:ring-gray-900 dark:focus:ring-gray-100 rounded"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">إظهار المنتجات التي كميتها صفر في المحل</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">إدراج أصناف بدون كمية في المحل في الكتالوج</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showZeroWarehouseCatalog}
                        onChange={(e) => setShowZeroWarehouseCatalog(e.target.checked)}
                        className="w-4 h-4 text-gray-900 dark:text-gray-100 focus:ring-gray-900 dark:focus:ring-gray-100 rounded"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">إظهار المنتجات التي كميتها صفر في المخزن</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">إدراج أصناف بدون كمية في المخزن في الكتالوج</div>
                      </div>
                    </label>
                    <div className="pt-2 border-t border-gray-200 dark:border-slate-700">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showPriceInCatalog}
                          onChange={(e) => setShowPriceInCatalog(e.target.checked)}
                          className="w-4 h-4 text-gray-900 dark:text-gray-100 focus:ring-gray-900 dark:focus:ring-gray-100 rounded"
                        />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">إظهار السعر</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">إظهار سعر المنتج في الكتالوج</div>
                        </div>
                      </label>
                    </div>
                    <div className="pt-2 border-t border-gray-200 dark:border-slate-700">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hideCatalogHeader}
                          onChange={(e) => setHideCatalogHeader(e.target.checked)}
                          className="w-4 h-4 text-gray-900 dark:text-gray-100 focus:ring-gray-900 dark:focus:ring-gray-100 rounded"
                        />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">الطباعة بلا الترويسة الخاصة بالمعرض</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">طباعة الكتالوج بدون الشعار وبيانات المعرض في أعلى الصفحة</div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Quantity Option for Type C */}
              {labelType === 'C' && (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4 no-print">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">خيارات الطباعة</h2>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="quantityOption"
                        checked={quantitySource === 'shop'}
                        onChange={() => setQuantitySource('shop')}
                        className="w-4 h-4 text-gray-900 dark:text-gray-100 focus:ring-gray-900 dark:focus:ring-gray-100"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">حسب كمية المحل</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">تكرار الليبل حسب الكمية في المحل</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="quantityOption"
                        checked={quantitySource === 'warehouse'}
                        onChange={() => setQuantitySource('warehouse')}
                        className="w-4 h-4 text-gray-900 dark:text-gray-100 focus:ring-gray-900 dark:focus:ring-gray-100"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">حسب كمية المخزن</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">تكرار الليبل حسب الكمية في المخزن</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="quantityOption"
                        checked={quantitySource === 'one'}
                        onChange={() => setQuantitySource('one')}
                        className="w-4 h-4 text-gray-900 dark:text-gray-100 focus:ring-gray-900 dark:focus:ring-gray-100"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">ليبل واحد لكل منتج</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">طباعة ملصق واحد بغض النظر عن الكمية</div>
                      </div>
                    </label>
                    <div className="pt-2 border-t border-gray-200 dark:border-slate-700">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showZeroQuantity}
                          onChange={(e) => setShowZeroQuantity(e.target.checked)}
                          className="w-4 h-4 text-gray-900 dark:text-gray-100 focus:ring-gray-900 dark:focus:ring-gray-100 rounded"
                        />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">إظهار الأصناف ذات الكمية صفر</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">طباعة ملصقات للأصناف التي لا يوجد لها كمية في المحل</div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* QR: لنوع د = خياران فقط (عدم إظهار / فتح صفحة المنتج). لأنواع أ، ب، ج = فتح صفحة المنتج أو الباركود/الشامل */}
              {labelType === 'D' ? (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4 no-print">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">رمز QR في الكتالوج</h2>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="qrCatalog"
                        checked={!showQrInCatalog}
                        onChange={() => setShowQrInCatalog(false)}
                        className="w-4 h-4 text-gray-900 dark:text-gray-100 focus:ring-gray-900 dark:focus:ring-gray-100"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">عدم إظهار رمز QR</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">الافتراضي — بدون QR في الكتالوج</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="qrCatalog"
                        checked={showQrInCatalog}
                        onChange={() => setShowQrInCatalog(true)}
                        className="w-4 h-4 text-gray-900 dark:text-gray-100 focus:ring-gray-900 dark:focus:ring-gray-100"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">فتح صفحة المنتج</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">إظهار QR في زاوية الصفحة يفتح صفحة المنتج</div>
                      </div>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4 no-print">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">سلوك رمز QR</h2>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="qrOption"
                        checked={useQrProductUrl}
                        onChange={() => setUseQrProductUrl(true)}
                        className="w-4 h-4 text-gray-900 dark:text-gray-100 focus:ring-gray-900 dark:focus:ring-gray-100"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">فتح صفحة المنتج</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">QR = رابط صفحة المنتج (للهواتف والمتجر)</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="qrOption"
                        checked={!useQrProductUrl}
                        onChange={() => setUseQrProductUrl(false)}
                        className="w-4 h-4 text-gray-900 dark:text-gray-100 focus:ring-gray-900 dark:focus:ring-gray-100"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">استخدام الباركود/الشامل</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">QR = رقم الباركود أو الشامل (للقراءات القديمة)</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Print Button */}
              {labelType === 'D' ? (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleDownloadPdf}
                    disabled={selectedProductsList.length === 0 || isGeneratingPdf}
                    className="w-full bg-blue-600 dark:bg-blue-600 text-white py-3.5 px-4 rounded-xl font-bold hover:bg-blue-700 dark:hover:bg-blue-500 disabled:bg-gray-400 dark:disabled:bg-slate-700 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-[0.98]"
                  >
                    {isGeneratingPdf ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>جاري التحضير...</span>
                      </>
                    ) : (
                      <>
                        <Printer size={22} />
                        <span>تنزيل ملف الكتالوج (PDF)</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handlePrint}
                    disabled={selectedProductsList.length === 0}
                    className="w-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 py-2.5 px-4 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                  >
                    <span>عرض نافذة الطباعة العادية</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handlePrint}
                  disabled={selectedProductsList.length === 0}
                  className="w-full bg-gray-900 dark:bg-slate-700 text-white py-3.5 px-4 rounded-xl font-bold hover:bg-gray-800 dark:hover:bg-slate-600 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-[0.98]"
                >
                  <Printer size={22} />
                  <span>طباعة الملصقات</span>
                </button>
              )}

              {/* Selected Products Summary */}
              {selectedProductsList.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">المنتجات المحددة</h3>
                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    {selectedProductsList.slice(0, 5).map((product) => (
                      <div key={product.ProductID || product.id}>
                        • {product.Name || product.name || '—'}
                      </div>
                    ))}
                    {selectedProductsList.length > 5 && (
                      <div className="text-gray-400 dark:text-gray-500">+ {selectedProductsList.length - 5} أكثر</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Hidden PDF Generator for Catalog export — renders off-screen, no tab switch */}
      {labelType === 'D' && pdfProducts.length > 0 && (
        <CatalogPdfGenerator
          products={pdfProducts}
          showQrInCatalog={showQrInCatalog}
          showPriceInCatalog={showPriceInCatalog}
          hideCatalogHeader={hideCatalogHeader}
          onComplete={() => {
            setIsGeneratingPdf(false);
            setPdfProducts([]);
          }}
          onError={(err) => {
            setIsGeneratingPdf(false);
            setPdfProducts([]);
            alert(`حدث خطأ أثناء توليد الـ PDF: ${err}`);
          }}
        />
      )}
    </AdminLayout>
  );
}
