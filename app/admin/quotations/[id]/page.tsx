'use client';

const mapToInvoiceStatus = () => {
  // فواتير المحل/المخزن تقبل فقط هذه القيم: غير مدفوع، تقسيط شهري، دفعت بالكامل، مدفوع جزئي
  // عند التحويل من عرض سعر نستخدم القيمة الافتراضية "غير مدفوع"
  return 'غير مدفوع' as const;
};

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  getQuotationFromSupabase,
  saveQuotation,
  deleteQuotation,
  getProducts,
  getAllCustomers,
  saveShopSalesInvoice,
  saveWarehouseSalesInvoice,
  getCustomerLastPriceForProduct,
} from '@/lib/api';
import { getSerialNumbersByDetailId } from '@/lib/api_serial_numbers';
import { validateSerialNumbers } from '@/lib/validation';
import { supabase } from '@/lib/supabase';
import {
  Loader2,
  Save,
  Plus,
  X,
  Trash2,
  ArrowLeft,
  Eye,
  EyeOff,
  Printer,
  Gift,
  GripVertical,
} from 'lucide-react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import BarcodeScannerInput from '@/components/admin/BarcodeScannerInput';
import SerialNumberScanner from '@/components/admin/SerialNumberScanner';

interface QuotationDetail {
  QuotationDetailID: string;
  QuotationID: string;
  ProductID: string;
  Quantity: number;
  UnitPrice: number;
  notes?: string;
  isGift?: boolean;
  serialNos?: string[]; // Array of serial numbers - one per quantity
  isSerialized?: boolean;
  product?: {
    name: string;
    barcode?: string;
    shamelNo?: string;
    costPrice?: number;
    image?: string;
  };
}

interface Quotation {
  QuotationID: string;
  Date: string;
  CustomerID: string | null;
  Notes?: string;
  Status: string;
  SpecialDiscountAmount: number;
  GiftDiscountAmount: number;
  details?: QuotationDetail[];
}

const STATUS_OPTIONS = [
  'مسودة',
  'مقدم للزبون',
  'مدفوع كلي أو جزئي تم الحجز',
  'تم تسلم جزء من الطلبية',
  'مسلمة بالكامل',
  'ملغي',
];

