'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getWarehouseSalesInvoice } from '@/lib/api';

interface InvoiceItem {
  ProductID: string;
  ProductName: string;
  ShamelNo?: string;
  Quantity: number;
  UnitPrice: number;
  TotalPrice: number;
  DetailsID?: string;
  serialNos?: string[];
}

export default function WarehouseSalesInvoicePrintPage() {
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

      const invoice = await getWarehouseSalesInvoice(invoiceId);

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
      console.error('[WarehouseSalesInvoicePrint] Error loading invoice:', err);
      setError(err.message || 'Failed to load invoice');
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
        <p>جاري تحميل الفاتورة...</p>
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Cairo' }}>
        <p style={{ color: 'red' }}>خطأ: {error || 'فشل تحميل الفاتورة'}</p>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', color: 'black', direction: 'rtl' }}>
      <style jsx global>{`
        :root {
          --border: #1a1a1a;
          --border-light: #d1d5db;
          --pad: 10px;
          --gap: 10px;
          --fs: 16px;      /* نص أساسي كبير وواضح لـ A4 */
          --fs-sm: 14px;   /* ميتا */
          --fs-lg: 20px;   /* الإجماليات */
          --fs-xl: 24px;   /* العنوان الرئيسي */
          --w-no: 10mm;
          --w-shamel: 25mm;
          --w-qty: 15mm;
          --w-price: 30mm;
          --w-amt: 35mm;
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
          line-height: 1.6;
        }

        @page {
          size: A4 portrait;
          margin: 15mm 20mm 15mm 20mm;
        }

        @media print {
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

          /* Prevent page breaks inside rows */
          tr {
            page-break-inside: avoid;
          }

          /* Allow page breaks between rows in tbody */
          tbody tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          /* Ensure header appears on every page */
          table.sheet thead {
            display: table-header-group;
          }

          table.sheet thead tr {
            page-break-after: auto;
            page-break-inside: avoid;
          }

          /* Customer info should stay with first items - no page break after */
          tbody tr:first-child {
            page-break-after: auto;
            page-break-inside: avoid;
          }

          /* Items should flow naturally */
          table.items {
            page-break-inside: auto;
          }

          table.items tbody tr {
            page-break-inside: avoid;
          }

          /* Reduce header spacing to fit more content on first page */
          table.sheet thead td {
            padding-bottom: 10px;
          }

          .box.headerRow {
            margin-bottom: 15px !important;
          }

          .titleRow {
            margin: 10px 0 !important;
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
          gap: 12px;
        }

        .brand {
          text-align: right;
          margin-left: auto;
          font-size: var(--fs-sm);
          line-height: 1.5;
          font-weight: 600;
        }

        .titleRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 12px 0;
        }

        .titleMain {
          flex: 1;
          text-align: center;
          border: 2px solid var(--border);
          padding: 12px;
          font-weight: 700;
          font-size: var(--fs-xl);
          background: var(--header-bg);
          border-radius: 4px;
        }

        .titleId {
          border: 2px solid var(--border);
          padding: 12px 16px;
          white-space: nowrap;
          font-size: var(--fs-lg);
          font-weight: 700;
          background: var(--header-bg);
          border-radius: 4px;
        }

        .meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--gap);
          margin-bottom: 12px;
        }

        .chip {
          border: 1px solid var(--border-light);
          padding: 8px 12px;
          font-size: var(--fs-sm);
          background: #ffffff;
          border-radius: 4px;
          font-weight: 600;
        }

        table.items {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: var(--fs);
          direction: rtl;
          margin-bottom: 20px;
        }

        table.items col.col-no { width: var(--w-no); }
        table.items col.col-shamel { width: var(--w-shamel); }
        table.items col.col-name { width: auto; }
        table.items col.col-qty { width: var(--w-qty); }
        table.items col.col-price { width: var(--w-price); }
        table.items col.col-amt { width: var(--w-amt); }

        table.items th,
        table.items td {
          border: 1px solid var(--border-light);
          padding: 10px 8px;
        }

        table.items th {
          background: var(--header-bg);
          text-align: center;
          font-weight: 700;
          font-size: var(--fs-sm);
          white-space: nowrap;
          border-bottom: 2px solid var(--border);
        }

        table.items td {
          vertical-align: top;
          font-weight: 600;
        }

        .ta-c { text-align: center; }
        .ta-r { text-align: right; }
        .nowrap { white-space: nowrap; }

        .nameCell {
          word-break: break-word;
          overflow-wrap: anywhere;
          text-align: right;
        }

        table.summary {
          width: 100%;
          margin-top: 20px;
          border-collapse: collapse;
          table-layout: fixed;
          direction: rtl;
          border: 2px solid var(--border);
          border-radius: 4px;
          overflow: hidden;
        }

        table.summary td {
          border: 1px solid var(--border-light);
          padding: 12px;
          font-size: var(--fs);
        }

        table.summary .label { 
          width: 60%; 
          text-align: right; 
          font-weight: 600;
          background: var(--header-bg);
        }
        table.summary .value { 
          width: 40%; 
          text-align: left; 
          white-space: nowrap; 
          font-weight: 700;
        }

        .notesBox {
          border: 2px solid var(--border);
          padding: 12px;
          margin-top: 20px;
          font-size: var(--fs);
          page-break-inside: auto;
          border-radius: 4px;
          background: #f9fafb;
        }

        .notesHeader { 
          font-weight: 700; 
          margin-bottom: 8px; 
          font-size: var(--fs-sm);
          color: #374151;
        }

        .notesContent {
          white-space: pre-wrap;
          word-break: break-word;
          overflow-wrap: anywhere;
          line-height: 1.6;
          font-weight: 600;
          color: #000;
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
              {/* Header box */}
              <div className="box headerRow" style={{ marginBottom: '20px' }}>
                <div className="brand">
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, marginBottom: '4px' }}>
                    شركة المنار للأجهزة الكهربائية
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', marginBottom: '2px' }}>
                    جنين - شارع الناصرة
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)' }}>
                    0599-048348 | 04-2438815
                  </div>
                </div>
              </div>

              {/* Title */}
              <div className="titleRow">
                <div className="titleMain">فاتورة مبيعات المخزن</div>
                <div className="titleId">{invoiceData.InvoiceID}</div>
              </div>
            </td>
          </tr>
        </thead>

        <tbody>
          {/* Customer Info and Items - first page content */}
          <tr>
            <td>
              {/* Meta */}
              <div className="meta" style={{ marginBottom: '20px' }}>
                {/* Row 1: Customer Name + Shamel No | Date */}
                <div className="chip" style={{ gridColumn: '1 / span 1' }}>
                  الزبون: <span style={{ fontWeight: 700 }}>{invoiceData.CustomerName}</span>
                  {invoiceData.CustomerShamelNo && (
                    <span style={{ marginRight: '8px', color: '#666' }}>({invoiceData.CustomerShamelNo})</span>
                  )}
                </div>
                <div className="chip" style={{ gridColumn: '2 / span 1' }}>
                  التاريخ: <span style={{ fontWeight: 700 }}>{formatDate(invoiceData.Date)}</span>
                </div>
                
                {/* Row 2: Phone */}
                {invoiceData.CustomerPhone && (
                  <div className="chip" style={{ gridColumn: '1 / span 1' }}>
                    الهاتف: <span>{invoiceData.CustomerPhone}</span>
                  </div>
                )}
                
                {/* Row 3: Address */}
                {invoiceData.CustomerAddress && (
                  <div className="chip" style={{ gridColumn: invoiceData.CustomerPhone ? '2 / span 1' : '1 / span 2' }}>
                    العنوان: <span>{invoiceData.CustomerAddress}</span>
                  </div>
                )}

              </div>

              {/* Items Table */}
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
                    <th>#</th>
                    <th>رقم المنتج</th>
                    <th>الصنف</th>
                    <th>الكمية</th>
                    <th>السعر</th>
                    <th>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceData.Items.map((item, index) => (
                    <tr key={index}>
                      <td className="ta-c nowrap">{index + 1}</td>
                      <td className="ta-c nowrap">{item.ShamelNo || item.ProductID || '—'}</td>
                      <td className="ta-r nameCell">
                        <div>{item.ProductName}</div>
                        {item.serialNos && item.serialNos.length > 0 && (
                          <div style={{ 
                            fontSize: '12px', 
                            color: '#666', 
                            marginTop: '4px',
                            fontFamily: 'monospace',
                            direction: 'ltr',
                            textAlign: 'left',
                            lineHeight: '1.4'
                          }}>
                            {item.serialNos.map((serial, idx) => (
                              <span key={idx} style={{ display: 'block', marginBottom: '2px' }}>
                                SN: {serial}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="ta-c nowrap">{item.Quantity}</td>
                      <td className="ta-c nowrap">{item.UnitPrice.toFixed(2)} ₪</td>
                      <td className="ta-c nowrap">{item.TotalPrice.toFixed(2)} ₪</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary */}
              <table className="summary">
                <tbody>
                  <tr>
                    <td className="label" style={{ fontWeight: 700 }}>المجموع</td>
                    <td className="value" style={{ fontWeight: 700 }}>{invoiceData.Subtotal.toFixed(2)} ₪</td>
                  </tr>
                  {invoiceData.Discount > 0 && (
                    <tr>
                      <td className="label" style={{ fontWeight: 700 }}>الخصم</td>
                      <td className="value" style={{ fontWeight: 700, color: '#b91c1c' }}>
                        - {invoiceData.Discount.toFixed(2)} ₪
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="label" style={{ fontWeight: 700 }}>
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

              {/* Notes */}
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
