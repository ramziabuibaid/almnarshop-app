'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  getCashInvoiceDetailsFromSupabase,
  searchCashInvoiceById,
  updateCashInvoice,
  deleteCashInvoice,
  getProducts,
  getAllCustomers,
  saveShopSalesInvoice,
  saveWarehouseSalesInvoice,
} from '@/lib/api';
import { getSerialNumbersByDetailId } from '@/lib/api_serial_numbers';
import { validateSerialNumbers } from '@/lib/validation';
import { supabase } from '@/lib/supabase';
import {
  Loader2,
  Save,
  Trash2,
  Plus,
  X,
  ArrowRight,
  Search,
  ChevronDown,
  Copy,
} from 'lucide-react';
import BarcodeScannerInput from '@/components/admin/BarcodeScannerInput';
import SerialNumberScanner from '@/components/admin/SerialNumberScanner';
import ScannerLatinInput from '@/components/admin/ScannerLatinInput';

interface InvoiceDetail {
  detailID: string;
  productID: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  barcode?: string;
  mode?: 'Pick' | 'Scan';
  scannedBarcode?: string;
  productImage?: string;
  serialNos?: string[]; // Array of serial numbers - one per quantity
  isSerialized?: boolean;
}

interface CashInvoice {
  InvoiceID: string;
  DateTime: string;
  Status: string;
  Notes?: string;
  Discount?: number;
  totalAmount?: number;
  isSettled?: boolean;
}

