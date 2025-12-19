'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import InvoicePrint from '@/components/admin/InvoicePrint';
import { useSaveCashInvoice, useProducts } from '@/hooks/useData';
import { Lock } from 'lucide-react';
import {
  Search,
  Filter,
  ShoppingCart,
  Trash2,
  Printer,
  X,
  Plus,
  Minus,
  ChevronDown,
  Camera,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface CartItem {
  productID: string;
  name: string;
  barcode?: string;
  type?: string;
  brand?: string;
  size?: string;
  color?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  mode: 'Pick' | 'Scan';
  scannedBarcode?: string;
}

export default function POSPage() {
  const { admin } = useAdminAuth();
  const { data: products = [] } = useProducts();
  const saveInvoiceMutation = useSaveCashInvoice();
  const [searchQuery, setSearchQuery] = useState('');

  // Check if user has permission to create POS invoices
  const canCreatePOS = admin?.is_super_admin || admin?.permissions?.createPOS === true;
  const [barcodeInput, setBarcodeInput] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    brand: '',
    size: '',
    color: '',
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [invoiceData, setInvoiceData] = useState<{
    invoiceID: string;
    dateTime: string;
    items: any[];
    subtotal: number;
    discount: number;
    netTotal: number;
    notes?: string;
  } | null>(null);
  const [currentInvoiceID, setCurrentInvoiceID] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanAreaRef = useRef<HTMLDivElement>(null);

  // SearchableSelect Component
  interface SearchableSelectProps {
    value: string;
    options: string[];
    onChange: (value: string) => void;
    placeholder: string;
  }

  const SearchableSelect = ({ value, options, onChange, placeholder }: SearchableSelectProps) => {
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
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-right flex items-center justify-between text-sm text-gray-900"
        >
          <span className={selectedOption ? 'text-gray-900 font-medium' : 'text-gray-500'}>
            {selectedOption || placeholder}
          </span>
          <ChevronDown size={16} className={`text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden" dir="rtl">
            <div className="p-2 border-b border-gray-200">
              <div className="relative">
                <Search size={16} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="بحث..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full pr-8 pl-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm text-gray-900 placeholder:text-gray-500"
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
                className={`w-full text-right px-3 py-2 hover:bg-gray-100 transition-colors text-gray-900 ${
                  !value ? 'bg-gray-100 font-medium' : ''
                }`}
              >
                {placeholder}
              </button>
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-600 text-right">لا توجد نتائج</div>
              ) : (
                filteredOptions.map((option: string, index: number) => (
                  <button
                    key={`${option}-${index}`}
                    type="button"
                    onClick={() => {
                      onChange(option);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`w-full text-right px-3 py-2 hover:bg-gray-100 transition-colors text-gray-900 ${
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
    );
  };

  // Products are automatically loaded via React Query

  const addToCart = useCallback((product: any, mode: 'Pick' | 'Scan' = 'Pick', scannedBarcode?: string) => {
    setCart((prev) => {
      const productID = product.ProductID || product.id;
      const existingItem = prev.find(
        (item) => item.productID === productID
      );

      if (existingItem) {
        // Increment quantity
        return prev.map((item) =>
          item.productID === productID
            ? {
                ...item,
                quantity: item.quantity + 1,
                total: (item.quantity + 1) * item.unitPrice,
              }
            : item
        );
      } else {
        // Add new item
        const newItem: CartItem = {
          productID: productID || '',
          name: product.Name || product.name || 'غير معروف',
          barcode: product.Barcode || product.barcode,
          type: product.Type || product.type,
          brand: product.Brand || product.brand,
          size: product.Size || product.size,
          color: product.Color || product.color,
          quantity: 1,
          unitPrice: product.SalePrice || product.salePrice || product.price || 0,
          total: product.SalePrice || product.salePrice || product.price || 0,
          mode,
          scannedBarcode,
        };
        return [...prev, newItem];
      }
    });
  }, []); // No dependencies needed - uses setCart with callback

  // Handle barcode input (separate from search)
  const handleBarcodeSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!barcodeInput.trim()) return;

    const barcode = barcodeInput.trim();
    const product = products.find(
      (p) => String(p.Barcode || p.barcode || '') === barcode
    );

    if (product) {
      addToCart(product, 'Scan', barcode);
      setBarcodeInput(''); // Clear after adding
      barcodeInputRef.current?.focus(); // Keep focus for next scan
    } else {
      // Product not found - could show a message
      console.log('Product not found for barcode:', barcode);
      setBarcodeInput(''); // Clear anyway
    }
  }, [barcodeInput, products, addToCart]);

  // Handle barcode scan result
  const handleBarcodeScanned = useCallback((barcode: string) => {
    const product = products.find(
      (p) => String(p.Barcode || p.barcode || '') === barcode
    );

    if (product) {
      addToCart(product, 'Scan', barcode);
      // Stop scanning after successful scan
      stopScanning();
    } else {
      // Product not found - show alert and continue scanning
      alert(`المنتج غير موجود للباركود: ${barcode}`);
    }
  }, [products, addToCart]);

  // Start camera scanning
  const startScanning = useCallback(async () => {
    try {
      setIsScanning(true);
      
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      const html5QrCode = new Html5Qrcode('barcode-scanner');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' }, // Use back camera on mobile
        config,
        (decodedText) => {
          // Successfully scanned
          handleBarcodeScanned(decodedText);
        },
        (errorMessage) => {
          // Ignore scanning errors (they're frequent during scanning)
        }
      );
    } catch (error: any) {
      console.error('[POS] Error starting camera:', error);
      alert(`فشل فتح الكاميرا: ${error?.message || 'خطأ غير معروف'}`);
      setIsScanning(false);
    }
  }, [handleBarcodeScanned]);

  // Stop camera scanning
  const stopScanning = useCallback(async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
      }
      setIsScanning(false);
    } catch (error) {
      console.error('[POS] Error stopping camera:', error);
      setIsScanning(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
      }
    };
  }, []);

  const removeFromCart = (productID: string) => {
    setCart((prev) => prev.filter((item) => item.productID !== productID));
  };

  const updateQuantity = (productID: string, newQuantity: number) => {
    // Allow negative quantities and zero (for returns)
    setCart((prev) =>
      prev.map((item) =>
        item.productID === productID
          ? {
              ...item,
              quantity: newQuantity,
              total: newQuantity * item.unitPrice,
            }
          : item
      )
    );
  };

  const updatePrice = (productID: string, newPrice: number) => {
    if (newPrice < 0) return;
    setCart((prev) =>
      prev.map((item) =>
        item.productID === productID
          ? {
              ...item,
              unitPrice: newPrice,
              total: item.quantity * newPrice,
            }
          : item
      )
    );
  };

  // Filter products (search by name, brand, type, and ProductID - supports multiple words like main store)
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
        const name = String(p.Name || p.name || '').toLowerCase();
        const brand = String(p.Brand || p.brand || '').toLowerCase();
        const type = String(p.Type || p.type || '').toLowerCase();
        const productID = String(p.ProductID || p.id || '').toLowerCase();
        
        // Combine all searchable fields into one text
        const searchableText = `${name} ${brand} ${type} ${productID}`;
        
        // Check if ALL search words are found in the searchable text
        return searchWords.every(word => searchableText.includes(word));
      });
    }

    // Apply filters
    if (filters.type) {
      filtered = filtered.filter((p) => (p.Type || p.type) === filters.type);
    }
    if (filters.brand) {
      filtered = filtered.filter((p) => (p.Brand || p.brand) === filters.brand);
    }
    if (filters.size) {
      filtered = filtered.filter((p) => (p.Size || p.size) === filters.size);
    }
    if (filters.color) {
      filtered = filtered.filter((p) => (p.Color || p.color) === filters.color);
    }

    return filtered;
  }, [products, searchQuery, filters]);

  // Calculate available filter options based on other selected filters (Cascading Filters)
  const availableTypes = useMemo(() => {
    let filtered = products;
    
    // Apply other filters (excluding type)
    if (filters.brand) {
      filtered = filtered.filter((p) => (p.Brand || p.brand) === filters.brand);
    }
    if (filters.size) {
      filtered = filtered.filter((p) => (p.Size || p.size) === filters.size);
    }
    if (filters.color) {
      filtered = filtered.filter((p) => (p.Color || p.color) === filters.color);
    }
    
    const types = new Set<string>();
    filtered.forEach((p) => {
      const type = p.Type || p.type;
      if (type) types.add(type);
    });
    return Array.from(types).sort();
  }, [products, filters.brand, filters.size, filters.color]);

  const availableBrands = useMemo(() => {
    let filtered = products;
    
    // Apply other filters (excluding brand)
    if (filters.type) {
      filtered = filtered.filter((p) => (p.Type || p.type) === filters.type);
    }
    if (filters.size) {
      filtered = filtered.filter((p) => (p.Size || p.size) === filters.size);
    }
    if (filters.color) {
      filtered = filtered.filter((p) => (p.Color || p.color) === filters.color);
    }
    
    const brands = new Set<string>();
    filtered.forEach((p) => {
      const brand = p.Brand || p.brand;
      if (brand) brands.add(brand);
    });
    return Array.from(brands).sort();
  }, [products, filters.type, filters.size, filters.color]);

  const availableSizes = useMemo(() => {
    let filtered = products;
    
    // Apply other filters (excluding size)
    if (filters.type) {
      filtered = filtered.filter((p) => (p.Type || p.type) === filters.type);
    }
    if (filters.brand) {
      filtered = filtered.filter((p) => (p.Brand || p.brand) === filters.brand);
    }
    if (filters.color) {
      filtered = filtered.filter((p) => (p.Color || p.color) === filters.color);
    }
    
    const sizes = new Set<string>();
    filtered.forEach((p) => {
      const size = p.Size || p.size;
      if (size) sizes.add(size);
    });
    return Array.from(sizes).sort();
  }, [products, filters.type, filters.brand, filters.color]);

  const availableColors = useMemo(() => {
    let filtered = products;
    
    // Apply other filters (excluding color)
    if (filters.type) {
      filtered = filtered.filter((p) => (p.Type || p.type) === filters.type);
    }
    if (filters.brand) {
      filtered = filtered.filter((p) => (p.Brand || p.brand) === filters.brand);
    }
    if (filters.size) {
      filtered = filtered.filter((p) => (p.Size || p.size) === filters.size);
    }
    
    const colors = new Set<string>();
    filtered.forEach((p) => {
      const color = p.Color || p.color;
      if (color) colors.add(color);
    });
    return Array.from(colors).sort();
  }, [products, filters.type, filters.brand, filters.size]);

  // Validate and clean up filters when available options change
  useEffect(() => {
    setFilters((prev) => {
      const updated = { ...prev };
      let changed = false;

      // Check if selected type is still available
      if (updated.type && !availableTypes.includes(updated.type)) {
        updated.type = '';
        updated.brand = '';
        updated.size = '';
        updated.color = '';
        changed = true;
      }

      // Check if selected brand is still available
      if (updated.brand && !availableBrands.includes(updated.brand)) {
        updated.brand = '';
        updated.size = '';
        updated.color = '';
        changed = true;
      }

      // Check if selected size is still available
      if (updated.size && !availableSizes.includes(updated.size)) {
        updated.size = '';
        changed = true;
      }

      // Check if selected color is still available
      if (updated.color && !availableColors.includes(updated.color)) {
        updated.color = '';
        changed = true;
      }

      return changed ? updated : prev;
    });
  }, [availableTypes, availableBrands, availableSizes, availableColors]);

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const netTotal = subtotal - (discount || 0);

  const handlePayAndPrint = async () => {
    if (cart.length === 0) {
      alert('السلة فارغة');
      return;
    }

    setIsProcessing(true);
    try {
      const payload = {
        items: cart.map((item) => ({
          productID: item.productID,
          mode: item.mode,
          scannedBarcode: item.scannedBarcode || item.barcode,
          filterType: item.type,
          filterBrand: item.brand,
          filterSize: item.size,
          filterColor: item.color,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        notes: notes.trim() || undefined,
        discount: discount || 0,
      };

      // Use mutation hook which handles optimistic updates
      const result = await saveInvoiceMutation.mutateAsync(payload);
      
      // Set current invoice ID
      setCurrentInvoiceID(result.invoiceID);
      
      // Prepare invoice data for printing
      // Use current time (will be formatted with Palestine timezone in InvoicePrint)
      setInvoiceData({
        invoiceID: result.invoiceID,
        dateTime: new Date().toISOString(),
        items: cart.map((item) => ({
          productID: item.productID,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          barcode: item.barcode || item.scannedBarcode || '',
        })),
        subtotal,
        discount: discount || 0,
        netTotal,
        notes: notes.trim() || undefined,
      });

      // Open print in new window - user will click print button manually
      // This prevents browser freezing and allows multiple invoices to be opened
      const printUrl = `/admin/invoices/print/${result.invoiceID}`;
      window.open(printUrl, `print-${result.invoiceID}`, 'noopener,noreferrer');

      // Clear cart after successful save
      setTimeout(() => {
        setCart([]);
        setNotes('');
        setDiscount(0);
        setInvoiceData(null);
        setCurrentInvoiceID(null);
      }, 1000);
    } catch (error: any) {
      console.error('[POS] Error saving invoice:', error);
      alert(`فشل حفظ الفاتورة: ${error?.message || 'خطأ غير معروف'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Check permissions
  if (!canCreatePOS) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Lock size={48} className="text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-2 font-cairo">ليس لديك صلاحية لإنشاء فواتير POS</p>
            <p className="text-gray-500 text-sm font-cairo">يرجى التواصل مع المشرف للحصول على الصلاحية</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="h-screen flex flex-col no-print" dir="rtl">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <h1 className="text-2xl font-bold text-gray-900">نظام نقطة البيع النقدية</h1>
        </div>

        {/* Main Content - Split Screen */}
        <div className="flex-1 flex overflow-hidden">
          {/* Right Side - Catalog */}
          <div className="w-1/2 border-l border-gray-200 flex flex-col bg-gray-50">
            {/* Search and Filters */}
            <div className="p-4 bg-white border-b border-gray-200">
              <div className="flex gap-2 mb-3">
                {/* Barcode Input (Separate) */}
                <div className="w-48 relative">
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="مسح الباركود..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleBarcodeSubmit();
                      }
                    }}
                    className="w-full pr-3 pl-3 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    autoFocus
                    disabled={isScanning}
                  />
                  {/* Camera Scan Button */}
                  <button
                    type="button"
                    onClick={isScanning ? stopScanning : startScanning}
                    className={`absolute left-2 top-1/2 transform -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
                      isScanning
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                    title={isScanning ? 'إيقاف الكاميرا' : 'فتح الكاميرا لمسح الباركود'}
                  >
                    <Camera size={16} />
                  </button>
                </div>
                
                {/* Search Input (Text only, no barcode) */}
                <div className="flex-1 relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="بحث بالاسم أو رقم الصنف..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  />
                </div>
              </div>

              {/* Filters - Cascading & Searchable */}
              <div className="grid grid-cols-4 gap-2">
                <SearchableSelect
                  value={filters.type}
                  options={availableTypes}
                  onChange={(value) => {
                    setFilters((prev) => ({
                      ...prev,
                      type: value,
                      // Reset dependent filters when type changes
                      brand: value ? prev.brand : '',
                      size: value ? prev.size : '',
                      color: value ? prev.color : '',
                    }));
                  }}
                  placeholder="جميع الأنواع"
                />

                <SearchableSelect
                  value={filters.brand}
                  options={availableBrands}
                  onChange={(value) => {
                    setFilters((prev) => ({
                      ...prev,
                      brand: value,
                      // Reset dependent filters when brand changes
                      size: value ? prev.size : '',
                      color: value ? prev.color : '',
                    }));
                  }}
                  placeholder="جميع الماركات"
                />

                <SearchableSelect
                  value={filters.size}
                  options={availableSizes}
                  onChange={(value) => {
                    setFilters((prev) => ({
                      ...prev,
                      size: value,
                    }));
                  }}
                  placeholder="جميع الأحجام"
                />

                <SearchableSelect
                  value={filters.color}
                  options={availableColors}
                  onChange={(value) => {
                    setFilters((prev) => ({
                      ...prev,
                      color: value,
                    }));
                  }}
                  placeholder="جميع الألوان"
                />
              </div>
            </div>

            {/* Barcode Scanner Camera View */}
            {isScanning && (
              <div className="p-4 bg-black border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-white text-sm font-medium mb-1">امسح الباركود بالكاميرا</p>
                    <p className="text-gray-400 text-xs">وجه الكاميرا نحو الباركود</p>
                  </div>
                  <button
                    onClick={stopScanning}
                    className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm flex items-center gap-1"
                  >
                    <X size={16} />
                    إغلاق
                  </button>
                </div>
                <div
                  id="barcode-scanner"
                  ref={scanAreaRef}
                  className="w-full max-w-md mx-auto bg-gray-900 rounded-lg overflow-hidden"
                  style={{ minHeight: '300px', maxHeight: '400px' }}
                />
                <p className="text-gray-400 text-xs text-center mt-2">
                  يمكنك أيضاً استخدام الماسح الضوئي المتصل بالحاسوب
                </p>
              </div>
            )}

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-3 gap-3">
                {filteredProducts.map((product, index) => {
                  const imageUrl = product.ImageUrl || product.imageUrl || product.Image || product.image || '';
                  const productKey = product.ProductID || product.id || `product-${index}`;
                  return (
                    <div
                      key={productKey}
                      onClick={() => addToCart(product, 'Pick')}
                      className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={product.Name || product.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ShoppingCart size={32} className="text-gray-400" />
                        )}
                      </div>
                      <h3 className="font-semibold text-sm text-gray-900 mb-1 line-clamp-2">
                        {product.Name || product.name || 'غير معروف'}
                      </h3>
                      <p className="text-xs text-gray-600 mb-1">
                        {product.Barcode || product.barcode || '—'}
                      </p>
                      {/* Stock Information */}
                      <div className="flex items-center gap-2 mb-1 text-xs">
                        {(product.CS_Shop !== undefined && product.CS_Shop !== null) && (
                          <span className="text-gray-600">
                            المحل: <span className={`font-medium ${
                              (product.CS_Shop || 0) > 0 ? 'text-green-700' : 'text-red-700'
                            }`}>{product.CS_Shop || 0}</span>
                          </span>
                        )}
                        {(product.CS_War !== undefined && product.CS_War !== null) && (
                          <span className="text-gray-600">
                            المخزن: <span className={`font-medium ${
                              (product.CS_War || 0) > 0 ? 'text-green-700' : 'text-red-700'
                            }`}>{product.CS_War || 0}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-blue-600">
                        ₪{parseFloat(product.SalePrice || product.salePrice || 0).toFixed(2)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Left Side - Invoice/Cart */}
          <div className="w-1/2 flex flex-col bg-white">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">فاتورة جديدة</h2>
                {currentInvoiceID && (
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">رقم الفاتورة:</span>
                    <span className="mr-2 font-semibold text-gray-900">{currentInvoiceID}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart size={48} className="text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">السلة فارغة</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => {
                    // Get product image from products array
                    const product = products.find(p => (p.ProductID || p.id || p.product_id) === item.productID);
                    const imageUrl = product?.Image || product?.image || '';
                    return (
                    <div
                      key={item.productID}
                      className="bg-gray-50 rounded-lg p-2 border border-gray-200"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* Product Image & Name */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={item.name}
                              className="w-10 h-10 object-contain rounded border border-gray-200 flex-shrink-0"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                                if (placeholder) placeholder.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          {imageUrl ? (
                            <div className="w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center flex-shrink-0 hidden">
                              <span className="text-gray-400 text-xs">—</span>
                            </div>
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-gray-400 text-xs">—</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {item.name} <span className="text-xs text-gray-500">({item.productID})</span>
                            </p>
                          </div>
                        </div>
                        
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQuantity(item.productID, item.quantity - 1)}
                            className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-200"
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.productID, parseFloat(e.target.value) || 0)}
                            className="w-12 text-center border border-gray-300 rounded py-1 text-xs text-gray-900"
                          />
                          <button
                            onClick={() => updateQuantity(item.productID, item.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-200"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        
                        {/* Price Input */}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updatePrice(item.productID, parseFloat(e.target.value) || 0)}
                            step="0.01"
                            min="0"
                            className="w-20 text-center border border-gray-300 rounded py-1 text-xs text-gray-900"
                            placeholder="السعر"
                          />
                        </div>
                        
                        {/* Total */}
                        <div className="text-left min-w-[60px]">
                          <p className="text-sm font-bold text-gray-900">₪{item.total.toFixed(2)}</p>
                        </div>
                        
                        {/* Delete Button */}
                        <button
                          onClick={() => removeFromCart(item.productID)}
                          className="text-red-500 hover:text-red-700 transition-colors flex-shrink-0"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4 space-y-3">
              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات اختيارية..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* Discount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">خصم</label>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* Totals */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">المجموع:</span>
                  <span className="font-semibold">₪{subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>الخصم:</span>
                    <span>₪{discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
                  <span>الصافي:</span>
                  <span className="text-green-600">₪{netTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Pay Button */}
              <button
                onClick={handlePayAndPrint}
                disabled={cart.length === 0 || isProcessing || saveInvoiceMutation.isPending}
                className="w-full py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {(isProcessing || saveInvoiceMutation.isPending) ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    جاري المعالجة...
                  </>
                ) : (
                  <>
                    <Printer size={20} />
                    دفع وطباعة
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Print Component */}
      {invoiceData && (
        <InvoicePrint
          invoiceID={invoiceData.invoiceID}
          dateTime={invoiceData.dateTime}
          items={invoiceData.items}
          subtotal={invoiceData.subtotal}
          discount={invoiceData.discount}
          netTotal={invoiceData.netTotal}
          notes={invoiceData.notes}
        />
      )}
    </AdminLayout>
  );
}

