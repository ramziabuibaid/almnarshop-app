'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getMaintenance } from '@/lib/api';

export default function MaintenancePrintPage() {
  const params = useParams();
  const maintNo = params?.id as string;
  
  const [maintenanceData, setMaintenanceData] = useState<{
    MaintNo: string;
    CustomerID: string;
    CustomerName: string;
    CustomerPhone?: string;
    ItemName: string;
    Location: string;
    Company?: string;
    DateOfPurchase?: string;
    DateOfReceive: string;
    Problem?: string;
    SerialNo?: string;
    UnderWarranty: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!maintNo) {
      setError('رقم الصيانة مطلوب');
      setLoading(false);
      return;
    }

    loadMaintenanceData();
  }, [maintNo]);

  useEffect(() => {
    // Add Google Fonts
    if (typeof document !== 'undefined') {
      const existingLink1 = document.querySelector('link[href="https://fonts.googleapis.com"]');
      const existingLink2 = document.querySelector('link[href*="Tajawal"]');
      
      if (!existingLink1) {
        const link1 = document.createElement('link');
        link1.rel = 'preconnect';
        link1.href = 'https://fonts.googleapis.com';
        document.head.appendChild(link1);
      }
      
      if (!existingLink2) {
        const link2 = document.createElement('link');
        link2.href = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@700&display=swap';
        link2.rel = 'stylesheet';
        document.head.appendChild(link2);
      }
    }
  }, []);

  useEffect(() => {
    // Set document title for PDF filename (customer name + maintenance number)
    if (maintenanceData && !loading) {
      const customerName = maintenanceData.CustomerName || 'عميل';
      const maintNo = maintenanceData.MaintNo || '';
      document.title = `${customerName} ${maintNo}`;
      
      // Auto-print when page loads in the new window
      // This won't freeze the main app because it's in a separate window
      const timer = setTimeout(() => {
        window.print();
      }, 500); // Slightly longer delay to ensure content is fully rendered
      return () => clearTimeout(timer);
    }
  }, [maintenanceData, loading]);

  const loadMaintenanceData = async () => {
    try {
      setLoading(true);
      setError(null);

      const maintenance = await getMaintenance(maintNo);

      setMaintenanceData({
        MaintNo: maintenance.MaintNo,
        CustomerID: maintenance.CustomerID,
        CustomerName: maintenance.CustomerName,
        CustomerPhone: maintenance.CustomerPhone || undefined,
        ItemName: maintenance.ItemName,
        Location: maintenance.Location,
        Company: maintenance.Company || undefined,
        DateOfPurchase: maintenance.DateOfPurchase || undefined,
        DateOfReceive: maintenance.DateOfReceive,
        Problem: maintenance.Problem || undefined,
        SerialNo: maintenance.SerialNo || undefined,
        UnderWarranty: maintenance.UnderWarranty,
      });
    } catch (err: any) {
      console.error('[MaintenancePrint] Error loading maintenance:', err);
      setError(err.message || 'فشل تحميل بيانات الصيانة');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }} dir="rtl">
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '2px solid #222', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
          <p style={{ color: '#666' }}>جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  if (error || !maintenanceData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }} dir="rtl">
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#dc2626', fontSize: '18px' }}>{error || 'البيانات غير موجودة'}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@700&display=swap');
        
        :root {
          --border: #222;
          --pad: 6px;
          --gap: 6px;
          --fs: 12px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        html, body {
          height: 100%;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: 'Tajawal', system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          font-weight: 700;
          background: white !important;
          color: black !important;
          direction: rtl;
        }

        @page {
          size: A6 portrait;
          margin: 8mm 7mm 8mm 7mm;
        }

        @media print {
          body {
            background: white !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }

        @media screen {
          body {
            background: #f3f4f6;
            padding: 20px;
          }
        }

        .sheet {
          box-sizing: border-box;
          width: 100%;
          min-height: 100%;
          padding: 8px;
          direction: rtl;
        }

        .header {
          display: flex;
          flex-direction: row-reverse;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          border: 1px solid var(--border);
          padding: var(--pad);
        }

        .brand {
          text-align: right;
          font-size: var(--fs);
          line-height: 1.3;
        }

        .brand .name {
          font-weight: 700;
        }

        .title {
          text-align: center;
          font-weight: 700;
          margin: 6px 0 4px;
          border: 1px solid var(--border);
          padding: 4px;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--gap);
        }

        .cell {
          border: 1px solid var(--border);
          padding: var(--pad);
          font-size: var(--fs);
          min-height: 22px;
        }

        .cell .lbl {
          opacity: 0.8;
          font-size: 11px;
          display: block;
          margin-bottom: 2px;
        }

        .full {
          grid-column: 1 / -1;
        }

        .logo {
          width: 38px;
          height: auto;
          object-fit: contain;
        }

        .footerNote {
          border: 1px solid var(--border);
          padding: var(--pad);
          font-size: 11px;
          margin-top: var(--gap);
          text-align: center;
        }
      `}} />

      <div className="sheet">
        {/* Company Header */}
        <div className="header">
          <div>
            {/* Logo placeholder */}
          </div>
          <div className="brand">
            <div className="name">شركة المنار للأجهزة الكهربائية</div>
            <div>جنين - شارع الناصرة</div>
            <div>04-2438815 | 0599-048348</div>
          </div>
        </div>

        {/* Document Title */}
        <div className="title">استلام قطعة صيانة</div>

        {/* Grid Layout */}
        <div className="grid">
          {/* Item Name - Full Width */}
          <div className="cell full">
            <span className="lbl">اسم القطعة</span>
            {maintenanceData.ItemName || ''}
          </div>

          {/* Customer Name and Phone */}
          <div className="cell">
            <span className="lbl">اسم الزبون</span>
            {maintenanceData.CustomerName || ''}
          </div>
          <div className="cell">
            <span className="lbl">رقم الهاتف</span>
            {maintenanceData.CustomerPhone || ''}
          </div>

          {/* Purchase Date and Receive Date */}
          <div className="cell">
            <span className="lbl">تاريخ الشراء</span>
            {formatDate(maintenanceData.DateOfPurchase || '') || ''}
          </div>
          <div className="cell">
            <span className="lbl">تاريخ الاستلام</span>
            {formatDate(maintenanceData.DateOfReceive || '') || ''}
          </div>

          {/* Arrival Number and Serial No */}
          <div className="cell">
            <span className="lbl">رقم الوصول</span>
            {maintenanceData.MaintNo || ''}
          </div>
          <div className="cell">
            <span className="lbl">الرقم التسلسلي</span>
            {maintenanceData.SerialNo || ''}
          </div>

          {/* Company and Under Warranty */}
          <div className="cell">
            <span className="lbl">الشركة المكفلة</span>
            {maintenanceData.Company || ''}
          </div>
          <div className="cell">
            <span className="lbl">ضمن الكفالة</span>
            {maintenanceData.UnderWarranty || ''}
          </div>

          {/* Problem Description - Full Width */}
          <div className="cell full" style={{ minHeight: '48px' }}>
            <span className="lbl">وصف العطل</span>
            {maintenanceData.Problem || ''}
          </div>
        </div>

        {/* Footer Note */}
        <div className="footerNote">
          ملاحظة: الرجاء إخبارنا في حال كان هناك تكلفة مادية مقابل الإصلاح.
        </div>
      </div>

      {/* Print Button - Hidden when printing */}
      <div className="no-print" style={{ padding: '8px', textAlign: 'center' }}>
        <button onClick={() => window.print()} style={{ padding: '8px 16px', cursor: 'pointer', border: '1px solid #222', background: 'white' }}>
          إعادة الطباعة
        </button>
      </div>
    </>
  );
}
