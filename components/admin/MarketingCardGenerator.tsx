'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Download, Maximize, Palette, MapPin, ShieldCheck } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Product } from '@/types';

interface MarketingCardGeneratorProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function MarketingCardGenerator({ product, isOpen, onClose }: MarketingCardGeneratorProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [imageScale, setImageScale] = useState(1.0);
  const [nameFontScale, setNameFontScale] = useState(1.0);
  const [showPrice, setShowPrice] = useState(true);
  const [showSpecIcons, setShowSpecIcons] = useState(true);
  const [customProductName, setCustomProductName] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  // Get product data with fallbacks
  const defaultProductName = product?.name || product?.Name || 'Product Name';
  // Use custom name if provided, otherwise use default (for display in image)
  const productName = customProductName.trim() || defaultProductName;
  const productImage = product?.image || product?.Image || product?.ImageUrl || '';
  const productSize = product?.size || product?.Size || '';
  const productColor = product?.color || product?.Color || '';
  const productOrigin = product?.Origin || '';
  const productWarranty = product?.Warranty || '';
  const productPrice = product?.SalePrice || product?.price || 0;

  // Format price with currency symbol (English numbers)
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Build specs array (only include if data exists)
  type SpecItem = {
    icon: typeof Maximize;
    value: string;
    label: string;
  };
  const specs: SpecItem[] = [];
  if (productSize) {
    specs.push({ icon: Maximize, value: productSize, label: 'Size' });
  }
  if (productColor) {
    specs.push({ icon: Palette, value: productColor, label: 'Color' });
  }
  if (productOrigin) {
    specs.push({ icon: MapPin, value: productOrigin, label: 'Origin' });
  }
  if (productWarranty) {
    specs.push({ icon: ShieldCheck, value: productWarranty, label: 'Warranty' });
  }

  const handleDownload = async () => {
    if (!captureRef.current) return;

    setIsDownloading(true);
    try {
      // Wait a bit to ensure all images are loaded
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(captureRef.current, {
        width: 1080,
        height: 1080,
        scale: 1,
        useCORS: true,
        logging: false,
        backgroundColor: null,
        allowTaint: false,
        windowWidth: 1080,
        windowHeight: 1080,
      });

      // Create download link
      const link = document.createElement('a');
      const fileName = `${productName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-ad.png`;
      link.download = fileName;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Failed to generate image. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Reset image scale and options when product changes
  useEffect(() => {
    setImageScale(1.0);
    setNameFontScale(1.0);
    setShowPrice(true);
    setShowSpecIcons(true);
    setCustomProductName('');
  }, [product]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !product) return null;

  // Shared card content component
  const CardContent = ({ isCapture = false, scale = 1.0, nameFontScale = 1.0, showPriceValue = true, showIcons = true }) => (
    <div
      className="relative overflow-hidden"
      style={{
        width: '1080px',
        height: '1080px',
        fontFamily: 'var(--font-cairo), Cairo, sans-serif',
      }}
    >
      {/* Background Image */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: 'url(/ad-template.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Content Container */}
      <div className="relative h-full flex items-start px-16" style={{ paddingTop: '160px', paddingBottom: '16px' }}>
        {/* Left Side - Product Name and Specs */}
        <div className="flex flex-col justify-start gap-8" style={{ width: '45%' }}>
          {/* A. Product Name - Left Side */}
          <div>
            <h1
              className="font-black leading-tight"
              style={{
                fontSize: `${4 * nameFontScale}rem`, // Base: 4rem (64px), scales with nameFontScale
                color: '#333333',
                fontFamily: 'var(--font-cairo), Cairo, sans-serif',
                fontWeight: 900,
                direction: 'rtl',
                textAlign: 'right',
                wordSpacing: 'normal',
                letterSpacing: 'normal',
              }}
            >
              {productName}
            </h1>
          </div>

          {/* D. Specifications - Below Product Name */}
          {specs.length > 0 && (
            <div className="flex flex-col gap-4">
              {specs.map((spec, index) => {
                const IconComponent = spec.icon;
                return (
                  <div
                    key={index}
                    className="flex items-center gap-4"
                    style={{ direction: 'rtl' }}
                  >
                    {showIcons && (
                      <div className="flex-shrink-0">
                        <IconComponent 
                          size={32} 
                          style={{ color: '#D4AF37' }}
                        />
                      </div>
                    )}
                    <div className="flex flex-col" style={{ direction: 'rtl', textAlign: 'right' }}>
                      <span
                        className="text-2xl font-bold"
                        style={{
                          color: '#333333',
                          fontFamily: 'var(--font-cairo), Cairo, sans-serif',
                          direction: 'rtl',
                          textAlign: 'right',
                          wordSpacing: 'normal',
                        }}
                      >
                        {spec.value}
                      </span>
                      <span
                        className="text-xs font-medium uppercase tracking-wider"
                        style={{
                          color: '#666666',
                          fontFamily: 'var(--font-cairo), Cairo, sans-serif',
                        }}
                      >
                        {spec.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side - Product Image and Price */}
        <div className="flex-1 flex flex-col items-center justify-start gap-6" style={{ width: '55%' }}>
          {productImage ? (
            <div 
              className="relative flex items-center justify-center"
              style={{
                maxWidth: '90%',
                maxHeight: '90%',
                filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))',
                backfaceVisibility: 'hidden',
                transform: 'translateZ(0)',
              }}
            >
              <img
                src={productImage}
                alt={productName}
                className="object-contain"
                style={{
                  minWidth: `${300 * scale}px`,
                  minHeight: `${300 * scale}px`,
                  maxWidth: `${500 * scale}px`,
                  maxHeight: `${600 * scale}px`,
                  width: 'auto',
                  height: 'auto',
                  filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
                  imageRendering: 'auto',
                  display: 'block',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'translateZ(0)',
                }}
                crossOrigin="anonymous"
                loading="eager"
              />
            </div>
          ) : (
            <div className="w-64 h-64 bg-gray-200/50 rounded-lg flex items-center justify-center">
              <span className="text-gray-400">No Image</span>
            </div>
          )}

          {/* C. Price Badge - Below Product Image */}
          {productPrice > 0 && showPriceValue && (
            <div 
              className="mt-2" 
              style={{ 
                textAlign: 'center',
                filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))',
              }}
            >
              <div className="flex items-baseline gap-2" style={{ justifyContent: 'center' }}>
                <span
                  className="text-8xl font-black"
                  style={{
                    color: '#E5C158',
                    fontFamily: 'var(--font-cairo), Cairo, sans-serif',
                    fontWeight: 900,
                    direction: 'ltr',
                    textAlign: 'left',
                    fontSize: '6rem',
                    textShadow: '0 4px 8px rgba(0,0,0,0.3), 0 0 20px rgba(229, 193, 88, 0.3)',
                  }}
                >
                  {formatPrice(productPrice)}
                </span>
                <span
                  className="text-5xl font-bold"
                  style={{
                    color: '#E5C158',
                    fontFamily: 'var(--font-cairo), Cairo, sans-serif',
                    fontWeight: 700,
                    opacity: 0.9,
                    fontSize: '3.5rem',
                    textShadow: '0 4px 8px rgba(0,0,0,0.3), 0 0 20px rgba(229, 193, 88, 0.3)',
                  }}
                >
                  ₪
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Marketing Image Generator</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Preview Section */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Live Preview</h3>
                <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center overflow-auto max-h-[600px]">
                  {/* Scaled Preview */}
                  <div
                    className="relative mx-auto"
                    style={{
                      width: '540px',
                      height: '540px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div 
                      ref={previewRef}
                      style={{
                        width: '1080px',
                        height: '1080px',
                        transform: 'scale(0.5)',
                        transformOrigin: '0 0',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        willChange: 'transform',
                      }}
                    >
                      <CardContent isCapture={false} scale={imageScale} nameFontScale={nameFontScale} showPriceValue={showPrice} showIcons={showSpecIcons} />
                    </div>
                  </div>
                </div>

                {/* Hidden Full-Size Element for Capture */}
                <div className="fixed -left-[9999px] top-0 pointer-events-none" style={{ zIndex: -1 }}>
                  <div ref={captureRef}>
                    <CardContent isCapture={true} scale={imageScale} nameFontScale={nameFontScale} showPriceValue={showPrice} showIcons={showSpecIcons} />
                  </div>
                </div>
              </div>

              {/* Controls Section */}
              <div className="lg:w-80 w-full space-y-4 flex-shrink-0">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Product Details</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <span className="ml-2 font-medium text-gray-900">{productName}</span>
                    </div>
                    {productPrice > 0 && (
                      <div>
                        <span className="text-gray-600">Price:</span>
                        <span className="ml-2 font-medium text-gray-900">{formatPrice(productPrice)} ₪</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600">Specs:</span>
                      <span className="ml-2 font-medium text-gray-900">{specs.length}</span>
                    </div>
                  </div>
                </div>

                {/* Image Size Control */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Image Size</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                      <span>Small</span>
                      <span className="font-medium text-gray-900">{Math.round(imageScale * 100)}%</span>
                      <span>Large</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={imageScale}
                      onChange={(e) => setImageScale(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
                      style={{
                        background: `linear-gradient(to right, #1f2937 0%, #1f2937 ${((imageScale - 0.5) / 1.5) * 100}%, #e5e7eb ${((imageScale - 0.5) / 1.5) * 100}%, #e5e7eb 100%)`,
                      }}
                    />
                    <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                      <span>50%</span>
                      <span>100%</span>
                      <span>200%</span>
                    </div>
                  </div>
                </div>

                {/* Product Name Font Size */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Product Name Font Size</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                      <span>Small</span>
                      <span className="font-medium text-gray-900">{Math.round(nameFontScale * 100)}%</span>
                      <span>Large</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={nameFontScale}
                      onChange={(e) => setNameFontScale(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
                      style={{
                        background: `linear-gradient(to right, #1f2937 0%, #1f2937 ${((nameFontScale - 0.5) / 1.5) * 100}%, #e5e7eb ${((nameFontScale - 0.5) / 1.5) * 100}%, #e5e7eb 100%)`,
                      }}
                    />
                    <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                      <span>50%</span>
                      <span>100%</span>
                      <span>200%</span>
                    </div>
                  </div>
                </div>

                {/* Product Name Editor */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Product Name (Temporary Edit)</h3>
                  <p className="text-xs text-gray-500 mb-2">This edit is temporary and only affects the marketing image. The original product name in the sheet will not be changed.</p>
                  <input
                    type="text"
                    value={customProductName || defaultProductName}
                    onChange={(e) => setCustomProductName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 text-gray-900 bg-white"
                    style={{ direction: 'rtl', textAlign: 'right' }}
                  />
                  {customProductName && customProductName !== defaultProductName && (
                    <button
                      onClick={() => setCustomProductName('')}
                      className="mt-2 text-xs text-gray-600 hover:text-gray-900 underline"
                    >
                      Reset to original name
                    </button>
                  )}
                </div>

                {/* Display Options */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Display Options</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showPrice}
                        onChange={(e) => setShowPrice(e.target.checked)}
                        className="w-4 h-4 text-gray-900 bg-gray-100 border-gray-300 rounded focus:ring-gray-900 focus:ring-2"
                      />
                      <span className="text-sm text-gray-700">Show Price</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showSpecIcons}
                        onChange={(e) => setShowSpecIcons(e.target.checked)}
                        className="w-4 h-4 text-gray-900 bg-gray-100 border-gray-300 rounded focus:ring-gray-900 focus:ring-2"
                      />
                      <span className="text-sm text-gray-700">Show Specification Icons</span>
                    </label>
                  </div>
                </div>

                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {isDownloading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Download size={20} />
                      <span>Download Image</span>
                    </>
                  )}
                </button>

                <div className="text-xs text-gray-500 space-y-1">
                  <p>• Image size: 1080x1080px</p>
                  <p>• Optimized for Instagram/Facebook</p>
                  <p>• Premium Arabic marketing design</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
