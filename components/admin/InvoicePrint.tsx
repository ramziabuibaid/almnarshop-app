'use client';

interface InvoiceItem {
  productID: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  barcode?: string;
  shamelNo?: string; // رقم الشامل
  serialNos?: string[]; // Array of serial numbers
}

interface InvoicePrintProps {
  invoiceID: string;
  dateTime: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  netTotal: number;
  notes?: string;
  paymentMethod?: string;
  customerName?: string;
}

export default function InvoicePrint({
  invoiceID,
  dateTime,
  items,
  subtotal,
  discount,
  netTotal,
  notes,
  paymentMethod,
  customerName,
}: InvoicePrintProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    // Use Asia/Jerusalem timezone for Palestine (UTC+2 or UTC+3)
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

  return (
    <>
      <style jsx global>{`
        /* Screen: Hide invoice print */
        @media screen {
          .invoice-print {
            display: none !important;
          }
        }

        /* Print: Show only invoice */
        @media print {
          /* Reset page settings */
          @page {
            margin: 0;
            size: auto;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            height: auto !important;
            width: 100% !important;
            overflow: visible !important;
          }

          /* Hide everything using visibility */
          body * {
            visibility: hidden !important;
          }

          /* Show invoice-print and all its descendants */
          .invoice-print,
          .invoice-print * {
            visibility: visible !important;
          }

          /* Show invoice-print */
          .invoice-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-after: auto !important;
            page-break-before: auto !important;
            page-break-inside: avoid !important;
            height: auto !important;
            overflow: visible !important;
            direction: rtl !important;
            display: block !important;
          }

          /* Ensure all children of invoice-print maintain their display */
          .invoice-print * {
            display: revert !important;
          }

          /* Ensure table elements are visible */
          .invoice-print table {
            display: table !important;
            width: 100% !important;
            visibility: visible !important;
          }

          .invoice-print tr {
            display: table-row !important;
            visibility: visible !important;
          }

          .invoice-print td,
          .invoice-print th {
            display: table-cell !important;
            visibility: visible !important;
          }

          /* Hide modal and overlay elements */
          [class*="fixed"]:not(.invoice-print),
          [class*="z-40"],
          [class*="z-50"] {
            display: none !important;
            visibility: hidden !important;
          }
        }

        /* CSS Variables for dynamic sizing */
        .invoice-print {
          --primary-color: #1e293b;
          --secondary-color: #64748b;
          --border-color: #e2e8f0;
          --bg-light: #f8fafc;
          /* Default to highly compact sizing for A6/Thermal */
          --pad: 6px;
          --gap: 4px;
          --fs-xs: 8px;
          --fs-sm: 9px;
          --fs: 11px;
          --fs-lg: 13px;
          --fs-xl: 16px;
          --radius: 6px;
          --margin-block: 8px; /* Used for spacing between major sections */
          
          /* أعمدة A6 محسّنة */
          --w-no: 16mm;
          --w-qty: 12mm;
          --w-price: 18mm;
          --w-amt: 20mm;
        }

        /* Base Print settings (Defaults to A6 / Thermal aesthetics) */
        @media print {
          @page {
            size: auto; /* Let the printer driver and user selection dictate A4 or A6 */
            margin: 0;
          }

          .invoice-print {
            padding: 3mm !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }

          /* Prevent specific sections from breaking across pages */
          .header-section, .invoice-header-info, .table-container, .summary-wrapper, .notesBox, .footer-message {
            page-break-inside: avoid !important;
          }
        }

        /* Desktop / A4 - Dynamic scaling (Triggered when print page width > 150mm) */
        @media print and (min-width: 150mm) {
          .invoice-print {
            padding: 20mm !important;
            --pad: 14px;
            --gap: 12px;
            --fs-xs: 11px;
            --fs-sm: 13px;
            --fs: 15px;
            --fs-lg: 18px;
            --fs-xl: 24px;
            --radius: 8px;
            --margin-block: 20px;
            
            --w-no: 25mm;
            --w-qty: 15mm;
            --w-price: 25mm;
            --w-amt: 30mm;
          }
        }

        html, body {
          height: 100%;
        }

        body {
          font-family: 'Tajawal', system-ui, -apple-system, sans-serif;
          margin: 0;
          padding: 0;
          color: var(--primary-color);
        }

        .invoice-print {
          direction: rtl;
          font-family: 'Tajawal', system-ui, -apple-system, sans-serif;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          color: var(--primary-color);
        }

        /* Header Section */
        .header-section {
          text-align: center;
          margin-bottom: var(--margin-block);
          padding-bottom: var(--margin-block);
          border-bottom: 2px dashed var(--border-color);
        }

        .company-title {
          font-size: var(--fs-xl);
          font-weight: 800;
          letter-spacing: -0.5px;
          margin-bottom: 4px;
          color: #0f172a;
        }

        .company-subtitle {
          font-size: var(--fs-sm);
          color: var(--secondary-color);
          font-weight: 500;
          line-height: 1.5;
        }

        /* Title & Meta Info */
        .invoice-header-info {
          display: flex;
          flex-direction: column;
          gap: var(--margin-block);
          margin-bottom: var(--margin-block);
        }

        .invoice-type-badge {
          align-self: flex-start;
          background: var(--bg-light);
          border: 1px solid var(--border-color);
          padding: 4px 12px;
          border-radius: 20px;
          font-size: var(--fs-lg);
          font-weight: 800;
          color: #0f172a;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }

        .meta-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          background: var(--bg-light);
          padding: var(--pad);
          border-radius: var(--radius);
          border: 1px solid var(--border-color);
        }

        .meta-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .meta-item.full-width {
          grid-column: 1 / -1;
        }

        .meta-label {
          font-size: var(--fs-xs);
          color: var(--secondary-color);
          font-weight: 600;
          text-transform: uppercase;
        }

        .meta-value {
          font-size: var(--fs);
          font-weight: 700;
          color: var(--primary-color);
        }

        /* Items Table */
        .table-container {
          border: 1px solid var(--border-color);
          border-radius: var(--radius);
          overflow: hidden;
          margin-bottom: var(--margin-block);
        }

        table.items {
          width: 100%;
          border-collapse: collapse;
          table-layout: auto;
          font-size: var(--fs);
          background: white;
        }

        table.items th,
        table.items td {
          padding: 6px var(--pad);
          text-align: right;
          border-bottom: 1px solid var(--border-color);
        }

        table.items tr:last-child td {
          border-bottom: none;
        }

        table.items th {
          background: var(--bg-light);
          font-weight: 800;
          font-size: var(--fs-sm);
          color: var(--secondary-color);
          text-transform: uppercase;
        }

        table.items td {
          font-weight: 600;
          vertical-align: middle;
        }

        .ta-c { text-align: center !important; }
        .ta-l { text-align: left !important; }
        .nowrap { white-space: nowrap; }

        .item-name-cell {
          font-weight: 700;
          color: #0f172a;
        }

        .item-serial {
          font-size: var(--fs-xs);
          color: var(--secondary-color);
          font-family: monospace;
          margin-top: 4px;
          display: block;
          direction: ltr;
        }

        /* Summary Section */
        .summary-wrapper {
          display: flex;
          justify-content: flex-end;
          margin-top: calc(var(--margin-block) / 2);
        }

        table.summary {
          width: 80%;
          border-collapse: collapse;
          direction: rtl;
        }

        table.summary td {
          padding: 4px 8px;
          font-size: var(--fs);
          border-bottom: 1px dashed var(--border-color);
        }

        table.summary tr:last-child td {
          border-bottom: none;
        }

        table.summary .label {
          text-align: right;
          color: var(--secondary-color);
          font-weight: 600;
        }

        table.summary .value {
          text-align: left;
          font-weight: 800;
          white-space: nowrap;
        }

        table.summary .total-row td {
          padding-top: 8px;
          font-size: var(--fs-lg);
          color: #0f172a;
        }
        
        table.summary .total-row .value {
          color: #16a34a; /* Green for net total */
        }

        /* Notes Section */
        .notesBox {
          margin-top: var(--margin-block);
          padding: 10px;
          background: #fffbeb; /* Light yellow warning/note bg */
          border: 1px solid #fde68a;
          border-radius: var(--radius);
          font-size: var(--fs-sm);
          page-break-inside: avoid;
        }

        .notesHeader {
          font-weight: 800;
          color: #d97706;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .notesContent {
          white-space: pre-wrap;
          word-break: break-word;
          line-height: 1.4;
          color: #92400e;
          font-weight: 600;
        }
        
        .footer-message {
          text-align: center;
          margin-top: var(--margin-block);
          padding-top: var(--margin-block);
          border-top: 1px dashed var(--border-color);
          font-size: var(--fs-xs);
          color: var(--secondary-color);
          font-weight: 600;
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
      <div className="invoice-print">
        {/* Header Content */}
        <div className="header-section">
          <div className="company-title">شركة المنار للأجهزة الكهربائية</div>
          <div className="company-subtitle">
            جنين - شارع الناصرة<br />
            0599-048348 | 04-2438815
          </div>
        </div>

        {/* Info & Meta */}
        <div className="invoice-header-info">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="invoice-type-badge">
              {paymentMethod === 'ذمة مالية' ? 'فاتورة ذمة مالية' : paymentMethod === 'فيزا' ? 'فاتورة فيزا' : 'فاتورة مبيعات نقدية'}
            </div>
            <div style={{ fontSize: 'var(--fs)', fontWeight: 800 }}>#{invoiceID}</div>
          </div>

          <div className="meta-grid">
            <div className="meta-item">
              <span className="meta-label">التاريخ والوقت</span>
              <span className="meta-value">{formatDate(dateTime)}</span>
            </div>
            {paymentMethod && paymentMethod !== 'ذمة مالية' && paymentMethod !== 'فيزا' && paymentMethod !== 'نقداً' && (
              <div className="meta-item">
                <span className="meta-label">طريقة الدفع</span>
                <span className="meta-value">{paymentMethod}</span>
              </div>
            )}
            {customerName && (
              <div className="meta-item full-width">
                <span className="meta-label">اسم الزبون</span>
                <span className="meta-value">{customerName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="table-container">
          <table className="items">
            <thead>
              <tr>
                <th style={{ width: '15%' }}>رقم</th>
                <th style={{ width: '45%' }}>الصنف</th>
                <th className="ta-c" style={{ width: '10%' }}>الكمية</th>
                <th className="ta-c" style={{ width: '15%' }}>السعر</th>
                <th className="ta-l" style={{ width: '15%' }}>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="nowrap" style={{ fontSize: 'var(--fs-sm)' }}>
                    {item.shamelNo || item.barcode || item.productID}
                  </td>
                  <td>
                    <div className="item-name-cell">{item.name}</div>
                    {item.serialNos && item.serialNos.length > 0 && item.serialNos.some(s => s && s.trim()) && (
                      <div className="item-serial">
                        {item.serialNos.filter(s => s && s.trim()).map((serial, idx) => (
                          <span key={idx} style={{ display: 'block' }}>SN: {serial}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="ta-c">{item.quantity}</td>
                  <td className="ta-c nowrap">{item.unitPrice.toFixed(2)} ₪</td>
                  <td className="ta-l nowrap">{item.total.toFixed(2)} ₪</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="summary-wrapper">
          <table className="summary">
            <tbody>
              <tr>
                <td className="label">المجموع:</td>
                <td className="value">{subtotal.toFixed(2)} ₪</td>
              </tr>
              {discount > 0 && (
                <tr>
                  <td className="label" style={{ color: '#ef4444' }}>خصم خاص:</td>
                  <td className="value" style={{ color: '#ef4444' }}>- {discount.toFixed(2)} ₪</td>
                </tr>
              )}
              <tr className="total-row">
                <td className="label" style={{ color: '#0f172a' }}>الصافي للدفع:</td>
                <td className="value">{netTotal.toFixed(2)} ₪</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notes */}
        {notes && notes.trim().length > 0 && (
          <div className="notesBox">
            <div className="notesHeader">
              <span>📝</span> ملاحظات الفاتورة:
            </div>
            <div className="notesContent">{notes}</div>
          </div>
        )}

        <div className="footer-message">
          شكراً لتسوقكم من شركة المنار للأجهزة الكهربائية
        </div>
      </div>
    </>
  );
}
