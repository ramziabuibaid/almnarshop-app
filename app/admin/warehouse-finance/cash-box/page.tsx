'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import CustomerSelect from '@/components/admin/CustomerSelect';
import { getWarehouseCashFlow, getAllCustomers, deleteWarehouseReceipt, deleteWarehousePayment, createWarehouseReceipt, createWarehousePayment, getWarehouseReceipt, getWarehousePayment, updateWarehouseReceipt, updateWarehousePayment } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import {
  Loader2,
  Plus,
  ArrowUp,
  ArrowDown,
  Wallet,
  Edit,
  Trash2,
  Printer,
  X,
  Save,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface CashFlowTransaction {
  id: string;
  date: string;
  created_at?: string;
  type: 'receipt' | 'payment';
  direction: 'in' | 'out';
  related_party?: string;
  customer_id?: string;
  cash_amount: number;
  check_amount: number;
  amount: number; // Total for backward compatibility
  notes?: string;
  receipt_id?: string;
  payment_id?: string;
  created_by?: string;
  user_id?: string;
}

interface TransactionWithBalance extends CashFlowTransaction {
  cash_balance: number;
  check_balance: number;
  balance: number; // Total balance for backward compatibility
}

export default function WarehouseCashBoxPage() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  
  // All hooks must be called before any conditional returns
  const [transactions, setTransactions] = useState<CashFlowTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerMap, setCustomerMap] = useState<Map<string, string>>(new Map());
  const [customerShamelMap, setCustomerShamelMap] = useState<Map<string, string>>(new Map());
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  
  // Modal states
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithBalance | null>(null);
  const [formData, setFormData] = useState({
    customerID: '',
    date: new Date().toISOString().split('T')[0],
    cash_amount: '',
    check_amount: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | null }>({ message: '', type: null });
  
  // Search and pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const TRANSACTIONS_PER_PAGE = 30;
  
  // Check permissions
  const canAccess = admin?.is_super_admin || admin?.permissions?.accessWarehouseCashBox === true;
  const canViewBalance = admin?.is_super_admin || admin?.permissions?.viewCashBoxBalance === true;
  
  // Redirect if no access
  useEffect(() => {
    if (!admin) return;
    if (!canAccess) {
      router.push('/admin');
    }
  }, [admin, canAccess, router]);
  
  // Early returns after all hooks
  if (!admin) return null;
  if (!canAccess) {
    return (
      <AdminLayout>
        <div className="p-6 text-center">
          <p className="text-red-600">ليس لديك صلاحية للوصول إلى هذه الصفحة</p>
        </div>
      </AdminLayout>
    );
  }

  useEffect(() => {
    loadCashFlow();
    loadCustomers();
    loadUsers();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await getAllCustomers();
      setCustomers(data);
      
      // Create a map from customer_id to customer name
      const map = new Map<string, string>();
      const shamelMap = new Map<string, string>();
      data.forEach((customer: any) => {
        const customerId = customer.CustomerID || customer.id || customer.customer_id || '';
        const customerName = customer.Name || customer.name || '';
        const shamelNo = customer.ShamelNo || customer['Shamel No'] || customer.shamel_no || customer.shamelNo || '';
        if (customerId && customerName) {
          map.set(customerId, customerName);
        }
        if (customerId && shamelNo) {
          shamelMap.set(customerId, shamelNo);
        }
      });
      setCustomerMap(map);
      setCustomerShamelMap(shamelMap);
    } catch (err: any) {
      console.error('[CashBox] Failed to load customers:', err);
    }
  };

  const loadUsers = async () => {
    try {
      // Fetch admin users from Supabase
      const { data: users, error } = await supabase
        .from('admin_users')
        .select('id, username')
        .order('username');

      if (error) {
        console.error('[CashBox] Failed to load users:', error);
        return;
      }

      // Create a map from user_id to username
      const map = new Map<string, string>();
      if (users && Array.isArray(users)) {
        users.forEach((user: any) => {
          const userId = user.id || '';
          const username = user.username || '';
          if (userId && username) {
            map.set(userId, username);
          }
        });
      }
      setUserMap(map);
    } catch (err: any) {
      console.error('[CashBox] Failed to load users:', err);
    }
  };

  const loadCashFlow = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWarehouseCashFlow();
      console.log('[CashBox] Raw data from API:', data);
      console.log('[CashBox] Sample payment data:', data.find((item: any) => item.payment_id));
      console.log('[CashBox] Sample receipt data:', data.find((item: any) => item.receipt_id));
      
      // Transform the data to match our interface
      // The warehouse_cash_flow view should have:
      // - date, direction ('in' or 'out'), amount, related_party, notes
      // - receipt_id (for receipts) or payment_id (for payments)
      const transformed: CashFlowTransaction[] = data.map((item: any) => {
        // Determine if it's a receipt or payment
        // Check multiple possible field names
        const receiptId = item.receipt_id || item.receiptId || item.receiptID || '';
        const paymentId = item.payment_id || item.paymentId || item.paymentID || '';
        const isReceipt = !!receiptId;
        const isPayment = !!paymentId;
        
        console.log('[CashBox] Processing item:', { receiptId, paymentId, item });
        
        // Determine direction - could be in the view or inferred from type
        let direction: 'in' | 'out' = 'in';
        if (item.direction) {
          direction = item.direction.toLowerCase() === 'out' ? 'out' : 'in';
        } else {
          // If no direction field, receipts are 'in', payments are 'out'
          direction = isReceipt ? 'in' : 'out';
        }
        
        // Get related party - could be customer_id, related_party, or customer name from join
        let relatedParty = '';
        let customerId = '';
        
        if (item.customer_id) {
          customerId = item.customer_id;
        } else if (item.related_party) {
          // related_party might be customer_id or text
          customerId = item.related_party;
        } else if (item.relatedParty) {
          customerId = item.relatedParty;
        }
        
        // Store customer_id for later lookup
        relatedParty = customerId;
        
        // Get user_id from various possible field names
        const userId = item.created_by || item.createdBy || item.user_id || item.userId || item.created_by_user_id || '';
        
        const cashAmount = parseFloat(item.cash_amount || 0);
        const checkAmount = parseFloat(item.check_amount || 0);
        const totalAmount = cashAmount + checkAmount;
        // Fallback to amount if cash_amount/check_amount not available (backward compatibility)
        const fallbackAmount = parseFloat(item.amount || 0);
        
        return {
          id: receiptId || paymentId || item.id || '',
          date: item.date,
          created_at: item.created_at || item.createdAt || item.created_at,
          type: isReceipt ? 'receipt' : 'payment',
          direction,
          related_party: relatedParty, // This will be customer_id or text
          customer_id: customerId, // Store customer_id separately for lookup
          cash_amount: cashAmount || (totalAmount === 0 && fallbackAmount > 0 ? fallbackAmount : 0),
          check_amount: checkAmount,
          amount: totalAmount || fallbackAmount, // Total for backward compatibility
          notes: item.notes || '',
          receipt_id: receiptId,
          payment_id: paymentId,
          created_by: userId,
          user_id: userId,
        };
      });
      
      setTransactions(transformed);
    } catch (err: any) {
      console.error('[CashBox] Failed to load cash flow:', err);
      setError(err?.message || 'فشل تحميل بيانات الصندوق');
    } finally {
      setLoading(false);
    }
  };

  // Filter transactions by search query (smart search like products page)
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Apply search - supports multiple words (smart search)
    if (searchQuery.trim()) {
      // Split search query into individual words
      const searchWords = searchQuery
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0);
      
      filtered = filtered.filter((tx) => {
        // Get customer ID and name
        const customerId = tx.customer_id || tx.related_party || '';
        const customerName = customerId && customerMap.has(customerId)
          ? (customerMap.get(customerId) || '').toLowerCase()
          : '';
        
        // Create searchable text from customer ID and name
        const searchableText = `${customerId.toLowerCase()} ${customerName}`.trim();
        
        // Check if ALL search words are found in the searchable text (words don't need to be consecutive)
        return searchWords.every(word => searchableText.includes(word));
      });
    }

    return filtered;
  }, [transactions, searchQuery, customerMap]);

  // Calculate running balance - use filtered transactions
  // First sort by date ASC to calculate balances chronologically
  // Then sort by created_at DESC (newest first) for display
  const transactionsWithBalance = useMemo(() => {
    // Sort chronologically (oldest first) for balance calculation
    // Use created_at if available, otherwise use date
    const sortedChronologically = [...filteredTransactions].sort((a, b) => {
      // First try to sort by created_at
      if (a.created_at && b.created_at) {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        if (timeA !== timeB) return timeA - timeB;
      }
      // Fallback to date
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      // If same date, sort by id
      return a.id.localeCompare(b.id);
    });

    // Calculate running balances for cash and checks separately
    let runningCashBalance = 0;
    let runningCheckBalance = 0;
    const withBalance: TransactionWithBalance[] = sortedChronologically.map((tx) => {
      // Calculate cash flow
      const cashIn = tx.direction === 'in' ? tx.cash_amount : 0;
      const cashOut = tx.direction === 'out' ? tx.cash_amount : 0;
      runningCashBalance = runningCashBalance + (cashIn - cashOut);
      
      // Calculate check flow
      const checkIn = tx.direction === 'in' ? tx.check_amount : 0;
      const checkOut = tx.direction === 'out' ? tx.check_amount : 0;
      runningCheckBalance = runningCheckBalance + (checkIn - checkOut);
      
      // Total balance (for backward compatibility)
      const totalBalance = runningCashBalance + runningCheckBalance;
      
      return {
        ...tx,
        cash_balance: runningCashBalance,
        check_balance: runningCheckBalance,
        balance: totalBalance,
      };
    });

    // Sort by date DESC first, then created_at DESC (newest first) for display
    return withBalance.sort((a, b) => {
      // First sort by date (newest first)
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateB - dateA; // DESC - newest date first
      
      // If same date, sort by created_at (newest first)
      if (a.created_at && b.created_at) {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        if (timeA !== timeB) return timeB - timeA; // DESC - newest time first
      } else if (a.created_at && !b.created_at) {
        return -1; // a has created_at, b doesn't - a comes first
      } else if (!a.created_at && b.created_at) {
        return 1; // b has created_at, a doesn't - b comes first
      }
      
      // Final fallback: sort by ID
      return b.id.localeCompare(a.id);
    });
  }, [filteredTransactions]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil(transactionsWithBalance.length / TRANSACTIONS_PER_PAGE);
  const startIndex = (currentPage - 1) * TRANSACTIONS_PER_PAGE;
  const endIndex = startIndex + TRANSACTIONS_PER_PAGE;
  const paginatedTransactions = transactionsWithBalance.slice(startIndex, endIndex);

  // Calculate current balances from ALL transactions (for header cards) - not filtered
  const { currentCashBalance, currentCheckBalance } = useMemo(() => {
    // Calculate from all transactions, not filtered
    let runningCash = 0;
    let runningCheck = 0;
    
    const allSorted = [...transactions].sort((a, b) => {
      if (a.created_at && b.created_at) {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        if (timeA !== timeB) return timeA - timeB;
      }
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.id.localeCompare(b.id);
    });

    allSorted.forEach((tx) => {
      if (tx.direction === 'in') {
        runningCash += tx.cash_amount || 0;
        runningCheck += tx.check_amount || 0;
      } else {
        runningCash -= tx.cash_amount || 0;
        runningCheck -= tx.check_amount || 0;
      }
    });

    return {
      currentCashBalance: runningCash,
      currentCheckBalance: runningCheck,
    };
  }, [transactions]);

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

  const formatTime = (dateString: string | undefined) => {
    if (!dateString) return '';
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
      return '';
    }
  };

  const handleDelete = async (tx: TransactionWithBalance) => {
    if (!confirm(`هل أنت متأكد من حذف ${tx.type === 'receipt' ? 'سند القبض' : 'سند الدفع'} ${tx.receipt_id || tx.payment_id}?`)) {
      return;
    }

    try {
      if (tx.receipt_id) {
        await deleteWarehouseReceipt(tx.receipt_id);
      } else if (tx.payment_id) {
        await deleteWarehousePayment(tx.payment_id);
      }
      // Reload data
      loadCashFlow();
    } catch (err: any) {
      console.error('[CashBox] Failed to delete transaction:', err);
      alert(`فشل الحذف: ${err?.message || 'خطأ غير معروف'}`);
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

  const handleReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      if (!formData.customerID) {
        throw new Error('يجب اختيار العميل');
      }

      const cashAmount = parseFloat(formData.cash_amount) || 0;
      const checkAmount = parseFloat(formData.check_amount) || 0;
      
      if (cashAmount <= 0 && checkAmount <= 0) {
        throw new Error('يجب إدخال مبلغ نقدي أو شيك على الأقل');
      }

      const payload = {
        date: formData.date,
        cash_amount: cashAmount,
        check_amount: checkAmount,
        related_party: formData.customerID,
        notes: formData.notes.trim() || undefined,
        created_by: admin?.id || undefined,
      };

      if (editingTransaction && editingTransaction.receipt_id) {
        await updateWarehouseReceipt(editingTransaction.receipt_id, payload);
        setToast({ message: 'تم تحديث سند القبض بنجاح', type: 'success' });
      } else {
        await createWarehouseReceipt(payload);
        setToast({ message: 'تم إنشاء سند القبض بنجاح', type: 'success' });
      }

      setReceiptModalOpen(false);
      setFormData({
        customerID: '',
        date: new Date().toISOString().split('T')[0],
        cash_amount: '',
        check_amount: '',
        notes: '',
      });
      setEditingTransaction(null);
      // Use setTimeout to reload after modal closes to improve UX
      setTimeout(() => {
        loadCashFlow();
      }, 100);
      
      setTimeout(() => setToast({ message: '', type: null }), 3000);
    } catch (err: any) {
      console.error('[WarehouseCashBox] Failed to save receipt:', err);
      setFormError(err?.message || 'فشل حفظ سند القبض');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      if (!formData.customerID) {
        throw new Error('يجب اختيار العميل');
      }

      const cashAmount = parseFloat(formData.cash_amount) || 0;
      const checkAmount = parseFloat(formData.check_amount) || 0;
      
      if (cashAmount <= 0 && checkAmount <= 0) {
        throw new Error('يجب إدخال مبلغ نقدي أو شيك على الأقل');
      }

      const payload = {
        date: formData.date,
        cash_amount: cashAmount,
        check_amount: checkAmount,
        customer_id: formData.customerID,
        notes: formData.notes.trim() || undefined,
        created_by: admin?.id || undefined,
      };

      if (editingTransaction && editingTransaction.payment_id) {
        await updateWarehousePayment(editingTransaction.payment_id, payload);
        setToast({ message: 'تم تحديث سند الدفع بنجاح', type: 'success' });
      } else {
        await createWarehousePayment(payload);
        setToast({ message: 'تم إنشاء سند الدفع بنجاح', type: 'success' });
      }

      setPaymentModalOpen(false);
      setFormData({
        customerID: '',
        date: new Date().toISOString().split('T')[0],
        cash_amount: '',
        check_amount: '',
        notes: '',
      });
      setEditingTransaction(null);
      // Use setTimeout to reload after modal closes to improve UX
      setTimeout(() => {
        loadCashFlow();
      }, 100);
      
      setTimeout(() => setToast({ message: '', type: null }), 3000);
    } catch (err: any) {
      console.error('[WarehouseCashBox] Failed to save payment:', err);
      setFormError(err?.message || 'فشل حفظ سند الدفع');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">جاري تحميل بيانات الصندوق...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">صندوق المستودع</h1>
            <p className="text-gray-600 mt-1">سجل مالي مستمر للمستودع</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setEditingTransaction(null);
                setFormData({
                  customerID: '',
                  date: new Date().toISOString().split('T')[0],
                  cash_amount: '',
                  check_amount: '',
                  notes: '',
                });
                setFormError(null);
                setReceiptModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <Plus size={20} />
              سند قبض
            </button>
            <button
              onClick={() => {
                setEditingTransaction(null);
                setFormData({
                  customerID: '',
                  date: new Date().toISOString().split('T')[0],
                  cash_amount: '',
                  check_amount: '',
                  notes: '',
                });
                setFormError(null);
                setPaymentModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              <Plus size={20} />
              سند دفع
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Current Balance Cards - Only show if user has permission */}
        {canViewBalance && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm mb-1">رصيد الصندوق النقدي</p>
                  <p className="text-4xl font-bold">{formatCurrency(currentCashBalance)}</p>
                </div>
                <Wallet size={48} className="text-green-200" />
              </div>
            </div>
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm mb-1">رصيد الشيكات</p>
                  <p className="text-4xl font-bold">{formatCurrency(currentCheckBalance)}</p>
                </div>
                <Wallet size={48} className="text-purple-200" />
              </div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search size={20} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="البحث عن سند حسب رقم الزبون أو اسم الزبون..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-500"
                dir="rtl"
              />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                title="مسح البحث"
              >
                <X size={20} />
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="mt-2 text-sm text-gray-600">
              تم العثور على <span className="font-semibold">{transactionsWithBalance.length}</span> سند
            </div>
          )}
        </div>

        {/* Transactions Table */}
        {transactionsWithBalance.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Wallet size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">
              {searchQuery ? 'لم يتم العثور على سندات تطابق البحث' : 'لا توجد معاملات مالية'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      رقم السند
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      التاريخ
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      النوع
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      اسم الزبون
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      المبالغ
                    </th>
                    {canViewBalance && (
                      <>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          الرصيد النقدي
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          رصيد الشيكات
                        </th>
                      </>
                    )}
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-200 transition-colors">
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-gray-900">
                          {tx.receipt_id || tx.payment_id || tx.id || '—'}
                        </div>
                        {(() => {
                          const userId = tx.user_id || tx.created_by || '';
                          if (userId && userMap.has(userId)) {
                            const username = userMap.get(userId);
                            return (
                              <div className="text-xs text-gray-500 mt-1">
                                {username}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-gray-600">
                          <div>{formatDate(tx.date)}</div>
                        {tx.created_at && (
                            <div className="text-xs text-gray-500 mt-0.5">{formatTime(tx.created_at)}</div>
                        )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {tx.direction === 'in' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <ArrowUp size={12} />
                            قبض
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <ArrowDown size={12} />
                            صرف
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-gray-900">
                          {(() => {
                            // Try to get customer name from map
                            const customerId = tx.customer_id || tx.related_party || '';
                            const customerName = customerId && customerMap.has(customerId)
                              ? customerMap.get(customerId) || customerId
                              : (tx.related_party || '—');
                            const shamelNo = customerId && customerShamelMap.has(customerId)
                              ? customerShamelMap.get(customerId)
                              : null;
                            
                            return (
                              <div className="leading-tight">
                                {customerId ? (
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
                                    className="text-blue-600 hover:text-blue-800 hover:underline transition-colors text-right font-medium"
                                    title="فتح بروفايل الزبون (Ctrl+Click أو Shift+Click لفتح في تبويب جديد)"
                                  >
                                    {customerName}
                                  </button>
                                ) : (
                                  <div>{customerName}</div>
                                )}
                                {shamelNo && (
                                  <div className="text-[10px] text-gray-400 mt-0.5 leading-none">
                                    {shamelNo}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="space-y-1">
                          {tx.direction === 'in' ? (
                            <>
                              {tx.cash_amount > 0 && (
                                <div className="text-sm font-semibold text-green-700">
                                  نقدي: {formatCurrency(tx.cash_amount)}
                                </div>
                              )}
                              {tx.check_amount > 0 && (
                                <div className="text-sm font-semibold text-green-700">
                                  شيك: {formatCurrency(tx.check_amount)}
                                </div>
                              )}
                              {tx.cash_amount === 0 && tx.check_amount === 0 && <span className="text-gray-400">—</span>}
                            </>
                          ) : (
                            <>
                              {tx.cash_amount > 0 && (
                                <div className="text-sm font-semibold text-red-700">
                                  نقدي: {formatCurrency(tx.cash_amount)}
                                </div>
                              )}
                              {tx.check_amount > 0 && (
                                <div className="text-sm font-semibold text-red-700">
                                  شيك: {formatCurrency(tx.check_amount)}
                                </div>
                              )}
                              {tx.cash_amount === 0 && tx.check_amount === 0 && <span className="text-gray-400">—</span>}
                            </>
                          )}
                        </div>
                      </td>
                      {canViewBalance && (
                        <>
                          <td className="px-4 py-3 text-right">
                            <div className={`font-semibold ${tx.cash_balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                              {formatCurrency(tx.cash_balance)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className={`font-semibold ${tx.check_balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                              {formatCurrency(tx.check_balance)}
                            </div>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <>
                            <button
                                onClick={() => {
                                  if (tx.receipt_id) {
                                    const printUrl = `/admin/warehouse-finance/receipts/print/${tx.receipt_id}`;
                                    window.open(printUrl, `print-warehouse-receipt-${tx.receipt_id}`, 'noopener,noreferrer');
                                  } else if (tx.payment_id) {
                                    const printUrl = `/admin/warehouse-finance/payments/print/${tx.payment_id}`;
                                    window.open(printUrl, `print-warehouse-payment-${tx.payment_id}`, 'noopener,noreferrer');
                                  }
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="طباعة"
                              >
                                <Printer size={18} />
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    let transactionData: any = null;
                                    if (tx.receipt_id) {
                                      transactionData = await getWarehouseReceipt(tx.receipt_id);
                                      setFormData({
                                        customerID: transactionData.customer_id || '',
                                        date: transactionData.date ? (typeof transactionData.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(transactionData.date) ? transactionData.date.split('T')[0] : new Date(transactionData.date).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
                                        cash_amount: (transactionData.cash_amount || 0).toString(),
                                        check_amount: (transactionData.check_amount || 0).toString(),
                                        notes: transactionData.notes || '',
                                      });
                                      setEditingTransaction(tx);
                                      setReceiptModalOpen(true);
                                    } else if (tx.payment_id) {
                                      transactionData = await getWarehousePayment(tx.payment_id);
                                      setFormData({
                                        customerID: transactionData.customer_id || '',
                                        date: transactionData.date ? (typeof transactionData.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(transactionData.date) ? transactionData.date.split('T')[0] : new Date(transactionData.date).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
                                        cash_amount: (transactionData.cash_amount || 0).toString(),
                                        check_amount: (transactionData.check_amount || 0).toString(),
                                        notes: transactionData.notes || '',
                                      });
                                      setEditingTransaction(tx);
                                      setPaymentModalOpen(true);
                                    }
                                    setFormError(null);
                                  } catch (err: any) {
                                    console.error('[WarehouseCashBox] Failed to load transaction:', err);
                                    alert(`فشل تحميل بيانات السند: ${err?.message || 'خطأ غير معروف'}`);
                                  }
                                }}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="تعديل"
                              >
                                <Edit size={18} />
                              </button>
                              <button
                                onClick={() => handleDelete(tx)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="حذف"
                              >
                                <Trash2 size={18} />
                              </button>
                          </>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  عرض <span className="font-semibold">{startIndex + 1}</span> إلى{' '}
                  <span className="font-semibold">
                    {Math.min(endIndex, transactionsWithBalance.length)}
                  </span>{' '}
                  من <span className="font-semibold">{transactionsWithBalance.length}</span> سند
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="الصفحة السابقة"
                  >
                    <ChevronRight size={20} className="text-gray-600" />
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 rounded-lg transition-colors ${
                            currentPage === pageNum
                              ? 'bg-gray-900 text-white'
                              : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="الصفحة التالية"
                  >
                    <ChevronLeft size={20} className="text-gray-600" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Receipt Modal */}
        {receiptModalOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
              onClick={() => {
                if (!isSubmitting) {
                  setReceiptModalOpen(false);
                  setFormError(null);
                  setFormData({
                    customerID: '',
                    date: new Date().toISOString().split('T')[0],
                    cash_amount: '',
                    check_amount: '',
                    notes: '',
                  });
                  setEditingTransaction(null);
                }
              }}
            />
            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" dir="rtl" onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingTransaction ? 'تعديل سند قبض' : 'إضافة سند قبض جديد - المستودع'}
                  </h2>
                  <button
                    onClick={() => {
                      if (!isSubmitting) {
                        setReceiptModalOpen(false);
                        setFormError(null);
                        setFormData({
                          customerID: '',
                          date: new Date().toISOString().split('T')[0],
                          cash_amount: '',
                          check_amount: '',
                          notes: '',
                        });
                        setEditingTransaction(null);
                      }
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    disabled={isSubmitting}
                  >
                    <X size={24} className="text-gray-500" />
                  </button>
                </div>
                <form onSubmit={handleReceiptSubmit} className="p-6 space-y-4">
                  {formError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-700">{formError}</p>
                    </div>
                  )}
                  <CustomerSelect
                    value={formData.customerID}
                    onChange={(customerID) => setFormData({ ...formData, customerID })}
                    customers={customers}
                    placeholder="اختر العميل"
                    required
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      التاريخ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        المبلغ النقدي (₪)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.cash_amount}
                        onChange={(e) => setFormData({ ...formData, cash_amount: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        المبلغ بالشيك (₪)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.check_amount}
                        onChange={(e) => setFormData({ ...formData, check_amount: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      ملاحظات
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isSubmitting) {
                          setReceiptModalOpen(false);
                          setFormError(null);
                          setFormData({
                            customerID: '',
                            date: new Date().toISOString().split('T')[0],
                            cash_amount: '',
                            check_amount: '',
                            notes: '',
                          });
                          setEditingTransaction(null);
                        }
                      }}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          جاري الحفظ...
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          حفظ
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}

        {/* Payment Modal */}
        {paymentModalOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
              onClick={() => {
                if (!isSubmitting) {
                  setPaymentModalOpen(false);
                  setFormError(null);
                  setFormData({
                    customerID: '',
                    date: new Date().toISOString().split('T')[0],
                    cash_amount: '',
                    check_amount: '',
                    notes: '',
                  });
                  setEditingTransaction(null);
                }
              }}
            />
            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" dir="rtl" onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingTransaction ? 'تعديل سند دفع' : 'إضافة سند دفع جديد - المستودع'}
                  </h2>
                  <button
                    onClick={() => {
                      if (!isSubmitting) {
                        setPaymentModalOpen(false);
                        setFormError(null);
                        setFormData({
                          customerID: '',
                          date: new Date().toISOString().split('T')[0],
                          cash_amount: '',
                          check_amount: '',
                          notes: '',
                        });
                        setEditingTransaction(null);
                      }
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    disabled={isSubmitting}
                  >
                    <X size={24} className="text-gray-500" />
                  </button>
                </div>
                <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
                  {formError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-700">{formError}</p>
                    </div>
                  )}
                  <CustomerSelect
                    value={formData.customerID}
                    onChange={(customerID) => setFormData({ ...formData, customerID })}
                    customers={customers}
                    placeholder="اختر العميل"
                    required
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      التاريخ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        المبلغ النقدي (₪)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.cash_amount}
                        onChange={(e) => setFormData({ ...formData, cash_amount: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        المبلغ بالشيك (₪)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.check_amount}
                        onChange={(e) => setFormData({ ...formData, check_amount: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      ملاحظات
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isSubmitting) {
                          setPaymentModalOpen(false);
                          setFormError(null);
                          setFormData({
                            customerID: '',
                            date: new Date().toISOString().split('T')[0],
                            cash_amount: '',
                            check_amount: '',
                            notes: '',
                          });
                          setEditingTransaction(null);
                        }
                      }}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          جاري الحفظ...
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          حفظ
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}

        {/* Toast Notification */}
        {toast.type && (
          <div className="fixed bottom-4 right-4 z-[102] animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl min-w-[200px] bg-green-600 text-white">
              <span className="font-medium text-sm">{toast.message}</span>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

