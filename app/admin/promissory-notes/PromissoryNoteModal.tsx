'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, Calculator, AlertCircle, Loader2, History, Camera } from 'lucide-react';
import CustomerSelect from '@/components/admin/CustomerSelect';
import { createPromissoryNote, updatePromissoryNote, getAllCustomers, type PromissoryNote } from '@/lib/api';
import { useAdminAuth } from '@/context/AdminAuthContext';
import imageCompression from 'browser-image-compression';

interface PromissoryNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: PromissoryNote | null;
}

export default function PromissoryNoteModal({ isOpen, onClose, onSuccess, initialData }: PromissoryNoteModalProps) {
    const { admin } = useAdminAuth();
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [customerId, setCustomerId] = useState('');
    const [amount, setAmount] = useState<string>('');
    const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [debtorIdNumber, setDebtorIdNumber] = useState('');
    const [debtorAddress, setDebtorAddress] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);

    // Legacy Note State
    const [isLegacy, setIsLegacy] = useState(false);
    const [paidAmount, setPaidAmount] = useState<string>('');

    // Installment Config
    const [installmentCount, setInstallmentCount] = useState<string>('1');
    const [installmentAmount, setInstallmentAmount] = useState<string>('');
    const [calculationMethod, setCalculationMethod] = useState<'byCount' | 'byAmount'>('byCount');
    const [installmentInterval, setInstallmentInterval] = useState<'monthly' | 'weekly'>('monthly');

    // Preview
    const [previewInstallments, setPreviewInstallments] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen) {
            loadCustomers();

            if (initialData) {
                // Edit Mode: Pre-fill data
                setCustomerId(initialData.customer_id || '');
                setAmount(initialData.total_amount.toString());
                setStartDate(initialData.issue_date);
                setNotes(initialData.notes || '');
                setDebtorIdNumber(initialData.debtor_id_number || '');
                setDebtorAddress(initialData.debtor_address || '');
                setImageUrl(initialData.image_url || '');

                setIsLegacy(initialData.is_legacy || false);
                setPaidAmount(initialData.paid_amount ? initialData.paid_amount.toString() : '');

                // Try to infer installment settings from existing installments
                if (initialData.installments && initialData.installments.length > 0) {
                    setInstallmentCount(initialData.installments.length.toString());
                    setPreviewInstallments(initialData.installments.map((inst, idx) => ({
                        id: idx,
                        amount: inst.amount,
                        dueDate: inst.due_date,
                        status: inst.status,
                        notes: inst.notes
                    })));

                    const firstAmount = initialData.installments[0].amount;
                    setInstallmentAmount(firstAmount.toString());

                    // Infer monthly vs weekly
                    const d1 = new Date(initialData.installments[0].due_date);
                    const d2 = initialData.installments[1] ? new Date(initialData.installments[1].due_date) : null;
                    if (d2) {
                        const diffDays = Math.abs((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));
                        if (diffDays < 20) setInstallmentInterval('weekly');
                        else setInstallmentInterval('monthly');
                    }
                }
            } else {
                // Create Mode: Reset form
                setCustomerId('');
                setAmount('');
                setStartDate(new Date().toISOString().split('T')[0]);
                setNotes('');
                setDebtorAddress('');
                setImageUrl('');
                setIsLegacy(false);
                setPaidAmount('');
                setInstallmentCount('1');
                setInstallmentAmount('');
                setCalculationMethod('byCount');
                setInstallmentInterval('monthly');
                setPreviewInstallments([]);
            }
            setError(null);
        }
    }, [isOpen, initialData]);

    useEffect(() => {
        if (customerId && customers.length > 0) {
            const customer = customers.find(c => c.customer_id === customerId);
            if (customer) {
                setDebtorIdNumber(customer.id_number || '');
                setDebtorAddress(customer.address || '');
            }
        }
    }, [customerId, customers]);

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

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploadingImage(true);
            setError(null);

            // Compress image aggressively for documents (smart scan)
            const options = {
                maxSizeMB: 0.5,
                maxWidthOrHeight: 1600,
                useWebWorker: true,
                initialQuality: 0.7
            };

            const compressedFile = await imageCompression(file, options);

            const formData = new FormData();
            formData.append('file', compressedFile, compressedFile.name);

            const res = await fetch('/api/admin/upload-image', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to upload image');

            setImageUrl(data.publicUrl);
        } catch (err: any) {
            console.error('Image upload failed:', err);
            setError(err?.message || 'فشل رفع صورة الهوية');
        } finally {
            setUploadingImage(false);
        }
    };

    // Calculate installments preview
    useEffect(() => {
        calculateInstallments();
    }, [amount, startDate, installmentCount, installmentAmount, calculationMethod, installmentInterval, isLegacy, paidAmount]);

    const calculateInstallments = () => {
        const total = parseFloat(amount);
        if (!total || total <= 0) {
            setPreviewInstallments([]);
            return;
        }

        let amountToSplit = total;
        if (isLegacy) {
            const paid = parseFloat(paidAmount) || 0;
            amountToSplit = total - paid;
            if (amountToSplit <= 0) {
                setPreviewInstallments([]);
                return;
            }
        }

        let count = 0;
        let amountPerInst = 0;

        if (calculationMethod === 'byCount') {
            count = parseInt(installmentCount);
            if (!count || count <= 0) return;
            amountPerInst = amountToSplit / count;
        } else {
            amountPerInst = parseFloat(installmentAmount);
            if (!amountPerInst || amountPerInst <= 0) return;
            count = Math.ceil(amountToSplit / amountPerInst);
        }

        const installments = [];
        let currentTotal = 0;
        const start = new Date(startDate);

        for (let i = 0; i < count; i++) {
            const dueDate = new Date(start);
            if (installmentInterval === 'monthly') {
                dueDate.setMonth(dueDate.getMonth() + i);
            } else {
                dueDate.setDate(dueDate.getDate() + (i * 7));
            }

            let instAmount = amountPerInst;

            // Adjust last installment to match total exactly
            if (i === count - 1) {
                instAmount = amountToSplit - currentTotal;
            }

            // Round to 2 decimals
            instAmount = Math.round(instAmount * 100) / 100;
            currentTotal += instAmount;

            installments.push({
                id: i,
                amount: instAmount,
                dueDate: dueDate.toISOString().split('T')[0],
                notes: `قسط رقم ${i + 1} من ${count} (${installmentInterval === 'monthly' ? 'شهري' : 'أسبوعي'})`
            });
        }

        setPreviewInstallments(installments);
    };

    const handleSave = async () => {
        if (!customerId && !initialData) return setError('الرجاء اختيار العميل');
        const total = parseFloat(amount);
        if (!total || total <= 0) return setError('الرجاء إدخال المبلغ الإجمالي');

        let remainingAmount = total;
        let paid = 0;

        if (isLegacy) {
            paid = parseFloat(paidAmount) || 0;
            if (paid < 0) return setError('المبلغ المدفوع لا يمكن أن يكون سالباً');
            if (paid >= total) return setError('المبلغ المدفوع يجب أن يكون أقل من المبلغ الإجمالي');
            remainingAmount = total - paid;
        }

        if (previewInstallments.length === 0) return setError('الرجاء التأكد من إعدادات الأقساط');

        try {
            setSaving(true);
            setError(null);

            const payload = {
                customerId,
                totalAmount: total,
                issueDate: startDate,
                notes,
                debtorIdNumber,
                debtorAddress,
                imageUrl,
                isLegacy,
                paidAmount: isLegacy ? paid : 0,
                remainingAmount: isLegacy ? remainingAmount : total,
                createdBy: admin?.id, // Added createdBy to payload
                installments: previewInstallments.map(inst => ({
                    amount: inst.amount,
                    dueDate: inst.dueDate,
                    notes: inst.notes,
                    status: initialData ? inst.status : undefined
                })),
            };

            if (initialData) {
                await updatePromissoryNote(initialData.id, payload);
            } else {
                await createPromissoryNote(payload);
            }

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

    const remainingForPreview = isLegacy ? (parseFloat(amount) || 0) - (parseFloat(paidAmount) || 0) : (parseFloat(amount) || 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col font-cairo" dir="rtl">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Calculator className="text-gray-600" size={24} />
                        {initialData ? 'تعديل الكمبيالة' : 'إضافة كمبيالة جديدة'}
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
                                    <label className="block text-sm font-medium text-gray-700 mb-1">رقم هوية المدين</label>
                                    <input
                                        type="text"
                                        value={debtorIdNumber}
                                        onChange={(e) => setDebtorIdNumber(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400 font-medium"
                                        placeholder="رقم الهوية"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">عنوان المدين</label>
                                    <input
                                        type="text"
                                        value={debtorAddress}
                                        onChange={(e) => setDebtorAddress(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400 font-medium"
                                        placeholder="العنوان"
                                    />
                                </div>
                            </div>

                            {/* ID Smart Scan / Attachment */}
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                    <Camera size={18} className="text-slate-500" />
                                    صورة هوية المدين (Smart Scan)
                                </label>
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment" // Encourages mobile camera
                                            onChange={handleImageUpload}
                                            disabled={uploadingImage}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                        />
                                        <button
                                            type="button"
                                            disabled={uploadingImage}
                                            className="px-4 py-2 bg-white border border-slate-300 rounded-lg shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {uploadingImage ? (
                                                <>
                                                    <Loader2 size={16} className="animate-spin text-blue-500" />
                                                    جاري المعالجة...
                                                </>
                                            ) : (
                                                'التقاط / رفع صورة'
                                            )}
                                        </button>
                                    </div>
                                    {imageUrl && (
                                        <div className="relative w-16 h-16 rounded border border-gray-200 overflow-hidden shadow-sm">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={imageUrl} alt="ID Preview" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => setImageUrl('')}
                                                className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl hover:bg-red-600 transition-colors"
                                                title="حذف الصورة"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    سيتم ضغط الصورة تلقائياً لتوفير المساحة مع الحفاظ على وضوح البيانات.
                                </p>
                            </div>

                            {/* Legacy Note Toggle */}
                            <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 flex items-start gap-3">
                                <div className="mt-0.5">
                                    <input
                                        type="checkbox"
                                        id="legacy-toggle"
                                        checked={isLegacy}
                                        onChange={(e) => setIsLegacy(e.target.checked)}
                                        className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="legacy-toggle" className="block text-sm font-bold text-amber-900 cursor-pointer mb-1">
                                        إدخال كمبيالة سابقة (موجودة فعلياً)
                                    </label>
                                    <p className="text-xs text-amber-700 mb-3">
                                        قم بتفعيل هذا الخيار إذا كانت هذه الكمبيالة قديمة وتم دفع جزء منها مسبقاً، ليتم جدولة المبلغ المتبقي فقط.
                                    </p>

                                    {isLegacy && (
                                        <div className="grid grid-cols-2 gap-3 mt-2">
                                            <div>
                                                <label className="block text-xs font-semibold text-amber-800 mb-1">المبلغ المدفوع مسبقاً</label>
                                                <div className="relative">
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 font-bold text-sm">₪</span>
                                                    <input
                                                        type="number"
                                                        value={paidAmount}
                                                        onChange={(e) => setPaidAmount(e.target.value)}
                                                        className="w-full pr-8 pl-3 py-1.5 border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-amber-900 placeholder:text-amber-400 font-medium text-sm"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-amber-800 mb-1">المبلغ المتبقي للجدولة</label>
                                                <div className="w-full px-3 py-1.5 bg-amber-100 border border-amber-200 rounded text-amber-900 font-bold text-sm h-[34px] flex items-center">
                                                    ₪{remainingForPreview > 0 ? remainingForPreview.toFixed(2) : '0.00'}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {isLegacy ? `المبلغ الإجمالي (قيمة الكمبيالة الأصلية)` : `المبلغ الإجمالي`}
                                    </label>
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
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {isLegacy ? 'تاريخ أول قسط قادم' : 'تاريخ البدء'}
                                    </label>
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

                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-blue-900 mb-2">تكرار الأقساط</label>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                checked={installmentInterval === 'monthly'}
                                                onChange={() => setInstallmentInterval('monthly')}
                                                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">شهري</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                checked={installmentInterval === 'weekly'}
                                                onChange={() => setInstallmentInterval('weekly')}
                                                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">أسبوعي</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="border-t border-blue-200 pt-4">
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
                                            <label className="block text-sm text-gray-600 mb-1">
                                                عدد الأقساط {installmentInterval === 'monthly' ? 'الشهرية' : 'الأسبوعية'} {isLegacy ? 'المتبقية' : ''}
                                            </label>
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
                                            <label className="block text-sm text-gray-600 mb-1">
                                                قيمة القسط {installmentInterval === 'monthly' ? 'الشهري' : 'الأسبوعي'}
                                            </label>
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
                                <span>جدول الأقساط المتوقع {isLegacy ? '(للمبلغ المتبقي فقط)' : ''}</span>
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
                                    <span>مجموع الأقساط المجدولة</span>
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
