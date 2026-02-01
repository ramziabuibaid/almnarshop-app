'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Save, Loader2, Camera } from 'lucide-react';
import { Product } from '@/types';
import { saveProduct } from '@/lib/api';
import ImageUploadField from './ImageUploadField';
import ScannerLatinInput from './ScannerLatinInput';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { Html5Qrcode } from 'html5-qrcode';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  onSuccess: () => void;
  onSaving?: () => void; // Callback when saving starts
}

export default function ProductFormModal({
  isOpen,
  onClose,
  product,
  onSuccess,
  onSaving,
}: ProductFormModalProps) {
  const { admin } = useAdminAuth();
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Barcode scanner state
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerIdRef = useRef(`barcode-scanner-${Math.random().toString(36).substr(2, 9)}`);
  
  // Check if user can view cost
  const canViewCost = admin?.is_super_admin || admin?.permissions?.viewCost === true;

  // Initialize form data when modal opens or product changes
  useEffect(() => {
    if (isOpen) {
      if (product) {
        // Edit mode - pre-fill with product data
        setFormData({
          ProductID: product.ProductID || product.id || '',
          'Shamel No': product['Shamel No'] || '',
          Barcode: product.Barcode || product.barcode || '',
          Name: product.Name || product.name || '',
          Type: product.Type || product.type || '',
          Brand: product.Brand || product.brand || '',
          Origin: product.Origin || '',
          Warranty: product.Warranty || '',
          Size: product.Size || product.size || '',
          Color: product.Color || product.color || '',
          Dimention: product.Dimention || '',
          CS_War: product.CS_War || 0,
          CS_Shop: product.CS_Shop || 0,
          CostPrice: product.CostPrice || product.costPrice || 0,
          SalePrice: product.SalePrice || product.price || product.salePrice || 0,
          T1Price: product.T1Price || 0,
          T2Price: product.T2Price || 0,
          // Use Image field (filePath) for saving - this is what gets saved to Google Sheets
          // We'll use product.image (URL) for preview in ImageUploadField
          Image: product.Image || product.image || '',
          'Image 2': product['Image 2'] || product.image2 || '',
          'image 3': product['image 3'] || product.image3 || '',
          is_serialized: product.is_serialized || product.IsSerialized || false,
          is_visible: product.is_visible !== false && product.isVisible !== false,
        });
      } else {
        // Add mode - empty form
        setFormData({
          ProductID: '',
          'Shamel No': '',
          Barcode: '',
          Name: '',
          Type: '',
          Brand: '',
          Origin: '',
          Warranty: '',
          Size: '',
          Color: '',
          Dimention: '',
          CS_War: 0,
          CS_Shop: 0,
          CostPrice: 0,
          SalePrice: 0,
          T1Price: 0,
          T2Price: 0,
          Image: '',
          'Image 2': '',
          'image 3': '',
          is_serialized: false,
          is_visible: true,
        });
      }
      setError('');
    }
    
    // Cleanup scanner when modal closes
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
      setIsScanningBarcode(false);
    };
  }, [isOpen, product]);

  // Stop barcode scanning
  const stopBarcodeScanning = useCallback(async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop().catch(() => {});
        await scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
      setIsScanningBarcode(false);
    } catch (error) {
      console.error('[ProductFormModal] Error stopping barcode scanner:', error);
      setIsScanningBarcode(false);
    }
  }, []);

  // Start barcode scanning
  const startBarcodeScanning = useCallback(async () => {
    try {
      if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('المتصفح لا يدعم الوصول إلى الكاميرا. يرجى استخدام متصفح حديث مثل Chrome أو Safari.');
        return;
      }

      setIsScanningBarcode(true);
      
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
        console.log('[ProductFormModal] Could not get cameras list, using facingMode:', camError);
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

      const onScanSuccess = (decodedText: string) => {
        // Set the scanned barcode value
        handleChange('Barcode', decodedText);
        // Stop scanning after successful scan
        stopBarcodeScanning();
      };

      const onScanError = (errorMessage: string) => {
        if (!errorMessage.includes('NotFoundException') && 
            !errorMessage.includes('No MultiFormat Readers')) {
          console.debug('[ProductFormModal] Barcode scan error:', errorMessage);
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
      console.error('[ProductFormModal] Error starting barcode scanner:', error);
      setIsScanningBarcode(false);
      
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
  }, [stopBarcodeScanning]);

  const handleChange = (field: keyof Product, value: string | number | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle image upload completion
  const handleImageUpload = (field: 'Image' | 'Image 2' | 'image 3', fileUrl: string) => {
    console.log('[ProductFormModal] Image upload complete:', { field, fileUrl });
    
    // Explicitly update formData with the new public URL
    setFormData((prev) => {
      const updated = {
        ...prev,
        [field]: fileUrl, // Ensure exact key match (case-sensitive)
      };
      console.log('[ProductFormModal] Updated formData:', updated);
      console.log('[ProductFormModal] Specific field updated:', {
        field,
        oldValue: prev[field],
        newValue: fileUrl,
        updatedValue: updated[field],
      });
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    // Notify parent that saving has started
    if (onSaving) {
      onSaving();
    }

    try {
      // Validate required fields
      if (!formData.Name && !formData.ProductID) {
        setError('Name or ProductID is required');
        setIsSubmitting(false);
        return;
      }

      // Prepare product data for API
      const productData: any = {
        ProductID: formData.ProductID || undefined,
        // Explicitly handle empty strings for Shamel No to allow clearing the field
        'Shamel No': formData['Shamel No'] !== undefined ? (formData['Shamel No'] || '') : undefined,
        Barcode: formData.Barcode || undefined,
        Name: formData.Name || undefined,
        Type: formData.Type || undefined,
        Brand: formData.Brand || undefined,
        Origin: formData.Origin || undefined,
        Warranty: formData.Warranty || undefined,
        Size: formData.Size || undefined,
        Color: formData.Color || undefined,
        Dimention: formData.Dimention || undefined,
        // Allow negative values for stock (CS_War and CS_Shop)
        CS_War: formData.CS_War !== undefined && formData.CS_War !== null ? formData.CS_War : 0,
        CS_Shop: formData.CS_Shop !== undefined && formData.CS_Shop !== null ? formData.CS_Shop : 0,
        CostPrice: formData.CostPrice || 0,
        SalePrice: formData.SalePrice || 0,
        T1Price: formData.T1Price || 0,
        T2Price: formData.T2Price || 0,
        // Image fields - explicitly include empty strings to allow deletion
        // If field exists in formData (even if empty), include it to allow clearing the image
        Image: formData.Image !== undefined ? (formData.Image || '') : undefined,
        'Image 2': formData['Image 2'] !== undefined ? (formData['Image 2'] || '') : undefined,
        'image 3': formData['image 3'] !== undefined ? (formData['image 3'] || '') : undefined,
        // Serial number support
        is_serialized: formData.is_serialized || false,
        // Store visibility
        is_visible: formData.is_visible !== false,
      };

      // Remove undefined values, but keep empty strings for image fields and Shamel No to allow deletion
      Object.keys(productData).forEach((key) => {
        // Keep empty strings for image fields and Shamel No to allow clearing
        const isImageField = key === 'Image' || key === 'Image 2' || key === 'image 3';
        const isShamelNo = key === 'Shamel No';
        if (!isImageField && !isShamelNo && (productData[key] === undefined || productData[key] === '')) {
          delete productData[key];
        } else if (productData[key] === undefined) {
          delete productData[key];
        }
      });

      // Debug: Log image paths before submission
      console.log('[ProductFormModal] Image paths in formData:', {
        Image: formData.Image,
        'Image 2': formData['Image 2'],
        'image 3': formData['image 3'],
      });
      console.log('[ProductFormModal] Image paths in payload:', {
        Image: productData.Image,
        'Image 2': productData['Image 2'],
        'image 3': productData['image 3'],
      });
      
      // CRITICAL: Log the complete formData and productData before submission
      console.log('[ProductFormModal] Submitting - Full formData:', formData);
      console.log('[ProductFormModal] Submitting - Full productData:', productData);
      
      // Add userName for notifications
      if (admin?.username) {
        productData.userName = admin.username;
      }
      
      await saveProduct(productData);
      
      // Success - close modal and refresh
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[ProductFormModal] Error saving product:', err);
      setError(err?.message || 'Failed to save product. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              {product ? 'Edit Product' : 'Add New Product'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={24} className="text-gray-600" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-6">
              {/* Identifiers Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Identifiers</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product ID *
                    </label>
                    <input
                      type="text"
                      value={formData.ProductID || ''}
                      onChange={(e) => handleChange('ProductID', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Shamel No
                    </label>
                    <input
                      type="text"
                      value={formData['Shamel No'] || ''}
                      onChange={(e) => handleChange('Shamel No', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Barcode
                    </label>
                    <div className="relative">
                      <ScannerLatinInput
                        type="text"
                        value={formData.Barcode || ''}
                        onChange={(e) => handleChange('Barcode', e.target.value)}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                        placeholder="أدخل الباركود أو اضغط على أيقونة الكاميرا"
                      />
                      <button
                        type="button"
                        onClick={isScanningBarcode ? stopBarcodeScanning : startBarcodeScanning}
                        disabled={typeof window !== 'undefined' && !navigator.mediaDevices}
                        className={`absolute left-2 top-1/2 transform -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
                          isScanningBarcode
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : typeof window !== 'undefined' && !navigator.mediaDevices
                            ? 'bg-gray-400 text-white cursor-not-allowed'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                        title={isScanningBarcode ? 'إيقاف الكاميرا' : 'فتح الكاميرا لمسح الباركود'}
                      >
                        <Camera size={16} />
                      </button>
                    </div>
                    
                    {/* Camera Scanner View */}
                    {isScanningBarcode && (
                      <div className="mt-4 p-4 bg-black border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-white text-sm font-medium mb-1">امسح الباركود بالكاميرا</p>
                            <p className="text-gray-400 text-xs">وجه الكاميرا نحو الباركود</p>
                          </div>
                          <button
                            type="button"
                            onClick={stopBarcodeScanning}
                            className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm flex items-center gap-1"
                          >
                            <X size={16} />
                            إغلاق
                          </button>
                        </div>
                        <div className="w-full flex items-center justify-center">
                          <div
                            id={scannerIdRef.current}
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
                </div>
              </div>

              {/* Basic Info Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formData.Name || ''}
                      onChange={(e) => handleChange('Name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <input
                      type="text"
                      value={formData.Type || ''}
                      onChange={(e) => handleChange('Type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Brand
                    </label>
                    <input
                      type="text"
                      value={formData.Brand || ''}
                      onChange={(e) => handleChange('Brand', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Origin
                    </label>
                    <input
                      type="text"
                      value={formData.Origin || ''}
                      onChange={(e) => handleChange('Origin', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Warranty
                    </label>
                    <input
                      type="text"
                      value={formData.Warranty || ''}
                      onChange={(e) => handleChange('Warranty', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                    />
                  </div>
                </div>
                
                {/* Serial Number Checkbox - More prominent */}
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_serialized"
                      checked={formData.is_serialized || false}
                      onChange={(e) => handleChange('is_serialized', e.target.checked)}
                      className="w-5 h-5 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                    />
                    <label htmlFor="is_serialized" className="mr-3 text-sm font-semibold text-gray-900 cursor-pointer">
                      المنتج له رقم تسلسلي (Serial Number)
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-gray-600 mr-8">
                    عند تفعيل هذا الخيار، سيتم طلب إدخال رقم تسلسلي لكل قطعة عند إضافة المنتج إلى الفواتير
                  </p>
                </div>

                {/* Store Visibility - Show/Hide in online store */}
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_visible"
                      checked={formData.is_visible !== false}
                      onChange={(e) => handleChange('is_visible', e.target.checked)}
                      className="w-5 h-5 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                    />
                    <label htmlFor="is_visible" className="mr-3 text-sm font-semibold text-gray-900 cursor-pointer">
                      إظهار المنتج في المتجر الإلكتروني
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-gray-600 mr-8">
                    عند إلغاء التفعيل، سيتم إخفاء المنتج من المتجر الإلكتروني (الصفحة الرئيسية والبحث) ولكن يبقى ظاهراً في لوحة التحكم والفواتير
                  </p>
                </div>
              </div>

              {/* Specs Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Specifications</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Size
                    </label>
                    <input
                      type="text"
                      value={formData.Size || ''}
                      onChange={(e) => handleChange('Size', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Color
                    </label>
                    <input
                      type="text"
                      value={formData.Color || ''}
                      onChange={(e) => handleChange('Color', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dimension
                    </label>
                    <input
                      type="text"
                      value={formData.Dimention || ''}
                      onChange={(e) => handleChange('Dimention', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                    />
                  </div>
                </div>
              </div>

              {/* Stock & Pricing Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock & Pricing</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Stock */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Stock</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Warehouse (CS_War)
                        </label>
                        <input
                          type="number"
                          value={formData.CS_War !== undefined && formData.CS_War !== null ? formData.CS_War : ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            handleChange('CS_War', isNaN(value) ? 0 : value);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Shop (CS_Shop)
                        </label>
                        <input
                          type="number"
                          value={formData.CS_Shop !== undefined && formData.CS_Shop !== null ? formData.CS_Shop : ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            handleChange('CS_Shop', isNaN(value) ? 0 : value);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Pricing (₪)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {canViewCost && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Cost Price
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.CostPrice || 0}
                            onChange={(e) => handleChange('CostPrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Sale Price *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.SalePrice || 0}
                          onChange={(e) => handleChange('SalePrice', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          T1 Price
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.T1Price || 0}
                          onChange={(e) => handleChange('T1Price', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          T2 Price
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.T2Price || 0}
                          onChange={(e) => handleChange('T2Price', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Images Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Images</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ImageUploadField
                    label="Image 1"
                    currentValue={formData.Image || ''}
                    previewUrl={product?.image || product?.ImageUrl || undefined}
                    onUploadComplete={(filePath) => handleImageUpload('Image', filePath)}
                  />
                  <ImageUploadField
                    label="Image 2"
                    currentValue={formData['Image 2'] || ''}
                    previewUrl={product?.image2 || product?.ImageUrl2 || undefined}
                    onUploadComplete={(filePath) => handleImageUpload('Image 2', filePath)}
                  />
                  <ImageUploadField
                    label="Image 3"
                    currentValue={formData['image 3'] || ''}
                    previewUrl={product?.image3 || product?.ImageUrl3 || undefined}
                    onUploadComplete={(filePath) => handleImageUpload('image 3', filePath)}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Note: New images may take a few minutes to appear on the storefront unless Cache is refreshed.
                </p>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save Product
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

