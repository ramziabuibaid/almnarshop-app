'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, Calculator, AlertCircle, Loader2 } from 'lucide-react';
import CustomerSelect from '@/components/admin/CustomerSelect';
import { createPromissoryNote, getAllCustomers } from '@/lib/api';

interface PromissoryNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function PromissoryNoteModal({ isOpen, onClose, onSuccess }: PromissoryNoteModalProps) {
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [customerId, setCustomerId] = useState('');
    const [amount, setAmount] = useState<string>('');
    const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');

    // Installment Config
    const [installmentCount, setInstallmentCount] = useState<string>('1');
    const [installmentAmount, setInstallmentAmount] = useState<string>('');
    const [calculationMethod, setCalculationMethod] = useState<'byCount' | 'byAmount'>('byCount');

    // Preview
    const [previewInstallments, setPreviewInstallments] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen) {
            loadCustomers();
            // Reset form
            setCustomerId('');
            setAmount('');
            setStartDate(new Date().toISOString().split('T')[0]);
            setNotes('');
            setInstallmentCount('1');
            setInstallmentAmount('');
            setPreviewInstallments([]);
            setError(null);
        }
    }, [isOpen]);

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

    // Calculate installments preview
    useEffect(() => {
        calculateInstallments();
    }, [amount, startDate, installmentCount, installmentAmount, calculationMethod]);

    const calculateInstallments = () => {
        const total = parseFloat(amount);
        if (!total || total <= 0) {
            setPreviewInstallments([]);
            return;
        }

        let count = 0;
        let amountPerInst = 0;

        if (calculationMethod === 'byCount') {
            count = parseInt(installmentCount);
            if (!count || count <= 0) return;
            amountPerInst = total / count;
        } else {
            amountPerInst = parseFloat(installmentAmount);
            if (!amountPerInst || amountPerInst <= 0) return;
            count = Math.ceil(total / amountPerInst);
        }

        const installments = [];
        let currentTotal = 0;
        const start = new Date(startDate);

        for (let i = 0; i < count; i++) {
            const dueDate = new Date(start);
            dueDate.setMonth(dueDate.getMonth() + i);

            let instAmount = amountPerInst;

            // Adjust last installment to match total exactly
            if (i === count - 1) {
                instAmount = total - currentTotal;
            }

            // Round to 2 decimals
            instAmount = Math.round(instAmount * 100) / 100;
            currentTotal += instAmount;

            installments.push({
                id: i,
                amount: instAmount,
                dueDate: dueDate.toISOString().split('T')[0],
                notes: `قسط رقم ${i + 1} من ${count}`
            });
        }

        setPreviewInstallments(installments);
    };

    const handleSave = async () => {
        if (!customerId) return setError('الرجاء اختيار العميل');
        if (!amount || parseFloat(amount) <= 0) return setError('الرجاء إدخال المبلغ الإجمالي');
        if (previewInstallments.length === 0) return setError('الرجاء التأكد من إعدادات الأقساط');

        try {
            setSaving(true);
            setError(null);

            await createPromissoryNote({
                customerId,
                totalAmount: parseFloat(amount),
                issueDate: startDate,
                notes,
                installments: previewInstallments.map(inst => ({
                    amount: inst.amount,
                    dueDate: inst.dueDate,
                    notes: inst.notes
                }))
            });

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Failed to save promissory note:', err);
            setError(err?.message || 'فشل حفظ الكمبيالة');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col font-cairo" dir="rtl">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Calculator className="text-gray-600" size={24} />
                        إضافة كمبيالة جديدة
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 p-1 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                            <AlertCircle size={20} />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Form Side */}
                        <div className="space-y-6">
                            <div>
                                <CustomerSelect
                                    value={customerId}
                                    onChange={setCustomerId}
                                    customers={customers}
                                    placeholder="اختر العميل..."
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ الإجمالي</label>
                                    <div className="relative">
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₪</span>
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-400 font-medium"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ البدء</label>
                                    <div className="relative">
                                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-400 font-medium"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <label className="block text-sm font-medium text-blue-900 mb-3">طريقة تقسيم الأقساط</label>
                                <div className="flex items-center gap-4 mb-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={calculationMethod === 'byCount'}
                                            onChange={() => setCalculationMethod('byCount')}
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">عدد الأقساط</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={calculationMethod === 'byAmount'}
                                            onChange={() => setCalculationMethod('byAmount')}
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">قيمة القسط</span>
                                    </label>
                                </div>

                                {calculationMethod === 'byCount' ? (
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">عدد الأقساط الشهرية</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={installmentCount}
                                            onChange={(e) => setInstallmentCount(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium"
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">قيمة القسط الشهري</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={installmentAmount}
                                            onChange={(e) => setInstallmentAmount(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium"
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[80px] text-gray-900 placeholder:text-gray-400 font-medium"
                                    placeholder="ملاحظات إضافية..."
                                />
                            </div>
                        </div>

                        {/* Preview Side */}
                        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-gray-200 bg-gray-100 font-medium text-gray-700 flex justify-between items-center">
                                <span>جدول الأقساط المتوقع</span>
                                <span className="text-sm bg-white px-2 py-1 rounded border border-gray-300">
                                    {previewInstallments.length} أقساط
                                </span>
                            </div>
                            <div className="overflow-y-auto flex-1 p-2 space-y-2 max-h-[400px]">
                                {previewInstallments.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                                        <Calendar size={40} className="mb-2 opacity-50" />
                                        <p>أدخل البيانات لعرض الجدول</p>
                                    </div>
                                ) : (
                                    previewInstallments.map((inst) => (
                                        <div key={inst.id} className="bg-white p-3 rounded-lg border border-gray-200 flex justify-between items-center shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                                                    {inst.id + 1}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{inst.dueDate}</div>
                                                    <div className="text-xs text-gray-500">{inst.notes}</div>
                                                </div>
                                            </div>
                                            <div className="font-bold text-gray-900">
                                                ₪{inst.amount.toFixed(2)}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            {previewInstallments.length > 0 && (
                                <div className="p-4 bg-gray-100 border-t border-gray-200 flex justify-between items-center font-bold text-gray-900 text-lg">
                                    <span>الإجمالي</span>
                                    <span>₪{previewInstallments.reduce((sum, i) => sum + i.amount, 0).toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors font-medium"
                        disabled={saving}
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || previewInstallments.length === 0}
                        className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                جاري الحفظ...
                            </>
                        ) : (
                            'حفظ الكمبيالة'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
