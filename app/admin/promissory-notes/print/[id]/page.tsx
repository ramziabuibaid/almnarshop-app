'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getPromissoryNoteById } from '@/lib/api';
import { Loader2, Printer, ArrowRight } from 'lucide-react';
import Image from 'next/image';

export default function PromissoryNotePrintPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const isEmbed = searchParams?.get('embed') === '1';
    const [note, setNote] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (params.id) {
            loadNote(params.id as string);
        }
    }, [params.id]);

    useEffect(() => {
        if (!note || loading) return;
        const title = `سند لأمر - ${note.id}`;
        document.title = title;

        if (isEmbed) {
            try {
                // Notify parent window that we are ready to print
                window.parent.postMessage({ type: 'print-ready', title }, '*');
            } catch (_) { }
            return;
        }
    }, [note, loading, isEmbed]);

    const loadNote = async (id: string) => {
        try {
            setLoading(true);
            const data = await getPromissoryNoteById(id);
            setNote(data);
        } catch (err: any) {
            console.error('Failed to load note:', err);
            setError(err.message || 'فشل تحميل تفاصيل الكمبيالة');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin text-gray-500" size={32} />
            </div>
        );
    }

    if (error || !note) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-red-600 gap-4">
                <p>حدث خطأ أثناء تحميل الكمبيالة</p>
                <button
                    onClick={() => router.back()}
                    className="px-4 py-2 bg-gray-100 rounded-lg text-gray-700 hover:bg-gray-200"
                >
                    العودة
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8 print:p-0 print:bg-white font-cairo" dir="rtl">
            {/* Header / Controls - Hidden in Print and Embed */}
            {!isEmbed && (
                <div className="max-w-[210mm] mx-auto mb-6 flex justify-between items-center print:hidden">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowRight size={20} />
                        <span>العودة</span>
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <Printer size={20} />
                        <span>طباعة الكمبيالة</span>
                    </button>
                </div>
            )}

            {/* A4 Page Container */}
            <div className="max-w-[210mm] min-h-[297mm] mx-auto bg-white shadow-lg print:shadow-none p-[10mm] flex flex-col gap-6 text-black">

                {/* PART 1: Promissory Note (سند لأمر) */}
                <div className="border-2 border-black p-5 rounded-xl relative">
                    <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-white px-4">
                        <h1 className="text-xl font-bold">سند لأمر</h1>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mb-4 mt-2">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="font-bold text-sm">المبلغ:</span>
                                <span className="border-b border-dotted border-black flex-1 text-center font-bold text-lg">
                                    {note.total_amount.toLocaleString()} ₪
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm">تاريخ الاستحقاق:</span>
                                <span className="border-b border-dotted border-black flex-1 text-center text-sm">
                                    {note.installments?.[note.installments.length - 1]?.due_date}
                                </span>
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="font-bold text-sm">رقم السند:</span>
                                <span className="border-b border-dotted border-black flex-1 text-center font-bold text-sm">
                                    {note.id}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm">تاريخ التحرير:</span>
                                <span className="border-b border-dotted border-black flex-1 text-center text-sm">
                                    {note.issue_date}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="leading-relaxed text-justify mb-6 text-base">
                        <p className="mb-2">
                            أتعهد بأن أدفع بموجب هذا السند لأمر / <strong>السيد / رمزي مؤيد احمد ابو عبيد</strong>
                        </p>
                        <p className="mb-2">
                            مبلغاً وقدره: <strong>{note.total_amount.toLocaleString()} شيكل جديد</strong>
                        </p>
                        <p>
                            وذلك مقابل استلام بضاعة/خدمات، وأقر بقيمة الدين المذكور أعلاه وألتزم بسداده حسب تواريخ الاستحقاق المتفق عليها.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <h3 className="font-bold border-b border-black pb-1 mb-3 text-center text-sm">اسم وتوقيع المدين (المشتري)</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex gap-2">
                                    <span className="font-medium">الاسم الرباعي:</span>
                                    <span>{note.customers?.name}</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="font-medium">رقم الهوية:</span>
                                    <span>{note.debtor_id_number || note.customers?.id_number}</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="font-medium">رقم الهاتف:</span>
                                    <span>{note.customers?.phone}</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="font-medium">العنوان:</span>
                                    <span>{note.debtor_address || note.customers?.address}</span>
                                </div>
                                <div className="mt-6 pt-4 border-t border-dotted border-black text-center">
                                    التوقيع
                                </div>
                            </div>
                        </div>
                        <div>
                            <h3 className="font-bold border-b border-black pb-1 mb-3 text-center text-sm">اسم وتوقيع الكفيل (إن وجد)</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex gap-2">
                                    <span className="font-medium">الاسم الرباعي:</span>
                                    <span className="border-b border-dotted border-black flex-1"></span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="font-medium">رقم الهوية:</span>
                                    <span className="border-b border-dotted border-black flex-1"></span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="font-medium">رقم الهاتف:</span>
                                    <span className="border-b border-dotted border-black flex-1"></span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="font-medium">العنوان:</span>
                                    <span className="border-b border-dotted border-black flex-1"></span>
                                </div>
                                <div className="mt-6 pt-4 border-t border-dotted border-black text-center">
                                    التوقيع
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Separator */}
                <div className="border-t-2 border-dashed border-gray-300 print:border-gray-400"></div>

                {/* PART 2: Installment Agreement (اتفاقية تقسيط) */}
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-center mb-4">جدول الأقساط والمدفوعات</h2>

                    <div className="text-sm mb-3">
                        أقر أنا الموقع أدناه باستلام البضاعة/الخدمة والالتزام بسداد الأقساط حسب الجدول التالي:
                    </div>

                    {note.installments?.length > 12 ? (
                        <div className="border-2 border-black p-6 text-center text-lg font-bold leading-loose rounded-lg my-6">
                            التقسيط بواقع مبلغ {note.installments[0]?.amount} شيكل كل {note.installments[0]?.notes?.includes('أسبوع') ? 'أسبوع' : 'شهر'} حتى يصل المبلغ الى مجموع المبلغ المطلوب دفعه
                        </div>
                    ) : (
                        <div>
                            <div className="grid grid-cols-2 gap-6 rtl:space-x-reverse">
                                {/* First Column (Right) - First 6 items */}
                                <div>
                                    <table className="w-full border-collapse border border-black text-xs">
                                        <thead>
                                            <tr className="bg-gray-100 print:bg-gray-200">
                                                <th className="border border-black p-1 w-8">#</th>
                                                <th className="border border-black p-1">التاريخ</th>
                                                <th className="border border-black p-1">قيمة القسط</th>
                                                <th className="border border-black p-1">توقيع</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {note.installments?.slice(0, 6).map((inst: any, index: number) => (
                                                <tr key={inst.id}>
                                                    <td className="border border-black p-1 text-center">{index + 1}</td>
                                                    <td className="border border-black p-1 text-center">{inst.due_date}</td>
                                                    <td className="border border-black p-1 text-center font-bold">₪{inst.amount}</td>
                                                    <td className="border border-black p-1"></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Second Column (Left) - Remaining items */}
                                <div>
                                    {note.installments?.length > 6 && (
                                        <table className="w-full border-collapse border border-black text-xs">
                                            <thead>
                                                <tr className="bg-gray-100 print:bg-gray-200">
                                                    <th className="border border-black p-1 w-8">#</th>
                                                    <th className="border border-black p-1">التاريخ</th>
                                                    <th className="border border-black p-1">قيمة القسط</th>
                                                    <th className="border border-black p-1">توقيع</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {note.installments?.slice(6, 12).map((inst: any, index: number) => (
                                                    <tr key={inst.id}>
                                                        <td className="border border-black p-1 text-center">{index + 7}</td>
                                                        <td className="border border-black p-1 text-center">{inst.due_date}</td>
                                                        <td className="border border-black p-1 text-center font-bold">₪{inst.amount}</td>
                                                        <td className="border border-black p-1"></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>

                            {/* Total Row - Full Width below columns */}
                            <div className="border border-black p-2 mt-3 bg-gray-50 flex justify-between items-center font-bold text-sm">
                                <span>الإجمالي الكلي:</span>
                                <span>₪{note.total_amount.toLocaleString()}</span>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 flex justify-between px-12">
                        <div className="text-center">
                            <p className="font-bold mb-6 text-sm">توقيع المستلم</p>
                            <div className="w-40 border-b border-black"></div>
                        </div>
                        <div className="text-center">
                            <p className="font-bold mb-6 text-sm">ختم وتوقيع الشركة</p>
                            <div className="w-40 border-b border-black"></div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
