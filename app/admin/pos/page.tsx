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
  const [barcodeInput, setBarcodeInput] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    brand: '',
    size: '',
    color: '',
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
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
  
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<BrowserMultiFormatReader | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanAreaRef = useRef<HTMLDivElement>(null);
  const lastScannedRef = useRef<string>('');
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Handle barcode input (separate from search)
  const handleBarcodeSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!barcodeInput.trim()) return;

    const scannedValue = barcodeInput.trim();
    
    // Check if scanned value is a URL and extract product ID
    const productIdFromUrl = extractProductIdFromUrl(scannedValue);
    const searchValue = productIdFromUrl || scannedValue;
    
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
      addToCart(product, 'Scan', scannedValue);
      setBarcodeInput(''); // Clear after adding
      barcodeInputRef.current?.focus(); // Keep focus for next scan
    } else {
      // Product not found - could show a message
      console.log('Product not found for barcode/shamel no:', scannedValue);
      alert(`المنتج غير موجود للباركود أو رقم الشامل: ${scannedValue}`);
      setBarcodeInput(''); // Clear anyway
    }
  }, [barcodeInput, products, addToCart, extractProductIdFromUrl]);

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
    // Prevent duplicate scans and processing
    if (barcode === lastScannedRef.current || isScanProcessing) {
      return;
    }

    setIsScanProcessing(true);
    setErrorMessage(null);

    // Check if scanned value is a URL and extract product ID
    const productIdFromUrl = extractProductIdFromUrl(barcode);
    const searchValue = productIdFromUrl || barcode;
    
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
      lastScannedRef.current = barcode;
      
      // Show success feedback
      setScanSuccess(true);
      playSuccessSound();
      
      // Add to cart
      addToCart(product, 'Scan', barcode);
      
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
        setErrorMessage(`المنتج غير موجود: ${barcode}`);
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
    if (newQuantity <= 0) {
      removeFromCart(productID);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.productID === productID) {
          const currentSerialNos = item.serialNos || [];
          let newSerialNos: string[];
          
          if (newQuantity > item.quantity) {
            // Increase quantity - add empty strings
            newSerialNos = [...currentSerialNos, ...Array(newQuantity - item.quantity).fill('')];
          } else {
            // Decrease quantity - keep first N serials
            newSerialNos = currentSerialNos.slice(0, newQuantity);
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

      // Open print in new window - user will click print button manually
      // This prevents browser freezing and allows multiple invoices to be opened
      const printUrl = `/admin/invoices/print/${result.invoiceID}`;
      window.open(printUrl, `print-${result.invoiceID}`, 'noopener,noreferrer');

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
      <div className="h-screen flex flex-col no-print overflow-hidden" dir="rtl" style={{ height: '100vh', maxHeight: '100vh' }}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-3 sm:p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-cairo">نظام نقطة البيع النقدية</h1>
            {/* Mobile Cart Toggle Button */}
            <button
              onClick={() => setShowCartOnMobile(!showCartOnMobile)}
              className="md:hidden relative flex items-center justify-center w-12 h-12 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              title="السلة"
            >
              <ShoppingCart size={20} />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Main Content - Responsive Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Right Side - Catalog */}
          <div className={`${showCartOnMobile ? 'hidden' : 'flex'} md:flex w-full md:w-1/2 md:border-l border-gray-200 flex-col bg-gray-50 min-h-0`}>
            {/* Search and Filters */}
            <div className="p-3 sm:p-4 bg-white border-b border-gray-200 flex-shrink-0">
              {/* Barcode Input Row */}
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                {/* Barcode Input (Separate) */}
                <div className="w-full sm:w-48 relative">
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="مسح الباركود..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleBarcodeSubmit();
                      }
                    }}
                    dir="ltr"
                    lang="en"
                    inputMode="url"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    className="w-full pr-10 pl-10 py-2.5 sm:py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm sm:text-base"
                    autoFocus
                    disabled={isScanning}
                  />
                  {/* Camera Scan Button */}
                  <button
                    type="button"
                    onClick={isScanning ? stopScanning : startScanning}
                    disabled={cameraSupported === false}
                    className={`absolute left-2 top-1/2 transform -translate-y-1/2 p-1.5 sm:p-1 rounded-lg transition-colors ${
                      isScanning
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : cameraSupported === false
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                    title={
                      isScanning 
                        ? 'إيقاف الكاميرا' 
                        : cameraSupported === false
                        ? 'الكاميرا غير مدعومة في هذا المتصفح'
                        : 'فتح الكاميرا لمسح الباركود'
                    }
                  >
                    <Camera size={16} />
                  </button>
                </div>
                
                {/* Search Input (Text only, no barcode) */}
                <div className="flex-1 relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="بحث بالاسم أو رقم الصنف..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pr-10 pl-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 text-sm sm:text-base font-cairo"
                  />
                </div>
              </div>

              {/* Filters - Cascading & Searchable */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
              {isLoadingProducts ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 gap-2 sm:gap-3">
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 gap-2 sm:gap-3">
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
                      className="bg-white rounded-lg border border-gray-200 p-2 sm:p-3 cursor-pointer hover:shadow-md active:scale-95 transition-all font-cairo"
                    >
                      <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={product.Name || product.name}
                            className="w-full h-full object-contain"
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
                      <h3 className="font-semibold text-xs sm:text-sm text-gray-900 mb-1 line-clamp-2 font-cairo">
                        {product.Name || product.name || 'غير معروف'}
                      </h3>
                      <p className="text-xs text-gray-600 mb-1 font-cairo hidden sm:block">
                        {product.Barcode || product.barcode || '—'}
                      </p>
                      {/* Stock Information */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1 text-xs font-cairo">
                        {(product.CS_Shop !== undefined && product.CS_Shop !== null) && (
                          <span className="text-gray-600">
                            المحل: <span className={`font-medium ${
                              (product.CS_Shop || 0) > 0 ? 'text-green-700' : 'text-red-700'
                            }`}>{product.CS_Shop || 0}</span>
                          </span>
                        )}
                        {(product.CS_War !== undefined && product.CS_War !== null) && (
                          <span className="text-gray-600">
                            المخزن: <span className={`font-medium ${
                              (product.CS_War || 0) > 0 ? 'text-green-700' : 'text-red-700'
                            }`}>{product.CS_War || 0}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-blue-600 font-cairo">
                        ₪{parseFloat(product.SalePrice || product.salePrice || 0).toFixed(2)}
                      </p>
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          </div>

          {/* Left Side - Invoice/Cart */}
          <div className={`${showCartOnMobile ? 'flex' : 'hidden'} md:flex w-full md:w-1/2 flex-col bg-white min-h-0`}>
            {/* Header */}
            <div className="p-3 sm:p-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCartOnMobile(false)}
                    className="md:hidden p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="إغلاق السلة"
                  >
                    <X size={20} />
                  </button>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 font-cairo">فاتورة جديدة</h2>
                </div>
                {currentInvoiceID && (
                  <div className="text-xs sm:text-sm text-gray-600 font-cairo">
                    <span className="font-medium">رقم الفاتورة:</span>
                    <span className="mr-2 font-semibold text-gray-900">{currentInvoiceID}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
              {cart.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <ShoppingCart size={48} className="text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 font-cairo">السلة فارغة</p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {cart.map((item) => {
                    // Get product image from products array
                    const product = products.find(p => (p.ProductID || p.id || p.product_id) === item.productID);
                    const imageUrl = product?.Image || product?.image || '';
                    return (
                    <div
                      key={item.productID}
                      className="bg-gray-50 rounded-lg p-2 sm:p-3 border border-gray-200"
                    >
                      {/* Desktop View */}
                      <div className="hidden md:flex items-center justify-between gap-2">
                        {/* Product Image & Name */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={item.name}
                              className="w-10 h-10 object-contain rounded border border-gray-200 flex-shrink-0"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                                if (placeholder) placeholder.style.display = 'flex';
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-gray-400 text-xs">—</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate font-cairo">
                              {item.name} <span className="text-xs text-gray-500">({item.productID})</span>
                            </p>
                          </div>
                        </div>
                        
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQuantity(item.productID, item.quantity - 1)}
                            className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-200 transition-colors"
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.productID, parseFloat(e.target.value) || 0)}
                            className="w-12 text-center border border-gray-300 rounded py-1 text-xs text-gray-900 font-bold"
                          />
                          <button
                            onClick={() => updateQuantity(item.productID, item.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-200 transition-colors"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        
                        {/* Price Input */}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updatePrice(item.productID, parseFloat(e.target.value) || 0)}
                            step="0.01"
                            min="0"
                            className="w-20 text-center border border-gray-300 rounded py-1 text-xs text-gray-900 font-bold"
                            placeholder="السعر"
                          />
                        </div>
                        
                        {/* Serial Numbers */}
                        <div className="min-w-[120px] max-w-[150px]">
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {Array.from({ length: item.quantity }, (_, index) => {
                              const serialNos = item.serialNos || [];
                              while (serialNos.length < item.quantity) {
                                serialNos.push('');
                              }
                              const serialNo = serialNos[index] || '';
                              const isEmpty = !serialNo.trim();
                              const isRequired = item.isSerialized && isEmpty;
                              
                              return (
                                <div key={index} className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={serialNo}
                                    onChange={(e) => {
                                      const newSerialNos = [...(item.serialNos || [])];
                                      while (newSerialNos.length < item.quantity) {
                                        newSerialNos.push('');
                                      }
                                      newSerialNos[index] = e.target.value;
                                      setCart((prev) =>
                                        prev.map((cartItem) =>
                                          cartItem.productID === item.productID
                                            ? { ...cartItem, serialNos: newSerialNos }
                                            : cartItem
                                        )
                                      );
                                    }}
                                    placeholder={item.isSerialized ? `${index + 1} (مطلوب)` : `${index + 1} (اختياري)`}
                                    className={`flex-1 px-1.5 py-0.5 border rounded text-xs text-gray-900 font-bold ${
                                      isRequired
                                        ? 'border-yellow-400 bg-yellow-50'
                                        : 'border-gray-300'
                                    }`}
                                  />
                                  <SerialNumberScanner
                                    onScan={(serialNumber) => {
                                      const newSerialNos = [...(item.serialNos || [])];
                                      while (newSerialNos.length < item.quantity) {
                                        newSerialNos.push('');
                                      }
                                      newSerialNos[index] = serialNumber;
                                      setCart((prev) =>
                                        prev.map((cartItem) =>
                                          cartItem.productID === item.productID
                                            ? { ...cartItem, serialNos: newSerialNos }
                                            : cartItem
                                        )
                                      );
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        {/* Total */}
                        <div className="text-left min-w-[60px]">
                          <p className="text-sm font-bold text-gray-900 font-cairo">₪{item.total.toFixed(2)}</p>
                        </div>
                        
                        {/* Delete Button */}
                        <button
                          onClick={() => removeFromCart(item.productID)}
                          className="text-red-500 hover:text-red-700 transition-colors flex-shrink-0 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
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
                            <p className="text-xs text-gray-500 font-cairo mb-2">#{item.productID}</p>
                            <div className="text-lg font-bold text-gray-900 font-cairo mb-2">
                              ₪{item.total.toFixed(2)}
                            </div>
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
                              step="0.01"
                              min="0"
                              className="w-full text-center border border-gray-300 rounded-lg py-1.5 text-sm text-gray-900 font-bold"
                              placeholder="السعر"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1 font-cairo">
                            الأرقام التسلسلية {item.isSerialized && <span className="text-red-500">*</span>}
                          </label>
                          <div className="space-y-2">
                            {Array.from({ length: item.quantity }, (_, index) => {
                              const serialNos = item.serialNos || [];
                              while (serialNos.length < item.quantity) {
                                serialNos.push('');
                              }
                              const serialNo = serialNos[index] || '';
                              const isEmpty = !serialNo.trim();
                              const isRequired = item.isSerialized && isEmpty;
                              
                              return (
                                <div key={index} className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={serialNo}
                                    onChange={(e) => {
                                      const newSerialNos = [...(item.serialNos || [])];
                                      while (newSerialNos.length < item.quantity) {
                                        newSerialNos.push('');
                                      }
                                      newSerialNos[index] = e.target.value;
                                      setCart((prev) =>
                                        prev.map((cartItem) =>
                                          cartItem.productID === item.productID
                                            ? { ...cartItem, serialNos: newSerialNos }
                                            : cartItem
                                        )
                                      );
                                    }}
                                    placeholder={item.isSerialized ? `سيريال ${index + 1} (مطلوب)` : `سيريال ${index + 1} (اختياري)`}
                                    className={`flex-1 px-3 py-2 border rounded-lg text-sm text-gray-900 font-bold ${
                                      isRequired
                                        ? 'border-yellow-400 bg-yellow-50'
                                        : 'border-gray-300'
                                    }`}
                                  />
                                  <SerialNumberScanner
                                    onScan={(serialNumber) => {
                                      const newSerialNos = [...(item.serialNos || [])];
                                      while (newSerialNos.length < item.quantity) {
                                        newSerialNos.push('');
                                      }
                                      newSerialNos[index] = serialNumber;
                                      setCart((prev) =>
                                        prev.map((cartItem) =>
                                          cartItem.productID === item.productID
                                            ? { ...cartItem, serialNos: newSerialNos }
                                            : cartItem
                                        )
                                      );
                                    }}
                                  />
                                </div>
                              );
                            })}
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
            <div className="border-t border-gray-200 p-3 sm:p-4 space-y-2 sm:space-y-3 flex-shrink-0 bg-white">
              {/* Notes */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 font-cairo">ملاحظات</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات اختيارية..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm font-cairo"
                />
              </div>

              {/* Discount */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 font-cairo">خصم</label>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm font-bold"
                />
              </div>

              {/* Totals */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm font-cairo">
                  <span className="text-gray-600">المجموع:</span>
                  <span className="font-semibold">₪{subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-red-600 font-cairo">
                    <span>الخصم:</span>
                    <span>₪{discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base sm:text-lg font-bold border-t border-gray-300 pt-2 font-cairo">
                  <span>الصافي:</span>
                  <span className="text-green-600">₪{netTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Pay Button */}
              <button
                onClick={handlePayAndPrint}
                disabled={cart.length === 0 || isProcessing}
                className="w-full py-3 sm:py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-cairo"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>جاري المعالجة...</span>
                  </>
                ) : (
                  <>
                    <Printer size={20} />
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

