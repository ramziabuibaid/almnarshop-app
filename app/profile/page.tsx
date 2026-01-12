'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut, DollarSign, FileText, ShoppingCart, Banknote, Wrench, Loader2, Calendar, Printer, Search, X, History, ChevronDown, ChevronUp } from 'lucide-react';
import { useShop } from '@/context/ShopContext';
import { getCustomerData, getAllMaintenance, getItemTracking, getProducts, getMaintenanceHistory, MaintenanceHistory } from '@/lib/api';

interface TimelineItem {
  type: 'invoice' | 'receipt' | 'payment' | 'maintenance';
  id: string;
  date: string;
  amount?: number;
  invoiceNumber?: string;
  receiptNumber?: string;
  paymentNumber?: string;
  items?: any[];
  source?: string;
  status?: string;
  cashAmount?: number;
  chequeAmount?: number;
  notes?: string;
  CreatedAt?: string;
  [key: string]: any;
}

export default function ProfilePage() {
  const { user, logout } = useShop();
  const router = useRouter();
  const [customerData, setCustomerData] = useState<{
    invoices: any[];
    receipts: any[];
    interactions: any[];
    quotations: any[];
  }>({
    invoices: [],
    receipts: [],
    interactions: [],
    quotations: [],
  });
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMaintenance, setLoadingMaintenance] = useState(false);
  const [trackingModal, setTrackingModal] = useState<{
    isOpen: boolean;
    shamelNo: string;
    productName: string;
    trackingHistory: any[];
    loading: boolean;
  }>({
    isOpen: false,
    shamelNo: '',
    productName: '',
    trackingHistory: [],
    loading: false,
  });
  const [products, setProducts] = useState<any[]>([]);
  const [expandedMaintenanceRows, setExpandedMaintenanceRows] = useState<Set<string>>(new Set());
  const [maintenanceHistoryMap, setMaintenanceHistoryMap] = useState<Map<string, MaintenanceHistory[]>>(new Map());
  const [loadingHistoryMap, setLoadingHistoryMap] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.title = 'الملف الشخصي - Profile';
  }, []);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    loadCustomerData();
    loadMaintenanceData();
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadCustomerData = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const data = await getCustomerData(user.id);
      setCustomerData({
        invoices: data.invoices || [],
        receipts: data.receipts || [],
        interactions: data.interactions || [],
        quotations: data.quotations || [],
      });
    } catch (error) {
      console.error('[Profile] Failed to load customer data:', error);
      setCustomerData({
        invoices: [],
        receipts: [],
        interactions: [],
        quotations: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMaintenanceData = async () => {
    if (!user?.id) return;

    setLoadingMaintenance(true);
    try {
      const allMaintenance = await getAllMaintenance(1000);
      // Filter maintenance records for this customer
      const customerMaintenance = allMaintenance.filter(
        (maint: any) => String(maint.CustomerID || maint.customer_id || '') === String(user.id || '')
      );
      setMaintenanceRecords(customerMaintenance);
    } catch (error) {
      console.error('[Profile] Failed to load maintenance data:', error);
      setMaintenanceRecords([]);
    } finally {
      setLoadingMaintenance(false);
    }
  };

  const loadProducts = async () => {
    try {
      const productsData = await getProducts();
      setProducts(productsData);
    } catch (error) {
      console.error('[Profile] Failed to load products:', error);
    }
  };

  const handleTrackItem = async (shamelNo: string, productName: string) => {
    if (!shamelNo || shamelNo.trim() === '') {
      alert('لا يوجد رقم شامل لهذا المنتج');
      return;
    }

    setTrackingModal({
      isOpen: true,
      shamelNo: shamelNo.trim(),
      productName: productName || 'منتج',
      trackingHistory: [],
      loading: true,
    });

    try {
      const history = await getItemTracking(shamelNo.trim());
      setTrackingModal(prev => ({
        ...prev,
        trackingHistory: history,
        loading: false,
      }));
    } catch (error) {
      console.error('[Profile] Failed to load item tracking:', error);
      setTrackingModal(prev => ({
        ...prev,
        trackingHistory: [],
        loading: false,
      }));
      alert('فشل تحميل تتبع القطعة');
    }
  };

  const closeTrackingModal = () => {
    setTrackingModal({
      isOpen: false,
      shamelNo: '',
      productName: '',
      trackingHistory: [],
      loading: false,
    });
  };

  const toggleMaintenanceHistory = async (maintNo: string) => {
    const isExpanded = expandedMaintenanceRows.has(maintNo);
    
    if (isExpanded) {
      // Close
      setExpandedMaintenanceRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(maintNo);
        return newSet;
      });
    } else {
      // Open and load history
      setExpandedMaintenanceRows(prev => new Set(prev).add(maintNo));
      
      // Check if history is already loaded
      if (!maintenanceHistoryMap.has(maintNo)) {
        setLoadingHistoryMap(prev => new Set(prev).add(maintNo));
        try {
          const history = await getMaintenanceHistory(maintNo);
          setMaintenanceHistoryMap(prev => {
            const newMap = new Map(prev);
            newMap.set(maintNo, history);
            return newMap;
          });
        } catch (error) {
          console.error('[Profile] Failed to load maintenance history:', error);
        } finally {
          setLoadingHistoryMap(prev => {
            const newSet = new Set(prev);
            newSet.delete(maintNo);
            return newSet;
          });
        }
      }
    }
  };

  // Format date for history (with English numbers)
  const formatHistoryDate = (dateString: string | undefined | null): string => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // Format time for history (with English numbers)
  const formatHistoryTime = (dateString: string | undefined | null): string => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Jerusalem',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return '—';
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  // Format balance
  const formatBalance = (amount: number | string | undefined | null): string => {
    if (amount === undefined || amount === null) return '₪0.00';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '₪0.00';
    return `₪${num.toFixed(2)}`;
  };

  // Format date with English numbers
  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      // Use English locale to get English numbers
      const formatted = date.toLocaleDateString('en-US', {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatted;
    } catch {
      return dateString;
    }
  };

  // Get timeline icon
  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'invoice':
        return FileText;
      case 'receipt':
        return Banknote;
      case 'payment':
        return Banknote;
      case 'maintenance':
        return Wrench;
      default:
        return FileText;
    }
  };

  // Get timeline color
  const getTimelineColor = (type: string) => {
    switch (type) {
      case 'invoice':
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-800',
          border: 'border-blue-500',
          iconBg: 'bg-blue-100',
        };
      case 'receipt':
        return {
          bg: 'bg-green-50',
          text: 'text-green-800',
          border: 'border-green-500',
          iconBg: 'bg-green-100',
        };
      case 'payment':
        return {
          bg: 'bg-red-50',
          text: 'text-red-800',
          border: 'border-red-500',
          iconBg: 'bg-red-100',
        };
      case 'maintenance':
        return {
          bg: 'bg-orange-50',
          text: 'text-orange-800',
          border: 'border-orange-500',
          iconBg: 'bg-orange-100',
        };
      default:
        return {
          bg: 'bg-gray-50',
          text: 'text-gray-700',
          border: 'border-gray-300',
          iconBg: 'bg-gray-100',
        };
    }
  };

  // Combine all financial transactions (invoices, receipts, payments)
  const financialItems = useMemo(() => {
    const items: TimelineItem[] = [];

    // Add shop and warehouse sales invoices
    (customerData.invoices || []).forEach((invoice: any) => {
      const invoiceId = invoice.InvoiceID || invoice.id || invoice.invoiceID;
      if (!invoiceId || invoiceId === '') return;
      
      items.push({
        type: 'invoice',
        id: String(invoiceId),
        date: invoice.Date || invoice.date || invoice.InvoiceDate || invoice.invoiceDate || invoice.CreatedAt || '',
        amount: invoice.Total || invoice.total || invoice.Amount || invoice.amount || 0,
        invoiceNumber: invoice.InvoiceNumber || invoice.invoiceNumber || invoice.InvoiceID || invoice.id,
        items: invoice.Items || invoice.items || [],
        source: invoice.Source || invoice.source || 'Shop',
        status: invoice.Status || invoice.status,
        CreatedAt: invoice.CreatedAt || invoice.created_at || '',
        ...invoice,
      });
    });

    // Add shop receipts and warehouse receipts/payments
    (customerData.receipts || []).forEach((receipt: any) => {
      // Check if it's a payment (has PaymentID) or receipt (has ReceiptID)
      const receiptId = receipt.ReceiptID || receipt.PaymentID || receipt.id || receipt.receiptID;
      if (!receiptId || receiptId === '') return;
      
      const isPayment = receipt.PaymentID || receipt.Type === 'shop_payment' || receipt.Type === 'warehouse_payment';
      
      items.push({
        type: isPayment ? 'payment' : 'receipt',
        id: String(receiptId),
        date: receipt.Date || receipt.date || receipt.ReceiptDate || receipt.PaymentDate || receipt.receiptDate || receipt.CreatedAt || '',
        amount: receipt.Amount || receipt.amount || receipt.Total || receipt.total || 0,
        receiptNumber: isPayment ? undefined : (receipt.ReceiptNumber || receipt.receiptNumber || receipt.ReceiptID || receipt.id),
        paymentNumber: isPayment ? (receipt.PaymentNumber || receipt.PaymentID || receipt.pay_id || receipt.id) : undefined,
        source: receipt.Source || receipt.source || 'Shop',
        cashAmount: receipt.CashAmount || receipt.cashAmount,
        chequeAmount: receipt.ChequeAmount || receipt.chequeAmount,
        CreatedAt: receipt.CreatedAt || receipt.created_at || '',
        ...receipt,
      });
    });

    // Filter items from 2026-01-01 onwards
    const cutoffDate = new Date('2026-01-01T00:00:00').getTime();
    const filteredItems = items.filter((item) => {
      const getTimestamp = (item: TimelineItem): number => {
        const createdAt = item.CreatedAt || item.created_at || '';
        if (createdAt) {
          const time = new Date(createdAt).getTime();
          if (!isNaN(time)) return time;
        }
        const date = item.date || '';
        if (date) {
          const time = new Date(date).getTime();
          if (!isNaN(time)) return time;
        }
        return 0;
      };
      
      const itemTime = getTimestamp(item);
      return itemTime >= cutoffDate;
    });

    // Sort by date and time (newest first)
    filteredItems.sort((a, b) => {
      const getTimestamp = (item: TimelineItem): number => {
        const createdAt = item.CreatedAt || item.created_at || '';
        if (createdAt) {
          const time = new Date(createdAt).getTime();
          if (!isNaN(time)) return time;
        }
        const date = item.date || '';
        if (date) {
          const time = new Date(date).getTime();
          if (!isNaN(time)) return time;
        }
        return 0;
      };
      
      const timeA = getTimestamp(a);
      const timeB = getTimestamp(b);
      
      return timeB - timeA;
    });

    return filteredItems;
  }, [customerData]);

  // Map maintenance records to timeline items
  const maintenanceItems = useMemo(() => {
    return maintenanceRecords.map((maint: any) => {
      const maintId = maint.MaintNo || maint.maint_no || maint.id || '';
      return {
        type: 'maintenance' as const,
        id: String(maintId),
        date: maint.DateOfReceive || maint.date_of_receive || maint.CreatedAt || maint.created_at || '',
        status: maint.Status || maint.status || '',
        itemName: maint.ItemName || maint.item_name || '',
        problem: maint.Problem || maint.problem || '',
        company: maint.Company || maint.company || '',
        location: maint.Location || maint.location || '',
        costAmount: maint.CostAmount || maint.cost_amount || null,
        costReason: maint.CostReason || maint.cost_reason || null,
        isPaid: maint.IsPaid || maint.is_paid || false,
        CreatedAt: maint.CreatedAt || maint.created_at || '',
        ...maint,
      };
    }).sort((a, b) => {
      const getTimestamp = (item: any): number => {
        const createdAt = item.CreatedAt || item.created_at || '';
        if (createdAt) {
          const time = new Date(createdAt).getTime();
          if (!isNaN(time)) return time;
        }
        const date = item.date || '';
        if (date) {
          const time = new Date(date).getTime();
          if (!isNaN(time)) return time;
        }
        return 0;
      };
      
      return getTimestamp(b) - getTimestamp(a);
    });
  }, [maintenanceRecords]);

  if (!user) {
    return null;
  }

  const balance = user.balance || 0;
  const balanceColor = balance > 0 ? 'bg-red-50 border-red-200' : balance < 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200';
  const balanceTextColor = balance > 0 ? 'text-red-600' : balance < 0 ? 'text-green-600' : 'text-gray-600';

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={24} className="text-gray-700" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">الملف الشخصي</h1>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut size={20} />
              <span className="hidden sm:inline">تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Customer Info Card */}
          <div className="lg:col-span-1 space-y-4">
        {/* Customer Info Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {user.name || user.Name || user.email || 'N/A'}
              </h2>
                {user.email && (
                  <p className="text-gray-600 text-sm">{user.email}</p>
                )}
                {user.phone && (
                  <p className="text-gray-600 text-sm mt-1">{user.phone}</p>
                )}
              </div>
            </div>

            {/* Balance Card */}
            <div className={`${balanceColor} rounded-lg border-2 p-6`}>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600 mb-2">الرصيد الحالي</p>
                <p className={`text-3xl font-bold ${balanceTextColor} mb-1`}>
                  {formatBalance(balance)}
                </p>
                <p className="text-xs text-gray-500">
                  {balance > 0 ? 'مبلغ مستحق علينا' : balance < 0 ? 'رصيد دائن' : 'لا يوجد رصيد'}
                </p>
            </div>
          </div>
        </div>

          {/* Right Area - Activity Timeline */}
          <div className="lg:col-span-2 space-y-6">
            {/* Financial Transactions (Invoices, Receipts & Payments) */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">الفواتير وسندات القبض والصرف</h2>
                {loading && (
                  <Loader2 size={18} className="animate-spin text-gray-400" />
                )}
          </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-gray-400" />
                  <span className="text-gray-600 text-lg mr-3">جاري تحميل الفواتير والسندات...</span>
              </div>
              ) : financialItems.length === 0 ? (
                  <div className="text-center py-12">
                  <FileText size={48} className="text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg">لا توجد فواتير أو سندات</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                  {financialItems.map((item, index) => {
                    const Icon = getTimelineIcon(item.type);
                    let colors = getTimelineColor(item.type);
                    if (item.source === 'Warehouse') {
                      if (item.type === 'invoice') {
                        colors = {
                          bg: 'bg-blue-100',
                          text: 'text-blue-800',
                          border: 'border-blue-500',
                          iconBg: 'bg-blue-200',
                        };
                      } else if (item.type === 'receipt') {
                        colors = {
                          bg: 'bg-green-100',
                          text: 'text-green-800',
                          border: 'border-green-500',
                          iconBg: 'bg-green-200',
                        };
                      } else if (item.type === 'payment') {
                        colors = {
                          bg: 'bg-red-100',
                          text: 'text-red-800',
                          border: 'border-red-500',
                          iconBg: 'bg-red-200',
                        };
                      }
                    }
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
                                  {item.type === 'receipt' && item.source === 'Shop' && `سند قبض المحل #${item.receiptNumber || item.id}`}
                                  {item.type === 'receipt' && item.source === 'Warehouse' && `سند قبض المستودع #${item.receiptNumber || item.id}`}
                                  {item.type === 'payment' && item.source === 'Shop' && `سند صرف المحل #${item.paymentNumber || item.id}`}
                                  {item.type === 'payment' && item.source === 'Warehouse' && `سند صرف المستودع #${item.paymentNumber || item.id}`}
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
                                    } else if (item.type === 'receipt' && item.source === 'Shop') {
                                      window.open(`/admin/receipts/print/${item.id}`, `print-receipt-${item.id}`, 'noopener,noreferrer');
                                    } else if (item.type === 'receipt' && item.source === 'Warehouse') {
                                      window.open(`/admin/warehouse-finance/receipts/print/${item.id}`, `print-warehouse-receipt-${item.id}`, 'noopener,noreferrer');
                                    } else if (item.type === 'payment' && item.source === 'Shop') {
                                      window.open(`/admin/payments/print/${item.id}`, `print-payment-${item.id}`, 'noopener,noreferrer');
                                    } else if (item.type === 'payment' && item.source === 'Warehouse') {
                                      window.open(`/admin/warehouse-finance/payments/print/${item.id}`, `print-warehouse-payment-${item.id}`, 'noopener,noreferrer');
                                    }
                                  }}
                                  className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                  title="طباعة"
                                >
                                  <Printer size={16} />
                                </button>
                              </div>
                            </div>

                            {/* Amount for invoices, receipts and payments */}
                            {item.amount && (
                              <p className={`text-sm font-medium mb-2 ${
                                item.type === 'payment' ? 'text-red-700' : 'text-gray-700'
                              }`}>
                                {item.type === 'payment' ? 'المبلغ المدفوع: ' : 'المبلغ: '}
                                {formatBalance(item.amount)}
                              </p>
                            )}

                            {/* Cash/Cheque breakdown for receipts and payments */}
                            {(item.type === 'receipt' || item.type === 'payment') && (item.cashAmount || item.chequeAmount) && (
                              <div className="text-xs text-gray-600 mb-2">
                                {item.cashAmount > 0 && <span>نقد: {formatBalance(item.cashAmount)}</span>}
                                {item.cashAmount > 0 && item.chequeAmount > 0 && <span> • </span>}
                                {item.chequeAmount > 0 && <span>شيك: {formatBalance(item.chequeAmount)}</span>}
                              </div>
                            )}

                            {/* Notes */}
                            {item.notes && (
                              <p className="text-xs text-gray-600 mb-2">
                                {item.notes}
                              </p>
                            )}

                            {/* Invoice Items (expandable) */}
                            {item.type === 'invoice' && item.items && item.items.length > 0 && (
                              <details className="mt-2">
                                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                  عرض {item.items.length} منتج
                                </summary>
                                <div className="mt-2 pl-4 border-l-2 border-gray-200 space-y-2">
                                  {item.items
                                    .filter((invoiceItem: any) => invoiceItem)
                                    .map((invoiceItem: any, idx: number) => {
                                      const itemKey = invoiceItem.ID || invoiceItem.id || invoiceItem.Name || invoiceItem.name || invoiceItem.product_id || `item-${idx}`;
                                      const itemName = invoiceItem.Name || invoiceItem.name || invoiceItem.product_name || 'منتج';
                                      const itemPrice = invoiceItem.Price ?? invoiceItem.price ?? invoiceItem.unit_price ?? 0;
                                      const itemQty = invoiceItem.Quantity ?? invoiceItem.quantity ?? 1;
                                      const itemTotal = itemPrice * itemQty;
                                      
                                      // Get product shamel number
                                      const productId = invoiceItem.ProductID || invoiceItem.product_id || invoiceItem.ID || invoiceItem.id;
                                      const product = products.find(p => (p.ProductID || p.id || p.product_id) === productId);
                                      const shamelNo = product?.shamel_no || product?.['Shamel No'] || product?.ShamelNo || product?.ShamelNO || '';
                                      
                                      return (
                                        <div key={`${uniqueKey}-item-${itemKey}-${idx}`} className="text-sm text-gray-700">
                                          <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                              <div className="font-medium text-gray-900">{itemName}</div>
                                              <div className="text-xs text-gray-500 mt-0.5">
                                                الكمية: {itemQty} × {formatBalance(itemPrice)} = {formatBalance(itemTotal)}
                                              </div>
                                            </div>
                                            {shamelNo && shamelNo.trim() !== '' && (
                                              <button
                                                onClick={() => handleTrackItem(shamelNo, itemName)}
                                                className="mr-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors flex items-center gap-1"
                                                title="تتبع القطعة"
                                              >
                                                <Search size={12} />
                                                تتبع
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
                  </div>

            {/* Maintenance Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">سجلات الصيانة</h2>
                {loadingMaintenance && (
                  <Loader2 size={18} className="animate-spin text-gray-400" />
                )}
              </div>

              {loadingMaintenance ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-gray-400" />
                  <span className="text-gray-600 text-lg mr-3">جاري تحميل سجلات الصيانة...</span>
                </div>
              ) : maintenanceItems.length === 0 ? (
                  <div className="text-center py-12">
                  <Wrench size={48} className="text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg">لا توجد سجلات صيانة</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                  {maintenanceItems.map((item, index) => {
                    const Icon = Wrench;
                    
                    // Determine colors based on status and date
                    let colors = {
                      bg: 'bg-orange-50',
                      text: 'text-orange-800',
                      border: 'border-orange-500',
                      iconBg: 'bg-orange-100',
                    };

                    // Check if delivered (سلمت للزبون)
                    const isDelivered = item.status && (
                      item.status.includes('سلمت') || 
                      item.status.includes('تم التسليم') ||
                      item.status.toLowerCase().includes('delivered')
                    );

                    // Check if more than 14 days have passed since received
                    const receivedDate = item.date || item.CreatedAt || '';
                    let isOverdue = false;
                    if (receivedDate && !isDelivered) {
                      try {
                        const received = new Date(receivedDate).getTime();
                        const now = new Date().getTime();
                        const daysDiff = (now - received) / (1000 * 60 * 60 * 24);
                        isOverdue = daysDiff > 14;
                      } catch (e) {
                        // Invalid date, skip
                      }
                    }

                    // Set colors based on status
                    if (isDelivered) {
                      // Green for delivered items
                      colors = {
                        bg: 'bg-green-50',
                        text: 'text-green-800',
                        border: 'border-green-500',
                        iconBg: 'bg-green-100',
                      };
                    } else if (isOverdue) {
                      // Light red for overdue items (more than 14 days)
                      colors = {
                        bg: 'bg-red-50',
                        text: 'text-red-800',
                        border: 'border-red-400',
                        iconBg: 'bg-red-100',
                      };
                    }
                    
                    const uniqueKey = `maintenance-${item.id || `fallback-${index}`}`;

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
                                  صيانة #{item.id}
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
                              </div>
                            </div>

                            {/* Item Name */}
                            {item.itemName && (
                              <p className="text-sm font-medium text-gray-700 mb-1">
                                القطعة: {item.itemName}
                              </p>
                            )}

                            {/* Problem */}
                            {item.problem && (
                              <p className="text-sm text-gray-600 mb-2">
                                المشكلة: {item.problem}
                              </p>
                            )}

                            {/* Company */}
                            {item.company && (
                              <p className="text-xs text-gray-500 mb-2">
                                الشركة: {item.company}
                              </p>
                            )}

                            {/* Cost Amount */}
                            {item.costAmount !== null && item.costAmount !== undefined && item.costAmount > 0 && (
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-semibold text-orange-700">
                                  تكلفة الصيانة: {formatBalance(item.costAmount)}
                                </span>
                                {item.isPaid && (
                                  <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                                    مدفوع
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Cost Reason */}
                            {item.costReason && (
                              <p className="text-xs text-gray-600 mb-2">
                                سبب التكلفة: {item.costReason}
                              </p>
                            )}

                            {/* History Toggle Button */}
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <button
                                onClick={() => toggleMaintenanceHistory(item.id)}
                                className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                              >
                                {expandedMaintenanceRows.has(item.id) ? (
                                  <>
                                    <ChevronUp size={14} />
                                    إخفاء السجل التاريخي
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown size={14} />
                                    عرض السجل التاريخي
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Maintenance History */}
                            {expandedMaintenanceRows.has(item.id) && (
                              <div className="mt-3 pt-3 border-t border-gray-300">
                                {loadingHistoryMap.has(item.id) ? (
                                  <div className="flex items-center justify-center py-4">
                                    <Loader2 size={16} className="animate-spin text-gray-400" />
                                    <span className="text-xs text-gray-600 mr-2">جاري التحميل...</span>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    {(() => {
                                      const history = maintenanceHistoryMap.get(item.id) || [];
                                      if (history.length === 0) {
                                        return (
                                          <div className="text-center py-4 text-xs text-gray-500">
                                            لا يوجد سجل تاريخي
                                          </div>
                                        );
                                      }
                                      return history.map((entry, idx) => (
                                        <div key={entry.history_id || idx} className="flex gap-3 text-xs">
                                          <div className="flex-shrink-0">
                                            <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5" />
                                            {idx < history.length - 1 && (
                                              <div className="w-0.5 h-full bg-gray-200 mt-1 mx-auto" style={{ minHeight: '24px' }} />
                                            )}
                                          </div>
                                          <div className="flex-1 pb-3">
                                            <div className="flex items-start justify-between mb-1">
                                              <div>
                                                <div className="font-medium text-gray-900">
                                                  {entry.status_from && entry.status_to ? (
                                                    <>تغيير الحالة: {entry.status_from} → {entry.status_to}</>
                                                  ) : entry.status_to ? (
                                                    <>حالة جديدة: {entry.status_to}</>
                                                  ) : (
                                                    'تحديث'
                                                  )}
                                                </div>
                                              </div>
                                              <div className="text-left">
                                                <div className="text-xs font-medium text-gray-900">
                                                  {formatHistoryDate(entry.created_at)}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                  {formatHistoryTime(entry.created_at)}
                                                </div>
                                              </div>
                                            </div>
                                            {entry.notes && (
                                              <div className="text-xs text-gray-600 mt-1">
                                                {entry.notes}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ));
                                    })()}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                )}
              </div>
          </div>
        </div>
      </main>

      {/* Item Tracking Modal */}
      {trackingModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" dir="rtl">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  تتبع القطعة: {trackingModal.productName}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  رقم الشامل: {trackingModal.shamelNo}
                </p>
              </div>
              <button
                onClick={closeTrackingModal}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {trackingModal.loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-gray-400" />
                  <span className="text-gray-600 text-lg mr-3">جاري تحميل تتبع القطعة...</span>
                </div>
              ) : trackingModal.trackingHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Search size={48} className="text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg">لا يوجد تتبع لهذه القطعة</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {trackingModal.trackingHistory.map((track, index) => (
                    <div
                      key={`track-${track.invoiceId}-${index}`}
                      className="border-l-4 border-blue-500 pl-4 py-3 rounded-r-lg bg-blue-50 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-gray-900">
                              {track.source === 'Shop' ? 'فاتورة المحل' : 'فاتورة المخزن'} #{track.invoiceId}
                            </h4>
                          </div>
                          <div className="text-sm text-gray-600 mb-1">
                            التاريخ: {formatDate(track.date || track.createdAt)}
                          </div>
                          <div className="text-sm text-gray-600 mb-1">
                            الكمية: {track.quantity} × {formatBalance(track.unitPrice)} = {formatBalance(track.quantity * track.unitPrice)}
                          </div>
                          {track.notes && (
                            <div className="text-xs text-gray-500 mt-1">
                              ملاحظات: {track.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
