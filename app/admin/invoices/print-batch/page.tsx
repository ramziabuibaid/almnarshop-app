'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { getCashInvoiceDetailsFromSupabase } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface InvoiceItem {
  productID: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  barcode?: string;
  shamelNo?: string;
  serialNos?: string[];
}

interface InvoicePrintData {
  invoiceID: string;
  dateTime: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  netTotal: number;
  notes?: string;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const dateStr = date.toLocaleDateString('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${dateStr} ${timeStr}`;
}

function InvoiceSlip({ data }: { data: InvoicePrintData }) {
  return (
    <div className="invoice-container">
      <div className="header-section">
        <div className="company-name">شركة المنار للأجهزة الكهربائية</div>
        <div className="company-address">جنين - شارع الناصرة</div>
        <div className="company-phone">0599-048348 | 04-2438815</div>
      </div>
      <div className="title-section">
        <div className="invoice-title">فاتورة نقدية</div>
        <div className="invoice-number">#{data.invoiceID}</div>
      </div>
      <div className="date-section">التاريخ والوقت: {formatDate(data.dateTime)}</div>
      <table className="items-table">
        <thead>
          <tr>
            <th className="col-no">رقم</th>
            <th className="col-name">اسم الصنف</th>
            <th className="col-qty">الكمية</th>
            <th className="col-price">السعر</th>
            <th className="col-amount">المبلغ</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, index) => (
            <tr key={index}>
              <td className="col-no">{item.shamelNo || item.barcode || item.productID}</td>
              <td className="col-name">
                <div>{item.name}</div>
                {item.serialNos && item.serialNos.length > 0 && (
                  <div
                    style={{
                      fontSize: '7px',
                      color: '#666',
                      marginTop: '2px',
                      fontFamily: 'monospace',
                      direction: 'ltr',
                      textAlign: 'left',
                      lineHeight: '1.2',
                    }}
                  >
                    {item.serialNos.map((serial, idx) => (
                      <span key={idx} style={{ display: 'block' }}>
                        {serial}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td className="col-qty">{item.quantity}</td>
              <td className="col-price">{item.unitPrice.toFixed(2)} ₪</td>
              <td className="col-amount">{item.total.toFixed(2)} ₪</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="summary-section">
        <table className="summary-table">
          <tbody>
            <tr>
              <td className="summary-label">المجموع</td>
              <td className="summary-value">{data.subtotal.toFixed(2)} ₪</td>
            </tr>
            {data.discount > 0 && (
              <tr>
                <td className="summary-label">خصم خاص</td>
                <td className="summary-value">- {data.discount.toFixed(2)} ₪</td>
              </tr>
            )}
            <tr className="summary-total">
              <td className="summary-label">الصافي للدفع</td>
              <td className="summary-value">{data.netTotal.toFixed(2)} ₪</td>
            </tr>
          </tbody>
        </table>
      </div>
      {data.notes && data.notes.trim().length > 0 && (
        <div className="notes-section">
          <div className="notes-header">ملاحظات:</div>
          <div className="notes-content">{data.notes}</div>
        </div>
      )}
    </div>
  );
}

function InvoicesPrintBatchContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<InvoicePrintData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isEmbed = searchParams.get('embed') === '1';
  const idsParam = searchParams.get('ids') ?? '';
  const idList = useMemo(
    () =>
      idsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [idsParam]
  );

  // اسم الملف عند حفظ PDF: الفواتير النقدية - طباعة محددة - تاريخ اليوم
  useEffect(() => {
    if (items.length === 0) return;
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); // YYYY-MM-DD
    const title = `الفواتير النقدية - طباعة محددة - ${dateStr}`;
    document.title = title;
  }, [items.length]);

  // عند التضمين (embed): إعلام الصفحة الأم لفتح نافذة الطباعة مع اسم الملف
  useEffect(() => {
    if (isEmbed && items.length > 0 && !loading) {
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
      const title = `الفواتير النقدية - طباعة محددة - ${dateStr}`;
      try {
        window.parent.postMessage({ type: 'batch-print-ready', title }, '*');
      } catch (_) {}
    }
  }, [isEmbed, items.length, loading]);

  useEffect(() => {
    if (idList.length === 0) {
      setError('لم يتم تحديد أي فواتير. استخدم صفحة الفواتير النقدية وحدد الفواتير ثم اضغط طباعة المحدد.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { getSerialNumbersByDetailId } = await import('@/lib/api_serial_numbers');
        const results: InvoicePrintData[] = [];

        for (const invoiceId of idList) {
          if (cancelled) return;

          const { data: invoiceHeader, error: headerError } = await supabase
            .from('cash_invoices')
            .select('*')
            .eq('invoice_id', invoiceId)
            .single();

          if (headerError || !invoiceHeader) {
            throw new Error(`فاتورة غير موجودة: ${invoiceId}`);
          }

          const details = await getCashInvoiceDetailsFromSupabase(invoiceId);
          if (!details || details.length === 0) {
            throw new Error(`الفاتورة ${invoiceId} لا تحتوي على أصناف`);
          }

          const itemsWithSerials = await Promise.all(
            details.map(async (item: any) => {
              let serialNos: string[] = [];
              if (item.detailID) {
                try {
                  serialNos = await getSerialNumbersByDetailId(item.detailID, 'cash');
                } catch (err) {
                  console.error('[InvoicePrintBatch] Failed to load serial numbers:', err);
                }
              }
              return {
                productID: item.productID,
                name: item.productName || '',
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.quantity * item.unitPrice,
                barcode: item.barcode,
                shamelNo: item.shamelNo,
                serialNos: serialNos.filter((s) => s && s.trim()),
              };
            })
          );

          const subtotal = details.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0);
          const discount = parseFloat(String(invoiceHeader.discount || 0)) || 0;
          const netTotal = subtotal - discount;

          results.push({
            invoiceID: invoiceId,
            dateTime: invoiceHeader.date_time,
            items: itemsWithSerials,
            subtotal,
            discount,
            netTotal,
            notes: invoiceHeader.notes || undefined,
          });
        }

        if (!cancelled) setItems(results);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'فشل تحميل إحدى الفواتير');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idsParam]);

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Cairo' }}>
        <p>جاري تحميل الفواتير...</p>
      </div>
    );
  }

  if (error || (items.length === 0 && idList.length > 0)) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Cairo' }}>
        <p style={{ color: 'red' }}>خطأ: {error || 'فشل تحميل الفواتير'}</p>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        html,
        body {
          width: 100%;
          min-height: 100%;
          background: white !important;
          color: black !important;
          direction: rtl;
          font-family: 'Cairo', Arial, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        @page {
          size: A6 portrait;
          margin: 0;
        }

        @media print {
          body {
            margin: 0;
            padding: 0;
          }

          .print-slip {
            page-break-after: always;
            padding: 3mm;
          }

          .print-slip:last-child {
            page-break-after: auto;
          }

          .no-print {
            display: none !important;
          }

          .invoice-container {
            width: 100%;
            max-width: 100%;
            margin: 0;
            padding: 3mm;
          }
        }

        @media screen {
          .print-slip .invoice-container {
            width: 105mm;
            min-height: 148mm;
            margin: 10px auto;
            padding: 3mm;
            background: white;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          }
        }

        .invoice-container {
          direction: rtl;
          font-family: 'Cairo', Arial, sans-serif;
          color: #000;
          background: white;
        }

        .header-section {
          border-bottom: 2px solid #000;
          padding-bottom: 4px;
          margin-bottom: 5px;
        }

        .company-name {
          font-size: 11px;
          font-weight: 700;
          text-align: center;
          margin-bottom: 2px;
          line-height: 1.3;
        }

        .company-address,
        .company-phone {
          font-size: 9px;
          text-align: center;
          margin-bottom: 2px;
          line-height: 1.3;
        }

        .title-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 5px 0;
          padding: 3px 0;
          border-bottom: 1px solid #000;
        }

        .invoice-title {
          font-size: 12px;
          font-weight: 700;
          text-align: center;
          flex: 1;
        }

        .invoice-number {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 6px;
          border: 1px solid #000;
          white-space: nowrap;
        }

        .date-section {
          font-size: 9px;
          text-align: center;
          margin: 3px 0;
          padding: 2px;
          border: 1px solid #000;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 4px 0;
          font-size: 9px;
        }

        .items-table thead {
          background-color: #f0f0f0;
        }

        .items-table th {
          border: 1px solid #000;
          padding: 3px 2px;
          text-align: center;
          font-weight: 700;
          font-size: 8px;
          white-space: nowrap;
        }

        .items-table td {
          border: 1px solid #000;
          padding: 2px;
          vertical-align: top;
        }

        .col-no {
          width: 12%;
          text-align: center;
          font-size: 8px;
        }

        .col-name {
          width: 40%;
          text-align: right;
          font-size: 9px;
          word-break: break-word;
          overflow-wrap: break-word;
        }

        .col-qty,
        .col-price,
        .col-amount {
          width: 10%;
          text-align: center;
          font-size: 9px;
        }

        .col-price {
          width: 18%;
        }

        .col-amount {
          width: 20%;
          font-weight: 600;
        }

        .summary-section {
          margin-top: 5px;
          border-top: 1px solid #000;
        }

        .summary-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9px;
        }

        .summary-table td {
          border: 1px solid #000;
          padding: 3px 4px;
        }

        .summary-label {
          text-align: right;
          font-weight: 600;
          width: 65%;
        }

        .summary-value {
          text-align: left;
          font-weight: 600;
          width: 35%;
          white-space: nowrap;
        }

        .summary-total {
          font-weight: 700;
          font-size: 10px;
        }

        .summary-total .summary-value {
          font-size: 11px;
        }

        .notes-section {
          margin-top: 5px;
          border: 1px solid #000;
          padding: 3px;
          font-size: 9px;
        }

        .notes-header {
          font-weight: 700;
          margin-bottom: 2px;
          font-size: 9px;
        }

        .notes-content {
          white-space: pre-wrap;
          word-break: break-word;
          overflow-wrap: break-word;
          line-height: 1.4;
          font-size: 8px;
        }

        .no-print {
          text-align: center;
          padding: 12px;
          background: #f5f5f5;
          border-bottom: 1px solid #eee;
        }

        .print-button {
          padding: 8px 20px;
          font-size: 16px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-family: 'Cairo', Arial, sans-serif;
          font-weight: 600;
        }

        .print-button:hover {
          background: #1d4ed8;
        }
      `}</style>

      {!isEmbed && (
        <div className="no-print">
          <button className="print-button" onClick={() => window.print()}>
            طباعة / حفظ PDF ({items.length} فاتورة)
          </button>
        </div>
      )}

      {items.map((data, index) => (
        <div
          key={data.invoiceID}
          className="print-slip"
          style={{
            pageBreakAfter: index < items.length - 1 ? 'always' : 'auto',
          }}
        >
          <InvoiceSlip data={data} />
        </div>
      ))}
    </>
  );
}

export default function InvoicesPrintBatchPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Cairo' }}>
          <p>جاري التحميل...</p>
        </div>
      }
    >
      <InvoicesPrintBatchContent />
    </Suspense>
  );
}
