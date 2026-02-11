'use client';

import { useEffect, useState } from 'react';
import { getMaintenance, getAllCustomers } from '@/lib/api';

export interface MaintenanceSlipData {
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
}

function formatDate(dateString: string) {
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
}

interface MaintenanceSlipContentProps {
  maintNo: string;
  onReady?: () => void;
  /** عند true يُلف المحتوى بـ class للطباعة من الصفحة الأم */
  embedInPage?: boolean;
}

export default function MaintenanceSlipContent({ maintNo, onReady, embedInPage }: MaintenanceSlipContentProps) {
  const [data, setData] = useState<MaintenanceSlipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!maintNo) {
      setError('رقم الصيانة مطلوب');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const maintenance = await getMaintenance(maintNo);
        if (cancelled) return;
        let customerShamelNo = '';
        if (maintenance.CustomerID) {
          try {
            const customers = await getAllCustomers();
            const customer = customers.find((c: any) => {
              const id = c.CustomerID || c.id || c.customer_id || '';
              return id === maintenance.CustomerID;
            });
            if (customer) {
              customerShamelNo = customer.ShamelNo || customer['Shamel No'] || customer.shamel_no || customer.shamelNo || '';
            }
          } catch (_) {}
        }
        setData({
          MaintNo: maintenance.MaintNo,
          CustomerID: maintenance.CustomerID,
          CustomerName: maintenance.CustomerName,
          CustomerShamelNo: customerShamelNo || undefined,
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
        if (!cancelled) setError(err?.message || 'فشل تحميل البيانات');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [maintNo]);

  useEffect(() => {
    if (!embedInPage || !data || loading) return;
    const t = setTimeout(() => {
      onReady?.();
    }, 400);
    return () => clearTimeout(t);
  }, [embedInPage, data, loading, onReady]);

  if (loading) {
    return (
      <div className="p-5 text-center font-cairo text-gray-600">
        جاري تحميل البيانات...
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-5 text-center font-cairo text-red-600">
        {error || 'فشل تحميل البيانات'}
      </div>
    );
  }

  const wrapClass = embedInPage ? 'maintenance-print-slip-only' : '';

  return (
    <div className={`maintenance-slip-wrap ${wrapClass}`} style={{ background: 'white', color: 'black', direction: 'rtl' }}>
      <style jsx>{`
        .maintenance-slip-wrap {
          --border: #1a1a1a;
          --border-light: #d1d5db;
          --pad: 5px;
          --gap: 6px;
          --fs: 12px;
          --fs-sm: 11px;
          --fs-lg: 14px;
          --header-bg: #f8f9fa;
        }
        .maintenance-slip-wrap table.sheet {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          direction: rtl;
        }
        .maintenance-slip-wrap .box {
          border: 2px solid var(--border);
          padding: var(--pad);
          border-radius: 4px;
        }
        .maintenance-slip-wrap .headerRow {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 8px;
        }
        .maintenance-slip-wrap .brand {
          text-align: right;
          margin-left: auto;
          font-size: var(--fs-sm);
          line-height: 1.3;
          font-weight: 600;
        }
        .maintenance-slip-wrap .titleRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin: 8px 0 6px;
        }
        .maintenance-slip-wrap .titleMain {
          flex: 1;
          text-align: center;
          border: 2px solid var(--border);
          padding: 6px;
          font-weight: 700;
          font-size: var(--fs-lg);
          background: var(--header-bg);
          border-radius: 4px;
        }
        .maintenance-slip-wrap .titleId {
          border: 2px solid var(--border);
          padding: 6px 10px;
          white-space: nowrap;
          font-size: var(--fs);
          font-weight: 700;
          background: var(--header-bg);
          border-radius: 4px;
        }
        .maintenance-slip-wrap .meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--gap);
          margin-bottom: 6px;
        }
        .maintenance-slip-wrap .chip {
          border: 1px solid var(--border-light);
          padding: 5px 8px;
          font-size: var(--fs-sm);
          background: #ffffff;
          border-radius: 4px;
          font-weight: 600;
        }
        .maintenance-slip-wrap .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--gap);
          margin-top: 6px;
        }
        .maintenance-slip-wrap .cell {
          border: 1px solid var(--border-light);
          padding: 6px;
          font-size: var(--fs);
          background: #ffffff;
          border-radius: 4px;
        }
        .maintenance-slip-wrap .cell .lbl {
          display: block;
          font-size: 10px;
          color: #666;
          margin-bottom: 3px;
          font-weight: 600;
        }
        .maintenance-slip-wrap .cell .value {
          font-weight: 600;
          color: #000;
        }
        .maintenance-slip-wrap .full {
          grid-column: 1 / -1;
        }
        .maintenance-slip-wrap .footerNote {
          border: 2px solid var(--border);
          padding: 6px;
          font-size: var(--fs-sm);
          margin-top: 6px;
          text-align: center;
          border-radius: 4px;
          background: #f9fafb;
          font-weight: 600;
        }
        @media print {
          .maintenance-slip-wrap {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      <table className="sheet">
        <thead>
          <tr>
            <td>
              <div className="box headerRow">
                <div className="brand">
                  <div style={{ fontSize: 'var(--fs)', fontWeight: 700, marginBottom: '2px' }}>
                    شركة المنار للأجهزة الكهربائية
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)' }}>جنين - شارع الناصرة</div>
                  <div style={{ fontSize: 'var(--fs-sm)' }}>0599-048348 | 04-2438815</div>
                </div>
              </div>
              <div className="titleRow">
                <div className="titleMain">استلام قطعة صيانة</div>
                <div className="titleId">{data.MaintNo}</div>
              </div>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div className="meta" style={{ marginBottom: '6px' }}>
                <div className="chip">
                  الزبون: <span style={{ fontWeight: 700 }}>{data.CustomerName}</span>
                  {data.CustomerShamelNo && (
                    <span style={{ marginRight: '6px', color: '#666', fontSize: '10px' }}>({data.CustomerShamelNo})</span>
                  )}
                </div>
                {data.CustomerPhone && (
                  <div className="chip">
                    الهاتف: <span>{data.CustomerPhone}</span>
                  </div>
                )}
              </div>
              <div className="grid">
                <div className="cell full">
                  <span className="lbl">اسم القطعة</span>
                  <div className="value">{data.ItemName || ''}</div>
                </div>
                <div className="cell">
                  <span className="lbl">تاريخ الشراء</span>
                  <div className="value">{formatDate(data.DateOfPurchase || '') || '—'}</div>
                </div>
                <div className="cell">
                  <span className="lbl">تاريخ الاستلام</span>
                  <div className="value">{formatDate(data.DateOfReceive || '') || '—'}</div>
                </div>
                <div className="cell">
                  <span className="lbl">الرقم التسلسلي</span>
                  <div className="value">{data.SerialNo || '—'}</div>
                </div>
                <div className="cell">
                  <span className="lbl">مكان الاستلام</span>
                  <div className="value">{data.Location || '—'}</div>
                </div>
                <div className="cell">
                  <span className="lbl">الشركة المكفلة</span>
                  <div className="value">{data.Company || '—'}</div>
                </div>
                <div className="cell">
                  <span className="lbl">ضمن الكفالة</span>
                  <div className="value">{data.UnderWarranty || '—'}</div>
                </div>
                <div className="cell full" style={{ minHeight: '40px' }}>
                  <span className="lbl">وصف العطل</span>
                  <div className="value" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {data.Problem || '—'}
                  </div>
                </div>
              </div>
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
