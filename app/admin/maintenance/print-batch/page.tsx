'use client';

import { Suspense, useState, useEffect, useLayoutEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getMaintenance, convertDriveImageUrl } from '@/lib/api';
import { fixPhoneNumber } from '@/lib/utils';
import { Wrench } from 'lucide-react';
import Image from 'next/image';

interface MaintenanceRecord {
    MaintNo: string;
    CustomerID: string;
    CustomerName: string;
    CustomerPhone?: string;
    CustomerShamelNo?: string;
    ItemName: string;
    Location: string;
    Company?: string;
    DateOfPurchase?: string;
    DateOfReceive: string;
    Problem?: string;
    Status: string;
    SerialNo?: string;
    UnderWarranty: string;
    Notes?: string;
}

function PrintBatchContent() {
    const searchParams = useSearchParams();
    const idsParam = searchParams.get('ids');
    const isEmbed = searchParams.get('embed') === '1';

    const [records, setRecords] = useState<MaintenanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useLayoutEffect(() => {
        document.title = 'طباعة تذاكر صيانة - A6';
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

        // Set page title for print output filename
        document.title = `تذاكر صيانة محددة - ${new Date().toLocaleDateString('ar-EG')}`;

        console.log('[MaintenanceBatchPrint] Fetching records:', ids);

        const loadRecords = async () => {
            try {
                const fetchedRecords = await Promise.all(
                    ids.map(id => getMaintenance(id))
                );

                // Filter out nulls in case some weren't found
                const validRecords = fetchedRecords.filter(Boolean) as MaintenanceRecord[];
                setRecords(validRecords);

                // Auto print logic after short delay for rendering and images loading
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
                console.error('[MaintenanceBatchPrint] Failed to load data:', err);
                setError('حدث خطأ أثناء تحميل بيانات السندات. الرجاء المحاولة مرة أخرى.');
            } finally {
                setLoading(false);
            }
        };

        loadRecords();
    }, [idsParam, isEmbed]);

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } catch {
            return '';
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen rtl font-cairo bg-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p className="text-gray-600">جاري التجهيز للطباعة الجماعية...</p>
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
        <div className="batch-print-container" dir="rtl">
            <style dangerouslySetInnerHTML={{
                __html: `
        :root {
          --border: #e5e7eb;
          --bg-gray: #f3f4f6;
          --text-main: #111827;
          --text-muted: #6b7280;
          --fs: 11px;
          --fs-sm: 9px;
          --fs-lg: 13px;
          --header-bg: #f8f9fa;
          --primary: #1e3a8a;
          --primary-light: #eff6ff;
        }

        html, body {
          height: 100%;
          background: white !important;
          color: black !important;
          direction: rtl;
        }

        body {
          font-family: 'Cairo', system-ui, -apple-system, sans-serif;
          font-weight: 600;
          margin: 0;
          padding: 0;
          line-height: 1.25;
        }

        /* Essential for batch printing pages correctly */
        .print-page {
          page-break-after: always;
          break-after: page;
          box-sizing: border-box;
          width: 100%;
          max-height: 148mm;
          position: relative;
          overflow: hidden;
        }
        
        .print-page:last-child {
          page-break-after: auto;
          break-after: auto;
        }

        @page {
          size: A6 portrait;
          margin: 0;
        }

        @media print {
          html, body {
            height: 100%;
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-page {
            /* Fix iOS specific scaling push */
            padding: 3mm !important;
            height: 148mm; /* Target exact A6 */
            transform-origin: top center;
          }

          .no-print {
            display: none !important;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Force tables to shrink logic if necessary */
          table, tr, td, th, tbody, thead, tfoot {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }

        table.sheet {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          direction: rtl;
        }

        .header-section {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid var(--border);
          padding-bottom: 6px;
          margin-bottom: 6px;
          align-items: center;
        }

        .brand-info {
          text-align: right;
        }
        
        .brand-name {
          font-size: 14px;
          font-weight: 800;
          color: var(--primary);
          margin-bottom: 2px;
        }
        
        .brand-details {
          font-size: var(--fs-sm);
          color: var(--text-muted);
        }

        .doc-title-container {
          text-align: left;
          background: var(--primary-light);
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid #bfdbfe;
        }

        .doc-title {
          font-size: 16px;
          font-weight: 900;
          color: var(--primary);
        }

        .doc-no {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
          margin-top: 1px;
        }

        .customer-card {
          padding: 6px 8px;
          background: var(--bg-gray);
          border-radius: 6px;
          border: 1px solid var(--border);
          margin-bottom: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          margin-bottom: 6px;
        }

        .info-cell {
          border: 1px solid var(--border);
          padding: 4px 6px;
          border-radius: 4px;
        }

        .info-cell.full {
          grid-column: 1 / -1;
        }

        .cell-label {
          display: block;
          font-size: 8px;
          color: var(--text-muted);
          margin-bottom: 2px;
          font-weight: 700;
        }

        .cell-value {
          font-size: var(--fs);
          color: var(--text-main);
          font-weight: 700;
        }

        .problem-cell {
          border: 1px dashed #ef4444;
          background: #fef2f2;
          padding: 6px 8px;
          border-radius: 6px;
          margin-bottom: 6px;
        }

        .footer-grid {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          align-items: center;
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px dotted var(--border);
        }

        .qr-container {
          padding: 4px;
          background: white;
          border: 1px solid var(--border);
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .scan-me {
          font-size: 8px;
          font-weight: 800;
          margin-top: 2px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--primary);
        }

        .terms {
          font-size: 9px;
          color: #4b5563;
          line-height: 1.4;
          text-align: right;
        }
        
        .terms-bold {
          font-weight: 800;
          color: #111827;
        }
      `}} />
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet" />

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

            {records.map((maintenanceData, index) => {
                const qrLink = typeof window !== 'undefined'
                    ? `${window.location.protocol}//${window.location.host}/maintenance/${maintenanceData.MaintNo}`
                    : '';

                return (
                    <div key={maintenanceData.MaintNo} className="print-page">
                        <table className="sheet">
                            <thead>
                                <tr>
                                    <td>
                                        <div className="header-section">
                                            <div className="brand-info">
                                                <div className="brand-name">شركة المنار للأجهزة الكهربائية</div>
                                                <div className="brand-details">جنين - شارع الناصرة</div>
                                                <div className="brand-details">0599-048348 | 04-2438815</div>
                                            </div>
                                            <div className="doc-title-container">
                                                <div className="doc-title">سند استلام صيانة</div>
                                                <div className="doc-no">#{maintenanceData.MaintNo}</div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </thead>

                            <tbody>
                                <tr>
                                    <td>
                                        {/* Customer Info */}
                                        <div className="customer-card">
                                            <div>
                                                <span className="cell-label" style={{ color: '#1e3a8a' }}>الزبون المكرم</span>
                                                <div className="cell-value" style={{ fontSize: '14px' }}>
                                                    {maintenanceData.CustomerName}
                                                    {maintenanceData.CustomerShamelNo && (
                                                        <span style={{ fontSize: '11px', color: '#6b7280', marginInlineStart: '6px' }}>
                                                            ({maintenanceData.CustomerShamelNo})
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {maintenanceData.CustomerPhone && (
                                                <div style={{ textAlign: 'left' }}>
                                                    <span className="cell-label">الهاتف</span>
                                                    <div className="cell-value" dir="ltr">{fixPhoneNumber(maintenanceData.CustomerPhone)}</div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Grid Layout */}
                                        <div className="info-grid">
                                            {/* Item Name - Full Width */}
                                            <div className="info-cell full" style={{ borderLeft: '4px solid var(--primary)' }}>
                                                <span className="cell-label">اسم الجهاز والوصف</span>
                                                <div className="cell-value" style={{ fontSize: '13px' }}>{maintenanceData.ItemName || '—'}</div>
                                            </div>

                                            <div className="info-cell">
                                                <span className="cell-label">الرقم التسلسلي</span>
                                                <div className="cell-value" dir="ltr" style={{ textAlign: 'right' }}>{maintenanceData.SerialNo || '—'}</div>
                                            </div>
                                            <div className="info-cell">
                                                <span className="cell-label">تاريخ الاستلام</span>
                                                <div className="cell-value">{formatDate(maintenanceData.DateOfReceive) || '—'}</div>
                                            </div>

                                            <div className="info-cell">
                                                <span className="cell-label">مكان الاستلام</span>
                                                <div className="cell-value">{maintenanceData.Location || '—'}</div>
                                            </div>
                                            <div className="info-cell">
                                                <span className="cell-label">حالة الكفالة</span>
                                                <div className="cell-value" style={{
                                                    color: maintenanceData.UnderWarranty === 'YES' ? '#059669' : '#dc2626'
                                                }}>
                                                    {maintenanceData.UnderWarranty === 'YES' ? 'ضمن الكفالة' : 'خارج الكفالة'}
                                                </div>
                                            </div>

                                            {maintenanceData.Company && (
                                                <div className="info-cell full">
                                                    <span className="cell-label">الشركة المكفلة</span>
                                                    <div className="cell-value">{maintenanceData.Company}</div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Problem Description - Full Width */}
                                        <div className="problem-cell">
                                            <span className="cell-label" style={{ color: '#dc2626' }}>الوصف المبدئي للعطل</span>
                                            <div className="cell-value" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '4px' }}>
                                                {maintenanceData.Problem || '—'}
                                            </div>
                                        </div>

                                        {/* Footer Section with QR Code */}
                                        <div className="footer-grid">
                                            <div className="terms">
                                                <div className="terms-bold" style={{ marginBottom: '4px', fontSize: '10px' }}>
                                                    شروط واحكام الصيانة:
                                                </div>
                                                <div>1. الفحص المبدئي لا يعتبر تقرير نهائي عن حالة الجهاز.</div>
                                                <div>2. الشركة غير مسؤولة عن الأجهزة التي يمر على استلامها من الصيانة أكثر من 30 يوماً.</div>
                                                <div className="terms-bold" style={{ marginTop: '4px', color: '#dc2626' }}>
                                                    * يرجى إبراز هذا السند عند الاستلام.
                                                </div>
                                            </div>
                                            {qrLink && (
                                                <div className="qr-container">
                                                    { /* Quick inline QR image trick since QRCode component can be heavy when rendered hundreds of times */}
                                                    <Image width={55} height={55} src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrLink)}&margin=0`} alt="QR" unoptimized />
                                                    <div className="scan-me">Scan Me</div>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                );
            })}
        </div>
    );
}

export default function CashBoxBatchPrintA6Page() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-screen rtl font-cairo bg-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p className="text-gray-600">جاري تحميل الصفحة...</p>
            </div>
        }>
            <PrintBatchContent />
        </Suspense>
    );
}
