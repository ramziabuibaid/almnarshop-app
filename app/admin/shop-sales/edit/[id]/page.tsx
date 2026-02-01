'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  getShopSalesInvoice,
  saveShopSalesInvoice,
  updateShopSalesInvoice,
  deleteShopSalesInvoice,
  getProducts,
  getAllCustomers,
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
  Search,
  ArrowLeft,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import BarcodeScannerInput from '@/components/admin/BarcodeScannerInput';
import SerialNumberScanner from '@/components/admin/SerialNumberScanner';
import ScannerLatinInput from '@/components/admin/ScannerLatinInput';

interface InvoiceDetail {
  detailID?: string;
  productID: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  isNew?: boolean;
  productImage?: string;
  serialNos?: string[]; // Array of serial numbers - one per quantity
  isSerialized?: boolean;
}

const STATUS_OPTIONS = [
  'غير مدفوع',
  'تقسيط شهري',
  'دفعت بالكامل',
  'مدفوع جزئي',
];

export default function EditShopSalesInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;
  const { admin } = useAdminAuth();
  
  // Check if user can view customer balances
  const canViewBalances = admin?.is_super_admin || admin?.permissions?.viewBalances === true;

  const [invoice, setInvoice] = useState<any>(null);
  const [date, setDate] = useState('');
  const [customerId, setCustomerId] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('غير مدفوع');
  const [discount, setDiscount] = useState(0);
  const [details, setDetails] = useState<InvoiceDetail[]>([]);
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
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  const canViewCost = admin?.is_super_admin || admin?.permissions?.viewCost === true;
  // Check if user has accountant permission (for delete)
  const canAccountant = admin?.is_super_admin || admin?.permissions?.accountant === true;

  useEffect(() => {
    if (invoiceId) {
      loadInvoiceData();
      loadProducts();
      loadCustomers();
    }
  }, [invoiceId]);

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

  const loadInvoiceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getShopSalesInvoice(invoiceId);
      
      // Check if invoice is settled
      if (data.AccountantSign === 'مرحلة') {
        setError('لا يمكن تعديل فاتورة مرحلة');
      }
      
      setInvoice(data);
      setDate(data.Date ? new Date(data.Date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      const custId = data.CustomerID || '';
      setCustomerId(custId);
      setNotes(data.Notes || '');
      setStatus(data.Status || 'غير مدفوع');
      setDiscount(data.Discount || 0);
      
      // Map invoice items to details (costPrice will be added after products are loaded)
      // First, get raw details from Supabase to access serial_no field
      const { data: rawDetails, error: rawDetailsError } = await supabase
        .from('shop_sales_details')
        .select('details_id, serial_no')
        .eq('invoice_id', invoiceId);
      
      const serialNosMap = new Map<string, string[]>();
      if (!rawDetailsError && rawDetails) {
        rawDetails.forEach((detail: any) => {
          if (detail.serial_no && Array.isArray(detail.serial_no)) {
            serialNosMap.set(detail.details_id, detail.serial_no.filter((s: any) => s && String(s).trim()));
          }
        });
      }
      
      const mappedDetails: InvoiceDetail[] = await Promise.all(
        (data.Items || []).map(async (item: any) => {
          // Load existing serial numbers for this detail
          let serialNos: string[] = [];
          if (item.DetailsID) {
            try {
              // First try to load from serial_numbers table
              serialNos = await getSerialNumbersByDetailId(item.DetailsID, 'shop_sales');
              console.log('[EditShopSalesInvoicePage] Loaded serial numbers from serial_numbers table for detail', item.DetailsID, ':', serialNos);
              
              // If no serials found in dedicated table, try to load from details table (fallback)
              if (serialNos.length === 0 && serialNosMap.has(item.DetailsID)) {
                serialNos = serialNosMap.get(item.DetailsID) || [];
                console.log('[EditShopSalesInvoicePage] Loaded serial numbers from details table (fallback) for detail', item.DetailsID, ':', serialNos);
              }
            } catch (err) {
              console.error('[EditShopSalesInvoicePage] Failed to load serial numbers:', err);
              // Fallback to details table
              if (serialNosMap.has(item.DetailsID)) {
                serialNos = serialNosMap.get(item.DetailsID) || [];
                console.log('[EditShopSalesInvoicePage] Using fallback serial numbers from details table:', serialNos);
              }
            }
          }
          
          // Ensure serialNos array matches quantity (use absolute value for negative quantities)
          const absQuantity = Math.abs(item.Quantity || 0);
          while (serialNos.length < absQuantity) {
            serialNos.push('');
          }
          serialNos = serialNos.slice(0, absQuantity);
          
          console.log('[EditShopSalesInvoicePage] Final serialNos for product', item.ProductID, ':', serialNos);
          
          return {
            detailID: item.DetailsID,
            productID: item.ProductID,
            productName: item.ProductName || '',
            quantity: item.Quantity || 0,
            unitPrice: item.UnitPrice || 0,
            costPrice: 0, // Will be updated when products are loaded
            isNew: false,
            serialNos: serialNos,
            isSerialized: false, // Will be updated when products are loaded
          };
        })
      );
      setDetails(mappedDetails);
    } catch (err: any) {
      console.error('[EditShopSalesInvoicePage] Failed to load invoice:', err);
      setError(err?.message || 'فشل تحميل الفاتورة');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const productsData = await getProducts();
      setProducts(productsData);
      
      // Update costPrice and isSerialized for existing invoice items after products are loaded
      setDetails((prevDetails) => {
        return prevDetails.map((detail) => {
          // Find product
          const product = productsData.find(
            (p) => (p.ProductID || p.id || p.product_id) === detail.productID
          );
          
          if (product) {
            const costPrice = detail.costPrice && detail.costPrice > 0 
              ? detail.costPrice 
              : (product.CostPrice || product.cost_price || product.costPrice || 0);
            
            const isSerialized = product.is_serialized || product.IsSerialized || false;
            
            // Ensure serialNos array matches quantity, but preserve existing serial numbers
            // Use absolute value for negative quantities
            let serialNos = detail.serialNos || [];
            const absQuantity = Math.abs(detail.quantity);
            // Only pad if we need more slots, don't truncate existing serials
            while (serialNos.length < absQuantity) {
              serialNos.push('');
            }
            // Only slice if quantity decreased
            if (serialNos.length > absQuantity) {
              serialNos = serialNos.slice(0, absQuantity);
            }
            
            return {
              ...detail,
              costPrice: costPrice,
              isSerialized: isSerialized,
              serialNos: serialNos, // Preserve existing serial numbers
            };
          }
          return detail;
        });
      });
    } catch (err: any) {
      console.error('[EditShopSalesInvoicePage] Failed to load products:', err);
    }
  };

  const loadCustomers = async () => {
    try {
      const customersData = await getAllCustomers();
      setCustomers(customersData);
    } catch (err: any) {
      console.error('[EditShopSalesInvoicePage] Failed to load customers:', err);
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

  const handleUpdateQuantity = (detailID: string | undefined, newQuantity: number) => {
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
  
  const handleUpdateSerialNo = (detailID: string | undefined, index: number, value: string) => {
    setDetails((prev) =>
      prev.map((item) => {
        if (item.detailID === detailID) {
          const serialNos = [...(item.serialNos || [])];
          // Ensure array has enough elements (use absolute value for negative quantities)
          while (serialNos.length < Math.abs(item.quantity)) {
            serialNos.push('');
          }
          serialNos[index] = value;
          return { ...item, serialNos };
        }
        return item;
      })
    );
  };

  const handleUpdatePrice = (detailID: string | undefined, newPrice: number) => {
    setDetails((prev) =>
      prev.map((item) =>
        item.detailID === detailID ? { ...item, unitPrice: newPrice } : item
      )
    );
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
        console.log('[ShopSales] Using selectedProduct directly:', {
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
      console.error('[ShopSales] CRITICAL: Product ID is still undefined!', {
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
    
    console.log('[ShopSales] Final product ID extracted:', productIdForSearch);
    
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
      
      // Don't fetch last price as product already exists
      return;
    }

    // Extract costPrice - check multiple possible fields with fallback to products array
    let costPrice = 0;
    
    // Try all possible costPrice fields from productToAdd
    if (productToAdd.CostPrice != null && productToAdd.CostPrice !== 0) {
      costPrice = parseFloat(String(productToAdd.CostPrice)) || 0;
    } else if (productToAdd.cost_price != null && productToAdd.cost_price !== 0) {
      costPrice = parseFloat(String(productToAdd.cost_price)) || 0;
    } else if (productToAdd.costPrice != null && productToAdd.costPrice !== 0) {
      costPrice = parseFloat(String(productToAdd.costPrice)) || 0;
    }
    
    // If still no costPrice, try to get it from selectedProduct (for manual selection)
    if (costPrice === 0 && selectedProduct) {
      costPrice = parseFloat(String(selectedProduct.CostPrice || selectedProduct.cost_price || selectedProduct.costPrice || 0)) || 0;
    }
    
    // Final fallback - search in products array
    if (costPrice === 0) {
      const originalProduct = products.find(p => {
        const pId = String(p.ProductID || p.id || p.product_id || '').trim();
        return pId === productIdForSearch;
      });
      if (originalProduct) {
        costPrice = parseFloat(String(originalProduct.CostPrice || originalProduct.cost_price || originalProduct.costPrice || 0)) || 0;
      }
    }
    
    console.log('[ShopSales] Final costPrice:', costPrice);

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
        console.log('[EditShopSales] Found isSerialized from products array:', isSerialized, 'for product:', productIdForSearch);
      }
    }
    console.log('[EditShopSales] Final isSerialized:', isSerialized, 'for product:', productIdForSearch, 'productToAdd:', {
      is_serialized: productToAdd.is_serialized,
      IsSerialized: productToAdd.IsSerialized
    });
    
    // Initialize serial numbers array with empty strings for each quantity (use absolute value)
    // Same number of serials whether quantity is positive or negative
    const serialNos: string[] = Array(Math.abs(quantity)).fill('');

    const newDetail: InvoiceDetail = {
      detailID: detailId,
      productID: productIdForSearch,
      productName: productName,
      quantity: quantity,
      unitPrice: unitPrice,
      costPrice: costPrice,
      isNew: true,
      productImage: productImage,
      serialNos: serialNos,
      isSerialized: isSerialized,
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
                item.detailID === detailId ? { ...item, unitPrice: lastPrice } : item
              )
            );
          }
        } catch (error) {
          console.error('[ShopSales] Error fetching last customer price:', error);
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
    return subtotal - discount;
  };

  const calculateCostTotal = () => {
    // إجمالي التكلفة: لا تتأثر بالخصومات لأنها تكلفة الشراء الفعلية من المورد
    return calculateCostSubtotal();
  };

  const calculateProfit = () => {
    return calculateTotal() - calculateCostTotal();
  };

  const handleSave = async () => {
    if (invoice?.AccountantSign === 'مرحلة') {
      alert('لا يمكن تعديل فاتورة مرحلة');
      return;
    }

    if (details.length === 0) {
      alert('يرجى إضافة منتج واحد على الأقل');
      return;
    }

    if (!customerId) {
      alert('يرجى اختيار العميل');
      return;
    }

    setSaving(true);
    setError(null);
    try {
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

      // Separate items into: existing (to update), new (to add), and deleted (to remove)
      const itemsToUpdate: Array<{ detailID: string; productID: string; quantity: number; unitPrice: number; serialNos?: string[] }> = [];
      const itemsToAdd: Array<{ productID: string; quantity: number; unitPrice: number; serialNos?: string[] }> = [];
      
      // Get original invoice to find deleted items
      const originalInvoice = await getShopSalesInvoice(invoiceId);
      const originalDetailIDs = new Set<string>((originalInvoice.Items || []).map((item: any) => String(item.DetailsID || '')));
      const currentDetailIDs = new Set<string>(details.filter(item => item.detailID && !item.detailID.startsWith('temp-')).map(item => String(item.detailID!)));
      
      // Find deleted items (items that were in original but not in current details)
      const itemIDsToDelete = Array.from(originalDetailIDs).filter((id: string) => !currentDetailIDs.has(id));

      // Process current details
      details.forEach((item) => {
        const serialNos = (item.serialNos || []).filter(s => s && s.trim()).map(s => s.trim());
        
        if (item.detailID && !item.detailID.startsWith('temp-') && !item.isNew) {
          // Existing item - check if it changed
          const originalItem = originalInvoice.Items.find((i: any) => i.DetailsID === item.detailID);
          if (originalItem) {
            const changed = 
              originalItem.Quantity !== item.quantity ||
              originalItem.UnitPrice !== item.unitPrice ||
              originalItem.ProductID !== item.productID;
            
            if (changed || serialNos.length > 0) {
              itemsToUpdate.push({
                detailID: item.detailID,
                productID: item.productID,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                serialNos: serialNos.length > 0 ? serialNos : undefined,
              });
            }
          }
        } else {
          // New item
          itemsToAdd.push({
            productID: item.productID,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            serialNos: serialNos.length > 0 ? serialNos : undefined,
          });
        }
      });

      const payload = {
        customerID: customerId,
        date,
        notes: notes.trim() || undefined,
        discount: discount || 0,
        status: status as 'غير مدفوع' | 'تقسيط شهري' | 'دفعت بالكامل' | 'مدفوع جزئي',
        itemsToUpdate: itemsToUpdate.length > 0 ? itemsToUpdate : undefined,
        itemsToAdd: itemsToAdd.length > 0 ? itemsToAdd : undefined,
        itemIDsToDelete: itemIDsToDelete.length > 0 ? itemIDsToDelete : undefined,
      };

      await updateShopSalesInvoice(invoiceId, payload, admin?.username);
      router.push('/admin/shop-sales');
    } catch (err: any) {
      console.error('[EditShopSalesInvoicePage] Failed to save invoice:', err);
      setError(err?.message || 'فشل حفظ الفاتورة');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.')) {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      await deleteShopSalesInvoice(invoiceId, admin?.username);
      router.push('/admin/shop-sales');
    } catch (err: any) {
      console.error('[EditShopSalesInvoicePage] Failed to delete invoice:', err);
      setError(err?.message || 'فشل حذف الفاتورة');
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

  if (error && !invoice) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <p className="text-red-600 text-lg mb-4 font-cairo">{error}</p>
            <button
              onClick={() => router.push('/admin/shop-sales')}
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 font-cairo">تعديل فاتورة مبيعات المحل</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base font-cairo">#{invoice?.InvoiceID}</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowCosts((prev) => !prev)}
              disabled={!canViewCost}
              className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none"
            >
              {showCosts ? <EyeOff size={18} /> : <Eye size={18} />}
              <span className="sm:hidden text-sm">التكلفة</span>
            </button>
            <button
              onClick={() => router.push('/admin/shop-sales')}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo text-gray-900 font-bold flex-1 sm:flex-none"
            >
              <ArrowLeft size={20} />
              <span>إلغاء</span>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">الزبون</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">الخصم</label>
              <input
                type="number"
                step="1"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
              />
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
            <h2 className="text-lg font-semibold text-gray-900 font-cairo mb-4">المنتجات</h2>

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
            
            {/* Add Product Button */}
            <div className="mb-4">
              <button
                onClick={() => setShowAddProduct(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo text-sm sm:text-base w-full sm:w-auto"
              >
                <Plus size={20} />
                <span>إضافة منتج</span>
              </button>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 font-cairo">الكمية</label>
                    <input
                      type="number"
                      step="1"
                      value={newProductQuantity}
                      onChange={(e) => setNewProductQuantity(parseFloat(e.target.value) || 1)}
                      onWheel={(e) => e.currentTarget.blur()}
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
                      setProductSearchQuery('');
                    }}
                    className="flex-1 sm:flex-none px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo text-gray-900 font-bold text-sm sm:text-base"
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
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">المنتج</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">الكمية</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">سعر الوحدة</th>
                        {showCosts && canViewCost && (
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">تكلفة الوحدة</th>
                        )}
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">الإجمالي</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {details.map((item, index) => {
                        // Get product image from products array if not in item
                        const product = products.find(p => (p.ProductID || p.id || p.product_id) === item.productID);
                        const imageUrl = item.productImage || product?.Image || product?.image || '';
                        return (
                        <tr key={item.detailID || index}>
                          <td className="px-4 py-3 text-sm text-gray-900 font-cairo align-top">
                            <div className="flex items-start gap-2">
                              {imageUrl ? (
                                <>
                                  <img
                                    src={imageUrl}
                                    alt={item.productName}
                                    className="w-10 h-10 object-contain rounded border border-gray-200 flex-shrink-0"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                                      if (placeholder) placeholder.style.display = 'flex';
                                    }}
                                  />
                                  <div className="w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center flex-shrink-0 hidden">
                                    <span className="text-gray-400 text-xs">—</span>
                                  </div>
                                </>
                              ) : (
                                <div className="w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center flex-shrink-0">
                                  <span className="text-gray-400 text-xs">—</span>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium">{item.productName}</div>
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
                                              // Split by: comma, newline, or 2+ spaces
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
                          <td className="px-4 py-3 align-top">
                            <input
                              type="number"
                              step="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateQuantity(item.detailID, parseFloat(e.target.value) || 0)}
                              onWheel={(e) => e.currentTarget.blur()}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-gray-900 font-bold"
                            />
                          </td>
                          <td className="px-4 py-3 align-top">
                            <input
                              type="number"
                              step="1"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdatePrice(item.detailID, parseFloat(e.target.value) || 0)}
                              onWheel={(e) => e.currentTarget.blur()}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-gray-900 font-bold"
                            />
                          </td>
                          {showCosts && canViewCost && (
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 font-cairo align-top">
                              ₪{(item.costPrice || 0).toFixed(2)}
                            </td>
                          )}
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900 font-cairo align-top">
                            ₪{(item.quantity * item.unitPrice).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 align-top">
                          <button
                              onClick={() => handleRemoveItem(item.detailID)}
                              className="text-red-600 hover:text-red-900 font-cairo"
                          >
                              حذف
                          </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {details.map((item, index) => {
                    // Get product image from products array if not in item
                    const product = products.find(p => (p.ProductID || p.id || p.product_id) === item.productID);
                    const imageUrl = item.productImage || product?.Image || product?.image || '';
                    return (
                      <div key={item.detailID || index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <div className="flex items-start gap-3 mb-3">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={item.productName}
                              className="w-16 h-16 object-contain rounded border border-gray-200 flex-shrink-0"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                                if (placeholder) placeholder.style.display = 'flex';
                              }}
                            />
                          ) : (
                            <div className="w-16 h-16 bg-gray-100 rounded border border-gray-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-gray-400 text-xs">—</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 font-cairo mb-1 line-clamp-2">{item.productName}</h3>
                            <div className="text-lg font-bold text-gray-900 font-cairo mb-2">
                              ₪{(item.quantity * item.unitPrice).toFixed(2)}
                            </div>
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
                                                `input[data-serial-index="${nextIndex}"][data-detail-id="${item.detailID}"][data-mobile="true"]`
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
                                        data-mobile="true"
                                        placeholder={item.isSerialized ? `سيريال ${serialIndex + 1} (مطلوب)` : `سيريال ${serialIndex + 1} (اختياري)`}
                                        className={`flex-1 px-3 py-2 border rounded-lg text-gray-900 font-mono text-sm ${
                                          isRequired
                                            ? 'border-yellow-400 bg-yellow-50'
                                            : 'border-gray-300'
                                        }`}
                                      />
                                      <SerialNumberScanner
                                        onScan={(scannedData) => {
                                          // Support multiple serials in one scan (separated by comma, newline, or multiple spaces)
                                          // Split by: comma, newline, or 2+ spaces
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
                                                `input[data-serial-index="${nextEmptyIndex}"][data-detail-id="${item.detailID}"][data-mobile="true"]`
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
                          <button
                            onClick={() => handleRemoveItem(item.detailID)}
                            className="text-red-600 hover:text-red-900 p-1"
                            title="حذف"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1 font-cairo">الكمية</label>
                            <input
                              type="number"
                              step="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateQuantity(item.detailID, parseFloat(e.target.value) || 0)}
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
                              onChange={(e) => handleUpdatePrice(item.detailID, parseFloat(e.target.value) || 0)}
                              onWheel={(e) => e.currentTarget.blur()}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-bold text-sm"
                            />
                          </div>
                        </div>


                        {showCosts && canViewCost && (
                          <div className="pt-2 border-t border-gray-200">
                            <div className="flex justify-between text-xs text-gray-600 font-cairo">
                              <span>تكلفة الوحدة:</span>
                              <span className="font-semibold text-gray-900">₪{(item.costPrice || 0).toFixed(2)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Summary */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex justify-end">
              <div className="w-full md:w-1/3 space-y-2">
                <div className="flex justify-between text-sm text-gray-600 font-cairo">
                  <span>المجموع الفرعي:</span>
                  <span className="font-semibold">₪{calculateSubtotal().toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-gray-600 font-cairo">
                    <span>الخصم:</span>
                    <span className="font-semibold text-red-600">-₪{discount.toFixed(2)}</span>
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-gray-200">
            {canAccountant && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-cairo disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto text-sm sm:text-base"
              >
                {deleting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={20} />
                    <span>حذف</span>
                  </>
                )}
              </button>
            )}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => router.push('/admin/shop-sales')}
                className="w-full sm:w-auto px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo text-gray-900 font-bold text-sm sm:text-base"
              >
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={saving || details.length === 0 || !customerId}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto text-sm sm:text-base"
              >
                {saving ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    <span>حفظ</span>
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
