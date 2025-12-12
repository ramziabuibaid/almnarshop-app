'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { useRouter } from 'next/navigation';

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

  useEffect(() => {
    loadOrders();
  }, []);

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
    // Open print page in new window
    const printUrl = `/admin/orders/print/${order.OrderID}`;
    window.open(printUrl, '_blank');
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
      // استخدام التقويم الميلادي مع الأرقام الإنجليزية
      return date.toLocaleString('ar-SA', {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        calendar: 'gregory',
        numberingSystem: 'latn', // استخدام الأرقام اللاتينية (الإنجليزية)
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
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.className}`}>
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
      <div className="space-y-6" dir="rtl">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">طلبيات اون لاين</h1>
          <p className="text-gray-600 mt-1">إدارة طلبيات العملاء الأون لاين</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <button
            onClick={() => setStatusFilter('all')}
            className={`p-4 rounded-lg border-2 transition-all ${
              statusFilter === 'all'
                ? 'border-gray-900 bg-gray-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-gray-900">{orderStats.all}</div>
            <div className="text-sm text-gray-600 mt-1">الكل</div>
          </button>
          <button
            onClick={() => setStatusFilter('Pending')}
            className={`p-4 rounded-lg border-2 transition-all ${
              statusFilter === 'Pending'
                ? 'border-yellow-500 bg-yellow-50'
                : 'border-gray-200 bg-white hover:border-yellow-200'
            }`}
          >
            <div className="text-2xl font-bold text-yellow-700">{orderStats.pending}</div>
            <div className="text-sm text-gray-600 mt-1">قيد الانتظار</div>
          </button>
          <button
            onClick={() => setStatusFilter('Processing')}
            className={`p-4 rounded-lg border-2 transition-all ${
              statusFilter === 'Processing'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-blue-200'
            }`}
          >
            <div className="text-2xl font-bold text-blue-700">{orderStats.processing}</div>
            <div className="text-sm text-gray-600 mt-1">قيد المعالجة</div>
          </button>
          <button
            onClick={() => setStatusFilter('Completed')}
            className={`p-4 rounded-lg border-2 transition-all ${
              statusFilter === 'Completed'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-white hover:border-green-200'
            }`}
          >
            <div className="text-2xl font-bold text-green-700">{orderStats.completed}</div>
            <div className="text-sm text-gray-600 mt-1">مكتملة</div>
          </button>
          <button
            onClick={() => setStatusFilter('Cancelled')}
            className={`p-4 rounded-lg border-2 transition-all ${
              statusFilter === 'Cancelled'
                ? 'border-red-500 bg-red-50'
                : 'border-gray-200 bg-white hover:border-red-200'
            }`}
          >
            <div className="text-2xl font-bold text-red-700">{orderStats.cancelled}</div>
            <div className="text-sm text-gray-600 mt-1">ملغاة</div>
          </button>
        </div>

        {/* Search and Status Filter */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="ابحث برقم الطلبية، اسم الزبون، أو رقم الهاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
            </div>
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-gray-900"
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

        {/* Orders Table */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <ShoppingBag size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">لا توجد طلبيات</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      رقم الطلبية
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      اسم الزبون
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      رقم الهاتف
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الحالة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      المبلغ الإجمالي
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      التاريخ والوقت
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      إجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.map((order) => (
                    <tr key={order.OrderID} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.OrderID}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.CustomerName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
                              className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed max-h-32 overflow-y-auto"
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {formatCurrency(order.TotalAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(order.CreatedAt)}
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
        )}

        {/* Summary */}
        {filteredOrders.length > 0 && (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600 font-cairo">
              إجمالي الطلبيات: <span className="font-semibold">{filteredOrders.length}</span>
            </p>
          </div>
        )}

        {/* Order Details Modal */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4" dir="rtl">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">تفاصيل الطلبية</h3>
                <div className="flex items-center gap-2">
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

              <div className="p-6 space-y-6">
                {/* Order Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">رقم الطلبية</p>
                    <p className="font-semibold text-gray-900">{selectedOrder.OrderID}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">الحالة</p>
                    <div>{getStatusBadge(selectedOrder.Status)}</div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">اسم الزبون</p>
                    <p className="font-semibold text-gray-900">{selectedOrder.CustomerName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">رقم الهاتف</p>
                    <p className="font-semibold text-gray-900">{selectedOrder.CustomerPhone}</p>
                  </div>
                  {selectedOrder.CustomerEmail && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">البريد الإلكتروني</p>
                      <p className="font-semibold text-gray-900">{selectedOrder.CustomerEmail}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500 mb-1">التاريخ والوقت</p>
                    <p className="font-semibold text-gray-900">{formatDate(selectedOrder.CreatedAt)}</p>
                  </div>
                </div>

                {/* Order Items */}
                <div>
                  <h4 className="text-lg font-bold text-gray-900 mb-4">الأصناف</h4>
                  {loadingDetails ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={24} className="animate-spin text-gray-400" />
                    </div>
                  ) : orderDetails.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">لا توجد أصناف</p>
                  ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                              اسم الصنف
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                              الكمية
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                              سعر الوحدة
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                              الإجمالي
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {orderDetails.map((detail) => (
                            <tr key={detail.DetailID}>
                              <td className="px-4 py-3 text-sm text-gray-900">{detail.ProductName}</td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900">{detail.Quantity}</td>
                              <td className="px-4 py-3 text-sm text-right text-gray-900">
                                {formatCurrency(detail.UnitPrice)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                                {formatCurrency(detail.TotalPrice)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t border-gray-200">
                          <tr>
                            <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                              الإجمالي:
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
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
                    <h4 className="text-lg font-bold text-gray-900 mb-2">ملاحظات</h4>
                    <p className="text-gray-700 bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                      {selectedOrder.Notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