// Sortable Row Component for Desktop Table
function SortableTableRow({
  item,
  index,
  showCosts,
  canViewCost,
  products,
  onUpdateQuantity,
  onUpdatePrice,
  onUpdateNotes,
  onToggleGift,
  onRemoveItem,
  onUpdateSerialNo,
}: {
  item: QuotationDetail;
  index: number;
  showCosts: boolean;
  canViewCost: boolean;
  products: any[];
  onUpdateQuantity: (detailID: string, newQuantity: number) => void;
  onUpdatePrice: (detailID: string, newPrice: number) => void;
  onUpdateNotes: (detailID: string, newNotes: string) => void;
  onToggleGift: (detailID: string) => void;
  onRemoveItem: (detailID: string) => void;
  onUpdateSerialNo: (detailID: string, index: number, value: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: (item.QuotationDetailID && item.QuotationDetailID.trim()) ? item.QuotationDetailID : `temp-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Get product image from products array if not in item.product
  const product = products.find(p => (p.ProductID || p.id || p.product_id) === item.ProductID);
  const imageUrl = item.product?.image || product?.Image || product?.image || '';
  const productName = item.product?.name || product?.Name || product?.name || `Product ${item.ProductID}`;

  return (
    <tr
      ref={setNodeRef}
      {...attributes}
      style={style}
      className={`bg-white ${isDragging ? 'shadow-lg opacity-50' : ''}`}
    >
      <td 
        {...listeners}
        className="px-2 py-3 w-8 cursor-grab active:cursor-grabbing"
        title="اسحب لإعادة الترتيب"
      >
        <div className="text-gray-400 hover:text-gray-600 p-1 flex items-center justify-center">
          <GripVertical size={16} />
        </div>
      </td>
      <td className="px-3 py-3 text-sm text-gray-900 font-cairo min-w-[200px]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={productName}
                className="w-10 h-10 object-contain rounded border border-gray-200 flex-shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center flex-shrink-0">
                <span className="text-gray-400 text-xs">—</span>
              </div>
            )}
            <span className="text-sm font-medium">{productName}</span>
          </div>
          <textarea
            value={item.notes || ''}
            onChange={(e) => onUpdateNotes(item.QuotationDetailID, e.target.value)}
            placeholder="ملاحظات..."
            rows={1}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded text-gray-900 font-cairo resize-none"
          />
        </div>
      </td>
      <td className="px-3 py-3 text-center">
        <input
          type="number"
          step="1"
          value={item.Quantity}
          onChange={(e) => onUpdateQuantity(item.QuotationDetailID, parseFloat(e.target.value) || 0)}
          onWheel={(e) => e.currentTarget.blur()}
          className="w-16 px-2 py-1.5 border border-gray-300 rounded text-gray-900 font-bold text-sm"
        />
      </td>
      <td className="px-3 py-3 text-center">
        <input
          type="number"
          step="1"
          value={item.UnitPrice}
          onChange={(e) => onUpdatePrice(item.QuotationDetailID, parseFloat(e.target.value) || 0)}
          onWheel={(e) => e.currentTarget.blur()}
          className="w-20 px-2 py-1.5 border border-gray-300 rounded text-gray-900 font-bold text-sm"
        />
      </td>
      {showCosts && canViewCost && (
        <td className="px-3 py-3 text-sm font-semibold text-gray-900 font-cairo text-center">
          ₪{(item.product?.costPrice || 0).toFixed(2)}
        </td>
      )}
      <td className="px-3 py-3">
        {(item.isSerialized || (item.serialNos && item.serialNos.length > 0)) ? (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {Array.from({ length: item.Quantity }, (_, index) => {
              const serialValue = item.serialNos?.[index] || '';
              return (
                <div key={index} className="flex items-center gap-1 mb-1">
                  <input
                    type="text"
                    value={serialValue}
                    onChange={(e) => onUpdateSerialNo(item.QuotationDetailID, index, e.target.value)}
                    placeholder={`سيريال ${index + 1}${item.isSerialized ? ' *' : ''}`}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded text-gray-900 font-cairo"
                  />
                  <SerialNumberScanner
                    onScan={(serialNumber) => onUpdateSerialNo(item.QuotationDetailID, index, serialNumber)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <span className="text-xs text-gray-400 font-cairo">—</span>
        )}
      </td>
      <td className={`px-3 py-3 text-sm font-semibold font-cairo text-center ${
        item.isGift ? 'text-green-600' : 'text-gray-900'
      }`}>
        ₪{(item.Quantity * item.UnitPrice).toFixed(2)}
        {item.isGift && (
          <span className="text-xs text-green-600 mr-1 block">(هدية)</span>
        )}
      </td>
      <td className="px-3 py-3 text-center">
        <button
          onClick={() => onToggleGift(item.QuotationDetailID)}
          className={`p-1.5 rounded-lg transition-colors ${
            item.isGift
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          title={item.isGift ? 'إلغاء تحديد كهدية' : 'تحديد كهدية'}
        >
          <Gift size={16} />
        </button>
      </td>
      <td className="px-3 py-3 text-center">
        <button
          onClick={() => onRemoveItem(item.QuotationDetailID)}
          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="حذف المنتج"
        >
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  );
}

// Card Component for Mobile (without drag and drop)
function CardRow({
  item,
  index,
  showCosts,
  canViewCost,
  products,
  onUpdateQuantity,
  onUpdatePrice,
  onUpdateNotes,
  onToggleGift,
  onRemoveItem,
  onUpdateSerialNo,
}: {
  item: QuotationDetail;
  index: number;
  showCosts: boolean;
  canViewCost: boolean;
  products: any[];
  onUpdateQuantity: (detailID: string, newQuantity: number) => void;
  onUpdatePrice: (detailID: string, newPrice: number) => void;
  onUpdateNotes: (detailID: string, newNotes: string) => void;
  onToggleGift: (detailID: string) => void;
  onRemoveItem: (detailID: string) => void;
  onUpdateSerialNo: (detailID: string, index: number, value: string) => void;
}) {
  // Get product image from products array if not in item.product
  const product = products.find(p => (p.ProductID || p.id || p.product_id) === item.ProductID);
  const imageUrl = item.product?.image || product?.Image || product?.image || '';
  const productName = item.product?.name || product?.Name || product?.name || `Product ${item.ProductID}`;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm">
      <div className="flex items-start gap-3 mb-3">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={productName}
            className="w-16 h-16 object-contain rounded border border-gray-200 flex-shrink-0"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-16 h-16 bg-gray-100 rounded border border-gray-200 flex items-center justify-center flex-shrink-0">
            <span className="text-gray-400 text-xs">—</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 font-cairo mb-1">{productName}</h3>
          <div className={`text-lg font-bold font-cairo ${
            item.isGift ? 'text-green-600' : 'text-gray-900'
          }`}>
            ₪{(item.Quantity * item.UnitPrice).toFixed(2)}
            {item.isGift && (
              <span className="text-xs text-green-600 mr-1">(هدية)</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1 font-cairo">الكمية</label>
          <input
            type="number"
            step="1"
            value={item.Quantity}
            onChange={(e) => onUpdateQuantity(item.QuotationDetailID, parseFloat(e.target.value) || 0)}
            onWheel={(e) => e.currentTarget.blur()}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-bold text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1 font-cairo">سعر الوحدة</label>
          <input
            type="number"
            step="1"
            value={item.UnitPrice}
            onChange={(e) => onUpdatePrice(item.QuotationDetailID, parseFloat(e.target.value) || 0)}
            onWheel={(e) => e.currentTarget.blur()}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-bold text-sm"
          />
        </div>
      </div>

      {showCosts && canViewCost && (
        <div className="mb-3">
          <label className="block text-xs text-gray-600 mb-1 font-cairo">تكلفة الوحدة</label>
          <div className="text-sm font-semibold text-gray-900 font-cairo">
            ₪{(item.product?.costPrice || 0).toFixed(2)}
          </div>
        </div>
      )}

      {(item.isSerialized || (item.serialNos && item.serialNos.length > 0)) && (
        <div className="mb-3">
          <label className="block text-xs text-gray-600 mb-1 font-cairo">الأرقام التسلسلية</label>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {Array.from({ length: item.Quantity }, (_, index) => {
              const serialNos = item.serialNos || [];
              while (serialNos.length < item.Quantity) {
                serialNos.push('');
              }
              const serialNo = serialNos[index] || '';
              return (
                <div key={index} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={serialNo}
                    onChange={(e) => onUpdateSerialNo(item.QuotationDetailID, index, e.target.value)}
                    placeholder={item.isSerialized ? `سيريال ${index + 1} (مطلوب)` : `سيريال ${index + 1} (اختياري)`}
                    className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-lg text-gray-900 font-cairo"
                  />
                  <SerialNumberScanner
                    onScan={(serialNumber) => onUpdateSerialNo(item.QuotationDetailID, index, serialNumber)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-3">
        <label className="block text-xs text-gray-600 mb-1 font-cairo">ملاحظات</label>
        <textarea
          value={item.notes || ''}
          onChange={(e) => onUpdateNotes(item.QuotationDetailID, e.target.value)}
          placeholder="ملاحظات..."
          rows={2}
          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg text-gray-900 font-cairo resize-none"
        />
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200">
        <button
          onClick={() => onToggleGift(item.QuotationDetailID)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-cairo ${
            item.isGift
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Gift size={16} />
          <span>{item.isGift ? 'إلغاء الهدية' : 'تحديد كهدية'}</span>
        </button>
        <button
          onClick={() => onRemoveItem(item.QuotationDetailID)}
          className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-cairo"
        >
          <Trash2 size={16} />
          <span>حذف</span>
        </button>
      </div>
    </div>
  );
}

export default function EditQuotationPage() {
  const router = useRouter();
  const params = useParams();
  const quotationId = params.id as string;
  const { admin } = useAdminAuth();
  
  // Check if user has accountant permission (for delete)
  const canAccountant = admin?.is_super_admin || admin?.permissions?.accountant === true;
  
  // Check if user can view customer balances
  const canViewBalances = admin?.is_super_admin || admin?.permissions?.viewBalances === true;

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [date, setDate] = useState('');
  const [customerId, setCustomerId] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('مسودة');
  const [specialDiscountAmount, setSpecialDiscountAmount] = useState(0);
  const [giftDiscountAmount, setGiftDiscountAmount] = useState(0);
  const [details, setDetails] = useState<QuotationDetail[]>([]);
  
  // Calculate gift discount automatically from items marked as gifts
  const calculatedGiftDiscount = useMemo(() => {
    return details
      .filter(item => item.isGift)
      .reduce((sum, item) => sum + (item.Quantity * item.UnitPrice), 0);
  }, [details]);
  
  // Update giftDiscountAmount when calculatedGiftDiscount changes
  useEffect(() => {
    setGiftDiscountAmount(calculatedGiftDiscount);
  }, [calculatedGiftDiscount]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null); // Store the full product object
  const [newProductQuantity, setNewProductQuantity] = useState(1);
  const [newProductPrice, setNewProductPrice] = useState(0);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [showCosts, setShowCosts] = useState(false);
  const [converting, setConverting] = useState<'shop' | 'warehouse' | null>(null);
  const [convertMessage, setConvertMessage] = useState<string | null>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const canViewCost = admin?.is_super_admin || admin?.permissions?.viewCost === true;

  useEffect(() => {
    if (quotationId) {
      loadQuotationData();
      loadProducts();
      loadCustomers();
    }
  }, [quotationId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
      }
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadQuotationData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getQuotationFromSupabase(quotationId);
      setQuotation(data);
      setDate(data.Date || new Date().toISOString().split('T')[0]);
      const custId = data.CustomerID || '';
      setCustomerId(custId);
      setNotes(data.Notes || '');
      setStatus(data.Status || 'مسودة');
      setSpecialDiscountAmount(data.SpecialDiscountAmount || 0);
      setGiftDiscountAmount(data.GiftDiscountAmount || 0);
      
      // First, get raw details from Supabase to access serial_no field
      const { data: rawDetails, error: rawDetailsError } = await supabase
        .from('quotation_details')
        .select('quotation_detail_id, serial_no')
        .eq('quotation_id', quotationId);
      
      const serialNosMap = new Map<string, string[]>();
      if (!rawDetailsError && rawDetails) {
        rawDetails.forEach((detail: any) => {
          if (detail.serial_no && Array.isArray(detail.serial_no)) {
            serialNosMap.set(detail.quotation_detail_id, detail.serial_no.filter((s: any) => s && String(s).trim()));
          }
        });
      }
      
      // Load serial numbers for each detail
      const detailsWithSerials: QuotationDetail[] = await Promise.all(
        (data.details || []).map(async (item: any) => {
          // Load existing serial numbers for this detail
          let serialNos: string[] = [];
          if (item.QuotationDetailID) {
            try {
              // First try to load from serial_numbers table
              serialNos = await getSerialNumbersByDetailId(item.QuotationDetailID, 'quotation');
              console.log('[EditQuotationPage] Loaded serial numbers from serial_numbers table for detail', item.QuotationDetailID, ':', serialNos);
              
              // If no serials found in dedicated table, try to load from details table (fallback)
              if (serialNos.length === 0 && serialNosMap.has(item.QuotationDetailID)) {
                serialNos = serialNosMap.get(item.QuotationDetailID) || [];
                console.log('[EditQuotationPage] Loaded serial numbers from details table (fallback) for detail', item.QuotationDetailID, ':', serialNos);
              }
            } catch (err) {
              console.error('[EditQuotationPage] Failed to load serial numbers:', err);
              // Fallback to details table
              if (serialNosMap.has(item.QuotationDetailID)) {
                serialNos = serialNosMap.get(item.QuotationDetailID) || [];
                console.log('[EditQuotationPage] Using fallback serial numbers from details table:', serialNos);
              }
            }
          }
          
          // Ensure serialNos array matches quantity
          while (serialNos.length < (item.Quantity || 0)) {
            serialNos.push('');
          }
          serialNos = serialNos.slice(0, item.Quantity || 0);
          
          return {
            ...item,
            serialNos: serialNos,
            isSerialized: false, // Will be updated when products are loaded
          };
        })
      );
      
      setDetails(detailsWithSerials);
      // Note: selectedCustomer will be set by useEffect when customers are loaded
    } catch (err: any) {
      console.error('[EditQuotationPage] Failed to load quotation:', err);
      setError(err?.message || 'فشل تحميل العرض السعري');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const productsData = await getProducts();
      setProducts(productsData);
      
      // Update isSerialized for existing quotation items after products are loaded
      setDetails((prevDetails) => {
        return prevDetails.map((detail) => {
          // Find product
          const product = productsData.find(
            (p) => (p.ProductID || p.id || p.product_id) === detail.ProductID
          );
          
          if (product) {
            const isSerialized = product.is_serialized || product.IsSerialized || false;
            
            // Ensure serialNos array matches quantity, but preserve existing serial numbers
            let serialNos = detail.serialNos || [];
            // Only pad if we need more slots, don't truncate existing serials
            while (serialNos.length < detail.Quantity) {
              serialNos.push('');
            }
            // Only slice if quantity decreased
            if (serialNos.length > detail.Quantity) {
              serialNos = serialNos.slice(0, detail.Quantity);
            }
            
            return {
              ...detail,
              isSerialized: isSerialized,
              serialNos: serialNos, // Preserve existing serial numbers
            };
          }
          return detail;
        });
      });
    } catch (err: any) {
      console.error('[EditQuotationPage] Failed to load products:', err);
    }
  };

  const loadCustomers = async () => {
    try {
      const customersData = await getAllCustomers();
      setCustomers(customersData);
    } catch (err: any) {
      console.error('[EditQuotationPage] Failed to load customers:', err);
    }
  };

  // Update selected customer when customers are loaded and customerId is set
  useEffect(() => {
    if (customerId && customers.length > 0 && !selectedCustomer) {
      const customer = customers.find(
        (c) => (c.customer_id || c.CustomerID || c.id) === customerId
      );
      if (customer) {
        setSelectedCustomer(customer);
      }
    }
  }, [customerId, customers, selectedCustomer]);

  const filteredProducts = useMemo(() => {
    const searchWords = productSearchQuery
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (searchWords.length === 0) return products.slice(0, 50);

    return products
      .filter((p) => {
        const name = String(p.name || p.Name || '').toLowerCase();
        const barcode = String(p.barcode || p.Barcode || '').toLowerCase();
        const productId = String(p.product_id || p.ProductID || '').toLowerCase();
        const searchableText = `${name} ${barcode} ${productId}`;
        return searchWords.every((word) => searchableText.includes(word));
      })
      .slice(0, 50);
  }, [products, productSearchQuery]);

  const filteredCustomers = useMemo(() => {
    const searchWords = customerSearchQuery
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (searchWords.length === 0) return customers.slice(0, 50);

    return customers
      .filter((c) => {
        const name = String(c.name || c.Name || '').toLowerCase();
        const cid = String(c.customer_id || c.CustomerID || '').toLowerCase();
        const phone = String(c.phone || c.Phone || '').toLowerCase();
        const searchableText = `${name} ${cid} ${phone}`;
        return searchWords.every((word) => searchableText.includes(word));
      })
      .slice(0, 50);
  }, [customers, customerSearchQuery]);

  const handleUpdateQuantity = (detailID: string, newQuantity: number) => {
    setDetails((prev) =>
      prev.map((item) =>
        item.QuotationDetailID === detailID ? { ...item, Quantity: newQuantity } : item
      )
    );
  };

  const handleUpdatePrice = (detailID: string, newPrice: number) => {
    setDetails((prev) =>
      prev.map((item) =>
        item.QuotationDetailID === detailID ? { ...item, UnitPrice: newPrice } : item
      )
    );
  };

  const handleUpdateNotes = (detailID: string, newNotes: string) => {
    setDetails((prev) =>
      prev.map((item) =>
        item.QuotationDetailID === detailID ? { ...item, notes: newNotes } : item
      )
    );
  };

  const handleUpdateSerialNo = (detailID: string, index: number, value: string) => {
    setDetails((prev) =>
      prev.map((item) => {
        if (item.QuotationDetailID === detailID) {
          const serialNos = [...(item.serialNos || [])];
          // Ensure array is large enough
          while (serialNos.length <= index) {
            serialNos.push('');
          }
          serialNos[index] = value;
          return { ...item, serialNos };
        }
        return item;
      })
    );
  };

  const handleToggleGift = (detailID: string) => {
    setDetails((prev) =>
      prev.map((item) =>
        item.QuotationDetailID === detailID ? { ...item, isGift: !item.isGift } : item
      )
    );
  };

  // Drag and Drop handlers
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !over.id || active.id === over.id) {
      return;
    }

    setDetails((items) => {
      // Create a map of IDs to indices for faster lookup
      const idToIndexMap = new Map<string, number>();
      items.forEach((item, idx) => {
        const itemId = (item.QuotationDetailID && item.QuotationDetailID.trim()) ? item.QuotationDetailID : `temp-${idx}`;
        idToIndexMap.set(String(itemId), idx);
      });

      const oldIndex = idToIndexMap.get(String(active.id));
      const newIndex = idToIndexMap.get(String(over.id));

      if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== newIndex) {
        return arrayMove(items, oldIndex, newIndex);
      }
      
      return items;
    });
  };

  const handleRemoveItem = (detailID: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الصنف؟')) {
      setDetails((prev) => prev.filter((item) => item.QuotationDetailID !== detailID));
    }
  };

  const handleAddProduct = (productParam?: any, quantityParam?: number, priceParam?: number) => {
    // If product is provided directly (from barcode scanner), use it
    let productToAdd = productParam;
    
    // Otherwise, use selectedProduct (from manual selection) - this preserves all product data
    if (!productToAdd) {
      // Priority 1: Use the selected product object directly if available (preserves all data including Name)
      if (selectedProduct) {
        productToAdd = { ...selectedProduct }; // Make a copy to avoid mutations
        console.log('[Quotations] Using selectedProduct directly:', {
          ProductID: productToAdd.ProductID || productToAdd.id || productToAdd.product_id,
          Name: productToAdd.Name,
          name: productToAdd.name,
          hasName: !!(productToAdd.Name || productToAdd.name)
        });
      } else if (selectedProductId) {
        // Priority 2: Fallback - find product by selectedProductId
        const selectedId = String(selectedProductId || '').trim();
        
        productToAdd = products.find((p) => {
          const possibleIds = [
            p.ProductID,
            p.id,
            p.product_id,
            p['ProductID'],
            p['id'],
            p['product_id']
          ].filter(id => id != null).map(id => String(id).trim());
          
          return possibleIds.includes(selectedId);
        });
        
        if (!productToAdd) {
          alert('المنتج غير موجود');
          return;
        }
      } else {
        alert('يرجى اختيار منتج');
        return;
      }
    }

    const quantity = quantityParam != null ? quantityParam : newProductQuantity;

    const detailId = `temp-${Date.now()}`;
    
    // Extract product ID first - productToAdd should have ID fields now
    // Since we ensured productToAdd has ID in previous steps, extract it directly
    const productIdForSearch = String(
      productToAdd.ProductID || 
      productToAdd.id || 
      productToAdd.product_id || 
      (productParam ? (productParam.ProductID || productParam.id || productParam.product_id) : null) ||
      selectedProductId || 
      ''
    ).trim();
    
    if (!productIdForSearch) {
      console.error('[Quotations] CRITICAL: Product ID is still undefined!', {
        productToAdd: {
          ProductID: productToAdd.ProductID,
          id: productToAdd.id,
          product_id: productToAdd.product_id,
          allKeys: Object.keys(productToAdd).slice(0, 20)
        },
        selectedProductId,
        selectedProduct: selectedProduct ? {
          ProductID: selectedProduct.ProductID,
          id: selectedProduct.id,
          product_id: selectedProduct.product_id
        } : null,
        productParam: productParam ? {
          ProductID: productParam.ProductID,
          id: productParam.id,
          product_id: productParam.product_id
        } : null
      });
      alert('خطأ فني: المنتج لا يحتوي على معرف صالح. يرجى المحاولة مرة أخرى أو اختيار منتج آخر.');
      return;
    }
    
    console.log('[Quotations] Final product ID extracted:', productIdForSearch);
    
    // Use provided price, manually entered price, or default sale price
    // Priority: priceParam > newProductPrice (if > 0) > productToAdd.SalePrice > selectedProduct > products array
    let unitPrice = productToAdd.SalePrice || productToAdd.sale_price || productToAdd.price || 0;
    if (priceParam != null && priceParam > 0) {
      unitPrice = priceParam;
    } else if (newProductPrice != null && newProductPrice > 0) {
      unitPrice = newProductPrice;
    } else if (!unitPrice || unitPrice === 0) {
      // If still no price, try to get it from selectedProduct
      if (selectedProduct) {
        unitPrice = selectedProduct.SalePrice || selectedProduct.sale_price || selectedProduct.price || 0;
      }
      // Final fallback - search in products array
      if ((!unitPrice || unitPrice === 0) && productIdForSearch) {
        const originalProduct = products.find(p => {
          const pId = String(p.ProductID || p.id || p.product_id || '').trim();
          return pId === productIdForSearch;
        });
        if (originalProduct) {
          unitPrice = originalProduct.SalePrice || originalProduct.sale_price || originalProduct.price || 0;
        }
      }
    }

    // Extract product name and image - check multiple possible fields
    let productName = '';
    
    // Try all possible name fields
    if (productToAdd.Name && String(productToAdd.Name).trim()) {
      productName = String(productToAdd.Name).trim();
    } else if (productToAdd.name && String(productToAdd.name).trim()) {
      productName = String(productToAdd.name).trim();
    } else if (productToAdd.product_name && String(productToAdd.product_name).trim()) {
      productName = String(productToAdd.product_name).trim();
    }
    
    // If still no name, try to get it from selectedProduct (for manual selection)
    if (!productName && selectedProduct) {
      productName = selectedProduct.Name || selectedProduct.name || '';
      if (productName) {
        productName = String(productName).trim();
      }
    }
    
    // Final fallback - search in products array
    if (!productName && productIdForSearch) {
      const originalProduct = products.find(p => {
        const pId = String(p.ProductID || p.id || p.product_id || '').trim();
        return pId === productIdForSearch;
      });
      if (originalProduct) {
        productName = originalProduct.Name || originalProduct.name || '';
        if (productName) {
          productName = String(productName).trim();
        }
      }
    }
    
    // Last resort
    if (!productName) {
      productName = 'غير معروف';
    }
    
    // Extract product image - check multiple possible fields
    let productImage = '';
    
    // Try all possible image fields from productToAdd
    if (productToAdd.Image && String(productToAdd.Image).trim()) {
      productImage = String(productToAdd.Image).trim();
    } else if (productToAdd.image && String(productToAdd.image).trim()) {
      productImage = String(productToAdd.image).trim();
    } else if (productToAdd['Image'] && String(productToAdd['Image']).trim()) {
      productImage = String(productToAdd['Image']).trim();
    } else if (productToAdd['image'] && String(productToAdd['image']).trim()) {
      productImage = String(productToAdd['image']).trim();
    }
    
    // If still no image, try to get it from selectedProduct (for manual selection)
    if (!productImage && selectedProduct) {
      productImage = selectedProduct.Image || selectedProduct.image || selectedProduct['Image'] || selectedProduct['image'] || '';
      if (productImage) {
        productImage = String(productImage).trim();
      }
    }
    
    // Final fallback - search in products array
    if (!productImage && productIdForSearch) {
      const originalProduct = products.find(p => {
        const pId = String(p.ProductID || p.id || p.product_id || '').trim();
        return pId === productIdForSearch;
      });
      if (originalProduct) {
        productImage = originalProduct.Image || originalProduct.image || originalProduct['Image'] || originalProduct['image'] || '';
        if (productImage) {
          productImage = String(productImage).trim();
        }
      }
    }

    // Extract product cost price - check multiple possible fields
    let costPrice = 0;
    
    // Try all possible cost price fields from productToAdd
    if (productToAdd.CostPrice != null && productToAdd.CostPrice !== undefined) {
      costPrice = parseFloat(String(productToAdd.CostPrice)) || 0;
    } else if (productToAdd.cost_price != null && productToAdd.cost_price !== undefined) {
      costPrice = parseFloat(String(productToAdd.cost_price)) || 0;
    } else if (productToAdd.costPrice != null && productToAdd.costPrice !== undefined) {
      costPrice = parseFloat(String(productToAdd.costPrice)) || 0;
    }
    
    // If still no cost price, try to get it from selectedProduct (for manual selection)
    if (costPrice === 0 && selectedProduct) {
      if (selectedProduct.CostPrice != null && selectedProduct.CostPrice !== undefined) {
        costPrice = parseFloat(String(selectedProduct.CostPrice)) || 0;
      } else if (selectedProduct.cost_price != null && selectedProduct.cost_price !== undefined) {
        costPrice = parseFloat(String(selectedProduct.cost_price)) || 0;
      } else if (selectedProduct.costPrice != null && selectedProduct.costPrice !== undefined) {
        costPrice = parseFloat(String(selectedProduct.costPrice)) || 0;
      }
    }
    
    // Final fallback - search in products array
    if (costPrice === 0 && productIdForSearch) {
      const originalProduct = products.find(p => {
        const pId = String(p.ProductID || p.id || p.product_id || '').trim();
        return pId === productIdForSearch;
      });
      if (originalProduct) {
        if (originalProduct.CostPrice != null && originalProduct.CostPrice !== undefined) {
          costPrice = parseFloat(String(originalProduct.CostPrice)) || 0;
        } else if (originalProduct.cost_price != null && originalProduct.cost_price !== undefined) {
          costPrice = parseFloat(String(originalProduct.cost_price)) || 0;
        } else if (originalProduct.costPrice != null && originalProduct.costPrice !== undefined) {
          costPrice = parseFloat(String(originalProduct.costPrice)) || 0;
        }
      }
    }
    
    // Check if product already exists in details
    const existingDetailIndex = details.findIndex((item) => {
      const itemProductId = String(item.ProductID || '').trim();
      return itemProductId === productIdForSearch;
    });

    if (existingDetailIndex !== -1) {
      // Product already exists, increase quantity
      setDetails((prev) =>
        prev.map((item, index) =>
          index === existingDetailIndex
            ? { ...item, Quantity: item.Quantity + quantity }
            : item
        )
      );
      
      // Clear form and close
      setSelectedProductId('');
      setSelectedProduct(null);
      setNewProductQuantity(1);
      setNewProductPrice(0);
      setShowAddProduct(false);
      setProductSearchQuery('');
      
      // Don't fetch last price as product already exists
      return;
    }

    // Check if product is serialized
    const isSerialized = productToAdd.is_serialized || productToAdd.IsSerialized || false;
    
    // Initialize serial numbers array with empty strings for each quantity
    const serialNos: string[] = Array(quantity).fill('');

    const newDetail: QuotationDetail = {
      QuotationDetailID: detailId,
      QuotationID: quotationId,
      ProductID: productIdForSearch,
      Quantity: quantity,
      UnitPrice: unitPrice,
      notes: '',
      isGift: false,
      serialNos: serialNos,
      isSerialized: isSerialized,
      product: {
        name: productName,
        barcode: productToAdd.Barcode || productToAdd.barcode,
        shamelNo: productToAdd['Shamel No'] || productToAdd.ShamelNo || productToAdd.shamel_no || productToAdd.shamelNo,
        costPrice: costPrice,
        image: productImage,
      },
    };

    setDetails((prev) => [...prev, newDetail]);
    setSelectedProductId('');
    setSelectedProduct(null); // Clear selected product
    setNewProductQuantity(1);
    setNewProductPrice(0);
    setShowAddProduct(false);
    setProductSearchQuery('');

    // Fetch last customer price in background and update if found
    // Only fetch if customer is selected and no price was passed from barcode (priceParam)
    // Always fetch for manual selection, as newProductPrice might be the default product price
    if (customerId && (!priceParam || priceParam === 0)) {
      // Use setTimeout to run in background without blocking UI
      setTimeout(async () => {
        try {
          const lastPrice = await getCustomerLastPriceForProduct(
            customerId,
            productIdForSearch
          );
          
          if (lastPrice && lastPrice > 0) {
            // Update the price for this specific detail
            setDetails((prev) =>
              prev.map((item) =>
                item.QuotationDetailID === detailId ? { ...item, UnitPrice: lastPrice } : item
              )
            );
          }
        } catch (error) {
          console.error('[Quotations] Error fetching last customer price:', error);
        }
      }, 0);
    }
  };

  const calculateSubtotal = () => {
    return details.reduce((sum, item) => sum + item.Quantity * item.UnitPrice, 0);
  };

  const calculateCostSubtotal = () => {
    return details.reduce((sum, item) => sum + item.Quantity * (item.product?.costPrice || 0), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return subtotal - specialDiscountAmount - giftDiscountAmount;
  };

  const calculateCostTotal = () => {
    // إجمالي التكلفة: لا تتأثر بالخصومات لأنها تكلفة الشراء الفعلية من المورد
    // اسم الحقل "بعد الخصم" للمطابقة مع الواجهة لكن القيمة بدون خصم
    return calculateCostSubtotal();
  };

  const calculateProfit = () => {
    // الربح = الإجمالي - إجمالي التكلفة
    // حيث أن الإجمالي = المجموع الفرعي - الخصومات
    // وإجمالي التكلفة = التكلفة الفرعية (بدون خصم لأنها تكلفة الشراء الفعلية)
    return calculateTotal() - calculateCostTotal();
  };

  const calculateDiscountPercentage = () => {
    const subtotal = calculateSubtotal();
    const totalDiscount = specialDiscountAmount + giftDiscountAmount;
    if (subtotal === 0 || totalDiscount === 0) return 0;
    return (totalDiscount / subtotal) * 100;
  };

  const handleConvertToInvoice = async (target: 'shop' | 'warehouse') => {
    if (!customerId) {
      alert('يجب اختيار زبون قبل التحويل إلى فاتورة');
      return;
    }
    if (details.length === 0) {
      alert('لا يمكن التحويل بدون بنود');
      return;
    }

    const discountSum = (specialDiscountAmount || 0) + (giftDiscountAmount || 0);
    const itemsPayload = details.map((item) => ({
      productID: item.ProductID,
      quantity: item.Quantity,
      unitPrice: item.UnitPrice,
    }));

    try {
      setConverting(target);
      setConvertMessage(null);
      if (target === 'shop') {
        const res = await saveShopSalesInvoice({
          customerID: customerId,
          date,
          items: itemsPayload,
          notes,
          discount: discountSum,
          status: mapToInvoiceStatus(),
          created_by: admin?.id || undefined,
        });
        setConvertMessage(`تم التحويل إلى فاتورة المحل بنجاح (رقم: ${res?.invoiceID || '—'})`);
      } else {
        const res = await saveWarehouseSalesInvoice({
          customerID: customerId,
          date,
          items: itemsPayload,
          notes,
          discount: discountSum,
          status: mapToInvoiceStatus(),
          created_by: admin?.id || undefined,
        });
        setConvertMessage(`تم التحويل إلى فاتورة المخزن بنجاح (رقم: ${res?.invoiceID || '—'})`);
      }
    } catch (err: any) {
      console.error('[EditQuotationPage] convert to invoice error:', err);
      alert(err?.message || 'فشل التحويل إلى فاتورة');
    } finally {
      setConverting(null);
    }
  };

  const handleSave = async () => {
    if (details.length === 0) {
      alert('يرجى إضافة منتج واحد على الأقل');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveQuotation(quotationId, {
        date,
        customerId: customerId || null,
        notes,
        status,
        specialDiscountAmount,
        giftDiscountAmount,
        created_by: admin?.id || undefined,
        items: details.map((item) => ({
          detailID: item.QuotationDetailID.startsWith('temp-') ? undefined : item.QuotationDetailID,
          productID: item.ProductID,
          quantity: item.Quantity,
          unitPrice: item.UnitPrice,
          notes: item.notes || '',
          isGift: item.isGift || false,
        })),
      });
      router.push('/admin/quotations');
    } catch (err: any) {
      console.error('[EditQuotationPage] Failed to save quotation:', err);
      setError(err?.message || 'فشل حفظ العرض السعري');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintAndSave = async () => {
    if (details.length === 0) {
      alert('يرجى إضافة منتج واحد على الأقل');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveQuotation(quotationId, {
        date,
        customerId: customerId || null,
        notes,
        status,
        specialDiscountAmount,
        giftDiscountAmount,
        created_by: admin?.id || undefined,
        items: details.map((item) => ({
          detailID: item.QuotationDetailID.startsWith('temp-') ? undefined : item.QuotationDetailID,
          productID: item.ProductID,
          quantity: item.Quantity,
          unitPrice: item.UnitPrice,
          notes: item.notes || '',
          isGift: item.isGift || false,
        })),
      });
      
      // Open print page in new window
      const url = `/admin/quotations/print/${quotationId}`;
      window.open(url, `print-quotation-${quotationId}`, 'noopener,noreferrer');
    } catch (err: any) {
      console.error('[EditQuotationPage] Failed to save and print quotation:', err);
      setError(err?.message || 'فشل حفظ العرض السعري');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('هل أنت متأكد من حذف هذا العرض السعري؟')) {
      return;
    }

    setDeleting(true);
    try {
      await deleteQuotation(quotationId);
      router.push('/admin/quotations');
    } catch (err: any) {
      console.error('[EditQuotationPage] Failed to delete quotation:', err);
      alert(err?.message || 'فشل حذف العرض السعري');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-cairo">جاري التحميل...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error && !quotation) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <p className="text-red-600 text-lg mb-4 font-cairo">{error}</p>
            <button
              onClick={() => router.push('/admin/quotations')}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo"
            >
              العودة
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 font-cairo" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">تعديل عرض سعري</h1>
            <p className="text-gray-600 mt-1">#{quotation?.QuotationID}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowCosts((prev) => !prev)}
              disabled={!canViewCost}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {showCosts ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button
              onClick={() => handleConvertToInvoice('shop')}
              disabled={converting !== null}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-cairo disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {converting === 'shop' ? <Loader2 size={18} className="animate-spin" /> : null}
              تحويل لفاتورة المحل
            </button>
            <button
              onClick={() => handleConvertToInvoice('warehouse')}
              disabled={converting !== null}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-cairo disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {converting === 'warehouse' ? <Loader2 size={18} className="animate-spin" /> : null}
              تحويل لفاتورة المخزن
            </button>
            <button
              onClick={() => router.push('/admin/quotations')}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo text-gray-900 font-bold"
            >
              <ArrowLeft size={20} />
              إلغاء
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 font-cairo">{error}</p>
          </div>
        )}
        {convertMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-700 font-cairo">{convertMessage}</p>
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">التاريخ</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
              />
            </div>
            <div className="relative" ref={customerDropdownRef}>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 font-cairo">الزبون</label>
                {selectedCustomer && customerId && (
                  <button
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey || e.shiftKey) {
                        window.open(`/admin/customers/${customerId}`, '_blank', 'noopener,noreferrer');
                        return;
                      }
                      router.push(`/admin/customers/${customerId}`);
                    }}
                    onMouseDown={(e) => {
                      if (e.button === 1) {
                        e.preventDefault();
                        window.open(`/admin/customers/${customerId}`, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                    title="فتح بروفايل الزبون (Ctrl+Click أو Shift+Click لفتح في تبويب جديد)"
                  >
                    فتح البروفايل
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={selectedCustomer ? (selectedCustomer.name || selectedCustomer.Name || '') : customerSearchQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCustomerSearchQuery(value);
                    if (value === '') {
                      setSelectedCustomer(null);
                      setCustomerId('');
                    } else {
                      setSelectedCustomer(null);
                      setCustomerId('');
                    }
                    setIsCustomerDropdownOpen(true);
                  }}
                  onFocus={() => {
                    if (!selectedCustomer) {
                      setIsCustomerDropdownOpen(true);
                    }
                  }}
                  placeholder="ابحث عن زبون..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
                />
                {isCustomerDropdownOpen && filteredCustomers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredCustomers.map((customer) => (
                      <button
                        key={customer.customer_id || customer.CustomerID || customer.id}
                        type="button"
                        onClick={() => {
                          setCustomerId(customer.customer_id || customer.CustomerID || customer.id || '');
                          setSelectedCustomer(customer);
                          setCustomerSearchQuery('');
                          setIsCustomerDropdownOpen(false);
                        }}
                        className="w-full text-right px-4 py-2 hover:bg-gray-100 text-gray-900 font-cairo"
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex-1 text-right">
                            {customer.name || customer.Name} ({customer.customer_id || customer.CustomerID || customer.id})
                          </span>
                          {canViewBalances && (
                            <span className="text-sm text-gray-500 mr-2" dir="ltr">
                              رصيد: ₪{((customer.balance || customer.Balance || 0)).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedCustomer && canViewBalances && (
                <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between text-sm font-cairo">
                    <span className="text-gray-600">الرصيد:</span>
                    <span className={`font-semibold ${(selectedCustomer.balance || selectedCustomer.Balance || 0) > 0 ? 'text-red-600' : (selectedCustomer.balance || selectedCustomer.Balance || 0) < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                      ₪{((selectedCustomer.balance || selectedCustomer.Balance || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">الحالة</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">الخصم الخاص</label>
              <input
                type="number"
                step="1"
                value={specialDiscountAmount}
                onChange={(e) => setSpecialDiscountAmount(parseFloat(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">
                خصم الهدايا
                {calculatedGiftDiscount > 0 && (
                  <span className="text-xs text-green-600 mr-2">(محسوب تلقائياً)</span>
                )}
              </label>
              <input
                type="number"
                step="1"
                value={giftDiscountAmount}
                onChange={(e) => setGiftDiscountAmount(parseFloat(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                disabled={calculatedGiftDiscount > 0}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold ${
                  calculatedGiftDiscount > 0 ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                title={calculatedGiftDiscount > 0 ? 'يتم الحساب تلقائياً من الأصناف المحددة كهدايا' : ''}
              />
              {calculatedGiftDiscount > 0 && (
                <p className="text-xs text-gray-500 mt-1 font-cairo">
                  يتم حساب قيمة الهدايا تلقائياً من الأصناف المحددة كهدايا
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">الملاحظات</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
            />
          </div>

          {/* Products */}
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 font-cairo">المنتجات</h2>
              <button
                onClick={() => setShowAddProduct(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo text-sm sm:text-base w-full sm:w-auto justify-center"
              >
                <Plus size={18} />
                <span>إضافة منتج</span>
              </button>
            </div>

            {/* Barcode Scanner - Always visible */}
            <div className="mb-4 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">مسح الباركود أو رقم الشامل</label>
              <BarcodeScannerInput
                onProductFound={(product) => {
                  handleAddProduct(product, 1);
                }}
                products={products}
                placeholder="امسح الباركود أو رقم الشامل..."
                className="w-full"
              />
            </div>

            {showAddProduct && (
              <div className="mb-4 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
                
                <div className="relative mb-4" ref={productDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">اختر منتج</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={productSearchQuery}
                      onChange={(e) => {
                        setProductSearchQuery(e.target.value);
                        setIsProductDropdownOpen(true);
                      }}
                      onFocus={() => setIsProductDropdownOpen(true)}
                      placeholder="ابحث عن منتج..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
                    />
                    {isProductDropdownOpen && filteredProducts.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredProducts.map((product) => {
                          const imageUrl = product.Image || product.image || '';
                          return (
                          <button
                            key={product.ProductID || product.id || product.product_id}
                            type="button"
                            onClick={() => {
                              const productId = String(product.ProductID || product.id || product.product_id || '').trim();
                              const productName = product.Name || product.name || '';
                              
                              if (productId) {
                                // Store the full product object to preserve all data including Name and Image
                                setSelectedProduct(product);
                                setSelectedProductId(productId);
                                // Set default price from product
                                const defaultPrice = product.SalePrice || product.sale_price || product.price || 0;
                                setNewProductPrice(defaultPrice);
                                setIsProductDropdownOpen(false);
                                setProductSearchQuery(productName || product.Name || product.name || '');
                              } else {
                                alert('خطأ: المنتج لا يحتوي على معرف صالح');
                              }
                            }}
                            className="w-full text-right px-4 py-2 hover:bg-gray-100 text-gray-900 font-cairo"
                          >
                            <div className="flex items-center gap-3">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={product.Name || product.name}
                                  className="w-12 h-12 object-contain rounded border border-gray-200 flex-shrink-0"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-12 h-12 bg-gray-100 rounded border border-gray-200 flex items-center justify-center flex-shrink-0">
                                  <span className="text-gray-400 text-xs">—</span>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col gap-1">
                                  <span className="text-right text-sm font-medium">{product.Name || product.name}</span>
                                  <span className="text-right text-xs text-gray-600 font-light" dir="rtl">
                                    ₪{product.SalePrice || product.sale_price || product.price || 0} • محل: {product.CS_Shop || product.cs_shop || 0} • مخزن: {product.CS_War || product.cs_war || 0}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">الكمية</label>
                    <input
                      type="number"
                      step="1"
                      value={newProductQuantity}
                      onChange={(e) => setNewProductQuantity(parseFloat(e.target.value) || 1)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold text-sm sm:text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">سعر الوحدة</label>
                    <input
                      type="number"
                      step="1"
                      value={newProductPrice}
                      onChange={(e) => setNewProductPrice(parseFloat(e.target.value) || 0)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold text-sm sm:text-base"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    onClick={handleAddProduct}
                    className="flex-1 sm:flex-none px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo text-sm sm:text-base"
                  >
                    إضافة
                  </button>
                  <button
                    onClick={() => {
                      setShowAddProduct(false);
                      setSelectedProductId('');
                      setProductSearchQuery('');
                    }}
                    className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo text-gray-900 font-bold text-sm sm:text-base"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            {details.length === 0 ? (
              <div className="text-center py-8 text-gray-500 font-cairo">لا توجد منتجات</div>
            ) : (
              <>
                {/* Desktop Table View with Drag and Drop */}
                <div className="hidden md:block overflow-x-auto">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={details.map((item, idx) => (item.QuotationDetailID && item.QuotationDetailID.trim()) ? item.QuotationDetailID : `temp-${idx}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo w-8"></th>
                            <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo min-w-[200px]">المنتج</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">الكمية</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">سعر الوحدة</th>
                            {showCosts && canViewCost && (
                              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">تكلفة الوحدة</th>
                            )}
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">الرقم التسلسلي</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">الإجمالي</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">هدية</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">إجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {details.map((item, index) => (
                            <SortableTableRow
                              key={(item.QuotationDetailID && item.QuotationDetailID.trim()) ? item.QuotationDetailID : `temp-${index}`}
                              item={item}
                              index={index}
                              showCosts={showCosts}
                              canViewCost={canViewCost}
                              products={products}
                              onUpdateQuantity={handleUpdateQuantity}
                              onUpdatePrice={handleUpdatePrice}
                              onUpdateNotes={handleUpdateNotes}
                              onToggleGift={handleToggleGift}
                              onRemoveItem={handleRemoveItem}
                              onUpdateSerialNo={handleUpdateSerialNo}
                            />
                          ))}
                        </tbody>
                      </table>
                    </SortableContext>
                  </DndContext>
                </div>

                {/* Mobile Card View (without drag and drop) */}
                <div className="md:hidden">
                  {details.map((item, index) => (
                    <CardRow
                      key={(item.QuotationDetailID && item.QuotationDetailID.trim()) ? item.QuotationDetailID : `temp-${index}`}
                      item={item}
                      index={index}
                      showCosts={showCosts}
                      canViewCost={canViewCost}
                      products={products}
                      onUpdateQuantity={handleUpdateQuantity}
                      onUpdatePrice={handleUpdatePrice}
                      onUpdateNotes={handleUpdateNotes}
                      onToggleGift={handleToggleGift}
                      onRemoveItem={handleRemoveItem}
                      onUpdateSerialNo={handleUpdateSerialNo}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Summary */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex justify-end">
              <div className="w-full sm:w-auto sm:min-w-[280px] space-y-2">
                <div className="flex justify-between text-sm text-gray-600 font-cairo">
                  <span>المجموع الفرعي:</span>
                  <span className="font-semibold">₪{calculateSubtotal().toFixed(2)}</span>
                </div>
                {specialDiscountAmount > 0 && (
                  <div className="flex justify-between text-sm text-gray-600 font-cairo">
                    <span>الخصم الخاص:</span>
                    <span className="font-semibold text-red-600">-₪{specialDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
                {giftDiscountAmount > 0 && (
                  <div className="flex justify-between text-sm text-gray-600 font-cairo">
                    <span>خصم الهدايا:</span>
                    <span className="font-semibold text-red-600">-₪{giftDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
                {(specialDiscountAmount > 0 || giftDiscountAmount > 0) && (
                  <div className="flex justify-between text-sm text-gray-600 font-cairo">
                    <span>نسبة الخصم:</span>
                    <span className="font-semibold text-green-600">{calculateDiscountPercentage().toFixed(2)}%</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-gray-900 font-cairo border-t border-gray-200 pt-2">
                  <span>الإجمالي:</span>
                  <span>₪{calculateTotal().toFixed(2)}</span>
                </div>
                {showCosts && canViewCost && (
                  <>
                    <div className="flex justify-between text-lg font-bold text-gray-900 font-cairo">
                      <span>إجمالي التكلفة:</span>
                      <span>₪{calculateCostTotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-green-600 font-cairo border-t border-gray-200 pt-2">
                      <span>الربح:</span>
                      <span>₪{calculateProfit().toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            {canAccountant && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-cairo disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    جاري الحذف...
                  </>
                ) : (
                  <>
                    <Trash2 size={20} />
                    حذف
                  </>
                )}
              </button>
            )}
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin/quotations')}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo text-gray-900 font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={handlePrintAndSave}
                disabled={saving || details.length === 0}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-cairo disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Printer size={20} />
                    حفظ وطباعة
                  </>
                )}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || details.length === 0}
                className="flex items-center gap-2 px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    حفظ
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}


