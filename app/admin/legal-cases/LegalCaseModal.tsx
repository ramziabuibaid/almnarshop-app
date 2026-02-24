'use client';

import { useState, useEffect } from 'react';
import { X, Save, AlertCircle, FileText } from 'lucide-react';
import CustomerSelect from '@/components/admin/CustomerSelect';
import { createLegalCase, updateLegalCase, getAllCustomers, type LegalCase } from '@/lib/api';
import { useAdminAuth } from '@/context/AdminAuthContext';

interface LegalCaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: LegalCase | null;
}

export default function LegalCaseModal({ isOpen, onClose, onSuccess, initialData }: LegalCaseModalProps) {
    const { admin } = useAdminAuth();
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [customerId, setCustomerId] = useState('');
    const [caseNumber, setCaseNumber] = useState('');
    const [amount, setAmount] = useState<string>('');
    const [status, setStatus] = useState<'Active' | 'Closed' | 'On Hold'>('Active');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadCustomers();

            if (initialData) {
                setCustomerId(initialData.customer_id || '');
                setCaseNumber(initialData.case_number || '');
                setAmount(initialData.total_amount.toString());
                setStatus(initialData.status || 'Active');
                setNotes(initialData.notes || '');
            } else {
                setCustomerId('');
                setCaseNumber('');
                setAmount('');
                setStatus('Active');
                setNotes('');
            }
            setError(null);
        }
    }, [isOpen, initialData]);

    const loadCustomers = async () => {
        try {
            setLoading(true);
            const data = await getAllCustomers();
            setCustomers(data || []);
        } catch (err) {
            console.error('Failed to load customers:', err);
            setError('فشل تحميل قائمة العملاء');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!customerId) return setError('الرجاء اختيار العميل');
        if (!caseNumber.trim()) return setError('الرجاء إدخال رقم القضية');

        const total = parseFloat(amount);
        if (!total || total <= 0) return setError('الرجاء إدخال المبلغ الإجمالي');

        try {
            setSaving(true);
            setError(null);

            const payload = {
                caseNumber: caseNumber.trim(),
                customerId,
                totalAmount: total,
                status,
                notes,
            };

            if (initialData) {
                await updateLegalCase(initialData.id, payload);
            } else {
                await createLegalCase({ ...payload, createdBy: admin?.id });
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Failed to save legal case:', err);
            setError(err?.message || 'فشل حفظ الملف القضائي');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col font-cairo" dir="rtl">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <FileText className="text-gray-600" size={24} />
                        {initialData ? 'تعديل الملف القضائي' : 'إضافة ملف قضائي جديد'}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 p-1 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                            <AlertCircle size={20} />
                            {error}
                        </div>
                    )}

                    <div>
                        <CustomerSelect
                            value={customerId}
                            onChange={setCustomerId}
                            customers={customers}
                            placeholder="اختر العميل..."
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">رقم القضية *</label>
                        <input
                            type="text"
                            value={caseNumber}
                            onChange={(e) => setCaseNumber(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                            placeholder="مثال: 1234/2026"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ الإجمالي *</label>
                            <div className="relative">
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₪</span>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">حالة الملف</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as any)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                            >
                                <option value="Active">نشط</option>
                                <option value="On Hold">معلق</option>
                                <option value="Closed">مغلق</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات والتفاصيل</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[100px] text-gray-900"
                            placeholder="تفاصيل وطبيعة الملف القضائي..."
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium border border-gray-300"
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 font-bold shadow-sm disabled:opacity-50"
                    >
                        {saving ? 'جاري الحفظ...' : (
                            <>
                                <Save size={20} />
                                حفظ الملف
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
