'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getMaintenance, getMaintenanceHistory } from '@/lib/api';
import { LucideWrench, LucideUser, LucideFileText, LucideCalendar, LucideCheckCircle, LucideAlertCircle, LucideSmartphone, LucidePenTool } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';

export default function PublicMaintenanceView() {
    const params = useParams();
    const maintNo = params?.id as string;

    const [data, setData] = useState<any | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!maintNo) {
            setError('رقم الصيانة غير صالح');
            setLoading(false);
            return;
        }
        loadData();
    }, [maintNo]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [maintenanceData, historyData] = await Promise.all([
                getMaintenance(maintNo),
                getMaintenanceHistory(maintNo)
            ]);

            if (!maintenanceData) {
                throw new Error('لم يتم العثور على معاملة صيانة بهذا الرقم');
            }

            setData(maintenanceData);
            setHistory(historyData || []);
        } catch (err: any) {
            console.error('Error loading maintenance data:', err);
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

    const formatDateTime = (dateString: string) => {
        if (!dateString) return '—';
        try {
            return new Date(dateString).toLocaleString('en-US', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch {
            return dateString;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 dir-rtl font-cairo">
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-600 font-medium text-lg">جاري تحميل تفاصيل الصيانة...</p>
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
                    <p className="text-gray-600 mb-6">{error || 'لم يتم العثور على البيانات'}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors w-full"
                    >
                        إعادة المحاولة
                    </button>
                </div>
            </div>
        );
    }

    const latestStatus = history.length > 0 ? history[0].Status : data.Status;

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 dir-rtl font-cairo pb-12">
            {/* Header */}
            <div className="bg-blue-800 text-white shadow-md">
                <div className="max-w-3xl mx-auto px-4 py-6">
                    <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-4 text-center md:text-right">
                        <div>
                            <h1 className="text-2xl font-bold mb-1 flex items-center justify-center md:justify-start gap-2">
                                <LucidePenTool className="w-6 h-6" />
                                تفاصيل معاملة صيانة
                            </h1>
                            <p className="text-blue-200 text-sm">شركة المنار للأجهزة الكهربائية</p>
                        </div>

                        <div className="bg-blue-900/50 rounded-xl px-5 py-3 border border-blue-700 backdrop-blur-sm">
                            <span className="text-blue-200 text-sm block mb-1">رقم المعاملة</span>
                            <span className="text-2xl font-bold tracking-wider">{data.MaintNo}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 -mt-6">
                {/* Cost Card (Moved up since Status is removed) */}
                {data.Cost > 0 && (
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
                        <div className="flex justify-between items-center text-center w-full">
                            <span className="text-gray-500 font-bold block mb-1">التكلفة الإجمالية للصيانة</span>
                            <span className="font-black text-3xl text-gray-900">{data.Cost} ₪</span>
                        </div>
                    </div>
                )}

                {/* Customer & Item Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Customer Info */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-3">
                            <div className="bg-blue-100 p-2 rounded-lg"><LucideUser className="w-5 h-5 text-blue-700" /></div>
                            بيانات العميل
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <span className="text-gray-500 text-sm block mb-1">الاسم</span>
                                <span className="font-bold text-gray-900 text-lg">{data.CustomerName}</span>
                            </div>
                            {data.CustomerPhone && (
                                <div>
                                    <span className="text-gray-500 text-sm block mb-1">رقم الهاتف</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-900" dir="ltr">{data.CustomerPhone}</span>
                                        <a
                                            href={`https://wa.me/${data.CustomerPhone.replace(/\D/g, '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-green-500 hover:text-green-600 transition-colors bg-green-50 p-1.5 rounded-full"
                                        >
                                            <FaWhatsapp className="w-5 h-5" />
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Item Info */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-3">
                            <div className="bg-indigo-100 p-2 rounded-lg"><LucideWrench className="w-5 h-5 text-indigo-700" /></div>
                            الجهاز والصيانة
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <span className="text-gray-500 text-sm block mb-1">اسم الجهاز</span>
                                <span className="font-bold text-gray-900 text-lg">{data.ItemName}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                {data.Company && (
                                    <div>
                                        <span className="text-gray-500 text-sm block mb-1">الشركة</span>
                                        <span className="font-semibold text-gray-800">{data.Company}</span>
                                    </div>
                                )}
                                {data.UnderWarranty && (
                                    <div>
                                        <span className="text-gray-500 text-sm block mb-1">الكفالة</span>
                                        <span className={`inline-flex px-2.5 py-1 rounded-md text-sm font-bold ${data.UnderWarranty === 'نعم' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                            {data.UnderWarranty === 'نعم' ? 'ضمن الكفالة' : 'خارج الكفالة'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Problem Description */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <div className="bg-red-100 p-2 rounded-lg"><LucideAlertCircle className="w-5 h-5 text-red-600" /></div>
                        وصف العطل
                    </h2>
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 min-h-[80px]">
                        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{data.Problem || 'لم يتم تحديد وصف دقيق للعطل'}</p>
                    </div>
                </div>

                {/* Dates */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <div className="bg-purple-100 p-2 rounded-lg"><LucideCalendar className="w-5 h-5 text-purple-700" /></div>
                        التواريخ
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <span className="text-gray-500 text-sm block mb-1">تاريخ الاستلام</span>
                            <span className="font-semibold text-gray-800" dir="ltr">{formatDate(data.DateOfReceive)}</span>
                        </div>
                        {data.DateOfPurchase && (
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                <span className="text-gray-500 text-sm block mb-1">تاريخ الشراء</span>
                                <span className="font-semibold text-gray-800" dir="ltr">{formatDate(data.DateOfPurchase)}</span>
                            </div>
                        )}
                        {data.DateOfDelivery && (
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                <span className="text-gray-500 text-sm block mb-1">تاريخ التسليم المتوقع</span>
                                <span className="font-semibold text-gray-800" dir="ltr">{formatDate(data.DateOfDelivery)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* History Timeline */}
                {history && history.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-3">
                            <div className="bg-orange-100 p-2 rounded-lg"><LucideFileText className="w-5 h-5 text-orange-700" /></div>
                            سجل التتبع والمكان
                        </h2>

                        <div className="relative border-r-2 border-gray-200 pr-5 ml-2 space-y-6">
                            {history.map((record, index) => {
                                // Maps technical status to user-friendly location status
                                const getLocationFromStatus = (status?: string | null) => {
                                    if (!status) return 'جاري العمل عليها';
                                    if (status.includes('المحل')) return 'في المعرض (المحل)';
                                    if (status.includes('المخزن')) return 'في مستودع الشركة';
                                    if (status.includes('الشركة')) return 'لدى مركز صيانة الوكيل المختص';
                                    if (status.includes('سلمت للزبون')) return 'تم التسليم للزبون';
                                    if (status === 'قيد الانتظار') return 'في المعرض (بانتظار الفحص)';
                                    if (status === 'ملغى') return 'تم الإلغاء';
                                    return 'جاري العمل عليها';
                                };

                                const locationLabel = getLocationFromStatus(record.Status);

                                return (
                                    <div key={record.id || index} className="relative">
                                        {/* Timeline dot */}
                                        <div className={`absolute -right-[27px] w-4 h-4 rounded-full border-2 border-white 
                        ${index === 0 ? 'bg-blue-600' : 'bg-gray-400'}`}>
                                        </div>

                                        <div className={`${index === 0 ? 'bg-blue-50/50' : 'bg-gray-50'} rounded-xl p-4 border ${index === 0 ? 'border-blue-100' : 'border-gray-100'}`}>
                                            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-2 gap-2">
                                                <span className="font-bold text-gray-800 text-lg">
                                                    {locationLabel}
                                                </span>
                                                <span className="text-sm font-bold text-gray-500 flex flex-col" dir="ltr">
                                                    {formatDateTime(record.created_at)}
                                                </span>
                                            </div>

                                            {record.Notes && record.Notes.trim() !== '' && (
                                                <p className="text-gray-700 mt-2 text-sm leading-relaxed whitespace-pre-wrap border-t border-gray-200 pt-2">{record.Notes}</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
