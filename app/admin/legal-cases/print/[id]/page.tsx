'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getLegalCaseById, type LegalCase } from '@/lib/api';
import { Printer, ArrowRight, Loader2 } from 'lucide-react';

export default function BasicLegalPrintTemplate() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;

    const [legalCase, setLegalCase] = useState<LegalCase | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            fetchCase();
        }
    }, [id]);

    const fetchCase = async () => {
        try {
            setLoading(true);
            const data = await getLegalCaseById(id);
            setLegalCase(data);
        } catch (err: any) {
            console.error('Error fetching legal case:', err);
            setError('تعذر تحميل بيانات الملف القضائي للطباعة.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 size={48} className="animate-spin text-blue-500" />
            </div>
        );
    }

    if (error || !legalCase) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                <div className="bg-white p-8 rounded-xl shadow border border-red-200 text-center">
                    <p className="text-red-600 font-bold text-xl mb-4">{error || 'الملف غير موجود'}</p>
                    <button onClick={() => router.back()} className="text-blue-600 hover:underline">العودة للصفحة السابقة</button>
                </div>
            </div>
        );
    }

    const { customers, case_number, remaining_amount, total_amount, paid_amount } = legalCase;
    const currentDate = new Date().toLocaleDateString('ar-EG');

    return (
        <div className="min-h-screen bg-gray-100 py-8 font-cairo" dir="rtl">
            {/* Action Bar (Hidden in Print) */}
            <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden px-4">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200 transition-colors"
                >
                    <ArrowRight size={20} />
                    رجوع
                </button>
                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-sm transition-colors font-bold"
                >
                    <Printer size={20} />
                    طباعة الطلب القضائي
                </button>
            </div>

            {/* Print Document container (A4 dimensions approx) */}
            <div className="bg-white mx-auto shadow-lg max-w-4xl print:max-w-none print:shadow-none print:mx-0 p-12 md:p-16 text-black print:p-0 min-h-[1056px]">

                {/* Document Header */}
                <div className="text-center mb-16">
                    <h1 className="text-2xl font-bold mb-2">لدى دائرة التنفيذ في المحكمة</h1>
                    <h2 className="text-xl font-bold">طلب تنفيذي بخصوص الملف القضائي رقم: {case_number}</h2>
                    <p className="mt-4 text-gray-700">تاريخ الإصدار: {currentDate}</p>
                </div>

                {/* Core Document Content (Placeholders) */}
                <div className="space-y-8 leading-loose text-lg">
                    <div className="border border-gray-800 p-6 rounded-sm">
                        <div className="grid grid-cols-2 gap-y-4">
                            <div className="font-bold">اسم المستدعى ضده (المنفذ ضده):</div>
                            <div className="font-bold text-xl">{customers?.name}</div>

                            <div className="font-bold">العنوان:</div>
                            <div>{customers?.address || 'غير متوفر'}</div>

                            <div className="font-bold">رقم الهاتف:</div>
                            <div dir="ltr" className="text-right">{customers?.phone || 'غير متوفر'}</div>
                        </div>
                    </div>

                    <div className="mt-12 text-justify">
                        <p className="mb-6">
                            نرجو من عطوفتكم التكرم باتخاذ الإجراءات القانونية اللازمة لتحصيل المبلغ المتبقي والبالغ قيمته
                            <span className="font-bold border-b border-black inline-block min-w-[100px] text-center mx-2">
                                ₪{remaining_amount?.toLocaleString() || 0}
                            </span>
                            (شيكل فقط لا غير).
                        </p>

                        <p className="mb-4">وذلك استناداً إلى التالي:</p>
                        <ul className="list-disc list-inside space-y-2 mr-4">
                            <li>المبلغ الأساسي المطالب به: ₪{Number(total_amount).toLocaleString()}</li>
                            <li>تم سداد مبلغ وقدره: ₪{Number(paid_amount).toLocaleString()}</li>
                            <li>(مكان لإضافة نصوص قانونية أخرى حسب نوع الطلب: حجز، استدعاء، الخ...)</li>
                        </ul>
                    </div>
                </div>

                {/* Document Footer / Signatures */}
                <div className="mt-32 pt-16 border-t-2 border-dashed border-gray-400 grid grid-cols-2 text-center text-lg font-bold">
                    <div>
                        <p className="mb-16">توقيع المستدعي / الوكيل</p>
                        <p>_______________________</p>
                    </div>
                    <div>
                        <p className="mb-16">خاتم دائرة التنفيذ</p>
                        <p>_______________________</p>
                    </div>
                </div>

            </div>
        </div>
    );
}
