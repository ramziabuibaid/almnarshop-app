'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, RotateCcw } from 'lucide-react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

interface SerialNumberScannerProps {
  onScan: (serialNumber: string) => void;
  disabled?: boolean;
}

export default function SerialNumberScanner({
  onScan,
  disabled = false,
}: SerialNumberScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraSupported, setCameraSupported] = useState<boolean | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<{deviceId: string; label: string}[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | undefined>(undefined);
  const scannerRef = useRef<BrowserMultiFormatReader | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanAreaRef = useRef<HTMLDivElement>(null);
  const scannerIdRef = useRef(`serial-scanner-${Math.random().toString(36).substr(2, 9)}`);
  const lastScannedRef = useRef<string>('');
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if browser supports camera
  const isCameraSupported = useCallback(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const getUserMedia = navigator.getUserMedia || 
                          (navigator as any).webkitGetUserMedia || 
                          (navigator as any).mozGetUserMedia || 
                          (navigator as any).msGetUserMedia;
      return !!getUserMedia;
    }
    
    return true;
  }, []);

  // Check camera support on mount
  useEffect(() => {
    const checkCameraSupport = async () => {
      if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        setCameraSupported(false);
        return;
      }

      const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      const hasLegacyGetUserMedia = !!(navigator.getUserMedia || 
                                       (navigator as any).webkitGetUserMedia || 
                                       (navigator as any).mozGetUserMedia || 
                                       (navigator as any).msGetUserMedia);

      if (hasMediaDevices || hasLegacyGetUserMedia) {
        try {
          if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasVideoInput = devices.some(device => device.kind === 'videoinput');
            setCameraSupported(hasVideoInput);
          } else {
            setCameraSupported(true);
          }
        } catch (e) {
          setCameraSupported(true);
        }
      } else {
        setCameraSupported(false);
      }
    };

    checkCameraSupport();
    const timeout = setTimeout(checkCameraSupport, 500);
    
    return () => clearTimeout(timeout);
  }, []);

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

  // Stop camera scanning
  const stopScanning = useCallback(async () => {
    try {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }

      if (scannerRef.current) {
        try {
          scannerRef.current.reset();
        } catch (stopError) {
          console.debug('[SerialScanner] Error resetting scanner:', stopError);
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

      setIsScanning(false);
      setScanSuccess(false);
      setErrorMessage(null);
      setIsProcessing(false);
    } catch (error) {
      console.error('[SerialScanner] Error stopping camera:', error);
      setIsScanning(false);
      setScanSuccess(false);
      setErrorMessage(null);
      setIsProcessing(false);
      scannerRef.current = null;
    }
  }, []);

  // Handle barcode scan result
  const handleBarcodeScanned = useCallback((barcode: string) => {
    const trimmedBarcode = barcode.trim();
    if (!trimmedBarcode || trimmedBarcode === lastScannedRef.current || isProcessing) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    lastScannedRef.current = trimmedBarcode;
    
    // Show success feedback
    setScanSuccess(true);
    playSuccessSound();
    
    // Call the callback
    onScan(trimmedBarcode);
    
    // Close camera after short delay
    setTimeout(() => {
      stopScanning();
      setScanSuccess(false);
      setIsProcessing(false);
      
      // Reset last scanned after a delay
      setTimeout(() => {
        lastScannedRef.current = '';
      }, 2000);
    }, 1500);
  }, [onScan, isProcessing, playSuccessSound, stopScanning]);

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
          console.debug('[SerialScanner] Error resetting existing scanner:', stopError);
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
        console.log('[SerialScanner] Could not get cameras list:', camError);
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
              console.debug('[SerialScanner] Scan error:', error);
            }
          }
        );
      };

      try {
        await startDecoding(deviceId || currentCameraId);
      } catch (startError: any) {
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
      console.error('[SerialScanner] Error starting camera:', error);
      setIsScanning(false);
      
      let errorMsg = 'فشل فتح الكاميرا';
      const errorStr = String(error?.message || '').toLowerCase();
      
      if (errorStr.includes('streaming not supported') || errorStr.includes('not supported by the browser')) {
        errorMsg = 'المتصفح لا يدعم بث الكاميرا. يرجى استخدام متصفح حديث (Chrome، Safari، Firefox)';
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
          console.debug('[SerialScanner] Error resetting scanner in error handler:', resetError);
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
      scannerRef.current.reset();

      if (videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }

      const currentIndex = availableCameras.findIndex(cam => cam.deviceId === currentCameraId);
      const nextIndex = (currentIndex + 1) % availableCameras.length;
      const nextCamera = availableCameras[nextIndex];

      setCurrentCameraId(nextCamera.deviceId);

      const videoElement = document.getElementById(scannerIdRef.current) as HTMLVideoElement;
      if (!videoElement) return;

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
            console.debug('[SerialScanner] Scan error:', error);
          }
        }
      );
    } catch (error) {
      console.error('[SerialScanner] Error switching camera:', error);
    }
  }, [availableCameras, currentCameraId, handleBarcodeScanned]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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

      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={isScanning ? stopScanning : startScanning}
        disabled={disabled || cameraSupported === false}
        className={`p-1.5 rounded transition-colors flex-shrink-0 ${
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
            ? 'الكاميرا غير مدعومة'
            : 'مسح السيريال بالكاميرا'
        }
        aria-label="مسح السيريال بالكاميرا"
      >
        <Camera size={14} className="block" />
      </button>

      {/* Fullscreen Camera Scanner Overlay */}
      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-lg font-bold mb-1">امسح السيريال</p>
                <p className="text-gray-300 text-sm">وجه الكاميرا نحو الباركود</p>
              </div>
              <div className="flex items-center gap-2">
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
              <div className="relative w-80 h-80 max-w-[85vw] max-h-[85vw]">
                <div className="absolute inset-0 border-4 border-white/80 rounded-lg">
                  <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-green-400 rounded-tl-lg"></div>
                  <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-green-400 rounded-tr-lg"></div>
                  <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-green-400 rounded-bl-lg"></div>
                  <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-green-400 rounded-br-lg"></div>
                </div>

                {!scanSuccess && !isProcessing && (
                  <div className="absolute inset-0 overflow-hidden rounded-lg">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-green-400 shadow-lg shadow-green-400/50 animate-scan-line"></div>
                  </div>
                )}

                {scanSuccess && (
                  <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 rounded-lg animate-fade-in">
                    <div className="bg-green-500 rounded-full p-4 shadow-2xl shadow-green-500/50">
                      <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}

                {errorMessage && (
                  <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in whitespace-nowrap">
                    {errorMessage}
                  </div>
                )}
              </div>

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
    </>
  );
}
