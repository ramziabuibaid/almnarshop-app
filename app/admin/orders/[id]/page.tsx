'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  getOnlineOrderDetailsFromSupabase,
  getOnlineOrdersFromSupabase,
  updateOnlineOrder,
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
  Search,
  ArrowRight,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAdminAuth } from '@/context/AdminAuthContext';

interface OrderDetail {
  detailID: string;
  productID: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
}

interface OnlineOrder {
  OrderID: string;
  CustomerName: string;
  CustomerPhone: string;
  CustomerEmail?: string;
  Status: string;
  Notes?: string;
  Discount?: number;
  TotalAmount: number;
  CreatedAt: string;
}

export default function EditOrderPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const { admin } = useAdminAuth();

  const [order, setOrder] = useState<OnlineOrder | null>(null);
  const [details, setDetails] = useState<OrderDetail[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('Pending');
  const [discount, setDiscount] = useState(0);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [newProductQuantity, setNewProductQuantity] = useState(1);
  const [newProductPrice, setNewProductPrice] = useState(0);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [converting, setConverting] = useState<'shop' | 'warehouse' | null>(null);
  const [convertMessage, setConvertMessage] = useState<string | null>(null);
  const [showCosts, setShowCosts] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  const canViewCost = admin?.is_super_admin || admin?.permissions?.viewCost === true;

  useEffect(() => {
    if (orderId) {
      loadOrderData();
      loadProducts();
      loadCustomers();
    }
  }, [orderId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadOrderData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load order header
      const orders = await getOnlineOrdersFromSupabase(1000);
      const foundOrder = orders.find((ord: OnlineOrder) => ord.OrderID === orderId);
      
      if (!foundOrder) {
        throw new Error('الطلبية غير موجودة');
      }

      setOrder(foundOrder);
      setNotes(foundOrder.Notes || '');
      setStatus(foundOrder.Status || 'Pending');
      setDiscount(foundOrder.Discount || 0);

      // Load order details
      const orderDetails = await getOnlineOrderDetailsFromSupabase(orderId);
      // Map details to match our interface
      const mappedDetails: OrderDetail[] = orderDetails.map((detail: any) => ({
        detailID: detail.detail_id || detail.DetailID || '',
        productID: detail.product_id || detail.ProductID || '',
        productName: detail.product_name || detail.ProductName || '',
        quantity: parseFloat(String(detail.quantity || detail.Quantity || 0)) || 0,
        unitPrice: parseFloat(String(detail.unit_price || detail.UnitPrice || 0)) || 0,
      }));
      setDetails(mappedDetails);
    } catch (err: any) {
      console.error('[EditOrderPage] Failed to load order:', err);
      setError(err?.message || 'فشل تحميل الطلبية');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const productsData = await getProducts();
      setProducts(productsData);
    } catch (err: any) {
      console.error('[EditOrderPage] Failed to load products:', err);
    }
  };

  const loadCustomers = async () => {
    try {
      const customersData = await getAllCustomers();
      setCustomers(customersData);
    } catch (err: any) {
      console.error('[EditOrderPage] Failed to load customers:', err);
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

    const product = products.find((p) => p.ProductID === selectedProductId || p.id === selectedProductId || p.product_id === selectedProductId);
    if (!product) {
      alert('المنتج غير موجود');
      return;
    }

    const newDetail: OrderDetail = {
      detailID: `temp-${Date.now()}`,
      productID: product.ProductID || product.id || product.product_id,
      productName: product.Name || product.name || '',
      quantity: newProductQuantity,
      unitPrice: (newProductPrice != null && newProductPrice > 0) ? newProductPrice : (product.SalePrice || product.sale_price || product.price || 0),
      costPrice: product.CostPrice || product.cost_price || product.costPrice || 0,
    };

    setDetails((prev) => [...prev, newDetail]);
    setSelectedProductId('');
    setNewProductQuantity(1);
    setNewProductPrice(product.SalePrice || product.price || 0);
    setShowAddProduct(false);
    setProductSearchQuery('');
  };

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

  const calculateSubtotal = () => {
    return details.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  const calculateCostSubtotal = () => {
    return details.reduce((sum, item) => sum + item.quantity * (item.costPrice || 0), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return subtotal - discount;
  };

  const calculateCostTotal = () => {
    const subtotal = calculateCostSubtotal();
    return subtotal - discount;
  };

  const calculateProfit = () => {
    return calculateTotal() - calculateCostTotal();
  };

  const handleSave = async () => {
    if (details.length === 0) {
      alert('لا يمكن حفظ طلبية بدون أصناف');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        items: details.map((item) => ({
          detailID: item.detailID.startsWith('temp-') ? undefined : item.detailID,
          productID: item.productID,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        notes: notes || undefined,
        status: status,
        discount: discount || 0,
      };

      await updateOnlineOrder(orderId, payload);
      alert('تم حفظ التعديلات بنجاح');
      router.push('/admin/orders');
    } catch (err: any) {
      console.error('[EditOrderPage] Failed to save:', err);
      setError(err?.message || 'فشل حفظ التعديلات');
      alert('فشل حفظ التعديلات: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setSaving(false);
    }
  };

  const findCustomerByOrderInfo = (): string | null => {
    if (!order) return null;
    
    // Try to find customer by phone first
    const customerByPhone = customers.find(
      (c) => c.phone === order.CustomerPhone || c.Phone === order.CustomerPhone
    );
    if (customerByPhone) {
      return customerByPhone.customer_id || customerByPhone.CustomerID || customerByPhone.id || null;
    }
    
    // Try to find customer by name
    const customerByName = customers.find(
      (c) => c.name === order.CustomerName || c.Name === order.CustomerName
    );
    if (customerByName) {
      return customerByName.customer_id || customerByName.CustomerID || customerByName.id || null;
    }
    
    return null;
  };

  const mapToInvoiceStatus = (): 'غير مدفوع' | 'تقسيط شهري' | 'دفعت بالكامل' | 'مدفوع جزئي' => {
    return 'غير مدفوع' as const;
  };

  const handleConvertToInvoice = async (target: 'shop' | 'warehouse') => {
    const customerId = findCustomerByOrderInfo();
    
    if (!customerId) {
      alert('لم يتم العثور على الزبون في قاعدة البيانات. يرجى التأكد من وجود الزبون في جدول الزبائن قبل التحويل.');
      return;
    }
    
    if (details.length === 0) {
      alert('لا يمكن التحويل بدون بنود');
      return;
    }

    const itemsPayload = details.map((item) => ({
      productID: item.productID,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));

    // Get current date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    try {
      setConverting(target);
      setConvertMessage(null);
      if (target === 'shop') {
        const res = await saveShopSalesInvoice({
          customerID: customerId,
          date: today,
          items: itemsPayload,
          notes: notes || undefined,
          discount: discount || 0,
          status: mapToInvoiceStatus(),
        });
        setConvertMessage(`تم التحويل إلى فاتورة المحل بنجاح (رقم: ${res?.invoiceID || '—'})`);
      } else {
        const res = await saveWarehouseSalesInvoice({
          customerID: customerId,
          date: today,
          items: itemsPayload,
          notes: notes || undefined,
          discount: discount || 0,
          status: mapToInvoiceStatus(),
        });
        setConvertMessage(`تم التحويل إلى فاتورة المخزن بنجاح (رقم: ${res?.invoiceID || '—'})`);
      }
    } catch (err: any) {
      console.error('[EditOrderPage] convert to invoice error:', err);
      alert(err?.message || 'فشل التحويل إلى فاتورة');
    } finally {
      setConverting(null);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-cairo">جاري تحميل الطلبية...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error && !order) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <p className="text-red-600 text-lg mb-4 font-cairo">{error}</p>
            <button
              onClick={() => router.push('/admin/orders')}
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
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">تعديل الطلبية</h1>
            <p className="text-gray-600 mt-1">رقم الطلبية: {orderId}</p>
            {order && (
              <div className="mt-2 text-sm text-gray-500">
                <p>العميل: {order.CustomerName}</p>
                <p>الهاتف: {order.CustomerPhone}</p>
              </div>
            )}
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
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-cairo disabled:opacity-50 disabled:cursor-not-allowed"
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
              onClick={() => router.push('/admin/orders')}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo"
            >
              <ArrowRight size={18} />
              العودة
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">الملاحظات</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
                placeholder="أضف ملاحظات..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">الحالة</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
              >
                <option value="Pending">قيد الانتظار</option>
                <option value="Processing">قيد المعالجة</option>
                <option value="Completed">مكتملة</option>
                <option value="Cancelled">ملغاة</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">الخصم (₪)</label>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
              />
            </div>
          </div>

          {/* Products */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 font-cairo">الأصناف</h2>
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
                        {filteredProducts.map((product) => (
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
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex-1 text-right">{product.Name || product.name}</span>
                              <span className="flex items-center gap-2 text-left" dir="ltr">
                                <span className="text-gray-600 text-sm">
                                  (محل: {product.CS_Shop || product.cs_shop || 0} | مخزن: {product.CS_War || product.cs_war || 0})
                                </span>
                                <span className="font-semibold">₪{product.SalePrice || product.sale_price || product.price || 0}</span>
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">الكمية</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newProductQuantity}
                      onChange={(e) => setNewProductQuantity(parseFloat(e.target.value) || 1)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">سعر الوحدة</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newProductPrice}
                      onChange={(e) => setNewProductPrice(parseFloat(e.target.value) || 0)}
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
              <div className="text-center py-8 text-gray-500 font-cairo">لا توجد أصناف</div>
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
                    {details.map((item, index) => (
                      <tr key={item.detailID || index}>
                        <td className="px-4 py-3 text-sm text-gray-900 font-cairo">{item.productName || '—'}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => handleUpdateQuantity(item.detailID, parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-gray-900 font-bold"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdatePrice(item.detailID, parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-gray-900 font-bold"
                          />
                        </td>
                        {showCosts && canViewCost && (
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900 font-cairo">
                            ₪{(item.costPrice || 0).toFixed(2)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 font-cairo">
                          ₪{(item.quantity * item.unitPrice).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleRemoveItem(item.detailID)}
                            className="text-red-600 hover:text-red-900 font-cairo"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
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
                {showCosts && canViewCost && (
                  <div className="flex justify-between text-sm text-gray-600 font-cairo">
                    <span>إجمالي التكلفة الفرعي:</span>
                    <span className="font-semibold text-gray-900">₪{calculateCostSubtotal().toFixed(2)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-gray-600 font-cairo">
                    <span>الخصم:</span>
                    <span className="font-semibold text-red-600">-₪{discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-gray-900 font-cairo border-t border-gray-200 pt-2">
                  <span>الصافي للدفع:</span>
                  <span>₪{calculateTotal().toFixed(2)}</span>
                </div>
                {showCosts && canViewCost && (
                  <>
                    <div className="flex justify-between text-lg font-bold text-gray-900 font-cairo">
                      <span>إجمالي التكلفة بعد الخصم:</span>
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
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => router.push('/admin/orders')}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo text-gray-900 font-bold"
            >
              إلغاء
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
                  حفظ التعديلات
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
