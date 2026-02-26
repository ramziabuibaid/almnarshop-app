'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getCashInvoiceDetailsFromSupabase, getShopSalesInvoice } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import InvoicePrint from '@/components/admin/InvoicePrint';

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
    paymentMethod?: string;
    customerName?: string;
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
    // اسم الملف: الفواتير النقدية - رقم الفاتورة (لا زبون)
    if (invoiceData && !loading) {
      const title = `الفواتير النقدية - ${invoiceData.invoiceID}`;
      document.title = title;
      if (isEmbed) {
        try {
          window.parent.postMessage({ type: 'invoice-print-ready', title }, '*');
        } catch (_) { }
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

      if (invoiceId.startsWith('Shop-')) {
        const invoice = await getShopSalesInvoice(invoiceId);
        if (!invoice || (!invoice.details && !invoice.items && !invoice.Items)) {
          throw new Error('Invoice has no items');
        }

        const details = invoice.details || invoice.items || invoice.Items || [];
        const items = details.map((item: any) => ({
          productID: item.productID || item.product_id || item.ProductID,
          name: item.Name || item.productName || item.name || item.ProductName || '',
          quantity: item.quantity || item.Quantity || 0,
          unitPrice: item.unitPrice || item.unit_price || item.UnitPrice || 0,
          total: item.total || item.TotalPrice || ((item.quantity || item.Quantity || 0) * (item.unitPrice || item.unit_price || item.UnitPrice || 0)),
          barcode: item.barcode || item.Barcode,
          shamelNo: item.shamelNo || item.shamel_no || item.ShamelNo,
          serialNos: item.serialNos || [],
        }));

        const subtotal = items.reduce((sum: number, item: any) => sum + item.total, 0);
        const discount = parseFloat(String(invoice.discount || invoice.Discount || 0)) || 0;

        setInvoiceData({
          invoiceID: invoiceId,
          dateTime: invoice.date_time || invoice.Date || invoice.date || '',
          items,
          subtotal,
          discount,
          netTotal: subtotal - discount,
          notes: invoice.notes || invoice.Notes,
          paymentMethod: 'ذمة مالية',
          customerName: invoice.customerName || invoice.CustomerName || invoice.customer_name,
        });

      } else {
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

        // Determine if it was Visa by checking shop_payments for this invoice ID note
        // (Just a best-effort check since Cash Invoices don't natively store payment method)
        let paymentMethodStr = 'نقداً';
        try {
          const { data: payment } = await supabase
            .from('shop_payments')
            .select('*')
            .ilike('notes', `%${invoiceId}%`)
            .single();
          if (payment) {
            paymentMethodStr = 'فيزا';
          }
        } catch (e) { }

        setInvoiceData({
          invoiceID: invoiceId,
          dateTime: invoiceHeader.date_time,
          items: itemsWithSerials,
          subtotal,
          discount,
          netTotal,
          notes: invoiceHeader.notes || undefined,
          paymentMethod: paymentMethodStr,
        });
      }
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
        body {
          margin: 0;
          padding: 0;
          background: white !important;
        }
        
        @media screen {
          .mobile-print-container {
            width: 105mm;
            min-height: 148mm;
            margin: 20px auto;
            background: white;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            position: relative;
            overflow: hidden;
          }
          .invoice-print {
            display: block !important;
            position: relative !important;
          }
        }
        
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

      <div className="mobile-print-container">
        <InvoicePrint {...invoiceData} />
      </div>
    </>
  );
}
