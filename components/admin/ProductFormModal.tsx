'use client';

import { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { Product } from '@/types';
import { saveProduct } from '@/lib/api';
import ImageUploadField from './ImageUploadField';
import { useAdminAuth } from '@/context/AdminAuthContext';

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
        });
      }
      setError('');
    }
  }, [isOpen, product]);

  const handleChange = (field: keyof Product, value: string | number) => {
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
        'Shamel No': formData['Shamel No'] || undefined,
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
      };

      // Remove undefined values, but keep empty strings for image fields to allow deletion
      Object.keys(productData).forEach((key) => {
        // Keep empty strings for image fields to allow clearing images
        const isImageField = key === 'Image' || key === 'Image 2' || key === 'image 3';
        if (!isImageField && (productData[key] === undefined || productData[key] === '')) {
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
                    <input
                      type="text"
                      value={formData.Barcode || ''}
                      onChange={(e) => handleChange('Barcode', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                    />
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

