'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import InvoicePrint from '@/components/admin/InvoicePrint';
import { saveCashInvoice, getProducts } from '@/lib/api';
import { validateSerialNumbers } from '@/lib/validation';
import { Lock } from 'lucide-react';
import {
  Search,
  Filter,
  ShoppingCart,
  Trash2,
  Printer,
  X,
  Plus,
  Minus,
  ChevronDown,
  Camera,
  RotateCcw,
} from 'lucide-react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import SerialNumberScanner from '@/components/admin/SerialNumberScanner';
import ScannerLatinInput from '@/components/admin/ScannerLatinInput';
import { normalizeBarcodeInput, getLatinCharFromKeyEvent, SCANNER_KEY } from '@/lib/barcodeScannerLatin';

interface CartItem {
  productID: string;
  name: string;
  barcode?: string;
  type?: string;
  brand?: string;
  size?: string;
  color?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  mode: 'Pick' | 'Scan';
  scannedBarcode?: string;
  serialNos?: string[]; // Array of serial numbers - one per quantity
  isSerialized?: boolean;
}

export default function POSPage() {
  const { admin } = useAdminAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Check if user has permission to create POS invoices
  const canCreatePOS = admin?.is_super_admin || admin?.permissions?.createPOS === true;

  useLayoutEffect(() => {
    document.title = 'نقطة البيع - POS';
  }, []);
  const [barcodeInputKey, setBarcodeInputKey] = useState(0); // only to clear uncontrolled input
  const [filters, setFilters] = useState({
    type: '',
    brand: '',
    size: '',
    color: '',
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [invoiceData, setInvoiceData] = useState<{
    invoiceID: string;
    dateTime: string;
    items: any[];
    subtotal: number;
    discount: number;
    netTotal: number;
    notes?: string;
  } | null>(null);
  const [currentInvoiceID, setCurrentInvoiceID] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showCartOnMobile, setShowCartOnMobile] = useState(false);
  const [cameraSupported, setCameraSupported] = useState<boolean | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanProcessing, setIsScanProcessing] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<{deviceId: string; label: string}[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | undefined>(undefined);
  // Load catalog width from localStorage or use default
  const [catalogWidth, setCatalogWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pos-catalog-width');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 20 && parsed <= 80) {
          return parsed;
        }
      }
    }
    return 40; // Default: 40% catalog, 60% cart
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [printOverlayInvoiceId, setPrintOverlayInvoiceId] = useState<string | null>(null);
  const printIframeRef = useRef<HTMLIFrameElement>(null);
  const isMobilePrint = () => typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const barcodeBufferRef = useRef(''); // uncontrolled: no re-render per keystroke
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scannerRef = useRef<BrowserMultiFormatReader | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanAreaRef = useRef<HTMLDivElement>(null);
  const lastScannedRef = useRef<string>('');
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resizeContainerRef = useRef<HTMLDivElement>(null);

  // SearchableSelect Component
  interface SearchableSelectProps {
    value: string;
    options: string[];
    onChange: (value: string) => void;
    placeholder: string;
  }

  const SearchableSelect = ({ value, options, onChange, placeholder }: SearchableSelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const filteredOptions = useMemo(() => {
      if (!searchQuery.trim()) return options;
      const query = searchQuery.toLowerCase();
      return options.filter(opt => opt.toLowerCase().includes(query));
    }, [options, searchQuery]);

    const selectedOption = value ? options.find(opt => opt === value) : null;

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          setSearchQuery('');
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-right flex items-center justify-between text-sm text-gray-900"
        >
          <span className={selectedOption ? 'text-gray-900 font-medium' : 'text-gray-500'}>
            {selectedOption || placeholder}
          </span>
          <ChevronDown size={16} className={`text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden" dir="rtl">
            <div className="p-2 border-b border-gray-200">
              <div className="relative">
                <Search size={16} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="بحث..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full pr-8 pl-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm text-gray-900 placeholder:text-gray-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-48">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                  setSearchQuery('');
                }}
                className={`w-full text-right px-3 py-2 hover:bg-gray-100 transition-colors text-gray-900 ${
                  !value ? 'bg-gray-100 font-medium' : ''
                }`}
              >
                {placeholder}
              </button>
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-600 text-right">لا توجد نتائج</div>
              ) : (
                filteredOptions.map((option: string, index: number) => (
                  <button
                    key={`${option}-${index}`}
                    type="button"
                    onClick={() => {
                      onChange(option);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`w-full text-right px-3 py-2 hover:bg-gray-100 transition-colors text-gray-900 ${
                      value === option ? 'bg-gray-100 font-medium' : ''
                    }`}
                  >
                    {option}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Serial input cell: local state so typing doesn't re-render whole POS; commit on blur/Enter
  const SerialInputCell = ({
    value,
    onCommit,
    productID,
    serialIndex,
    quantity,
    currentSerialNos,
    onScanUpdate,
    placeholder,
    className,
    isRequired = false,
    dataMobile = false,
  }: {
    value: string;
    onCommit: (value: string) => void;
    productID: string;
    serialIndex: number;
    quantity: number;
    currentSerialNos: string[];
    onScanUpdate: (newSerialNos: string[]) => void;
    placeholder: string;
    className: string;
    isRequired?: boolean;
    dataMobile?: boolean;
  }) => {
    const [localValue, setLocalValue] = useState(value);
    useEffect(() => {
      setLocalValue(value);
    }, [value]);
    const showRequired = isRequired && !localValue.trim();
    const handleBlur = () => onCommit(localValue);
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onCommit(localValue);
        // Defer focus to next tick so parent re-render (setCart) is committed first
        const nextIndex = serialIndex + 1;
        if (nextIndex < quantity) {
          const sel = dataMobile
            ? `input[data-serial-index="${nextIndex}"][data-product-id="${productID}"][data-mobile="true"]`
            : `input[data-serial-index="${nextIndex}"][data-product-id="${productID}"]`;
          setTimeout(() => {
            const nextInput = document.querySelector(sel) as HTMLInputElement;
            if (nextInput) {
              nextInput.focus();
              nextInput.select();
            }
          }, 0);
        }
      }
    };
    const handleScan = (scannedData: string) => {
      const serials = scannedData
        .split(/[,\n\r]+|\s{2,}/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (serials.length === 0) return;
      const newSerialNos = [...currentSerialNos];
      while (newSerialNos.length < quantity) newSerialNos.push('');
      let idx = serialIndex;
      for (const s of serials) {
        if (idx < quantity) {
          newSerialNos[idx] = s;
          idx++;
        }
      }
      onScanUpdate(newSerialNos);
      setTimeout(() => {
        const nextEmpty = newSerialNos.findIndex((s, i) => i >= serialIndex && !s.trim());
        if (nextEmpty !== -1) {
          const sel = dataMobile
            ? `input[data-serial-index="${nextEmpty}"][data-product-id="${productID}"][data-mobile="true"]`
            : `input[data-serial-index="${nextEmpty}"][data-product-id="${productID}"]`;
          const nextInput = document.querySelector(sel) as HTMLInputElement;
          if (nextInput) nextInput.focus();
        }
      }, 100);
    };
    return (
      <div className={dataMobile ? 'flex items-center gap-1' : 'flex items-center gap-1.5'}>
        <ScannerLatinInput
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          data-serial-index={serialIndex}
          data-product-id={productID}
          {...(dataMobile ? { 'data-mobile': 'true' } : {})}
          placeholder={placeholder}
          className={`${className} ${showRequired ? 'border-yellow-400 bg-yellow-50' : ''}`}
        />
        <SerialNumberScanner onScan={handleScan} />
      </div>
    );
  };

  // Check if desktop
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Load products on mount
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setIsLoadingProducts(true);
        const data = await getProducts();
        setProducts(data || []);
      } catch (error) {
        console.error('[POS] Error loading products:', error);
        setProducts([]);
      } finally {
        setIsLoadingProducts(false);
      }
    };

    loadProducts();
  }, []);

  const addToCart = useCallback((product: any, mode: 'Pick' | 'Scan' = 'Pick', scannedBarcode?: string) => {
    setCart((prev) => {
      const productID = product.ProductID || product.id;
      const existingItem = prev.find(
        (item) => item.productID === productID
      );

      if (existingItem) {
        // Increment quantity
        return prev.map((item) =>
          item.productID === productID
            ? {
                ...item,
                quantity: item.quantity + 1,
                total: (item.quantity + 1) * item.unitPrice,
              }
            : item
        );
      } else {
        // Add new item
        const newItem: CartItem = {
          productID: productID || '',
          name: product.Name || product.name || 'غير معروف',
          barcode: product.Barcode || product.barcode,
          type: product.Type || product.type,
          brand: product.Brand || product.brand,
          size: product.Size || product.size,
          color: product.Color || product.color,
          quantity: 1,
          unitPrice: product.SalePrice || product.salePrice || product.price || 0,
          total: product.SalePrice || product.salePrice || product.price || 0,
          mode,
          scannedBarcode,
          serialNos: [''], // Initialize with one empty string
          isSerialized: product.is_serialized || product.IsSerialized || false,
        };
        return [...prev, newItem];
      }
    });
  }, []); // No dependencies needed - uses setCart with callback

  // Extract product ID from URL if scanned value is a URL
  const extractProductIdFromUrl = useCallback((scannedValue: string): string | null => {
    // Check if it's a URL (contains http or https or domain)
    if (scannedValue.includes('http') || scannedValue.includes('/product/')) {
      try {
        // Try to extract product ID from URL
        // Pattern: .../product/PRODUCT_ID or .../product/PRODUCT_ID?
        const urlMatch = scannedValue.match(/\/product\/([^/?]+)/);
        if (urlMatch && urlMatch[1]) {
          return urlMatch[1];
        }
      } catch (error) {
        console.warn('[POS] Error parsing URL:', error);
      }
    }
    return null;
  }, []);

  // Submit barcode from ref (uncontrolled) — no state, no re-render during scan
  const submitBarcodeFromRef = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    const raw = (barcodeInputRef.current?.value ?? barcodeBufferRef.current).trim();
    barcodeBufferRef.current = '';
    if (barcodeInputRef.current) barcodeInputRef.current.value = '';
    setBarcodeInputKey((k) => k + 1); // force input remount to clear if needed
    if (!raw) return;

    const scannedValue = normalizeBarcodeInput(raw);
    const productIdFromUrl = extractProductIdFromUrl(scannedValue);
    const searchValue = productIdFromUrl || scannedValue;

    let product: any = null;
    if (productIdFromUrl) {
      product = products.find(
        (p) => String(p.ProductID || p.id || '') === productIdFromUrl
      );
    }
    if (!product) {
      product = products.find(
        (p) => String(p.Barcode || p.barcode || '') === searchValue
      );
    }
    if (!product) {
      product = products.find(
        (p) => String(p['Shamel No'] || p.shamel_no || '') === searchValue
      );
    }

    if (product) {
      addToCart(product, 'Scan', scannedValue);
      barcodeInputRef.current?.focus();
    } else {
      console.log('Product not found for barcode/shamel no:', scannedValue);
      alert(`المنتج غير موجود للباركود أو رقم الشامل: ${scannedValue}`);
    }
  }, [products, addToCart, extractProductIdFromUrl]);

  // Uncontrolled barcode keydown — Latin from event.code, no setState
  const handleBarcodeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const ch = getLatinCharFromKeyEvent(e.nativeEvent);
      if (ch === null) return;

      if (ch === SCANNER_KEY.ENTER) {
        e.preventDefault();
        submitBarcodeFromRef();
        return;
      }
      if (ch === SCANNER_KEY.BACKSPACE) {
        e.preventDefault();
        barcodeBufferRef.current = barcodeBufferRef.current.slice(0, -1);
        if (barcodeInputRef.current) barcodeInputRef.current.value = barcodeBufferRef.current;
        return;
      }

      e.preventDefault();
      barcodeBufferRef.current += ch;
      if (barcodeInputRef.current) barcodeInputRef.current.value = barcodeBufferRef.current;

      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      if (barcodeBufferRef.current.trim().length >= 3) {
        // Use a generous delay so slower Bluetooth scanners can finish sending all digits
        // before we attempt to look up the product. This mirrors the behavior of other
        // barcode inputs in the system and prevents partial codes from triggering errors.
        scanTimeoutRef.current = setTimeout(submitBarcodeFromRef, 300);
      }
    },
    [submitBarcodeFromRef]
  );

  const handleBarcodePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = (e.clipboardData?.getData('text') ?? '').trim();
      const normalized = normalizeBarcodeInput(pasted);
      barcodeBufferRef.current += normalized;
      if (barcodeInputRef.current) barcodeInputRef.current.value = barcodeBufferRef.current;
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      if (barcodeBufferRef.current.trim().length >= 3) {
        scanTimeoutRef.current = setTimeout(submitBarcodeFromRef, 80);
      }
    },
    [submitBarcodeFromRef]
  );

  // Play success sound
  const playSuccessSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.debug('Could not play sound:', e);
    }
  }, []);

  // Play error sound
  const playErrorSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 400;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
      console.debug('Could not play sound:', e);
    }
  }, []);

  // Stop camera scanning
  const stopScanning = useCallback(async () => {
    try {
      // Clear error timeout
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }

      if (scannerRef.current) {
        try {
          scannerRef.current.reset();
        } catch (err) {
          console.warn('[POS] Error resetting scanner:', err);
        }
        scannerRef.current = null;
      }

      // Stop video stream
      if (videoRef.current) {
        const stream = videoRef.current.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        videoRef.current.srcObject = null;
        videoRef.current = null;
      }

      setIsScanning(false);
      setScanSuccess(false);
      setErrorMessage(null);
      setIsScanProcessing(false);
      console.log('[POS] Camera stopped successfully');
    } catch (error) {
      console.error('[POS] Error stopping camera:', error);
      setIsScanning(false);
      setScanSuccess(false);
      setErrorMessage(null);
      setIsScanProcessing(false);
    }
  }, []);

  // Handle barcode scan result
  const handleBarcodeScanned = useCallback((barcode: string) => {
    const normalizedBarcode = normalizeBarcodeInput(barcode.trim());
    // Prevent duplicate scans and processing
    if (normalizedBarcode === lastScannedRef.current || isScanProcessing) {
      return;
    }

    setIsScanProcessing(true);
    setErrorMessage(null);

    // Check if scanned value is a URL and extract product ID
    const productIdFromUrl = extractProductIdFromUrl(normalizedBarcode);
    const searchValue = productIdFromUrl || normalizedBarcode;
    
    // First, try to find by ProductID if we extracted it from URL
    let product: any = null;
    if (productIdFromUrl) {
      product = products.find(
        (p) => String(p.ProductID || p.id || '') === productIdFromUrl
      );
    }

    // If not found, try to find by Barcode
    if (!product) {
      product = products.find(
        (p) => String(p.Barcode || p.barcode || '') === searchValue
      );
    }

    // If not found, try to find by Shamel No (رقم الشامل)
    if (!product) {
      product = products.find(
        (p) => String(p['Shamel No'] || p.shamel_no || '') === searchValue
      );
    }

    if (product) {
      lastScannedRef.current = normalizedBarcode;
      
      // Show success feedback
      setScanSuccess(true);
      playSuccessSound();
      
      // Add to cart
      addToCart(product, 'Scan', normalizedBarcode);
      
      // Close camera after short delay to show success feedback
      setTimeout(() => {
        stopScanning();
        setScanSuccess(false);
        setIsScanProcessing(false);
        
        // Reset last scanned after a delay
        setTimeout(() => {
          lastScannedRef.current = '';
        }, 2000);
      }, 1500);
    } else {
      // Show error feedback (only once, not repeatedly)
      if (!errorMessage) {
        setErrorMessage(`المنتج غير موجود: ${normalizedBarcode}`);
        playErrorSound();
        
        // Clear error message after 3 seconds
        if (errorTimeoutRef.current) {
          clearTimeout(errorTimeoutRef.current);
        }
        errorTimeoutRef.current = setTimeout(() => {
          setErrorMessage(null);
          setIsScanProcessing(false);
        }, 3000);
      }
    }
  }, [products, addToCart, stopScanning, extractProductIdFromUrl, isScanProcessing, errorMessage, playSuccessSound, playErrorSound]);

  // Check if browser supports camera
  const isCameraSupported = useCallback(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }
    
    // Check for MediaDevices API
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Fallback for older browsers
      const getUserMedia = navigator.getUserMedia || 
                          (navigator as any).webkitGetUserMedia || 
                          (navigator as any).mozGetUserMedia || 
                          (navigator as any).msGetUserMedia;
      return !!getUserMedia;
    }
    
    return true;
  }, []);

  // Check camera support on mount and when component is ready
  useEffect(() => {
    const checkCameraSupport = async () => {
      if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        setCameraSupported(false);
        return;
      }

      // Basic check
      const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      const hasLegacyGetUserMedia = !!(navigator.getUserMedia || 
                                       (navigator as any).webkitGetUserMedia || 
                                       (navigator as any).mozGetUserMedia || 
                                       (navigator as any).msGetUserMedia);

      if (hasMediaDevices || hasLegacyGetUserMedia) {
        // Try to enumerate devices to confirm camera is actually available
        try {
          if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasVideoInput = devices.some(device => device.kind === 'videoinput');
            setCameraSupported(hasVideoInput);
          } else {
            // If we can't enumerate, assume support if API exists
            setCameraSupported(true);
          }
        } catch (e) {
          // If enumeration fails, still allow trying (might work)
          setCameraSupported(true);
        }
      } else {
        setCameraSupported(false);
      }
    };

    // Check immediately
    checkCameraSupport();

    // Also check after a short delay (for mobile browsers that load APIs asynchronously)
    const timeout = setTimeout(checkCameraSupport, 500);
    
    return () => clearTimeout(timeout);
  }, []);

  // Start camera scanning
  const startScanning = useCallback(async () => {
    try {
      // Check browser support first
      if (!isCameraSupported()) {
        throw new Error('المتصفح لا يدعم الوصول إلى الكاميرا. يرجى استخدام متصفح حديث مثل Chrome أو Safari.');
      }

      setIsScanning(true);
      
      // Wait a bit to ensure the DOM element is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if element exists
      const element = document.getElementById('barcode-scanner');
      if (!element) {
        throw new Error('عنصر الماسح غير موجود في الصفحة');
      }

      // Stop any existing scanner
      if (scannerRef.current) {
        try {
          scannerRef.current.reset();
        } catch (e) {
          // Ignore cleanup errors
        }
        scannerRef.current = null;
      }

      // Stop any existing video stream
      if (videoRef.current) {
        const stream = videoRef.current.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        videoRef.current.srcObject = null;
      }

      // Create new scanner instance
      const codeReader = new BrowserMultiFormatReader();
      scannerRef.current = codeReader;

      // Get available video input devices
      let deviceId: string | undefined;
      try {
        const videoInputDevices = await codeReader.listVideoInputDevices();
        if (videoInputDevices && videoInputDevices.length > 0) {
          console.log('[POS] Available cameras:', videoInputDevices.map(c => c.label));
          
          // Save available cameras
          setAvailableCameras(videoInputDevices.map(device => ({
            deviceId: device.deviceId,
            label: device.label
          })));
          
          // Prefer back camera
          const backCamera = videoInputDevices.find(device => {
            const label = device.label.toLowerCase();
            return label.includes('back') || 
                   label.includes('rear') ||
                   label.includes('environment') ||
                   label.includes('facing back');
          });
          
          if (!backCamera) {
            // Avoid front camera
            const frontCamera = videoInputDevices.find(device => {
              const label = device.label.toLowerCase();
              return label.includes('front') || 
                     label.includes('user') ||
                     label.includes('facing user');
            });
            
            const nonFrontCamera = videoInputDevices.find(device => device.deviceId !== frontCamera?.deviceId);
            deviceId = nonFrontCamera?.deviceId || videoInputDevices[videoInputDevices.length - 1].deviceId;
          } else {
            deviceId = backCamera.deviceId;
          }
          
          setCurrentCameraId(deviceId);
          const selectedCamera = videoInputDevices.find(device => device.deviceId === deviceId);
          console.log('[POS] Using camera:', selectedCamera?.label || 'Unknown');
        }
      } catch (camError) {
        console.log('[POS] Could not get cameras list:', camError);
      }

      // Get video element
      const videoElement = document.getElementById('barcode-scanner') as HTMLVideoElement;
      if (!videoElement) {
        throw new Error('عنصر الفيديو غير موجود');
      }
      videoRef.current = videoElement;

      // Start decoding from video device
      const startDecoding = async (cameraId: string | undefined) => {
        await codeReader.decodeFromVideoDevice(
          cameraId || undefined,
          videoElement,
          (result, error) => {
            if (result) {
              const text = result.getText();
              if (text) {
                handleBarcodeScanned(text);
              }
            }
            
            if (error && !(error instanceof NotFoundException)) {
              // Ignore NotFoundException - it's normal when no barcode is detected
              console.debug('[POS] Scan error:', error);
            }
          }
        );
      };

      try {
        await startDecoding(deviceId || currentCameraId);
        console.log('[POS] Camera started successfully');
      } catch (startError: any) {
        // If deviceId failed, try without specifying device
        if (deviceId || currentCameraId) {
          try {
            await startDecoding(undefined);
            console.log('[POS] Camera started successfully (fallback)');
          } catch (fallbackError: any) {
            throw fallbackError;
          }
        } else {
          throw startError;
        }
      }
    } catch (error: any) {
      console.error('[POS] Error starting camera:', error);
      setIsScanning(false);
      
      // Better error messages
      let errorMsg = 'فشل فتح الكاميرا';
      const errorStr = String(error?.message || '').toLowerCase();
      
      if (errorStr.includes('streaming not supported') || errorStr.includes('not supported by the browser')) {
        errorMsg = 'المتصفح لا يدعم بث الكاميرا. يرجى:\n1. استخدام متصفح حديث (Chrome، Safari، Firefox)\n2. التأكد من أن الموقع يعمل على HTTPS\n3. تحديث المتصفح إلى آخر إصدار';
      } else if (errorStr.includes('permission') || errorStr.includes('notallowed')) {
        errorMsg = 'يرجى السماح بالوصول إلى الكاميرا في إعدادات المتصفح. اذهب إلى إعدادات المتصفح واسمح بالوصول إلى الكاميرا لهذا الموقع.';
      } else if (errorStr.includes('not found') || errorStr.includes('notfound') || errorStr.includes('no camera')) {
        errorMsg = 'الكاميرا غير متوفرة. تأكد من وجود كاميرا في الجهاز وأنها غير مستخدمة من قبل تطبيق آخر.';
      } else if (errorStr.includes('notreadable') || errorStr.includes('not readable')) {
        errorMsg = 'الكاميرا مستخدمة من قبل تطبيق آخر. يرجى إغلاق التطبيقات الأخرى التي تستخدم الكاميرا.';
      } else if (errorStr.includes('overconstrained')) {
        errorMsg = 'الكاميرا المطلوبة غير متوفرة. سيتم استخدام كاميرا أخرى.';
      } else if (errorStr.includes('https') || errorStr.includes('secure context')) {
        errorMsg = 'الكاميرا تتطلب اتصال آمن (HTTPS). يرجى التأكد من استخدام الموقع عبر HTTPS.';
      } else if (error?.message) {
        errorMsg = `فشل فتح الكاميرا: ${error.message}`;
      }
      
      alert(errorMsg);
      
      // Cleanup on error
      if (scannerRef.current) {
        try {
          scannerRef.current.reset();
        } catch (e) {
          // Ignore cleanup errors
        }
        scannerRef.current = null;
      }
      
      if (videoRef.current) {
        const stream = videoRef.current.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        videoRef.current.srcObject = null;
        videoRef.current = null;
      }
    }
  }, [handleBarcodeScanned, isCameraSupported, currentCameraId]);

  // Switch camera function
  const switchCamera = useCallback(async () => {
    if (!scannerRef.current || !videoRef.current || availableCameras.length < 2) {
      return;
    }

    try {
      // Stop current scanner
      scannerRef.current.reset();

      // Stop current video stream
      if (videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }

      // Find current camera index
      const currentIndex = availableCameras.findIndex(cam => cam.deviceId === currentCameraId);
      const nextIndex = (currentIndex + 1) % availableCameras.length;
      const nextCamera = availableCameras[nextIndex];

      setCurrentCameraId(nextCamera.deviceId);

      // Get video element
      const videoElement = document.getElementById('barcode-scanner') as HTMLVideoElement;
      if (!videoElement) return;

      // Start with new camera
      await scannerRef.current.decodeFromVideoDevice(
        nextCamera.deviceId,
        videoElement,
        (result, error) => {
          if (result) {
            const text = result.getText();
            if (text) {
              handleBarcodeScanned(text);
            }
          }
          
          if (error && !(error instanceof NotFoundException)) {
            console.debug('[POS] Scan error:', error);
          }
        }
      );
    } catch (error) {
      console.error('[POS] Error switching camera:', error);
    }
  }, [availableCameras, currentCameraId, handleBarcodeScanned]);

  // Handle resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeContainerRef.current) return;
      
      const container = resizeContainerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      // In RTL layout:
      // - Catalog is on the right side (visually right)
      // - Cart is on the left side (visually left)
      // - Resize handle is positioned at: right: catalogWidth%
      //
      // clientX coordinates: left edge = containerRect.left, right edge = containerRect.right
      // 
      // When user drags RIGHT (towards catalog): clientX increases
      //   → We want catalogWidth to INCREASE (catalog gets bigger)
      //   → Handle moves right (right: catalogWidth% increases)
      //
      // When user drags LEFT (towards cart): clientX decreases
      //   → We want catalogWidth to DECREASE (cart gets bigger)
      //   → Handle moves left (right: catalogWidth% decreases)
      //
      // The handle is at right: catalogWidth%
      // When dragging RIGHT (clientX increases), we want catalogWidth to increase
      // When dragging LEFT (clientX decreases), we want catalogWidth to decrease
      // So catalogWidth should be proportional to distance from LEFT edge
      const distanceFromLeft = e.clientX - containerRect.left;
      const newWidth = (distanceFromLeft / containerRect.width) * 100;
      
      // Limit between 20% and 80%
      const clampedWidth = Math.max(20, Math.min(80, newWidth));
      setCatalogWidth(clampedWidth);
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('pos-catalog-width', clampedWidth.toString());
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear error timeout
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }

      // Stop scanner
      if (scannerRef.current) {
        try {
          scannerRef.current.reset();
        } catch (e) {
          // Ignore errors during cleanup
        }
        scannerRef.current = null;
      }

      // Stop video stream
      if (videoRef.current) {
        const stream = videoRef.current.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        videoRef.current.srcObject = null;
        videoRef.current = null;
      }
    };
  }, []);

  const removeFromCart = (productID: string) => {
    setCart((prev) => prev.filter((item) => item.productID !== productID));
  };

  const updateQuantity = (productID: string, newQuantity: number) => {
    // Allow negative quantities (for returns) and zero (no serials needed)
    // Never auto-delete items - user must explicitly click delete button
    setCart((prev) =>
      prev.map((item) => {
        if (item.productID === productID) {
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
          
          return {
            ...item,
            quantity: newQuantity,
            total: newQuantity * item.unitPrice,
            serialNos: newSerialNos,
          };
        }
        return item;
      })
    );
  };

  const updatePrice = (productID: string, newPrice: number) => {
    if (newPrice < 0) return;
    setCart((prev) =>
      prev.map((item) =>
        item.productID === productID
          ? {
              ...item,
              unitPrice: newPrice,
              total: item.quantity * newPrice,
            }
          : item
      )
    );
  };

  // Filter products (search by name, brand, type, and ProductID - supports multiple words like main store)
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Apply search - supports multiple words (e.g., "ثلاجة سامسونج" will find products with both words)
    if (searchQuery.trim()) {
      // Split search query into individual words
      const searchWords = searchQuery
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0);
      
      filtered = filtered.filter((p) => {
        // Safely convert all values to strings and create searchable text
        const name = String(p.Name || p.name || '').toLowerCase();
        const brand = String(p.Brand || p.brand || '').toLowerCase();
        const type = String(p.Type || p.type || '').toLowerCase();
        const productID = String(p.ProductID || p.id || '').toLowerCase();
        
        // Combine all searchable fields into one text
        const searchableText = `${name} ${brand} ${type} ${productID}`;
        
        // Check if ALL search words are found in the searchable text
        return searchWords.every(word => searchableText.includes(word));
      });
    }

    // Apply filters
    if (filters.type) {
      filtered = filtered.filter((p) => (p.Type || p.type) === filters.type);
    }
    if (filters.brand) {
      filtered = filtered.filter((p) => (p.Brand || p.brand) === filters.brand);
    }
    if (filters.size) {
      filtered = filtered.filter((p) => (p.Size || p.size) === filters.size);
    }
    if (filters.color) {
      filtered = filtered.filter((p) => (p.Color || p.color) === filters.color);
    }

    return filtered;
  }, [products, searchQuery, filters]);

  // Calculate available filter options based on other selected filters (Cascading Filters)
  const availableTypes = useMemo(() => {
    let filtered = products;
    
    // Apply other filters (excluding type)
    if (filters.brand) {
      filtered = filtered.filter((p) => (p.Brand || p.brand) === filters.brand);
    }
    if (filters.size) {
      filtered = filtered.filter((p) => (p.Size || p.size) === filters.size);
    }
    if (filters.color) {
      filtered = filtered.filter((p) => (p.Color || p.color) === filters.color);
    }
    
    const types = new Set<string>();
    filtered.forEach((p) => {
      const type = p.Type || p.type;
      if (type) types.add(type);
    });
    return Array.from(types).sort();
  }, [products, filters.brand, filters.size, filters.color]);

  const availableBrands = useMemo(() => {
    let filtered = products;
    
    // Apply other filters (excluding brand)
    if (filters.type) {
      filtered = filtered.filter((p) => (p.Type || p.type) === filters.type);
    }
    if (filters.size) {
      filtered = filtered.filter((p) => (p.Size || p.size) === filters.size);
    }
    if (filters.color) {
      filtered = filtered.filter((p) => (p.Color || p.color) === filters.color);
    }
    
    const brands = new Set<string>();
    filtered.forEach((p) => {
      const brand = p.Brand || p.brand;
      if (brand) brands.add(brand);
    });
    return Array.from(brands).sort();
  }, [products, filters.type, filters.size, filters.color]);

  const availableSizes = useMemo(() => {
    let filtered = products;
    
    // Apply other filters (excluding size)
    if (filters.type) {
      filtered = filtered.filter((p) => (p.Type || p.type) === filters.type);
    }
    if (filters.brand) {
      filtered = filtered.filter((p) => (p.Brand || p.brand) === filters.brand);
    }
    if (filters.color) {
      filtered = filtered.filter((p) => (p.Color || p.color) === filters.color);
    }
    
    const sizes = new Set<string>();
    filtered.forEach((p) => {
      const size = p.Size || p.size;
      if (size) sizes.add(size);
    });
    return Array.from(sizes).sort();
  }, [products, filters.type, filters.brand, filters.color]);

  const availableColors = useMemo(() => {
    let filtered = products;
    
    // Apply other filters (excluding color)
    if (filters.type) {
      filtered = filtered.filter((p) => (p.Type || p.type) === filters.type);
    }
    if (filters.brand) {
      filtered = filtered.filter((p) => (p.Brand || p.brand) === filters.brand);
    }
    if (filters.size) {
      filtered = filtered.filter((p) => (p.Size || p.size) === filters.size);
    }
    
    const colors = new Set<string>();
    filtered.forEach((p) => {
      const color = p.Color || p.color;
      if (color) colors.add(color);
    });
    return Array.from(colors).sort();
  }, [products, filters.type, filters.brand, filters.size]);

  // Validate and clean up filters when available options change
  useEffect(() => {
    setFilters((prev) => {
      const updated = { ...prev };
      let changed = false;

      // Check if selected type is still available
      if (updated.type && !availableTypes.includes(updated.type)) {
        updated.type = '';
        updated.brand = '';
        updated.size = '';
        updated.color = '';
        changed = true;
      }

      // Check if selected brand is still available
      if (updated.brand && !availableBrands.includes(updated.brand)) {
        updated.brand = '';
        updated.size = '';
        updated.color = '';
        changed = true;
      }

      // Check if selected size is still available
      if (updated.size && !availableSizes.includes(updated.size)) {
        updated.size = '';
        changed = true;
      }

      // Check if selected color is still available
      if (updated.color && !availableColors.includes(updated.color)) {
        updated.color = '';
        changed = true;
      }

      return changed ? updated : prev;
    });
  }, [availableTypes, availableBrands, availableSizes, availableColors]);

  useEffect(() => {
    if (!printOverlayInvoiceId) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'invoice-print-ready' && printIframeRef.current?.contentWindow) {
        try {
          printIframeRef.current.contentWindow.print();
        } catch (_) {}
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [printOverlayInvoiceId]);

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const netTotal = subtotal - (discount || 0);

  const handlePayAndPrint = async () => {
    if (cart.length === 0) {
      alert('السلة فارغة');
      return;
    }

    // Validate serial numbers (currently disabled)
    const validationError = validateSerialNumbers(cart);
    if (validationError) {
      alert(validationError);
      return;
    }

    setIsProcessing(true);
    try {
      const payload = {
        items: cart.map((item) => ({
          productID: item.productID,
          mode: item.mode,
          scannedBarcode: item.scannedBarcode || item.barcode,
          filterType: item.type,
          filterBrand: item.brand,
          filterSize: item.size,
          filterColor: item.color,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          serialNos: item.serialNos || [],
        })),
        notes: notes.trim() || undefined,
        discount: discount || 0,
        created_by: admin?.id || undefined,
      };

      // Save invoice directly
      const result = await saveCashInvoice(payload);
      
      // Set current invoice ID
      setCurrentInvoiceID(result.invoiceID);
      
      // Prepare invoice data for printing
      // Use current time (will be formatted with Palestine timezone in InvoicePrint)
      setInvoiceData({
        invoiceID: result.invoiceID,
        dateTime: new Date().toISOString(),
        items: cart.map((item) => ({
          productID: item.productID,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          barcode: item.barcode || item.scannedBarcode || '',
          serialNos: item.serialNos?.filter(s => s && s.trim()) || [],
        })),
        subtotal,
        discount: discount || 0,
        netTotal,
        notes: notes.trim() || undefined,
      });

      // Print: on mobile open new tab; on desktop show overlay with iframe (no new tab)
      if (isMobilePrint()) {
        window.open(`/admin/invoices/print/${result.invoiceID}`, `print-${result.invoiceID}`, 'noopener,noreferrer');
      } else {
        setPrintOverlayInvoiceId(result.invoiceID);
      }

      // Clear cart after successful save
      setTimeout(() => {
        setCart([]);
        setNotes('');
        setDiscount(0);
        setInvoiceData(null);
        setCurrentInvoiceID(null);
      }, 1000);
    } catch (error: any) {
      console.error('[POS] Error saving invoice:', error);
      alert(`فشل حفظ الفاتورة: ${error?.message || 'خطأ غير معروف'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Check permissions
  if (!canCreatePOS) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Lock size={48} className="text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-2 font-cairo">ليس لديك صلاحية لإنشاء فواتير POS</p>
            <p className="text-gray-500 text-sm font-cairo">يرجى التواصل مع المشرف للحصول على الصلاحية</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="h-screen flex flex-col no-print overflow-hidden bg-gray-50" dir="rtl" style={{ height: '100vh', maxHeight: '100vh' }}>

        {/* Main Content - Responsive Layout */}
        <div ref={resizeContainerRef} className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 relative">
          {/* Right Side - Catalog */}
          <div 
            className={`${showCartOnMobile ? 'hidden' : 'flex'} lg:flex flex-col bg-white min-h-0`}
            style={isDesktop ? { 
              width: `${catalogWidth}%`,
              minWidth: '20%',
              maxWidth: '80%'
            } : {}}
          >
            {/* Search and Filters */}
            <div className="p-4 lg:p-6 bg-white border-b border-gray-300 flex-shrink-0 shadow-md border-l border-gray-300">
              {/* Barcode Input Row */}
              <div className="flex flex-col lg:flex-row gap-3 mb-4">
                {/* Barcode Input (Separate) */}
                <div className="w-full lg:w-64 xl:w-72 relative">
                  <input
                    key={barcodeInputKey}
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="مسح الباركود..."
                    defaultValue=""
                    onKeyDown={handleBarcodeKeyDown}
                    onPaste={handleBarcodePaste}
                    dir="ltr"
                    lang="en"
                    inputMode="url"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="w-full pr-12 pl-4 py-3 border-2 border-blue-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm lg:text-base font-mono shadow-sm"
                    autoFocus
                    disabled={isScanning}
                  />
                  {/* Camera Scan Button */}
                  <button
                    type="button"
                    onClick={isScanning ? stopScanning : startScanning}
                    disabled={cameraSupported === false}
                    className={`absolute left-2 top-1/2 transform -translate-y-1/2 p-2 rounded-lg transition-all shadow-sm ${
                      isScanning
                        ? 'bg-red-500 text-white hover:bg-red-600 hover:shadow-md'
                        : cameraSupported === false
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-md'
                    }`}
                    title={
                      isScanning 
                        ? 'إيقاف الكاميرا' 
                        : cameraSupported === false
                        ? 'الكاميرا غير مدعومة في هذا المتصفح'
                        : 'فتح الكاميرا لمسح الباركود'
                    }
                  >
                    <Camera size={18} />
                  </button>
                </div>
                
                {/* Search Input (Text only, no barcode) */}
                <div className="flex-1 relative">
                  <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="بحث بالاسم أو رقم الصنف..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pr-12 pl-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-900 text-sm lg:text-base font-cairo shadow-sm"
                  />
                </div>
              </div>

              {/* Filters - Cascading & Searchable */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SearchableSelect
                  value={filters.type}
                  options={availableTypes}
                  onChange={(value) => {
                    setFilters((prev) => ({
                      ...prev,
                      type: value,
                      // Reset dependent filters when type changes
                      brand: value ? prev.brand : '',
                      size: value ? prev.size : '',
                      color: value ? prev.color : '',
                    }));
                  }}
                  placeholder="جميع الأنواع"
                />

                <SearchableSelect
                  value={filters.brand}
                  options={availableBrands}
                  onChange={(value) => {
                    setFilters((prev) => ({
                      ...prev,
                      brand: value,
                      // Reset dependent filters when brand changes
                      size: value ? prev.size : '',
                      color: value ? prev.color : '',
                    }));
                  }}
                  placeholder="جميع الماركات"
                />

                <SearchableSelect
                  value={filters.size}
                  options={availableSizes}
                  onChange={(value) => {
                    setFilters((prev) => ({
                      ...prev,
                      size: value,
                    }));
                  }}
                  placeholder="جميع الأحجام"
                />

                <SearchableSelect
                  value={filters.color}
                  options={availableColors}
                  onChange={(value) => {
                    setFilters((prev) => ({
                      ...prev,
                      color: value,
                    }));
                  }}
                  placeholder="جميع الألوان"
                />
              </div>
            </div>

            {/* Fullscreen Barcode Scanner Camera View */}
            {isScanning && (
              <div className="fixed inset-0 z-50 bg-black flex flex-col">
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white text-lg font-bold mb-1 font-cairo">امسح الباركود</p>
                      <p className="text-gray-300 text-sm font-cairo">وجه الكاميرا نحو الباركود</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Switch Camera Button */}
                      {availableCameras.length > 1 && (
                        <button
                          onClick={switchCamera}
                          className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                          aria-label="تبديل الكاميرا"
                          title="تبديل الكاميرا"
                        >
                          <RotateCcw size={24} />
                        </button>
                      )}
                      <button
                        onClick={stopScanning}
                        className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                        aria-label="إغلاق"
                      >
                        <X size={24} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Video Container */}
                <div className="flex-1 relative overflow-hidden">
                  <video
                    id="barcode-scanner"
                    ref={scanAreaRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    muted
                    autoPlay
                  />

                  {/* Viewfinder Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {/* Scanning Frame */}
                    <div className="relative w-80 h-80 max-w-[85vw] max-h-[85vw]">
                      {/* Corner indicators */}
                      <div className="absolute inset-0 border-4 border-white/80 rounded-lg">
                        {/* Top-left corner */}
                        <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-green-400 rounded-tl-lg"></div>
                        {/* Top-right corner */}
                        <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-green-400 rounded-tr-lg"></div>
                        {/* Bottom-left corner */}
                        <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-green-400 rounded-bl-lg"></div>
                        {/* Bottom-right corner */}
                        <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-green-400 rounded-br-lg"></div>
                      </div>

                      {/* Scanning line animation */}
                      {!scanSuccess && !isScanProcessing && (
                        <div className="absolute inset-0 overflow-hidden rounded-lg">
                          <div className="absolute top-0 left-0 right-0 h-1 bg-green-400 shadow-lg shadow-green-400/50 animate-scan-line"></div>
                        </div>
                      )}

                      {/* Success Indicator */}
                      {scanSuccess && (
                        <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 rounded-lg animate-fade-in">
                          <div className="bg-green-500 rounded-full p-4 shadow-2xl shadow-green-500/50">
                            <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}

                      {/* Error Message */}
                      {errorMessage && (
                        <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in whitespace-nowrap font-cairo">
                          {errorMessage}
                        </div>
                      )}
                    </div>

                    {/* Overlay mask (darken areas outside scanning frame) */}
                    <div className="absolute inset-0 bg-black/60" style={{
                      clipPath: `polygon(
                        0% 0%,
                        0% 100%,
                        calc(50% - 40vw) 100%,
                        calc(50% - 40vw) calc(50% - 40vw),
                        calc(50% + 40vw) calc(50% - 40vw),
                        calc(50% + 40vw) calc(50% + 40vw),
                        calc(50% - 40vw) calc(50% + 40vw),
                        calc(50% - 40vw) 100%,
                        100% 100%,
                        100% 0%
                      )`
                    }}></div>
                  </div>
                </div>

                {/* Footer Instructions */}
                <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <p className="text-white text-center text-sm font-cairo">
                    {isScanProcessing ? 'جاري المعالجة...' : 'ضع الباركود داخل الإطار'}
                  </p>
                </div>
              </div>
            )}

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 min-h-0 bg-gray-50" style={{ WebkitOverflowScrolling: 'touch' }}>
              {isLoadingProducts ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {[...Array(12)].map((_, index) => (
                    <div key={index} className="bg-white rounded-lg border border-gray-200 p-2 sm:p-3 animate-pulse">
                      <div className="aspect-square bg-gray-200 rounded-lg mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {filteredProducts.map((product, index) => {
                  const imageUrl = product.ImageUrl || product.imageUrl || product.Image || product.image || '';
                  const productKey = product.ProductID || product.id || `product-${index}`;
                  return (
                    <div
                      key={productKey}
                      onClick={() => {
                        addToCart(product, 'Pick');
                        // On mobile, show cart after adding item
                        if (window.innerWidth < 768) {
                          setShowCartOnMobile(true);
                        }
                      }}
                      className="group bg-white rounded-xl border border-gray-200 p-2 sm:p-3 cursor-pointer hover:shadow-xl hover:border-blue-400 hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 font-cairo"
                    >
                      <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden border border-gray-200 group-hover:border-blue-300 transition-colors">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={product.Name || product.name}
                            className="w-full h-full object-contain p-1"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                              if (placeholder) placeholder.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        {imageUrl ? (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center hidden">
                            <ShoppingCart size={24} className="text-gray-400" />
                          </div>
                        ) : (
                          <ShoppingCart size={24} className="text-gray-400" />
                        )}
                      </div>
                      <h3 className="font-medium text-xs lg:text-sm text-gray-900 mb-1.5 line-clamp-3 font-cairo min-h-[3rem] leading-tight">
                        {product.Name || product.name || 'غير معروف'}
                      </h3>
                      {/* Stock Information */}
                      <div className="flex items-center gap-2 mb-1.5 text-xs font-cairo">
                        {(product.CS_Shop !== undefined && product.CS_Shop !== null) && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">المحل:</span>
                            <span className={`font-bold px-1.5 py-0.5 rounded text-xs ${
                              (product.CS_Shop || 0) > 0 ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
                            }`}>{product.CS_Shop || 0}</span>
                          </div>
                        )}
                        {(product.CS_War !== undefined && product.CS_War !== null) && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">المخزن:</span>
                            <span className={`font-bold px-1.5 py-0.5 rounded text-xs ${
                              (product.CS_War || 0) > 0 ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
                            }`}>{product.CS_War || 0}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-1.5 border-t border-gray-200">
                        <p className="text-sm lg:text-base font-bold text-blue-600 font-cairo">
                          ₪{parseFloat(product.SalePrice || product.salePrice || 0).toFixed(2)}
                        </p>
                        <div className="w-2 h-2 rounded-full bg-green-400"></div>
                      </div>
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          </div>

          {/* Resize Handle - Desktop Only */}
          <div
            className={`hidden lg:block absolute top-0 bottom-0 w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize transition-colors z-10 ${
              isResizing ? 'bg-blue-500' : ''
            }`}
            style={{ 
              right: `${catalogWidth}%`,
              transform: 'translateX(50%)'
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
          >
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-12 bg-gray-300 hover:bg-blue-500 rounded flex items-center justify-center">
              <div className="w-0.5 h-6 bg-gray-500"></div>
            </div>
          </div>

          {/* Left Side - Invoice/Cart */}
          <div 
            className={`${showCartOnMobile ? 'flex' : 'hidden'} lg:flex flex-col bg-white min-h-0 border-r border-gray-300 shadow-xl`}
            style={isDesktop ? { 
              width: `${100 - catalogWidth}%`,
              minWidth: '20%',
              maxWidth: '80%'
            } : {}}
          >
            {/* Mobile Header - Close Button Only */}
            <div className="lg:hidden p-3 border-b border-gray-200 flex-shrink-0">
              <button
                onClick={() => setShowCartOnMobile(false)}
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="إغلاق السلة"
              >
                <X size={20} />
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-5 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
              {cart.length === 0 ? (
                <div className="text-center py-12 lg:py-16">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <ShoppingCart size={40} className="text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-cairo text-lg">السلة فارغة</p>
                  <p className="text-gray-500 font-cairo text-sm mt-2">أضف منتجات من الكتالوج</p>
                </div>
              ) : (
                <div className="space-y-3 lg:space-y-4">
                  {cart.map((item) => {
                    // Get product image from products array
                    const product = products.find(p => (p.ProductID || p.id || p.product_id) === item.productID);
                    const imageUrl = product?.Image || product?.image || '';
                    return (
                    <div
                      key={item.productID}
                      className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
                    >
                      {/* Desktop View */}
                      <div className="hidden lg:block">
                        <div className="flex items-start gap-3 mb-3">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={item.name}
                              className="w-16 h-16 object-contain rounded-lg border border-gray-200 flex-shrink-0"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                                if (placeholder) placeholder.style.display = 'flex';
                              }}
                            />
                          ) : (
                            <div className="w-16 h-16 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-gray-400 text-xs">—</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 font-cairo mb-1">{item.name}</h3>
                            <p className="text-xs text-gray-500 font-cairo mb-2">#{item.productID}</p>
                            {/* Serial Numbers Display - Show if product is serialized OR if there are existing serials */}
                            {(item.isSerialized === true || (item.serialNos && item.serialNos.length > 0)) && (
                              <div className="mt-2 space-y-1.5">
                                {Array.from({ length: Math.abs(item.quantity) }, (_, serialIndex) => {
                                  const serialNos = item.serialNos || [];
                                  while (serialNos.length < Math.abs(item.quantity)) {
                                    serialNos.push('');
                                  }
                                  const serialNo = serialNos[serialIndex] || '';
                                  return (
                                    <SerialInputCell
                                      key={serialIndex}
                                      value={serialNo}
                                      onCommit={(v) => {
                                        const newSerialNos = [...(item.serialNos || [])];
                                        while (newSerialNos.length < Math.abs(item.quantity)) newSerialNos.push('');
                                        newSerialNos[serialIndex] = v;
                                        setCart((prev) =>
                                          prev.map((cartItem) =>
                                            cartItem.productID === item.productID
                                              ? { ...cartItem, serialNos: newSerialNos }
                                              : cartItem
                                          )
                                        );
                                      }}
                                      productID={item.productID}
                                      serialIndex={serialIndex}
                                      quantity={Math.abs(item.quantity)}
                                      currentSerialNos={serialNos}
                                      onScanUpdate={(newSerialNos) =>
                                        setCart((prev) =>
                                          prev.map((cartItem) =>
                                            cartItem.productID === item.productID
                                              ? { ...cartItem, serialNos: newSerialNos }
                                              : cartItem
                                          )
                                        )
                                      }
                                      placeholder={item.isSerialized ? `سيريال ${serialIndex + 1} (مطلوب)` : `سيريال ${serialIndex + 1} (اختياري)`}
                                      className="flex-1 px-2 py-1.5 border rounded text-xs text-gray-900 font-mono border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                                      isRequired={item.isSerialized}
                                    />
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => removeFromCart(item.productID)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-colors flex-shrink-0"
                            title="حذف"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-200">
                          {/* Quantity Controls */}
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-600 font-cairo whitespace-nowrap">الكمية:</label>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updateQuantity(item.productID, item.quantity - 1)}
                                className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
                              >
                                <Minus size={14} />
                              </button>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateQuantity(item.productID, parseFloat(e.target.value) || 0)}
                                onFocus={(e) => e.target.select()}
                                className="w-16 text-center border border-gray-300 rounded-lg py-1.5 text-sm text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
                              />
                              <button
                                onClick={() => updateQuantity(item.productID, item.quantity + 1)}
                                className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                          
                          {/* Price Input */}
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-600 font-cairo whitespace-nowrap">السعر:</label>
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => updatePrice(item.productID, parseFloat(e.target.value) || 0)}
                              step="0.01"
                              min="0"
                              className="w-24 text-center border border-gray-300 rounded-lg py-1.5 text-sm text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
                              placeholder="السعر"
                            />
                          </div>
                          
                          {/* Total */}
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-600 font-cairo whitespace-nowrap">الإجمالي:</label>
                            <p className="text-base font-bold text-gray-900 font-cairo min-w-[80px] text-left">₪{item.total.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Mobile View */}
                      <div className="md:hidden space-y-2">
                        <div className="flex items-start gap-3">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={item.name}
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
                            <h3 className="text-sm font-semibold text-gray-900 font-cairo mb-1 line-clamp-2">{item.name}</h3>
                            <p className="text-xs text-gray-500 font-cairo mb-1">#{item.productID}</p>
                            <div className="text-lg font-bold text-gray-900 font-cairo mb-2">
                              ₪{item.total.toFixed(2)}
                            </div>
                            {/* Serial Numbers Display */}
                            {(item.isSerialized === true || (item.serialNos && item.serialNos.length > 0)) && (
                              <div className="mt-2 space-y-1">
                                {Array.from({ length: Math.abs(item.quantity) }, (_, serialIndex) => {
                                  const serialNos = item.serialNos || [];
                                  while (serialNos.length < Math.abs(item.quantity)) {
                                    serialNos.push('');
                                  }
                                  const serialNo = serialNos[serialIndex] || '';
                                  return (
                                    <SerialInputCell
                                      key={serialIndex}
                                      value={serialNo}
                                      onCommit={(v) => {
                                        const newSerialNos = [...(item.serialNos || [])];
                                        while (newSerialNos.length < Math.abs(item.quantity)) newSerialNos.push('');
                                        newSerialNos[serialIndex] = v;
                                        setCart((prev) =>
                                          prev.map((cartItem) =>
                                            cartItem.productID === item.productID
                                              ? { ...cartItem, serialNos: newSerialNos }
                                              : cartItem
                                          )
                                        );
                                      }}
                                      productID={item.productID}
                                      serialIndex={serialIndex}
                                      quantity={Math.abs(item.quantity)}
                                      currentSerialNos={serialNos}
                                      onScanUpdate={(newSerialNos) =>
                                        setCart((prev) =>
                                          prev.map((cartItem) =>
                                            cartItem.productID === item.productID
                                              ? { ...cartItem, serialNos: newSerialNos }
                                              : cartItem
                                          )
                                        )
                                      }
                                      placeholder={item.isSerialized ? `سيريال ${serialIndex + 1} (مطلوب)` : `سيريال ${serialIndex + 1} (اختياري)`}
                                      className="flex-1 px-3 py-2 border rounded-lg text-gray-900 font-mono text-sm border-gray-300"
                                      isRequired={item.isSerialized}
                                      dataMobile
                                    />
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => removeFromCart(item.productID)}
                            className="text-red-500 hover:text-red-700 transition-colors flex-shrink-0 p-1"
                            title="حذف"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1 font-cairo">الكمية</label>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updateQuantity(item.productID, item.quantity - 1)}
                                className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                              >
                                <Minus size={14} />
                              </button>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateQuantity(item.productID, parseFloat(e.target.value) || 0)}
                                onFocus={(e) => e.target.select()}
                                className="flex-1 text-center border border-gray-300 rounded-lg py-1.5 text-sm text-gray-900 font-bold"
                              />
                              <button
                                onClick={() => updateQuantity(item.productID, item.quantity + 1)}
                                className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1 font-cairo">سعر الوحدة</label>
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => updatePrice(item.productID, parseFloat(e.target.value) || 0)}
                              onFocus={(e) => e.target.select()}
                              step="0.01"
                              min="0"
                              className="w-full text-center border border-gray-300 rounded-lg py-1.5 text-sm text-gray-900 font-bold"
                              placeholder="السعر"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4 lg:p-5 space-y-3 flex-shrink-0 bg-gradient-to-t from-gray-50 to-white">
              {/* Totals */}
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 border border-gray-200 shadow-sm space-y-3">
                <div className="flex justify-between items-center text-sm font-cairo">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-600">المجموع الفرعي:</span>
                    {cart.length > 0 && (
                      <span className="text-xs text-gray-500 font-cairo">({cart.length} عنصر)</span>
                    )}
                    {/* Notes Button */}
                    <div className="relative">
                      {!notes.trim() ? (
                        <button
                          onClick={() => setShowNotesInput(true)}
                          className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-cairo"
                        >
                          + إضافة ملاحظة
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-cairo max-w-[150px] truncate" title={notes}>
                            {notes}
                          </span>
                          <button
                            onClick={() => {
                              setNotes('');
                              setShowNotesInput(true);
                            }}
                            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                            title="تعديل الملاحظة"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )}
                      {/* Notes Input Popup */}
                      {showNotesInput && (
                        <div className="absolute bottom-full left-0 mb-2 w-64 z-10">
                          <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-3">
                            <textarea
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              onBlur={() => {
                                setTimeout(() => setShowNotesInput(false), 200);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setShowNotesInput(false);
                                }
                              }}
                              placeholder="ملاحظات اختيارية..."
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-sm font-cairo text-gray-900 resize-none"
                              autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <button
                                onClick={() => {
                                  setNotes('');
                                  setShowNotesInput(false);
                                }}
                                className="text-xs px-2 py-1 text-gray-600 hover:text-gray-800 font-cairo"
                              >
                                حذف
                              </button>
                              <button
                                onClick={() => setShowNotesInput(false)}
                                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 font-cairo"
                              >
                                حفظ
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="font-bold text-gray-900">₪{subtotal.toFixed(2)}</span>
                </div>
                
                {/* Discount Input - Inline */}
                <div className="flex justify-between items-center text-sm font-cairo border-t border-gray-200 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">الخصم:</span>
                    {showDiscountInput ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={discount}
                          onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                          onBlur={() => {
                            setTimeout(() => setShowDiscountInput(false), 200);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setShowDiscountInput(false);
                            } else if (e.key === 'Enter') {
                              setShowDiscountInput(false);
                            }
                          }}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-24 px-2 py-1 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm font-bold text-gray-900"
                          autoFocus
                        />
                        <button
                          onClick={() => setShowDiscountInput(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDiscountInput(true)}
                        className={`text-xs px-2 py-0.5 rounded ${
                          discount > 0
                            ? 'text-red-600 bg-red-50 hover:bg-red-100'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        } transition-colors font-cairo`}
                      >
                        {discount > 0 ? `-₪${discount.toFixed(2)}` : '+ إضافة خصم'}
                      </button>
                    )}
                  </div>
                  {discount > 0 && (
                    <span className="font-bold text-red-600">-₪{discount.toFixed(2)}</span>
                  )}
                </div>
                
                <div className="flex justify-between items-center text-lg lg:text-xl font-bold border-t-2 border-gray-300 pt-3 font-cairo">
                  <span className="text-gray-900">الصافي للدفع:</span>
                  <span className="text-green-600">₪{netTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Pay Button */}
              <button
                onClick={handlePayAndPrint}
                disabled={cart.length === 0 || isProcessing}
                className="w-full py-4 lg:py-5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 active:scale-[0.98] transition-all duration-200 font-bold text-base lg:text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-green-600 disabled:hover:to-green-700 flex items-center justify-center gap-3 font-cairo shadow-lg shadow-green-600/20"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>جاري المعالجة...</span>
                  </>
                ) : (
                  <>
                    <Printer size={22} />
                    <span>دفع وطباعة</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Floating Cart Button */}
      {!showCartOnMobile && cart.length > 0 && (
        <button
          onClick={() => setShowCartOnMobile(true)}
          className="md:hidden fixed bottom-4 left-4 z-50 flex items-center justify-center w-16 h-16 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition-colors"
          title="عرض السلة"
        >
          <ShoppingCart size={24} />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
              {cart.length}
            </span>
          )}
        </button>
      )}

      {/* معاينة الطباعة (ديسكتوب) — بدون تاب جديد */}
      {printOverlayInvoiceId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          dir="rtl"
          onClick={() => setPrintOverlayInvoiceId(null)}
        >
          <div
            className="relative bg-white rounded-lg shadow-xl flex flex-col max-w-full max-h-full overflow-hidden"
            style={{ width: '105mm', minHeight: '148mm', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <span className="text-sm font-cairo text-gray-700">معاينة الطباعة</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => printIframeRef.current?.contentWindow?.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-cairo bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Printer size={16} />
                  طباعة مرة أخرى
                </button>
                <button
                  type="button"
                  onClick={() => setPrintOverlayInvoiceId(null)}
                  className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors"
                  aria-label="إغلاق"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-white min-h-0">
              <iframe
                ref={printIframeRef}
                src={`/admin/invoices/print/${printOverlayInvoiceId}?embed=1`}
                title="طباعة الفاتورة"
                className="w-full border-0 bg-white"
                style={{ width: '105mm', minHeight: '148mm', height: '70vh' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Print Component */}
      {invoiceData && (
        <InvoicePrint
          invoiceID={invoiceData.invoiceID}
          dateTime={invoiceData.dateTime}
          items={invoiceData.items}
          subtotal={invoiceData.subtotal}
          discount={invoiceData.discount}
          netTotal={invoiceData.netTotal}
          notes={invoiceData.notes}
        />
      )}
    </AdminLayout>
  );
}

