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
  labelType: 'A' | 'B' | 'C';
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
      className={`border-b border-gray-100 cursor-pointer transition-colors duration-75 ${
        isSelected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
      }`}
      onClick={() => onToggle(productId)}
    >
      <td className="py-3 px-3">
        {isSelected ? (
          <CheckSquare size={18} className="text-blue-600" />
        ) : (
          <Square size={18} className="text-gray-400" />
        )}
      </td>
      <td className="py-3 px-3">
        {directImageUrl ? (
          <img
            src={directImageUrl}
            alt={product.Name || product.name || ''}
            className="w-12 h-12 object-cover rounded"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/logo.png';
            }}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
            <span className="text-xs text-gray-400">لا صورة</span>
          </div>
        )}
      </td>
      <td className="py-3 px-3">
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
            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline text-right cursor-pointer transition-colors"
            title="عرض بروفايل المنتج (اضغط Command/Ctrl لفتح في نافذة جديدة)"
          >
            {product.Name || product.name || '—'}
          </button>
          {(product['Shamel No'] || product.ShamelNo || product.shamel_no) && (
            <div className="text-xs text-gray-500">
              رقم الشامل: {product['Shamel No'] || product.ShamelNo || product.shamel_no}
            </div>
          )}
        </div>
      </td>
      <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <ScannerLatinInput
              type="text"
              value={editingBarcodeValue}
              onChange={(e) => onBarcodeValueChange(e.target.value)}
              onKeyDown={(e) => onBarcodeKeyDown(product, e, () => onSaveBarcode(product), onCancelEditBarcode)}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              autoFocus
              disabled={isSaving}
            />
            <button
              onClick={(e) => onSaveBarcode(product, e)}
              disabled={isSaving}
              className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="حفظ"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
            </button>
            <button
              onClick={onCancelEditBarcode}
              disabled={isSaving}
              className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="إلغاء"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <span className="text-sm text-gray-900 font-mono flex-1">
              {barcode || <span className="text-gray-400">—</span>}
            </span>
            <button
              onClick={(e) => onStartEditBarcode(product, e)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors opacity-0 group-hover:opacity-100"
              title="تعديل الباركود"
            >
              <Edit2 size={14} />
            </button>
          </div>
        )}
      </td>
      {labelType === 'C' && useQuantity && (
        <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
          {isEditingQuantity ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={editingQuantityValue}
                onChange={(e) => onQuantityValueChange(e.target.value)}
                onKeyDown={(e) => onQuantityKeyDown(product, e, () => onSaveQuantity(product), onCancelEditQuantity)}
                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                autoFocus
              />
              <button
                onClick={(e) => onSaveQuantity(product, e)}
                className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                title="حفظ"
              >
                <Check size={16} />
              </button>
              <button
                onClick={onCancelEditQuantity}
                className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                title="إلغاء"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
          <div className="flex items-center gap-2 group">
            <span className={`text-sm font-medium flex-1 ${
              printQuantity !== defaultQty ? 'text-blue-600' : 'text-gray-900'
            }`}>
              {printQuantity}
            </span>
            {printQuantity !== defaultQty && (
              <span className="text-xs text-gray-400">
                (أصلي: {defaultQty})
              </span>
            )}
              <button
                onClick={(e) => onStartEditQuantity(product, e)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors opacity-0 group-hover:opacity-100"
                title="تعديل الكمية"
              >
                <Edit2 size={14} />
              </button>
            </div>
          )}
        </td>
      )}
      <td className="py-3 px-3">
        <div className="text-sm font-semibold text-gray-900">
          {price.toLocaleString('en-US')} ₪
        </div>
      </td>
      <td className="py-3 px-3">
        <div className="text-sm text-gray-600 flex flex-col gap-1">
          {shopQty !== null && (
            <span className="text-xs text-gray-500">
              مح: <span className={`font-medium ${
                shopQty > 0 ? 'text-green-700' : 'text-red-700'
              }`}>{shopQty}</span>
            </span>
          )}
          {warehouseQty !== null && (
            <span className="text-xs text-gray-500">
              م: <span className={`font-medium ${
                warehouseQty > 0 ? 'text-green-700' : 'text-red-700'
              }`}>{warehouseQty}</span>
            </span>
          )}
          {totalQty > 0 && (
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                totalQty > 0
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
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
