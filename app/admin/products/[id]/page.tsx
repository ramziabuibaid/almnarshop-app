'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import ProductFormModal from '@/components/admin/ProductFormModal';
import { getProductById, getShopSalesInvoicesByProduct, getWarehouseSalesInvoicesByProduct, getQuotationsByProduct, getCashInvoicesByProduct } from '@/lib/api';
import { getDirectImageUrl } from '@/lib/utils';
import {
  Loader2,
  Package,
  Barcode,
  Hash,
  Edit,
  ShoppingCart,
  FileText,
  ArrowLeft,
  Image as ImageIcon,
  Printer,
  Tag,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface TimelineItem {
  type: 'invoice' | 'quotation';
  id: string;
  date: string;
  amount?: number;
  invoiceNumber?: string;
  quotationNumber?: string;
  customerName?: string;
  customerPhone?: string;
  customerID?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
  subtotal?: number;
  totalAmount?: number;
  discount?: number;
  items?: any[];
  source?: string;
  status?: string;
  AccountantSign?: string;
  isSettled?: boolean;
  notes?: string;
  CreatedAt?: string;
  [key: string]: any;
}

export default function ProductProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { admin, loading: adminLoading } = useAdminAuth();
  const productId = params?.id as string;
  
  // Check if user has permission to view balances
  const canViewCost = admin?.is_super_admin || admin?.permissions?.viewCost === true;

  const [product, setProduct] = useState<any>(null);
  const [productData, setProductData] = useState<{
    shopInvoices: any[];
    warehouseInvoices: any[];
    cashInvoices: any[];
    quotations: any[];
  }>({
    shopInvoices: [],
    warehouseInvoices: [],
    cashInvoices: [],
    quotations: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loadingHeavyData, setLoadingHeavyData] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Check permission and redirect if unauthorized
  useEffect(() => {
    if (admin && !adminLoading) {
      if (!canViewCost) {
        // User doesn't have permission, redirect to products page
        router.push('/admin/products');
      }
    }
  }, [admin, adminLoading, canViewCost, router]);

  useEffect(() => {
    // Only load product if user has permission
    if (productId && canViewCost) {
      // Load basic info first, then heavy data in background
      loadProductBasicInfo().then(() => {
        // Load heavy data in background after basic info is loaded
        loadProductHeavyData();
      }).catch(() => {
        // Even if basic info fails, try to load heavy data if productId is valid
        if (productId) {
          loadProductHeavyData();
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, canViewCost]);

  // Get all product images with direct URLs
  const productImages = useMemo(() => {
    if (!product) return [];
    return [
      product.Image || product.image,
      product['Image 2'] || product.image2,
      product['image 3'] || product.image3,
    ]
      .filter(Boolean)
      .map((img) => getDirectImageUrl(img));
  }, [product]);

  // Handle ESC key and arrow keys for lightbox
  useEffect(() => {
    if (!lightboxOpen || productImages.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowLeft' && productImages.length > 1) {
        setSelectedImageIndex((prev) => (prev === 0 ? productImages.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight' && productImages.length > 1) {
        setSelectedImageIndex((prev) => (prev === productImages.length - 1 ? 0 : prev + 1));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [lightboxOpen, productImages.length]);

  // Load basic product info first (fast)
  const loadProductBasicInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const idString = String(productId || '').trim();
      console.log('[ProductProfile] Fetching basic info for ID:', idString);
      
      if (!idString || idString === '') {
        throw new Error('Product ID is missing or invalid');
      }

      const foundProduct = await getProductById(idString);

      if (!foundProduct) {
        throw new Error('Product not found or ID incorrect');
      }

      setProduct(foundProduct);
      // Basic info loaded, show UI immediately
      setLoading(false);
    } catch (error: any) {
      console.error('[ProductProfile] Error loading product basic info:', error);
      
      let errorMessage = 'Failed to load product data.';
      
      if (error?.message?.includes('not found') || error?.message?.includes('ID incorrect')) {
        errorMessage = 'Product not found or ID incorrect. Please check the product ID and try again.';
      } else if (error?.message?.includes('Network error') || error?.message?.includes('Failed to connect')) {
        errorMessage = 'Network error: Could not connect to server. Please check your internet connection.';
      } else if (error?.message?.includes('timeout')) {
        errorMessage = 'Request timeout: The server took too long to respond. Please try again.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  // Load heavy data in background (invoices, quotations)
  const loadProductHeavyData = async () => {
    if (!productId) return;
    
    setLoadingHeavyData(true);
    try {
      const idString = String(productId || '').trim();
      console.log('[ProductProfile] Loading heavy data for ID:', idString);

      // Load all data in parallel
      const [shopInvoices, warehouseInvoices, cashInvoices, quotations] = await Promise.all([
        getShopSalesInvoicesByProduct(idString).catch(err => {
          console.error('[ProductProfile] Failed to load shop invoices:', err);
          return [];
        }),
        getWarehouseSalesInvoicesByProduct(idString).catch(err => {
          console.error('[ProductProfile] Failed to load warehouse invoices:', err);
          return [];
        }),
        getCashInvoicesByProduct(idString).catch(err => {
          console.error('[ProductProfile] Failed to load cash invoices:', err);
          return [];
        }),
        getQuotationsByProduct(idString).catch(err => {
          console.error('[ProductProfile] Failed to load quotations:', err);
          return [];
        }),
      ]);

      setProductData({
        shopInvoices: shopInvoices || [],
        warehouseInvoices: warehouseInvoices || [],
        cashInvoices: cashInvoices || [],
        quotations: quotations || [],
      });
    } catch (error: any) {
      console.error('[ProductProfile] Error loading heavy data:', error);
      // Don't show error to user for background loading, just log it
    } finally {
      setLoadingHeavyData(false);
    }
  };

  // Combine all sales invoices (shop and warehouse) into timeline items
  const salesItems = useMemo(() => {
    const items: TimelineItem[] = [];

    // Add shop sales invoices
    (productData.shopInvoices || []).forEach((invoice: any) => {
      const invoiceId = invoice.InvoiceID || invoice.id || invoice.invoiceID;
      if (!invoiceId || invoiceId === '') return;
      
      items.push({
        type: 'invoice',
        id: String(invoiceId),
        date: invoice.Date || invoice.date || invoice.CreatedAt || '',
        amount: invoice.ProductTotal || 0,
        invoiceNumber: invoice.InvoiceNumber || invoice.invoiceNumber || invoice.InvoiceID || invoice.id,
        customerName: invoice.CustomerName || '',
        customerPhone: invoice.CustomerPhone || '',
        customerID: invoice.CustomerID || invoice.customerID || '',
        quantity: invoice.ProductQuantity || 0,
        unitPrice: invoice.ProductUnitPrice || 0,
        total: invoice.ProductTotal || 0,
        subtotal: invoice.Subtotal || 0,
        totalAmount: invoice.TotalAmount || invoice.total || 0,
        discount: invoice.Discount || 0,
        items: invoice.Items || invoice.items || [],
        source: 'Shop',
        status: invoice.Status || invoice.status,
        AccountantSign: invoice.AccountantSign || invoice.accountant_sign || 'غير مرحلة',
        notes: invoice.Notes || invoice.notes || '',
        CreatedAt: invoice.CreatedAt || invoice.created_at || invoice.date,
        ...invoice,
      });
    });

    // Add warehouse sales invoices
    (productData.warehouseInvoices || []).forEach((invoice: any) => {
      const invoiceId = invoice.InvoiceID || invoice.id || invoice.invoiceID;
      if (!invoiceId || invoiceId === '') return;
      
      items.push({
        type: 'invoice',
        id: String(invoiceId),
        date: invoice.Date || invoice.date || invoice.CreatedAt || '',
        amount: invoice.ProductTotal || 0,
        invoiceNumber: invoice.InvoiceNumber || invoice.invoiceNumber || invoice.InvoiceID || invoice.id,
        customerName: invoice.CustomerName || '',
        customerPhone: invoice.CustomerPhone || '',
        customerID: invoice.CustomerID || invoice.customerID || '',
        quantity: invoice.ProductQuantity || 0,
        unitPrice: invoice.ProductUnitPrice || 0,
        total: invoice.ProductTotal || 0,
        subtotal: invoice.Subtotal || 0,
        totalAmount: invoice.TotalAmount || invoice.total || 0,
        discount: invoice.Discount || 0,
        items: invoice.Items || invoice.items || [],
        source: 'Warehouse',
        status: invoice.Status || invoice.status,
        AccountantSign: invoice.AccountantSign || invoice.accountant_sign || 'غير مرحلة',
        notes: invoice.Notes || invoice.notes || '',
        CreatedAt: invoice.CreatedAt || invoice.created_at || invoice.date,
        ...invoice,
      });
    });

    // Add cash invoices
    (productData.cashInvoices || []).forEach((invoice: any) => {
      const invoiceId = invoice.InvoiceID || invoice.id || invoice.invoiceID;
      if (!invoiceId || invoiceId === '') return;
      
      // Cash invoices use date_time instead of date
      const invoiceDate = invoice.Date || invoice.date || invoice.date_time || invoice.CreatedAt || invoice.created_at || '';
      const createdAt = invoice.CreatedAt || invoice.created_at || invoice.date_time || invoice.date || '';
      
      items.push({
        type: 'invoice',
        id: String(invoiceId),
        date: invoiceDate,
        amount: invoice.ProductTotal || 0,
        invoiceNumber: invoice.InvoiceNumber || invoice.InvoiceID || invoice.invoiceNumber || invoice.id,
        quantity: invoice.ProductQuantity || 0,
        unitPrice: invoice.ProductUnitPrice || 0,
        total: invoice.ProductTotal || 0,
        subtotal: invoice.Subtotal || 0,
        totalAmount: invoice.TotalAmount || invoice.total || 0,
        discount: invoice.Discount || 0,
        items: invoice.Items || invoice.items || [],
        source: 'Cash',
        status: invoice.Status || invoice.status || invoice.settlement_status || '',
        isSettled: invoice.isSettled !== undefined ? invoice.isSettled : (invoice.is_settled === true || invoice.is_settled === 'true'),
        notes: invoice.Notes || invoice.notes || '',
        CreatedAt: createdAt,
        ...invoice,
      });
    });

    // Sort by date and time (newest first)
    items.sort((a, b) => {
      // Get the best available timestamp for each item
      const getTimestamp = (item: TimelineItem): number => {
        // Try created_at first (includes time)
        const createdAt = item.CreatedAt || item.created_at || '';
        if (createdAt) {
          const time = new Date(createdAt).getTime();
          if (!isNaN(time)) return time;
        }
        // Fall back to date
        const date = item.date || '';
        if (date) {
          const time = new Date(date).getTime();
          if (!isNaN(time)) return time;
        }
        return 0;
      };
      
      const timeA = getTimestamp(a);
      const timeB = getTimestamp(b);
      
      // Sort descending (newest first)
      return timeB - timeA;
    });

    return items;
  }, [productData]);

  // Separate quotations
  const quotationItems = useMemo(() => {
    const items: TimelineItem[] = [];

    (productData.quotations || []).forEach((quotation: any) => {
      const quotationId = quotation.QuotationID || quotation.id || quotation.quotationID;
      if (!quotationId || quotationId === '') return;
      
      items.push({
        type: 'quotation',
        id: String(quotationId),
        date: quotation.Date || quotation.date || quotation.CreatedAt || '',
        amount: quotation.ProductTotal || 0,
        quotationNumber: quotation.QuotationID || quotation.quotationID || quotation.id,
        quantity: quotation.ProductQuantity || 0,
        unitPrice: quotation.ProductUnitPrice || 0,
        total: quotation.ProductTotal || 0,
        subtotal: quotation.Subtotal || 0,
        totalAmount: quotation.TotalAmount || quotation.total || 0,
        specialDiscount: quotation.SpecialDiscount || 0,
        giftDiscount: quotation.GiftDiscount || 0,
        items: quotation.Items || quotation.items || [],
        status: quotation.Status || quotation.status || '',
        notes: quotation.Notes || quotation.notes || '',
        CreatedAt: quotation.CreatedAt || quotation.created_at || quotation.date,
        ...quotation,
      });
    });

    // Sort by date (newest first)
    items.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

    return items;
  }, [productData]);

  const formatBalance = (balance: number | undefined | null) => {
    const value = balance || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return '—';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '—';
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.error('[ProductProfile] Error formatting date:', dateString, error);
      return '—';
    }
  };

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'invoice':
        return ShoppingCart;
      case 'quotation':
        return FileText;
      default:
        return FileText;
    }
  };

  const getTimelineColor = (type: string, source?: string) => {
    if (type === 'invoice') {
      if (source === 'Warehouse') {
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          border: 'border-blue-400',
          iconBg: 'bg-blue-100',
        };
      } else if (source === 'Cash') {
        return {
          bg: 'bg-amber-50',
          text: 'text-amber-700',
          border: 'border-amber-400',
          iconBg: 'bg-amber-100',
        };
      } else {
        return {
          bg: 'bg-green-50',
          text: 'text-green-700',
          border: 'border-green-400',
          iconBg: 'bg-green-100',
        };
      }
    } else if (type === 'quotation') {
      return {
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-400',
        iconBg: 'bg-purple-100',
      };
    }
    
    return {
      bg: 'bg-gray-50',
      text: 'text-gray-700',
      border: 'border-gray-400',
      iconBg: 'bg-gray-100',
    };
  };

  const handleEditSuccess = () => {
    loadProductBasicInfo();
    loadProductHeavyData();
  };

  // Show loading state while checking permissions
  if (loading || adminLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Loading product profile...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Show unauthorized message if user doesn't have permission
  if (admin && !canViewCost) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
              <h2 className="text-xl font-bold text-red-900 mb-2">غير مصرح لك بالوصول</h2>
              <p className="text-red-700 mb-4">ليس لديك الصلاحية لعرض بروفايل المنتج. تحتاج إلى صلاحية "View item cost" للوصول إلى هذه الصفحة.</p>
              <button
                onClick={() => router.push('/admin/products')}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                العودة إلى قائمة المنتجات
              </button>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !product) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-red-600 text-lg mb-4">{error || 'Product not found'}</p>
            <button
              onClick={() => router.push('/admin/products')}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Back to Products
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }


  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-4">
          {/* Top Row: Title and Back Button */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/products')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Product Profile</h1>
              <p className="text-gray-600 mt-1 text-sm md:text-base">View product information and sales history</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Product Card */}
          <div className="lg:col-span-1 space-y-4">
            {/* Product Info Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              {/* Images */}
              <div className="flex justify-center mb-4 gap-2">
                {productImages.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 w-full">
                    {productImages.slice(0, 3).map((img: string, idx: number) => (
                      <div
                        key={idx}
                        className="aspect-square bg-white border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:shadow-md hover:border-gray-300 transition-all group relative"
                        onClick={() => {
                          setSelectedImageIndex(idx);
                          setLightboxOpen(true);
                        }}
                      >
                        <img
                          src={img}
                          alt={`${product.Name || product.name || 'Product'} ${idx + 1}`}
                          className="w-full h-full object-contain bg-white"
                          style={{ 
                            backgroundColor: '#ffffff',
                            minWidth: '100%',
                            minHeight: '100%'
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-white bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center pointer-events-none">
                          <ImageIcon size={20} className="text-gray-600 opacity-0 group-hover:opacity-60 transition-opacity" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="w-full aspect-square bg-gray-200 rounded-lg flex items-center justify-center">
                    <ImageIcon size={48} className="text-gray-400" />
                  </div>
                )}
              </div>

              {/* Name */}
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
                {product.Name || product.name || 'N/A'}
              </h2>

              {/* Product Info Grid */}
              <div className="space-y-3">
                {product['Shamel No'] || product.ShamelNo ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Hash size={16} className="flex-shrink-0" />
                    <span className="text-sm">شامل: {product['Shamel No'] || product.ShamelNo}</span>
                  </div>
                ) : null}

                {product.Barcode || product.barcode ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Barcode size={16} className="flex-shrink-0" />
                    <span className="text-sm">باركود: {product.Barcode || product.barcode}</span>
                  </div>
                ) : null}

                {product.ProductID || product.id ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Package size={16} className="flex-shrink-0" />
                    <span className="text-sm">الرقم: {product.ProductID || product.id}</span>
                  </div>
                ) : null}

                {product.Type || product.type ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Tag size={16} className="flex-shrink-0" />
                    <span className="text-sm">النوع: {product.Type || product.type}</span>
                  </div>
                ) : null}

                {product.Brand || product.brand ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Tag size={16} className="flex-shrink-0" />
                    <span className="text-sm">العلامة: {product.Brand || product.brand}</span>
                  </div>
                ) : null}

                {product.Size || product.size ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Package size={16} className="flex-shrink-0" />
                    <span className="text-sm">الحجم: {product.Size || product.size}</span>
                  </div>
                ) : null}

                {product.Color || product.color ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Tag size={16} className="flex-shrink-0" />
                    <span className="text-sm">اللون: {product.Color || product.color}</span>
                  </div>
                ) : null}

                {/* Stock */}
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">المخزن:</span>
                    <span className="text-sm font-bold text-gray-900">{product.CS_War || product.cs_war || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">المحل:</span>
                    <span className="text-sm font-bold text-gray-900">{product.CS_Shop || product.cs_shop || 0}</span>
                  </div>
                </div>

                {/* Pricing */}
                <div className="pt-3 border-t border-gray-200 space-y-2">
                  {canViewCost && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">سعر التكلفة:</span>
                      <span className="text-sm font-bold text-gray-900">{formatBalance(product.CostPrice || product.costPrice || 0)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">سعر البيع:</span>
                    <span className="text-sm font-bold text-green-600">{formatBalance(product.SalePrice || product.price || product.salePrice || 0)}</span>
                  </div>
                  {product.T1Price ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">T1:</span>
                      <span className="text-sm font-bold text-gray-900">{formatBalance(product.T1Price)}</span>
                    </div>
                  ) : null}
                  {product.T2Price ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">T2:</span>
                      <span className="text-sm font-bold text-gray-900">{formatBalance(product.T2Price)}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Edit Product Button */}
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Edit size={18} />
              Edit Product
            </button>
          </div>

          {/* Right Area - Activity Timeline */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sales Invoices Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">سجل المبيعات</h2>
                {loadingHeavyData && (
                  <Loader2 size={18} className="animate-spin text-gray-400" />
                )}
              </div>

              {loadingHeavyData ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-gray-400" />
                  <span className="text-gray-600 text-lg mr-3">جاري تحميل سجل المبيعات...</span>
                </div>
              ) : salesItems.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart size={48} className="text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg">لا توجد مبيعات مسجلة</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {salesItems.map((item, index) => {
                    const Icon = getTimelineIcon(item.type);
                    const colors = getTimelineColor(item.type, item.source);
                    const uniqueKey = `${item.type}-${item.id || `fallback-${index}`}`;

                    return (
                      <div
                        key={uniqueKey}
                        className={`border-l-4 ${colors.border} pl-4 py-4 rounded-r-lg ${colors.bg} border ${colors.border} hover:shadow-sm transition-shadow`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${colors.iconBg} flex-shrink-0`}>
                            <Icon size={20} className={colors.text} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-900">
                                  {item.type === 'invoice' && item.source === 'Shop' && `فاتورة المحل #${item.invoiceNumber || item.id}`}
                                  {item.type === 'invoice' && item.source === 'Warehouse' && `فاتورة المخزن #${item.invoiceNumber || item.id}`}
                                  {item.type === 'invoice' && item.source === 'Cash' && `فاتورة نقدية #${item.invoiceNumber || item.id}`}
                                </h3>
                                {item.status && (
                                  <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                    {item.status}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">
                                  {formatDate(item.date)}
                                </span>
                                {/* Print Button */}
                                <button
                                  onClick={() => {
                                    if (item.type === 'invoice' && item.source === 'Shop') {
                                      window.open(`/admin/shop-sales/print/${item.id}`, `print-shop-${item.id}`, 'noopener,noreferrer');
                                    } else if (item.type === 'invoice' && item.source === 'Warehouse') {
                                      window.open(`/admin/warehouse-sales/print/${item.id}`, `print-warehouse-${item.id}`, 'noopener,noreferrer');
                                    } else if (item.type === 'invoice' && item.source === 'Cash') {
                                      window.open(`/admin/invoices/print/${item.id}`, `print-cash-${item.id}`, 'noopener,noreferrer');
                                    }
                                  }}
                                  className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                  title="طباعة"
                                >
                                  <Printer size={16} />
                                </button>
                                {/* Edit Button (only for invoices) */}
                                {item.type === 'invoice' && (() => {
                                  // Check if invoice is settled (cannot be edited)
                                  const isShopSettled = item.source === 'Shop' && (item.AccountantSign === 'مرحلة' || item.accountant_sign === 'مرحلة');
                                  const isWarehouseSettled = item.source === 'Warehouse' && (item.AccountantSign === 'مرحلة' || item.accountant_sign === 'مرحلة');
                                  const isCashSettled = item.source === 'Cash' && (item.isSettled === true || item.is_settled === true);
                                  const isSettled = isShopSettled || isWarehouseSettled || isCashSettled;
                                  
                                  if (isSettled) {
                                    return (
                                      <button
                                        disabled
                                        className="p-1.5 text-gray-400 cursor-not-allowed rounded-lg transition-colors opacity-50"
                                        title="لا يمكن تعديل فاتورة مرحلة"
                                      >
                                        <Edit size={16} />
                                      </button>
                                    );
                                  }
                                  
                                  return (
                                    <button
                                      onClick={(e) => {
                                        let editUrl = '';
                                        if (item.source === 'Shop') {
                                          editUrl = `/admin/shop-sales/edit/${item.id}`;
                                        } else if (item.source === 'Warehouse') {
                                          editUrl = `/admin/warehouse-sales/edit/${item.id}`;
                                        } else if (item.source === 'Cash') {
                                          editUrl = `/admin/invoices/edit/${item.id}`;
                                        }
                                        
                                        if (editUrl) {
                                          if (e.metaKey || e.ctrlKey) {
                                            // Open in new tab when Command/Ctrl is pressed
                                            window.open(editUrl, '_blank');
                                          } else {
                                            // Navigate in same tab
                                            router.push(editUrl);
                                          }
                                        }
                                      }}
                                      className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                      title="تعديل (اضغط Command/Ctrl لفتح في نافذة جديدة)"
                                    >
                                      <Edit size={16} />
                                    </button>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Customer Info */}
                            {item.customerName && (
                              <div className="text-sm text-gray-700 mb-2">
                                <span className="font-medium">الزبون:</span>{' '}
                                {item.customerID ? (
                                  <button
                                    onClick={(e) => {
                                      if (e.metaKey || e.ctrlKey) {
                                        // Open in new tab when Command/Ctrl is pressed
                                        window.open(`/admin/customers/${item.customerID}`, '_blank');
                                      } else {
                                        // Navigate in same tab
                                        router.push(`/admin/customers/${item.customerID}`);
                                      }
                                    }}
                                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                                    title="عرض بروفايل الزبون (اضغط Command/Ctrl لفتح في نافذة جديدة)"
                                  >
                                    {item.customerName}
                                  </button>
                                ) : (
                                  <span>{item.customerName}</span>
                                )}
                                {item.customerPhone && <span className="text-gray-600 mr-2"> ({item.customerPhone})</span>}
                              </div>
                            )}

                            {/* Invoice Total */}
                            {item.totalAmount !== undefined && (
                              <div className="text-sm font-semibold text-gray-900 mb-2">
                                <span className="font-medium">إجمالي الفاتورة:</span> {formatBalance(item.totalAmount)}
                                {item.subtotal !== undefined && item.subtotal !== item.totalAmount && (
                                  <span className="text-xs text-gray-500 mr-2">
                                    {' '}(المجموع الفرعي: {formatBalance(item.subtotal)})
                                    {item.discount > 0 && ` - خصم: ${formatBalance(item.discount)}`}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Invoice Items (expandable) - All products in invoice */}
                            {item.type === 'invoice' && item.items && item.items.length > 0 && (
                              <details className="mt-2">
                                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 font-medium">
                                  عرض جميع المنتجات في الفاتورة ({item.items.length} منتج)
                                </summary>
                                <div className="mt-2 pl-4 border-l-2 border-gray-200 space-y-2">
                                  {item.items
                                    .filter((invoiceItem: any) => invoiceItem)
                                    .map((invoiceItem: any, idx: number) => {
                                      const itemKey = invoiceItem.ProductID || invoiceItem.ID || invoiceItem.id || invoiceItem.Name || invoiceItem.name || `item-${idx}`;
                                      const itemName = invoiceItem.Name || invoiceItem.name || invoiceItem.product_name || 'منتج';
                                      const itemPrice = invoiceItem.Price ?? invoiceItem.price ?? invoiceItem.unit_price ?? 0;
                                      const itemQty = invoiceItem.Quantity ?? invoiceItem.quantity ?? 1;
                                      const itemTotal = invoiceItem.TotalPrice ?? (itemPrice * itemQty);
                                      const isCurrentProduct = (invoiceItem.ProductID || invoiceItem.product_id) === productId;
                                      
                                      return (
                                        <div 
                                          key={`${uniqueKey}-item-${itemKey}-${idx}`} 
                                          className={`text-sm ${isCurrentProduct ? 'bg-blue-50 border border-blue-200 p-2 rounded font-medium' : 'text-gray-700'}`}
                                        >
                                          <div className={`${isCurrentProduct ? 'text-blue-900' : 'font-medium text-gray-900'}`}>
                                            {itemName}
                                            {isCurrentProduct && <span className="text-xs text-blue-600 mr-2">(المنتج الحالي)</span>}
                                          </div>
                                          <div className="text-xs text-gray-500 mt-0.5">
                                            الكمية: {itemQty} × {formatBalance(itemPrice)} = {formatBalance(itemTotal)}
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </details>
                            )}

                            {/* Notes */}
                            {item.notes && (
                              <p className="text-xs text-gray-600 mb-2 mt-2">
                                <span className="font-medium">ملاحظات:</span> {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quotations Section - Collapsible */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <details className="group">
                <summary className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900">عروض الأسعار ({loadingHeavyData ? '...' : (quotationItems?.length || 0)})</h2>
                    {loadingHeavyData && (
                      <Loader2 size={18} className="animate-spin text-gray-400" />
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    اضغط للعرض
                  </div>
                </summary>
                <div className="px-6 pb-6 pt-2">
                  {loadingHeavyData ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 size={24} className="animate-spin text-gray-400" />
                      <span className="text-gray-600 text-lg mr-3">جاري تحميل عروض الأسعار...</span>
                    </div>
                  ) : quotationItems.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText size={48} className="text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 text-lg">لا توجد عروض أسعار</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {quotationItems.map((item, index) => {
                        const uniqueKey = `quotation-${item.id || `fallback-${index}`}`;
                        const colors = getTimelineColor('quotation');

                        return (
                          <div
                            key={uniqueKey}
                            className={`border-l-4 ${colors.border} pl-4 py-4 rounded-r-lg ${colors.bg} border ${colors.border} hover:shadow-sm transition-shadow`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${colors.iconBg} flex-shrink-0`}>
                                <FileText size={20} className={colors.text} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-gray-900">
                                      عرض سعر #{item.quotationNumber || item.id}
                                    </h3>
                                    {item.status && (
                                      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                        {item.status}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">
                                      {formatDate(item.date)}
                                    </span>
                                    <button
                                      onClick={() => {
                                        window.open(`/admin/quotations/print/${item.id}`, `print-quotation-${item.id}`, 'noopener,noreferrer');
                                      }}
                                      className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                      title="طباعة"
                                    >
                                      <Printer size={16} />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        const editUrl = `/admin/quotations/${item.id}`;
                                        if (e.metaKey || e.ctrlKey) {
                                          // Open in new tab when Command/Ctrl is pressed
                                          window.open(editUrl, '_blank');
                                        } else {
                                          // Navigate in same tab
                                          router.push(editUrl);
                                        }
                                      }}
                                      className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                      title="عرض/تعديل (اضغط Command/Ctrl لفتح في نافذة جديدة)"
                                    >
                                      <Edit size={16} />
                                    </button>
                                  </div>
                                </div>

                                {/* Quotation Total */}
                                {item.totalAmount !== undefined && (
                                  <div className="text-sm font-semibold text-gray-900 mb-2">
                                    <span className="font-medium">إجمالي عرض السعر:</span> {formatBalance(item.totalAmount)}
                                    {item.subtotal !== undefined && item.subtotal !== item.totalAmount && (
                                      <span className="text-xs text-gray-500 mr-2">
                                        {' '}(المجموع الفرعي: {formatBalance(item.subtotal)})
                                        {item.specialDiscount > 0 && ` - خصم خاص: ${formatBalance(item.specialDiscount)}`}
                                        {item.giftDiscount > 0 && ` - خصم هدية: ${formatBalance(item.giftDiscount)}`}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Quotation Items (expandable) - All products in quotation */}
                                {item.type === 'quotation' && item.items && item.items.length > 0 && (
                                  <details className="mt-2">
                                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 font-medium">
                                      عرض جميع المنتجات في عرض السعر ({item.items.length} منتج)
                                    </summary>
                                    <div className="mt-2 pl-4 border-l-2 border-gray-200 space-y-2">
                                      {item.items
                                        .filter((quotationItem: any) => quotationItem)
                                        .map((quotationItem: any, idx: number) => {
                                          const itemKey = quotationItem.ProductID || quotationItem.ID || quotationItem.id || quotationItem.Name || quotationItem.name || `item-${idx}`;
                                          const itemName = quotationItem.Name || quotationItem.name || quotationItem.product_name || 'منتج';
                                          const itemPrice = quotationItem.Price ?? quotationItem.price ?? quotationItem.unit_price ?? 0;
                                          const itemQty = quotationItem.Quantity ?? quotationItem.quantity ?? 1;
                                          const itemTotal = quotationItem.TotalPrice ?? (itemPrice * itemQty);
                                          const isCurrentProduct = (quotationItem.ProductID || quotationItem.product_id) === productId;
                                          
                                          return (
                                            <div 
                                              key={`${uniqueKey}-item-${itemKey}-${idx}`} 
                                              className={`text-sm ${isCurrentProduct ? 'bg-purple-50 border border-purple-200 p-2 rounded font-medium' : 'text-gray-700'}`}
                                            >
                                              <div className={`${isCurrentProduct ? 'text-purple-900' : 'font-medium text-gray-900'}`}>
                                                {itemName}
                                                {isCurrentProduct && <span className="text-xs text-purple-600 mr-2">(المنتج الحالي)</span>}
                                              </div>
                                              <div className="text-xs text-gray-500 mt-0.5">
                                                الكمية: {itemQty} × {formatBalance(itemPrice)} = {formatBalance(itemTotal)}
                                              </div>
                                            </div>
                                          );
                                        })}
                                    </div>
                                  </details>
                                )}

                                {/* Notes */}
                                {item.notes && (
                                  <p className="text-xs text-gray-600 mb-2 mt-2">
                                    <span className="font-medium">ملاحظات:</span> {item.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Product Modal */}
      <ProductFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        product={product}
        onSuccess={handleEditSuccess}
      />

      {/* Image Lightbox Modal */}
      {lightboxOpen && productImages.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightboxOpen(false);
            }}
            className="absolute top-4 right-4 z-10 p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full text-white transition-all duration-200 hover:scale-110"
            title="إغلاق (ESC)"
          >
            <X size={24} />
          </button>

          {/* Previous Button */}
          {productImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex((prev) => (prev === 0 ? productImages.length - 1 : prev - 1));
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full text-white transition-all duration-200 hover:scale-110"
              title="الصورة السابقة (←)"
            >
              <ChevronRight size={28} />
            </button>
          )}

          {/* Next Button */}
          {productImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex((prev) => (prev === productImages.length - 1 ? 0 : prev + 1));
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full text-white transition-all duration-200 hover:scale-110"
              title="الصورة التالية (→)"
            >
              <ChevronLeft size={28} />
            </button>
          )}

          {/* Main Image */}
          <div
            className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center bg-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={productImages[selectedImageIndex]}
              alt={`${product.Name || product.name || 'Product'} ${selectedImageIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200 bg-transparent"
              style={{ background: 'transparent' }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />

            {/* Image Counter */}
            {productImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-60 text-white px-4 py-2 rounded-full text-sm font-medium">
                {selectedImageIndex + 1} / {productImages.length}
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {productImages.length > 1 && (
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {productImages.map((img: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 hover:scale-110 bg-transparent ${
                    selectedImageIndex === idx
                      ? 'border-white shadow-lg scale-110'
                      : 'border-white border-opacity-30 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-contain bg-transparent"
                    style={{ background: 'transparent' }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

    </AdminLayout>
  );
}
