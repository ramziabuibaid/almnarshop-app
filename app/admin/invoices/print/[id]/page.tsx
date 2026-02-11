'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getCashInvoiceDetailsFromSupabase } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface InvoiceItem {
  productID: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  barcode?: string;
  shamelNo?: string;
  serialNos?: string[];
}

export default function InvoicePrintPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const isEmbed = searchParams?.get('embed') === '1';
  const invoiceId = params?.id as string;
  
  const [invoiceData, setInvoiceData] = useState<{
    invoiceID: string;
    dateTime: string;
    items: InvoiceItem[];
    subtotal: number;
    discount: number;
    netTotal: number;
    notes?: string;
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
    // Set document title for PDF filename
    if (invoiceData && !loading) {
      document.title = invoiceData.invoiceID;
      
      if (isEmbed) {
        // Embedded in iframe: tell parent to open print dialog (no new tab)
        try {
          window.parent.postMessage({ type: 'invoice-print-ready' }, '*');
        } catch (_) {}
        return;
      }
      
      // Standalone (new tab): auto-print when page loads
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [invoiceData, loading, isEmbed]);

  const loadInvoiceData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch invoice header
      const { data: invoiceHeader, error: headerError } = await supabase
        .from('cash_invoices')
        .select('*')
        .eq('invoice_id', invoiceId)
        .single();

      if (headerError || !invoiceHeader) {
        throw new Error(`Failed to fetch invoice: ${headerError?.message || 'Invoice not found'}`);
      }

      // Fetch invoice details
      const details = await getCashInvoiceDetailsFromSupabase(invoiceId);

      if (!details || details.length === 0) {
        throw new Error('Invoice has no items');
      }

      // Load serial numbers for each detail
      const { getSerialNumbersByDetailId } = await import('@/lib/api_serial_numbers');
      const itemsWithSerials = await Promise.all(
        details.map(async (item) => {
          let serialNos: string[] = [];
          if (item.detailID) {
            try {
              serialNos = await getSerialNumbersByDetailId(item.detailID, 'cash');
            } catch (err) {
              console.error('[InvoicePrint] Failed to load serial numbers:', err);
            }
          }
          return {
            productID: item.productID,
            name: item.productName || '',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
            barcode: item.barcode,
            shamelNo: item.shamelNo,
            serialNos: serialNos.filter(s => s && s.trim()),
          };
        })
      );

      // Calculate totals
      const subtotal = details.reduce((sum, item) => {
        return sum + (item.quantity * item.unitPrice);
      }, 0);

      const discount = parseFloat(String(invoiceHeader.discount || 0)) || 0;
      const netTotal = subtotal - discount;

      // Map items
      const items: InvoiceItem[] = itemsWithSerials;

      setInvoiceData({
        invoiceID: invoiceId,
        dateTime: invoiceHeader.date_time,
        items,
        subtotal,
        discount,
        netTotal,
        notes: invoiceHeader.notes || undefined,
      });
    } catch (err: any) {
      console.error('[InvoicePrint] Error loading invoice:', err);
      setError(err.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    // Use en-US locale to ensure English numbers
    const dateStr = date.toLocaleDateString('en-US', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const timeStr = date.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${dateStr} ${timeStr}`;
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Cairo, Arial, sans-serif' }}>
        <p>جاري تحميل الفاتورة...</p>
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Cairo, Arial, sans-serif' }}>
        <p style={{ color: 'red' }}>خطأ: {error || 'فشل تحميل الفاتورة'}</p>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        html, body {
          width: 100%;
          height: 100%;
          background: white !important;
          color: black !important;
          direction: rtl;
          font-family: 'Cairo', Arial, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        /* A6 Page Setup - 105mm x 148mm */
        @page {
          size: A6 portrait;
          margin: 0;
        }

        @media print {
          .no-print {
            display: none !important;
          }

          body {
            margin: 0;
            padding: 0;
          }

          .invoice-container {
            width: 100%;
            max-width: 100%;
            margin: 0;
            padding: 3mm;
          }
        }

        @media screen {
          .invoice-container {
            width: 105mm;
            min-height: 148mm;
            margin: 20px auto;
            padding: 3mm;
            background: white;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          }
        }

        .invoice-container {
          direction: rtl;
          font-family: 'Cairo', Arial, sans-serif;
          color: #000;
          background: white;
        }

        /* Header Section */
        .header-section {
          border-bottom: 2px solid #000;
          padding-bottom: 4px;
          margin-bottom: 5px;
        }

        .company-name {
          font-size: 11px;
          font-weight: 700;
          text-align: center;
          margin-bottom: 2px;
          line-height: 1.3;
        }

        .company-address {
          font-size: 9px;
          text-align: center;
          margin-bottom: 2px;
          line-height: 1.3;
        }

        .company-phone {
          font-size: 9px;
          text-align: center;
          line-height: 1.3;
        }

        /* Title Section */
        .title-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 5px 0;
          padding: 3px 0;
          border-bottom: 1px solid #000;
        }

        .invoice-title {
          font-size: 12px;
          font-weight: 700;
          text-align: center;
          flex: 1;
        }

        .invoice-number {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 6px;
          border: 1px solid #000;
          white-space: nowrap;
        }

        /* Date Section */
        .date-section {
          font-size: 9px;
          text-align: center;
          margin: 3px 0;
          padding: 2px;
          border: 1px solid #000;
        }

        /* Items Table */
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 4px 0;
          font-size: 9px;
        }

        .items-table thead {
          background-color: #f0f0f0;
        }

        .items-table th {
          border: 1px solid #000;
          padding: 3px 2px;
          text-align: center;
          font-weight: 700;
          font-size: 8px;
          white-space: nowrap;
        }

        .items-table td {
          border: 1px solid #000;
          padding: 2px;
          vertical-align: top;
        }

        .col-no {
          width: 12%;
          text-align: center;
          font-size: 8px;
        }

        .col-name {
          width: 40%;
          text-align: right;
          font-size: 9px;
          word-break: break-word;
          overflow-wrap: break-word;
        }

        .col-qty {
          width: 10%;
          text-align: center;
          font-size: 9px;
        }

        .col-price {
          width: 18%;
          text-align: center;
          font-size: 9px;
        }

        .col-amount {
          width: 20%;
          text-align: center;
          font-size: 9px;
          font-weight: 600;
        }

        /* Summary Section */
        .summary-section {
          margin-top: 5px;
          border-top: 1px solid #000;
        }

        .summary-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9px;
        }

        .summary-table td {
          border: 1px solid #000;
          padding: 3px 4px;
        }

        .summary-label {
          text-align: right;
          font-weight: 600;
          width: 65%;
        }

        .summary-value {
          text-align: left;
          font-weight: 600;
          width: 35%;
          white-space: nowrap;
        }

        .summary-total {
          font-weight: 700;
          font-size: 10px;
        }

        .summary-total .summary-value {
          font-size: 11px;
        }

        /* Notes Section */
        .notes-section {
          margin-top: 5px;
          border: 1px solid #000;
          padding: 3px;
          font-size: 9px;
        }

        .notes-header {
          font-weight: 700;
          margin-bottom: 2px;
          font-size: 9px;
        }

        .notes-content {
          white-space: pre-wrap;
          word-break: break-word;
          overflow-wrap: break-word;
          line-height: 1.4;
          font-size: 8px;
        }

        /* Print Button */
        .no-print {
          text-align: center;
          padding: 10px;
          background: #f5f5f5;
        }

        .print-button {
          padding: 8px 16px;
          background: #000;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-family: 'Cairo', Arial, sans-serif;
          font-size: 14px;
          font-weight: 600;
        }

        .print-button:hover {
          background: #333;
        }
      `}</style>

      {!isEmbed && (
        <div className="no-print">
          <button className="print-button" onClick={() => window.print()}>
            طباعة الفاتورة
          </button>
        </div>
      )}

      <div className="invoice-container">
        {/* Header */}
        <div className="header-section">
          <div className="company-name">شركة المنار للأجهزة الكهربائية</div>
          <div className="company-address">جنين - شارع الناصرة</div>
          <div className="company-phone">0599-048348 | 04-2438815</div>
        </div>

        {/* Title */}
        <div className="title-section">
          <div className="invoice-title">فاتورة نقدية</div>
          <div className="invoice-number">#{invoiceData.invoiceID}</div>
        </div>

        {/* Date */}
        <div className="date-section">
          التاريخ والوقت: {formatDate(invoiceData.dateTime)}
        </div>

        {/* Items Table */}
        <table className="items-table">
          <thead>
            <tr>
              <th className="col-no">رقم</th>
              <th className="col-name">اسم الصنف</th>
              <th className="col-qty">الكمية</th>
              <th className="col-price">السعر</th>
              <th className="col-amount">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {invoiceData.items.map((item, index) => (
              <tr key={index}>
                <td className="col-no">
                  {item.shamelNo || item.barcode || item.productID}
                </td>
                <td className="col-name">
                  <div>{item.name}</div>
                  {item.serialNos && item.serialNos.length > 0 && (
                    <div style={{ 
                      fontSize: '7px', 
                      color: '#666', 
                      marginTop: '2px',
                      fontFamily: 'monospace',
                      direction: 'ltr',
                      textAlign: 'left',
                      lineHeight: '1.2'
                    }}>
                      {item.serialNos.map((serial, idx) => (
                        <span key={idx} style={{ display: 'block' }}>
                          {serial}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="col-qty">{item.quantity}</td>
                <td className="col-price">{item.unitPrice.toFixed(2)} ₪</td>
                <td className="col-amount">{item.total.toFixed(2)} ₪</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Summary */}
        <div className="summary-section">
          <table className="summary-table">
            <tbody>
              <tr>
                <td className="summary-label">المجموع</td>
                <td className="summary-value">{invoiceData.subtotal.toFixed(2)} ₪</td>
              </tr>
              {invoiceData.discount > 0 && (
                <tr>
                  <td className="summary-label">خصم خاص</td>
                  <td className="summary-value">- {invoiceData.discount.toFixed(2)} ₪</td>
                </tr>
              )}
              <tr className="summary-total">
                <td className="summary-label">الصافي للدفع</td>
                <td className="summary-value">{invoiceData.netTotal.toFixed(2)} ₪</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notes */}
        {invoiceData.notes && invoiceData.notes.trim().length > 0 && (
          <div className="notes-section">
            <div className="notes-header">ملاحظات:</div>
            <div className="notes-content">{invoiceData.notes}</div>
          </div>
        )}
      </div>
    </>
  );
}