export default function EditInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const { admin } = useAdminAuth();
  const invoiceId = params.id as string;
  
  // Check if user has accountant permission (for delete)
  const canAccountant = admin?.is_super_admin || admin?.permissions?.accountant === true;

  const [invoice, setInvoice] = useState<CashInvoice | null>(null);
  const [details, setDetails] = useState<InvoiceDetail[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null); // Store the full product object
  const [newProductQuantity, setNewProductQuantity] = useState(1);
  const [newProductPrice, setNewProductPrice] = useState(0);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  // Copy as shop/warehouse invoice
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyTarget, setCopyTarget] = useState<'shop' | 'warehouse' | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [copyCustomerId, setCopyCustomerId] = useState('');
  const [copySelectedCustomer, setCopySelectedCustomer] = useState<any>(null);
  const [copyCustomerSearchQuery, setCopyCustomerSearchQuery] = useState('');
  const [isCopyCustomerDropdownOpen, setIsCopyCustomerDropdownOpen] = useState(false);
  const [copyConverting, setCopyConverting] = useState<'shop' | 'warehouse' | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const copyCustomerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (invoiceId) {
      loadInvoiceData();
      loadProducts();
    }
  }, [invoiceId]);

  useEffect(() => {
    if (showCopyModal && customers.length === 0) {
      loadCustomers();
    }
  }, [showCopyModal, customers.length]);

  const loadCustomers = async () => {
    try {
      const customersData = await getAllCustomers();
      setCustomers(customersData);
    } catch (err: any) {
      console.error('[EditInvoicePage] Failed to load customers:', err);
    }
  };

  const loadInvoiceData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load single invoice by ID (avoids fetching full list)
      const foundInvoice = await searchCashInvoiceById(invoiceId);
      
      if (!foundInvoice) {
        throw new Error('الفاتورة غير موجودة');
      }

      // Check if invoice is settled
      if (foundInvoice.isSettled) {
        throw new Error('لا يمكن تعديل فاتورة مرحلة');
      }

      setInvoice(foundInvoice);
      setNotes(foundInvoice.Notes || '');
      setDiscount(foundInvoice.Discount || 0);

      // Load invoice details
      const invoiceDetailsRaw = await getCashInvoiceDetailsFromSupabase(invoiceId);
      
      // First, get raw details from Supabase to access serial_no field
      const { data: rawDetails, error: rawDetailsError } = await supabase
        .from('cash_invoice_details')
        .select('detail_id, serial_no')
        .eq('invoice_id', invoiceId);
      
      const serialNosMap = new Map<string, string[]>();
      if (!rawDetailsError && rawDetails) {
        rawDetails.forEach((detail: any) => {
          if (detail.serial_no && Array.isArray(detail.serial_no)) {
            serialNosMap.set(detail.detail_id, detail.serial_no.filter((s: any) => s && String(s).trim()));
          }
        });
      }
      
      // Load serial numbers for each detail
      const invoiceDetails: InvoiceDetail[] = await Promise.all(
        invoiceDetailsRaw.map(async (item: any) => {
          // Load existing serial numbers for this detail
          let serialNos: string[] = [];
          if (item.detailID) {
            try {
              // First try to load from serial_numbers table
              serialNos = await getSerialNumbersByDetailId(item.detailID, 'cash');
              console.log('[EditInvoicePage] Loaded serial numbers from serial_numbers table for detail', item.detailID, ':', serialNos);
              
              // If no serials found in dedicated table, try to load from details table (fallback)
              if (serialNos.length === 0 && serialNosMap.has(item.detailID)) {
                serialNos = serialNosMap.get(item.detailID) || [];
                console.log('[EditInvoicePage] Loaded serial numbers from details table (fallback) for detail', item.detailID, ':', serialNos);
              }
            } catch (err) {
              console.error('[EditInvoicePage] Failed to load serial numbers:', err);
              // Fallback to details table
              if (serialNosMap.has(item.detailID)) {
                serialNos = serialNosMap.get(item.detailID) || [];
                console.log('[EditInvoicePage] Using fallback serial numbers from details table:', serialNos);
              }
            }
          }
          
          // Ensure serialNos array matches quantity (use absolute value)
          while (serialNos.length < Math.abs(item.quantity || 0)) {
            serialNos.push('');
          }
          serialNos = serialNos.slice(0, Math.abs(item.quantity || 0));
          
          return {
            ...item,
            serialNos: serialNos,
            isSerialized: false, // Will be updated when products are loaded
          };
        })
      );
      
      setDetails(invoiceDetails);
    } catch (err: any) {
      console.error('[EditInvoicePage] Failed to load invoice:', err);
      setError(err?.message || 'فشل تحميل الفاتورة');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const productsData = await getProducts();
      setProducts(productsData);
      
      // Update isSerialized for existing invoice items after products are loaded
      setDetails((prevDetails) => {
        return prevDetails.map((detail) => {
          // Find product
          const product = productsData.find(
            (p) => (p.ProductID || p.id || p.product_id) === detail.productID
          );
          
          if (product) {
            const isSerialized = product.is_serialized || product.IsSerialized || false;
            
            // Ensure serialNos array matches quantity, but preserve existing serial numbers
            let serialNos = detail.serialNos || [];
            // Only pad if we need more slots, don't truncate existing serials
            while (serialNos.length < detail.quantity) {
              serialNos.push('');
            }
            // Only slice if quantity decreased
            if (serialNos.length > detail.quantity) {
              serialNos = serialNos.slice(0, detail.quantity);
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
      console.error('[EditInvoicePage] Failed to load products:', err);
    }
  };

  const handleUpdateQuantity = (detailID: string, newQuantity: number) => {
    // Allow negative quantities (for returns) and zero (no serials needed)
    // Never auto-delete items - user must explicitly click delete button
    setDetails((prev) =>
      prev.map((item) => {
        if (item.detailID === detailID) {
          const currentSerialNos = item.serialNos || [];
          let newSerialNos: string[];
          
          // Use absolute value for serial numbers count (same number whether positive or negative)
          // Zero quantity = no serials needed (empty array)
          const absNewQuantity = Math.abs(newQuantity);
          const absCurrentQuantity = Math.abs(item.quantity);
          
          if (absNewQuantity === 0) {
            // Zero quantity - no serials needed
            newSerialNos = [];
          } else if (absNewQuantity > absCurrentQuantity) {
            // Increase quantity - add empty strings
            newSerialNos = [...currentSerialNos, ...Array(absNewQuantity - absCurrentQuantity).fill('')];
          } else {
            // Decrease quantity - keep first N serials
            newSerialNos = currentSerialNos.slice(0, absNewQuantity);
          }
          
          return { ...item, quantity: newQuantity, serialNos: newSerialNos };
        }
        return item;
      })
    );
  };
  
  const handleUpdateSerialNo = (detailID: string, index: number, value: string) => {
    setDetails((prev) =>
      prev.map((item) => {
        if (item.detailID === detailID) {
          const serialNos = [...(item.serialNos || [])];
          serialNos[index] = value;
          return { ...item, serialNos };
        }
        return item;
      })
    );
  };

  const handleUpdatePrice = (detailID: string, newPrice: number) => {
    setDetails((prev) =>
      prev.map((item) =>
        item.detailID === detailID ? { ...item, unitPrice: newPrice } : item
      )
    );
  };

  const handleRemoveItem = (detailID: string) => {
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

    // Extract product ID first
    const productIdForSearch = String(
      productToAdd.ProductID || 
      productToAdd.id || 
      productToAdd.product_id || 
      (productParam ? (productParam.ProductID || productParam.id || productParam.product_id) : null) ||
      selectedProductId || 
      ''
    ).trim();
    
    if (!productIdForSearch) {
      alert('خطأ فني: المنتج لا يحتوي على معرف صالح. يرجى المحاولة مرة أخرى أو اختيار منتج آخر.');
      return;
    }
    
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
      
      return;
    }

    // Check if product is serialized - try productToAdd first, then search in products array
    let isSerialized = productToAdd.is_serialized || productToAdd.IsSerialized || false;
    if (!isSerialized) {
      // Fallback: search in products array
      const originalProduct = products.find(p => {
        const pId = String(p.ProductID || p.id || p.product_id || '').trim();
        return pId === productIdForSearch;
      });
      if (originalProduct) {
        isSerialized = originalProduct.is_serialized || originalProduct.IsSerialized || false;
      }
    }
    
    // Initialize serial numbers array with empty strings for each quantity (use absolute value)
    // Same number of serials whether quantity is positive or negative
    const serialNos: string[] = Array(Math.abs(quantity)).fill('');

    const newDetail: InvoiceDetail = {
      detailID: `temp-${Date.now()}`,
      productID: productIdForSearch,
      productName: productName,
      quantity: quantity,
      unitPrice: unitPrice,
      barcode: productToAdd.Barcode || productToAdd.barcode || '',
      mode: 'Pick', // New items default to 'Pick'
      productImage: productImage,
      serialNos: serialNos,
      isSerialized: isSerialized,
    };

    setDetails((prev) => [...prev, newDetail]);
    setSelectedProductId('');
    setSelectedProduct(null);
    setNewProductQuantity(1);
    setNewProductPrice(0);
    setShowAddProduct(false);
    setProductSearchQuery('');
  };

  const handleSave = async () => {
    if (invoice?.isSettled) {
      alert('لا يمكن تعديل فاتورة مرحلة');
      return;
    }

    if (details.length === 0) {
      alert('لا يمكن حفظ فاتورة بدون أصناف');
      return;
    }

    // Validate serial numbers
    const validationError = validateSerialNumbers(details.map(item => ({
      productID: item.productID,
      quantity: item.quantity,
      serialNos: item.serialNos || [],
      isSerialized: item.isSerialized || false,
    })));
    
    if (validationError) {
      alert(validationError);
      setSaving(false);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        items: details.map((item) => {
          const serialNos = (item.serialNos || []).filter(s => s && s.trim()).map(s => s.trim());
          return {
            detailID: item.detailID.startsWith('temp-') ? undefined : item.detailID,
            productID: item.productID,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            mode: (item.mode || 'Pick') as 'Pick' | 'Scan', // Preserve original mode or default to 'Pick'
            serialNos: serialNos.length > 0 ? serialNos : undefined,
          };
        }),
        notes: notes || undefined,
        discount: discount || 0,
      };

      await updateCashInvoice(invoiceId, payload, admin?.username);
      alert('تم حفظ التعديلات بنجاح');
      router.push('/admin/invoices');
    } catch (err: any) {
      console.error('[EditInvoicePage] Failed to save:', err);
      setError(err?.message || 'فشل حفظ التعديلات');
      alert('فشل حفظ التعديلات: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.')) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await deleteCashInvoice(invoiceId, admin?.username);
      alert('تم حذف الفاتورة بنجاح');
      router.push('/admin/invoices');
    } catch (err: any) {
      console.error('[EditInvoicePage] Failed to delete:', err);
      setError(err?.message || 'فشل حذف الفاتورة');
      alert('فشل حذف الفاتورة: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setSaving(false);
    }
  };

  const calculateTotals = () => {
    const subtotal = details.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const netTotal = subtotal - discount;
    return { subtotal, discount, netTotal };
  };

  const { subtotal, netTotal } = calculateTotals();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Smart search for products - words don't need to be consecutive
  const filteredProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return products.slice(0, 50);
    
    // Split search query into individual words
    const searchWords = productSearchQuery
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);
    
    if (searchWords.length === 0) return products.slice(0, 50);
    
    return products.filter((p) => {
      // Safely convert all values to strings and create searchable text
      const name = String(p.Name || p.name || '').toLowerCase();
      const brand = String(p.Brand || p.brand || '').toLowerCase();
      const type = String(p.Type || p.type || '').toLowerCase();
      const barcode = String(p.Barcode || p.barcode || '').toLowerCase();
      const productId = String(p.ProductID || p.id || p.product_id || '').toLowerCase();
      
      // Combine all searchable fields into one text
      const searchableText = `${name} ${brand} ${type} ${barcode} ${productId}`;
      
      // Check if ALL search words are found in the searchable text
      return searchWords.every(word => searchableText.includes(word));
    }).slice(0, 50);
  }, [products, productSearchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
        setProductSearchQuery('');
      }
      if (copyCustomerDropdownRef.current && !copyCustomerDropdownRef.current.contains(event.target as Node)) {
        setIsCopyCustomerDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCopyCustomers = useMemo(() => {
    if (!copyCustomerSearchQuery.trim()) return customers.slice(0, 50);
    const searchWords = copyCustomerSearchQuery
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return customers
      .filter((c) => {
        const name = String(c.name || c.Name || '').toLowerCase();
        const cid = String(c.customer_id || c.CustomerID || '').toLowerCase();
        const phone = String(c.phone || c.Phone || '').toLowerCase();
        const searchableText = `${name} ${cid} ${phone}`;
        return searchWords.every((word) => searchableText.includes(word));
      })
      .slice(0, 50);
  }, [customers, copyCustomerSearchQuery]);

  const openCopyModal = (target: 'shop' | 'warehouse') => {
    setCopyTarget(target);
    setCopyCustomerId('');
    setCopySelectedCustomer(null);
    setCopyCustomerSearchQuery('');
    setCopyMessage(null);
    setShowCopyModal(true);
  };

  const handleCopyAsInvoice = async () => {
    if (!copyTarget || !copyCustomerId) {
      alert('يرجى اختيار الزبون');
      return;
    }
    if (details.length === 0) {
      alert('لا توجد أصناف لنسخها');
      return;
    }
    const validationError = validateSerialNumbers(details.map(item => ({
      productID: item.productID,
      quantity: item.quantity,
      serialNos: item.serialNos || [],
      isSerialized: item.isSerialized || false,
    })));
    if (validationError) {
      alert(validationError);
      return;
    }
    const itemsPayload = details.map((item) => ({
      productID: item.productID,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      serialNos: (item.serialNos || []).filter((s) => s && String(s).trim()),
    }));
    const invoiceDate = invoice?.DateTime
      ? new Date(invoice.DateTime).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    setCopyConverting(copyTarget);
    setCopyMessage(null);
    try {
      if (copyTarget === 'shop') {
        const res = await saveShopSalesInvoice({
          customerID: copyCustomerId,
          date: invoiceDate,
          items: itemsPayload,
          notes: notes || undefined,
          discount: discount || 0,
          status: 'غير مدفوع',
          created_by: admin?.id || undefined,
        });
        setCopyMessage(`تم نسخ الفاتورة كفاتورة محل بنجاح (رقم: ${res?.invoiceID || '—'}). يمكنك فتحها من فواتير المحل.`);
      } else {
        const res = await saveWarehouseSalesInvoice({
          customerID: copyCustomerId,
          date: invoiceDate,
          items: itemsPayload,
          notes: notes || undefined,
          discount: discount || 0,
          status: 'غير مدفوع',
          created_by: admin?.id || undefined,
        });
        setCopyMessage(`تم نسخ الفاتورة كفاتورة مخزن بنجاح (رقم: ${res?.invoiceID || '—'}). يمكنك فتحها من فواتير المخزن.`);
      }
    } catch (err: any) {
      console.error('[EditInvoicePage] copy as invoice error:', err);
      alert(err?.message || 'فشل نسخ الفاتورة');
    } finally {
      setCopyConverting(null);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-cairo">جاري تحميل الفاتورة...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error && !invoice) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <p className="text-red-600 text-lg mb-4 font-cairo">{error}</p>
            <button
              onClick={() => router.push('/admin/invoices')}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo"
            >
              العودة إلى القائمة
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">تعديل الفاتورة</h1>
            <p className="text-gray-600 mt-1">رقم الفاتورة: {invoiceId}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => openCopyModal('shop')}
              disabled={details.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-cairo"
              title="نسخ الفاتورة كفاتورة محل على اسم زبون"
            >
              <Copy size={18} />
              نسخ كفاتورة محل
            </button>
            <button
              onClick={() => openCopyModal('warehouse')}
              disabled={details.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-cairo"
              title="نسخ الفاتورة كفاتورة مخزن على اسم زبون"
            >
              <Copy size={18} />
              نسخ كفاتورة مخزن
            </button>
            <button
              onClick={() => router.push('/admin/invoices')}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo"
            >
              <ArrowRight size={18} />
              العودة
            </button>
            {canAccountant && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-cairo"
              >
                <Trash2 size={18} />
                حذف الفاتورة
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || details.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-cairo"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save size={18} />
                  حفظ التعديلات
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 font-cairo">{error}</p>
          </div>
        )}

        {/* Invoice Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">
                الملاحظات
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-cairo"
                rows={3}
                placeholder="أضف ملاحظات..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">
                الخصم (₪)
              </label>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                step="1"
                onWheel={(e) => e.currentTarget.blur()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-cairo"
              />
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 font-cairo">الأصناف</h2>
          </div>

          {/* Barcode Scanner - Always visible */}
          <div className="p-4 bg-gray-50 border-b border-gray-200">
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
          
          {/* Add Product Button */}
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <button
              onClick={() => setShowAddProduct(!showAddProduct)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo w-full sm:w-auto"
            >
              <Plus size={18} />
              إضافة منتج
            </button>
          </div>

          {/* Add Product Form */}
          {showAddProduct && (
            <div className="p-4 bg-gray-50 border-b border-gray-200">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">الكمية</label>
                  <input
                    type="number"
                    step="1"
                    value={newProductQuantity}
                    onChange={(e) => setNewProductQuantity(parseFloat(e.target.value) || 1)}
                    onWheel={(e) => e.currentTarget.blur()}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
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
                    onFocus={(e) => e.target.select()}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddProduct}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo text-sm sm:text-base"
                >
                  إضافة
                </button>
                <button
                  onClick={() => {
                    setShowAddProduct(false);
                    setSelectedProductId('');
                    setSelectedProduct(null);
                    setProductSearchQuery('');
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo text-gray-900 font-bold text-sm sm:text-base"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

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
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {details.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 font-cairo">
                      لا توجد أصناف
                    </td>
                  </tr>
                ) : (
                  details.map((item, index) => {
                    // Get product image from products array
                    const product = products.find(p => (p.ProductID || p.id || p.product_id) === item.productID);
                    const imageUrl = item.productImage || product?.Image || product?.image || '';
                    return (
                    <tr key={item.detailID || `item-${index}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-cairo">
                        {item.barcode || item.productID || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-cairo align-top">
                        <div className="flex items-start gap-2">
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
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{item.productName || '—'}</div>
                            {/* Serial Numbers Display - Show if product is serialized OR if there are existing serials */}
                            {(item.isSerialized === true || (item.serialNos && item.serialNos.length > 0)) && (
                              <div className="mt-2 space-y-1">
                                {Array.from({ length: Math.abs(item.quantity) }, (_, serialIndex) => {
                                  const serialNos = item.serialNos || [];
                                  while (serialNos.length < Math.abs(item.quantity)) {
                                    serialNos.push('');
                                  }
                                  const serialNo = serialNos[serialIndex] || '';
                                  const isEmpty = !serialNo.trim();
                                  const isRequired = item.isSerialized && isEmpty;
                                  
                                  return (
                                    <div key={serialIndex} className="flex items-center gap-1">
                                      <ScannerLatinInput
                                        type="text"
                                        value={serialNo}
                                        onChange={(e) => handleUpdateSerialNo(item.detailID, serialIndex, e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const nextIndex = serialIndex + 1;
                                            if (nextIndex < Math.abs(item.quantity)) {
                                              const nextInput = document.querySelector(
                                                `input[data-serial-index="${nextIndex}"][data-detail-id="${item.detailID}"]`
                                              ) as HTMLInputElement;
                                              if (nextInput) {
                                                nextInput.focus();
                                                nextInput.select();
                                              }
                                            }
                                          }
                                        }}
                                        data-serial-index={serialIndex}
                                        data-detail-id={item.detailID}
                                        placeholder={item.isSerialized ? `سيريال ${serialIndex + 1} (مطلوب)` : `سيريال ${serialIndex + 1} (اختياري)`}
                                        className={`w-full px-2 py-1 border rounded text-gray-900 font-mono text-xs ${
                                          isRequired
                                            ? 'border-yellow-400 bg-yellow-50'
                                            : 'border-gray-300'
                                        }`}
                                      />
                                      <SerialNumberScanner
                                        onScan={(scannedData) => {
                                          // Support multiple serials in one scan (separated by comma, newline, or multiple spaces)
                                          const serials = scannedData
                                            .split(/[,\n\r]+|\s{2,}/)
                                            .map(s => s.trim())
                                            .filter(s => s.length > 0);
                                          
                                          if (serials.length === 0) return;
                                          
                                          const newSerialNos = [...(item.serialNos || [])];
                                          while (newSerialNos.length < Math.abs(item.quantity)) {
                                            newSerialNos.push('');
                                          }
                                          
                                          let currentIndex = serialIndex;
                                          for (const serial of serials) {
                                            if (currentIndex < Math.abs(item.quantity)) {
                                              newSerialNos[currentIndex] = serial;
                                              currentIndex++;
                                            }
                                          }
                                          
                                          setDetails((prev) =>
                                            prev.map((d) =>
                                              d.detailID === item.detailID
                                                ? { ...d, serialNos: newSerialNos }
                                                : d
                                            )
                                          );
                                          
                                          setTimeout(() => {
                                            const nextEmptyIndex = newSerialNos.findIndex((s, idx) => idx >= serialIndex && !s.trim());
                                            if (nextEmptyIndex !== -1) {
                                              const nextInput = document.querySelector(
                                                `input[data-serial-index="${nextEmptyIndex}"][data-detail-id="${item.detailID}"]`
                                              ) as HTMLInputElement;
                                              if (nextInput) {
                                                nextInput.focus();
                                              }
                                            }
                                          }, 100);
                                        }}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap align-top">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleUpdateQuantity(item.detailID, parseFloat(e.target.value) || 0)}
                          step="1"
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-cairo text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap align-top">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => handleUpdatePrice(item.detailID, parseFloat(e.target.value) || 0)}
                          step="1"
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-24 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-cairo text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 font-cairo align-top">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap align-top">
                        <button
                          onClick={() => handleRemoveItem(item.detailID)}
                          className="text-red-600 hover:text-red-900 font-cairo"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 font-cairo">المجموع:</span>
                <span className="font-semibold text-gray-900 font-cairo">{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 font-cairo">الخصم:</span>
                  <span className="font-semibold text-red-600 font-cairo">-{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-gray-300">
                <span className="text-lg font-bold text-gray-900 font-cairo">الصافي للدفع:</span>
                <span className="text-lg font-bold text-gray-900 font-cairo">{formatCurrency(netTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Copy as Shop/Warehouse Invoice Modal */}
        {showCopyModal && copyTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" dir="rtl">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col overflow-visible">
              <div className="p-4 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-lg font-bold text-gray-900 font-cairo">
                  {copyTarget === 'shop' ? 'نسخ الفاتورة كفاتورة محل' : 'نسخ الفاتورة كفاتورة مخزن'}
                </h2>
                <p className="text-sm text-gray-600 font-cairo mt-1">اختر اسم الزبون</p>
              </div>
              <div className="p-4 flex-1 overflow-visible min-h-0">
                {copyMessage ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <p className="text-green-700 font-cairo text-sm">{copyMessage}</p>
                    <div className="flex gap-2 mt-3">
                      <a
                        href={copyTarget === 'shop' ? '/admin/shop-sales' : '/admin/warehouse-sales'}
                        className="text-sm text-blue-600 hover:underline font-cairo"
                      >
                        {copyTarget === 'shop' ? 'فتح فواتير المحل' : 'فتح فواتير المخزن'}
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="relative" ref={copyCustomerDropdownRef}>
                    <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">الزبون</label>
                    <input
                      type="text"
                      value={copySelectedCustomer ? (copySelectedCustomer.name || copySelectedCustomer.Name || '') : copyCustomerSearchQuery}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCopyCustomerSearchQuery(value);
                        if (value === '') {
                          setCopySelectedCustomer(null);
                          setCopyCustomerId('');
                        } else {
                          setCopySelectedCustomer(null);
                          setCopyCustomerId('');
                        }
                        setIsCopyCustomerDropdownOpen(true);
                      }}
                      onFocus={() => {
                        if (!copySelectedCustomer) setIsCopyCustomerDropdownOpen(true);
                      }}
                      placeholder="ابحث عن زبون..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-cairo"
                    />
                    {isCopyCustomerDropdownOpen && (
                      <div className="absolute z-[100] top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {customers.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500 font-cairo flex items-center gap-2">
                            <Loader2 size={18} className="animate-spin flex-shrink-0" />
                            جاري تحميل الزبائن...
                          </div>
                        ) : filteredCopyCustomers.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500 font-cairo">
                            لا توجد نتائج
                          </div>
                        ) : (
                          filteredCopyCustomers.map((customer) => (
                            <button
                              key={customer.customer_id || customer.CustomerID || customer.id}
                              type="button"
                              onClick={() => {
                                setCopyCustomerId(customer.customer_id || customer.CustomerID || customer.id || '');
                                setCopySelectedCustomer(customer);
                                setCopyCustomerSearchQuery('');
                                setIsCopyCustomerDropdownOpen(false);
                              }}
                              className="w-full text-right px-4 py-2 hover:bg-gray-100 text-gray-900 font-cairo"
                            >
                              {customer.name || customer.Name} ({customer.customer_id || customer.CustomerID || customer.id})
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-gray-200 flex gap-2 justify-end flex-shrink-0">
                {copyMessage ? (
                  <button
                    onClick={() => {
                      setShowCopyModal(false);
                      setCopyTarget(null);
                      setCopyMessage(null);
                    }}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-cairo"
                  >
                    إغلاق
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setShowCopyModal(false);
                        setCopyTarget(null);
                        setCopyCustomerId('');
                        setCopySelectedCustomer(null);
                        setCopyMessage(null);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-cairo text-gray-900"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={handleCopyAsInvoice}
                      disabled={!copyCustomerId || copyConverting !== null}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed font-cairo"
                    >
                      {copyConverting ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          جاري النسخ...
                        </>
                      ) : (
                        <>
                          <Copy size={18} />
                          نسخ
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
