'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getMaintenance, getAllCustomers } from '@/lib/api';

export default function MaintenancePrintPage() {
  const params = useParams();
  const maintNo = params?.id as string;
  
  const [maintenanceData, setMaintenanceData] = useState<{
    MaintNo: string;
    CustomerID: string;
    CustomerName: string;
    CustomerShamelNo?: string;
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
      
      // Fetch customer Shamel No if customer_id exists
      let customerShamelNo = '';
      if (maintenance.CustomerID) {
        try {
          const customers = await getAllCustomers();
          const customer = customers.find((c: any) => {
            const customerId = c.CustomerID || c.id || c.customer_id || '';
            return customerId === maintenance.CustomerID;
          });
          if (customer) {
            customerShamelNo = customer.ShamelNo || customer['Shamel No'] || customer.shamel_no || customer.shamelNo || '';
          }
        } catch (err) {
          console.error('[MaintenancePrint] Failed to load customer:', err);
        }
      }

      setMaintenanceData({
        MaintNo: maintenance.MaintNo,
        CustomerID: maintenance.CustomerID,
        CustomerName: maintenance.CustomerName,
        CustomerShamelNo: customerShamelNo,
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
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Cairo' }}>
        <p>جاري تحميل البيانات...</p>
      </div>
    );
  }

  if (error || !maintenanceData) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Cairo' }}>
        <p style={{ color: 'red' }}>خطأ: {error || 'فشل تحميل البيانات'}</p>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', color: 'black', direction: 'rtl' }}>
      <style jsx global>{`
        :root {
          --border: #1a1a1a;
          --border-light: #d1d5db;
          --pad: 5px;
          --gap: 6px;
          --fs: 12px;
          --fs-sm: 11px;
          --fs-lg: 14px;
          --header-bg: #f8f9fa;
        }

        html, body {
          height: 100%;
          background: white !important;
          color: black !important;
          direction: rtl;
        }

        body {
          font-family: 'Cairo', 'Tajawal', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
          font-weight: 600;
          margin: 0;
          padding: 0;
          background: white !important;
          color: black !important;
          direction: rtl;
          line-height: 1.4;
        }

        @page {
          size: A6 portrait;
          margin: 0;
        }

        @media print {
          body {
            padding: 8mm 7mm 8mm 7mm;
          }

          .no-print {
            display: none;
          }

          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          thead {
            display: table-header-group;
          }

          tfoot {
            display: table-footer-group;
          }
        }

        table.sheet {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          direction: rtl;
        }

        thead {
          display: table-header-group;
        }

        tfoot {
          display: table-footer-group;
        }

        .box {
          border: 2px solid var(--border);
          padding: var(--pad);
          border-radius: 4px;
        }

        .headerRow {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 8px;
        }

        .brand {
          text-align: right;
          margin-left: auto;
          font-size: var(--fs-sm);
          line-height: 1.3;
          font-weight: 600;
        }

        .titleRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin: 8px 0 6px;
        }

        .titleMain {
          flex: 1;
          text-align: center;
          border: 2px solid var(--border);
          padding: 6px;
          font-weight: 700;
          font-size: var(--fs-lg);
          background: var(--header-bg);
          border-radius: 4px;
        }

        .titleId {
          border: 2px solid var(--border);
          padding: 6px 10px;
          white-space: nowrap;
          font-size: var(--fs);
          font-weight: 700;
          background: var(--header-bg);
          border-radius: 4px;
        }

        .meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--gap);
          margin-bottom: 6px;
        }

        .chip {
          border: 1px solid var(--border-light);
          padding: 5px 8px;
          font-size: var(--fs-sm);
          background: #ffffff;
          border-radius: 4px;
          font-weight: 600;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--gap);
          margin-top: 6px;
        }

        .cell {
          border: 1px solid var(--border-light);
          padding: 6px;
          font-size: var(--fs);
          background: #ffffff;
          border-radius: 4px;
        }

        .cell .lbl {
          display: block;
          font-size: 10px;
          color: #666;
          margin-bottom: 3px;
          font-weight: 600;
        }

        .cell .value {
          font-weight: 600;
          color: #000;
        }

        .full {
          grid-column: 1 / -1;
        }

        .footerNote {
          border: 2px solid var(--border);
          padding: 6px;
          font-size: var(--fs-sm);
          margin-top: 6px;
          text-align: center;
          border-radius: 4px;
          background: #f9fafb;
          font-weight: 600;
        }
      `}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;900&family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet" />
      <div className="no-print" style={{ padding: '8px', textAlign: 'center' }}>
        <button onClick={() => window.print()}>إعادة الطباعة</button>
      </div>
      <table className="sheet">
        <thead>
          <tr>
            <td>
              <div className="box headerRow">
                <div className="brand">
                  <div style={{ fontSize: 'var(--fs)', fontWeight: 700, marginBottom: '2px' }}>
                    شركة المنار للأجهزة الكهربائية
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)' }}>
                    جنين - شارع الناصرة
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)' }}>
                    0599-048348 | 04-2438815
                  </div>
                </div>
              </div>

              <div className="titleRow">
                <div className="titleMain">استلام قطعة صيانة</div>
                <div className="titleId">{maintenanceData.MaintNo}</div>
              </div>
            </td>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>
              {/* Customer Info */}
              <div className="meta" style={{ marginBottom: '6px' }}>
                <div className="chip">
                  الزبون: <span style={{ fontWeight: 700 }}>{maintenanceData.CustomerName}</span>
                  {maintenanceData.CustomerShamelNo && (
                    <span style={{ marginRight: '6px', color: '#666', fontSize: '10px' }}>({maintenanceData.CustomerShamelNo})</span>
                  )}
                </div>
                {maintenanceData.CustomerPhone && (
                  <div className="chip">
                    الهاتف: <span>{maintenanceData.CustomerPhone}</span>
                  </div>
                )}
              </div>

              {/* Grid Layout */}
              <div className="grid">
                {/* Item Name - Full Width */}
                <div className="cell full">
                  <span className="lbl">اسم القطعة</span>
                  <div className="value">{maintenanceData.ItemName || ''}</div>
                </div>

                {/* Purchase Date and Receive Date */}
                <div className="cell">
                  <span className="lbl">تاريخ الشراء</span>
                  <div className="value">{formatDate(maintenanceData.DateOfPurchase || '') || '—'}</div>
                </div>
                <div className="cell">
                  <span className="lbl">تاريخ الاستلام</span>
                  <div className="value">{formatDate(maintenanceData.DateOfReceive || '') || '—'}</div>
                </div>

                {/* Serial No and Location */}
                <div className="cell">
                  <span className="lbl">الرقم التسلسلي</span>
                  <div className="value">{maintenanceData.SerialNo || '—'}</div>
                </div>
                <div className="cell">
                  <span className="lbl">مكان الاستلام</span>
                  <div className="value">{maintenanceData.Location || '—'}</div>
                </div>

                {/* Company and Under Warranty */}
                <div className="cell">
                  <span className="lbl">الشركة المكفلة</span>
                  <div className="value">{maintenanceData.Company || '—'}</div>
                </div>
                <div className="cell">
                  <span className="lbl">ضمن الكفالة</span>
                  <div className="value">{maintenanceData.UnderWarranty || '—'}</div>
                </div>

                {/* Problem Description - Full Width */}
                <div className="cell full" style={{ minHeight: '40px' }}>
                  <span className="lbl">وصف العطل</span>
                  <div className="value" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {maintenanceData.Problem || '—'}
                  </div>
                </div>
              </div>

              {/* Footer Note */}
              <div className="footerNote">
                ملاحظة: الرجاء إخبارنا في حال كان هناك تكلفة مادية مقابل الإصلاح.
              </div>
            </td>
          </tr>
        </tbody>

        <tfoot>
          <tr>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
