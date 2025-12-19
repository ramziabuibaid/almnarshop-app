'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getShopReceipt } from '@/lib/api';

export default function ReceiptPrintPage() {
  const params = useParams();
  const receiptId = params?.id as string;
  
  const [receiptData, setReceiptData] = useState<{
    ReceiptID: string;
    CustomerName: string;
    ShamelNo?: string;
    Date: string;
    CashAmount: number;
    ChequeAmount: number;
    TotalAmount: number;
    BalanceBefore?: number;
    BalanceAfter?: number;
    Notes?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!receiptId) {
      setError('Receipt ID is required');
      setLoading(false);
      return;
    }

    loadReceiptData();
  }, [receiptId]);

  useEffect(() => {
    // Set document title for PDF filename (customer name + receipt number)
    if (receiptData && !loading) {
      const customerName = receiptData.CustomerName || 'عميل';
      const receiptId = receiptData.ReceiptID || '';
      document.title = `${customerName} ${receiptId}`;
      
      // Auto-print when page loads in the new window
      // This won't freeze the main app because it's in a separate window
      const timer = setTimeout(() => {
        window.print();
      }, 500); // Slightly longer delay to ensure content is fully rendered
      return () => clearTimeout(timer);
    }
  }, [receiptData, loading]);

  const loadReceiptData = async () => {
    try {
      setLoading(true);
      setError(null);

      const receipt = await getShopReceipt(receiptId);

      setReceiptData({
        ReceiptID: receipt.ReceiptID,
        CustomerName: receipt.CustomerName,
        ShamelNo: receipt.ShamelNo,
        Date: receipt.Date,
        CashAmount: receipt.CashAmount,
        ChequeAmount: receipt.ChequeAmount,
        TotalAmount: receipt.TotalAmount,
        BalanceBefore: receipt.BalanceBefore,
        BalanceAfter: receipt.BalanceAfter,
        Notes: receipt.Notes || undefined,
      });
    } catch (err: any) {
      console.error('[ReceiptPrint] Error loading receipt:', err);
      setError(err.message || 'Failed to load receipt');
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
        <p>جاري تحميل السند...</p>
      </div>
    );
  }

  if (error || !receiptData) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Tajawal' }}>
        <p style={{ color: 'red' }}>خطأ: {error || 'فشل تحميل السند'}</p>
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
                <div className="titleMain">سند قبض</div>
                <div className="titleId">{receiptData.ReceiptID}</div>
              </div>

              <div className="meta">
                <div className="chip">
                  التاريخ: <span>{formatDate(receiptData.Date)}</span>
                </div>
                <div className="chip">
                  العميل: <span>{receiptData.CustomerName}</span>
                </div>
                {receiptData.ShamelNo && (
                  <div className="chip">
                    رقم الشامل: <span>{receiptData.ShamelNo}</span>
                  </div>
                )}
              </div>
            </td>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>
              <table className="summary">
                <tbody>
                  {receiptData.CashAmount > 0 && (
                    <tr>
                      <td className="label" style={{ fontWeight: 700 }}>المبلغ النقدي</td>
                      <td className="value" style={{ fontWeight: 700 }}>{receiptData.CashAmount.toFixed(2)} ₪</td>
                    </tr>
                  )}
                  {receiptData.ChequeAmount > 0 && (
                    <tr>
                      <td className="label" style={{ fontWeight: 700 }}>المبلغ بالشيك</td>
                      <td className="value" style={{ fontWeight: 700 }}>{receiptData.ChequeAmount.toFixed(2)} ₪</td>
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
                      {receiptData.TotalAmount.toFixed(2)} ₪
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Balance Before and After (only for receipts) */}
              {(receiptData.BalanceBefore != null || receiptData.BalanceAfter != null) && (
                <table className="summary" style={{ marginTop: '6px' }}>
                  <tbody>
                    {receiptData.BalanceBefore != null && (
                      <tr>
                        <td className="label" style={{ fontWeight: 700 }}>الرصيد قبل السند</td>
                        <td className="value" style={{ fontWeight: 700 }}>{receiptData.BalanceBefore.toFixed(2)} ₪</td>
                      </tr>
                    )}
                    {receiptData.BalanceAfter != null && (
                      <tr>
                        <td className="label" style={{ fontWeight: 700 }}>الرصيد بعد السند</td>
                        <td className="value" style={{ fontWeight: 700 }}>{receiptData.BalanceAfter.toFixed(2)} ₪</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {receiptData.Notes && receiptData.Notes.trim().length > 0 && (
                <div className="notesBox">
                  <div className="notesHeader">ملاحظات:</div>
                  <div className="notesContent">{receiptData.Notes}</div>
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

