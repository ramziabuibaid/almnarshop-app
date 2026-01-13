'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  getCashInvoiceDetailsFromSupabase,
  getCashInvoicesFromSupabase,
  updateCashInvoice,
  deleteCashInvoice,
  getProducts,
} from '@/lib/api';
import {
  Loader2,
  Save,
  Trash2,
  Plus,
  X,
  ArrowRight,
  Search,
  ChevronDown,
} from 'lucide-react';

interface InvoiceDetail {
  detailID: string;
  productID: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  barcode?: string;
  mode?: 'Pick' | 'Scan';
  scannedBarcode?: string;
  productImage?: string;
}

interface CashInvoice {
  InvoiceID: string;
  DateTime: string;
  Status: string;
  Notes?: string;
  Discount?: number;
  totalAmount?: number;
}

export default function EditInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const { admin } = useAdminAuth();
  const invoiceId = params.id as string;
  
  // Check if user has accountant permission (for delete)
  const canAccountant = admin?.is_super_admin || admin?.permissions?.accountant === true;

  const [invoice, setInvoice] = useState<CashInvoice | null>(null);
  const [details, setDetails] = useState<InvoiceDetail[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [newProductQuantity, setNewProductQuantity] = useState(1);
  const [newProductPrice, setNewProductPrice] = useState(0);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (invoiceId) {
      loadInvoiceData();
      loadProducts();
    }
  }, [invoiceId]);

  const loadInvoiceData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load invoice header
      const invoices = await getCashInvoicesFromSupabase(1000);
      const foundInvoice = invoices.find((inv: CashInvoice) => inv.InvoiceID === invoiceId);
      
      if (!foundInvoice) {
        throw new Error('الفاتورة غير موجودة');
      }

      setInvoice(foundInvoice);
      setNotes(foundInvoice.Notes || '');
      setDiscount(foundInvoice.Discount || 0);

      // Load invoice details
      const invoiceDetails = await getCashInvoiceDetailsFromSupabase(invoiceId);
      setDetails(invoiceDetails);
    } catch (err: any) {
      console.error('[EditInvoicePage] Failed to load invoice:', err);
      setError(err?.message || 'فشل تحميل الفاتورة');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const productsData = await getProducts();
      setProducts(productsData);
    } catch (err: any) {
      console.error('[EditInvoicePage] Failed to load products:', err);
    }
  };

  const handleUpdateQuantity = (detailID: string, newQuantity: number) => {
    setDetails((prev) =>
      prev.map((item) =>
        item.detailID === detailID ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const handleUpdatePrice = (detailID: string, newPrice: number) => {
    setDetails((prev) =>
      prev.map((item) =>
        item.detailID === detailID ? { ...item, unitPrice: newPrice } : item
      )
    );
  };

  const handleRemoveItem = (detailID: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الصنف؟')) {
      setDetails((prev) => prev.filter((item) => item.detailID !== detailID));
    }
  };

  const handleAddProduct = () => {
    if (!selectedProductId) {
      alert('يرجى اختيار منتج');
      return;
    }

    const product = products.find((p) => p.ProductID === selectedProductId || p.id === selectedProductId);
    if (!product) {
      alert('المنتج غير موجود');
      return;
    }

    const newDetail: InvoiceDetail = {
      detailID: `temp-${Date.now()}`,
      productID: product.ProductID || product.id,
      productName: product.Name || product.name || '',
      quantity: newProductQuantity,
      unitPrice: (newProductPrice != null) ? newProductPrice : (product.SalePrice || product.price || 0),
      barcode: product.Barcode || product.barcode,
      mode: 'Pick', // New items default to 'Pick'
    };

    setDetails((prev) => [...prev, newDetail]);
    setSelectedProductId('');
    setNewProductQuantity(1);
    setNewProductPrice(product.SalePrice || product.price || 0);
    setShowAddProduct(false);
  };

  const handleSave = async () => {
    if (details.length === 0) {
      alert('لا يمكن حفظ فاتورة بدون أصناف');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        items: details.map((item) => ({
          detailID: item.detailID.startsWith('temp-') ? undefined : item.detailID,
          productID: item.productID,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          mode: (item.mode || 'Pick') as 'Pick' | 'Scan', // Preserve original mode or default to 'Pick'
        })),
        notes: notes || undefined,
        discount: discount || 0,
      };

      await updateCashInvoice(invoiceId, payload, admin?.username);
      alert('تم حفظ التعديلات بنجاح');
      router.push('/admin/invoices');
    } catch (err: any) {
      console.error('[EditInvoicePage] Failed to save:', err);
      setError(err?.message || 'فشل حفظ التعديلات');
      alert('فشل حفظ التعديلات: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.')) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await deleteCashInvoice(invoiceId, admin?.username);
      alert('تم حذف الفاتورة بنجاح');
      router.push('/admin/invoices');
    } catch (err: any) {
      console.error('[EditInvoicePage] Failed to delete:', err);
      setError(err?.message || 'فشل حذف الفاتورة');
      alert('فشل حذف الفاتورة: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setSaving(false);
    }
  };

  const calculateTotals = () => {
    const subtotal = details.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const netTotal = subtotal - discount;
    return { subtotal, discount, netTotal };
  };

  const { subtotal, netTotal } = calculateTotals();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Smart search for products - words don't need to be consecutive
  const filteredProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return products;
    
    // Split search query into individual words
    const searchWords = productSearchQuery
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);
    
    return products.filter((p) => {
      // Safely convert all values to strings and create searchable text
      const name = String(p.Name || p.name || '').toLowerCase();
      const brand = String(p.Brand || p.brand || '').toLowerCase();
      const type = String(p.Type || p.type || '').toLowerCase();
      const barcode = String(p.Barcode || p.barcode || '').toLowerCase();
      
      // Combine all searchable fields into one text
      const searchableText = `${name} ${brand} ${type} ${barcode}`;
      
      // Check if ALL search words are found in the searchable text
      return searchWords.every(word => searchableText.includes(word));
    });
  }, [products, productSearchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
        setProductSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedProduct = products.find((p) => (p.ProductID || p.id) === selectedProductId);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-cairo">جاري تحميل الفاتورة...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error && !invoice) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <p className="text-red-600 text-lg mb-4 font-cairo">{error}</p>
            <button
              onClick={() => router.push('/admin/invoices')}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo"
            >
              العودة إلى القائمة
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 font-cairo" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">تعديل الفاتورة</h1>
            <p className="text-gray-600 mt-1">رقم الفاتورة: {invoiceId}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/admin/invoices')}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo"
            >
              <ArrowRight size={18} />
              العودة
            </button>
            {canAccountant && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-cairo"
              >
                <Trash2 size={18} />
                حذف الفاتورة
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || details.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-cairo"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save size={18} />
                  حفظ التعديلات
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 font-cairo">{error}</p>
          </div>
        )}

        {/* Invoice Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">
                الملاحظات
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-cairo"
                rows={3}
                placeholder="أضف ملاحظات..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">
                الخصم (₪)
              </label>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                step="1"
                onWheel={(e) => e.currentTarget.blur()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-cairo"
              />
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 font-cairo">الأصناف</h2>
            <button
              onClick={() => setShowAddProduct(!showAddProduct)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-cairo"
            >
              <Plus size={18} />
              إضافة منتج
            </button>
          </div>

          {/* Add Product Form */}
          {showAddProduct && (
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-4 gap-4">
                <div className="relative" ref={productDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">
                    المنتج
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-right flex items-center justify-between font-cairo"
                    >
                      <span className={selectedProduct ? 'text-gray-900 font-medium' : 'text-gray-500'}>
                        {selectedProduct 
                          ? `${selectedProduct.Name || selectedProduct.name} - ₪${selectedProduct.SalePrice || selectedProduct.price || 0}`
                          : 'اختر منتج...'}
                      </span>
                      <ChevronDown size={16} className={`text-gray-600 transition-transform ${isProductDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isProductDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
                        <div className="p-2 border-b border-gray-200">
                          <div className="relative">
                            <Search size={16} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              placeholder="ابحث عن منتج..."
                              value={productSearchQuery}
                              onChange={(e) => setProductSearchQuery(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full pr-8 pl-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm text-gray-900 placeholder:text-gray-500 font-cairo"
                              autoFocus
                              dir="rtl"
                            />
                          </div>
                        </div>
                        <div className="overflow-y-auto max-h-48">
                          {filteredProducts.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-600 text-center font-cairo">لا توجد نتائج</div>
                          ) : (
                            filteredProducts.map((product) => {
                              const productId = product.ProductID || product.id;
                              const productName = product.Name || product.name || '';
                              const productPrice = product.SalePrice || product.price || 0;
                              const imageUrl = product.Image || product.image || '';
                              return (
                                <button
                                  key={productId}
                                  type="button"
                                  onClick={() => {
                                    setSelectedProductId(productId);
                                    setNewProductPrice(productPrice);
                                    setIsProductDropdownOpen(false);
                                    setProductSearchQuery('');
                                  }}
                                  className={`w-full text-right px-3 py-2 hover:bg-gray-100 transition-colors text-gray-900 font-cairo ${
                                    selectedProductId === productId ? 'bg-gray-100 font-medium' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    {imageUrl ? (
                                      <img
                                        src={imageUrl}
                                        alt={productName}
                                        className="w-12 h-12 object-contain rounded border border-gray-200 flex-shrink-0"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <div className="w-12 h-12 bg-gray-100 rounded border border-gray-200 flex items-center justify-center flex-shrink-0">
                                        <span className="text-gray-400 text-xs">—</span>
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                        <span className="truncate">{productName}</span>
                                        <span className="text-sm text-gray-600 mr-2 flex-shrink-0">₪{productPrice.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">
                    الكمية
                  </label>
                  <input
                    type="number"
                    value={newProductQuantity}
                    onChange={(e) => setNewProductQuantity(parseFloat(e.target.value) || 1)}
                    step="1"
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-cairo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">
                    السعر
                  </label>
                  <input
                    type="number"
                    value={newProductPrice}
                    onChange={(e) => setNewProductPrice(parseFloat(e.target.value) || 0)}
                    step="1"
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-cairo"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={handleAddProduct}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-cairo"
                  >
                    إضافة
                  </button>
                  <button
                    onClick={() => {
                      setShowAddProduct(false);
                      setSelectedProductId('');
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-cairo"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                    رقم الشامل
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                    البيان
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                    الكمية
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                    السعر
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                    المبلغ
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {details.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 font-cairo">
                      لا توجد أصناف
                    </td>
                  </tr>
                ) : (
                  details.map((item, index) => {
                    // Get product image from products array
                    const product = products.find(p => (p.ProductID || p.id || p.product_id) === item.productID);
                    const imageUrl = item.productImage || product?.Image || product?.image || '';
                    return (
                    <tr key={item.detailID || `item-${index}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-cairo">
                        {item.barcode || item.productID || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-cairo">
                        <div className="flex items-center gap-2">
                          {imageUrl ? (
                            <>
                              <img
                                src={imageUrl}
                                alt={item.productName}
                                className="w-10 h-10 object-contain rounded border border-gray-200 flex-shrink-0"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                                  if (placeholder) placeholder.style.display = 'flex';
                                }}
                              />
                              <div className="w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center flex-shrink-0 hidden">
                                <span className="text-gray-400 text-xs">—</span>
                              </div>
                            </>
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-gray-400 text-xs">—</span>
                            </div>
                          )}
                          <span>{item.productName || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleUpdateQuantity(item.detailID, parseFloat(e.target.value) || 0)}
                          step="1"
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-cairo text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => handleUpdatePrice(item.detailID, parseFloat(e.target.value) || 0)}
                          step="1"
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-24 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-cairo text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 font-cairo">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => handleRemoveItem(item.detailID)}
                          className="text-red-600 hover:text-red-900 font-cairo"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 font-cairo">المجموع:</span>
                <span className="font-semibold text-gray-900 font-cairo">{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 font-cairo">الخصم:</span>
                  <span className="font-semibold text-red-600 font-cairo">-{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-gray-300">
                <span className="text-lg font-bold text-gray-900 font-cairo">الصافي للدفع:</span>
                <span className="text-lg font-bold text-gray-900 font-cairo">{formatCurrency(netTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
