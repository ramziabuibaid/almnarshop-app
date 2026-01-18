'use client';

const mapToInvoiceStatus = () => {
  // فواتير المحل/المخزن تقبل فقط هذه القيم: غير مدفوع، تقسيط شهري، دفعت بالكامل، مدفوع جزئي
  // عند التحويل من عرض سعر نستخدم القيمة الافتراضية "غير مدفوع"
  return 'غير مدفوع' as const;
};

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  getQuotationFromSupabase,
  saveQuotation,
  deleteQuotation,
  getProducts,
  getAllCustomers,
  saveShopSalesInvoice,
  saveWarehouseSalesInvoice,
} from '@/lib/api';
import {
  Loader2,
  Save,
  Plus,
  X,
  Trash2,
  ArrowLeft,
  Eye,
  EyeOff,
  Printer,
} from 'lucide-react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import BarcodeScannerInput from '@/components/admin/BarcodeScannerInput';

interface QuotationDetail {
  QuotationDetailID: string;
  QuotationID: string;
  ProductID: string;
  Quantity: number;
  UnitPrice: number;
  notes?: string;
  product?: {
    name: string;
    barcode?: string;
    shamelNo?: string;
    costPrice?: number;
    image?: string;
  };
}

interface Quotation {
  QuotationID: string;
  Date: string;
  CustomerID: string | null;
  Notes?: string;
  Status: string;
  SpecialDiscountAmount: number;
  GiftDiscountAmount: number;
  details?: QuotationDetail[];
}

const STATUS_OPTIONS = [
  'مسودة',
  'مقدم للزبون',
  'مدفوع كلي أو جزئي تم الحجز',
  'تم تسلم جزء من الطلبية',
  'مسلمة بالكامل',
  'ملغي',
];

