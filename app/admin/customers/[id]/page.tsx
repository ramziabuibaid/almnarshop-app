'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import CustomerFormModal from '@/components/admin/CustomerFormModal';
import AddInteractionModal from '@/components/admin/AddInteractionModal';
import ReceiptPaymentModal from '@/components/admin/ReceiptPaymentModal';
import PhoneActions from '@/components/admin/PhoneActions';
import { getCustomerData, getAllCustomers, getCustomerChecks, saveCheck, deleteCustomer } from '@/lib/api';
import { fixPhoneNumber } from '@/lib/utils';
import {
  Loader2,
  User,
  Phone,
  MapPin,
  Edit,
  ShoppingCart,
  Banknote,
  Calendar,
  ArrowLeft,
  Plus,
  FileText,
  Image as ImageIcon,
  X,
  Save,
  Trash2,
  Printer,
} from 'lucide-react';

interface TimelineItem {
  type: 'invoice' | 'receipt' | 'payment' | 'interaction';
  id: string;
  date: string;
  amount?: number;
  invoiceNumber?: string;
  receiptNumber?: string;
  paymentNumber?: string;
  notes?: string;
  channel?: string;
  status?: string;
  nextFollowUpDate?: string;
  items?: any[];
  source?: string;
  [key: string]: any;
}

