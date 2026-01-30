'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Download, Maximize, Palette, MapPin, ShieldCheck, GripVertical, ImagePlus, Upload, Trash2, Type } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Product } from '@/types';

const CARD_SIZE = 1080;
const STORAGE_KEY = 'marketing-card-generator-layout';
const DEFAULT_BACKGROUND = '/ad-template.png';
const BACKGROUND_STORAGE_KEY = 'marketing-card-generator-backgrounds';
const MAX_BACKGROUND_LIBRARY = 8;
const COLORS_STORAGE_KEY = 'marketing-card-generator-colors';

const DEFAULT_NAME_COLOR = '#333333';
const DEFAULT_SPECS_COLOR = '#333333';
const DEFAULT_SPECS_LABEL_COLOR = '#666666';
const DEFAULT_PRICE_COLOR = '#E5C158';

interface SavedColors {
  nameColor: string;
  specsColor: string;
  specsLabelColor: string;
  priceColor: string;
}

const defaultColors: SavedColors = {
  nameColor: DEFAULT_NAME_COLOR,
  specsColor: DEFAULT_SPECS_COLOR,
  specsLabelColor: DEFAULT_SPECS_LABEL_COLOR,
  priceColor: DEFAULT_PRICE_COLOR,
};

function isValidHex(s: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(s);
}

function loadSavedColors(): SavedColors {
  if (typeof window === 'undefined') return defaultColors;
  try {
    const raw = localStorage.getItem(COLORS_STORAGE_KEY);
    if (!raw) return defaultColors;
    const parsed = JSON.parse(raw) as Partial<SavedColors>;
    return {
      nameColor: isValidHex(parsed.nameColor) ? parsed.nameColor! : defaultColors.nameColor,
      specsColor: isValidHex(parsed.specsColor) ? parsed.specsColor! : defaultColors.specsColor,
      specsLabelColor: isValidHex(parsed.specsLabelColor) ? parsed.specsLabelColor! : defaultColors.specsLabelColor,
      priceColor: isValidHex(parsed.priceColor) ? parsed.priceColor! : defaultColors.priceColor,
    };
  } catch {
    return defaultColors;
  }
}

function saveColors(data: SavedColors) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COLORS_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

interface SavedBackgrounds {
  current: string;
  library: string[];
}

function loadSavedBackgrounds(): SavedBackgrounds {
  if (typeof window === 'undefined') {
    return { current: DEFAULT_BACKGROUND, library: [] };
  }
  try {
    const raw = localStorage.getItem(BACKGROUND_STORAGE_KEY);
    if (!raw) return { current: DEFAULT_BACKGROUND, library: [] };
    const parsed = JSON.parse(raw) as SavedBackgrounds;
    const library = Array.isArray(parsed.library) ? parsed.library.slice(0, MAX_BACKGROUND_LIBRARY) : [];
    const current =
      typeof parsed.current === 'string' && parsed.current.length > 0 ? parsed.current : DEFAULT_BACKGROUND;
    return { current, library };
  } catch {
    return { current: DEFAULT_BACKGROUND, library: [] };
  }
}

function saveBackgrounds(data: SavedBackgrounds) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BACKGROUND_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export type BlockId = 'name' | 'specs' | 'image' | 'price';

export interface BlockPosition {
  left: number; // percent 0–100
  top: number;
}

const defaultPositions: Record<BlockId, BlockPosition> = {
  name: { left: 6, top: 15 },
  specs: { left: 6, top: 32 },
  image: { left: 52, top: 15 },
  price: { left: 77, top: 58 },
};

function loadSavedLayout(): Record<BlockId, BlockPosition> {
  if (typeof window === 'undefined') return { ...defaultPositions };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultPositions };
    const parsed = JSON.parse(raw) as Record<string, { left: number; top: number }>;
    const result = { ...defaultPositions };
    (['name', 'specs', 'image', 'price'] as const).forEach((id) => {
      if (parsed[id] && typeof parsed[id].left === 'number' && typeof parsed[id].top === 'number') {
        result[id] = { left: parsed[id].left, top: parsed[id].top };
      }
    });
    return result;
  } catch {
    return { ...defaultPositions };
  }
}

