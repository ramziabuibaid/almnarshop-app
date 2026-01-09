'use client';

import { useState, useRef } from 'react';
import { Upload, Loader2, X, Camera } from 'lucide-react';
import { convertDriveImageUrl } from '@/lib/api';

interface ImageUploadFieldProps {
  label: string;
  currentValue: string; // Full URL for saving
  previewUrl?: string; // Optional URL for preview (if different from currentValue)
  onUploadComplete: (fileUrl: string) => void;
}

export default function ImageUploadField({
  label,
  currentValue,
  previewUrl: externalPreviewUrl,
  onUploadComplete,
}: ImageUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Construct preview URL from filename/filePath
  const getPreviewUrl = (filePath: string): string => {
    if (!filePath) return '';
    
    // If it's already a full URL, convert it using convertDriveImageUrl
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      const converted = convertDriveImageUrl(filePath);
      return converted || filePath; // Fallback to original if conversion fails
    }
    
    // If it's an AppSheet file path (e.g., "Products_Images/file.jpg")
    // Try to construct a Google Drive direct link
    // First, try to extract file ID if it looks like a file ID
    const converted = convertDriveImageUrl(filePath);
    if (converted) {
      return converted;
    }
    
    // If conversion didn't work, try using it as-is (might be a valid URL pattern we don't recognize)
    // The backend should ideally return ImageUrl directly, but if it returns filePath,
    // we'll try to use it and let the img tag's onError handle failures
    return filePath;
  };

  // Use currentValue for preview - this is the source of truth
  // If currentValue is empty, don't show preview even if externalPreviewUrl exists
  // This ensures that when user clicks X to remove, the preview disappears immediately
  const previewUrl = currentValue && currentValue.trim() !== '' 
    ? getPreviewUrl(currentValue) 
    : '';

  /**
   * Compress and resize image using canvas
   * Max dimensions: 800x800px
   * Preserves PNG format with transparency, converts others to JPEG
   */
  const compressImage = (file: File): Promise<{ blob: Blob; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions (maintain aspect ratio, max 800x800)
          let width = img.width;
          let height = img.height;
          const maxDimension = 800;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }

          // Create canvas and draw resized image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { alpha: true }); // Enable alpha channel for transparency
          
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Clear canvas with transparent background (important for PNG)
          ctx.clearRect(0, 0, width, height);
          
          // Draw image
          ctx.drawImage(img, 0, 0, width, height);

          // Determine output format based on original file type
          const isPNG = file.type === 'image/png';
          const outputMimeType = isPNG ? 'image/png' : 'image/jpeg';
          const quality = isPNG ? undefined : 0.7; // PNG doesn't use quality parameter

          // Convert to blob with appropriate format
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }

              resolve({ blob, mimeType: outputMimeType });
            },
            outputMimeType,
            quality
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file');
      return;
    }

    setIsUploading(true);
    setUploadError('');
    setUploadSuccess(false);

    try {
      // Step 1: Compress the image to a reasonable size (preserves PNG format)
      const { blob: compressedBlob, mimeType } = await compressImage(file);

      // Step 2: Convert blob to File for FormData with correct MIME type
      // Preserve original extension or use appropriate one based on MIME type
      const fileExtension = mimeType === 'image/png' ? '.png' : '.jpg';
      const fileName = file.name.replace(/\.[^/.]+$/, '') + fileExtension;
      
      const compressedFile = new File([compressedBlob], fileName, {
        type: mimeType,
        lastModified: Date.now(),
      });

      // Step 3: Upload via API route (uses service role key to bypass RLS)
      const formData = new FormData();
      formData.append('file', compressedFile);

      const response = await fetch('/api/admin/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success || !data.publicUrl) {
        throw new Error(data.error || 'Failed to upload image');
      }

      setUploadSuccess(true);
      onUploadComplete(data.publicUrl);

      // Clear success message after 3 seconds
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (error: any) {
      console.error('[ImageUploadField] Upload error:', error);
      setUploadError(error?.message || 'Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
      // Reset file inputs
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    onUploadComplete('');
    setUploadError('');
    setUploadSuccess(false);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-900 mb-1">
        {label}
      </label>
      
      {/* Preview */}
      {previewUrl && (
        <div className="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 mb-2">
          <img
            src={previewUrl}
            alt={label}
            className="w-full h-full object-contain"
            onError={(e) => {
              // If image fails to load, hide it
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {currentValue && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRemove();
              }}
              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors z-10"
              title="Remove image"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Upload Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* File input for selecting from gallery/memory */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />
        {/* Camera input for capturing directly from camera */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />
        
        {/* Camera button - for mobile/tablet devices */}
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isUploading}
          className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
          title="التقاط صورة من الكاميرا"
        >
          {isUploading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>جاري الرفع...</span>
            </>
          ) : (
            <>
              <Camera size={18} />
              <span>التقاط صورة</span>
            </>
          )}
        </button>
        
        {/* Gallery button - for selecting from memory */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
          title="اختيار صورة من الذاكرة"
        >
          {isUploading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>جاري الرفع...</span>
            </>
          ) : (
            <>
              <Upload size={18} />
              <span>{previewUrl ? 'تغيير الصورة' : 'اختيار صورة'}</span>
            </>
          )}
        </button>
      </div>

      {/* Success Message */}
      {uploadSuccess && (
        <p className="text-xs text-green-600 mt-1">✓ Image uploaded successfully!</p>
      )}

      {/* Error Message */}
      {uploadError && (
        <p className="text-xs text-red-600 mt-1">{uploadError}</p>
      )}

      {/* Current filename display */}
      {currentValue && !previewUrl && !uploadSuccess && (
        <p className="text-xs text-gray-700 mt-1 font-medium">Current: {currentValue}</p>
      )}
    </div>
  );
}
