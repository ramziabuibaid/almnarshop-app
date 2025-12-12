'use client';

import { X, Printer } from 'lucide-react';

interface InvoiceDetail {
  detailID: string;
  productID: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  barcode?: string;
  shamelNo?: string;
}

interface InvoiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceID: string;
  dateTime: string;
  items: InvoiceDetail[];
  subtotal: number;
  discount: number;
  netTotal: number;
  notes?: string;
  onPrint?: () => void;
}

export default function InvoiceDetailsModal({
  isOpen,
  onClose,
  invoiceID,
  dateTime,
  items,
  subtotal,
  discount,
  netTotal,
  notes,
  onPrint,
}: InvoiceDetailsModalProps) {
  if (!isOpen) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handlePrint = () => {
    // Open print page in new window
    const printUrl = `/admin/invoices/print/${invoiceID}`;
    window.open(printUrl, '_blank');
  };

  return (
    <>
      {/* Modal Overlay */}
      <div
        className="fixed inset-0 bg-gray-900 bg-opacity-30 z-40 print:hidden"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden" dir="rtl">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 font-cairo">
                تفاصيل الفاتورة
              </h2>
              <p className="text-sm text-gray-600 mt-1 font-cairo">
                رقم الفاتورة: {invoiceID}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo"
              >
                <Printer size={18} />
                طباعة
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Invoice Info */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 font-cairo">التاريخ والوقت</p>
                  <p className="text-base font-semibold text-gray-900 font-cairo">
                    {new Date(dateTime).toLocaleString('en-US', {
                      timeZone: 'Asia/Jerusalem',
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-cairo">الحالة</p>
                  <span className="inline-block px-3 py-1 text-sm font-medium bg-green-100 text-green-800 rounded-full font-cairo">
                    Finalized
                  </span>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 font-cairo">
                الأصناف
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                        رقم الشامل
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                        البيان
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                        الكمية
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                        السعر
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                        المبلغ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item, index) => (
                      <tr key={item.detailID || `item-${index}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-cairo">
                          {item.barcode || item.productID || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-cairo">
                          {item.productName || '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-cairo">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-cairo">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 font-cairo">
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 font-cairo">المجموع:</span>
                  <span className="text-base font-semibold text-gray-900 font-cairo">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                {discount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 font-cairo">الخصم:</span>
                    <span className="text-base font-semibold text-red-600 font-cairo">
                      -{formatCurrency(discount)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-gray-300">
                  <span className="text-lg font-bold text-gray-900 font-cairo">
                    الصافي للدفع:
                  </span>
                  <span className="text-lg font-bold text-gray-900 font-cairo">
                    {formatCurrency(netTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {notes && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-600 mb-2 font-cairo">
                  الملاحظات:
                </h3>
                <p className="text-sm text-gray-900 font-cairo">{notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

