'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getQuotationFromSupabase } from '@/lib/api';
import { getDirectImageUrl } from '@/lib/utils';

interface QuotationItem {
  QuotationDetailID: string;
  ProductID: string;
  product?: { name: string; barcode?: string; shamelNo?: string };
  Quantity: number;
  UnitPrice: number;
  notes?: string;
  isGift?: boolean;
  serialNos?: string[];
}

export default function QuotationPrintPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const quotationId = params?.id as string;
  const useImageVariant = searchParams?.get('variant') === 'image';

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
    if (!data || loading) return;

    const customerName = data.customer?.name || 'عميل';
    const quotationId = data.quotationID || '';
    document.title = `${customerName} ${quotationId}`;

    let printed = false;
    const doPrint = () => {
      if (printed) return;
      printed = true;
      window.print();
    };

    // When using image variant, wait for images to load before printing
    const printAfterReady = () => {
      if (!useImageVariant) {
        setTimeout(doPrint, 400);
        return;
      }

      // Preload images and wait for them
      const directUrls = data.items
        .map((item) => {
          const raw = item.product?.image || (item as any).product?.Image || '';
          return raw ? getDirectImageUrl(raw) : '';
        })
        .filter(Boolean);

      if (directUrls.length === 0) {
        setTimeout(doPrint, 500);
        return;
      }

      const loadPromises = directUrls.map(
        (src) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = src;
          })
      );

      Promise.all(loadPromises).then(() => setTimeout(doPrint, 300));

      // Fallback: print after 3 seconds if images take too long
      setTimeout(doPrint, 3000);
    };

    const timer = setTimeout(printAfterReady, 150);
    return () => clearTimeout(timer);
  }, [data, loading, useImageVariant]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const quotation = await getQuotationFromSupabase(quotationId);
      const items = quotation.details || [];

      // Load serial numbers for each item
      const { getSerialNumbersByDetailId } = await import('@/lib/api_serial_numbers');
      const itemsWithSerials = await Promise.all(
        items.map(async (item: QuotationItem) => {
          let serialNos: string[] = [];
          if (item.QuotationDetailID) {
            try {
              serialNos = await getSerialNumbersByDetailId(item.QuotationDetailID, 'quotation');
            } catch (err) {
              console.error('[QuotationPrint] Failed to load serial numbers:', err);
            }
          }
          return {
            ...item,
            serialNos: serialNos.filter(s => s && s.trim()),
          };
        })
      );

      const subtotal = itemsWithSerials.reduce(
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
        items: itemsWithSerials,
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

  const discountPercentage = useMemo(() => {
    if (!data) return 0;
    const subtotal = data.subtotal || 0;
    const totalDiscount = (data.specialDiscount || 0) + (data.giftDiscount || 0);
    if (subtotal === 0 || totalDiscount === 0) return 0;
    return (totalDiscount / subtotal) * 100;
  }, [data]);

  // Separate regular items from gifts
  const regularItems = useMemo(() => {
    if (!data) return [];
    return data.items.filter(item => !item.isGift);
  }, [data]);

  const giftItems = useMemo(() => {
    if (!data) return [];
    return data.items.filter(item => item.isGift);
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
          --border: #1a1a1a;
          --border-light: #d1d5db;
          --pad: 10px;
          --gap: 10px;
          --fs: 16px;      /* نص أساسي كبير وواضح لـ A4 */
          --fs-sm: 14px;   /* ميتا */
          --fs-lg: 20px;   /* الإجماليات */
          --fs-xl: 24px;   /* العنوان الرئيسي */
          --w-no: 25mm;
          --w-qty: 15mm;
          --w-price: 30mm;
          --w-amt: 35mm;
          --header-bg: #f8f9fa;
          --gift-bg: #fef3c7;
          --gift-border: #f59e0b;
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
          margin: 0;
        }

        @media print {
          body {
            padding: 15mm 20mm 15mm 20mm;
          }

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
        table.items.col-image col.col-no { width: 28mm; }
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

        .item-img-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24mm;
          height: 24mm;
          min-height: 24mm;
          margin: 0 auto;
          border-radius: 4px;
          overflow: hidden;
          background: #f8f9fa;
          border: 1px solid var(--border-light);
        }
        .item-img-wrap img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          vertical-align: middle;
        }

        .nameCell {
          word-break: break-word;
          overflow-wrap: anywhere;
          text-align: right;
        }

        .gift-section {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 3px solid var(--gift-border);
        }

        .gift-title {
          font-size: var(--fs-lg);
          font-weight: 700;
          color: #92400e;
          margin-bottom: 12px;
          text-align: center;
          padding: 8px;
          background: var(--gift-bg);
          border-radius: 4px;
        }

        .gift-items {
          background: var(--gift-bg);
          border: 2px solid var(--gift-border);
          border-radius: 4px;
          padding: 8px;
        }

        .gift-items table.items th {
          background: #fde68a;
          border-color: var(--gift-border);
        }

        .gift-items table.items td {
          background: #fffbeb;
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
                <div className="titleMain">عرض سعر</div>
                <div className="titleId">{data.quotationID}</div>
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
                  الزبون: <span style={{ fontWeight: 700 }}>{data.customer?.name || data.customerId || '—'}</span>
                  {data.customer?.shamelNo && (
                    <span style={{ marginRight: '8px', color: '#666' }}>({data.customer.shamelNo})</span>
                  )}
                </div>
                <div className="chip" style={{ gridColumn: '2 / span 1' }}>
                  التاريخ: <span style={{ fontWeight: 700 }}>{formatDate(data.date)}</span>
                </div>
                
                {/* Row 2: Phone */}
                {data.customer?.phone && (
                  <div className="chip" style={{ gridColumn: '1 / span 1' }}>
                    الهاتف: <span>{data.customer.phone}</span>
                  </div>
                )}
                
                {/* Row 3: Address */}
                {data.customer?.address && (
                  <div className="chip" style={{ gridColumn: data.customer?.phone ? '2 / span 1' : '1 / span 2' }}>
                    العنوان: <span>{data.customer.address}</span>
                  </div>
                )}
              </div>

              {/* Regular Items */}
              {regularItems.length > 0 && (
                <table className={`items ${useImageVariant ? 'col-image' : ''}`}>
                  <colgroup>
                    <col className="col-no" />
                    <col className="col-name" />
                    <col className="col-qty" />
                    <col className="col-price" />
                    <col className="col-amt" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>{useImageVariant ? 'صورة' : 'Item No'}</th>
                      <th>ITEM NAME</th>
                      <th>QTY</th>
                      <th>Price</th>
                      <th>AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regularItems.map((item, index) => {
                      const productImage = item.product?.image || (item as any).product?.Image || '';
                      const imageUrl = getDirectImageUrl(productImage);
                      return (
                      <tr key={item.QuotationDetailID || index}>
                        <td className="ta-c nowrap">
                          {useImageVariant ? (
                            imageUrl ? (
                              <div className="item-img-wrap">
                                <img src={imageUrl} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              </div>
                            ) : (
                              <div className="item-img-wrap" style={{ fontSize: '9px', color: '#999', padding: '4px' }}>
                                —
                              </div>
                            )
                          ) : (
                            item.product?.shamelNo || item.product?.barcode || item.ProductID
                          )}
                        </td>
                        <td className="ta-r nameCell">
                          <div>
                            <div>{item.product?.name || `Product ${item.ProductID}`}</div>
                            {useImageVariant && (item.product?.shamelNo || item.product?.barcode || item.ProductID) && (
                              <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                                رقم شامل: {item.product?.shamelNo || item.product?.barcode || item.ProductID}
                              </div>
                            )}
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
                            {item.notes && item.notes.trim() && (
                              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', fontStyle: 'italic' }}>
                                {item.notes}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="ta-c nowrap">{item.Quantity}</td>
                        <td className="ta-c nowrap">{item.UnitPrice.toFixed(2)} ₪</td>
                        <td className="ta-c nowrap">{(item.Quantity * item.UnitPrice).toFixed(2)} ₪</td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              )}

              {/* Gift Items Section */}
              {giftItems.length > 0 && (
                <div className="gift-section">
                  <div className="gift-title">🎁 الهدايا</div>
                  <div className="gift-items">
                    <table className={`items ${useImageVariant ? 'col-image' : ''}`}>
                      <colgroup>
                        <col className="col-no" />
                        <col className="col-name" />
                        <col className="col-qty" />
                        <col className="col-price" />
                        <col className="col-amt" />
                      </colgroup>
                      <tbody>
                        {giftItems.map((item, index) => {
                          const productImage = item.product?.image || (item as any).product?.Image || '';
                          const imageUrl = getDirectImageUrl(productImage);
                          return (
                          <tr key={item.QuotationDetailID || `gift-${index}`}>
                            <td className="ta-c nowrap">
                              {useImageVariant ? (
                                imageUrl ? (
                                  <div className="item-img-wrap">
                                    <img src={imageUrl} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                  </div>
                                ) : (
                                  <div className="item-img-wrap" style={{ fontSize: '9px', color: '#999', padding: '4px' }}>
                                    —
                                  </div>
                                )
                              ) : (
                                item.product?.shamelNo || item.product?.barcode || item.ProductID
                              )}
                            </td>
                            <td className="ta-r nameCell">
                              <div>
                                <div>{item.product?.name || `Product ${item.ProductID}`}</div>
                                {useImageVariant && (item.product?.shamelNo || item.product?.barcode || item.ProductID) && (
                                  <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                                    رقم شامل: {item.product?.shamelNo || item.product?.barcode || item.ProductID}
                                  </div>
                                )}
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
                                {item.notes && item.notes.trim() && (
                                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', fontStyle: 'italic' }}>
                                    {item.notes}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="ta-c nowrap">{item.Quantity}</td>
                            <td className="ta-c nowrap">{item.UnitPrice.toFixed(2)} ₪</td>
                            <td className="ta-c nowrap">{(item.Quantity * item.UnitPrice).toFixed(2)} ₪</td>
                          </tr>
                        );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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

                  {hasDiscounts && discountPercentage > 0 && (
                    <tr>
                      <td className="label" style={{ fontWeight: 700 }}>نسبة الخصم</td>
                      <td className="value" style={{ fontWeight: 700, color: '#16a34a' }}>
                        {discountPercentage.toFixed(2)}%
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

