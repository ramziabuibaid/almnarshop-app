'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getCashSessionReport } from '@/lib/api';

export default function CashSessionPrintPage() {
  const params = useParams();
  const sessionId = params?.id as string;
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadReport();
    }
  }, [sessionId]);

  useEffect(() => {
    if (reportData && !loading) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [reportData, loading]);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCashSessionReport(sessionId);
      setReportData(data);
    } catch (err: any) {
      console.error('[CashSessionPrintPage] Error loading report:', err);
      setError(err?.message || 'فشل تحميل التقرير');
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ' ₪';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" dir="rtl">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
          <p className="text-gray-600">جاري تحميل التقرير...</p>
        </div>
      </div>
    );
  }

  if (error || !reportData) {
    return (
      <div className="flex items-center justify-center min-h-screen" dir="rtl">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error || 'التقرير غير موجود'}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@700&display=swap');
        
        body {
          font-family: 'Tajawal', Arial, sans-serif;
          margin: 12px;
          color: #111;
          direction: rtl;
        }

        .box {
          border: 1px solid #111;
          padding: 8px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 8px;
        }

        .brand {
          text-align: right;
        }

        h2.title {
          text-align: center;
          margin: 6px 0;
          font-size: 18px;
        }

        .sessionRow {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 8px;
        }

        .sessionId {
          border: 1px solid #111;
          padding: 6px 10px;
          font-weight: 700;
        }

        .sessionDate {
          border: 1px solid #111;
          padding: 6px 10px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          font-size: 13px;
        }

        table th, table td {
          border: 1px solid #111;
          padding: 6px;
          vertical-align: top;
        }

        table th {
          background: #f5f5f5;
          font-weight: 700;
          text-align: center;
        }

        .narrow {
          width: 90px;
          text-align: center;
        }

        .small-col {
          width: 120px;
        }

        .summary {
          margin-top: 10px;
          width: 100%;
          border-collapse: collapse;
        }

        .summary td {
          border: 1px solid #111;
          padding: 8px;
          font-weight: 700;
        }

        .notesBox {
          border: 1px solid #111;
          padding: 8px;
          margin-top: 8px;
          white-space: pre-wrap;
        }

        .right {
          text-align: right;
        }

        .left {
          text-align: left;
        }

        @media print {
          body {
            background: white !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }

        @media screen {
          body {
            background: #f3f4f6;
            padding: 20px;
          }
        }
      `}} />

      <div style={{ textAlign: 'left' }} className="no-print">
        <button
          onClick={() => window.print()}
          style={{
            margin: '8px 0',
            padding: '6px 12px',
            fontWeight: 700,
            cursor: 'pointer',
            border: '1px solid #222',
            background: 'white',
          }}
        >
          طباعة هذه الورقة
        </button>
      </div>

      <div className="box header">
        <div className="brand">
          <div style={{ fontWeight: 700, fontSize: '16px' }}>شركة المنار للأجهزة الكهربائية</div>
          <div>جنين - شارع الناصرة</div>
          <div>04-2438815 | 0599-048348</div>
        </div>
      </div>

      <h2 className="title">ورقة الصندوق اليومي</h2>

      <div className="sessionRow">
        <div className="sessionId">{reportData.session.CashSessionID}</div>
        <div className="sessionDate">التاريخ: {formatDate(reportData.sessionDateStr)}</div>
      </div>

      {/* 1) العد النقدي */}
      <table>
        <thead>
          <tr>
            <th className="narrow">العملة</th>
            <th>الفئة</th>
            <th className="narrow">العدد</th>
            <th>المبلغ</th>
          </tr>
        </thead>
        <tbody>
          {reportData.denomRows.map((r: any, idx: number) => (
            <tr key={idx}>
              <td className="narrow">{r.currency || 'ILS'}</td>
              <td className="left">{r.denomination}</td>
              <td className="narrow">{r.qty}</td>
              <td className="right">{formatMoney(r.amount)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} className="right">المجموع نقداً - CountedCash</td>
            <td className="right">{formatMoney(reportData.CountedCash)}</td>
          </tr>
        </tbody>
      </table>

      {reportData.missingDetails && reportData.missingDetails.length > 0 && (
        <div style={{ marginTop: '8px', color: '#a00' }}>
          <strong>تنبيه:</strong> لم يُعثر على تفاصيل في ShopSalesDetails لهذه الفواتير (قيمة = 0):
          {reportData.missingDetails.join(', ')}
        </div>
      )}

      {/* 2) القبض المسجل */}
      <h3 style={{ marginTop: '10px', marginBottom: '4px' }}>القبض المسجل</h3>
      <table>
        <thead>
          <tr>
            <th>رقم السند</th>
            <th>الاسم</th>
            <th>نقداً</th>
            <th>شيكات</th>
          </tr>
        </thead>
        <tbody>
          {reportData.receiptsForDate.map((r: any, idx: number) => (
            <tr key={idx}>
              <td className="small-col">{r.id}</td>
              <td className="left">{r.customerName || ''}</td>
              <td className="right">{formatMoney(r.cash)}</td>
              <td className="right">{formatMoney(r.cheque)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2} className="right">المجموع</td>
            <td className="right">{formatMoney(reportData.ReceiptsCashTotal)}</td>
            <td className="right">{formatMoney(reportData.ReceiptsChequeTotal)}</td>
          </tr>
        </tbody>
      </table>

      {/* 3) الصرف المسجل */}
      <h3 style={{ marginTop: '10px', marginBottom: '4px' }}>الصرف المسجل</h3>
      <table>
        <thead>
          <tr>
            <th>رقم السند</th>
            <th>اسم الزبون</th>
            <th>نقداً</th>
          </tr>
        </thead>
        <tbody>
          {reportData.paymentsForDate.map((p: any, idx: number) => (
            <tr key={idx}>
              <td className="small-col">{p.id || ''}</td>
              <td className="left">{p.customerName || p.notes || ''}</td>
              <td className="right">{formatMoney(p.cash)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2} className="right">المجموع</td>
            <td className="right">{formatMoney(reportData.PaymentsCashTotal)}</td>
          </tr>
        </tbody>
      </table>

      {/* 4) فواتير اليوم النهائية */}
      <h3 style={{ marginTop: '10px', marginBottom: '4px' }}>الفواتير النقدية لهذا اليوم (دفعت بالكامل)</h3>
      <table>
        <thead>
          <tr>
            <th>رقم الفاتورة</th>
            <th className="right">قيمة الفاتورة (بعد الخصم)</th>
          </tr>
        </thead>
        <tbody>
          {reportData.cashInvoicesWithValue.map((ci: any, idx: number) => (
            <tr key={idx}>
              <td className="small-col">{ci.id}</td>
              <td className="right">{formatMoney(ci.calcValue)}</td>
            </tr>
          ))}
          <tr>
            <td className="right">المجموع</td>
            <td className="right">{formatMoney(reportData.CashInvoicesTotal)}</td>
          </tr>
        </tbody>
      </table>

      {/* 5) التقرير النهائي */}
      <h3 style={{ marginTop: '10px', marginBottom: '4px' }}>التقرير النهائي</h3>
      <table className="summary">
        <tbody>
          <tr>
            <td className="right">النقد المسجل (ExpectedCash)</td>
            <td className="right">{formatMoney(reportData.ExpectedCash)}</td>
          </tr>
          <tr>
            <td className="right">المعدود نقدا (CountedCash)</td>
            <td className="right">{formatMoney(reportData.CountedCash)}</td>
          </tr>
          <tr>
            <td className="right">الشيكات المسجلة (ExpectedCheques)</td>
            <td className="right">{formatMoney(reportData.ExpectedCheques)}</td>
          </tr>
          <tr>
            <td className="right">الفرق (OverShort)</td>
            <td className="right">{formatMoney(reportData.OverShort)}</td>
          </tr>
          <tr>
            <td className="right">الثابت السابق (OpeningFloat)</td>
            <td className="right">{formatMoney(reportData.session.OpeningFloat || 0)}</td>
          </tr>
          <tr>
            <td className="right">الثابت الجديد (ClosingFloatTarget)</td>
            <td className="right">{formatMoney(reportData.session.ClosingFloatTarget || 0)}</td>
          </tr>
          <tr>
            <td className="right">الصافي للتسليم (AmountToDeliverCash)</td>
            <td className="right">{formatMoney(reportData.AmountToDeliverCash)}</td>
          </tr>
          <tr>
            <td className="right">المقبوض نقدا (ReceiptsCashTotal)</td>
            <td className="right">{formatMoney(reportData.ReceiptsCashTotal)}</td>
          </tr>
          <tr>
            <td className="right">مجموع الفواتير النقدية لليوم (CashInvoicesTotal)</td>
            <td className="right">{formatMoney(reportData.CashInvoicesTotal)}</td>
          </tr>
          <tr>
            <td className="right">المصروف نقدا (PaymentsCashTotal)</td>
            <td className="right">{formatMoney(reportData.PaymentsCashTotal)}</td>
          </tr>
          <tr>
            <td className="right">الفرق بين الواصل والمسجل (differentSaed)</td>
            <td className="right">{formatMoney(reportData.differentSaed)}</td>
          </tr>
          <tr>
            <td colSpan={2} className="right">هذه النتيجة تُخصم وتذهب إلى صندوق المحل</td>
          </tr>
        </tbody>
      </table>

      {/* ملاحظات الجلسة */}
      {reportData.session.Notes && reportData.session.Notes.trim().length > 0 && (
        <div className="notesBox">
          <div style={{ fontWeight: 700, marginBottom: '6px' }}>ملاحظات الجلسة:</div>
          <div>{reportData.session.Notes}</div>
        </div>
      )}
    </>
  );
}

