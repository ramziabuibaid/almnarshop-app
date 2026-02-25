'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getMaintenance, getAllCustomers } from '@/lib/api';
import QRCode from '@/components/admin/QRCode';

export default function MaintenancePrintPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const isEmbed = searchParams?.get('embed') === '1';
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
    const customerName = maintenanceData.CustomerName || 'عميل';
    const docNo = maintenanceData.MaintNo || '';
    const title = `الصيانة - ${customerName} - ${docNo}`;
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
          --border-light: #e5e7eb;
          --pad: 6px;
          --gap: 6px;
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

        @page {
          size: A6 portrait;
          margin: 0;
        }

        @media print {
          html, body {
            height: 100%;
            overflow: hidden;
            margin: 0 !important;
            padding: 0 !important;
          }

          body {
            /* Fix iOS specific scaling push */
            padding: 3mm !important;
            box-sizing: border-box;
            max-height: 148mm; /* A6 height */
            /* Force subtle scale down on iOS print just in case */
            transform: scale(0.97);
            transform-origin: top center;
          }

          main {
            /* Constraint the main container */
            max-height: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
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
        }

        .brand-details {
          font-size: 9px;
          color: #4b5563;
          margin-top: 1px;
        }

        .doc-title-container {
          text-align: center;
          background: var(--primary);
          color: white;
          padding: 3px 10px;
          border-radius: 6px;
        }

        .doc-title {
          font-size: var(--fs-lg);
          font-weight: 700;
        }

        .doc-no {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .customer-card {
          border: 1.5px solid var(--border);
          border-radius: 6px;
          padding: 6px;
          margin-bottom: 6px;
          background: var(--header-bg);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          margin-bottom: 6px;
        }

        .info-cell {
          border: 1px solid var(--border-light);
          padding: 4px 6px;
          border-radius: 6px;
          background: #ffffff;
        }

        .info-cell.full {
          grid-column: 1 / -1;
        }

        .cell-label {
          font-size: var(--fs-sm);
          color: #6b7280;
          display: block;
          margin-bottom: 2px;
          font-weight: 700;
        }

        .cell-value {
          font-size: var(--fs);
          font-weight: 800;
          color: #111827;
        }

        .problem-cell {
          border: 1.5px dashed #9ca3af;
          background: #fdfcf8;
          padding: 6px;
          border-radius: 6px;
          margin-bottom: 8px;
          min-height: 40px;
        }

        .footer-grid {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          align-items: center;
          border-top: 2px solid var(--border);
          padding-top: 6px;
        }

        .qr-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border-light);
          padding: 4px;
          border-radius: 6px;
          background: white;
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
      `}</style>
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
            إعادة الطباعة
          </button>
        </div>
      )}

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
                    <div className="cell-value" dir="ltr">{maintenanceData.CustomerPhone}</div>
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
                    color: maintenanceData.UnderWarranty === 'نعم' ? '#059669' : '#dc2626'
                  }}>
                    {maintenanceData.UnderWarranty === 'نعم' ? 'ضمن الكفالة' : 'خارج الكفالة'}
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
                    <QRCode value={qrLink} size={55} margin={0} />
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
}
