'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { getShopReceipt, getShopPayment } from '@/lib/api';

type SlipItem =
  | { type: 'receipt'; id: string; data: Awaited<ReturnType<typeof getShopReceipt>> }
  | { type: 'payment'; id: string; data: Awaited<ReturnType<typeof getShopPayment>> };

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

function ReceiptSlip({ data }: { data: NonNullable<SlipItem['data']> extends infer R ? R : never }) {
  const d = data as {
    ReceiptID: string;
    CustomerName: string;
    ShamelNo?: string;
    CustomerPhone?: string;
    Date: string;
    CashAmount: number;
    ChequeAmount: number;
    TotalAmount: number;
    BalanceBefore?: number;
    BalanceAfter?: number;
    Notes?: string;
  };
  return (
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
              <div className="titleMain">سند قبض</div>
              <div className="titleId">{d.ReceiptID}</div>
            </div>
            <div className="meta">
              <div className="chip">
                التاريخ: <span style={{ fontWeight: 700 }}>{formatDate(d.Date)}</span>
              </div>
              <div className="chip">
                الزبون: <span style={{ fontWeight: 700 }}>{d.CustomerName}</span>
                {d.ShamelNo && (
                  <span style={{ marginRight: '6px', color: '#666', fontSize: '10px' }}>({d.ShamelNo})</span>
                )}
              </div>
              {d.CustomerPhone && (
                <div className="chip" style={{ gridColumn: '1 / span 1' }}>
                  الهاتف: <span>{d.CustomerPhone}</span>
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
                {d.CashAmount > 0 && (
                  <tr>
                    <td className="label" style={{ fontWeight: 700 }}>
                      المبلغ النقدي
                    </td>
                    <td className="value" style={{ fontWeight: 700 }}>
                      {d.CashAmount.toFixed(2)} ₪
                    </td>
                  </tr>
                )}
                {d.ChequeAmount > 0 && (
                  <tr>
                    <td className="label" style={{ fontWeight: 700 }}>
                      المبلغ بالشيك
                    </td>
                    <td className="value" style={{ fontWeight: 700 }}>
                      {d.ChequeAmount.toFixed(2)} ₪
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="label" style={{ fontWeight: 700 }}>
                    الإجمالي
                  </td>
                  <td className="value" style={{ fontWeight: 700, fontSize: 'var(--fs-lg)' }}>
                    {d.TotalAmount.toFixed(2)} ₪
                  </td>
                </tr>
              </tbody>
            </table>
            {(d.BalanceBefore != null || d.BalanceAfter != null) && (
              <table className="summary" style={{ marginTop: '6px' }}>
                <tbody>
                  {d.BalanceBefore != null && (
                    <tr>
                      <td className="label" style={{ fontWeight: 700 }}>
                        الرصيد قبل السند
                      </td>
                      <td className="value" style={{ fontWeight: 700 }}>
                        {d.BalanceBefore.toFixed(2)} ₪
                      </td>
                    </tr>
                  )}
                  {d.BalanceAfter != null && (
                    <tr>
                      <td className="label" style={{ fontWeight: 700 }}>
                        الرصيد بعد السند
                      </td>
                      <td className="value" style={{ fontWeight: 700 }}>
                        {d.BalanceAfter.toFixed(2)} ₪
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            {d.Notes && d.Notes.trim().length > 0 && (
              <div className="notesBox">
                <div className="notesHeader">ملاحظات:</div>
                <div className="notesContent">{d.Notes}</div>
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
  );
}

function PaymentSlip({ data }: { data: NonNullable<SlipItem['data']> extends infer R ? R : never }) {
  const d = data as {
    PayID: string;
    CustomerName: string;
    ShamelNo?: string;
    CustomerPhone?: string;
    Date: string;
    CashAmount: number;
    ChequeAmount: number;
    TotalAmount: number;
    Notes?: string;
  };
  return (
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
              <div className="titleMain">سند دفع</div>
              <div className="titleId">{d.PayID}</div>
            </div>
            <div className="meta">
              <div className="chip">
                التاريخ: <span style={{ fontWeight: 700 }}>{formatDate(d.Date)}</span>
              </div>
              <div className="chip">
                الزبون: <span style={{ fontWeight: 700 }}>{d.CustomerName}</span>
                {d.ShamelNo && (
                  <span style={{ marginRight: '6px', color: '#666', fontSize: '10px' }}>({d.ShamelNo})</span>
                )}
              </div>
              {d.CustomerPhone && (
                <div className="chip" style={{ gridColumn: '1 / span 1' }}>
                  الهاتف: <span>{d.CustomerPhone}</span>
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
                {d.CashAmount > 0 && (
                  <tr>
                    <td className="label" style={{ fontWeight: 700 }}>
                      المبلغ النقدي
                    </td>
                    <td className="value" style={{ fontWeight: 700 }}>
                      {d.CashAmount.toFixed(2)} ₪
                    </td>
                  </tr>
                )}
                {d.ChequeAmount > 0 && (
                  <tr>
                    <td className="label" style={{ fontWeight: 700 }}>
                      المبلغ بالشيك
                    </td>
                    <td className="value" style={{ fontWeight: 700 }}>
                      {d.ChequeAmount.toFixed(2)} ₪
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="label" style={{ fontWeight: 700 }}>
                    الإجمالي
                  </td>
                  <td className="value" style={{ fontWeight: 700, fontSize: 'var(--fs-lg)' }}>
                    {d.TotalAmount.toFixed(2)} ₪
                  </td>
                </tr>
              </tbody>
            </table>
            {d.Notes && d.Notes.trim().length > 0 && (
              <div className="notesBox">
                <div className="notesHeader">ملاحظات:</div>
                <div className="notesContent">{d.Notes}</div>
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
  );
}

export default function ShopCashBoxPrintBatchPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<SlipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const idsParam = searchParams.get('ids') ?? '';
  const idList = useMemo(() => {
    return idsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [idsParam]);

  const parsed = useMemo(() => {
    const result: { type: 'receipt' | 'payment'; id: string }[] = [];
    for (const part of idList) {
      if (part.startsWith('receipt:')) {
        result.push({ type: 'receipt', id: part.slice('receipt:'.length) });
      } else if (part.startsWith('payment:')) {
        result.push({ type: 'payment', id: part.slice('payment:'.length) });
      }
    }
    return result;
  }, [idList]);

  // اسم الملف الافتراضي عند حفظ PDF: صندوق المحل سندات قبض وصرف + تاريخ اليوم
  useEffect(() => {
    if (items.length === 0) return;
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); // YYYY-MM-DD
    document.title = `صندوق المحل سندات قبض وصرف ${dateStr}`;
  }, [items.length]);

  useEffect(() => {
    if (parsed.length === 0) {
      setError('لم يتم تحديد أي سندات. استخدم صفحة صندوق المحل وحدد السندات ثم اضغط طباعة المحدد.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const results: SlipItem[] = [];
        for (const { type, id } of parsed) {
          if (cancelled) return;
          if (type === 'receipt') {
            const data = await getShopReceipt(id);
            results.push({ type: 'receipt', id, data });
          } else {
            const data = await getShopPayment(id);
            results.push({ type: 'payment', id, data });
          }
        }
        if (!cancelled) setItems(results);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'فشل تحميل أحد السندات');
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
        <p>جاري تحميل السندات...</p>
      </div>
    );
  }

  if (error || (items.length === 0 && parsed.length > 0)) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Cairo' }}>
        <p style={{ color: 'red' }}>خطأ: {error || 'فشل تحميل السندات'}</p>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', color: 'black', direction: 'rtl' }}>
      <style jsx global>{`
        :root {
          --border: #1a1a1a;
          --border-light: #d1d5db;
          --pad: 5px;
          --gap: 6px;
          --fs: 12px;
          --fs-sm: 11px;
          --fs-lg: 14px;
          --header-bg: #f8f9fa;
        }

        html,
        body {
          height: auto;
          min-height: 100%;
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
          line-height: 1.4;
        }

        @page {
          size: A6 portrait;
          margin: 0;
        }

        @media print {
          body {
            padding: 0;
          }

          .print-slip {
            page-break-after: always;
            padding: 8mm 7mm 8mm 7mm;
          }

          .print-slip:last-child {
            page-break-after: auto;
          }

          .no-print {
            display: none !important;
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
          gap: 8px;
        }

        .brand {
          text-align: right;
          margin-left: auto;
          font-size: var(--fs-sm);
          line-height: 1.3;
          font-weight: 600;
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
          border: 2px solid var(--border);
          padding: 6px;
          font-weight: 700;
          font-size: var(--fs-lg);
          background: var(--header-bg);
          border-radius: 4px;
        }

        .titleId {
          border: 2px solid var(--border);
          padding: 6px 10px;
          white-space: nowrap;
          font-size: var(--fs);
          font-weight: 700;
          background: var(--header-bg);
          border-radius: 4px;
        }

        .meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--gap);
          margin-bottom: 6px;
        }

        .chip {
          border: 1px solid var(--border-light);
          padding: 5px 8px;
          font-size: var(--fs-sm);
          background: #ffffff;
          border-radius: 4px;
          font-weight: 600;
        }

        table.summary {
          width: 100%;
          margin-top: 6px;
          border-collapse: collapse;
          table-layout: fixed;
          direction: rtl;
          border: 2px solid var(--border);
          border-radius: 4px;
          overflow: hidden;
        }

        table.summary td {
          border: 1px solid var(--border-light);
          padding: 6px;
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
          padding: 6px;
          margin-top: 6px;
          font-size: var(--fs);
          page-break-inside: auto;
          border-radius: 4px;
          background: #f9fafb;
        }

        .notesHeader {
          font-weight: 700;
          margin-bottom: 4px;
          font-size: var(--fs-sm);
          color: #374151;
        }

        .notesContent {
          white-space: pre-wrap;
          word-break: break-word;
          overflow-wrap: anywhere;
          line-height: 1.4;
          font-weight: 600;
          color: #000;
        }
      `}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;900&family=Cairo:wght@400;600;700;900&display=swap"
        rel="stylesheet"
      />
      <div className="no-print" style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #eee' }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: '8px 20px',
            fontSize: '16px',
            fontFamily: 'Cairo',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          طباعة / حفظ PDF ({items.length} سند)
        </button>
      </div>
      {items.map((item, index) => (
        <div
          key={`${item.type}-${item.id}`}
          className="print-slip"
          style={{
            padding: '8mm 7mm',
            pageBreakAfter: index < items.length - 1 ? 'always' : 'auto',
          }}
        >
          {item.type === 'receipt' ? (
            <ReceiptSlip data={item.data} />
          ) : (
            <PaymentSlip data={item.data} />
          )}
        </div>
      ))}
    </div>
  );
}
