'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import CustomerSelect from '@/components/admin/CustomerSelect';
import {
  getShopReceipts,
  saveShopReceipt,
  getAllCustomers,
  getCustomerUnpaidInvoices,
  getCustomerPendingInstallments,
  VISA_MIRROR_CUSTOMER_ID,
} from '@/lib/api';
import { fixPhoneNumber } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { Lock } from 'lucide-react';
import {
  Loader2,
  FileText,
  Search,
  Printer,
  Plus,
  X,
  Save,
  Edit,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  CreditCard,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface ShopReceipt {
  ReceiptID: string;
  CustomerID: string;
  CustomerName: string;
  Date: string;
  CashAmount: number;
  ChequeAmount: number;
  TotalAmount: number;
  Notes?: string;
  CreatedAt?: string;
}

interface UnpaidInvoice {
  invoiceId: string;
  date: string;
  totalAmount: number;
  totalPaid: number;
  remaining: number;
  status: string;
}

interface PendingInstallment {
  installmentId: string;
  noteId: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  remaining: number;
  noteTotal: number;
  linkedInvoiceId?: string;
  linkedInvoiceType?: string;
}

type LinkMode = 'none' | 'invoice' | 'installment';

function ReceiptsPageContent() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [receipts, setReceipts] = useState<ShopReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalReceipts, setTotalReceipts] = useState(0);
  const RECEIPTS_PER_PAGE = 20;

  const canAccessReceipts = admin?.is_super_admin || admin?.permissions?.accessReceipts === true;

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [customerID, setCustomerID] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [cashAmount, setCashAmount] = useState('');
  const [chequeAmount, setChequeAmount] = useState('');
  const [notes, setNotes] = useState('');

  // Linking
  const [linkMode, setLinkMode] = useState<LinkMode>('none');
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([]);
  const [pendingInstallments, setPendingInstallments] = useState<PendingInstallment[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<UnpaidInvoice | null>(null);
  const [selectedInstallmentIds, setSelectedInstallmentIds] = useState<Record<string, boolean>>({});
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [initializedFromQuery, setInitializedFromQuery] = useState(false);
  const [receiptVisaMirror, setReceiptVisaMirror] = useState(false);

  useEffect(() => {
    document.title = 'سندات القبض - Receipts';
  }, []);

  useEffect(() => {
    loadReceipts(1);
    loadCustomers();
  }, []);

  useEffect(() => {
    if (currentPage > 0) loadReceipts(currentPage);
  }, [currentPage]);

  useEffect(() => {
    if (initializedFromQuery) return;

    const shouldOpenNew = searchParams.get('openNew') === '1';
    const queryCustomerId = (searchParams.get('customerId') || '').trim();
    if (!shouldOpenNew) return;

    setCustomerID('');
    setDate(new Date().toISOString().split('T')[0]);
    setCashAmount('');
    setChequeAmount('');
    setNotes('');
    setLinkMode('none');
    setSelectedInvoice(null);
    setSelectedInstallmentIds({});
    setUnpaidInvoices([]);
    setPendingInstallments([]);
    setReceiptVisaMirror(false);
    if (queryCustomerId) {
      setCustomerID(queryCustomerId);
    }
    setIsModalOpen(true);
    setInitializedFromQuery(true);
  }, [searchParams, initializedFromQuery]);

  const loadReceipts = async (page: number = currentPage) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getShopReceipts(page, RECEIPTS_PER_PAGE);
      setReceipts(result.receipts);
      setTotalReceipts(result.total);
    } catch (err: any) {
      setError(err?.message || 'فشل تحميل سندات القبض');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await getAllCustomers();
      setCustomers(data);
    } catch {}
  };

  // Load customer invoices & installments when customer changes
  const loadCustomerData = useCallback(async (id: string) => {
    if (!id) {
      setUnpaidInvoices([]);
      setPendingInstallments([]);
      return;
    }
    setLoadingInvoices(true);
    try {
      const [invoices, installments] = await Promise.all([
        getCustomerUnpaidInvoices(id, 'shop'),
        getCustomerPendingInstallments(id),
      ]);
      setUnpaidInvoices(invoices);
      setPendingInstallments(installments);
    } catch (e) {
      console.error('Failed to load customer data:', e);
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  useEffect(() => {
    if (customerID && isModalOpen) loadCustomerData(customerID);
  }, [customerID, isModalOpen, loadCustomerData]);

  // Auto-fill amount
  useEffect(() => {
    if (selectedInvoice && linkMode === 'invoice') {
      setCashAmount(selectedInvoice.remaining.toFixed(2));
      setChequeAmount('');
    }
  }, [selectedInvoice, linkMode]);

  useEffect(() => {
    if (linkMode === 'installment') {
      const selected = pendingInstallments.filter((inst) => selectedInstallmentIds[inst.installmentId]);
      if (!selected.length) return;
      const totalSelectedRemaining = selected.reduce((sum, inst) => sum + (inst.remaining || 0), 0);
      if (totalSelectedRemaining > 0) {
        setCashAmount(totalSelectedRemaining.toFixed(2));
      }
      setChequeAmount('');
    }
  }, [selectedInstallmentIds, pendingInstallments, linkMode]);

  // Auto-select oldest due installments to cover entered payment amount.
  useEffect(() => {
    if (linkMode !== 'installment') return;
    if (!pendingInstallments.length) {
      setSelectedInstallmentIds({});
      return;
    }
    const paymentAmount = (parseFloat(cashAmount) || 0) + (parseFloat(chequeAmount) || 0);
    if (paymentAmount <= 0) {
      setSelectedInstallmentIds({});
      return;
    }

    let remainingToCover = paymentAmount;
    const autoSelected: Record<string, boolean> = {};
    const sorted = [...pendingInstallments].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    for (const inst of sorted) {
      if (remainingToCover <= 0) break;
      if ((inst.remaining || 0) <= 0) continue;
      autoSelected[inst.installmentId] = true;
      remainingToCover -= inst.remaining;
    }
    setSelectedInstallmentIds(autoSelected);
  }, [linkMode, pendingInstallments, cashAmount, chequeAmount]);

  const resetForm = () => {
    setCustomerID('');
    setDate(new Date().toISOString().split('T')[0]);
    setCashAmount('');
    setChequeAmount('');
    setNotes('');
    setLinkMode('none');
    setSelectedInvoice(null);
    setSelectedInstallmentIds({});
    setUnpaidInvoices([]);
    setPendingInstallments([]);
    setReceiptVisaMirror(false);
  };

  const handleAddNew = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleCustomerChange = (id: string) => {
    setCustomerID(id);
    if (id === VISA_MIRROR_CUSTOMER_ID) setReceiptVisaMirror(false);
    setSelectedInvoice(null);
    setSelectedInstallmentIds({});
    setCashAmount('');
    setChequeAmount('');
    setLinkMode('none');
  };

  const handleLinkModeChange = (mode: LinkMode) => {
    setLinkMode(mode);
    setSelectedInvoice(null);
    setSelectedInstallmentIds({});
    setCashAmount('');
    setChequeAmount('');
  };

  const totalAmount = (parseFloat(cashAmount) || 0) + (parseFloat(chequeAmount) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!customerID) throw new Error('يجب اختيار العميل');

      const cash = parseFloat(cashAmount) || 0;
      const cheque = parseFloat(chequeAmount) || 0;
      if (cash <= 0 && cheque <= 0) throw new Error('يجب إدخال مبلغ نقدي أو شيك على الأقل');

      if (linkMode === 'invoice' && selectedInvoice && totalAmount > selectedInvoice.remaining + 0.01) {
        throw new Error(`المبلغ (${totalAmount.toFixed(2)} ₪) أكبر من المتبقي (${selectedInvoice.remaining.toFixed(2)} ₪)`);
      }

      const payload: Parameters<typeof saveShopReceipt>[0] = {
        customerID,
        date,
        cashAmount: cash,
        chequeAmount: cheque,
        notes: notes.trim() || undefined,
        linkedInvoiceId: linkMode === 'invoice' && selectedInvoice ? selectedInvoice.invoiceId : undefined,
        linkedInvoiceType: linkMode === 'invoice' && selectedInvoice ? 'shop' : undefined,
        linkedInstallmentId: undefined,
        installmentAllocations: linkMode === 'installment'
          ? (() => {
              const sorted = [...pendingInstallments]
                .filter((inst) => selectedInstallmentIds[inst.installmentId])
                .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
              let remainingToAllocate = totalAmount;
              const allocations: { installmentId: string; amount: number }[] = [];
              for (const inst of sorted) {
                if (remainingToAllocate <= 0) break;
                const alloc = Math.min(remainingToAllocate, inst.remaining || 0);
                if (alloc > 0) {
                  allocations.push({ installmentId: inst.installmentId, amount: alloc });
                  remainingToAllocate -= alloc;
                }
              }
              return allocations.length ? allocations : undefined;
            })()
          : undefined,
        invoiceTotalAmount: linkMode === 'invoice' && selectedInvoice ? selectedInvoice.totalAmount : undefined,
        visaMirror: receiptVisaMirror,
        created_by: admin?.id || undefined,
      };

      await saveShopReceipt(payload, admin?.username);
      setIsModalOpen(false);
      resetForm();
      loadReceipts();
    } catch (err: any) {
      setError(err?.message || 'فشل حفظ سند القبض');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReceipt = (receipt: ShopReceipt) => {
    window.open(`/admin/receipts/print/${receipt.ReceiptID}`, `print-receipt-${receipt.ReceiptID}`, 'noopener,noreferrer');
  };

  const handleWhatsApp = async (receipt: ShopReceipt, countryCode: '970' | '972') => {
    try {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('phone, balance, name')
        .eq('customer_id', receipt.CustomerID)
        .single();
      if (customerError || !customer) { alert('فشل جلب بيانات العميل'); return; }
      const customerPhone = customer.phone || '';
      if (!customerPhone.trim()) { alert('لا يوجد رقم هاتف للعميل'); return; }
      const fixedPhone = fixPhoneNumber(customerPhone);
      const getLocalNumber = (p: string) => { const c = p.trim().replace(/\s+/g, '').replace(/-/g, ''); return c.startsWith('0') ? c.substring(1) : c; };
      const whatsappNumber = `${countryCode}${getLocalNumber(fixedPhone)}`;
      const customerBalance = parseFloat(String(customer.balance || 0));
      const balanceText = customerBalance > 0 ? `وتبقى عليه ${customerBalance.toFixed(2)} ₪` : customerBalance < 0 ? `ورصيده ${Math.abs(customerBalance).toFixed(2)} ₪ (دائن)` : 'ورصيده صفر';
      const message = `السلام عليكم ورحمة الله وبركاته\n\nتم استلام مبلغ ${receipt.TotalAmount.toFixed(2)} ₪ كدفعة منكم\n${balanceText}\n\nرقم السند: ${receipt.ReceiptID}\nالتاريخ: ${formatDate(receipt.Date)}\n\nشكراً لكم`;
      window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      alert(`فشل إرسال رسالة واتساب: ${error?.message || 'خطأ غير معروف'}`);
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit', numberingSystem: 'latn' }); }
    catch { return '—'; }
  };

  const formatDateShort = (d: string) => {
    try { return new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return d; }
  };

  const formatCurrency = (amount: number | undefined | null) => {
    if (!amount || amount === 0) return '₪0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2 }).format(amount);
  };

  const filteredReceipts = useMemo(() => {
    if (searchQuery.trim()) {
      const words = searchQuery.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
      return receipts.filter(r => {
        const text = `${r.ReceiptID} ${r.CustomerName} ${r.CustomerID}`.toLowerCase();
        return words.every(w => text.includes(w));
      });
    }
    return receipts;
  }, [receipts, searchQuery]);

  const totalPages = Math.ceil((searchQuery.trim() ? filteredReceipts.length : totalReceipts) / RECEIPTS_PER_PAGE);
  const startIndex = (currentPage - 1) * RECEIPTS_PER_PAGE;
  const endIndex = startIndex + RECEIPTS_PER_PAGE;
  const paginatedReceipts = searchQuery.trim() ? filteredReceipts.slice(startIndex, endIndex) : filteredReceipts;

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  if (!canAccessReceipts) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Lock size={48} className="text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 text-lg mb-2 font-cairo">ليس لديك صلاحية للوصول إلى صفحة سندات القبض</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-cairo">يرجى التواصل مع المشرف للحصول على الصلاحية</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">جاري تحميل سندات القبض...</p>
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">سندات قبض المحل</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              إدارة سندات قبض المحل ({searchQuery.trim() ? filteredReceipts.length : totalReceipts} سند)
            </p>
          </div>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-slate-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-slate-600 transition-colors font-medium"
          >
            <Plus size={20} />
            إضافة سند جديد
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Search */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="relative">
            <Search size={20} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="بحث برقم السند أو اسم العميل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Table */}
        {filteredReceipts.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-12 text-center">
            <FileText size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 text-lg">لا توجد سندات قبض</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    {['رقم السند', 'العميل', 'التاريخ', 'نقدي', 'شيك', 'الإجمالي', 'الإجراءات'].map(h => (
                      <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedReceipts.map((receipt) => (
                    <tr key={receipt.ReceiptID} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{receipt.ReceiptID}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey) { window.open(`/admin/customers/${receipt.CustomerID}`, '_blank', 'noopener,noreferrer'); return; } router.push(`/admin/customers/${receipt.CustomerID}`); }}
                          onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); window.open(`/admin/customers/${receipt.CustomerID}`, '_blank', 'noopener,noreferrer'); } }}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                        >
                          {receipt.CustomerName || receipt.CustomerID}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right"><div className="text-gray-600 dark:text-gray-400">{formatDate(receipt.Date)}</div></td>
                      <td className="px-4 py-3 text-right"><div className="text-gray-900 dark:text-gray-100">{formatCurrency(receipt.CashAmount)}</div></td>
                      <td className="px-4 py-3 text-right"><div className="text-gray-900 dark:text-gray-100">{formatCurrency(receipt.ChequeAmount)}</div></td>
                      <td className="px-4 py-3 text-right"><div className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(receipt.TotalAmount)}</div></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => router.push(`/admin/receipts/edit/${receipt.ReceiptID}`)} className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="تعديل"><Edit size={18} /></button>
                          <button onClick={() => handlePrintReceipt(receipt)} className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="طباعة"><Printer size={18} /></button>
                          <div className="relative group">
                            <button className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 rounded-lg transition-colors" title="إرسال واتساب"><MessageCircle size={18} /></button>
                            <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                              <div className="p-2 space-y-1">
                                <button onClick={() => handleWhatsApp(receipt, '970')} className="w-full flex items-center gap-2 px-3 py-2 text-right text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"><MessageCircle size={16} className="text-green-600" /><span className="flex-1">واتساب: 970</span></button>
                                <button onClick={() => handleWhatsApp(receipt, '972')} className="w-full flex items-center gap-2 px-3 py-2 text-right text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"><MessageCircle size={16} className="text-green-600" /><span className="flex-1">واتساب: 972</span></button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="bg-gray-50 dark:bg-slate-800/50 px-4 py-3 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  عرض {startIndex + 1} إلى {Math.min(endIndex, searchQuery.trim() ? filteredReceipts.length : totalReceipts)} من {searchQuery.trim() ? filteredReceipts.length : totalReceipts} سند
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><ChevronRight size={18} /></button>
                  <div className="text-sm text-gray-700 dark:text-gray-300">صفحة {currentPage} من {totalPages}</div>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><ChevronLeft size={18} /></button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ====================== ADD RECEIPT MODAL ====================== */}
      {isModalOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => { if (!isSubmitting) { setIsModalOpen(false); resetForm(); } }} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10 rounded-t-xl">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 font-cairo">إضافة سند قبض جديد</h2>
                <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors" disabled={isSubmitting}>
                  <X size={20} className="text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              {/* Error inside modal */}
              {error && (
                <div className="mx-6 mt-4 flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-red-700 dark:text-red-400 text-sm font-cairo">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Customer */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 font-cairo">
                    الزبون <span className="text-red-500">*</span>
                  </label>
                  <CustomerSelect
                    value={customerID}
                    onChange={handleCustomerChange}
                    customers={customers}
                    placeholder="اختر الزبون"
                    required
                  />
                </div>

                {/* Invoice / Installment Linking */}
                {customerID && (
                  <div className="border border-gray-200 dark:border-slate-600 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-cairo">ربط السند بـ</h3>
                      <div className="flex items-center gap-2">
                        {loadingInvoices && <Loader2 size={14} className="animate-spin text-gray-400" />}
                        {!loadingInvoices && (
                          <button type="button" onClick={() => loadCustomerData(customerID)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="تحديث">
                            <RefreshCw size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2">
                      {([
                        { id: 'none' as LinkMode, label: 'بدون ربط' },
                        { id: 'invoice' as LinkMode, label: `فاتورة (${unpaidInvoices.length})`, disabled: unpaidInvoices.length === 0 },
                        { id: 'installment' as LinkMode, label: `قسط (${pendingInstallments.length})`, disabled: pendingInstallments.length === 0 },
                      ]).map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          disabled={tab.disabled}
                          onClick={() => handleLinkModeChange(tab.id)}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium font-cairo transition-colors border ${
                            tab.disabled
                              ? 'opacity-40 cursor-not-allowed border-gray-200 dark:border-slate-600 text-gray-400'
                              : linkMode === tab.id
                              ? 'bg-gray-900 dark:bg-slate-700 text-white border-gray-900 dark:border-slate-700'
                              : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Invoice list */}
                    {linkMode === 'invoice' && (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {unpaidInvoices.map(inv => (
                          <button
                            key={inv.invoiceId}
                            type="button"
                            onClick={() => setSelectedInvoice(inv)}
                            className={`w-full text-right p-2.5 rounded-lg border transition-all text-sm ${
                              selectedInvoice?.invoiceId === inv.invoiceId
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-slate-600 hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700/30'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <FileText size={13} className="text-gray-400" />
                                <span className="font-medium text-gray-900 dark:text-gray-100 font-cairo text-xs">{inv.invoiceId}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${inv.status === 'مدفوع جزئي' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{inv.status}</span>
                              </div>
                              <span className="text-xs font-bold text-red-600 dark:text-red-400 font-cairo">{formatCurrency(inv.remaining)}</span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-gray-400 font-cairo">{formatDateShort(inv.date)}</span>
                              <span className="text-xs text-gray-400 font-cairo">إجمالي: {formatCurrency(inv.totalAmount)}</span>
                            </div>
                            <div className="mt-1.5 h-1 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (inv.totalPaid / inv.totalAmount) * 100)}%` }} />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Installment list */}
                    {linkMode === 'installment' && (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {pendingInstallments.map(inst => (
                          <button
                            key={inst.installmentId}
                            type="button"
                            onClick={() =>
                              setSelectedInstallmentIds(prev => ({
                                ...prev,
                                [inst.installmentId]: !prev[inst.installmentId],
                              }))
                            }
                            className={`w-full text-right p-2.5 rounded-lg border transition-all text-sm ${
                              selectedInstallmentIds[inst.installmentId]
                                ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
                                : 'border-gray-200 dark:border-slate-600 hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700/30'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <CreditCard size={13} className="text-gray-400" />
                                <span className="font-medium text-gray-900 dark:text-gray-100 font-cairo text-xs">قسط كمبيالة</span>
                                {inst.linkedInvoiceId && (
                                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{inst.linkedInvoiceId}</span>
                                )}
                              </div>
                              <span className="text-xs font-bold text-orange-600 dark:text-orange-400 font-cairo">{formatCurrency(inst.remaining)}</span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-gray-400 font-cairo">استحقاق: {formatDateShort(inst.dueDate)}</span>
                              <span className="text-xs text-gray-400 font-cairo">القسط: {formatCurrency(inst.amount)}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Selection confirmation */}
                    {linkMode === 'invoice' && selectedInvoice && (
                      <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <CheckCircle2 size={14} className="text-blue-600 text-blue-400" />
                        <span className="text-xs font-medium text-blue-800 dark:text-blue-300 font-cairo">
                          ✓ الفاتورة {selectedInvoice.invoiceId} · المتبقي: {formatCurrency(selectedInvoice.remaining)}
                        </span>
                      </div>
                    )}
                    {linkMode === 'installment' && Object.values(selectedInstallmentIds).some(Boolean) && (
                      <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                        <CheckCircle2 size={14} className="text-orange-600 dark:text-orange-400" />
                        <span className="text-xs font-medium text-orange-800 dark:text-orange-300 font-cairo">
                          ✓ تم تحديد {pendingInstallments.filter(i => selectedInstallmentIds[i.installmentId]).length} أقساط تلقائياً حسب قيمة الدفعة
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 font-cairo">
                    التاريخ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-800"
                    required
                  />
                </div>

                {/* Amounts */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 font-cairo">المبلغ النقدي</label>
                    <input
                      type="number" step="0.01" min="0" value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-800"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 font-cairo">المبلغ بالشيك</label>
                    <input
                      type="number" step="0.01" min="0" value={chequeAmount}
                      onChange={(e) => setChequeAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-800"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Total */}
                {totalAmount > 0 && (
                  <div className="flex items-center justify-between py-2 border-t border-gray-200 dark:border-slate-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-cairo">إجمالي السند</span>
                    <span className="text-base font-bold text-gray-900 dark:text-gray-100 font-cairo">{formatCurrency(totalAmount)}</span>
                  </div>
                )}

                <label className={`flex items-start gap-3 p-3 rounded-lg border text-sm font-cairo cursor-pointer ${customerID === VISA_MIRROR_CUSTOMER_ID ? 'border-amber-200 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-900/20' : 'border-gray-200 dark:border-slate-600 bg-gray-50/80 dark:bg-slate-700/30'}`}>
                  <input
                    type="checkbox"
                    checked={receiptVisaMirror}
                    onChange={(e) => setReceiptVisaMirror(e.target.checked)}
                    disabled={customerID === VISA_MIRROR_CUSTOMER_ID}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50"
                  />
                  <span className="text-gray-800 dark:text-gray-200 leading-relaxed">
                    <span className="font-semibold">فيزا</span>
                    {customerID === VISA_MIRROR_CUSTOMER_ID ? (
                      <> — غير متاح للزبون {VISA_MIRROR_CUSTOMER_ID}</>
                    ) : (
                      <> — إنشاء سند صرف للمحل لزبون فيزا ({VISA_MIRROR_CUSTOMER_ID}) بنفس المبلغ والتاريخ</>
                    )}
                  </span>
                </label>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 font-cairo">ملاحظات</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-800 resize-none font-cairo"
                    placeholder="ملاحظات إضافية..."
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setIsModalOpen(false); resetForm(); }}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors font-medium disabled:opacity-50 font-cairo"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !customerID}
                    className="flex-1 px-4 py-2 bg-gray-900 dark:bg-slate-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-slate-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-cairo"
                  >
                    {isSubmitting ? (
                      <><Loader2 size={16} className="animate-spin" />جاري الحفظ...</>
                    ) : (
                      <><Save size={16} />حفظ السند</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}

export default function ReceiptsPage() {
  return (
    <Suspense
      fallback={
        <AdminLayout>
          <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
            <div className="text-center">
              <Loader2 size={48} className="animate-spin text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">جاري تحميل سندات القبض...</p>
            </div>
          </div>
        </AdminLayout>
      }
    >
      <ReceiptsPageContent />
    </Suspense>
  );
}
