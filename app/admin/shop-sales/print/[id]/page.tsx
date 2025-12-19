'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getShopSalesInvoice } from '@/lib/api';

interface InvoiceItem {
  ProductID: string;
  ProductName: string;
  ShamelNo?: string;
  Quantity: number;
  UnitPrice: number;
  TotalPrice: number;
}

export default function ShopSalesInvoicePrintPage() {
  const params = useParams();
  const invoiceId = params?.id as string;
  
  const [invoiceData, setInvoiceData] = useState<{
    InvoiceID: string;
    CustomerID: string;
    CustomerName: string;
    CustomerShamelNo?: string;
    CustomerPhone?: string;
    CustomerAddress?: string;
    Date: string;
    AccountantSign: string;
    Notes?: string;
    Discount: number;
    Status: string;
    Subtotal: number;
    TotalAmount: number;
    Items: InvoiceItem[];
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
    // Set document title for PDF filename (customer name + invoice number)
    if (invoiceData && !loading) {
      const customerName = invoiceData.CustomerName || 'عميل';
      const invoiceId = invoiceData.InvoiceID || '';
      document.title = `${customerName} ${invoiceId}`;
      
      // Auto-print when page loads in the new window
      // This won't freeze the main app because it's in a separate window
      const timer = setTimeout(() => {
        window.print();
      }, 500); // Slightly longer delay to ensure content is fully rendered
      return () => clearTimeout(timer);
    }
  }, [invoiceData, loading]);

  const loadInvoiceData = async () => {
    try {
      setLoading(true);
      setError(null);

      const invoice = await getShopSalesInvoice(invoiceId);

      setInvoiceData({
        InvoiceID: invoice.InvoiceID,
        CustomerID: invoice.CustomerID,
        CustomerName: invoice.CustomerName,
        CustomerShamelNo: invoice.CustomerShamelNo || undefined,
        CustomerPhone: invoice.CustomerPhone || undefined,
        CustomerAddress: invoice.CustomerAddress || undefined,
        Date: invoice.Date,
        AccountantSign: invoice.AccountantSign,
        Notes: invoice.Notes || undefined,
        Discount: invoice.Discount,
        Status: invoice.Status,
        Subtotal: invoice.Subtotal,
        TotalAmount: invoice.TotalAmount,
        Items: invoice.Items || [],
      });
    } catch (err: any) {
      console.error('[ShopSalesInvoicePrint] Error loading invoice:', err);
      setError(err.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      numberingSystem: 'latn',
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
          --fs: 12px;
          --fs-sm: 11px;
          --fs-lg: 14px;
          --w-no: 12mm;
          --w-shamel: 18mm;
          --w-qty: 8mm;
          --w-price: 15mm;
          --w-amt: 17mm;
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

        @page {
          size: A6 portrait;
          margin: 8mm 7mm 8mm 7mm;
        }

        @media print {
          .no-print {
            display: none;
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
          border: 1px solid var(--border);
          padding: var(--pad);
          direction: rtl;
        }

        .headerRow {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 8px;
          width: 100%;
        }

        .brand {
          text-align: right;
          font-size: var(--fs-sm);
          line-height: 1.3;
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

        table.items col.col-shamel {
          width: var(--w-shamel);
        }

        table.items col.col-name {
          width: auto;
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

        .nameCell {
          word-break: break-word;
          overflow-wrap: anywhere;
          text-align: right;
        }

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
              <div className="box headerRow">
                <div className="brand">
                  <div>شركة المنار للأجهزة الكهربائية</div>
                  <div>جنين - شارع الناصرة</div>
                  <div>0599-048348 | 04-2438815</div>
                </div>
              </div>

              <div className="titleRow">
                <div className="titleMain">فاتورة مبيعات المحل</div>
                <div className="titleId">{invoiceData.InvoiceID}</div>
              </div>

              <div className="meta">
                <div className="chip">
                  التاريخ: <span>{formatDate(invoiceData.Date)}</span>
                </div>
                <div className="chip">
                  العميل: <span>{invoiceData.CustomerName}</span>
                </div>
                {invoiceData.CustomerShamelNo && invoiceData.CustomerShamelNo.trim() ? (
                  <div className="chip">
                    رقم الشامل: <span>{invoiceData.CustomerShamelNo}</span>
                  </div>
                ) : null}
                {invoiceData.CustomerPhone && invoiceData.CustomerPhone.trim() ? (
                  <div className="chip">
                    الهاتف: <span>{invoiceData.CustomerPhone}</span>
                  </div>
                ) : null}
                {invoiceData.CustomerAddress && invoiceData.CustomerAddress.trim() ? (
                  <div className="chip">
                    العنوان: <span>{invoiceData.CustomerAddress}</span>
                  </div>
                ) : null}
                <div className="chip">
                  الحالة: <span>{invoiceData.Status}</span>
                </div>
              </div>
            </td>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>
              <table className="items">
                <colgroup>
                  <col className="col-no" />
                  <col className="col-shamel" />
                  <col className="col-name" />
                  <col className="col-qty" />
                  <col className="col-price" />
                  <col className="col-amt" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="ta-c">#</th>
                    <th className="ta-c">رقم المنتج</th>
                    <th className="ta-r">الصنف</th>
                    <th className="ta-c">الكمية</th>
                    <th className="ta-c">السعر</th>
                    <th className="ta-c">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceData.Items.map((item, index) => (
                    <tr key={index}>
                      <td className="ta-c">{index + 1}</td>
                      <td className="ta-c">{item.ShamelNo || '—'}</td>
                      <td className="nameCell">{item.ProductName} ({item.ProductID})</td>
                      <td className="ta-c">{item.Quantity}</td>
                      <td className="ta-c">{item.UnitPrice.toFixed(2)}</td>
                      <td className="ta-c">{item.TotalPrice.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <table className="summary">
                <tbody>
                  <tr>
                    <td className="label" style={{ fontWeight: 700 }}>المجموع</td>
                    <td className="value" style={{ fontWeight: 700 }}>{invoiceData.Subtotal.toFixed(2)} ₪</td>
                  </tr>
                  {invoiceData.Discount > 0 && (
                    <tr>
                      <td className="label" style={{ fontWeight: 700 }}>الخصم</td>
                      <td className="value" style={{ fontWeight: 700 }}>{invoiceData.Discount.toFixed(2)} ₪</td>
                    </tr>
                  )}
                  <tr>
                    <td className="label" style={{ fontWeight: 700, fontSize: 'var(--fs-lg)' }}>
                      الإجمالي
                    </td>
                    <td
                      className="value"
                      style={{
                        fontWeight: 700,
                        fontSize: 'var(--fs-lg)',
                      }}
                    >
                      {invoiceData.TotalAmount.toFixed(2)} ₪
                    </td>
                  </tr>
                </tbody>
              </table>

              {invoiceData.Notes && invoiceData.Notes.trim().length > 0 && (
                <div className="notesBox">
                  <div className="notesHeader">ملاحظات:</div>
                  <div className="notesContent">{invoiceData.Notes}</div>
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