export default function CustomerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { admin } = useAdminAuth();
  const customerId = params?.id as string;
  
  // Check if user has permission to view balances
  const canViewBalances = admin?.is_super_admin || admin?.permissions?.viewBalances === true;
  // Check if user has accountant permission (for delete)
  const canAccountant = admin?.is_super_admin || admin?.permissions?.accountant === true;

  const [customer, setCustomer] = useState<any>(null);
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);
  const [selectedInteraction, setSelectedInteraction] = useState<any | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [checks, setChecks] = useState<any[]>([]);
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [checkForm, setCheckForm] = useState({
    amount: '',
    imageFront: '',
    imageBack: '',
    returnDate: '',
    status: 'مع الشركة',
    notes: '',
  });
  const [checkSaving, setCheckSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (customerId) {
      loadCustomerData();
    }
  }, [customerId]);

  const loadCustomerData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Ensure ID is a string and log it
      const idString = String(customerId || '').trim();
      console.log('[CustomerProfile] Fetching Profile for ID:', idString);
      console.log('[CustomerProfile] ID type:', typeof customerId, 'converted to:', typeof idString);
      
      if (!idString || idString === '') {
        throw new Error('Customer ID is missing or invalid');
      }

      // Load customer info from all customers list
      const allCustomers = await getAllCustomers();
      const foundCustomer = allCustomers.find(
        (c) => {
          const cId = String(c.CustomerID || c.id || c.customerID || '').trim();
          return cId === idString;
        }
      );

      if (!foundCustomer) {
        throw new Error('Customer not found or ID incorrect');
      }

      setCustomer(foundCustomer);

      // Load customer data (invoices, receipts, interactions)
      // Pass the string ID explicitly
      const data = await getCustomerData(idString);
      console.log('[CustomerProfile] Customer data loaded:', data);

      setCustomerData({
        invoices: data.invoices || [],
        receipts: data.receipts || [],
        interactions: data.interactions || [],
        quotations: data.quotations || [],
      });

      // Load checks
      const checksData = await getCustomerChecks(idString);
      setChecks(checksData || []);
    } catch (error: any) {
      console.error('[CustomerProfile] Error loading customer data:', error);
      console.error('[CustomerProfile] Error details:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
      });
      
      // Provide friendly error messages
      let errorMessage = 'Failed to load customer data.';
      
      if (error?.message?.includes('not found') || error?.message?.includes('ID incorrect')) {
        errorMessage = 'Customer not found or ID incorrect. Please check the customer ID and try again.';
      } else if (error?.message?.includes('Network error') || error?.message?.includes('Failed to connect')) {
        errorMessage = 'Network error: Could not connect to server. Please check your internet connection.';
      } else if (error?.message?.includes('timeout')) {
        errorMessage = 'Request timeout: The server took too long to respond. Please try again.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
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
        ...invoice,
      });
    });

    // Add shop receipts
    (customerData.receipts || []).forEach((receipt: any) => {
      // Check if it's a payment (has PaymentID) or receipt (has ReceiptID)
      const receiptId = receipt.ReceiptID || receipt.PaymentID || receipt.id || receipt.receiptID;
      if (!receiptId || receiptId === '') return;
      
      const isPayment = receipt.PaymentID || receipt.Type === 'shop_payment';
      
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
        ...receipt,
      });
    });

    // Sort by date (newest first)
    items.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });

    return items;
  }, [customerData]);

  // Separate interactions
  const interactionItems = useMemo(() => {
    const items: TimelineItem[] = [];

    (customerData.interactions || []).forEach((interaction: any) => {
      const interactionId = interaction.InteractionID || interaction.id || interaction.interactionID;
      if (!interactionId || interactionId === '') return;
      
      items.push({
        type: 'interaction',
        id: String(interactionId),
        date: interaction.Date || interaction.date || interaction.InteractionDate || interaction.interactionDate || interaction.CreatedAt || '',
        notes: interaction.Notes || interaction.notes || '',
        channel: interaction.Channel || interaction.channel || interaction.ActionType || '',
        status: interaction.Status || interaction.status || interaction.Outcome || '',
        nextFollowUpDate: interaction.NextFollowUpDate || interaction.nextFollowUpDate || interaction.PromiseDate || '',
        promiseAmount: interaction.PromiseAmount || interaction.promiseAmount || 0,
        ptpStatus: interaction.PTP_Status || interaction.ptp_Status || interaction.PTPStatus || '',
        ...interaction,
      });
    });

    // Sort by date (newest first)
    items.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

    return items;
  }, [customerData]);

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
      console.error('[CustomerProfile] Error formatting date:', dateString, error);
      return '—';
    }
  };

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'invoice':
        return ShoppingCart;
      case 'receipt':
        return Banknote;
      case 'payment':
        return Banknote;
      case 'interaction':
        return Phone;
      default:
        return FileText;
    }
  };

  const getTimelineColor = (type: string) => {
    switch (type) {
      case 'invoice':
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          border: 'border-blue-300',
          iconBg: 'bg-blue-100',
        };
      case 'receipt':
        return {
          bg: 'bg-green-50',
          text: 'text-green-700',
          border: 'border-green-300',
          iconBg: 'bg-green-100',
        };
      case 'payment':
        return {
          bg: 'bg-red-50',
          text: 'text-red-700',
          border: 'border-red-300',
          iconBg: 'bg-red-100',
        };
      case 'interaction':
        return {
          bg: 'bg-orange-50',
          text: 'text-orange-700',
          border: 'border-orange-300',
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

  // Get interaction color based on PTP Status
  const getInteractionColor = (ptpStatus: string) => {
    const status = (ptpStatus || '').toLowerCase();
    switch (status) {
      case 'active':
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          border: 'border-blue-400',
          iconBg: 'bg-blue-100',
        };
      case 'fulfilled':
      case 'paid':
        return {
          bg: 'bg-green-50',
          text: 'text-green-700',
          border: 'border-green-400',
          iconBg: 'bg-green-100',
        };
      case 'archived':
      case 'closed':
        return {
          bg: 'bg-gray-50',
          text: 'text-gray-700',
          border: 'border-gray-400',
          iconBg: 'bg-gray-100',
        };
      default:
        return {
          bg: 'bg-orange-50',
          text: 'text-orange-700',
          border: 'border-orange-400',
          iconBg: 'bg-orange-100',
        };
    }
  };

  const handleEditSuccess = (customerId?: string) => {
    loadCustomerData();
    // customerId is available if needed for future enhancements
  };

  const handleOpenInteractionModal = (interaction?: any) => {
    setSelectedInteraction(interaction || null);
    setIsInteractionModalOpen(true);
  };

  const handleCloseInteractionModal = () => {
    setIsInteractionModalOpen(false);
    setSelectedInteraction(null);
  };

  const handleInteractionSuccess = () => {
    loadCustomerData();
  };

  const handleReceiptSuccess = () => {
    loadCustomerData();
  };

  const handlePaymentSuccess = () => {
    loadCustomerData();
  };

  const handleDeleteCustomer = async () => {
    if (!customerId) return;

    const customerName = customer?.Name || customer?.name || 'هذا الزبون';
    const confirmMessage = `هل أنت متأكد من حذف الزبون "${customerName}"؟\n\nهذا الإجراء لا يمكن التراجع عنه.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setDeleting(true);
    try {
      const result = await deleteCustomer(customerId);
      
      if (result.status === 'blocked' && result.references) {
        const refs = result.references;
        const messages: string[] = [];
        
        if (refs.shopReceipts.length > 0) {
          messages.push(`سندات قبض: ${refs.shopReceipts.slice(0, 10).join(', ')}${refs.shopReceipts.length > 10 ? ` و${refs.shopReceipts.length - 10} أخرى` : ''}`);
        }
        if (refs.shopPayments.length > 0) {
          messages.push(`سندات صرف: ${refs.shopPayments.slice(0, 10).join(', ')}${refs.shopPayments.length > 10 ? ` و${refs.shopPayments.length - 10} أخرى` : ''}`);
        }
        if (refs.shopInvoices.length > 0) {
          messages.push(`فواتير مبيعات المحل: ${refs.shopInvoices.slice(0, 10).join(', ')}${refs.shopInvoices.length > 10 ? ` و${refs.shopInvoices.length - 10} أخرى` : ''}`);
        }
        if (refs.warehouseInvoices.length > 0) {
          messages.push(`فواتير مبيعات المخزن: ${refs.warehouseInvoices.slice(0, 10).join(', ')}${refs.warehouseInvoices.length > 10 ? ` و${refs.warehouseInvoices.length - 10} أخرى` : ''}`);
        }
        if (refs.quotations.length > 0) {
          messages.push(`عروض أسعار: ${refs.quotations.slice(0, 10).join(', ')}${refs.quotations.length > 10 ? ` و${refs.quotations.length - 10} أخرى` : ''}`);
        }
        if (refs.maintenance.length > 0) {
          messages.push(`صيانة: ${refs.maintenance.slice(0, 10).join(', ')}${refs.maintenance.length > 10 ? ` و${refs.maintenance.length - 10} أخرى` : ''}`);
        }
        if (refs.checks.length > 0) {
          messages.push(`شيكات راجعة: ${refs.checks.slice(0, 10).join(', ')}${refs.checks.length > 10 ? ` و${refs.checks.length - 10} أخرى` : ''}`);
        }
        
        const errorMessage = `لا يمكن حذف الزبون "${customerName}" لأنه مرتبط بـ:\n\n${messages.join('\n')}\n\nيرجى إصلاح أو حذف هذه السجلات أولاً.`;
        alert(errorMessage);
        return;
      }
      
      alert('تم حذف الزبون بنجاح');
      router.push('/admin/customers');
    } catch (error: any) {
      console.error('[CustomerProfile] Error deleting customer:', error);
      alert('فشل حذف الزبون: ' + (error?.message || 'خطأ غير معروف'));
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveCheck = async () => {
    if (!customerId) return;
    if (!checkForm.amount.trim()) {
      alert('المبلغ مطلوب');
      return;
    }
    setCheckSaving(true);
    try {
      await saveCheck({
        customerID: customerId,
        amount: parseFloat(checkForm.amount) || 0,
        imageFront: checkForm.imageFront || null,
        imageBack: checkForm.imageBack || null,
        returnDate: checkForm.returnDate || null,
        status: checkForm.status as any,
        notes: checkForm.notes || null,
      });
      // refresh
      const checksData = await getCustomerChecks(customerId);
      setChecks(checksData || []);
      setIsCheckModalOpen(false);
      setCheckForm({
        amount: '',
        imageFront: '',
        imageBack: '',
        returnDate: '',
        status: 'مع الشركة',
        notes: '',
      });
    } catch (err: any) {
      alert(err?.message || 'فشل حفظ الشيك');
    } finally {
      setCheckSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Loading customer profile...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !customer) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-red-600 text-lg mb-4">{error || 'Customer not found'}</p>
            <button
              onClick={() => router.push('/admin/customers')}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Back to Customers
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const balance = customer.Balance || customer.balance || 0;
  const balanceColor = balance > 0 ? 'bg-red-50 border-red-200' : balance < 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200';
  const balanceTextColor = balance > 0 ? 'text-red-600' : balance < 0 ? 'text-green-600' : 'text-gray-600';

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/customers')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Customer Profile</h1>
              <p className="text-gray-600 mt-1">View customer history and manage interactions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenInteractionModal}
              className="px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium flex items-center gap-1.5"
              title="إجراء تواصل"
            >
              <Phone size={16} />
              <span>إجراء تواصل</span>
            </button>
            <button
              onClick={() => router.push(`/admin/shop-sales/new?customerId=${customerId}`)}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-1.5"
              title="فاتورة محل"
            >
              <Plus size={16} />
              <span>فاتورة محل</span>
            </button>
            <button
              onClick={() => router.push(`/admin/warehouse-sales/new?customerId=${customerId}`)}
              className="px-3 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-900 transition-colors text-sm font-medium flex items-center gap-1.5"
              title="فاتورة مخزن"
            >
              <Plus size={16} />
              <span>فاتورة مخزن</span>
            </button>
            <button
              onClick={() => router.push(`/admin/quotations/new?customerId=${customerId}`)}
              className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium flex items-center gap-1.5"
              title="عرض سعر"
            >
              <Plus size={16} />
              <span>عرض سعر</span>
            </button>
            <button
              onClick={() => setIsReceiptModalOpen(true)}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-1.5"
              title="سند قبض"
            >
              <Plus size={16} />
              <span>سند قبض</span>
            </button>
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center gap-1.5"
              title="سند صرف"
            >
              <Plus size={16} />
              <span>سند صرف</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Customer Card */}
          <div className="lg:col-span-1 space-y-4">
            {/* Customer Info Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              {/* Photo */}
              <div className="flex justify-center mb-4">
                <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center">
                  {customer.Photo || customer.photo ? (
                    <img
                      src={customer.Photo || customer.photo}
                      alt={customer.Name || customer.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <User size={48} className="text-gray-400" />
                  )}
                </div>
              </div>

              {/* Name */}
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
                {customer.Name || customer.name || 'N/A'}
              </h2>

              {/* Phone */}
              {customer.Phone || customer.phone ? (
                <div className="flex items-center justify-center gap-2 text-gray-600 mb-2">
                  <Phone size={16} />
                  <PhoneActions phone={customer.Phone || customer.phone} />
                </div>
              ) : null}

              {/* Address */}
              {customer.Address || customer.address ? (
                <div className="flex items-start justify-center gap-2 text-gray-600 mb-4">
                  <MapPin size={16} className="mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-center">{customer.Address || customer.address}</p>
                </div>
              ) : null}

              {/* Type Badge */}
              {customer.Type || customer.type ? (
                <div className="flex justify-center mb-4">
                  <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                    {customer.Type || customer.type}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Balance Card */}
            {canViewBalances && (
              <div className={`${balanceColor} rounded-lg border-2 p-6`}>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600 mb-2">Current Balance</p>
                  <p className={`text-3xl font-bold ${balanceTextColor} mb-1`}>
                    {formatBalance(balance)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {balance > 0 ? 'Amount owed to us' : balance < 0 ? 'Credit balance' : 'No balance'}
                  </p>
                </div>
              </div>
            )}

            {/* Edit Profile Button */}
            {canViewBalances && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Edit size={18} />
                Edit Profile
              </button>
            )}

            {/* Delete Customer Button */}
            {canAccountant && (
              <button
                onClick={handleDeleteCustomer}
                disabled={deleting}
                className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    جاري الحذف...
                  </>
                ) : (
                  <>
                    <Trash2 size={18} />
                    حذف الزبون
                  </>
                )}
              </button>
            )}

            {/* Checks Section (Compact summary) */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon size={18} className="text-gray-600" />
                  <h3 className="font-semibold text-gray-900">الشيكات الراجعة</h3>
                </div>
                <button
                  onClick={() => setIsCheckModalOpen(true)}
                  className="px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm flex items-center gap-1"
                >
                  <Plus size={14} />
                  إضافة
                </button>
              </div>
              {checks.length === 0 ? (
                <p className="text-sm text-gray-600">لا يوجد شيكات مسجلة</p>
              ) : (
                <div className="space-y-2">
                  {checks.slice(0, 3).map((chk) => (
                    <div key={chk.check_id} className="p-2 bg-gray-50 rounded border border-gray-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-gray-900">₪{(chk.amount || 0).toFixed(2)}</span>
                        <span className="text-xs text-gray-500">{chk.return_date || '—'}</span>
                      </div>
                      <div className="text-xs text-gray-700 mt-1">{chk.status}</div>
                    </div>
                  ))}
                  {checks.length > 3 && (
                    <p className="text-xs text-gray-500">و {checks.length - 3} أخرى...</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Area - Activity Timeline */}
          <div className="lg:col-span-2 space-y-6">
            {/* Interactions Section - First */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">التفاعلات والمواعيد</h2>

              {interactionItems.length === 0 ? (
                <div className="text-center py-12">
                  <Phone size={48} className="text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg">لا توجد تفاعلات</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {interactionItems.map((item, index) => {
                    const Icon = getTimelineIcon(item.type);
                    const colors = getInteractionColor(item.ptpStatus || '');
                    const uniqueKey = `interaction-${item.id || `fallback-${index}`}`;

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
                                  {item.channel || 'تفاعل'}
                                </h3>
                                {item.ptpStatus && (
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    (item.ptpStatus || '').toLowerCase() === 'active' ? 'bg-blue-100 text-blue-700' :
                                    (item.ptpStatus || '').toLowerCase() === 'fulfilled' || (item.ptpStatus || '').toLowerCase() === 'paid' ? 'bg-green-100 text-green-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {item.ptpStatus}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">
                                  {formatDate(item.date)}
                                </span>
                                <button
                                  onClick={() => handleOpenInteractionModal(item)}
                                  className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                  title="تعديل"
                                >
                                  <Edit size={16} />
                                </button>
                              </div>
                            </div>

                            {/* Notes */}
                            {item.notes && (
                              <p className="text-sm text-gray-600 mb-2">
                                {item.notes}
                              </p>
                            )}

                            {/* Status/Outcome */}
                            {item.status && (
                              <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium mb-2">
                                {item.status}
                              </span>
                            )}

                            {/* Promise Amount */}
                            {item.promiseAmount && item.promiseAmount > 0 && (
                              <p className="text-sm font-semibold text-blue-600 mb-2">
                                المبلغ المتوقع: {formatBalance(item.promiseAmount)}
                              </p>
                            )}

                            {/* Next Follow-up Date */}
                            {item.nextFollowUpDate && (
                              <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                                <Calendar size={12} />
                                <span>موعد المتابعة: {formatDate(item.nextFollowUpDate)}</span>
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

            {/* Financial Transactions (Invoices, Receipts & Payments) - Second */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">الفواتير وسندات القبض والصرف</h2>

              {financialItems.length === 0 ? (
                <div className="text-center py-12">
                  <FileText size={48} className="text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg">لا توجد فواتير أو سندات</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {financialItems.map((item, index) => {
                    const Icon = getTimelineIcon(item.type);
                    // Use different colors for warehouse invoices (darker blue) vs shop invoices (lighter blue)
                    let colors = getTimelineColor(item.type);
                    if (item.type === 'invoice' && item.source === 'Warehouse') {
                      colors = {
                        bg: 'bg-blue-100',
                        text: 'text-blue-800',
                        border: 'border-blue-500',
                        iconBg: 'bg-blue-200',
                      };
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
                                  {item.type === 'receipt' && `سند قبض المحل #${item.receiptNumber || item.id}`}
                                  {item.type === 'payment' && `سند صرف المحل #${item.paymentNumber || item.id}`}
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
                                    } else if (item.type === 'receipt') {
                                      window.open(`/admin/receipts/print/${item.id}`, `print-receipt-${item.id}`, 'noopener,noreferrer');
                                    } else if (item.type === 'payment') {
                                      window.open(`/admin/payments/print/${item.id}`, `print-payment-${item.id}`, 'noopener,noreferrer');
                                    }
                                  }}
                                  className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                  title="طباعة"
                                >
                                  <Printer size={16} />
                                </button>
                                {/* Edit Button (only for invoices) */}
                                {item.type === 'invoice' && (
                                  <button
                                    onClick={() => {
                                      if (item.source === 'Shop') {
                                        router.push(`/admin/shop-sales/edit/${item.id}`);
                                      } else if (item.source === 'Warehouse') {
                                        router.push(`/admin/warehouse-sales/edit/${item.id}`);
                                      }
                                    }}
                                    className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                    title="تعديل"
                                  >
                                    <Edit size={16} />
                                  </button>
                                )}
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
                                      return (
                                        <div key={`${uniqueKey}-item-${itemKey}-${idx}`} className="text-sm text-gray-700">
                                          <div className="font-medium text-gray-900">{itemName}</div>
                                          <div className="text-xs text-gray-500 mt-0.5">
                                            الكمية: {itemQty} × {formatBalance(itemPrice)} = {formatBalance(itemTotal)}
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

            {/* Quotations Section - Collapsible */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <details className="group">
                <summary className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">عروض الأسعار ({customerData.quotations?.length || 0})</h2>
                  <div className="text-sm text-gray-500">
                    اضغط للعرض
                  </div>
                </summary>
                <div className="px-6 pb-6 pt-2">
                  {customerData.quotations && customerData.quotations.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText size={48} className="text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 text-lg">لا توجد عروض أسعار</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {customerData.quotations.map((quotation: any, index: number) => {
                        const uniqueKey = `quotation-${quotation.QuotationID || quotation.quotation_id || `fallback-${index}`}`;
                        const quotationDate = quotation.Date || quotation.date || quotation.QuotationDate || '';
                        const quotationAmount = quotation.Total || quotation.total || quotation.Amount || quotation.amount || 0;
                        const quotationStatus = quotation.Status || quotation.status || '';

                        return (
                          <div
                            key={uniqueKey}
                            className="border-l-4 border-purple-500 pl-4 py-4 rounded-r-lg bg-purple-50 border border-purple-300 hover:shadow-sm transition-shadow"
                          >
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-purple-100 flex-shrink-0">
                                <FileText size={20} className="text-purple-700" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-gray-900">
                                      عرض سعر #{quotation.QuotationID || quotation.quotation_id || quotation.id}
                                    </h3>
                                    {quotationStatus && (
                                      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                        {quotationStatus}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">
                                      {formatDate(quotationDate)}
                                    </span>
                                    <button
                                      onClick={() => {
                                        const quotationId = quotation.QuotationID || quotation.quotation_id || quotation.id;
                                        window.open(`/admin/quotations/print/${quotationId}`, `print-quotation-${quotationId}`, 'noopener,noreferrer');
                                      }}
                                      className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                      title="طباعة"
                                    >
                                      <Printer size={16} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        const quotationId = quotation.QuotationID || quotation.quotation_id || quotation.id;
                                        router.push(`/admin/quotations/${quotationId}`);
                                      }}
                                      className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                      title="عرض/تعديل"
                                    >
                                      <Edit size={16} />
                                    </button>
                                  </div>
                                </div>

                                {/* Amount */}
                                {quotationAmount > 0 && (
                                  <p className="text-sm font-medium mb-2 text-gray-700">
                                    المبلغ: {formatBalance(quotationAmount)}
                                  </p>
                                )}

                                {/* Discounts */}
                                {(quotation.SpecialDiscount > 0 || quotation.GiftDiscount > 0) && (
                                  <div className="text-xs text-gray-600 mb-2">
                                    {quotation.SpecialDiscount > 0 && (
                                      <span>خصم خاص: {formatBalance(quotation.SpecialDiscount)}</span>
                                    )}
                                    {quotation.SpecialDiscount > 0 && quotation.GiftDiscount > 0 && <span> • </span>}
                                    {quotation.GiftDiscount > 0 && (
                                      <span>خصم هدية: {formatBalance(quotation.GiftDiscount)}</span>
                                    )}
                                  </div>
                                )}

                                {/* Notes */}
                                {quotation.Notes && (
                                  <p className="text-xs text-gray-600 mb-2">
                                    {quotation.Notes}
                                  </p>
                                )}

                                {/* Quotation Items (expandable) */}
                                {quotation.Items && quotation.Items.length > 0 && (
                                  <details className="mt-2">
                                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                      عرض {quotation.Items.length} منتج
                                    </summary>
                                    <div className="mt-2 pl-4 border-l-2 border-gray-200 space-y-2">
                                      {quotation.Items
                                        .filter((quotationItem: any) => quotationItem)
                                        .map((quotationItem: any, idx: number) => {
                                          const itemKey = quotationItem.ID || quotationItem.id || quotationItem.Name || quotationItem.name || quotationItem.product_id || `item-${idx}`;
                                          const itemName = quotationItem.Name || quotationItem.name || quotationItem.product_name || 'منتج';
                                          const itemPrice = quotationItem.Price ?? quotationItem.price ?? quotationItem.unit_price ?? 0;
                                          const itemQty = quotationItem.Quantity ?? quotationItem.quantity ?? 1;
                                          const itemTotal = itemPrice * itemQty;
                                          return (
                                            <div key={`${uniqueKey}-item-${itemKey}-${idx}`} className="text-sm text-gray-700">
                                              <div className="font-medium text-gray-900">{itemName}</div>
                                              <div className="text-xs text-gray-500 mt-0.5">
                                                الكمية: {itemQty} × {formatBalance(itemPrice)} = {formatBalance(itemTotal)}
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
              </details>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Customer Modal */}
      <CustomerFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        customer={customer}
        onSuccess={handleEditSuccess}
      />

      {/* Add/Edit Interaction Modal */}
      <AddInteractionModal
        isOpen={isInteractionModalOpen}
        onClose={handleCloseInteractionModal}
        customer={customer}
        interaction={selectedInteraction}
        onSuccess={handleInteractionSuccess}
      />

      {/* Receipt Modal */}
      <ReceiptPaymentModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        customer={customer}
        onSuccess={handleReceiptSuccess}
        type="receipt"
      />

      {/* Payment Modal */}
      <ReceiptPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        customer={customer}
        onSuccess={handlePaymentSuccess}
        type="payment"
      />

      {/* Add Check Modal */}
      {isCheckModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setIsCheckModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">إضافة شيك راجع</h3>
              <button
                onClick={() => setIsCheckModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                disabled={checkSaving}
              >
                <X size={18} className="text-gray-600" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ</label>
                <input
                  type="number"
                  value={checkForm.amount}
                  onChange={(e) => setCheckForm({ ...checkForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">صورة الوجه (رابط)</label>
                  <input
                    type="text"
                    value={checkForm.imageFront}
                    onChange={(e) => setCheckForm({ ...checkForm, imageFront: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">صورة الخلف (رابط)</label>
                  <input
                    type="text"
                    value={checkForm.imageBack}
                    onChange={(e) => setCheckForm({ ...checkForm, imageBack: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الإرجاع</label>
                  <input
                    type="date"
                    value={checkForm.returnDate}
                    onChange={(e) => setCheckForm({ ...checkForm, returnDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                  <select
                    value={checkForm.status}
                    onChange={(e) => setCheckForm({ ...checkForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  >
                    <option value="مع الشركة">مع الشركة</option>
                    <option value="في البنك">في البنك</option>
                    <option value="في المحل">في المحل</option>
                    <option value="سلم للزبون ولد يدفع">سلم للزبون ولد يدفع</option>
                    <option value="سلم للزبون وتم تسديد القيمة">سلم للزبون وتم تسديد القيمة</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
                <textarea
                  value={checkForm.notes}
                  onChange={(e) => setCheckForm({ ...checkForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setIsCheckModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={checkSaving}
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSaveCheck}
                  disabled={checkSaving}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {checkSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      حفظ الشيك
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