export default function EditQuotationPage() {
  const router = useRouter();
  const params = useParams();
  const quotationId = params.id as string;
  const { admin } = useAdminAuth();
  
  // Check if user has accountant permission (for delete)
  const canAccountant = admin?.is_super_admin || admin?.permissions?.accountant === true;
  
  // Check if user can view customer balances
  const canViewBalances = admin?.is_super_admin || admin?.permissions?.viewBalances === true;

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [date, setDate] = useState('');
  const [customerId, setCustomerId] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('مسودة');
  const [specialDiscountAmount, setSpecialDiscountAmount] = useState(0);
  const [giftDiscountAmount, setGiftDiscountAmount] = useState(0);
  const [details, setDetails] = useState<QuotationDetail[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [newProductQuantity, setNewProductQuantity] = useState(1);
  const [newProductPrice, setNewProductPrice] = useState(0);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [showCosts, setShowCosts] = useState(false);
  const [converting, setConverting] = useState<'shop' | 'warehouse' | null>(null);
  const [convertMessage, setConvertMessage] = useState<string | null>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const canViewCost = admin?.is_super_admin || admin?.permissions?.viewCost === true;

  useEffect(() => {
    if (quotationId) {
      loadQuotationData();
      loadProducts();
      loadCustomers();
    }
  }, [quotationId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
      }
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadQuotationData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getQuotationFromSupabase(quotationId);
      setQuotation(data);
      setDate(data.Date || new Date().toISOString().split('T')[0]);
      const custId = data.CustomerID || '';
      setCustomerId(custId);
      setNotes(data.Notes || '');
      setStatus(data.Status || 'مسودة');
      setSpecialDiscountAmount(data.SpecialDiscountAmount || 0);
      setGiftDiscountAmount(data.GiftDiscountAmount || 0);
      setDetails(data.details || []);
      // Note: selectedCustomer will be set by useEffect when customers are loaded
    } catch (err: any) {
      console.error('[EditQuotationPage] Failed to load quotation:', err);
      setError(err?.message || 'فشل تحميل العرض السعري');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const productsData = await getProducts();
      setProducts(productsData);
    } catch (err: any) {
      console.error('[EditQuotationPage] Failed to load products:', err);
    }
  };

  const loadCustomers = async () => {
    try {
      const customersData = await getAllCustomers();
      setCustomers(customersData);
    } catch (err: any) {
      console.error('[EditQuotationPage] Failed to load customers:', err);
    }
  };

  // Update selected customer when customers are loaded and customerId is set
  useEffect(() => {
    if (customerId && customers.length > 0 && !selectedCustomer) {
      const customer = customers.find(
        (c) => (c.customer_id || c.CustomerID || c.id) === customerId
      );
      if (customer) {
        setSelectedCustomer(customer);
      }
    }
  }, [customerId, customers, selectedCustomer]);

  const filteredProducts = useMemo(() => {
    const searchWords = productSearchQuery
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (searchWords.length === 0) return products.slice(0, 50);

    return products
      .filter((p) => {
        const name = String(p.name || p.Name || '').toLowerCase();
        const barcode = String(p.barcode || p.Barcode || '').toLowerCase();
        const productId = String(p.product_id || p.ProductID || '').toLowerCase();
        const searchableText = `${name} ${barcode} ${productId}`;
        return searchWords.every((word) => searchableText.includes(word));
      })
      .slice(0, 50);
  }, [products, productSearchQuery]);

  const filteredCustomers = useMemo(() => {
    const searchWords = customerSearchQuery
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (searchWords.length === 0) return customers.slice(0, 50);

    return customers
      .filter((c) => {
        const name = String(c.name || c.Name || '').toLowerCase();
        const cid = String(c.customer_id || c.CustomerID || '').toLowerCase();
        const phone = String(c.phone || c.Phone || '').toLowerCase();
        const searchableText = `${name} ${cid} ${phone}`;
        return searchWords.every((word) => searchableText.includes(word));
      })
      .slice(0, 50);
  }, [customers, customerSearchQuery]);

  const handleUpdateQuantity = (detailID: string, newQuantity: number) => {
    setDetails((prev) =>
      prev.map((item) =>
        item.QuotationDetailID === detailID ? { ...item, Quantity: newQuantity } : item
      )
    );
  };

  const handleUpdatePrice = (detailID: string, newPrice: number) => {
    setDetails((prev) =>
      prev.map((item) =>
        item.QuotationDetailID === detailID ? { ...item, UnitPrice: newPrice } : item
      )
    );
  };

  const handleUpdateNotes = (detailID: string, newNotes: string) => {
    setDetails((prev) =>
      prev.map((item) =>
        item.QuotationDetailID === detailID ? { ...item, notes: newNotes } : item
      )
    );
  };

  const handleRemoveItem = (detailID: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الصنف؟')) {
      setDetails((prev) => prev.filter((item) => item.QuotationDetailID !== detailID));
    }
  };

  const handleAddProduct = (productParam?: any, quantityParam?: number, priceParam?: number) => {
    const productToAdd = productParam || products.find((p) => p.ProductID === selectedProductId || p.id === selectedProductId || p.product_id === selectedProductId);
    
    if (!productToAdd) {
      if (!selectedProductId) {
        alert('يرجى اختيار منتج');
      } else {
        alert('المنتج غير موجود');
      }
      return;
    }

    const quantity = quantityParam != null ? quantityParam : newProductQuantity;
    const unitPrice = priceParam != null && priceParam > 0 
      ? priceParam 
      : (newProductPrice != null && newProductPrice > 0) 
        ? newProductPrice 
        : (productToAdd.SalePrice || productToAdd.sale_price || productToAdd.price || 0);

    const newDetail: QuotationDetail = {
      QuotationDetailID: `temp-${Date.now()}`,
      QuotationID: quotationId,
      ProductID: productToAdd.ProductID || productToAdd.id || productToAdd.product_id,
      Quantity: quantity,
      UnitPrice: unitPrice,
      notes: '',
      product: {
        name: productToAdd.Name || productToAdd.name || '',
        barcode: productToAdd.Barcode || productToAdd.barcode,
        shamelNo: productToAdd['Shamel No'] || productToAdd.ShamelNo || productToAdd.shamel_no || productToAdd.shamelNo,
        costPrice: productToAdd.CostPrice || productToAdd.cost_price || productToAdd.costPrice || 0,
      },
    };

    setDetails((prev) => [...prev, newDetail]);
    setSelectedProductId('');
    setNewProductQuantity(1);
    setNewProductPrice(0);
    setShowAddProduct(false);
    setProductSearchQuery('');
  };

  const calculateSubtotal = () => {
    return details.reduce((sum, item) => sum + item.Quantity * item.UnitPrice, 0);
  };

  const calculateCostSubtotal = () => {
    return details.reduce((sum, item) => sum + item.Quantity * (item.product?.costPrice || 0), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return subtotal - specialDiscountAmount - giftDiscountAmount;
  };

  const calculateCostTotal = () => {
    // إجمالي التكلفة: لا تتأثر بالخصومات لأنها تكلفة الشراء الفعلية من المورد
    // اسم الحقل "بعد الخصم" للمطابقة مع الواجهة لكن القيمة بدون خصم
    return calculateCostSubtotal();
  };

  const calculateProfit = () => {
    // الربح = الإجمالي - إجمالي التكلفة
    // حيث أن الإجمالي = المجموع الفرعي - الخصومات
    // وإجمالي التكلفة = التكلفة الفرعية (بدون خصم لأنها تكلفة الشراء الفعلية)
    return calculateTotal() - calculateCostTotal();
  };

  const calculateDiscountPercentage = () => {
    const subtotal = calculateSubtotal();
    const totalDiscount = specialDiscountAmount + giftDiscountAmount;
    if (subtotal === 0 || totalDiscount === 0) return 0;
    return (totalDiscount / subtotal) * 100;
  };

  const handleConvertToInvoice = async (target: 'shop' | 'warehouse') => {
    if (!customerId) {
      alert('يجب اختيار زبون قبل التحويل إلى فاتورة');
      return;
    }
    if (details.length === 0) {
      alert('لا يمكن التحويل بدون بنود');
      return;
    }

    const discountSum = (specialDiscountAmount || 0) + (giftDiscountAmount || 0);
    const itemsPayload = details.map((item) => ({
      productID: item.ProductID,
      quantity: item.Quantity,
      unitPrice: item.UnitPrice,
    }));

    try {
      setConverting(target);
      setConvertMessage(null);
      if (target === 'shop') {
        const res = await saveShopSalesInvoice({
          customerID: customerId,
          date,
          items: itemsPayload,
          notes,
          discount: discountSum,
          status: mapToInvoiceStatus(),
          created_by: admin?.id || undefined,
        });
        setConvertMessage(`تم التحويل إلى فاتورة المحل بنجاح (رقم: ${res?.invoiceID || '—'})`);
      } else {
        const res = await saveWarehouseSalesInvoice({
          customerID: customerId,
          date,
          items: itemsPayload,
          notes,
          discount: discountSum,
          status: mapToInvoiceStatus(),
          created_by: admin?.id || undefined,
        });
        setConvertMessage(`تم التحويل إلى فاتورة المخزن بنجاح (رقم: ${res?.invoiceID || '—'})`);
      }
    } catch (err: any) {
      console.error('[EditQuotationPage] convert to invoice error:', err);
      alert(err?.message || 'فشل التحويل إلى فاتورة');
    } finally {
      setConverting(null);
    }
  };

  const handleSave = async () => {
    if (details.length === 0) {
      alert('يرجى إضافة منتج واحد على الأقل');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveQuotation(quotationId, {
        date,
        customerId: customerId || null,
        notes,
        status,
        specialDiscountAmount,
        giftDiscountAmount,
        created_by: admin?.id || undefined,
        items: details.map((item) => ({
          detailID: item.QuotationDetailID.startsWith('temp-') ? undefined : item.QuotationDetailID,
          productID: item.ProductID,
          quantity: item.Quantity,
          unitPrice: item.UnitPrice,
          notes: item.notes || '',
        })),
      });
      router.push('/admin/quotations');
    } catch (err: any) {
      console.error('[EditQuotationPage] Failed to save quotation:', err);
      setError(err?.message || 'فشل حفظ العرض السعري');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintAndSave = async () => {
    if (details.length === 0) {
      alert('يرجى إضافة منتج واحد على الأقل');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveQuotation(quotationId, {
        date,
        customerId: customerId || null,
        notes,
        status,
        specialDiscountAmount,
        giftDiscountAmount,
        created_by: admin?.id || undefined,
        items: details.map((item) => ({
          detailID: item.QuotationDetailID.startsWith('temp-') ? undefined : item.QuotationDetailID,
          productID: item.ProductID,
          quantity: item.Quantity,
          unitPrice: item.UnitPrice,
          notes: item.notes || '',
        })),
      });
      
      // Open print page in new window
      const url = `/admin/quotations/print/${quotationId}`;
      window.open(url, `print-quotation-${quotationId}`, 'noopener,noreferrer');
    } catch (err: any) {
      console.error('[EditQuotationPage] Failed to save and print quotation:', err);
      setError(err?.message || 'فشل حفظ العرض السعري');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('هل أنت متأكد من حذف هذا العرض السعري؟')) {
      return;
    }

    setDeleting(true);
    try {
      await deleteQuotation(quotationId);
      router.push('/admin/quotations');
    } catch (err: any) {
      console.error('[EditQuotationPage] Failed to delete quotation:', err);
      alert(err?.message || 'فشل حذف العرض السعري');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-cairo">جاري التحميل...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error && !quotation) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <p className="text-red-600 text-lg mb-4 font-cairo">{error}</p>
            <button
              onClick={() => router.push('/admin/quotations')}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo"
            >
              العودة
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
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">تعديل عرض سعري</h1>
            <p className="text-gray-600 mt-1">#{quotation?.QuotationID}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowCosts((prev) => !prev)}
              disabled={!canViewCost}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {showCosts ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button
              onClick={() => handleConvertToInvoice('shop')}
              disabled={converting !== null}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-cairo disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {converting === 'shop' ? <Loader2 size={18} className="animate-spin" /> : null}
              تحويل لفاتورة المحل
            </button>
            <button
              onClick={() => handleConvertToInvoice('warehouse')}
              disabled={converting !== null}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-cairo disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {converting === 'warehouse' ? <Loader2 size={18} className="animate-spin" /> : null}
              تحويل لفاتورة المخزن
            </button>
            <button
              onClick={() => router.push('/admin/quotations')}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo text-gray-900 font-bold"
            >
              <ArrowLeft size={20} />
              إلغاء
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 font-cairo">{error}</p>
          </div>
        )}
        {convertMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-700 font-cairo">{convertMessage}</p>
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">التاريخ</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
              />
            </div>
            <div className="relative" ref={customerDropdownRef}>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 font-cairo">الزبون</label>
                {selectedCustomer && customerId && (
                  <button
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey || e.shiftKey) {
                        window.open(`/admin/customers/${customerId}`, '_blank', 'noopener,noreferrer');
                        return;
                      }
                      router.push(`/admin/customers/${customerId}`);
                    }}
                    onMouseDown={(e) => {
                      if (e.button === 1) {
                        e.preventDefault();
                        window.open(`/admin/customers/${customerId}`, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                    title="فتح بروفايل الزبون (Ctrl+Click أو Shift+Click لفتح في تبويب جديد)"
                  >
                    فتح البروفايل
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={selectedCustomer ? (selectedCustomer.name || selectedCustomer.Name || '') : customerSearchQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCustomerSearchQuery(value);
                    if (value === '') {
                      setSelectedCustomer(null);
                      setCustomerId('');
                    } else {
                      setSelectedCustomer(null);
                      setCustomerId('');
                    }
                    setIsCustomerDropdownOpen(true);
                  }}
                  onFocus={() => {
                    if (!selectedCustomer) {
                      setIsCustomerDropdownOpen(true);
                    }
                  }}
                  placeholder="ابحث عن زبون..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
                />
                {isCustomerDropdownOpen && filteredCustomers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredCustomers.map((customer) => (
                      <button
                        key={customer.customer_id || customer.CustomerID || customer.id}
                        type="button"
                        onClick={() => {
                          setCustomerId(customer.customer_id || customer.CustomerID || customer.id || '');
                          setSelectedCustomer(customer);
                          setCustomerSearchQuery('');
                          setIsCustomerDropdownOpen(false);
                        }}
                        className="w-full text-right px-4 py-2 hover:bg-gray-100 text-gray-900 font-cairo"
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex-1 text-right">
                            {customer.name || customer.Name} ({customer.customer_id || customer.CustomerID || customer.id})
                          </span>
                          {canViewBalances && (
                            <span className="text-sm text-gray-500 mr-2" dir="ltr">
                              رصيد: ₪{((customer.balance || customer.Balance || 0)).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedCustomer && canViewBalances && (
                <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between text-sm font-cairo">
                    <span className="text-gray-600">الرصيد:</span>
                    <span className={`font-semibold ${(selectedCustomer.balance || selectedCustomer.Balance || 0) > 0 ? 'text-red-600' : (selectedCustomer.balance || selectedCustomer.Balance || 0) < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                      ₪{((selectedCustomer.balance || selectedCustomer.Balance || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">الحالة</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">الخصم الخاص</label>
              <input
                type="number"
                step="1"
                value={specialDiscountAmount}
                onChange={(e) => setSpecialDiscountAmount(parseFloat(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">خصم الهدايا</label>
              <input
                type="number"
                step="1"
                value={giftDiscountAmount}
                onChange={(e) => setGiftDiscountAmount(parseFloat(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">الملاحظات</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
            />
          </div>

          {/* Products */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 font-cairo">المنتجات</h2>
              <button
                onClick={() => setShowAddProduct(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo"
              >
                <Plus size={20} />
                إضافة منتج
              </button>
            </div>

            {showAddProduct && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                {/* Barcode Scanner */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">مسح الباركود أو رقم الشامل</label>
                  <BarcodeScannerInput
                    onProductFound={(product) => {
                      handleAddProduct(product, 1);
                    }}
                    products={products}
                    placeholder="امسح الباركود أو رقم الشامل..."
                    className="w-full"
                  />
                </div>
                
                <div className="relative mb-4" ref={productDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">اختر منتج</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={productSearchQuery}
                      onChange={(e) => {
                        setProductSearchQuery(e.target.value);
                        setIsProductDropdownOpen(true);
                      }}
                      onFocus={() => setIsProductDropdownOpen(true)}
                      placeholder="ابحث عن منتج..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
                    />
                    {isProductDropdownOpen && filteredProducts.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredProducts.map((product) => {
                          const imageUrl = product.Image || product.image || '';
                          return (
                          <button
                            key={product.ProductID || product.id || product.product_id}
                            type="button"
                            onClick={() => {
                              setSelectedProductId(product.ProductID || product.id || product.product_id);
                              setNewProductPrice(product.SalePrice || product.sale_price || product.price || 0);
                              setIsProductDropdownOpen(false);
                              setProductSearchQuery(product.Name || product.name || '');
                            }}
                            className="w-full text-right px-4 py-2 hover:bg-gray-100 text-gray-900 font-cairo"
                          >
                            <div className="flex items-center gap-3">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={product.Name || product.name}
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
                                <div className="flex items-center justify-between gap-2">
                                  <span className="flex-1 text-right truncate">{product.Name || product.name}</span>
                                  <span className="flex items-center gap-2 text-left flex-shrink-0" dir="ltr">
                                    <span className="text-gray-600 text-xs">
                                      (محل: {product.CS_Shop || product.cs_shop || 0} | مخزن: {product.CS_War || product.cs_war || 0})
                                    </span>
                                    <span className="font-semibold">₪{product.SalePrice || product.sale_price || product.price || 0}</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">الكمية</label>
                    <input
                      type="number"
                      step="1"
                      value={newProductQuantity}
                      onChange={(e) => setNewProductQuantity(parseFloat(e.target.value) || 1)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">سعر الوحدة</label>
                    <input
                      type="number"
                      step="1"
                      value={newProductPrice}
                      onChange={(e) => setNewProductPrice(parseFloat(e.target.value) || 0)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddProduct}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo"
                  >
                    إضافة
                  </button>
                  <button
                    onClick={() => {
                      setShowAddProduct(false);
                      setSelectedProductId('');
                      setProductSearchQuery('');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo text-gray-900 font-bold"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            {details.length === 0 ? (
              <div className="text-center py-8 text-gray-500 font-cairo">لا توجد منتجات</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">المنتج</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">الكمية</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">سعر الوحدة</th>
                      {showCosts && canViewCost && (
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">تكلفة الوحدة</th>
                      )}
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">الإجمالي</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {details.map((item, index) => {
                      // Get product image from products array if not in item.product
                      const product = products.find(p => (p.ProductID || p.id || p.product_id) === item.ProductID);
                      const imageUrl = item.product?.image || product?.Image || product?.image || '';
                      const productName = item.product?.name || product?.Name || product?.name || `Product ${item.ProductID}`;
                      return (
                      <tr key={item.QuotationDetailID || index}>
                        <td className="px-4 py-3 text-sm text-gray-900 font-cairo">
                          <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {imageUrl ? (
                              <>
                                <img
                                  src={imageUrl}
                                  alt={productName}
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
                            <span>{productName}</span>
                            </div>
                            <div>
                              <textarea
                                value={item.notes || ''}
                                onChange={(e) => handleUpdateNotes(item.QuotationDetailID, e.target.value)}
                                placeholder="ملاحظات..."
                                rows={2}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded text-gray-900 font-cairo resize-none"
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="1"
                            value={item.Quantity}
                            onChange={(e) => handleUpdateQuantity(item.QuotationDetailID, parseFloat(e.target.value) || 0)}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-gray-900 font-bold"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="1"
                            value={item.UnitPrice}
                            onChange={(e) => handleUpdatePrice(item.QuotationDetailID, parseFloat(e.target.value) || 0)}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-gray-900 font-bold"
                          />
                        </td>
                        {showCosts && canViewCost && (
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900 font-cairo">
                            ₪{(item.product?.costPrice || 0).toFixed(2)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 font-cairo">
                          ₪{(item.Quantity * item.UnitPrice).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleRemoveItem(item.QuotationDetailID)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="حذف المنتج"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex justify-end">
              <div className="w-full md:w-1/3 space-y-2">
                <div className="flex justify-between text-sm text-gray-600 font-cairo">
                  <span>المجموع الفرعي:</span>
                  <span className="font-semibold">₪{calculateSubtotal().toFixed(2)}</span>
                </div>
                {specialDiscountAmount > 0 && (
                  <div className="flex justify-between text-sm text-gray-600 font-cairo">
                    <span>الخصم الخاص:</span>
                    <span className="font-semibold text-red-600">-₪{specialDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
                {giftDiscountAmount > 0 && (
                  <div className="flex justify-between text-sm text-gray-600 font-cairo">
                    <span>خصم الهدايا:</span>
                    <span className="font-semibold text-red-600">-₪{giftDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
                {(specialDiscountAmount > 0 || giftDiscountAmount > 0) && (
                  <div className="flex justify-between text-sm text-gray-600 font-cairo">
                    <span>نسبة الخصم:</span>
                    <span className="font-semibold text-green-600">{calculateDiscountPercentage().toFixed(2)}%</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-gray-900 font-cairo border-t border-gray-200 pt-2">
                  <span>الإجمالي:</span>
                  <span>₪{calculateTotal().toFixed(2)}</span>
                </div>
                {showCosts && canViewCost && (
                  <>
                    <div className="flex justify-between text-lg font-bold text-gray-900 font-cairo">
                      <span>إجمالي التكلفة:</span>
                      <span>₪{calculateCostTotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-green-600 font-cairo border-t border-gray-200 pt-2">
                      <span>الربح:</span>
                      <span>₪{calculateProfit().toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            {canAccountant && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-cairo disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    جاري الحذف...
                  </>
                ) : (
                  <>
                    <Trash2 size={20} />
                    حذف
                  </>
                )}
              </button>
            )}
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin/quotations')}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo text-gray-900 font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={handlePrintAndSave}
                disabled={saving || details.length === 0}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-cairo disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Printer size={20} />
                    حفظ وطباعة
                  </>
                )}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || details.length === 0}
                className="flex items-center gap-2 px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    حفظ
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}


