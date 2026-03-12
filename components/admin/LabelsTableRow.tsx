'use client';

import { memo } from 'react';
import { CheckSquare, Square, Edit2, Check, X, Loader2 } from 'lucide-react';
import { Product } from '@/types';
import { getDirectImageUrl } from '@/lib/utils';
import ScannerLatinInput from '@/components/admin/ScannerLatinInput';
import { useRouter } from 'next/navigation';

type QuantitySource = 'shop' | 'warehouse' | 'one';

interface LabelsTableRowProps {
  product: Product;
  isSelected: boolean;
  labelType: 'A' | 'B' | 'C' | 'D';
  useQuantity: boolean;
  quantitySource: QuantitySource;
  editingBarcode: string | null;
  editingBarcodeValue: string;
  savingBarcode: string | null;
  editingQuantity: string | null;
  editingQuantityValue: string;
  printQuantity: number;
  onToggle: (productId: string) => void;
  onStartEditBarcode: (product: Product, e: React.MouseEvent) => void;
  onCancelEditBarcode: () => void;
  onSaveBarcode: (product: Product, e?: React.MouseEvent) => void;
  onBarcodeKeyDown: (product: Product, e: React.KeyboardEvent<HTMLInputElement>, onSave: () => void, onCancel: () => void) => void;
  onStartEditQuantity: (product: Product, e: React.MouseEvent) => void;
  onCancelEditQuantity: () => void;
  onSaveQuantity: (product: Product, e?: React.MouseEvent) => void;
  onQuantityKeyDown: (product: Product, e: React.KeyboardEvent<HTMLInputElement>, onSave: () => void, onCancel: () => void) => void;
  onBarcodeValueChange: (value: string) => void;
  onQuantityValueChange: (value: string) => void;
}