function saveLayout(positions: Record<BlockId, BlockPosition>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // ignore
  }
}

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
  const [currentBackground, setCurrentBackground] = useState(DEFAULT_BACKGROUND);
  const [backgroundLibrary, setBackgroundLibrary] = useState<string[]>([]);
  const [nameColor, setNameColor] = useState(DEFAULT_NAME_COLOR);
  const [specsColor, setSpecsColor] = useState(DEFAULT_SPECS_COLOR);
  const [specsLabelColor, setSpecsLabelColor] = useState(DEFAULT_SPECS_LABEL_COLOR);
  const [priceColor, setPriceColor] = useState(DEFAULT_PRICE_COLOR);
  const [positions, setPositions] = useState<Record<BlockId, BlockPosition>>(() => defaultPositions);
  const [draggingBlock, setDraggingBlock] = useState<BlockId | null>(null);
  const backgroundFileInputRef = useRef<HTMLInputElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const captureTargetRef = useRef<HTMLElement | null>(null);
  const capturePointerIdRef = useRef<number | null>(null);
  const positionsRef = useRef(positions);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  positionsRef.current = positions;

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

  // Load saved layout, backgrounds, and colors when modal opens
  useEffect(() => {
    if (isOpen) {
      setPositions(loadSavedLayout());
      const bg = loadSavedBackgrounds();
      setCurrentBackground(bg.current);
      setBackgroundLibrary(bg.library);
      const colors = loadSavedColors();
      setNameColor(colors.nameColor);
      setSpecsColor(colors.specsColor);
      setSpecsLabelColor(colors.specsLabelColor);
      setPriceColor(colors.priceColor);
    }
  }, [isOpen]);

  const persistColors = useCallback(() => {
    saveColors({ nameColor, specsColor, specsLabelColor, priceColor });
  }, [nameColor, specsColor, specsLabelColor, priceColor]);

  useEffect(() => {
    if (isOpen) persistColors();
  }, [isOpen, persistColors]);

  const handleBackgroundUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setBackgroundLibrary((prev) => {
        const next = [dataUrl, ...prev.filter((url) => url !== dataUrl)].slice(0, MAX_BACKGROUND_LIBRARY);
        setCurrentBackground(dataUrl);
        saveBackgrounds({ current: dataUrl, library: next });
        return next;
      });
      setCurrentBackground(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const handleSelectBackground = useCallback((url: string) => {
    setCurrentBackground(url);
    saveBackgrounds({ current: url, library: backgroundLibrary });
  }, [backgroundLibrary]);

  const handleRemoveBackground = useCallback(
    (url: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const nextLibrary = backgroundLibrary.filter((u) => u !== url);
      setBackgroundLibrary(nextLibrary);
      if (currentBackground === url) {
        setCurrentBackground(DEFAULT_BACKGROUND);
        saveBackgrounds({ current: DEFAULT_BACKGROUND, library: nextLibrary });
      } else {
        saveBackgrounds({ current: currentBackground, library: nextLibrary });
      }
    },
    [backgroundLibrary, currentBackground]
  );

  // Reset only custom name when product changes
  useEffect(() => {
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

  // Convert mouse coords (relative to viewport) to design coords (0–1080) using preview container
  const clientToDesign = useCallback((clientX: number, clientY: number) => {
    const el = previewContainerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const scale = rect.width / CARD_SIZE;
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  }, []);

  const handleBlockPointerDown = useCallback(
    (block: BlockId, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      captureTargetRef.current = target;
      capturePointerIdRef.current = e.pointerId;
      const pos = positions[block];
      const design = clientToDesign(e.clientX, e.clientY);
      const blockLeft = (pos.left / 100) * CARD_SIZE;
      const blockTop = (pos.top / 100) * CARD_SIZE;
      dragOffsetRef.current = { x: design.x - blockLeft, y: design.y - blockTop };
      setDraggingBlock(block);
    },
    [positions, clientToDesign]
  );

  useEffect(() => {
    if (draggingBlock === null) return;
    const onMove = (e: MouseEvent | PointerEvent) => {
      const design = clientToDesign(e.clientX, e.clientY);
      const newLeft = Math.max(0, Math.min(100, ((design.x - dragOffsetRef.current.x) / CARD_SIZE) * 100));
      const newTop = Math.max(0, Math.min(100, ((design.y - dragOffsetRef.current.y) / CARD_SIZE) * 100));
      setPositions((prev) => {
        const next = { ...prev, [draggingBlock]: { left: newLeft, top: newTop } };
        saveLayout(next);
        return next;
      });
    };
    const onUp = () => {
      if (captureTargetRef.current && capturePointerIdRef.current !== null) {
        try {
          captureTargetRef.current.releasePointerCapture(capturePointerIdRef.current);
        } catch {
          // ignore
        }
        captureTargetRef.current = null;
        capturePointerIdRef.current = null;
      }
      setDraggingBlock(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [draggingBlock, clientToDesign]);

  if (!isOpen || !product) return null;

  type CardContentProps = {
    isCapture?: boolean;
    scale?: number;
    nameFontScale?: number;
    showPriceValue?: boolean;
    showIcons?: boolean;
    positions: Record<BlockId, BlockPosition>;
    backgroundUrl: string;
    nameColor: string;
    specsColor: string;
    specsLabelColor: string;
    priceColor: string;
    onBlockPointerDown?: (block: BlockId, e: React.PointerEvent) => void;
  };

  const CardContent = ({ isCapture = false, scale = 1.0, nameFontScale: nfs = 1.0, showPriceValue = true, showIcons = true, positions: pos, backgroundUrl, nameColor: nameClr, specsColor: specsClr, specsLabelColor: specsLblClr, priceColor: priceClr, onBlockPointerDown }: CardContentProps) => {
    const wrap = (block: BlockId, content: React.ReactNode, centerX = false, shrinkToContent = false, maxWidthPercent?: number) => {
      const p = pos[block];
      const style: React.CSSProperties = {
        position: 'absolute',
        left: `${p.left}%`,
        top: `${p.top}%`,
        transform: centerX ? 'translate(-50%, 0)' : undefined,
        zIndex: 10,
        ...(shrinkToContent
          ? { width: 'max-content', maxWidth: maxWidthPercent != null ? `${maxWidthPercent}%` : '100%' }
          : {}),
      };
      if (!isCapture && onBlockPointerDown) {
        return (
          <div
            role="button"
            tabIndex={0}
            className="cursor-grab active:cursor-grabbing select-none touch-none outline-none"
            style={style}
            onPointerDown={(e) => onBlockPointerDown(block, e)}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div
              className="flex items-center gap-1 mb-1 text-gray-500 opacity-90 hover:opacity-100 rounded px-1 py-0.5 bg-white/80 border border-gray-200/80"
              style={{ minHeight: 24, pointerEvents: 'auto' }}
            >
              <GripVertical size={14} />
              <span className="text-xs font-medium uppercase">{block}</span>
            </div>
            {content}
          </div>
        );
      }
      return <div style={style}>{content}</div>;
    };

    return (
      <div
        dir="ltr"
        className="relative overflow-hidden"
        style={{
          width: `${CARD_SIZE}px`,
          height: `${CARD_SIZE}px`,
          fontFamily: 'var(--font-cairo), Cairo, sans-serif',
        }}
      >
        {/* Background Image */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />

        {/* Block: Product Name - max 50% card width so text wraps to two lines at a readable size */}
        {wrap(
          'name',
          <h1
            className="font-black leading-tight"
            style={{
              fontSize: `${4 * nfs}rem`,
              color: nameClr,
              fontFamily: 'var(--font-cairo), Cairo, sans-serif',
              fontWeight: 900,
              direction: 'rtl',
              textAlign: 'right',
              wordSpacing: 'normal',
              letterSpacing: 'normal',
            }}
          >
            {productName}
          </h1>,
          false,
          true,
          50
        )}

        {/* Block: Specifications - shrinkToContent so block moves as a whole */}
        {specs.length > 0 &&
          wrap(
            'specs',
            <div className="flex flex-col gap-4" style={{ width: 'max-content' }}>
              {specs.map((spec, index) => {
                const IconComponent = spec.icon;
                return (
                  <div key={index} className="flex items-center gap-4" style={{ direction: 'rtl' }}>
                    {showIcons && (
                      <div className="flex-shrink-0">
                        <IconComponent size={32} style={{ color: '#D4AF37' }} />
                      </div>
                    )}
                    <div className="flex flex-col" style={{ direction: 'rtl', textAlign: 'right' }}>
                      <span
                        className="text-2xl font-bold"
                        style={{
                          color: specsClr,
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
                        style={{ color: specsLblClr, fontFamily: 'var(--font-cairo), Cairo, sans-serif' }}
                      >
                        {spec.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>,
            false,
            true
          )}

        {/* Block: Product Image */}
        {wrap(
          'image',
          productImage ? (
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
                draggable={false}
              />
            </div>
          ) : (
            <div className="w-64 h-64 bg-gray-200/50 rounded-lg flex items-center justify-center">
              <span className="text-gray-400">No Image</span>
            </div>
          ),
          true
        )}

        {/* Block: Price */}
        {productPrice > 0 &&
          showPriceValue &&
          wrap(
            'price',
            <div className="mt-2" style={{ textAlign: 'center', filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))' }}>
              <div className="flex items-baseline gap-2" style={{ justifyContent: 'center' }}>
                <span
                  className="text-8xl font-black"
                  style={{
                    color: priceClr,
                    fontFamily: 'var(--font-cairo), Cairo, sans-serif',
                    fontWeight: 900,
                    direction: 'ltr',
                    textAlign: 'left',
                    fontSize: '6rem',
                    textShadow: `0 4px 8px rgba(0,0,0,0.3), 0 0 20px ${priceClr}40`,
                  }}
                >
                  {formatPrice(productPrice)}
                </span>
                <span
                  className="text-5xl font-bold"
                  style={{
                    color: priceClr,
                    fontFamily: 'var(--font-cairo), Cairo, sans-serif',
                    fontWeight: 700,
                    opacity: 0.9,
                    fontSize: '3.5rem',
                    textShadow: `0 4px 8px rgba(0,0,0,0.3), 0 0 20px ${priceClr}40`,
                  }}
                >
                  ₪
                </span>
              </div>
            </div>,
            true
          )}
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - dir="ltr" so layout (preview left, controls right) is not reversed in RTL pages */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
        <div dir="ltr" className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto">
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

          {/* Content: preview fixed (no scroll), only controls column scrolls */}
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 p-6">
            {/* Preview Section - fixed, never scrolls */}
            <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Live Preview</h3>
              <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center overflow-hidden">
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
                      ref={previewContainerRef}
                      style={{
                        width: `${CARD_SIZE}px`,
                        height: `${CARD_SIZE}px`,
                        transform: 'scale(0.5)',
                        transformOrigin: '0 0',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        willChange: 'transform',
                        pointerEvents: 'auto',
                      }}
                    >
                      <CardContent
                        isCapture={false}
                        scale={imageScale}
                        nameFontScale={nameFontScale}
                        showPriceValue={showPrice}
                        showIcons={showSpecIcons}
                        positions={positions}
                        backgroundUrl={currentBackground}
                        nameColor={nameColor}
                        specsColor={specsColor}
                        specsLabelColor={specsLabelColor}
                        priceColor={priceColor}
                        onBlockPointerDown={handleBlockPointerDown}
                      />
                    </div>
                  </div>
                </div>

                {/* Hidden Full-Size Element for Capture */}
                <div className="fixed -left-[9999px] top-0 pointer-events-none" style={{ zIndex: -1 }}>
                  <div ref={captureRef}>
                    <CardContent
                      isCapture={true}
                      scale={imageScale}
                      nameFontScale={nameFontScale}
                      showPriceValue={showPrice}
                      showIcons={showSpecIcons}
                      positions={positions}
                      backgroundUrl={currentBackground}
                      nameColor={nameColor}
                      specsColor={specsColor}
                      specsLabelColor={specsLabelColor}
                      priceColor={priceColor}
                    />
                  </div>
                </div>
              </div>

              {/* Controls Section - only this column scrolls */}
              <div className="lg:w-80 w-full flex-shrink-0 min-h-0 overflow-y-auto space-y-4">
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

                {/* Background: upload + library */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <ImagePlus size={18} />
                    Background
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">Upload a new design or choose from your saved backgrounds.</p>
                  <input
                    ref={backgroundFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBackgroundUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => backgroundFileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors mb-3"
                  >
                    <Upload size={16} />
                    Upload new background
                  </button>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectBackground(DEFAULT_BACKGROUND)}
                      className={`aspect-square rounded-lg border-2 bg-cover bg-center transition-colors ${
                        currentBackground === DEFAULT_BACKGROUND
                          ? 'border-gray-900 ring-2 ring-gray-900 ring-offset-1'
                          : 'border-gray-200 hover:border-gray-400'
                      }`}
                      style={{ backgroundImage: `url(${DEFAULT_BACKGROUND})` }}
                      title="Default template"
                    />
                    {backgroundLibrary.map((url, i) => (
                      <div key={i} className="relative group">
                        <button
                          type="button"
                          onClick={() => handleSelectBackground(url)}
                          className={`w-full aspect-square rounded-lg border-2 bg-cover bg-center transition-colors ${
                            currentBackground === url ? 'border-gray-900 ring-2 ring-gray-900 ring-offset-1' : 'border-gray-200 hover:border-gray-400'
                          }`}
                          style={{ backgroundImage: `url(${url})` }}
                          title={`Background ${i + 1}`}
                        />
                        <button
                          type="button"
                          onClick={(e) => handleRemoveBackground(url, e)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-opacity shadow"
                          title="Remove from library"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Text colors - match background */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Type size={18} />
                    Text colors
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">Adjust colors to suit your background. Saved for next designs.</p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-gray-600 shrink-0 w-24">Product name</label>
                      <input
                        type="color"
                        value={nameColor}
                        onChange={(e) => setNameColor(e.target.value)}
                        className="h-8 w-12 rounded border border-gray-300 cursor-pointer"
                      />
                      <span className="text-xs text-gray-500 font-mono">{nameColor}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-gray-600 shrink-0 w-24">Specs (value)</label>
                      <input
                        type="color"
                        value={specsColor}
                        onChange={(e) => setSpecsColor(e.target.value)}
                        className="h-8 w-12 rounded border border-gray-300 cursor-pointer"
                      />
                      <span className="text-xs text-gray-500 font-mono">{specsColor}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-gray-600 shrink-0 w-24">Specs (label)</label>
                      <input
                        type="color"
                        value={specsLabelColor}
                        onChange={(e) => setSpecsLabelColor(e.target.value)}
                        className="h-8 w-12 rounded border border-gray-300 cursor-pointer"
                      />
                      <span className="text-xs text-gray-500 font-mono">{specsLabelColor}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-gray-600 shrink-0 w-24">Price</label>
                      <input
                        type="color"
                        value={priceColor}
                        onChange={(e) => setPriceColor(e.target.value)}
                        className="h-8 w-12 rounded border border-gray-300 cursor-pointer"
                      />
                      <span className="text-xs text-gray-500 font-mono">{priceColor}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNameColor(DEFAULT_NAME_COLOR);
                      setSpecsColor(DEFAULT_SPECS_COLOR);
                      setSpecsLabelColor(DEFAULT_SPECS_LABEL_COLOR);
                      setPriceColor(DEFAULT_PRICE_COLOR);
                      saveColors(defaultColors);
                    }}
                    className="mt-3 w-full px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Reset to default colors
                  </button>
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

                {/* Layout: drag & drop + reset */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Layout</h3>
                  <p className="text-xs text-gray-500 mb-3">Drag elements in the preview to move them. Positions are saved for all future designs.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setPositions({ ...defaultPositions });
                      saveLayout(defaultPositions);
                    }}
                    className="w-full px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Reset layout to default
                  </button>
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
    </>
  );
}
