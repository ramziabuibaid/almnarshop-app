'use client';

import { Suspense, useState, useEffect, useLayoutEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getMaintenance } from '@/lib/api';
import QRCode from 'react-qr-code';
import { Wrench } from 'lucide-react';

interface MaintenanceRecord {
    MaintNo: string;
    CustomerName: string;
}

function PrintBatchQrContent() {
    const searchParams = useSearchParams();
    const idsParam = searchParams.get('ids');
    const isEmbed = searchParams.get('embed') === '1';

    const [records, setRecords] = useState<MaintenanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useLayoutEffect(() => {
        document.title = 'طباعة ملصقات الباركود للدفعة';
    }, []);

    useEffect(() => {
        if (!idsParam) {
            setError('لم يتم تحديد سندات للطباعة');
            setLoading(false);
            return;
        }

        const ids = idsParam.split(',').filter(Boolean);
        if (ids.length === 0) {
            setError('لم يتم تحديد سندات صالحة للطباعة');
            setLoading(false);
            return;
        }

        document.title = `ملصقات باركود محددة - ${new Date().toLocaleDateString('ar-EG')}`;

        console.log('[MaintenanceBatchQrPrint] Fetching records:', ids);

        const loadRecords = async () => {
            try {
                const fetchedRecords = await Promise.all(
                    ids.map(id => getMaintenance(id))
                );

                const validRecords = fetchedRecords.filter(Boolean) as MaintenanceRecord[];
                setRecords(validRecords);

                setTimeout(() => {
                    if (isEmbed) {
                        window.parent.postMessage(
                            { type: 'batch-print-ready', title: document.title },
                            '*'
                        );
                    } else {
                        window.print();
                    }
                }, 1000);

            } catch (err: any) {
                console.error('[MaintenanceBatchQrPrint] Failed to load data:', err);
                setError('حدث خطأ أثناء تحميل بيانات السندات. الرجاء المحاولة مرة أخرى.');
            } finally {
                setLoading(false);
            }
        };

        loadRecords();
    }, [idsParam, isEmbed]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen rtl font-cairo bg-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p className="text-gray-600">جاري التجهيز لطباعة الملصقات...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen rtl font-cairo bg-white p-4 text-center">
                <div className="text-red-500 mb-4">
                    <Wrench size={48} className="mx-auto text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">تعذر الطباعة</h2>
                <p className="text-gray-600 mb-6">{error}</p>
                {!isEmbed && (
                    <button
                        onClick={() => window.close()}
                        className="px-6 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 font-bold"
                    >
                        إغلاق
                    </button>
                )}
            </div>
        );
    }

    if (records.length === 0) {
        return null;
    }

    return (
        <div className="batch-qr-print-container" dir="rtl">
            <style dangerouslySetInnerHTML={{
                __html: `
        html, body {
          background: white !important;
          color: black !important;
          margin: 0;
          padding: 0;
          min-height: 100%;
        }

        body {
          font-family: 'Cairo', system-ui, -apple-system, sans-serif;
        }

        div, p, span {
          box-sizing: border-box;
        }

        .print-page {
          width: 50mm;
          height: 25mm;
          overflow: hidden;
          position: relative;
          background: white;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          padding: 1.5mm !important;
          gap: 2mm;
        }

        @page {
          size: 50mm 25mm;
          margin: 0;
        }

        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-page {
            /* Fix iOS specific scaling push */
            transform-origin: top left;
            margin: 0 !important;
            page-break-inside: avoid;
            page-break-after: always;
            break-after: page;
          }
          
          .print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }

          .no-print {
            display: none !important;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
          
        .qr-side {
          flex: 0 0 22mm;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 22mm;
        }
          
        .text-side {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-center;
          height: 100%;
          overflow: hidden;
          padding-top: 1mm;
          padding-bottom: 1mm;
        }
        
        .c-name {
          font-size: 8pt;
          font-weight: 800;
          line-height: 1.1;
          margin-bottom: 1mm;
          color: #000;
          max-height: 2.2em;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        
        .m-no {
          font-size: 11pt;
          font-weight: 900;
          color: #000;
          line-height: 1;
        }
      `}} />
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;800;900&display=swap" rel="stylesheet" />

            {!isEmbed && (
                <div className="no-print" style={{ padding: '8px', textAlign: 'center', background: '#f3f4f6', marginBottom: '10px' }}>
                    <button
                        onClick={() => window.print()}
                        style={{
                            background: '#1e3a8a', color: 'white', border: 'none',
                            padding: '8px 16px', borderRadius: '4px', cursor: 'pointer',
                            fontWeight: 'bold', fontFamily: 'Cairo'
                        }}
                    >
                        إعادة طباعة الكل
                    </button>
                </div>
            )}

            {records.map((maintenanceData) => {
                const qrLink = typeof window !== 'undefined'
                    ? `${window.location.protocol}//${window.location.host}/maintenance/${maintenanceData.MaintNo}`
                    : '';

                return (
                    <div key={maintenanceData.MaintNo} className="print-page">
                        <div className="qr-side">
                            {qrLink && (
                                <QRCode value={qrLink} size={83} style={{ width: '100%', height: '100%' }} />
                            )}
                        </div>
                        <div className="text-side">
                            <div className="c-name">{maintenanceData.CustomerName || '—'}</div>
                            <div className="m-no">#{maintenanceData.MaintNo}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function CashBoxBatchPrintQrPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-screen rtl font-cairo bg-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p className="text-gray-600">جاري التجهيز لطباعة الملصقات...</p>
            </div>
        }>
            <PrintBatchQrContent />
        </Suspense>
    );
}
