'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { getQuotationFromSupabase } from '@/lib/api';
import { getDirectImageUrl } from '@/lib/utils';
import { LucideUser, LucideFileText, LucideCalendar, LucideAlertCircle, LucideSmartphone, LucideCheckCircle, LucideGift, LucideBanknote } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';

interface QuotationItem {
    QuotationDetailID: string;
    ProductID: string;
    product?: { name: string; barcode?: string; shamelNo?: string; image?: string; Image?: string };
    Quantity: number;
    UnitPrice: number;
    notes?: string;
    isGift?: boolean;
    serialNos?: string[];
}

export default function PublicQuotationView() {
    const params = useParams();
    const quotationId = params?.id as string;

    const [data, setData] = useState<{
        quotationID: string;
        date: string;
        customerId: string | null;
        customer?: { name?: string; phone?: string; address?: string; shamelNo?: string };
        status: string;
        notes?: string;
        items: QuotationItem[];
        subtotal: number;
        specialDiscount: number;
        giftDiscount: number;
        netTotal: number;
    } | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!quotationId) {
            setError('رقم عرض السعر غير صالح');
            setLoading(false);
            return;
        }
        loadData();
    }, [quotationId]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            const quotation = await getQuotationFromSupabase(quotationId);
            const items = quotation.details || [];

            // Load serial numbers for each item
            const { getSerialNumbersByDetailId } = await import('@/lib/api_serial_numbers');
            const itemsWithSerials = await Promise.all(
                items.map(async (item: QuotationItem) => {
                    let serialNos: string[] = [];
                    if (item.QuotationDetailID) {
                        try {
                            serialNos = await getSerialNumbersByDetailId(item.QuotationDetailID, 'quotation');
                        } catch (err) {
                            console.error('Failed to load serial numbers:', err);
                        }
                    }
                    return {
                        ...item,
                        serialNos: serialNos.filter(s => s && s.trim()),
                    };
                })
            );

            const subtotal = itemsWithSerials.reduce(
                (sum: number, item: QuotationItem) => sum + item.Quantity * item.UnitPrice,
                0
            );
            const specialDiscount = parseFloat(String(quotation.SpecialDiscountAmount || 0)) || 0;
            const giftDiscount = parseFloat(String(quotation.GiftDiscountAmount || 0)) || 0;
            const netTotal = subtotal - specialDiscount - giftDiscount;

            setData({
                quotationID: quotation.QuotationID,
                date: quotation.Date,
                customerId: quotation.CustomerID,
                customer: quotation.customer,
                status: quotation.Status,
                notes: quotation.Notes,
                items: itemsWithSerials,
                subtotal,
                specialDiscount,
                giftDiscount,
                netTotal,
            });
        } catch (err: any) {
            console.error('Error loading quotation data:', err);
            setError(err.message || 'حدث خطأ أثناء تحميل البيانات');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '—';
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

    const regularItems = useMemo(() => {
        if (!data) return [];
        return data.items.filter(item => !item.isGift);
    }, [data]);

    const giftItems = useMemo(() => {
        if (!data) return [];
        return data.items.filter(item => item.isGift);
    }, [data]);

    const discountPercentage = useMemo(() => {
        if (!data) return 0;
        const totalDiscount = (data.specialDiscount || 0) + (data.giftDiscount || 0);
        if (data.subtotal === 0 || totalDiscount === 0) return 0;
        return (totalDiscount / data.subtotal) * 100;
    }, [data]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 dir-rtl font-cairo">
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-600 font-medium text-lg">جاري تحميل العرض السعري...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 dir-rtl font-cairo">
                <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
                    <LucideAlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">عذراً</h2>
                    <p className="text-gray-600 mb-6">{error || 'لم يتم العثور على عرض السعر'}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded-lg transition-colors w-full"
                    >
                        إعادة المحاولة
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 dir-rtl font-cairo pb-12">
            {/* Header */}
            <div className="bg-emerald-800 text-white shadow-md">
                <div className="max-w-3xl mx-auto px-4 py-6">
                    <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-4 text-center md:text-right">
                        <div>
                            <h1 className="text-2xl font-bold mb-1 flex items-center justify-center md:justify-start gap-2">
                                <LucideFileText className="w-6 h-6" />
                                عرض سعر رقمي
                            </h1>
                            <p className="text-emerald-200 text-sm">شركة المنار للأجهزة الكهربائية</p>
                        </div>

                        <div className="bg-emerald-900/50 rounded-xl px-5 py-3 border border-emerald-700 backdrop-blur-sm">
                            <span className="text-emerald-200 text-sm block mb-1">رقم العرض</span>
                            <span className="text-2xl font-bold tracking-wider">{data.quotationID}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 -mt-6">

                {/* Net Total Card Top Highlight */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
                    <div className="flex justify-between items-center text-center w-full">
                        <span className="text-gray-500 font-bold block mb-1">الصافي للدفع</span>
                        <span className="font-black text-3xl text-emerald-600">{data.netTotal.toFixed(2)} ₪</span>
                    </div>
                </div>

                {/* Customer Info */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex justify-between items-center border-b pb-3 mb-4">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <div className="bg-emerald-100 p-2 rounded-lg"><LucideUser className="w-5 h-5 text-emerald-700" /></div>
                            بيانات العميل
                        </h2>
                        <div className="text-sm font-bold text-gray-400 flex items-center gap-1">
                            <LucideCalendar className="w-4 h-4" />
                            {formatDate(data.date)}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <span className="text-gray-500 text-sm block mb-1">الاسم</span>
                            <span className="font-bold text-gray-900 text-lg">{data.customer?.name || data.customerId || '—'}</span>
                            {data.customer?.shamelNo && (
                                <span className="text-sm text-gray-400 mr-2">({data.customer.shamelNo})</span>
                            )}
                        </div>
                        {data.customer?.phone && (
                            <div>
                                <span className="text-gray-500 text-sm block mb-1">رقم الهاتف</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-900" dir="ltr">{data.customer.phone}</span>
                                    <a
                                        href={`https://wa.me/${data.customer.phone.replace(/\D/g, '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-green-500 hover:text-green-600 transition-colors bg-green-50 p-1.5 rounded-full"
                                    >
                                        <FaWhatsapp className="w-5 h-5" />
                                    </a>
                                </div>
                            </div>
                        )}
                        {data.customer?.address && (
                            <div className="sm:col-span-2">
                                <span className="text-gray-500 text-sm block mb-1">العنوان</span>
                                <span className="font-semibold text-gray-800">{data.customer.address}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Regular Items List */}
                {regularItems.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-3">
                            <div className="bg-blue-100 p-2 rounded-lg"><LucideBanknote className="w-5 h-5 text-blue-700" /></div>
                            الأصناف المشمولة
                        </h2>
                        <div className="space-y-4">
                            {regularItems.map((item, index) => {
                                const productImage = item.product?.image || item.product?.Image || '';
                                const imageUrl = getDirectImageUrl(productImage);
                                const totalItemPrice = item.Quantity * item.UnitPrice;

                                return (
                                    <div key={item.QuotationDetailID || index} className="flex flex-col sm:flex-row bg-gray-50 rounded-xl p-4 border border-gray-100 gap-4">
                                        <div className="w-24 h-24 sm:w-20 sm:h-20 bg-white rounded-lg border border-gray-200 flex-shrink-0 mx-auto sm:mx-0 overflow-hidden flex items-center justify-center">
                                            {imageUrl ? (
                                                <img src={imageUrl} alt={item.product?.name} className="max-w-full max-h-full object-contain p-1" />
                                            ) : (
                                                <LucideFileText className="w-8 h-8 text-gray-300" />
                                            )}
                                        </div>
                                        <div className="flex-1 flex flex-col justify-between text-center sm:text-right">
                                            <div>
                                                <h3 className="font-bold text-gray-900">{item.product?.name || `Product ${item.ProductID}`}</h3>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    رقم الصنف: {item.product?.shamelNo || item.product?.barcode || item.ProductID}
                                                </p>
                                                {item.serialNos && item.serialNos.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1 justify-center sm:justify-start">
                                                        {item.serialNos.map((serial, idx) => (
                                                            <span key={idx} className="bg-gray-200 text-gray-700 text-[10px] px-2 py-0.5 rounded font-mono">SN: {serial}</span>
                                                        ))}
                                                    </div>
                                                )}
                                                {item.notes && item.notes.trim() && (
                                                    <p className="text-sm text-gray-600 mt-2 bg-yellow-50 p-2 rounded italic border border-yellow-100">
                                                        {item.notes}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="mt-4 flex flex-row items-center justify-between border-t border-gray-200 pt-3 sm:border-0 sm:pt-2">
                                                <div className="text-sm font-semibold text-gray-700">
                                                    الكمية: <span className="text-gray-900 bg-white px-2 py-1 rounded border shadow-sm">{item.Quantity}</span>
                                                </div>
                                                <div className="text-left font-bold text-blue-700 text-lg">
                                                    {totalItemPrice.toFixed(2)} ₪
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Gift Items Section */}
                {giftItems.length > 0 && (
                    <div className="bg-yellow-50 rounded-2xl shadow-sm border border-yellow-200 p-6 mb-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-100 rounded-bl-full flex items-start justify-end p-2 z-0">
                            <LucideGift className="w-6 h-6 text-yellow-500 opacity-50" />
                        </div>
                        <h2 className="text-xl font-black text-amber-600 mb-6 flex items-center gap-2 border-b border-amber-200 pb-3 relative z-10">
                            <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-2 rounded-lg text-white shadow-sm">
                                <LucideGift className="w-5 h-5" />
                            </div>
                            الهدايا المرفقة بالعرض
                        </h2>
                        <div className="space-y-4 relative z-10">
                            {giftItems.map((item, index) => {
                                const productImage = item.product?.image || item.product?.Image || '';
                                const imageUrl = getDirectImageUrl(productImage);
                                const totalItemPrice = item.Quantity * item.UnitPrice;

                                return (
                                    <div key={item.QuotationDetailID || `gift-${index}`} className="flex flex-col sm:flex-row bg-white rounded-xl p-4 border border-amber-100 gap-4 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="w-24 h-24 sm:w-20 sm:h-20 bg-gray-50 rounded-lg border border-gray-100 flex-shrink-0 mx-auto sm:mx-0 overflow-hidden flex items-center justify-center">
                                            {imageUrl ? (
                                                <img src={imageUrl} alt={item.product?.name} className="max-w-full max-h-full object-contain p-1" />
                                            ) : (
                                                <LucideGift className="w-8 h-8 text-amber-200" />
                                            )}
                                        </div>
                                        <div className="flex-1 flex flex-col justify-between text-center sm:text-right">
                                            <div>
                                                <h3 className="font-bold text-gray-900">{item.product?.name || `Product ${item.ProductID}`}</h3>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    رقم الصنف: {item.product?.shamelNo || item.product?.barcode || item.ProductID}
                                                </p>
                                                {item.serialNos && item.serialNos.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1 justify-center sm:justify-start">
                                                        {item.serialNos.map((serial, idx) => (
                                                            <span key={idx} className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded font-mono">SN: {serial}</span>
                                                        ))}
                                                    </div>
                                                )}
                                                {item.notes && item.notes.trim() && (
                                                    <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded italic">
                                                        {item.notes}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="mt-4 flex flex-row items-center justify-between border-t border-amber-50 pt-3 sm:border-0 sm:pt-2">
                                                <div className="text-sm font-semibold text-gray-700">
                                                    الكمية: <span className="text-gray-900 bg-amber-50 px-2 py-1 rounded border border-amber-100">{item.Quantity}</span>
                                                </div>
                                                <div className="text-left font-black text-amber-500 line-through opacity-70">
                                                    {totalItemPrice.toFixed(2)} ₪
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Financial Summary */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-3">
                        <div className="bg-gray-100 p-2 rounded-lg"><LucideBanknote className="w-5 h-5 text-gray-700" /></div>
                        الملخص المالي
                    </h2>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-2">
                            <span className="text-gray-600 font-semibold">المجموع الإجمالي</span>
                            <span className="font-bold text-gray-900">{data.subtotal.toFixed(2)} ₪</span>
                        </div>

                        {data.specialDiscount > 0 && (
                            <div className="flex justify-between items-center py-2 text-red-600">
                                <span className="font-semibold">خصم خاص</span>
                                <span className="font-bold">- {data.specialDiscount.toFixed(2)} ₪</span>
                            </div>
                        )}

                        {data.giftDiscount > 0 && (
                            <div className="flex justify-between items-center py-2 text-red-600">
                                <span className="font-semibold">قيمة الهدايا المخصومة</span>
                                <span className="font-bold">- {data.giftDiscount.toFixed(2)} ₪</span>
                            </div>
                        )}

                        {((data.specialDiscount > 0 || data.giftDiscount > 0) && discountPercentage > 0) && (
                            <div className="flex justify-between items-center py-2 text-emerald-600 bg-emerald-50 px-3 rounded-lg">
                                <span className="font-semibold">نسبة التوفير المتوقعة</span>
                                <span className="font-bold">{discountPercentage.toFixed(2)}%</span>
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-4 border-t-2 border-gray-100 border-dashed">
                            <span className="text-gray-800 font-bold text-lg">الصافي النهائي</span>
                            <span className="font-black text-2xl text-emerald-600">{data.netTotal.toFixed(2)} ₪</span>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                {data.notes && data.notes.trim() !== '' && (
                    <div className="bg-blue-50 rounded-2xl shadow-sm border border-blue-100 p-6 mb-6">
                        <h2 className="text-lg font-bold text-blue-800 mb-2 flex items-center gap-2">
                            <LucideFileText className="w-5 h-5" />
                            ملاحظات مهمة
                        </h2>
                        <div className="bg-white rounded-xl p-4 border border-blue-50">
                            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed font-semibold">{data.notes}</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="text-center mt-8 pb-4 text-sm text-gray-400 font-semibold">
                صُدر هذا العرض بواسطة نظام المنار وتاريخ نشأته {formatDate(data.date)}
            </div>
        </div>
    );
}
