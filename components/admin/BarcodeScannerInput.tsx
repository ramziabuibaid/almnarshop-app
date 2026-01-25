'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, Search, RotateCcw } from 'lucide-react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

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
  const [cameraSupported, setCameraSupported] = useState<boolean | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<{deviceId: string; label: string}[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | undefined>(undefined);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<BrowserMultiFormatReader | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanAreaRef = useRef<HTMLDivElement>(null);
  const scannerIdRef = useRef(`scanner-${Math.random().toString(36).substr(2, 9)}`);
  const lastScannedRef = useRef<string>('');
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scanningIntervalRef = useRef<number | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const successSoundRef = useRef<HTMLAudioElement | null>(null);

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

  // Stop camera scanning
  const stopScanning = useCallback(async () => {
    try {
      // Clear error timeout
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }

      // Stop scanning interval
      if (scanningIntervalRef.current !== null) {
        clearInterval(scanningIntervalRef.current);
        scanningIntervalRef.current = null;
      }

      // Stop scanner
      if (scannerRef.current) {
        try {
          scannerRef.current.reset();
        } catch (stopError) {
          console.debug('[BarcodeScanner] Error resetting scanner:', stopError);
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
      setIsProcessing(false);
    } catch (error) {
      console.error('[BarcodeScanner] Error stopping camera:', error);
      setIsScanning(false);
      setScanSuccess(false);
      setErrorMessage(null);
      setIsProcessing(false);
      scannerRef.current = null;
    }
  }, []);

  // Extract product ID from scanned value (supports URL as well)
  const extractProductIdFromScannedValue = useCallback((scannedValue: string): string | null => {
    const trimmedValue = scannedValue.trim();
    if (!trimmedValue) return null;

    // If looks like URL, try to extract after /product/
    if (trimmedValue.includes('http') || trimmedValue.includes('/product/')) {
      const match = trimmedValue.match(/\/product\/([^/?#]+)/);
      if (match && match[1]) return match[1];
    }

    return null;
  }, []);

  // Find product by ProductID, Barcode, or Shamel No - same logic as POS
  const findProduct = useCallback((scannedValue: string) => {
    const trimmedValue = scannedValue.trim();
    if (!trimmedValue) return undefined;

    // Try to extract product ID from URL if present
    const productIdFromUrl = extractProductIdFromScannedValue(trimmedValue);
    const searchValue = productIdFromUrl || trimmedValue;

    // 1) Try ProductID (if extracted)
    let product = productIdFromUrl
      ? products.find(
          (p) => String(p.ProductID || p.id || '').trim() === productIdFromUrl
        )
      : undefined;

    // 2) Try Barcode
    if (!product) {
      product = products.find((p) => {
        const barcode = String(p.Barcode || p.barcode || '').trim();
        return barcode === searchValue && barcode !== '';
      });
    }

    // 3) Try Shamel No (رقم الشامل)
    if (!product) {
      product = products.find((p) => {
        const shamelNo = String(
          p['Shamel No'] ||
            p.shamel_no ||
            p.ShamelNo ||
            p.Shamel_No ||
            p['shamel_no'] ||
            ''
        ).trim();
        return shamelNo === searchValue && shamelNo !== '';
      });
    }

    return product;
  }, [products, extractProductIdFromScannedValue]);

  // Play success sound
  const playSuccessSound = useCallback(() => {
    try {
      // Create audio context for beep sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800; // Higher pitch for success
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
      
      oscillator.frequency.value = 400; // Lower pitch for error
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
      console.debug('Could not play sound:', e);
    }
  }, []);

  // Handle barcode scan result
  const handleBarcodeScanned = useCallback((barcode: string) => {
    // Prevent duplicate scans and processing
    if (barcode === lastScannedRef.current || isProcessing) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const product = findProduct(barcode);

    if (product) {
      lastScannedRef.current = barcode;
      
      // Show success feedback
      setScanSuccess(true);
      playSuccessSound();
      
      // Call the callback
      onProductFound(product);
      
      // Close camera after short delay to show success feedback
      setTimeout(() => {
        stopScanning();
        setScanSuccess(false);
        setIsProcessing(false);
        
        // Reset last scanned after a delay to allow rescanning same item
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
          setIsProcessing(false);
        }, 3000);
      }
    }
  }, [findProduct, onProductFound, isProcessing, errorMessage, playSuccessSound, playErrorSound, stopScanning]);

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

      // Stop any existing scanner
      if (scannerRef.current) {
        try {
          scannerRef.current.reset();
        } catch (stopError) {
          console.debug('[BarcodeScanner] Error resetting existing scanner:', stopError);
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
        }
      } catch (camError) {
        console.log('[BarcodeScanner] Could not get cameras list:', camError);
      }

      // Get video element
      const videoElement = document.getElementById(scannerIdRef.current) as HTMLVideoElement;
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
              console.debug('[BarcodeScanner] Scan error:', error);
            }
          }
        );
      };

      try {
        await startDecoding(deviceId || currentCameraId);
      } catch (startError: any) {
        // If deviceId failed, try without specifying device
        if (deviceId || currentCameraId) {
          try {
            await startDecoding(undefined);
          } catch (fallbackError: any) {
            throw fallbackError;
          }
        } else {
          throw startError;
        }
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
      } else if (errorStr.includes('notreadable') || errorStr.includes('not readable')) {
        errorMsg = 'الكاميرا مستخدمة من قبل تطبيق آخر. يرجى إغلاق التطبيقات الأخرى التي تستخدم الكاميرا.';
      } else if (errorStr.includes('https') || errorStr.includes('secure context')) {
        errorMsg = 'الكاميرا تتطلب اتصال آمن (HTTPS).';
      } else if (error?.message) {
        errorMsg = `فشل فتح الكاميرا: ${error.message}`;
      }
      
      alert(errorMsg);
      
      // Cleanup on error
      if (scannerRef.current) {
        try {
          scannerRef.current.reset();
        } catch (resetError) {
          console.debug('[BarcodeScanner] Error resetting scanner in error handler:', resetError);
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
  }, [isCameraSupported, handleBarcodeScanned, currentCameraId]);

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
      const videoElement = document.getElementById(scannerIdRef.current) as HTMLVideoElement;
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
            console.debug('[BarcodeScanner] Scan error:', error);
          }
        }
      );
    } catch (error) {
      console.error('[BarcodeScanner] Error switching camera:', error);
    }
  }, [availableCameras, currentCameraId, handleBarcodeScanned]);

  // Auto-focus input on mount and cleanup
  useEffect(() => {
    // Auto-focus the barcode input for quick scanning
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 100);

    return () => {
      // Stop scanning interval
      if (scanningIntervalRef.current !== null) {
        clearInterval(scanningIntervalRef.current);
        scanningIntervalRef.current = null;
      }

      // Stop scanner
      if (scannerRef.current) {
        try {
          scannerRef.current.reset();
        } catch (e) {
          // Ignore cleanup errors
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

      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }

      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
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
          dir="ltr"
          lang="en"
          inputMode="url"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          id={`barcode-input-${Math.random().toString(36).substr(2, 9)}`}
        />
        <button
          type="button"
          onClick={isScanning ? stopScanning : startScanning}
          disabled={disabled || cameraSupported === false}
          className={`absolute left-2 top-1/2 transform -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
            isScanning
              ? 'bg-red-500 text-white hover:bg-red-600'
              : cameraSupported === false
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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

      {/* Fullscreen Camera Scanner Overlay */}
      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-lg font-bold mb-1">امسح الباركود</p>
                <p className="text-gray-300 text-sm">وجه الكاميرا نحو الباركود</p>
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
              id={scannerIdRef.current}
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
                {!scanSuccess && !isProcessing && (
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
                  <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in whitespace-nowrap">
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
            <p className="text-white text-center text-sm">
              {isProcessing ? 'جاري المعالجة...' : 'ضع الباركود داخل الإطار'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
