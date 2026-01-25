'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useTransition, memo } from 'react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Search, Printer, Loader2, CheckSquare, Square, ArrowUp, ArrowDown } from 'lucide-react';
import { Product } from '@/types';
import { getProducts, saveProduct } from '@/lib/api';
import LabelsTableRow from '@/components/admin/LabelsTableRow';
import { useRouter } from 'next/navigation';

type LabelType = 'A' | 'B' | 'C';
type SortField = 'price' | 'quantity' | null;
type SortDirection = 'asc' | 'desc';

export default function LabelsPage() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [labelType, setLabelType] = useState<LabelType>('A');
  const [useQuantity, setUseQuantity] = useState<boolean>(true); // true = حسب الكمية, false = ليبل واحد لكل منتج
  const [showZeroQuantity, setShowZeroQuantity] = useState<boolean>(true); // true = إظهار الأصناف ذات الكمية صفر, false = إخفاءها
  const [useQrProductUrl, setUseQrProductUrl] = useState<boolean>(true); // true = QR يفتح صفحة المنتج، false = QR = الباركود/الشامل
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [editingBarcode, setEditingBarcode] = useState<string | null>(null); // productId being edited
  const [editingBarcodeValue, setEditingBarcodeValue] = useState<string>(''); // temporary value while editing
  const [savingBarcode, setSavingBarcode] = useState<string | null>(null); // productId being saved
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({}); // productId -> custom quantity for printing
  const [editingQuantity, setEditingQuantity] = useState<string | null>(null); // productId being edited
  const [editingQuantityValue, setEditingQuantityValue] = useState<string>(''); // temporary value while editing

  useLayoutEffect(() => {
    document.title = 'طباعة الملصقات';
  }, []);

  useEffect(() => {
    loadProducts();
  }, []);

  // Debounce search query for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (error: any) {
      console.error('[LabelsPage] Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

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
    }

    return filtered;
  }, [products, debouncedSearchQuery, sortField, sortDirection]);

  const [isPending, startTransition] = useTransition();

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
    const currentQuantity = customQuantities[productId] ?? (product.CS_Shop || product.cs_shop || 0);
    setEditingQuantity(productId);
    setEditingQuantityValue(String(currentQuantity));
  }, [customQuantities]);

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
    return product.CS_Shop || product.cs_shop || 0;
  }, [customQuantities]);

  const selectedProductsList = useMemo(() => {
    const selectedIds = Array.from(selectedProducts);
    if (selectedIds.length === 0) return [];
    
    const filtered = [];
    for (const p of products) {
      const productId = p.ProductID || p.id || '';
      if (selectedProducts.has(productId)) {
        const printQuantity = customQuantities[productId] !== undefined 
          ? customQuantities[productId] 
          : (p.CS_Shop || p.cs_shop || 0);
        filtered.push({
          ...p,
          printQuantity,
        });
      }
    }
    return filtered;
  }, [products, selectedProducts, customQuantities]);

  const handlePrint = () => {
    if (selectedProductsList.length === 0) {
      alert('يرجى تحديد منتج واحد على الأقل للطباعة');
      return;
    }

    // Store products and labelType in sessionStorage to avoid URL length limits
    const printData = {
      products: selectedProductsList,
      labelType: labelType,
      useQuantity: labelType === 'C' ? useQuantity : true, // Only relevant for Type C
      showZeroQuantity: labelType === 'C' ? showZeroQuantity : true, // Only relevant for Type C
      useQrProductUrl,
      timestamp: Date.now(),
    };
    
    try {
      const dataString = JSON.stringify(printData);
      console.log('[LabelsPage] Storing print data:', {
        productsCount: selectedProductsList.length,
        labelType: labelType,
        dataSize: dataString.length,
      });
      
      // Use localStorage instead of sessionStorage for better cross-window compatibility
      localStorage.setItem('labelsPrintData', dataString);
      
      // Verify data was stored
      const verifyData = localStorage.getItem('labelsPrintData');
      if (!verifyData) {
        throw new Error('Failed to store data in localStorage');
      }
      
      console.log('[LabelsPage] Data stored successfully, opening print window...');
      
      // Open print page in new window with a unique identifier
      const printUrl = `/admin/labels/print?t=${Date.now()}`;
      const printWindow = window.open(printUrl, 'labels-print', 'noopener,noreferrer');
      
      // Clean up localStorage after a delay (in case window doesn't open)
      setTimeout(() => {
        // Only remove if window was closed or failed to open
        if (!printWindow || printWindow.closed) {
          localStorage.removeItem('labelsPrintData');
        }
      }, 5000);
    } catch (error: any) {
      console.error('[LabelsPage] Failed to store print data:', error);
      alert('فشل تحضير البيانات للطباعة. يرجى المحاولة مرة أخرى.');
    }
  };

  if (!admin) return null;

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-50 p-6 no-print" dir="rtl">
        <div className="max-w-7xl mx-auto no-print">
          {/* Header */}
          <div className="mb-6 no-print">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">طباعة ملصقات الأسعار</h1>
            <p className="text-gray-600">اختر المنتجات وحدد نوع الملصق للطباعة</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Product Selection */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-4 no-print">
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="ابحث عن منتج..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-gray-400" size={32} />
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleAll}
                        className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
                      >
                        {selectedProducts.size === filteredProducts.length ? (
                          <CheckSquare size={18} className="text-gray-900" />
                        ) : (
                          <Square size={18} className="text-gray-400" />
                        )}
                        <span>تحديد الكل</span>
                      </button>
                      <span className="text-sm text-gray-500">
                        ({selectedProducts.size} منتج محدد)
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full" style={{ willChange: 'auto' }}>
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">تحديد</th>
                          <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">الصورة</th>
                          <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">الاسم</th>
                          <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">الباركود</th>
                          {labelType === 'C' && useQuantity && (
                            <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">الكمية للطباعة</th>
                          )}
                          <th 
                            className="text-right py-2 px-3 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSort('price');
                            }}
                          >
                            <div className="flex items-center justify-end gap-1">
                              <span>السعر</span>
                              {sortField === 'price' && (
                                sortDirection === 'asc' ? (
                                  <ArrowUp size={14} className="text-gray-900" />
                                ) : (
                                  <ArrowDown size={14} className="text-gray-900" />
                                )
                              )}
                            </div>
                          </th>
                          <th 
                            className="text-right py-2 px-3 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSort('quantity');
                            }}
                          >
                            <div className="flex items-center justify-end gap-1">
                              <span>المخزون</span>
                              {sortField === 'quantity' && (
                                sortDirection === 'asc' ? (
                                  <ArrowUp size={14} className="text-gray-900" />
                                ) : (
                                  <ArrowDown size={14} className="text-gray-900" />
                                )
                              )}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.length === 0 ? (
                          <tr>
                            <td colSpan={labelType === 'C' && useQuantity ? 7 : 6} className="text-center py-8 text-gray-500">
                              لا توجد منتجات
                            </td>
                          </tr>
                        ) : (
                          filteredProducts.map((product) => {
                            const productId = product.ProductID || product.id || '';
                            return (
                              <LabelsTableRow
                                key={productId}
                                product={product}
                                isSelected={selectedProducts.has(productId)}
                                labelType={labelType}
                                useQuantity={useQuantity}
                                editingBarcode={editingBarcode}
                                editingBarcodeValue={editingBarcodeValue}
                                savingBarcode={savingBarcode}
                                editingQuantity={editingQuantity}
                                editingQuantityValue={editingQuantityValue}
                                customQuantities={customQuantities}
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
                                getPrintQuantity={getPrintQuantity}
                              />
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Right Column: Preview & Settings */}
            <div className="lg:col-span-1 space-y-4 no-print">
              {/* Label Type Selector */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 no-print">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">نوع الملصق</h2>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="labelType"
                      value="A"
                      checked={labelType === 'A'}
                      onChange={(e) => setLabelType(e.target.value as LabelType)}
                      className="w-4 h-4 text-gray-900 focus:ring-gray-900"
                    />
                    <div>
                      <div className="font-medium text-gray-900">نوع أ - كبير (ثلاجة)</div>
                      <div className="text-xs text-gray-500">A6 - ملصق واحد لكل صفحة</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="labelType"
                      value="B"
                      checked={labelType === 'B'}
                      onChange={(e) => setLabelType(e.target.value as LabelType)}
                      className="w-4 h-4 text-gray-900 focus:ring-gray-900"
                    />
                    <div>
                      <div className="font-medium text-gray-900">نوع ب - متوسط</div>
                      <div className="text-xs text-gray-500">A6 - 4 ملصقات (2×2)</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="labelType"
                      value="C"
                      checked={labelType === 'C'}
                      onChange={(e) => setLabelType(e.target.value as LabelType)}
                      className="w-4 h-4 text-gray-900 focus:ring-gray-900"
                    />
                    <div>
                      <div className="font-medium text-gray-900">نوع ج - صغير (رف)</div>
                      <div className="text-xs text-gray-500">A4 - 70mm × 29.7mm</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Quantity Option for Type C */}
              {labelType === 'C' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 no-print">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">خيارات الطباعة</h2>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="quantityOption"
                        checked={useQuantity}
                        onChange={() => setUseQuantity(true)}
                        className="w-4 h-4 text-gray-900 focus:ring-gray-900"
                      />
                      <div>
                        <div className="font-medium text-gray-900">حسب كمية المحل</div>
                        <div className="text-xs text-gray-500">طباعة ملصق لكل قطعة متوفرة</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="quantityOption"
                        checked={!useQuantity}
                        onChange={() => setUseQuantity(false)}
                        className="w-4 h-4 text-gray-900 focus:ring-gray-900"
                      />
                      <div>
                        <div className="font-medium text-gray-900">ليبل واحد لكل منتج</div>
                        <div className="text-xs text-gray-500">طباعة ملصق واحد بغض النظر عن الكمية</div>
                      </div>
                    </label>
                    <div className="pt-2 border-t border-gray-200">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showZeroQuantity}
                          onChange={(e) => setShowZeroQuantity(e.target.checked)}
                          className="w-4 h-4 text-gray-900 focus:ring-gray-900 rounded"
                        />
                        <div>
                          <div className="font-medium text-gray-900">إظهار الأصناف ذات الكمية صفر</div>
                          <div className="text-xs text-gray-500">طباعة ملصقات للأصناف التي لا يوجد لها كمية في المحل</div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* QR Code Behavior */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 no-print">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">سلوك رمز QR</h2>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="qrOption"
                      checked={useQrProductUrl}
                      onChange={() => setUseQrProductUrl(true)}
                      className="w-4 h-4 text-gray-900 focus:ring-gray-900"
                    />
                    <div>
                      <div className="font-medium text-gray-900">فتح صفحة المنتج</div>
                      <div className="text-xs text-gray-500">QR = رابط صفحة المنتج (للهواتف والمتجر)</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="qrOption"
                      checked={!useQrProductUrl}
                      onChange={() => setUseQrProductUrl(false)}
                      className="w-4 h-4 text-gray-900 focus:ring-gray-900"
                    />
                    <div>
                      <div className="font-medium text-gray-900">استخدام الباركود/الشامل</div>
                      <div className="text-xs text-gray-500">QR = رقم الباركود أو الشامل (للقراءات القديمة)</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Print Button */}
              <button
                onClick={handlePrint}
                disabled={selectedProductsList.length === 0}
                className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg font-semibold hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                <Printer size={20} />
                <span>طباعة</span>
              </button>

              {/* Selected Products Summary */}
              {selectedProductsList.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">المنتجات المحددة</h3>
                  <div className="text-xs text-gray-600 space-y-1">
                    {selectedProductsList.slice(0, 5).map((product) => (
                      <div key={product.ProductID || product.id}>
                        • {product.Name || product.name || '—'}
                      </div>
                    ))}
                    {selectedProductsList.length > 5 && (
                      <div className="text-gray-400">+ {selectedProductsList.length - 5} أكثر</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
