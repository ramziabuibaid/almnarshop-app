'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getMaintenance } from '@/lib/api';
import QRCode from '@/components/admin/QRCode';

export default function MaintQrStickerPrintPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const isEmbed = searchParams?.get('embed') === '1';
    const maintNo = params?.id as string;

    const [maintenanceData, setMaintenanceData] = useState<{
        MaintNo: string;
        CustomerName: string;
    } | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [qrLink, setQrLink] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined' && maintNo) {
            setQrLink(`${window.location.origin}/maintenance/${maintNo}`);
        }
    }, [maintNo]);

    useEffect(() => {
        if (!maintNo) {
            setError('رقم الصيانة مطلوب');
            setLoading(false);
            return;
        }
        loadMaintenanceData();
    }, [maintNo]);

    useEffect(() => {
        if (!maintenanceData || loading) return;
        const docNo = maintenanceData.MaintNo || '';
        const title = `QR - ${docNo}`;
        document.title = title;

        if (isEmbed) {
            try {
                window.parent.postMessage({ type: 'print-ready', title }, '*');
            } catch (_) { }
            return;
        }
        const timer = setTimeout(() => window.print(), 1000);
        return () => clearTimeout(timer);
    }, [maintenanceData, loading, isEmbed]);

    const loadMaintenanceData = async () => {
        try {
            setLoading(true);
            setError(null);
            const maintenance = await getMaintenance(maintNo);
            setMaintenanceData({
                MaintNo: maintenance.MaintNo,
                CustomerName: maintenance.CustomerName,
            });
        } catch (err: any) {
            console.error('[MaintQrSticker] Error:', err);
            setError(err.message || 'فشل تحميل بيانات الصيانة');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="p-4 text-center font-cairo">جاري التحميل...</div>;
    }

    if (error || !maintenanceData) {
        return <div className="p-4 text-center text-red-600 font-cairo cursor-pointer" onClick={() => window.location.reload()}>خطأ: {error || 'فشل التحميل'} - انقر للتحديث</div>;
    }

    return (
        <div className="sticker-container" dir="rtl">
            <style jsx global>{`
        @page {
          size: 50mm 25mm;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 0;
          background: white;
          color: black;
          font-family: 'Cairo', sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .sticker-container {
          width: 50mm;
          height: 25mm;
          overflow: hidden;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1mm 2mm;
        }
        .qr-section {
          width: 22mm;
          height: 22mm;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .info-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          padding-right: 2mm;
          overflow: hidden;
        }
        .customer-name {
          font-size: 11px;
          font-weight: 900;
          line-height: 1.2;
          max-height: 26px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          margin-bottom: 2px;
          word-break: break-word;
        }
        .maint-number {
          font-size: 10px;
          font-weight: bold;
          color: #333;
        }
      `}</style>

            <div className="qr-section">
                <QRCode value={qrLink} size={80} />
            </div>

            <div className="info-section border-r border-gray-300 pr-1">
                <div className="customer-name">{maintenanceData.CustomerName || 'بدون اسم'}</div>
                <div className="maint-number" dir="ltr">#{maintenanceData.MaintNo}</div>
            </div>
        </div>
    );
}
