'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calendar, Loader2, AlertCircle, DollarSign, FileText, History } from 'lucide-react';
import { addLegalCasePayment, deleteLegalCasePayment, getLegalCaseById, type LegalCase } from '@/lib/api';
import { useAdminAuth } from '@/context/AdminAuthContext';

interface PaymentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    caseId: string | null;
}

export default function PaymentsModal({ isOpen, onClose, caseId }: PaymentsModalProps) {
    const { admin } = useAdminAuth();
    const [legalCase, setLegalCase] = useState<LegalCase | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // New Payment Form
    const [amount, setAmount] = useState<string>('');
    const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen && caseId) {
            loadCaseData();
            // Reset form
            setAmount('');
            setPaymentDate(new Date().toISOString().split('T')[0]);
            setNotes('');
            setError(null);
        }
    }, [isOpen, caseId]);

    const loadCaseData = async () => {
        if (!caseId) return;
        try {
            setLoading(true);
            const data = await getLegalCaseById(caseId);
            setLegalCase(data);
        } catch (err: any) {
            console.error('Failed to load legal case details:', err);
            setError('فشل تحميل تفاصيل الدفعات');
        } finally {
            setLoading(false);
        }
    };

    const handleAddPayment = async () => {
        if (!caseId) return;
        const val = parseFloat(amount);
        if (!val || val <= 0) return setError('الرجاء إدخال مبلغ صحيح للدَفعة');

        if (legalCase?.remaining_amount !== undefined && val > legalCase.remaining_amount) {
            return setError('مبلغ الدفعة أكبر من المبلغ المتبقي للقضية');
        }

        try {
            setSaving(true);
            setError(null);

            await addLegalCasePayment({
                legalCaseId: caseId,
                amount: val,
                paymentDate,
                notes,
                createdBy: admin?.id,
            });

            // Refresh data
            await loadCaseData();

            // Clear form
            setAmount('');
            setNotes('');
        } catch (err: any) {
            console.error('Failed to add payment:', err);
            setError(err?.message || 'فشل إضافة الدفعة');
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePayment = async (paymentId: string) => {
        if (!confirm('هل أنت متأكد من حذف هذه الدفعة نهائياً؟')) return;
        try {
            setLoading(true);
            await deleteLegalCasePayment(paymentId);
            await loadCaseData();
        } catch (err: any) {
            console.error('Failed to delete payment:', err);
            alert('فشل حذف الدفعة');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col font-cairo" dir="rtl">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <DollarSign className="text-green-600" size={24} />
                        دفعات الملف القضائي
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 p-1 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-0">
                    {loading && !legalCase ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 size={32} className="animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            {/* Header Summary */}
                            <div className="bg-blue-50/50 p-4 border-b border-blue-100 flex flex-wrap gap-4 items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-blue-900 mb-1">
                                        قضية رقم: {legalCase?.case_number}
                                    </h3>
                                    <p className="text-sm text-blue-700">
                                        العميل: {legalCase?.customers?.name || 'غير معروف'}
                                    </p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="text-center">
                                        <div className="text-xs text-gray-500">الإجمالي</div>
                                        <div className="font-bold text-gray-900">₪{legalCase?.total_amount.toLocaleString()}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xs text-green-600">المدفوع</div>
                                        <div className="font-bold text-green-700">₪{legalCase?.paid_amount?.toLocaleString() || 0}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xs text-red-500">المتبقي</div>
                                        <div className="font-bold text-red-600">₪{legalCase?.remaining_amount?.toLocaleString() || 0}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 flex-1">
                                {error && (
                                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
                                        <AlertCircle size={18} />
                                        {error}
                                    </div>
                                )}

                                {/* Add Payment Form */}
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                                    <h4 className="font-bold text-sm text-gray-700 mb-3">إضافة دفعة جديدة</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">المبلغ</label>
                                            <input
                                                type="number"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                className="w-full px-3 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">التاريخ</label>
                                            <input
                                                type="date"
                                                value={paymentDate}
                                                onChange={(e) => setPaymentDate(e.target.value)}
                                                className="w-full px-3 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">ملاحظات (اختياري)</label>
                                            <input
                                                type="text"
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                className="w-full px-3 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm"
                                                placeholder="رقم إيصال..."
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleAddPayment}
                                        disabled={saving}
                                        className="mt-3 w-full md:w-auto px-4 py-2 bg-green-600 text-white text-sm font-bold rounded shadow-sm hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                    >
                                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                        حفظ الدفعة
                                    </button>
                                </div>

                                {/* Payments List */}
                                <div>
                                    <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">
                                        <History size={16} />
                                        سجل الدفعات السابقة
                                    </h4>
                                    {legalCase?.payments && legalCase.payments.length > 0 ? (
                                        <div className="space-y-2">
                                            {legalCase.payments.map((payment) => (
                                                <div key={payment.id} className="border border-gray-200 rounded p-3 flex items-center justify-between hover:bg-gray-50">
                                                    <div>
                                                        <div className="font-bold text-green-700 text-lg flex items-center gap-1">
                                                            ₪{Number(payment.amount).toLocaleString()}
                                                        </div>
                                                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                                            <Calendar size={12} />
                                                            {new Date(payment.payment_date).toLocaleDateString('ar-EG')}
                                                        </div>
                                                        {payment.notes && (
                                                            <div className="text-sm text-gray-600 mt-1 bg-gray-100 px-2 py-0.5 rounded inline-flex items-center gap-1">
                                                                <FileText size={12} />
                                                                {payment.notes}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeletePayment(payment.id)}
                                                        disabled={loading}
                                                        className="text-red-500 hover:text-red-700 p-2 bg-red-50 rounded-full transition-colors disabled:opacity-50"
                                                        title="حذف الدفعة"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-gray-400 border border-dashed border-gray-300 rounded-lg">
                                            لا توجد دفعات مسجلة لهذا الملف بعد
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
