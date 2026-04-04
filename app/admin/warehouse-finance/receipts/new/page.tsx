'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import CustomerSelect from '@/components/admin/CustomerSelect';
import {
  createWarehouseReceipt,
  getAllCustomers,
  getCustomerUnpaidInvoices,
  getCustomerPendingInstallments,
  VISA_MIRROR_CUSTOMER_ID,
} from '@/lib/api';
import {
  Loader2,
  Save,
  ArrowRight,
  FileText,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================
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

// ============================================================
// Form Component
// ============================================================
function ReceiptForm() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [customers, setCustomers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | null }>({ message: '', type: null });

  // Form data
  const [customerID, setCustomerID] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [cashAmount, setCashAmount] = useState('');
  const [checkAmount, setCheckAmount] = useState('');
  const [notes, setNotes] = useState('');

  // Linking
  const [linkMode, setLinkMode] = useState<LinkMode>('none');
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([]);
  const [pendingInstallments, setPendingInstallments] = useState<PendingInstallment[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<UnpaidInvoice | null>(null);
  const [selectedInstallmentIds, setSelectedInstallmentIds] = useState<Record<string, boolean>>({});
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [receiptVisaMirror, setReceiptVisaMirror] = useState(false);

  // Load customers
  useEffect(() => {
    getAllCustomers().then(setCustomers).catch(console.error);
  }, []);

  // Pre-fill from query params
  useEffect(() => {
    const qCustomer = searchParams.get('customerId');
    if (qCustomer) setCustomerID(qCustomer);
  }, [searchParams]);

  // When customer changes → load their unpaid invoices and installments
  const loadCustomerData = useCallback(async (id: string) => {
    if (!id) {
      setUnpaidInvoices([]);
      setPendingInstallments([]);
      setSelectedInvoice(null);
      setSelectedInstallmentIds({});
      return;
    }
    setLoadingInvoices(true);
    try {
      const [invoices, installments] = await Promise.all([
        getCustomerUnpaidInvoices(id, 'warehouse'),
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
    if (customerID) loadCustomerData(customerID);
  }, [customerID, loadCustomerData]);

  // Auto-fill amount when invoice or installment is selected
  useEffect(() => {
    if (selectedInvoice && linkMode === 'invoice') {
      setCashAmount(selectedInvoice.remaining.toFixed(2));
      setCheckAmount('');
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
      setCheckAmount('');
    }
  }, [selectedInstallmentIds, pendingInstallments, linkMode]);

  // Auto-select oldest due installments to cover entered payment amount.
  useEffect(() => {
    if (linkMode !== 'installment') return;
    if (!pendingInstallments.length) {
      setSelectedInstallmentIds({});
      return;
    }
    const paymentAmount = (parseFloat(cashAmount) || 0) + (parseFloat(checkAmount) || 0);
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
  }, [linkMode, pendingInstallments, cashAmount, checkAmount]);

  const handleCustomerChange = (id: string) => {
    setCustomerID(id);
    if (id === VISA_MIRROR_CUSTOMER_ID) setReceiptVisaMirror(false);
    setSelectedInvoice(null);
    setSelectedInstallmentIds({});
    setCashAmount('');
    setCheckAmount('');
    setLinkMode('none');
  };

  const handleLinkModeChange = (mode: LinkMode) => {
    setLinkMode(mode);
    setSelectedInvoice(null);
    setSelectedInstallmentIds({});
    setCashAmount('');
    setCheckAmount('');
  };

  const totalAmount = (parseFloat(cashAmount) || 0) + (parseFloat(checkAmount) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!customerID) throw new Error('يجب اختيار العميل');

      const cash = parseFloat(cashAmount) || 0;
      const check = parseFloat(checkAmount) || 0;

      if (cash <= 0 && check <= 0) throw new Error('يجب إدخال مبلغ نقدي أو شيك على الأقل');

      // Validate linked invoice amount
      if (linkMode === 'invoice' && selectedInvoice) {
        if (totalAmount > selectedInvoice.remaining + 0.01) {
          throw new Error(`المبلغ المدخل (${totalAmount.toFixed(2)} ₪) أكبر من المبلغ المتبقي (${selectedInvoice.remaining.toFixed(2)} ₪)`);
        }
      }

      const payload: Parameters<typeof createWarehouseReceipt>[0] = {
        date,
        cash_amount: cash,
        check_amount: check,
        related_party: customerID,
        notes: notes.trim() || undefined,
        created_by: admin?.id || undefined,
        linkedInvoiceId: linkMode === 'invoice' && selectedInvoice ? selectedInvoice.invoiceId : undefined,
        linkedInvoiceType: linkMode === 'invoice' && selectedInvoice ? 'warehouse' : undefined,
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
      };

      await createWarehouseReceipt(payload, admin?.username);

      setToast({ message: 'تم إنشاء سند القبض بنجاح', type: 'success' });
      setTimeout(() => router.push('/admin/warehouse-finance/cash-box'), 1500);
    } catch (err: any) {
      setError(err?.message || 'فشل إنشاء سند القبض');
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('ar-PS', { style: 'currency', currency: 'ILS' }).format(n);

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return d; }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-cairo">
              إضافة سند قبض - المستودع
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm font-cairo">
              إنشاء سند قبض جديد مع ربطه بفاتورة أو قسط كمبيالة
            </p>
          </div>
          <button
            onClick={() => router.push('/admin/warehouse-finance/cash-box')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors font-medium font-cairo"
          >
            <ArrowRight size={18} />
            العودة
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 dark:text-red-400 font-cairo">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Customer */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-5">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 font-cairo mb-4">
              بيانات الزبون
            </h2>
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
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 font-cairo">
                  ربط السند بـ
                </h2>
                {loadingInvoices && <Loader2 size={16} className="animate-spin text-gray-400" />}
                {!loadingInvoices && (
                  <button
                    type="button"
                    onClick={() => loadCustomerData(customerID)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="تحديث"
                  >
                    <RefreshCw size={15} />
                  </button>
                )}
              </div>

              {/* Mode Tabs */}
              <div className="flex gap-2 mb-4">
                {([
                  { id: 'none', label: 'بدون ربط' },
                  { id: 'invoice', label: `فاتورة (${unpaidInvoices.length})`, disabled: unpaidInvoices.length === 0 },
                  { id: 'installment', label: `قسط كمبيالة (${pendingInstallments.length})`, disabled: pendingInstallments.length === 0 },
                ] as { id: LinkMode; label: string; disabled?: boolean }[]).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    disabled={tab.disabled}
                    onClick={() => handleLinkModeChange(tab.id)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium font-cairo transition-colors border ${
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

              {/* Invoice List */}
              {linkMode === 'invoice' && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {unpaidInvoices.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-4 text-sm font-cairo">
                      لا توجد فواتير غير مدفوعة لهذا الزبون
                    </p>
                  ) : (
                    unpaidInvoices.map((inv) => (
                      <button
                        key={inv.invoiceId}
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className={`w-full text-right p-3 rounded-lg border transition-all ${
                          selectedInvoice?.invoiceId === inv.invoiceId
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-gray-400" />
                            <span className="font-medium text-gray-900 dark:text-gray-100 font-cairo text-sm">
                              {inv.invoiceId}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-cairo ${
                              inv.status === 'مدفوع جزئي'
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            }`}>
                              {inv.status}
                            </span>
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-bold text-red-600 dark:text-red-400 font-cairo">
                              {formatCurrency(inv.remaining)} متبقي
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-cairo">
                              الإجمالي: {formatCurrency(inv.totalAmount)}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 mt-1 font-cairo">
                          {formatDate(inv.date)}
                          {inv.totalPaid > 0 && ` · مدفوع: ${formatCurrency(inv.totalPaid)}`}
                        </div>
                        {/* Progress bar */}
                        <div className="mt-2 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (inv.totalPaid / inv.totalAmount) * 100)}%` }}
                          />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Installment List */}
              {linkMode === 'installment' && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {pendingInstallments.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-4 text-sm font-cairo">
                      لا توجد أقساط مستحقة لهذا الزبون
                    </p>
                  ) : (
                    pendingInstallments.map((inst) => (
                      <button
                        key={inst.installmentId}
                        type="button"
                        onClick={() =>
                          setSelectedInstallmentIds(prev => ({
                            ...prev,
                            [inst.installmentId]: !prev[inst.installmentId],
                          }))
                        }
                        className={`w-full text-right p-3 rounded-lg border transition-all ${
                          selectedInstallmentIds[inst.installmentId]
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CreditCard size={16} className="text-gray-400" />
                            <span className="font-medium text-gray-900 dark:text-gray-100 font-cairo text-sm">
                              قسط كمبيالة
                            </span>
                            {inst.linkedInvoiceId && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-cairo">
                                {inst.linkedInvoiceId}
                              </span>
                            )}
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-bold text-orange-600 dark:text-orange-400 font-cairo">
                              {formatCurrency(inst.remaining)} متبقي
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-cairo">
                              القسط: {formatCurrency(inst.amount)}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 mt-1 font-cairo">
                          الاستحقاق: {formatDate(inst.dueDate)}
                          {inst.paidAmount > 0 && ` · مدفوع: ${formatCurrency(inst.paidAmount)}`}
                        </div>
                        {/* Progress bar */}
                        {inst.paidAmount > 0 && (
                          <div className="mt-2 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${Math.min(100, (inst.paidAmount / inst.amount) * 100)}%` }}
                            />
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Selected Summary */}
              {linkMode === 'invoice' && selectedInvoice && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-300 font-cairo">
                      تم اختيار الفاتورة {selectedInvoice.invoiceId} · المتبقي: {formatCurrency(selectedInvoice.remaining)}
                    </span>
                  </div>
                </div>
              )}
              {linkMode === 'installment' && Object.values(selectedInstallmentIds).some(Boolean) && (
                <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-orange-600 dark:text-orange-400" />
                    <span className="text-sm font-medium text-orange-800 dark:text-orange-300 font-cairo">
                      تم تحديد {pendingInstallments.filter(i => selectedInstallmentIds[i.installmentId]).length} أقساط تلقائياً حسب قيمة الدفعة
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Amounts + Date */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-5 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 font-cairo">
              المبالغ والتاريخ
            </h2>

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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 font-cairo">
                  المبلغ النقدي (₪)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-800"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 font-cairo">
                  المبلغ بالشيك (₪)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={checkAmount}
                  onChange={(e) => setCheckAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-800"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Total */}
            {totalAmount > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-slate-700">
                <span className="text-sm text-gray-600 dark:text-gray-400 font-cairo">إجمالي السند</span>
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100 font-cairo">
                  {formatCurrency(totalAmount)}
                </span>
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
                  <> — إنشاء سند صرف للمستودع لزبون فيزا ({VISA_MIRROR_CUSTOMER_ID}) بنفس المبلغ والتاريخ</>
                )}
              </span>
            </label>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 font-cairo">
                ملاحظات
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-800 resize-none font-cairo"
                placeholder="أي ملاحظات إضافية..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/admin/warehouse-finance/cash-box')}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors font-medium disabled:opacity-50 font-cairo"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !customerID}
              className="flex-1 px-4 py-2.5 bg-gray-900 dark:bg-slate-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-slate-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-cairo"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save size={16} />
                  حفظ سند القبض
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Toast */}
      {toast.type && (
        <div className="fixed bottom-4 right-4 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl bg-emerald-600 text-white">
            <CheckCircle2 size={18} />
            <span className="font-medium font-cairo">{toast.message}</span>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default function NewWarehouseReceiptPage() {
  return (
    <Suspense
      fallback={
        <AdminLayout>
          <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
            <Loader2 size={40} className="animate-spin text-gray-400" />
          </div>
        </AdminLayout>
      }
    >
      <ReceiptForm />
    </Suspense>
  );
}
