'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  getOnlineOrdersFromSupabase,
  getOnlineOrderDetailsFromSupabase,
  updateOnlineOrderStatus,
} from '@/lib/api';
import {
  Loader2,
  ShoppingBag,
  Search,
  Eye,
  X,
  Printer,
  Edit,
  ChevronDown,
} from 'lucide-react';

interface OnlineOrder {
  OrderID: string;
  CustomerName: string;
  CustomerPhone: string;
  CustomerEmail: string;
  Status: string;
  Notes?: string;
  TotalAmount: number;
  CreatedAt: string;
  UpdatedAt: string;
}

interface OnlineOrderDetail {
  DetailID: string;
  OrderID: string;
  ProductID: string;
  ProductName: string;
  Quantity: number;
  UnitPrice: number;
  TotalPrice: number;
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all'); // 'all', 'Pending', 'Processing', 'Completed', 'Cancelled'
  const [selectedOrder, setSelectedOrder] = useState<OnlineOrder | null>(null);
  const [orderDetails, setOrderDetails] = useState<OnlineOrderDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [printOverlayOrderId, setPrintOverlayOrderId] = useState<string | null>(null);
  const printIframeRef = useRef<HTMLIFrameElement>(null);
  const isMobilePrint = () => typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  useLayoutEffect(() => {
    document.title = 'الطلبيات - Orders';
  }, []);

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (!printOverlayOrderId) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'print-ready' && printIframeRef.current?.contentWindow) {
        const prevTitle = document.title;
        if (e.data?.title) document.title = e.data.title;
        try {
          printIframeRef.current.contentWindow.print();
        } catch (_) {}
        setTimeout(() => { document.title = prevTitle; }, 500);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [printOverlayOrderId]);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOnlineOrdersFromSupabase(100);
      setOrders(data);
    } catch (err: any) {
      console.error('[OrdersPage] Failed to load orders:', err);
      setError(err?.message || 'فشل تحميل الطلبيات');
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrder = async (order: OnlineOrder) => {
    setSelectedOrder(order);
    setLoadingDetails(true);
    try {
      const details = await getOnlineOrderDetailsFromSupabase(order.OrderID);
      setOrderDetails(details);
    } catch (err: any) {
      console.error('[OrdersPage] Failed to load order details:', err);
      alert('فشل تحميل تفاصيل الطلبية: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setLoadingDetails(false);
    }
  };

  const handlePrintOrder = (order: OnlineOrder) => {
    if (isMobilePrint()) {
      window.open(`/admin/orders/print/${order.OrderID}`, `print-order-${order.OrderID}`, 'noopener,noreferrer');
      return;
    }
    setPrintOverlayOrderId(order.OrderID);
  };

  const handleEditOrder = (order: OnlineOrder) => {
    router.push(`/admin/orders/${order.OrderID}`);
  };

  const handleStatusChange = async (orderId: string, newStatus: 'Pending' | 'Processing' | 'Completed' | 'Cancelled') => {
    setUpdatingStatus(orderId);
    try {
      await updateOnlineOrderStatus(orderId, newStatus);
      // Reload orders to reflect the change
      await loadOrders();
    } catch (err: any) {
      console.error('[OrdersPage] Failed to update status:', err);
      alert('فشل تحديث الحالة: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setUpdatingStatus(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      // Use Asia/Jerusalem timezone for Palestine (UTC+2 or UTC+3)
      // Format as dd/mm/yyyy
      const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); // YYYY-MM-DD
      const [year, month, day] = dateStr.split('-');
      // Return as dd/mm/yyyy
      return `${day}/${month}/${year}`;
    } catch {
      return '—';
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      // Use Asia/Jerusalem timezone for Palestine (UTC+2 or UTC+3)
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

  const formatCurrency = (amount: number | undefined | null) => {
    if (!amount || amount === 0) return '₪0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      Pending: { label: 'قيد الانتظار', className: 'bg-yellow-100 text-yellow-800' },
      Processing: { label: 'قيد المعالجة', className: 'bg-blue-100 text-blue-800' },
      Completed: { label: 'مكتملة', className: 'bg-green-100 text-green-800' },
      Cancelled: { label: 'ملغاة', className: 'bg-red-100 text-red-800' },
    };
    const statusInfo = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium font-cairo ${statusInfo.className}`}>
        {statusInfo.label}
      </span>
    );
  };

  // Calculate statistics
  const orderStats = useMemo(() => {
    return {
      all: orders.length,
      pending: orders.filter(o => o.Status === 'Pending').length,
      processing: orders.filter(o => o.Status === 'Processing').length,
      completed: orders.filter(o => o.Status === 'Completed').length,
      cancelled: orders.filter(o => o.Status === 'Cancelled').length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((order) => order.Status === statusFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((order) => {
        return (
          String(order.OrderID || '').toLowerCase().includes(query) ||
          String(order.CustomerName || '').toLowerCase().includes(query) ||
          String(order.CustomerPhone || '').toLowerCase().includes(query)
        );
      });
    }

    return filtered;
  }, [orders, searchQuery, statusFilter]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">جاري تحميل الطلبيات...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6 font-cairo" dir="rtl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 font-cairo">طلبيات اون لاين</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base font-cairo">إدارة طلبيات العملاء الأون لاين</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm sm:text-base font-cairo">
            {error}
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4">
          <button
            onClick={() => setStatusFilter('all')}
            className={`p-3 sm:p-4 rounded-lg border-2 transition-all font-cairo ${
              statusFilter === 'all'
                ? 'border-gray-900 bg-gray-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="text-xl sm:text-2xl font-bold text-gray-900 font-cairo">{orderStats.all}</div>
            <div className="text-xs sm:text-sm text-gray-600 mt-1 font-cairo">الكل</div>
          </button>
          <button
            onClick={() => setStatusFilter('Pending')}
            className={`p-3 sm:p-4 rounded-lg border-2 transition-all font-cairo ${
              statusFilter === 'Pending'
                ? 'border-yellow-500 bg-yellow-50'
                : 'border-gray-200 bg-white hover:border-yellow-200'
            }`}
          >
            <div className="text-xl sm:text-2xl font-bold text-yellow-700 font-cairo">{orderStats.pending}</div>
            <div className="text-xs sm:text-sm text-gray-600 mt-1 font-cairo">قيد الانتظار</div>
          </button>
          <button
            onClick={() => setStatusFilter('Processing')}
            className={`p-3 sm:p-4 rounded-lg border-2 transition-all font-cairo ${
              statusFilter === 'Processing'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-blue-200'
            }`}
          >
            <div className="text-xl sm:text-2xl font-bold text-blue-700 font-cairo">{orderStats.processing}</div>
            <div className="text-xs sm:text-sm text-gray-600 mt-1 font-cairo">قيد المعالجة</div>
          </button>
          <button
            onClick={() => setStatusFilter('Completed')}
            className={`p-3 sm:p-4 rounded-lg border-2 transition-all font-cairo ${
              statusFilter === 'Completed'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-white hover:border-green-200'
            }`}
          >
            <div className="text-xl sm:text-2xl font-bold text-green-700 font-cairo">{orderStats.completed}</div>
            <div className="text-xs sm:text-sm text-gray-600 mt-1 font-cairo">مكتملة</div>
          </button>
          <button
            onClick={() => setStatusFilter('Cancelled')}
            className={`p-3 sm:p-4 rounded-lg border-2 transition-all font-cairo ${
              statusFilter === 'Cancelled'
                ? 'border-red-500 bg-red-50'
                : 'border-gray-200 bg-white hover:border-red-200'
            }`}
          >
            <div className="text-xl sm:text-2xl font-bold text-red-700 font-cairo">{orderStats.cancelled}</div>
            <div className="text-xs sm:text-sm text-gray-600 mt-1 font-cairo">ملغاة</div>
          </button>
        </div>

        {/* Search and Status Filter */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="ابحث برقم الطلبية، اسم الزبون، أو رقم الهاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-500 font-cairo text-sm sm:text-base"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title="مسح البحث"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="w-full sm:w-auto sm:min-w-[180px]">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-gray-900 font-cairo text-sm sm:text-base"
              >
                <option value="all">جميع الحالات</option>
                <option value="Pending">قيد الانتظار</option>
                <option value="Processing">قيد المعالجة</option>
                <option value="Completed">مكتملة</option>
                <option value="Cancelled">ملغاة</option>
              </select>
            </div>
          </div>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 sm:p-12 text-center">
            <ShoppingBag size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-base sm:text-lg font-cairo">لا توجد طلبيات</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                        رقم الطلبية
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                        اسم الزبون
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                        رقم الهاتف
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                        الحالة
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                        المبلغ الإجمالي
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                        التاريخ والوقت
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                        إجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredOrders.map((order) => (
                      <tr key={order.OrderID} className="hover:bg-gray-200 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 font-cairo">
                          {order.OrderID}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {order.CustomerEmail ? (
                            <button
                              onClick={async (e) => {
                                // Try to find customer by email
                                try {
                                  const { getCustomerFromSupabase } = await import('@/lib/api');
                                  const customer = await getCustomerFromSupabase(order.CustomerEmail);
                                  if (customer && customer.customer_id) {
                                    if (e.ctrlKey || e.metaKey || e.shiftKey) {
                                      window.open(`/admin/customers/${customer.customer_id}`, '_blank', 'noopener,noreferrer');
                                      return;
                                    }
                                    router.push(`/admin/customers/${customer.customer_id}`);
                                  } else {
                                    // Customer not found, show name only
                                    return;
                                  }
                                } catch (err) {
                                  console.error('Failed to find customer:', err);
                                }
                              }}
                              onMouseDown={async (e) => {
                                if (e.button === 1) {
                                  e.preventDefault();
                                  try {
                                    const { getCustomerFromSupabase } = await import('@/lib/api');
                                    const customer = await getCustomerFromSupabase(order.CustomerEmail);
                                    if (customer && customer.customer_id) {
                                      window.open(`/admin/customers/${customer.customer_id}`, '_blank', 'noopener,noreferrer');
                                    }
                                  } catch (err) {
                                    console.error('Failed to find customer:', err);
                                  }
                                }
                              }}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-cairo"
                              title="فتح بروفايل الزبون (Ctrl+Click أو Shift+Click لفتح في تبويب جديد)"
                            >
                              {order.CustomerName}
                            </button>
                          ) : (
                            <span className="font-cairo">{order.CustomerName}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-cairo">
                          {order.CustomerPhone}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(order.Status)}
                            <div className="relative">
                              <select
                                value={order.Status}
                                onChange={(e) => {
                                  const newStatus = e.target.value as 'Pending' | 'Processing' | 'Completed' | 'Cancelled';
                                  handleStatusChange(order.OrderID, newStatus);
                                }}
                                disabled={updatingStatus === order.OrderID}
                                className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed max-h-32 overflow-y-auto font-cairo"
                                onClick={(e) => e.stopPropagation()}
                                style={{ maxHeight: '128px' }}
                              >
                                <option value="Pending">قيد الانتظار</option>
                                <option value="Processing">قيد المعالجة</option>
                                <option value="Completed">مكتملة</option>
                                <option value="Cancelled">ملغاة</option>
                              </select>
                              {updatingStatus === order.OrderID && (
                                <Loader2 size={12} className="absolute left-1 top-1/2 transform -translate-y-1/2 animate-spin text-gray-400" />
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 font-cairo">
                          {formatCurrency(order.TotalAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-cairo">
                          <div>
                            <div>{formatDate(order.CreatedAt)}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{formatTime(order.CreatedAt)}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditOrder(order)}
                              className="text-purple-600 hover:text-purple-900 flex items-center gap-1 font-cairo"
                            >
                              <Edit size={16} />
                              تعديل
                            </button>
                            <button
                              onClick={() => handlePrintOrder(order)}
                              className="text-blue-600 hover:text-blue-900 flex items-center gap-1 font-cairo"
                            >
                              <Printer size={16} />
                              طباعة
                            </button>
                            <button
                              onClick={() => handleViewOrder(order)}
                              className="text-green-600 hover:text-green-900 flex items-center gap-1 font-cairo"
                            >
                              <Eye size={16} />
                              عرض
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {filteredOrders.map((order) => (
                <div key={order.OrderID} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-3 pb-3 border-b border-gray-200">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-base font-bold text-gray-900 font-cairo">#{order.OrderID}</h3>
                        {getStatusBadge(order.Status)}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-gray-900 font-cairo mb-1">
                        {formatCurrency(order.TotalAmount)}
                      </div>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="mb-3 space-y-2">
                    <div>
                      <div className="text-xs text-gray-500 font-cairo mb-1">اسم الزبون</div>
                      <div className="text-sm text-gray-900 font-cairo">
                        {order.CustomerEmail ? (
                          <button
                            onClick={async (e) => {
                              try {
                                const { getCustomerFromSupabase } = await import('@/lib/api');
                                const customer = await getCustomerFromSupabase(order.CustomerEmail);
                                if (customer && customer.customer_id) {
                                  if (e.ctrlKey || e.metaKey || e.shiftKey) {
                                    window.open(`/admin/customers/${customer.customer_id}`, '_blank', 'noopener,noreferrer');
                                    return;
                                  }
                                  router.push(`/admin/customers/${customer.customer_id}`);
                                }
                              } catch (err) {
                                console.error('Failed to find customer:', err);
                              }
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-cairo"
                          >
                            {order.CustomerName}
                          </button>
                        ) : (
                          order.CustomerName
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-cairo mb-1">رقم الهاتف</div>
                      <div className="text-sm text-gray-900 font-cairo">{order.CustomerPhone}</div>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 font-cairo mb-1">التاريخ والوقت</div>
                    <div className="text-sm text-gray-900 font-cairo">
                      {formatDate(order.CreatedAt)}
                      <div className="text-xs text-gray-500 mt-0.5">{formatTime(order.CreatedAt)}</div>
                    </div>
                  </div>

                  {/* Status Dropdown */}
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 font-cairo mb-1">تغيير الحالة</div>
                    <div className="relative">
                      <select
                        value={order.Status}
                        onChange={(e) => {
                          const newStatus = e.target.value as 'Pending' | 'Processing' | 'Completed' | 'Cancelled';
                          handleStatusChange(order.OrderID, newStatus);
                        }}
                        disabled={updatingStatus === order.OrderID}
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed font-cairo"
                      >
                        <option value="Pending">قيد الانتظار</option>
                        <option value="Processing">قيد المعالجة</option>
                        <option value="Completed">مكتملة</option>
                        <option value="Cancelled">ملغاة</option>
                      </select>
                      {updatingStatus === order.OrderID && (
                        <Loader2 size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 animate-spin text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => handleViewOrder(order)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-cairo"
                    >
                      <Eye size={16} />
                      <span>عرض</span>
                    </button>
                    <button
                      onClick={() => handlePrintOrder(order)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-cairo"
                    >
                      <Printer size={16} />
                      <span>طباعة</span>
                    </button>
                    <button
                      onClick={() => handleEditOrder(order)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-cairo"
                    >
                      <Edit size={16} />
                      <span>تعديل</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Summary */}
        {filteredOrders.length > 0 && (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600 font-cairo text-center sm:text-right">
              إجمالي الطلبيات: <span className="font-semibold">{filteredOrders.length}</span>
            </p>
          </div>
        )}

        {/* Order Details Modal */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-2 sm:p-4" dir="rtl">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-shrink-0">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 font-cairo">تفاصيل الطلبية</h3>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handlePrintOrder(selectedOrder)}
                    className="text-blue-600 hover:text-blue-900 flex items-center gap-1 px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors font-cairo"
                  >
                    <Printer size={16} />
                    طباعة
                  </button>
                  <button
                    onClick={() => {
                      setSelectedOrder(null);
                      setOrderDetails([]);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X size={20} className="text-gray-600" />
                  </button>
                </div>
              </div>

              <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
                {/* Order Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500 mb-1 font-cairo">رقم الطلبية</p>
                    <p className="font-semibold text-gray-900 font-cairo">{selectedOrder.OrderID}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500 mb-1 font-cairo">الحالة</p>
                    <div>{getStatusBadge(selectedOrder.Status)}</div>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500 mb-1 font-cairo">اسم الزبون</p>
                    {selectedOrder.CustomerEmail ? (
                      <button
                        onClick={async (e) => {
                          try {
                            const { getCustomerFromSupabase } = await import('@/lib/api');
                            const customer = await getCustomerFromSupabase(selectedOrder.CustomerEmail);
                            if (customer && customer.customer_id) {
                              if (e.ctrlKey || e.metaKey || e.shiftKey) {
                                window.open(`/admin/customers/${customer.customer_id}`, '_blank', 'noopener,noreferrer');
                                return;
                              }
                              router.push(`/admin/customers/${customer.customer_id}`);
                            }
                          } catch (err) {
                            console.error('Failed to find customer:', err);
                          }
                        }}
                        onMouseDown={async (e) => {
                          if (e.button === 1) {
                            e.preventDefault();
                            try {
                              const { getCustomerFromSupabase } = await import('@/lib/api');
                              const customer = await getCustomerFromSupabase(selectedOrder.CustomerEmail);
                              if (customer && customer.customer_id) {
                                window.open(`/admin/customers/${customer.customer_id}`, '_blank', 'noopener,noreferrer');
                              }
                            } catch (err) {
                              console.error('Failed to find customer:', err);
                            }
                          }
                        }}
                        className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        title="فتح بروفايل الزبون (Ctrl+Click أو Shift+Click لفتح في تبويب جديد)"
                      >
                        {selectedOrder.CustomerName}
                      </button>
                    ) : (
                      <p className="font-semibold text-gray-900">{selectedOrder.CustomerName}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500 mb-1 font-cairo">رقم الهاتف</p>
                    <p className="font-semibold text-gray-900 font-cairo">{selectedOrder.CustomerPhone}</p>
                  </div>
                  {selectedOrder.CustomerEmail && (
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500 mb-1 font-cairo">البريد الإلكتروني</p>
                      <p className="font-semibold text-gray-900 font-cairo break-all">{selectedOrder.CustomerEmail}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500 mb-1 font-cairo">التاريخ والوقت</p>
                    <p className="font-semibold text-gray-900 font-cairo">{formatDate(selectedOrder.CreatedAt)}</p>
                  </div>
                </div>

                {/* Order Items */}
                <div>
                  <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4 font-cairo">الأصناف</h4>
                  {loadingDetails ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={24} className="animate-spin text-gray-400" />
                    </div>
                  ) : orderDetails.length === 0 ? (
                    <p className="text-gray-500 text-center py-8 font-cairo">لا توجد أصناف</p>
                  ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm min-w-[500px]">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase font-cairo">
                              اسم الصنف
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase font-cairo">
                              الكمية
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase font-cairo">
                              سعر الوحدة
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase font-cairo">
                              الإجمالي
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {orderDetails.map((detail) => (
                            <tr key={detail.DetailID}>
                              <td className="px-4 py-3 text-sm text-gray-900 font-cairo">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    const productId = detail.ProductID || detail.product_id;
                                    if (!productId) return;
                                    if (e.metaKey || e.ctrlKey) {
                                      window.open(`/admin/products/${productId}`, '_blank');
                                    } else {
                                      router.push(`/admin/products/${productId}`);
                                    }
                                  }}
                                  className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                                  title="عرض بروفايل المنتج (اضغط Command/Ctrl لفتح في نافذة جديدة)"
                                >
                                  {detail.ProductName || '—'}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900 font-cairo">{detail.Quantity}</td>
                              <td className="px-4 py-3 text-sm text-right text-gray-900 font-cairo">
                                {formatCurrency(detail.UnitPrice)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 font-cairo">
                                {formatCurrency(detail.TotalPrice)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t border-gray-200">
                          <tr>
                            <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right font-cairo">
                              الإجمالي:
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right font-cairo">
                              {formatCurrency(selectedOrder.TotalAmount)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {selectedOrder.Notes && (
                  <div>
                    <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-2 font-cairo">ملاحظات</h4>
                    <p className="text-sm sm:text-base text-gray-700 bg-gray-50 p-3 sm:p-4 rounded-lg whitespace-pre-wrap font-cairo">
                      {selectedOrder.Notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {printOverlayOrderId && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
            dir="rtl"
            onClick={() => setPrintOverlayOrderId(null)}
          >
            <div
              className="relative bg-white rounded-lg shadow-xl flex flex-col max-w-full max-h-full overflow-hidden"
              style={{ minWidth: '120mm', maxHeight: '95vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                <span className="text-sm font-cairo text-gray-700">معاينة الطباعة — طلبية أون لاين</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => printIframeRef.current?.contentWindow?.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-cairo bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <Printer size={16} />
                    طباعة مرة أخرى
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintOverlayOrderId(null)}
                    className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors"
                    aria-label="إغلاق"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-white min-h-0">
                <iframe
                  ref={printIframeRef}
                  src={`/admin/orders/print/${printOverlayOrderId}?embed=1`}
                  title="طباعة الطلبية"
                  className="w-full border-0 bg-white"
                  style={{ minHeight: '70vh', height: '70vh' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