const LabelsTableRow = memo(function LabelsTableRow({
  product,
  isSelected,
  labelType,
  useQuantity,
  quantitySource,
  editingBarcode,
  editingBarcodeValue,
  savingBarcode,
  editingQuantity,
  editingQuantityValue,
  printQuantity,
  onToggle,
  onStartEditBarcode,
  onCancelEditBarcode,
  onSaveBarcode,
  onBarcodeKeyDown,
  onStartEditQuantity,
  onCancelEditQuantity,
  onSaveQuantity,
  onQuantityKeyDown,
  onBarcodeValueChange,
  onQuantityValueChange,
}: LabelsTableRowProps) {
  const router = useRouter();
  
  // Memoize all computed values - avoid recalculating on every render
  const productId = product.ProductID || product.id || '';
  const rawImageUrl = product.Image || product.image || '';
  const directImageUrl = rawImageUrl ? getDirectImageUrl(rawImageUrl) : '';
  const price = product.SalePrice || product.price || 0;
  const shopQty = product.CS_Shop ?? null;
  const warehouseQty = product.CS_War ?? null;
  const totalQty = (shopQty ?? 0) + (warehouseQty ?? 0);
  const defaultQty = quantitySource === 'warehouse' ? (warehouseQty ?? 0) : (shopQty ?? 0);
  const isEditing = editingBarcode === productId;
  const isSaving = savingBarcode === productId;
  const barcode = product.Barcode || product.barcode || '';
  const isEditingQuantity = editingQuantity === productId;

  return (
    <tr
      className={`border-b border-gray-100 dark:border-slate-700/50 cursor-pointer transition-all duration-200 ${
        isSelected 
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
          : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/40 border-gray-100 dark:border-slate-700/40'
      } flex flex-col md:table-row mb-4 md:mb-0 rounded-xl md:rounded-none overflow-hidden border md:border-0 md:border-b shadow-sm md:shadow-none relative`}
      onClick={() => onToggle(productId)}
    >
      <td className="py-3 px-4 md:py-3 md:px-3 flex items-center justify-between md:table-cell border-b md:border-0 border-gray-50 dark:border-slate-700/30">
        <span className="md:hidden text-xs font-medium text-gray-500 dark:text-gray-400">تحديد</span>
        {isSelected ? (
          <CheckSquare size={20} className="text-blue-600 dark:text-blue-400" />
        ) : (
          <Square size={20} className="text-gray-400 dark:text-gray-500" />
        )}
      </td>
      <td className="py-3 px-4 md:py-3 md:px-3 flex items-center justify-between md:table-cell border-b md:border-0 border-gray-50 dark:border-slate-700/30">
        <span className="md:hidden text-xs font-medium text-gray-500 dark:text-gray-400">الصورة</span>
        {directImageUrl ? (
          <img
            src={directImageUrl}
            alt={product.Name || product.name || ''}
            className="w-14 h-14 md:w-12 md:h-12 object-cover rounded-lg md:rounded shadow-sm"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/logo.png';
            }}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-14 h-14 md:w-12 md:h-12 bg-gray-100 dark:bg-slate-700 rounded-lg md:rounded flex items-center justify-center border border-gray-200 dark:border-slate-600">
            <span className="text-[10px] text-gray-400 dark:text-gray-500">لا صورة</span>
          </div>
        )}
      </td>
      <td className="py-3 px-4 md:py-3 md:px-3 flex flex-col md:table-cell border-b md:border-0 border-gray-50 dark:border-slate-700/30">
        <div className="flex flex-col gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (productId) {
                if (e.metaKey || e.ctrlKey) {
                  window.open(`/admin/products/${productId}`, '_blank');
                } else {
                  router.push(`/admin/products/${productId}`);
                }
              }
            }}
            className="text-base md:text-sm font-bold md:font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline text-right cursor-pointer transition-colors"
            title="عرض بروفايل المنتج (اضغط Command/Ctrl لفتح في نافذة جديدة)"
          >
            {product.Name || product.name || '—'}
          </button>
          {(product['Shamel No'] || product.ShamelNo || product.shamel_no) && (
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <span className="opacity-70">رقم الشامل:</span>
              <span className="font-mono">{product['Shamel No'] || product.ShamelNo || product.shamel_no}</span>
            </div>
          )}
        </div>
      </td>
      <td className="py-3 px-4 md:py-3 md:px-3 flex items-center justify-between md:table-cell border-b md:border-0 border-gray-50 dark:border-slate-700/30" onClick={(e) => e.stopPropagation()}>
        <span className="md:hidden text-xs font-medium text-gray-500 dark:text-gray-400">الباركود</span>
        {isEditing ? (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <ScannerLatinInput
              type="text"
              value={editingBarcodeValue}
              onChange={(e) => onBarcodeValueChange(e.target.value)}
              onKeyDown={(e) => onBarcodeKeyDown(product, e, () => onSaveBarcode(product), onCancelEditBarcode)}
              className="flex-1 md:w-32 px-2 py-1.5 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-gray-100"
              autoFocus
              disabled={isSaving}
            />
            <button
              onClick={(e) => onSaveBarcode(product, e)}
              disabled={isSaving}
              className="p-1.5 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Check size={18} />
              )}
            </button>
            <button
              onClick={onCancelEditBarcode}
              disabled={isSaving}
              className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <span className="text-sm text-gray-900 dark:text-gray-100 font-mono">
              {barcode || <span className="text-gray-400 dark:text-gray-600">—</span>}
            </span>
            <button
              onClick={(e) => onStartEditBarcode(product, e)}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors md:opacity-0 md:group-hover:opacity-100"
            >
              <Edit2 size={14} />
            </button>
          </div>
        )}
      </td>
      {labelType === 'C' && useQuantity && (
        <td className="py-3 px-4 md:py-3 md:px-3 flex items-center justify-between md:table-cell border-b md:border-0 border-gray-50 dark:border-slate-700/30" onClick={(e) => e.stopPropagation()}>
          <span className="md:hidden text-xs font-medium text-gray-500 dark:text-gray-400">الكمية للطباعة</span>
          {isEditingQuantity ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={editingQuantityValue}
                onChange={(e) => onQuantityValueChange(e.target.value)}
                onKeyDown={(e) => onQuantityKeyDown(product, e, () => onSaveQuantity(product), onCancelEditQuantity)}
                className="w-20 px-2 py-1.5 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-gray-100 font-mono"
                autoFocus
              />
              <button
                onClick={(e) => onSaveQuantity(product, e)}
                className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                title="حفظ"
              >
                <Check size={18} />
              </button>
              <button
                onClick={onCancelEditQuantity}
                className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="إلغاء"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <span className={`text-base md:text-sm font-bold font-mono ${
                printQuantity !== defaultQty ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
              }`}>
                {printQuantity}
              </span>
              {printQuantity !== defaultQty && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  (أصلي: {defaultQty})
                </span>
              )}
              <button
                onClick={(e) => onStartEditQuantity(product, e)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors md:opacity-0 md:group-hover:opacity-100"
              >
                <Edit2 size={14} />
              </button>
            </div>
          )}
        </td>
      )}
      <td className="py-3 px-4 md:py-3 md:px-3 flex items-center justify-between md:table-cell border-b md:border-0 border-gray-50 dark:border-slate-700/30">
        <span className="md:hidden text-xs font-medium text-gray-500 dark:text-gray-400">السعر</span>
        <div className="text-lg md:text-sm font-bold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-slate-900/50 md:bg-transparent px-2 py-1 rounded md:p-0">
          {price.toLocaleString('en-US')} ₪
        </div>
      </td>
      <td className="py-4 px-4 md:py-3 md:px-3 flex flex-col md:table-cell">
        <div className="flex items-center justify-between md:hidden mb-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">حالة المخزون</span>
        </div>
        <div className="flex md:flex-col items-center md:items-start gap-4 md:gap-1">
          {shopQty !== null && (
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <span className="opacity-70">المحل:</span>
              <span className={`font-bold ${
                shopQty > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>{shopQty}</span>
            </span>
          )}
          {warehouseQty !== null && (
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <span className="opacity-70">المخزن:</span>
              <span className={`font-bold ${
                warehouseQty > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>{warehouseQty}</span>
            </span>
          )}
          {totalQty > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-bold md:mt-1 ${
                totalQty > 0
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              }`}
            >
              المجموع: {totalQty}
            </span>
          )}
        </div>
      </td>
    </tr>

  );
}, (prevProps, nextProps) => {
  const prevId = prevProps.product.ProductID || prevProps.product.id || '';
  const nextId = nextProps.product.ProductID || nextProps.product.id || '';
  
  // Quick ID check first
  if (prevId !== nextId) return false;
  
  // Check if this row is being edited
  const isThisRowEditing = prevId === prevProps.editingBarcode || prevId === prevProps.editingQuantity;
  const isThisRowEditingNext = nextId === nextProps.editingBarcode || nextId === nextProps.editingQuantity;
  
  // If editing state changed for this row, re-render
  if (isThisRowEditing !== isThisRowEditingNext) return false;
  
  // If this row is being edited, check all editing-related props
  if (isThisRowEditing) {
    if (
      prevProps.editingBarcode !== nextProps.editingBarcode ||
      prevProps.editingBarcodeValue !== nextProps.editingBarcodeValue ||
      prevProps.savingBarcode !== nextProps.savingBarcode ||
      prevProps.editingQuantity !== nextProps.editingQuantity ||
      prevProps.editingQuantityValue !== nextProps.editingQuantityValue
    ) return false;
  }
  
  // Check selection state
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  
  if (prevProps.printQuantity !== nextProps.printQuantity) return false;
  
  if (prevProps.labelType !== nextProps.labelType || prevProps.useQuantity !== nextProps.useQuantity || prevProps.quantitySource !== nextProps.quantitySource) return false;
  
  // Check if product data changed (only critical fields)
  const prev = prevProps.product;
  const next = nextProps.product;
  if (
    prev.Barcode !== next.Barcode ||
    prev.barcode !== next.barcode ||
    prev.Name !== next.Name ||
    prev.name !== next.name ||
    prev.CS_Shop !== next.CS_Shop ||
    prev.CS_War !== next.CS_War ||
    prev.SalePrice !== next.SalePrice ||
    prev.price !== next.price
  ) return false;
  
  return true;
});

export default LabelsTableRow;
