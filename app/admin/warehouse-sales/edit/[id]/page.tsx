'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  getWarehouseSalesInvoice,
  updateWarehouseSalesInvoice,
  deleteWarehouseSalesInvoice,
  getProducts,
  getAllCustomers,
} from '@/lib/api';
import {
  Loader2,
  Save,
  Plus,
  X,
  Search,
  ArrowLeft,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import BarcodeScannerInput from '@/components/admin/BarcodeScannerInput';

interface InvoiceDetail {
  detailID?: string;
  productID: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  isNew?: boolean;
  productImage?: string;
}

const STATUS_OPTIONS = [
  'غير مدفوع',
  'تقسيط شهري',
  'دفعت بالكامل',
  'مدفوع جزئي',
];

export default function EditWarehouseSalesInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;
  const { admin } = useAdminAuth();

  const [invoice, setInvoice] = useState<any>(null);
  const [date, setDate] = useState('');
  const [customerId, setCustomerId] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('غير مدفوع');
  const [discount, setDiscount] = useState(0);
  const [details, setDetails] = useState<InvoiceDetail[]>([]);
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
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  const canViewCost = admin?.is_super_admin || admin?.permissions?.viewCost === true;
  const canViewBalances = admin?.is_super_admin || admin?.permissions?.viewBalances === true;
  // Check if user has accountant permission (for delete)
  const canAccountant = admin?.is_super_admin || admin?.permissions?.accountant === true;

  useEffect(() => {
    if (invoiceId) {
      loadInvoiceData();
      loadProducts();
      loadCustomers();
    }
  }, [invoiceId]);

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

  const loadInvoiceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWarehouseSalesInvoice(invoiceId);
      
      // Check if invoice is settled
      if (data.AccountantSign === 'مرحلة') {
        setError('لا يمكن تعديل فاتورة مرحلة');
      }
      
      setInvoice(data);
      setDate(data.Date ? new Date(data.Date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      const custId = data.CustomerID || '';
      setCustomerId(custId);
      setNotes(data.Notes || '');
      setStatus(data.Status || 'غير مدفوع');
      setDiscount(data.Discount || 0);
      
      // Map invoice items to details (costPrice will be added after products are loaded)
      const mappedDetails: InvoiceDetail[] = (data.Items || []).map((item: any) => ({
        detailID: item.DetailsID,
        productID: item.ProductID,
        productName: item.ProductName || '',
        quantity: item.Quantity || 0,
        unitPrice: item.UnitPrice || 0,
        costPrice: 0, // Will be updated when products are loaded
        isNew: false,
      }));
      setDetails(mappedDetails);
    } catch (err: any) {
      console.error('[EditWarehouseSalesInvoicePage] Failed to load invoice:', err);
      setError(err?.message || 'فشل تحميل الفاتورة');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const productsData = await getProducts();
      setProducts(productsData);
      
      // Update costPrice for existing invoice items after products are loaded
      setDetails((prevDetails) => {
        return prevDetails.map((detail) => {
          // Skip if costPrice already exists (user might have added new items)
          if (detail.costPrice && detail.costPrice > 0) return detail;
          
          // Find product and get costPrice
          const product = productsData.find(
            (p) => (p.ProductID || p.id || p.product_id) === detail.productID
          );
          if (product) {
            return {
              ...detail,
              costPrice: product.CostPrice || product.cost_price || product.costPrice || 0,
            };
          }
          return detail;
        });
      });
    } catch (err: any) {
      console.error('[EditWarehouseSalesInvoicePage] Failed to load products:', err);
    }
  };

  const loadCustomers = async () => {
    try {
      const customersData = await getAllCustomers();
      setCustomers(customersData);
    } catch (err: any) {
      console.error('[EditWarehouseSalesInvoicePage] Failed to load customers:', err);
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

  const handleUpdateQuantity = (detailID: string | undefined, newQuantity: number) => {
    setDetails((prev) =>
      prev.map((item) =>
        item.detailID === detailID ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const handleUpdatePrice = (detailID: string | undefined, newPrice: number) => {
    setDetails((prev) =>
      prev.map((item) =>
        item.detailID === detailID ? { ...item, unitPrice: newPrice } : item
      )
    );
  };

  const handleRemoveItem = (detailID: string | undefined) => {
    if (confirm('هل أنت متأكد من حذف هذا الصنف؟')) {
      setDetails((prev) => prev.filter((item) => item.detailID !== detailID));
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

    const newDetail: InvoiceDetail = {
      detailID: `temp-${Date.now()}`,
      productID: productToAdd.ProductID || productToAdd.id || productToAdd.product_id,
      productName: productToAdd.Name || productToAdd.name || '',
      quantity: quantity,
      unitPrice: unitPrice,
      costPrice: productToAdd.CostPrice || productToAdd.cost_price || productToAdd.costPrice || 0,
      isNew: true,
      productImage: productToAdd.Image || productToAdd.image || '',
    };

    setDetails((prev) => [...prev, newDetail]);
    setSelectedProductId('');
    setNewProductQuantity(1);
    setNewProductPrice(0);
    setShowAddProduct(false);
    setProductSearchQuery('');
  };

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
    // إجمالي التكلفة: لا تتأثر بالخصومات لأنها تكلفة الشراء الفعلية من المورد
    return calculateCostSubtotal();
  };

  const calculateProfit = () => {
    return calculateTotal() - calculateCostTotal();
  };

  const handleSave = async () => {
    if (invoice?.AccountantSign === 'مرحلة') {
      alert('لا يمكن تعديل فاتورة مرحلة');
      return;
    }

    if (details.length === 0) {
      alert('يرجى إضافة منتج واحد على الأقل');
      return;
    }

    if (!customerId) {
      alert('يرجى اختيار العميل');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Separate items into: existing (to update), new (to add), and deleted (to remove)
      const itemsToUpdate: Array<{ detailID: string; productID: string; quantity: number; unitPrice: number }> = [];
      const itemsToAdd: Array<{ productID: string; quantity: number; unitPrice: number }> = [];
      
      // Get original invoice to find deleted items
      const originalInvoice = await getWarehouseSalesInvoice(invoiceId);
      const originalDetailIDs = new Set<string>((originalInvoice.Items || []).map((item: any) => String(item.DetailsID || '')));
      const currentDetailIDs = new Set<string>(details.filter(item => item.detailID && !item.detailID.startsWith('temp-')).map(item => String(item.detailID!)));
      
      // Find deleted items (items that were in original but not in current details)
      const itemIDsToDelete = Array.from(originalDetailIDs).filter((id: string) => !currentDetailIDs.has(id));

      // Process current details
      details.forEach((item) => {
        if (item.detailID && !item.detailID.startsWith('temp-') && !item.isNew) {
          // Existing item - check if it changed
          const originalItem = originalInvoice.Items.find((i: any) => i.DetailsID === item.detailID);
          if (originalItem) {
            const changed = 
              originalItem.Quantity !== item.quantity ||
              originalItem.UnitPrice !== item.unitPrice ||
              originalItem.ProductID !== item.productID;
            
            if (changed) {
              itemsToUpdate.push({
                detailID: item.detailID,
                productID: item.productID,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              });
            }
          }
        } else {
          // New item
          itemsToAdd.push({
            productID: item.productID,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          });
        }
      });

      const payload = {
        customerID: customerId,
        date,
        notes: notes.trim() || undefined,
        discount: discount || 0,
        status: status as 'غير مدفوع' | 'تقسيط شهري' | 'دفعت بالكامل' | 'مدفوع جزئي',
        itemsToUpdate: itemsToUpdate.length > 0 ? itemsToUpdate : undefined,
        itemsToAdd: itemsToAdd.length > 0 ? itemsToAdd : undefined,
        itemIDsToDelete: itemIDsToDelete.length > 0 ? itemIDsToDelete : undefined,
      };

      await updateWarehouseSalesInvoice(invoiceId, payload, admin?.username);
      router.push('/admin/warehouse-sales');
    } catch (err: any) {
      console.error('[EditWarehouseSalesInvoicePage] Failed to save invoice:', err);
      setError(err?.message || 'فشل حفظ الفاتورة');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.')) {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      await deleteWarehouseSalesInvoice(invoiceId, admin?.username);
      router.push('/admin/warehouse-sales');
    } catch (err: any) {
      console.error('[EditWarehouseSalesInvoicePage] Failed to delete invoice:', err);
      setError(err?.message || 'فشل حذف الفاتورة');
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

  if (error && !invoice) {
  return (
    <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <p className="text-red-600 text-lg mb-4 font-cairo">{error}</p>
            <button
              onClick={() => router.push('/admin/warehouse-sales')}
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
            <h1 className="text-3xl font-bold text-gray-900">تعديل فاتورة مبيعات المخزن</h1>
            <p className="text-gray-600 mt-1">#{invoice?.InvoiceID}</p>
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
              onClick={() => router.push('/admin/warehouse-sales')}
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
              <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">الزبون</label>
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
              {canViewBalances && selectedCustomer && (
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
              <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">الخصم</label>
              <input
                type="number"
                step="1"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
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
                      // Get product image from products array if not in item
                      const product = products.find(p => (p.ProductID || p.id || p.product_id) === item.productID);
                      const imageUrl = item.productImage || product?.Image || product?.image || '';
                      return (
                      <tr key={item.detailID || index}>
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
                            <span>{item.productName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateQuantity(item.detailID, parseFloat(e.target.value) || 0)}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-gray-900 font-bold"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="1"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdatePrice(item.detailID, parseFloat(e.target.value) || 0)}
                            onWheel={(e) => e.currentTarget.blur()}
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
                            حذف
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
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-gray-600 font-cairo">
                    <span>الخصم:</span>
                    <span className="font-semibold text-red-600">-₪{discount.toFixed(2)}</span>
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
                onClick={() => router.push('/admin/warehouse-sales')}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo text-gray-900 font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={saving || details.length === 0 || !customerId}
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
