'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getQuotationFromSupabase } from '@/lib/api';

interface QuotationItem {
  QuotationDetailID: string;
  ProductID: string;
  product?: { name: string; barcode?: string; shamelNo?: string };
  Quantity: number;
  UnitPrice: number;
}

export default function QuotationPrintPage() {
  const params = useParams();
  const quotationId = params?.id as string;

  const [data, setData] = useState<{
    quotationID: string;
    date: string;
    customerId: string | null;
    customer?: { name?: string; phone?: string; address?: string; shamelNo?: string };
    status: string;
    notes?: string;
    items: QuotationItem[];
    subtotal: number;
    specialDiscount: number;
    giftDiscount: number;
    netTotal: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!quotationId) {
      setError('رقم العرض السعري مطلوب');
      setLoading(false);
      return;
    }
    loadData();
  }, [quotationId]);

  useEffect(() => {
    if (data && !loading) {
      const timer = setTimeout(() => window.print(), 300);
      return () => clearTimeout(timer);
    }
  }, [data, loading]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const quotation = await getQuotationFromSupabase(quotationId);
      const items = quotation.details || [];

      const subtotal = items.reduce(
        (sum: number, item: QuotationItem) => sum + item.Quantity * item.UnitPrice,
        0
      );
      const specialDiscount = parseFloat(String(quotation.SpecialDiscountAmount || 0)) || 0;
      const giftDiscount = parseFloat(String(quotation.GiftDiscountAmount || 0)) || 0;
      const netTotal = subtotal - specialDiscount - giftDiscount;

      setData({
        quotationID: quotation.QuotationID,
        date: quotation.Date,
        customerId: quotation.CustomerID,
        customer: quotation.customer,
        status: quotation.Status,
        notes: quotation.Notes,
        items,
        subtotal,
        specialDiscount,
        giftDiscount,
        netTotal,
      });
    } catch (err: any) {
      console.error('[QuotationPrint] Error loading quotation:', err);
      setError(err?.message || 'فشل تحميل العرض السعري');
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

  const hasDiscounts = useMemo(() => {
    if (!data) return false;
    return (data.specialDiscount ?? 0) > 0 || (data.giftDiscount ?? 0) > 0;
  }, [data]);

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Tajawal' }}>
        <p>جاري تحميل العرض السعري...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Tajawal' }}>
        <p style={{ color: 'red' }}>خطأ: {error || 'فشل تحميل العرض السعري'}</p>
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
          --fs: 12px;      /* نص أساسي مقروء لـ A6 (الوضع الافتراضي) */
          --fs-sm: 11px;   /* ميتا */
          --fs-lg: 14px;   /* الإجماليات */
          --w-no: 14mm;
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

          /* تكبير الخط تلقائياً عند الطباعة على A4 مع إبقاء A6 كما هو */
          /* العرض الفعلي لـ A4 حوالي 210mm؛ نستخدم حد أدنى 180mm لالتقاط A4/A5 */
          @media (min-width: 180mm) {
            :root {
              --pad: 6px;
              --gap: 7px;
              --fs: 14px;
              --fs-sm: 13px;
              --fs-lg: 16px;
              /* تكبير الأعمدة للسعر والمبلغ و Item No في A4 فقط */
              --w-no: 18mm;
              --w-qty: 9mm;
              --w-price: 22mm;
              --w-amt: 26mm;
            }

            table.items th {
              font-size: 12px;
            }
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
          flex-direction: row;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 8px;
        }

        .brand {
          text-align: right;
          margin-left: auto; /* ادفع الترويسة إلى اليمين */
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

        table.items col.col-no { width: var(--w-no); }
        table.items col.col-name { width: auto; }
        table.items col.col-qty { width: var(--w-qty); }
        table.items col.col-price { width: var(--w-price); }
        table.items col.col-amt { width: var(--w-amt); }

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

        table.summary .label { width: 60%; text-align: right; }
        table.summary .value { width: 40%; text-align: left; white-space: nowrap; }

        .notesBox {
          border: 1px solid var(--border);
          padding: 6px;
          margin-top: 6px;
          font-size: var(--fs);
          page-break-inside: auto;
        }

        .notesHeader { font-weight: 700; margin-bottom: 4px; }

        .notesContent {
          white-space: pre-wrap;
          word-break: break-word;
          overflow-wrap: anywhere;
          line-height: 1.4;
          font-weight: 700;
          color: #000;
        }
      `}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@700&display=swap" rel="stylesheet" />

      <div className="no-print" style={{ padding: '8px', textAlign: 'center' }}>
        <button onClick={() => window.print()}>إعادة الطباعة</button>
      </div>

      <table className="sheet">
        <thead>
          <tr>
            <td>
              {/* Header box */}
              <div className="box headerRow">
                <div className="brand">
                  <div>شركة المنار للأجهزة الكهربائية</div>
                  <div>جنين - شارع الناصرة</div>
                  <div>0599-048348 | 04-2438815</div>
                </div>
              </div>

              {/* Title */}
              <div className="titleRow">
                <div className="titleMain">عرض سعر</div>
                <div className="titleId">{data.quotationID}</div>
              </div>

              {/* Meta */}
              <div className="meta">
                <div className="chip">
                  التاريخ: <span>{formatDate(data.date)}</span>
                </div>
                <div className="chip">
                  رقم الزبون (شامل): <span>{data.customer?.shamelNo || '—'}</span>
                </div>
                <div className="chip" style={{ gridColumn: '1 / span 2' }}>
                  الزبون: <span>{data.customer?.name || data.customerId || '—'}</span>
                </div>
                {data.customer?.phone && (
                  <div className="chip">
                    الهاتف: <span>{data.customer.phone}</span>
                  </div>
                )}
                {data.customer?.address && (
                  <div className="chip">
                    العنوان: <span>{data.customer.address}</span>
                  </div>
                )}
              </div>

              {/* Table header */}
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
              {/* Items body */}
              <table className="items">
                <colgroup>
                  <col className="col-no" />
                  <col className="col-name" />
                  <col className="col-qty" />
                  <col className="col-price" />
                  <col className="col-amt" />
                </colgroup>
                <tbody>
                  {data.items.map((item, index) => (
                    <tr key={item.QuotationDetailID || index}>
                      <td className="ta-c nowrap">
                        {item.product?.shamelNo || item.product?.barcode || item.ProductID}
                      </td>
                      <td className="ta-r nameCell">{item.product?.name || `Product ${item.ProductID}`}</td>
                      <td className="ta-c nowrap">{item.Quantity}</td>
                      <td className="ta-c nowrap">{item.UnitPrice.toFixed(2)} ₪</td>
                      <td className="ta-c nowrap">{(item.Quantity * item.UnitPrice).toFixed(2)} ₪</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary */}
              <table className="summary">
                <tbody>
                  <tr>
                    <td className="label" style={{ fontWeight: 700 }}>المجموع</td>
                    <td className="value" style={{ fontWeight: 700 }}>{data.subtotal.toFixed(2)} ₪</td>
                  </tr>

                  {data.specialDiscount > 0 && (
                    <tr>
                      <td className="label" style={{ fontWeight: 700 }}>خصم خاص</td>
                      <td className="value" style={{ fontWeight: 700, color: '#b91c1c' }}>
                        - {data.specialDiscount.toFixed(2)} ₪
                      </td>
                    </tr>
                  )}

                  {data.giftDiscount > 0 && (
                    <tr>
                      <td className="label" style={{ fontWeight: 700 }}>خصم الهدايا</td>
                      <td className="value" style={{ fontWeight: 700, color: '#b91c1c' }}>
                        - {data.giftDiscount.toFixed(2)} ₪
                      </td>
                    </tr>
                  )}

                  <tr>
                    <td className="label" style={{ fontWeight: 700 }}>
                      الصافي
                    </td>
                    <td
                      className="value"
                      style={{
                        fontWeight: 700,
                        fontSize: 'var(--fs-lg)',
                      }}
                    >
                      {data.netTotal.toFixed(2)} ₪
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Notes */}
              {data.notes && data.notes.trim().length > 0 && (
                <div className="notesBox">
                  <div className="notesHeader">ملاحظات:</div>
                  <div className="notesContent">{data.notes}</div>
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

