'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, Search } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerInputProps {
  onProductFound: (product: any) => void;
  products: any[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function BarcodeScannerInput({
  onProductFound,
  products,
  disabled = false,
  placeholder = 'مسح الباركود أو رقم الشامل...',
  className = '',
}: BarcodeScannerInputProps) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanAreaRef = useRef<HTMLDivElement>(null);
  const scannerIdRef = useRef(`scanner-${Math.random().toString(36).substr(2, 9)}`);
  const lastScannedRef = useRef<string>('');
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if browser supports camera
  const isCameraSupported = useCallback(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return false;
    }
    
    try {
      return Html5Qrcode.hasCameraSupport();
    } catch (e) {
      return true; // Fallback: assume support if MediaDevices exists
    }
  }, []);

  // Stop camera scanning
  const stopScanning = useCallback(async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop().catch(() => {});
        await scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
      setIsScanning(false);
    } catch (error) {
      console.error('[BarcodeScanner] Error stopping camera:', error);
      setIsScanning(false);
    }
  }, []);

  // Find product by barcode or Shamel No - same logic as POS
  const findProduct = useCallback((scannedValue: string) => {
    const trimmedValue = scannedValue.trim();
    if (!trimmedValue) return undefined;

    // First, try to find by Barcode
    let product = products.find(
      (p) => {
        const barcode = String(p.Barcode || p.barcode || '').trim();
        return barcode === trimmedValue;
      }
    );

    // If not found, try to find by Shamel No (رقم الشامل) - same as POS
    if (!product) {
      product = products.find(
        (p) => {
          // Try all possible Shamel No fields
          const shamelNo = String(
            p['Shamel No'] || 
            p.shamel_no || 
            p.ShamelNo || 
            p.Shamel_No ||
            p['shamel_no'] ||
            ''
          ).trim();
          return shamelNo === trimmedValue && shamelNo !== '';
        }
      );
    }

    return product;
  }, [products]);

  // Handle barcode scan result
  const handleBarcodeScanned = useCallback((barcode: string) => {
    // Prevent duplicate scans (like supermarket scanners)
    if (barcode === lastScannedRef.current) {
      return;
    }

    const product = findProduct(barcode);

    if (product) {
      lastScannedRef.current = barcode;
      onProductFound(product);
      // Don't stop scanning - keep it running for continuous scanning
      
      // Reset last scanned after a delay to allow rescanning same item
      setTimeout(() => {
        lastScannedRef.current = '';
      }, 2000);
    } else {
      alert(`المنتج غير موجود للباركود أو رقم الشامل: ${barcode}`);
      // Keep scanning even if product not found
    }
  }, [findProduct, onProductFound]);

  // Handle barcode input submit
  const handleBarcodeSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!barcodeInput.trim() || disabled) return;

    const scannedValue = barcodeInput.trim();
    
    // Prevent duplicate scans (like supermarket scanners)
    if (scannedValue === lastScannedRef.current) {
      setBarcodeInput('');
      barcodeInputRef.current?.focus();
      return;
    }

    const product = findProduct(scannedValue);

    if (product) {
      lastScannedRef.current = scannedValue;
      onProductFound(product);
      setBarcodeInput('');
      barcodeInputRef.current?.focus();
      
      // Reset last scanned after a delay to allow rescanning same item
      setTimeout(() => {
        lastScannedRef.current = '';
      }, 2000);
    } else {
      console.log('Product not found for barcode/shamel no:', scannedValue);
      alert(`المنتج غير موجود للباركود أو رقم الشامل: ${scannedValue}`);
      setBarcodeInput('');
      barcodeInputRef.current?.focus();
    }
  }, [barcodeInput, disabled, findProduct, onProductFound]);

  // Auto-submit when barcode is entered (like supermarket scanner)
  const handleBarcodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBarcodeInput(value);

    // Clear existing timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    // Auto-submit if barcode looks complete
    // Typical barcodes are 8+ characters, but we'll auto-submit after a short delay
    // This works with both manual typing and barcode scanners
    if (value.trim().length >= 3) {
      scanTimeoutRef.current = setTimeout(() => {
        const currentValue = barcodeInputRef.current?.value.trim();
        if (currentValue && currentValue === value.trim()) {
          // Simulate form submit
          const fakeEvent = new Event('submit', { bubbles: true, cancelable: true });
          handleBarcodeSubmit(fakeEvent as any);
        }
      }, 300); // Delay to allow complete barcode entry from scanner
    }
  }, [handleBarcodeSubmit]);

  // Start camera scanning
  const startScanning = useCallback(async () => {
    try {
      if (!isCameraSupported()) {
        throw new Error('المتصفح لا يدعم الوصول إلى الكاميرا. يرجى استخدام متصفح حديث مثل Chrome أو Safari.');
      }

      setIsScanning(true);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const element = document.getElementById(scannerIdRef.current);
      if (!element) {
        throw new Error('عنصر الماسح غير موجود في الصفحة');
      }

      if (scannerRef.current) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
        scannerRef.current = null;
      }

      const html5QrCode = new Html5Qrcode(scannerIdRef.current);
      scannerRef.current = html5QrCode;

      let cameraId: string | undefined;
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const backCamera = cameras.find(cam => {
            const label = cam.label.toLowerCase();
            return label.includes('back') || 
                   label.includes('rear') ||
                   label.includes('environment');
          });
          
          if (!backCamera) {
            const frontCamera = cameras.find(cam => {
              const label = cam.label.toLowerCase();
              return label.includes('front') || 
                     label.includes('user');
            });
            
            const nonFrontCamera = cameras.find(cam => cam.id !== frontCamera?.id);
            cameraId = nonFrontCamera?.id || cameras[cameras.length - 1].id;
          } else {
            cameraId = backCamera.id;
          }
        }
      } catch (camError) {
        console.log('[BarcodeScanner] Could not get cameras list, using facingMode:', camError);
      }

      const config = {
        fps: 10,
        qrbox: function(viewfinderWidth: number, viewfinderHeight: number) {
          const minEdgePercentage = 0.8;
          const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
          return {
            width: qrboxSize,
            height: qrboxSize
          };
        },
        aspectRatio: 1.0,
        disableFlip: false,
      };

      const cameraConfig = cameraId 
        ? { deviceId: { exact: cameraId } }
        : { facingMode: 'environment' };

      const onScanSuccess = (decodedText: string) => {
        handleBarcodeScanned(decodedText);
      };

      const onScanError = (errorMessage: string) => {
        if (!errorMessage.includes('NotFoundException') && 
            !errorMessage.includes('No MultiFormat Readers')) {
          console.debug('[BarcodeScanner] Scan error:', errorMessage);
        }
      };

      try {
        if (cameraId) {
          try {
            await html5QrCode.start(
              { deviceId: { exact: cameraId } },
              config,
              onScanSuccess,
              onScanError
            );
            return;
          } catch (exactError: any) {
            try {
              await html5QrCode.start(
                { deviceId: cameraId },
                config,
                onScanSuccess,
                onScanError
              );
              return;
            } catch (deviceError: any) {
              // Fall through to facingMode
            }
          }
        }

        try {
          await html5QrCode.start(
            { facingMode: 'environment' },
            config,
            onScanSuccess,
            onScanError
          );
        } catch (envError: any) {
          await html5QrCode.start(
            { facingMode: 'user' },
            config,
            onScanSuccess,
            onScanError
          );
        }
      } catch (finalError: any) {
        throw finalError;
      }
    } catch (error: any) {
      console.error('[BarcodeScanner] Error starting camera:', error);
      setIsScanning(false);
      
      let errorMsg = 'فشل فتح الكاميرا';
      const errorStr = String(error?.message || '').toLowerCase();
      
      if (errorStr.includes('streaming not supported') || errorStr.includes('not supported by the browser')) {
        errorMsg = 'المتصفح لا يدعم بث الكاميرا. يرجى:\n1. استخدام متصفح حديث (Chrome، Safari، Firefox)\n2. التأكد من أن الموقع يعمل على HTTPS\n3. تحديث المتصفح إلى آخر إصدار';
      } else if (errorStr.includes('permission') || errorStr.includes('notallowed')) {
        errorMsg = 'يرجى السماح بالوصول إلى الكاميرا في إعدادات المتصفح.';
      } else if (errorStr.includes('not found') || errorStr.includes('notfound')) {
        errorMsg = 'الكاميرا غير متوفرة.';
      } else if (errorStr.includes('https') || errorStr.includes('secure context')) {
        errorMsg = 'الكاميرا تتطلب اتصال آمن (HTTPS).';
      } else if (error?.message) {
        errorMsg = `فشل فتح الكاميرا: ${error.message}`;
      }
      
      alert(errorMsg);
      
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          await scannerRef.current.clear();
        } catch (e) {}
        scannerRef.current = null;
      }
    }
  }, [isCameraSupported, handleBarcodeScanned]);

  // Auto-focus input on mount and cleanup
  useEffect(() => {
    // Auto-focus the barcode input for quick scanning
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 100);

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={`relative ${className}`} dir="rtl">
      <div className="relative">
        <input
          ref={barcodeInputRef}
          type="text"
          placeholder={placeholder}
          value={barcodeInput}
          onChange={handleBarcodeChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleBarcodeSubmit(e);
            }
          }}
          className={`w-full pr-12 pl-3 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          disabled={disabled || isScanning}
          id={`barcode-input-${Math.random().toString(36).substr(2, 9)}`}
        />
        <button
          type="button"
          onClick={isScanning ? stopScanning : startScanning}
          disabled={disabled || (typeof window !== 'undefined' && !navigator.mediaDevices)}
          className={`absolute left-2 top-1/2 transform -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
            isScanning
              ? 'bg-red-500 text-white hover:bg-red-600'
              : typeof window !== 'undefined' && !navigator.mediaDevices
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={isScanning ? 'إيقاف الكاميرا' : 'فتح الكاميرا لمسح الباركود'}
        >
          <Camera size={16} />
        </button>
      </div>

      {/* Camera Scanner View */}
      {isScanning && (
        <div className="mt-4 p-4 bg-black border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white text-sm font-medium mb-1">امسح الباركود بالكاميرا</p>
              <p className="text-gray-400 text-xs">وجه الكاميرا نحو الباركود</p>
            </div>
            <button
              onClick={stopScanning}
              className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm flex items-center gap-1"
            >
              <X size={16} />
              إغلاق
            </button>
          </div>
          <div className="w-full flex items-center justify-center">
            <div
              id={scannerIdRef.current}
              ref={scanAreaRef}
              className="w-full max-w-md mx-auto bg-gray-900 rounded-lg overflow-hidden"
              style={{ 
                minHeight: '300px', 
                maxHeight: '500px',
                width: '100%',
                position: 'relative'
              }}
            />
          </div>
          <p className="text-gray-400 text-xs text-center mt-2">
            يمكنك أيضاً استخدام الماسح الضوئي المتصل بالحاسوب
          </p>
        </div>
      )}
    </div>
  );
}
