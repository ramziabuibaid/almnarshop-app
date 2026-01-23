'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import CustomerFormModal from '@/components/admin/CustomerFormModal';
import {
  saveQuotation,
  getProducts,
  getAllCustomers,
  getCustomerLastPriceForProduct,
} from '@/lib/api';
import {
  Loader2,
  Save,
  Plus,
  X,
  Search,
  ChevronDown,
  ArrowLeft,
  Eye,
  EyeOff,
  UserPlus,
  Trash2,
  Gift,
  GripVertical,
} from 'lucide-react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import BarcodeScannerInput from '@/components/admin/BarcodeScannerInput';

interface QuotationDetail {
  detailID?: string;
  productID: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  barcode?: string;
  costPrice?: number;
  productImage?: string;
  notes?: string;
  isGift?: boolean;
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
  onUpdateQuantity,
  onUpdatePrice,
  onUpdateNotes,
  onToggleGift,
  onRemoveItem,
}: {
  item: QuotationDetail;
  index: number;
  showCosts: boolean;
  canViewCost: boolean;
  onUpdateQuantity: (detailID: string | undefined, newQuantity: number) => void;
  onUpdatePrice: (detailID: string | undefined, newPrice: number) => void;
  onUpdateNotes: (detailID: string | undefined, newNotes: string) => void;
  onToggleGift: (detailID: string | undefined) => void;
  onRemoveItem: (detailID: string | undefined) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.detailID || `temp-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const imageUrl = item.productImage && item.productImage.trim() !== '' ? item.productImage.trim() : '';

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
                alt={item.productName}
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
            <span className="text-sm font-medium">{item.productName}</span>
          </div>
          <textarea
            value={item.notes || ''}
            onChange={(e) => onUpdateNotes(item.detailID, e.target.value)}
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
          value={item.quantity}
          onChange={(e) => onUpdateQuantity(item.detailID, parseFloat(e.target.value) || 0)}
          onWheel={(e) => e.currentTarget.blur()}
          className="w-16 px-2 py-1.5 border border-gray-300 rounded text-gray-900 font-bold text-sm"
        />
      </td>
      <td className="px-3 py-3 text-center">
        <input
          type="number"
          step="1"
          value={item.unitPrice}
          onChange={(e) => onUpdatePrice(item.detailID, parseFloat(e.target.value) || 0)}
          onWheel={(e) => e.currentTarget.blur()}
          className="w-20 px-2 py-1.5 border border-gray-300 rounded text-gray-900 font-bold text-sm"
        />
      </td>
      {showCosts && canViewCost && (
        <td className="px-3 py-3 text-sm font-semibold text-gray-900 font-cairo text-center">
          ₪{(item.costPrice || 0).toFixed(2)}
        </td>
      )}
      <td className={`px-3 py-3 text-sm font-semibold font-cairo text-center ${
        item.isGift ? 'text-green-600' : 'text-gray-900'
      }`}>
        ₪{(item.quantity * item.unitPrice).toFixed(2)}
        {item.isGift && (
          <span className="text-xs text-green-600 mr-1 block">(هدية)</span>
        )}
      </td>
      <td className="px-3 py-3 text-center">
        <button
          onClick={() => onToggleGift(item.detailID)}
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
          onClick={() => onRemoveItem(item.detailID)}
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
  onUpdateQuantity,
  onUpdatePrice,
  onUpdateNotes,
  onToggleGift,
  onRemoveItem,
}: {
  item: QuotationDetail;
  index: number;
  showCosts: boolean;
  canViewCost: boolean;
  onUpdateQuantity: (detailID: string | undefined, newQuantity: number) => void;
  onUpdatePrice: (detailID: string | undefined, newPrice: number) => void;
  onUpdateNotes: (detailID: string | undefined, newNotes: string) => void;
  onToggleGift: (detailID: string | undefined) => void;
  onRemoveItem: (detailID: string | undefined) => void;
}) {
  const imageUrl = item.productImage && item.productImage.trim() !== '' ? item.productImage.trim() : '';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm">
      <div className="flex items-start gap-3 mb-3">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.productName}
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
          <h3 className="text-sm font-semibold text-gray-900 font-cairo mb-1">{item.productName}</h3>
          <div className={`text-lg font-bold font-cairo ${
            item.isGift ? 'text-green-600' : 'text-gray-900'
          }`}>
            ₪{(item.quantity * item.unitPrice).toFixed(2)}
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
            value={item.quantity}
            onChange={(e) => onUpdateQuantity(item.detailID, parseFloat(e.target.value) || 0)}
            onWheel={(e) => e.currentTarget.blur()}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-bold text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1 font-cairo">سعر الوحدة</label>
          <input
            type="number"
            step="1"
            value={item.unitPrice}
            onChange={(e) => onUpdatePrice(item.detailID, parseFloat(e.target.value) || 0)}
            onWheel={(e) => e.currentTarget.blur()}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-bold text-sm"
          />
        </div>
      </div>

      {showCosts && canViewCost && (
        <div className="mb-3">
          <label className="block text-xs text-gray-600 mb-1 font-cairo">تكلفة الوحدة</label>
          <div className="text-sm font-semibold text-gray-900 font-cairo">
            ₪{(item.costPrice || 0).toFixed(2)}
          </div>
        </div>
      )}

      <div className="mb-3">
        <label className="block text-xs text-gray-600 mb-1 font-cairo">ملاحظات</label>
        <textarea
          value={item.notes || ''}
          onChange={(e) => onUpdateNotes(item.detailID, e.target.value)}
          placeholder="ملاحظات..."
          rows={2}
          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg text-gray-900 font-cairo resize-none"
        />
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200">
        <button
          onClick={() => onToggleGift(item.detailID)}
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
          onClick={() => onRemoveItem(item.detailID)}
          className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-cairo"
        >
          <Trash2 size={16} />
          <span>حذف</span>
        </button>
      </div>
    </div>
  );
}

function QuotationsFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { admin } = useAdminAuth();
  
  // Check if user can view customer balances
  const canViewBalances = admin?.is_super_admin || admin?.permissions?.viewBalances === true;
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
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
      .reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }, [details]);
  
  // Update giftDiscountAmount when calculatedGiftDiscount changes
  useEffect(() => {
    setGiftDiscountAmount(calculatedGiftDiscount);
  }, [calculatedGiftDiscount]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  const canViewCost = admin?.is_super_admin || admin?.permissions?.viewCost === true;

  useEffect(() => {
    loadProducts();
    loadCustomers();
  }, []);

  // Check if customerId is provided in query params
  useEffect(() => {
    const customerIdFromQuery = searchParams.get('customerId');
    if (customerIdFromQuery) {
      setCustomerId(customerIdFromQuery);
    }
  }, [searchParams]);

  // Set selected customer when customerId changes
  useEffect(() => {
    if (customerId && customers.length > 0) {
      const foundCustomer = customers.find(
        (c) => (c.CustomerID || c.id || c.customerID) === customerId
      );
      if (foundCustomer) {
        setSelectedCustomer(foundCustomer);
        setCustomerSearchQuery(foundCustomer.Name || foundCustomer.name || '');
      }
    }
  }, [customerId, customers]);

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

  const loadProducts = async () => {
    try {
      const productsData = await getProducts();
      setProducts(productsData);
    } catch (err: any) {
      console.error('[NewQuotationPage] Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const customersData = await getAllCustomers();
      setCustomers(customersData);
    } catch (err: any) {
      console.error('[NewQuotationPage] Failed to load customers:', err);
    }
  };

  const handleCustomerAdded = async (newCustomerId?: string) => {
    // Reload customers list to get the newly added customer
    const updatedCustomers = await getAllCustomers();
    setCustomers(updatedCustomers);
    
    // If customer ID is provided, find and select it
    if (newCustomerId) {
      const newCustomer = updatedCustomers.find(
        (c) => (c.customer_id || c.CustomerID || c.id) === newCustomerId
      );
      if (newCustomer) {
        setCustomerId(newCustomerId);
        setSelectedCustomer(newCustomer);
        setCustomerSearchQuery(newCustomer.name || newCustomer.Name || '');
        setIsCustomerDropdownOpen(false);
      }
    }
    
    setIsCustomerModalOpen(false);
  };

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

  const handleUpdateQuantity = (detailID: string | undefined, newQuantity: number) => {
    setDetails((prev) =>
      prev.map((item) =>
        item.detailID === detailID ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const handleUpdatePrice = (detailID: string | undefined, newPrice: number) => {
    setDetails((prev) =>
      prev.map((item) =>
        item.detailID === detailID ? { ...item, unitPrice: newPrice } : item
      )
    );
  };

  const handleUpdateNotes = (detailID: string | undefined, newNotes: string) => {
    setDetails((prev) =>
      prev.map((item) =>
        item.detailID === detailID ? { ...item, notes: newNotes } : item
      )
    );
  };

  const handleToggleGift = (detailID: string | undefined) => {
    setDetails((prev) =>
      prev.map((item) =>
        item.detailID === detailID ? { ...item, isGift: !item.isGift } : item
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
        const itemId = item.detailID || `temp-${idx}`;
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

  const handleRemoveItem = (detailID: string | undefined) => {
    if (confirm('هل أنت متأكد من حذف هذا الصنف؟')) {
      setDetails((prev) => prev.filter((item) => item.detailID !== detailID));
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
    
    // Extract product name - check multiple possible fields
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
    if (!productName) {
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
    if (!productImage) {
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
    if (costPrice === 0) {
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
      const itemProductId = String(item.productID || '').trim();
      return itemProductId === productIdForSearch;
    });

    if (existingDetailIndex !== -1) {
      // Product already exists, increase quantity
      setDetails((prev) =>
        prev.map((item, index) =>
          index === existingDetailIndex
            ? { ...item, quantity: item.quantity + quantity }
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

    const newDetail: QuotationDetail = {
      detailID: detailId,
      productID: productIdForSearch,
      productName: productName,
      quantity: quantity,
      unitPrice: unitPrice,
      barcode: productToAdd.Barcode || productToAdd.barcode,
      costPrice: costPrice,
      productImage: productImage,
      notes: '',
      isGift: false,
    };

    // Add product immediately
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
                item.detailID === detailId ? { ...item, unitPrice: lastPrice } : item
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
    return details.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  const calculateCostSubtotal = () => {
    return details.reduce((sum, item) => sum + item.quantity * (item.costPrice || 0), 0);
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

  const handleSave = async () => {
    if (details.length === 0) {
      alert('يرجى إضافة منتج واحد على الأقل');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveQuotation(null, {
        date,
        customerId: customerId || null,
        notes,
        status,
        specialDiscountAmount,
        giftDiscountAmount,
        created_by: admin?.id || undefined,
        items: details.map((item) => ({
          productID: item.productID,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          notes: item.notes || '',
          isGift: item.isGift || false,
        })),
      });
      router.push('/admin/quotations');
    } catch (err: any) {
      console.error('[NewQuotationPage] Failed to save quotation:', err);
      setError(err?.message || 'فشل حفظ العرض السعري');
    } finally {
      setSaving(false);
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

  return (
    <AdminLayout>
      <div className="space-y-6 font-cairo" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">عرض سعري جديد</h1>
            <p className="text-gray-600 mt-1">إنشاء عرض سعري جديد</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCosts((prev) => !prev)}
              disabled={!canViewCost}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {showCosts ? <EyeOff size={18} /> : <Eye size={18} />}
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
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="flex items-center gap-1 px-2 py-1 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors font-cairo"
                  title="إضافة زبون جديد"
                >
                  <UserPlus size={16} />
                  <span>إضافة زبون</span>
                </button>
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
                      items={details.map((item, index) => item.detailID || `temp-${index}`)}
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
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">الإجمالي</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">هدية</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">إجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {details.map((item, index) => (
                            <SortableTableRow
                              key={item.detailID || `temp-${index}`}
                              item={item}
                              index={index}
                              showCosts={showCosts}
                              canViewCost={canViewCost}
                              onUpdateQuantity={handleUpdateQuantity}
                              onUpdatePrice={handleUpdatePrice}
                              onUpdateNotes={handleUpdateNotes}
                              onToggleGift={handleToggleGift}
                              onRemoveItem={handleRemoveItem}
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
                      key={item.detailID || `temp-${index}`}
                      item={item}
                      index={index}
                      showCosts={showCosts}
                      canViewCost={canViewCost}
                      onUpdateQuantity={handleUpdateQuantity}
                      onUpdatePrice={handleUpdatePrice}
                      onUpdateNotes={handleUpdateNotes}
                      onToggleGift={handleToggleGift}
                      onRemoveItem={handleRemoveItem}
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
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => router.push('/admin/quotations')}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo text-gray-900 font-bold"
            >
              إلغاء
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

      {/* Customer Form Modal */}
      <CustomerFormModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        customer={null}
        onSuccess={handleCustomerAdded}
      />
    </AdminLayout>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <QuotationsFormContent />
    </Suspense>
  );
}

