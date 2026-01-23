'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getOnlineOrderDetailsFromSupabase } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface OrderItem {
  productID: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export default function OrderPrintPage() {
  const params = useParams();
  const orderId = params?.id as string;
  
  const [orderData, setOrderData] = useState<{
    orderID: string;
    customerName: string;
    customerPhone: string;
    dateTime: string;
    items: OrderItem[];
    subtotal: number;
    discount: number;
    netTotal: number;
    notes?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError('Order ID is required');
      setLoading(false);
      return;
    }

    loadOrderData();
  }, [orderId]);

  useEffect(() => {
    // Set document title for PDF filename (customer name + order number)
    if (orderData && !loading) {
      const customerName = orderData.customerName || 'عميل';
      const orderId = orderData.orderID || '';
      document.title = `${customerName} ${orderId}`;
      
      // Auto-print when page loads in the new window
      // This won't freeze the main app because it's in a separate window
      const timer = setTimeout(() => {
        window.print();
      }, 500); // Slightly longer delay to ensure content is fully rendered
      return () => clearTimeout(timer);
    }
  }, [orderData, loading]);

  const loadOrderData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch order header
      const { data: orderHeader, error: headerError } = await supabase
        .from('online_orders')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (headerError || !orderHeader) {
        throw new Error(`Failed to fetch order: ${headerError?.message || 'Order not found'}`);
      }

      // Fetch order details
      const details = await getOnlineOrderDetailsFromSupabase(orderId);

      if (!details || details.length === 0) {
        throw new Error('Order has no items');
      }

      // Calculate totals
      const subtotal = details.reduce((sum, item) => {
        return sum + (item.Quantity * item.UnitPrice);
      }, 0);

      const discount = parseFloat(String(orderHeader.discount || 0)) || 0;
      const netTotal = subtotal - discount;

      // Map items
      const items: OrderItem[] = details.map((item) => ({
        productID: item.ProductID,
        name: item.ProductName || '',
        quantity: item.Quantity,
        unitPrice: item.UnitPrice,
        total: item.TotalPrice,
      }));

      setOrderData({
        orderID: orderId,
        customerName: orderHeader.customer_name || '',
        customerPhone: orderHeader.customer_phone || '',
        dateTime: orderHeader.created_at,
        items,
        subtotal,
        discount,
        netTotal,
        notes: orderHeader.notes || undefined,
      });
    } catch (err: any) {
      console.error('[OrderPrint] Error loading order:', err);
      setError(err.message || 'Failed to load order');
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
        <p>جاري تحميل الطلبية...</p>
      </div>
    );
  }

  if (error || !orderData) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Cairo' }}>
        <p style={{ color: 'red' }}>خطأ: {error || 'فشل تحميل الطلبية'}</p>
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
                <div className="titleMain">طلبية اون لاين</div>
                <div className="titleId">{orderData.orderID}</div>
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
                {/* Row 1: Customer Name | Date */}
                <div className="chip" style={{ gridColumn: '1 / span 1' }}>
                  الزبون: <span style={{ fontWeight: 700 }}>{orderData.customerName}</span>
                </div>
                <div className="chip" style={{ gridColumn: '2 / span 1' }}>
                  التاريخ: <span style={{ fontWeight: 700 }}>{formatDate(orderData.dateTime)}</span>
                </div>
                
                {/* Row 2: Phone */}
                {orderData.customerPhone && (
                  <div className="chip" style={{ gridColumn: '1 / span 1' }}>
                    الهاتف: <span>{orderData.customerPhone}</span>
                  </div>
                )}
              </div>

              {/* Items Table */}
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
                    <th>#</th>
                    <th>الصنف</th>
                    <th>الكمية</th>
                    <th>السعر</th>
                    <th>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {orderData.items.map((item, index) => (
                    <tr key={index}>
                      <td className="ta-c nowrap">{index + 1}</td>
                      <td className="ta-r nameCell">{item.name}</td>
                      <td className="ta-c nowrap">{item.quantity}</td>
                      <td className="ta-c nowrap">{item.unitPrice.toFixed(2)} ₪</td>
                      <td className="ta-c nowrap">{item.total.toFixed(2)} ₪</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary */}
              <table className="summary">
                <tbody>
                  <tr>
                    <td className="label" style={{ fontWeight: 700 }}>المجموع</td>
                    <td className="value" style={{ fontWeight: 700 }}>{orderData.subtotal.toFixed(2)} ₪</td>
                  </tr>
                  {orderData.discount > 0 && (
                    <tr>
                      <td className="label" style={{ fontWeight: 700 }}>الخصم</td>
                      <td className="value" style={{ fontWeight: 700, color: '#b91c1c' }}>
                        - {orderData.discount.toFixed(2)} ₪
                      </td>
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
                      {orderData.netTotal.toFixed(2)} ₪
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Notes */}
              {orderData.notes && orderData.notes.trim().length > 0 && (
                <div className="notesBox">
                  <div className="notesHeader">ملاحظات:</div>
                  <div className="notesContent">{orderData.notes}</div>
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
