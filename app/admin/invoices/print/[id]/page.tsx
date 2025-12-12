'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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
}

export default function InvoicePrintPage() {
  const params = useParams();
  const invoiceId = params?.id as string;
  
  const [invoiceData, setInvoiceData] = useState<{
    invoiceID: string;
    dateTime: string;
    items: InvoiceItem[];
    subtotal: number;
    discount: number;
    netTotal: number;
    notes?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId) {
      setError('Invoice ID is required');
      setLoading(false);
      return;
    }

    loadInvoiceData();
  }, [invoiceId]);

  useEffect(() => {
    // Auto-print when page loads (matching Apps Script: setTimeout(()=>window.print(), 300))
    if (invoiceData && !loading) {
      const timer = setTimeout(() => {
        window.print();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [invoiceData, loading]);

  const loadInvoiceData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch invoice header
      const { data: invoiceHeader, error: headerError } = await supabase
        .from('cash_invoices')
        .select('*')
        .eq('invoice_id', invoiceId)
        .single();

      if (headerError || !invoiceHeader) {
        throw new Error(`Failed to fetch invoice: ${headerError?.message || 'Invoice not found'}`);
      }

      // Fetch invoice details
      const details = await getCashInvoiceDetailsFromSupabase(invoiceId);

      if (!details || details.length === 0) {
        throw new Error('Invoice has no items');
      }

      // Calculate totals
      const subtotal = details.reduce((sum, item) => {
        return sum + (item.quantity * item.unitPrice);
      }, 0);

      const discount = parseFloat(String(invoiceHeader.discount || 0)) || 0;
      const netTotal = subtotal - discount;

      // Map items
      const items: InvoiceItem[] = details.map((item) => ({
        productID: item.productID,
        name: item.productName || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice,
        barcode: item.barcode,
        shamelNo: item.shamelNo,
      }));

      setInvoiceData({
        invoiceID: invoiceId,
        dateTime: invoiceHeader.date_time,
        items,
        subtotal,
        discount,
        netTotal,
        notes: invoiceHeader.notes || undefined,
      });
    } catch (err: any) {
      console.error('[InvoicePrint] Error loading invoice:', err);
      setError(err.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Tajawal' }}>
        <p>جاري تحميل الفاتورة...</p>
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Tajawal' }}>
        <p style={{ color: 'red' }}>خطأ: {error || 'فشل تحميل الفاتورة'}</p>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', color: 'black', direction: 'rtl' }}>
      <style jsx global>{`
        :root {
          --border: #222;
          --pad: 5px;
          --gap: 6px;
          --fs: 12px;      /* نص أساسي مقروء لـ A6 */
          --fs-sm: 11px;   /* ميتا */
          --fs-lg: 14px;   /* الإجماليات */
          /* أعمدة A6 محسّنة */
          --w-no: 14mm;    /* Item No - مضيق */
          --w-qty: 8mm;   /* QTY - مضيق */
          --w-price: 15mm; /* Price */
          --w-amt: 17mm;   /* AMOUNT */
          /* ITEM NAME يأخذ الباقي (أعرض) */
        }

        html, body {
          height: 100%;
          background: white !important;
          color: black !important;
          direction: rtl;
        }

        body {
          font-family: 'Tajawal', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
          font-weight: 700;
          margin: 0;
          padding: 0;
          background: white !important;
          color: black !important;
          direction: rtl;
        }

        /* ورقة A6 وحدود مريحة للطابعات */
        @page {
          size: A6 portrait;
          margin: 8mm 7mm 8mm 7mm;
        }

        @media print {
          .no-print {
            display: none;
          }
        }

        /* الحاوية التي تكرّر الترويسة بكل صفحة عبر thead */
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
          border: 1px solid var(--border);
          padding: var(--pad);
        }

        .headerRow {
          display: flex;
          flex-direction: row-reverse;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }

        .brand {
          text-align: right;
          font-size: var(--fs-sm);
          line-height: 1.3;
        }

        .logo {
          width: 34px;
          height: auto;
          object-fit: contain;
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
          border: 1px solid var(--border);
          padding: 4px;
          font-weight: 700;
        }

        .titleId {
          border: 1px solid var(--border);
          padding: 4px 8px;
          white-space: nowrap;
          font-size: var(--fs);
        }

        .meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--gap);
          margin-bottom: 6px;
        }

        .chip {
          border: 1px solid var(--border);
          padding: 4px 6px;
          font-size: var(--fs-sm);
        }

        /* جدول العناصر */
        table.items {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: var(--fs);
          direction: rtl;
        }

        table.items col.col-no {
          width: var(--w-no);
        }

        table.items col.col-name {
          width: auto; /* يأخذ الباقي */
        }

        table.items col.col-qty {
          width: var(--w-qty);
        }

        table.items col.col-price {
          width: var(--w-price);
        }

        table.items col.col-amt {
          width: var(--w-amt);
        }

        table.items th,
        table.items td {
          border: 1px solid var(--border);
          padding: 4px;
        }

        table.items th {
          background: #f5f5f5;
          text-align: center;
          font-weight: 700;
          font-size: 11px;
          white-space: nowrap;
        }

        table.items td {
          vertical-align: top;
          font-weight: 700;
        }

        .ta-c {
          text-align: center;
        }

        .ta-r {
          text-align: right;
        }

        .nowrap {
          white-space: nowrap;
        }

        .nameCell {
          word-break: break-word;
          overflow-wrap: anywhere;
          text-align: right;
        }

        /* ملخصات */
        table.summary {
          width: 100%;
          margin-top: 6px;
          border-collapse: collapse;
          table-layout: fixed;
          direction: rtl;
        }

        table.summary td {
          border: 1px solid var(--border);
          padding: 6px;
          font-size: var(--fs);
        }

        table.summary .label {
          width: 60%;
          text-align: right;
        }

        table.summary .value {
          width: 40%;
          text-align: left;
          white-space: nowrap;
        }

        /* ملاحظات */
        .notesBox {
          border: 1px solid var(--border);
          padding: 6px;
          margin-top: 6px;
          font-size: var(--fs);
          page-break-inside: auto;
        }

        .notesHeader {
          font-weight: 700;
          margin-bottom: 4px;
        }

        .notesContent {
          white-space: pre-wrap;
          word-break: break-word;
          overflow-wrap: anywhere;
          line-height: 1.4;
          font-weight: 700;
          color: #000;
        }
      `}</style>
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Tajawal:wght@700&display=swap"
        rel="stylesheet"
      />
      <div className="no-print" style={{ padding: '8px', textAlign: 'center' }}>
        <button onClick={() => window.print()}>إعادة الطباعة</button>
      </div>
      <table className="sheet">
        <thead>
          <tr>
            <td>
              {/* الترويسة (تتكرر بكل صفحة) */}
              <div className="box headerRow">
                <div className="brand">
                  <div>شركة المنار للأجهزة الكهربائية</div>
                  <div>جنين - شارع الناصرة</div>
                  <div>0599-048348 | 04-2438815</div>
                </div>
              </div>

              {/* العنوان + رقم الفاتورة */}
              <div className="titleRow">
                <div className="titleMain">فاتورة نقدية</div>
                <div className="titleId">{invoiceData.invoiceID}</div>
              </div>

              {/* بيانات أساسية */}
              <div className="meta">
                <div className="chip">
                  التاريخ والوقت: <span>{formatDate(invoiceData.dateTime)}</span>
                </div>
              </div>

              {/* رأس جدول العناصر */}
              <table className="items" style={{ marginTop: '2px' }}>
                <colgroup>
                  <col className="col-no" />
                  <col className="col-name" />
                  <col className="col-qty" />
                  <col className="col-price" />
                  <col className="col-amt" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Item No</th>
                    <th>ITEM NAME</th>
                    <th>QTY</th>
                    <th>Price</th>
                    <th>AMOUNT</th>
                  </tr>
                </thead>
              </table>
            </td>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>
              {/* جسم جدول العناصر */}
              <table className="items">
                <colgroup>
                  <col className="col-no" />
                  <col className="col-name" />
                  <col className="col-qty" />
                  <col className="col-price" />
                  <col className="col-amt" />
                </colgroup>
                <tbody>
                  {invoiceData.items.map((item, index) => (
                    <tr key={index}>
                      <td className="ta-c nowrap">
                        {item.shamelNo || item.barcode || item.productID}
                      </td>
                      <td className="ta-r nameCell">{item.name}</td>
                      <td className="ta-c nowrap">{item.quantity}</td>
                      <td className="ta-c nowrap">
                        {item.unitPrice.toFixed(2)} ₪
                      </td>
                      <td className="ta-c nowrap">
                        {item.total.toFixed(2)} ₪
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* الملخصات */}
              <table className="summary">
                <tbody>
                  <tr>
                    <td className="label" style={{ fontWeight: 700 }}>المجموع</td>
                    <td className="value" style={{ fontWeight: 700 }}>{invoiceData.subtotal.toFixed(2)} ₪</td>
                  </tr>

                  {invoiceData.discount > 0 && (
                    <tr>
                      <td className="label" style={{ fontWeight: 700 }}>خصم خاص</td>
                      <td className="value" style={{ fontWeight: 700 }}>- {invoiceData.discount.toFixed(2)} ₪</td>
                    </tr>
                  )}

                  <tr>
                    <td className="label" style={{ fontWeight: 700 }}>
                      الصافي للدفع
                    </td>
                    <td
                      className="value"
                      style={{
                        fontWeight: 700,
                        fontSize: 'var(--fs-lg)',
                      }}
                    >
                      {invoiceData.netTotal.toFixed(2)} ₪
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ملاحظات (تظهر فقط عند وجودها) */}
              {invoiceData.notes && invoiceData.notes.trim().length > 0 && (
                <div className="notesBox">
                  <div className="notesHeader">ملاحظات:</div>
                  <div className="notesContent">{invoiceData.notes}</div>
                </div>
              )}
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
