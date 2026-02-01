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
}

export default function InvoicePrint({
  invoiceID,
  dateTime,
  items,
  subtotal,
  discount,
  netTotal,
  notes,
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
          --border: #222;
          --pad: 5px;
          --gap: 6px;
          --fs: 12px;      /* نص أساسي مقروء لـ A6 */
          --fs-sm: 11px;   /* ميتا */
          --fs-lg: 14px;   /* الإجماليات */
          /* أعمدة A6 محسّنة */
          --w-no: 16mm;    /* Item No */
          --w-qty: 10mm;   /* QTY */
          --w-price: 15mm; /* Price */
          --w-amt: 17mm;   /* AMOUNT */
        }

        /* A6 Default */
        @media print {
          @page {
            size: A6 portrait;
            margin: 0;
          }

          /* Prevent page breaks */
          .invoice-print {
            padding: 8mm 7mm 8mm 7mm !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }

          .invoice-print > * {
            page-break-inside: avoid !important;
          }
        }

        /* A4 - Dynamic scaling */
        @media print and (min-width: 200mm) {
          @page {
            size: A4 portrait;
            margin: 0;
          }

          .invoice-print {
            padding: 15mm !important;
            /* Scale up for A4 */
            --pad: 10px;
            --gap: 10px;
            --fs: 14px;
            --fs-sm: 13px;
            --fs-lg: 18px;
            --w-no: 25mm;
            --w-qty: 15mm;
            --w-price: 20mm;
            --w-amt: 25mm;
          }
        }

        html,
        body {
          height: 100%;
        }

        body {
          font-family: 'Tajawal', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
          font-weight: 700;
          margin: 0;
          padding: 0;
        }

        .invoice-print {
          direction: rtl;
          font-family: 'Tajawal', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
          font-weight: 700;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }

        .box {
          border: 1px solid var(--border);
          padding: var(--pad);
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
          font-size: var(--fs);
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
          margin-top: 2px;
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

        table.items {
          direction: rtl;
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
          page-break-inside: avoid;
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
        {/* الترويسة */}
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
          <div className="titleId">{invoiceID}</div>
        </div>

        {/* بيانات أساسية */}
        <div className="meta">
          <div className="chip">
            التاريخ والوقت: <span>{formatDate(dateTime)}</span>
          </div>
        </div>

        {/* جدول العناصر */}
        <table className="items">
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
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td className="ta-c nowrap">
                  {item.shamelNo || item.barcode || item.productID}
                </td>
                <td className="ta-r nameCell">
                  <div>{item.name}</div>
                  {item.serialNos && item.serialNos.length > 0 && item.serialNos.some(s => s && s.trim()) && (
                    <div style={{ 
                      fontSize: '10px', 
                      color: '#666', 
                      marginTop: '4px',
                      fontFamily: 'monospace',
                      direction: 'ltr',
                      textAlign: 'left'
                    }}>
                      {item.serialNos.filter(s => s && s.trim()).map((serial, idx) => (
                        <span key={idx} style={{ display: 'block', marginBottom: '2px' }}>
                          SN: {serial}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
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
              <td className="label">المجموع</td>
              <td className="value">{subtotal.toFixed(2)} ₪</td>
            </tr>
            {discount > 0 && (
              <tr>
                <td className="label">خصم خاص</td>
                <td className="value">- {discount.toFixed(2)} ₪</td>
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
                {netTotal.toFixed(2)} ₪
              </td>
            </tr>
          </tbody>
        </table>

        {/* ملاحظات (تظهر فقط عند وجودها) */}
        {notes && notes.trim().length > 0 && (
          <div className="notesBox">
            <div className="notesHeader">ملاحظات:</div>
            <div className="notesContent">{notes}</div>
          </div>
        )}
      </div>
    </>
  );
}
