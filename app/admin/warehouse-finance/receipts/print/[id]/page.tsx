'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getWarehouseReceipt, getAllCustomers } from '@/lib/api';

export default function WarehouseReceiptPrintPage() {
  const params = useParams();
  const receiptId = params?.id as string;
  
  const [receiptData, setReceiptData] = useState<{
    receipt_id: string;
    customer_id?: string;
    customer_name?: string;
    customer_shamel_no?: string;
    date: string;
    cash_amount: number;
    check_amount: number;
    notes?: string;
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
      const customerName = receiptData.customer_name || 'عميل';
      const receiptId = receiptData.receipt_id || '';
      document.title = `${customerName} ${receiptId}`;
      
      // Auto-print when page loads in the new window
      // Use longer delay to ensure content is fully rendered and prevent blocking
      const timer = setTimeout(() => {
        // Only print if window is focused (to avoid issues)
        if (window.document.readyState === 'complete') {
          window.print();
        }
      }, 800); // Longer delay to ensure rendering is complete
      return () => clearTimeout(timer);
    }
  }, [receiptData, loading]);

  const loadReceiptData = async () => {
    try {
      setLoading(true);
      setError(null);

      const receipt = await getWarehouseReceipt(receiptId);
      
      // Fetch customer name and Shamel No if customer_id exists
      let customerName = '';
      let customerShamelNo = '';
      if (receipt.customer_id) {
        try {
          const customers = await getAllCustomers();
          const customer = customers.find((c: any) => {
            const customerId = c.CustomerID || c.id || c.customer_id || '';
            return customerId === receipt.customer_id;
          });
          if (customer) {
            customerName = customer.Name || customer.name || '';
            customerShamelNo = customer.ShamelNo || customer['Shamel No'] || customer.shamel_no || customer.shamelNo || '';
          }
        } catch (err) {
          console.error('[WarehouseReceiptPrint] Failed to load customer:', err);
        }
      }

      setReceiptData({
        receipt_id: receipt.receipt_id,
        customer_id: receipt.customer_id,
        customer_name: customerName,
        customer_shamel_no: customerShamelNo,
        date: receipt.date,
        cash_amount: receipt.cash_amount || 0,
        check_amount: receipt.check_amount || 0,
        notes: receipt.notes || undefined,
      });
    } catch (err: any) {
      console.error('[WarehouseReceiptPrint] Error loading receipt:', err);
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
      <div className="no-print" style={{ padding: '12px', textAlign: 'center', background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
          <button
            onClick={() => window.print()}
            style={{
              padding: '8px 16px',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#1d4ed8'}
            onMouseOut={(e) => e.currentTarget.style.background = '#2563eb'}
          >
            🖨️ طباعة
          </button>
          <button
            onClick={() => window.close()}
            style={{
              padding: '8px 16px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#4b5563'}
            onMouseOut={(e) => e.currentTarget.style.background = '#6b7280'}
          >
            ✕ إغلاق
          </button>
        </div>
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
                <div className="titleMain">سند قبض - مستودع</div>
                <div className="titleId">{receiptData.receipt_id}</div>
              </div>

              <div className="meta">
                <div className="chip">
                  التاريخ: <span>{formatDate(receiptData.date)}</span>
                </div>
                {receiptData.customer_name && (
                  <div className="chip">
                    الزبون: <span>{receiptData.customer_name}</span>
                  </div>
                )}
                {receiptData.customer_shamel_no && (
                  <div className="chip">
                    رقم الشامل: <span>{receiptData.customer_shamel_no}</span>
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
                  {receiptData.cash_amount > 0 && (
                    <tr>
                      <td className="label" style={{ fontWeight: 700 }}>المبلغ النقدي</td>
                      <td className="value" style={{ fontWeight: 700 }}>{receiptData.cash_amount.toFixed(2)} ₪</td>
                    </tr>
                  )}
                  {receiptData.check_amount > 0 && (
                    <tr>
                      <td className="label" style={{ fontWeight: 700 }}>المبلغ بالشيك</td>
                      <td className="value" style={{ fontWeight: 700 }}>{receiptData.check_amount.toFixed(2)} ₪</td>
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
                      {(receiptData.cash_amount + receiptData.check_amount).toFixed(2)} ₪
                    </td>
                  </tr>
                </tbody>
              </table>

              {receiptData.notes && receiptData.notes.trim().length > 0 && (
                <div className="notesBox">
                  <div className="notesHeader">ملاحظات:</div>
                  <div className="notesContent">{receiptData.notes}</div>
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

