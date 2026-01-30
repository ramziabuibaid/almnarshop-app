'use client';

import { useEffect, useLayoutEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Product } from '@/types';
import QRCode from '@/components/admin/QRCode';
import { getDirectImageUrl } from '@/lib/utils';

type LabelType = 'A' | 'B' | 'C' | 'D';

function LabelsPrintContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [labelType, setLabelType] = useState<LabelType>('A');
  const [useQuantity, setUseQuantity] = useState<boolean>(true);
  const [showZeroQuantity, setShowZeroQuantity] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useQrProductUrl, setUseQrProductUrl] = useState<boolean>(false);
  const [showQrInCatalog, setShowQrInCatalog] = useState<boolean>(false); // لنوع د: إظهار QR لفتح صفحة المنتج (افتراضي عدم إظهار)

  // Get base URL for product links
  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    // Fallback for SSR - use environment variable or hardcoded domain
    return process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL 
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` 
      : 'https://almnarshop-app.vercel.app';
  };

  // Generate product URL for QR code
  const getProductUrl = (product: Product) => {
    const productId = product.ProductID || product.id || '';
    if (!productId) return '';
    const baseUrl = getBaseUrl();
    return `${baseUrl}/product/${productId}`;
  };

  // Decide QR code payload based on user preference
  // If useQrProductUrl => full URL, else fallback to barcode/shamel/productId
  const getQrCodeValue = (product: Product) => {
    if (useQrProductUrl) {
      return getProductUrl(product);
    }
    const fallback =
      product.barcode ||
      product.Barcode ||
      product.shamel_no ||
      product['Shamel No'] ||
      product.ShamelNo ||
      product.ProductID ||
      product.id ||
      '';
    return fallback;
  };

  // Force document title = date + time (English numerals 0-9) so saved PDF has a unique filename
  useLayoutEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    const h = now.getHours().toString().padStart(2, '0');
    const min = now.getMinutes().toString().padStart(2, '0');
    const s = now.getSeconds().toString().padStart(2, '0');
    document.title = `${y}-${m}-${d}_${h}-${min}-${s}`;
  }, []);

  // Auto print when products are loaded
  useEffect(() => {
    if (!loading && products.length > 0 && !error) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, products.length, error]);

  useEffect(() => {
    // Get products and labelType from sessionStorage
    const loadPrintData = () => {
      try {
        console.log('[LabelsPrintPage] Loading print data from localStorage...');
        const storedData = localStorage.getItem('labelsPrintData');
        
        console.log('[LabelsPrintPage] Stored data exists:', !!storedData);
        console.log('[LabelsPrintPage] Stored data length:', storedData?.length || 0);
        
        if (storedData) {
          const printData = JSON.parse(storedData);
          console.log('[LabelsPrintPage] Parsed print data:', {
            productsCount: printData.products?.length || 0,
            labelType: printData.labelType,
            hasProducts: !!printData.products,
            isArray: Array.isArray(printData.products),
          });
          
          if (printData.products && Array.isArray(printData.products)) {
            console.log('[LabelsPrintPage] Setting products:', printData.products.length);
            if (printData.products.length > 0) {
              console.log('[LabelsPrintPage] First product:', printData.products[0]);
            }
            setProducts(printData.products);
          } else {
            console.warn('[LabelsPrintPage] No products array in print data', printData);
            setError('لا توجد منتجات في بيانات الطباعة');
          }
          
          if (printData.labelType && ['A', 'B', 'C', 'D'].includes(printData.labelType)) {
            setLabelType(printData.labelType);
          }
          
          // Set useQuantity option (default to true if not provided for backward compatibility)
          if (typeof printData.useQuantity === 'boolean') {
            setUseQuantity(printData.useQuantity);
          } else {
            setUseQuantity(true); // Default behavior
          }
          
          // Set showZeroQuantity option (default to true if not provided for backward compatibility)
          if (typeof printData.showZeroQuantity === 'boolean') {
            setShowZeroQuantity(printData.showZeroQuantity);
          } else {
            setShowZeroQuantity(true); // Default behavior
          }

          // Set QR behavior (default to true = product URL) — لأنواع أ، ب، ج فقط
          if (typeof printData.useQrProductUrl === 'boolean') {
            setUseQrProductUrl(printData.useQrProductUrl);
          } else {
            setUseQrProductUrl(true);
          }

          // لنوع د: إظهار QR في الكتالوج (افتراضي عدم إظهار)
          if (typeof printData.showQrInCatalog === 'boolean') {
            setShowQrInCatalog(printData.showQrInCatalog);
          } else {
            setShowQrInCatalog(false);
          }
          
          // Clean up localStorage after reading
          localStorage.removeItem('labelsPrintData');
        } else {
          console.log('[LabelsPrintPage] No data in localStorage, trying URL params...');
          // Fallback to URL params for backward compatibility
          const productsParam = searchParams.get('products');
          const typeParam = searchParams.get('type') as LabelType;

          if (productsParam) {
            try {
              const decodedProducts = JSON.parse(decodeURIComponent(productsParam));
              console.log('[LabelsPrintPage] Loaded products from URL:', decodedProducts.length);
              setProducts(decodedProducts);
            } catch (error) {
              console.error('[LabelsPrintPage] Failed to parse products from URL:', error);
              setError('فشل تحميل المنتجات من رابط الطباعة');
            }
          }

          if (typeParam && ['A', 'B', 'C', 'D'].includes(typeParam)) {
            setLabelType(typeParam);
          }
        }
      } catch (error: any) {
        console.error('[LabelsPrintPage] Failed to load print data:', error);
        setError(`فشل تحميل بيانات الطباعة: ${error.message || 'خطأ غير معروف'}`);
      } finally {
        setLoading(false);
      }
    };

    // Small delay to ensure sessionStorage is accessible
    const timer = setTimeout(() => {
      loadPrintData();
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [searchParams]);

  // For Type C, flatten products based on cs_shop quantity or use one per product
  // Also filter out zero quantity products if showZeroQuantity is false
  // Use printQuantity if available (custom quantity set by user), otherwise use cs_shop
  const flattenedProducts = labelType === 'C'
    ? (() => {
        // First, filter products based on showZeroQuantity option
        const filteredProducts = showZeroQuantity
          ? products
          : products.filter((product) => {
              // Use printQuantity if available, otherwise fallback to cs_shop
              const quantity = (product as any).printQuantity !== undefined
                ? (product as any).printQuantity
                : (product.cs_shop || product.CS_Shop || 0);
              return quantity > 0;
            });
        
        // Then flatten based on useQuantity option
        return useQuantity
          ? filteredProducts.flatMap((product) => {
              // Use printQuantity if available (custom quantity), otherwise use cs_shop
              const rawCount = (product as any).printQuantity !== undefined
                ? (product as any).printQuantity
                : (typeof (product as any)?.count === 'number'
                  ? (product as any).count
                  : (product.cs_shop || product.CS_Shop || 0));
              const count = Math.max(1, Math.floor(Number(rawCount) || 0));
              return Array(count).fill(product);
            })
          : filteredProducts; // One label per product regardless of quantity
      })()
    : products;

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Cairo, sans-serif', direction: 'rtl' }}>
        <p>جاري التحميل...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Cairo, sans-serif', direction: 'rtl' }}>
        <p style={{ color: 'red' }}>{error}</p>
        <p style={{ marginTop: '10px', fontSize: '14px' }}>يرجى المحاولة مرة أخرى</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Cairo, sans-serif', direction: 'rtl' }}>
        <p>لا توجد منتجات للطباعة</p>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @media screen {
          body {
            background: #f3f4f6;
          }
        }

        /* Default page size - 100mm x 100mm for Type A, A6 for Type B, A4 for Type C */
        @page {
          size: A6 portrait;
          margin: 0;
        }

        @page type-a {
          size: 100mm 100mm;
          margin: 0;
          padding: 0;
        }

        @page {
          size: 100mm 100mm;
          margin: 0;
        }

        @media print {
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            width: 100% !important;
            height: auto !important;
            font-family: 'Cairo', sans-serif;
            direction: rtl;
          }

          /* Type A: 100mm x 100mm Single Label - Full Page */
          .label-type-a {
            page: type-a;
            width: 100mm !important;
            height: 100mm !important;
            min-width: 100mm !important;
            min-height: 100mm !important;
            max-width: 100mm !important;
            max-height: 100mm !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            break-after: page !important;
            border: 2mm solid #000;
            padding: 2.5mm;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            background: white !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            position: relative !important;
          }

          /* Remove margins from parent containers for Type A */
          body > div {
            margin: 0 !important;
            padding: 0 !important;
            width: auto !important;
            height: auto !important;
            position: relative !important;
          }

          /* Ensure Type A labels start at page edge */
          body > div > div > .label-type-a,
          body > div > .label-type-a {
            margin: 0 !important;
            padding: 2.5mm !important;
          }

          .label-type-a .logo-container {
            display: flex;
            justify-content: flex-start;
            align-items: flex-start;
            margin-bottom: 2mm;
            width: 100%;
            direction: ltr;
            height: 12mm;
          }

          .label-type-a .logo {
            max-width: 40mm;
            max-height: 12mm;
            object-fit: contain;
            display: block;
            filter: grayscale(100%) brightness(0);
          }

          .label-type-a .product-name {
            font-size: 15px;
            font-weight: 700;
            margin-bottom: 2mm;
            text-align: right;
            color: #000;
            width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            line-height: 1.35;
            word-wrap: break-word;
            min-height: 2.7em;
            max-height: 2.7em;
          }

          .label-type-a .shamel-under-name {
            font-size: 9px;
            font-weight: 500;
            color: #666;
            text-align: right;
            direction: ltr;
            margin-top: 0.5mm;
            margin-bottom: 0;
            line-height: 1.1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .label-type-a .product-specs {
            list-style: none;
            font-size: 11px;
            line-height: 1.6;
            text-align: right;
            color: #000;
            margin: 0;
            padding: 0;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
          }

          .label-type-a .product-specs li {
            margin-bottom: 1mm;
            padding-right: 0;
          }

          .label-type-a .product-specs li strong {
            font-weight: 700;
          }

          .label-type-a .bottom-section {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: flex-start;
            margin-top: auto;
            gap: 3mm;
            width: 100%;
            direction: ltr;
            min-height: 32mm;
          }

          .label-type-a .barcode-container {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            flex-shrink: 0;
            width: 32mm;
            min-width: 32mm;
            max-width: 32mm;
            height: 100%;
          }

          .label-type-a .barcode-container img {
            width: 32mm;
            height: 32mm;
            object-fit: contain;
            display: block;
            flex-shrink: 0;
          }

          .label-type-a .barcode-value {
            font-size: 8px;
            text-align: center;
            color: #333;
            margin-top: 1.5mm;
            direction: ltr;
            line-height: 1.1;
            font-weight: 500;
            word-break: break-all;
            max-width: 32mm;
          }

          .label-type-a .product-price {
            font-size: 40px;
            font-weight: 800;
            color: #000;
            text-align: center;
            border: 1.5mm solid #000;
            padding: 3mm;
            flex: 1;
            height: 100%;
            min-height: 32mm;
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            direction: rtl;
          }

          /* Type B: Thermal Roll 60mm x 40mm (one label per page) */
          @page type-b {
            size: 60mm 40mm;
            margin: 0 !important;
          }

          .label-type-b-container {
            width: 60mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            display: block !important;
            page: type-b;
          }

          .label-type-b {
            page: type-b !important;
            width: 60mm !important;
            height: 40mm !important;
            min-width: 60mm !important;
            min-height: 40mm !important;
            max-width: 60mm !important;
            max-height: 40mm !important;
            border: 0;
            padding: 2mm 3mm;
            display: flex !important;
            flex-direction: column;
            justify-content: space-between;
            align-items: stretch;
            gap: 0;
            background: white !important;
            overflow: hidden;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            position: relative;
          }

          .label-type-b .product-name {
            font-size: 13px;
            font-weight: 700;
            text-align: right;
            color: #000;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            line-height: 1.3;
            margin: 0 0 2.5mm 0;
            width: 100%;
            flex-shrink: 0;
            padding-bottom: 1.5mm;
            border-bottom: 0.5mm solid #ddd;
            word-wrap: break-word;
          }

          .label-type-b .content-row {
            display: flex !important;
            flex-direction: row;
            justify-content: space-between;
            align-items: flex-start;
            gap: 3mm;
            width: 100% !important;
            flex: 1;
            flex-shrink: 0;
            min-height: 0;
          }

          .label-type-b .left-section {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            flex-shrink: 0;
            width: auto;
            min-width: 22mm;
            max-width: 22mm;
          }

          .label-type-b .barcode-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
          }

          .label-type-b .barcode-container img {
            max-width: 22mm !important;
            max-height: 22mm !important;
            width: 22mm !important;
            height: 22mm !important;
            object-fit: contain;
            display: block;
          }

          .label-type-b .barcode-value {
            font-size: 8px;
            text-align: center;
            color: #333;
            margin-top: 1mm;
            direction: ltr;
            line-height: 1.1;
            font-weight: 500;
            word-break: break-all;
            max-width: 22mm;
          }

          .label-type-b .right-section {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            justify-content: flex-start;
            flex: 1;
            text-align: right;
            min-width: 0;
            padding-left: 0;
          }

          .label-type-b .product-origin {
            font-size: 11px;
            text-align: right;
            color: #666;
            margin: 0 0 2mm 0;
            width: 100%;
            line-height: 1.3;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .label-type-b .product-price {
            font-size: 28px;
            font-weight: 800;
            text-align: right;
            color: #000;
            margin: 0;
            line-height: 1.1;
            white-space: nowrap;
          }

          /* Type C: Thermal Roll 50mm x 25mm (one label per page) */
          @page type-c {
            size: 50mm 25mm;
            margin: 0;
          }

          .label-type-c-container {
            width: 50mm;
            margin: 0;
            padding: 0;
            background: white;
            display: block;
          }

          .label-type-c {
            page: type-c;
            width: 50mm;
            height: 25mm;
            border: 0;
            padding: 1.5mm 2mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: stretch;
            gap: 2mm;
            background: white;
            overflow: hidden;
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-after: always;
            break-after: page;
          }

          .label-type-c .product-name {
            font-size: 11px;
            font-weight: 700;
            text-align: right;
            color: #000;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            line-height: 1.3;
            margin: 0;
            width: 100%;
            flex-shrink: 0;
          }

          .label-type-c .shamel-under-name {
            font-size: 7px;
            font-weight: 500;
            color: #666;
            text-align: right;
            direction: ltr;
            margin-top: 0.5mm;
            margin-bottom: 0;
            line-height: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .label-type-c .bottom-row {
            width: 100%;
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            gap: 2mm;
            flex-shrink: 0;
          }

          .label-type-c .product-price {
            font-size: 20px;
            font-weight: 800;
            text-align: right;
            color: #000;
            margin: 0;
            flex-shrink: 0;
            white-space: nowrap;
          }

          .label-type-c .barcode-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            width: auto;
            min-width: 12mm;
          }

          .label-type-c .barcode-container img {
            max-width: 12mm;
            max-height: 12mm;
            width: auto;
            height: auto;
            object-fit: contain;
            display: block;
          }

          .label-type-c .barcode-value {
            font-size: 6px;
            text-align: center;
            color: #666;
            margin-top: 0.5mm;
            direction: ltr;
            line-height: 1;
          }

          /* Type D: Catalog - page size = design size (no A4) */
          @page type-d {
            size: 180mm 110mm;
            margin: 0;
          }

          .label-type-d-container {
            width: 180mm;
            margin: 0;
            padding: 0;
            background: #faf9f7;
            display: block;
          }

          .label-type-d {
            page: type-d;
            width: 180mm !important;
            height: 110mm !important;
            min-height: 110mm !important;
            max-height: 110mm !important;
            margin: 0;
            padding: 8mm 10mm;
            background: linear-gradient(180deg, #faf9f7 0%, #f5f3f0 100%);
            box-sizing: border-box;
            page-break-after: always;
            break-after: page;
            display: flex;
            flex-direction: column;
            align-items: stretch;
            font-family: 'Cairo', sans-serif;
            direction: rtl;
            overflow: hidden;
          }

          .label-type-d .catalog-header {
            display: flex;
            justify-content: flex-start;
            align-items: center;
            margin-bottom: 6mm;
            padding-bottom: 5mm;
            border-bottom: 2px solid #2c3e50;
            flex-shrink: 0;
          }

          .label-type-d .catalog-logo {
            max-width: 100px;
            max-height: 32px;
            object-fit: contain;
          }

          .label-type-d .catalog-body {
            display: flex;
            flex-direction: row;
            gap: 6mm;
            flex: 1;
            align-items: stretch;
            min-height: 0;
          }

          .label-type-d .catalog-image-wrap {
            flex-shrink: 0;
            width: 72mm;
            min-height: 72mm;
            max-height: 72mm;
            background: #fff;
            border-radius: 3mm;
            overflow: hidden;
            box-shadow: 0 1mm 3mm rgba(44, 62, 80, 0.08);
            border: 1px solid #e8e6e3;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .label-type-d .catalog-image-wrap img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }

          .label-type-d .catalog-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            min-width: 0;
          }

          .label-type-d .catalog-name {
            font-size: 18px;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 4mm;
            line-height: 1.35;
            text-align: right;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }

          .label-type-d .catalog-specs {
            list-style: none;
            margin: 0;
            padding: 0;
            font-size: 12px;
            line-height: 1.8;
            color: #4a5568;
            text-align: right;
          }

          .label-type-d .catalog-specs li {
            margin-bottom: 2px;
            padding-right: 0;
          }

          .label-type-d .catalog-specs li strong {
            color: #2c3e50;
            font-weight: 600;
          }

          .label-type-d .catalog-price-wrap {
            margin-top: auto;
            padding-top: 4mm;
            border-top: 1px solid #e8e6e3;
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: flex-end;
            gap: 4mm;
            width: 100%;
          }

          .label-type-d .catalog-price {
            font-size: 22px;
            font-weight: 800;
            color: #2c3e50;
            text-align: right;
          }

          .label-type-d .catalog-qr-wrap {
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-end;
          }

          .label-type-d .catalog-qr-wrap img {
            display: block;
          }
        }
      `}</style>

      <div style={{ padding: 0, margin: 0, fontFamily: 'Cairo, sans-serif', direction: 'rtl', width: labelType === 'A' ? '100mm' : labelType === 'D' ? '180mm' : 'auto', height: labelType === 'A' ? '100mm' : 'auto' }}>
        {labelType === 'A' && (
          <>
            {products.map((product, index) => {
              const price = product.SalePrice || product.price || 0;
              const name = product.Name || product.name || '—';
              // Use lowercase field names from database
              const size = product.size || product.Size || '';
              const dimention = product.dimention || product.Dimention || '';
              const warranty = product.warranty || product.Warranty || '';
              const origin = product.origin || product.Origin || '';
              const barcodeOnly = product.barcode || product.Barcode || '';
              const shamelOnly = product.shamel_no || product['Shamel No'] || product.ShamelNo || '';
              const barcodeDisplayValue = barcodeOnly || shamelOnly;
              // QR Code value based on user preference
              const qrCodeValue = getQrCodeValue(product);

              return (
                <div key={`${product.ProductID || product.id || index}-${index}`} className="label-type-a">
                  <div className="logo-container">
                    <img
                      src="/logo.png"
                      alt="Logo"
                      className="logo"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div>
                    <div className="product-name">{name}</div>
                    {shamelOnly && <div className="shamel-under-name">{shamelOnly}</div>}
                  </div>
                  <ul className="product-specs">
                    {dimention && (
                      <li>
                        <strong>الأبعاد:</strong> {dimention}
                      </li>
                    )}
                    {size && (
                      <li>
                        <strong>الحجم:</strong> {size}
                      </li>
                    )}
                    {warranty && (
                      <li>
                        <strong>مدة الكفالة:</strong> {warranty}
                      </li>
                    )}
                    {origin && (
                      <li>
                        <strong>بلد المنشأ:</strong> {origin}
                      </li>
                    )}
                  </ul>
                  <div className="bottom-section">
                    {qrCodeValue && (
                      <div className="barcode-container">
                        <QRCode
                          value={qrCodeValue}
                          size={250}
                          margin={1}
                          color="#000000"
                          backgroundColor="#ffffff"
                        />
                        <div className="barcode-value">{barcodeDisplayValue}</div>
                      </div>
                    )}
                    <div className="product-price">{price.toLocaleString('en-US')} ₪</div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {labelType === 'B' && (
          <div className="label-type-b-container">
            {products.map((product, index) => {
              const price = product.SalePrice || product.price || 0;
              const name = product.Name || product.name || '—';
              const origin = product.origin || product.Origin || '';
              // Barcode: use barcode or shamel_no as fallback (for display only)
              const barcodeOnly = product.barcode || product.Barcode || '';
              const shamelOnly = product.shamel_no || product['Shamel No'] || product.ShamelNo || '';
              const barcodeDisplayValue = barcodeOnly || shamelOnly;
              // QR Code value based on user preference
              const qrCodeValue = getQrCodeValue(product);

              return (
                <div key={`${product.ProductID || product.id || index}-${index}`} className="label-type-b">
                  <div className="product-name">{name}</div>
                  <div className="content-row">
                    {qrCodeValue && (
                      <div className="left-section">
                        <div className="barcode-container">
                          <QRCode
                            value={qrCodeValue}
                            size={200}
                            margin={1}
                            color="#000000"
                            backgroundColor="#ffffff"
                          />
                          <div className="barcode-value">{barcodeDisplayValue}</div>
                        </div>
                      </div>
                    )}
                    <div className="right-section">
                      {origin && (
                        <div className="product-origin">بلد المنشأ: {origin}</div>
                      )}
                      <div className="product-price">{price.toLocaleString('en-US')} ₪</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {labelType === 'C' && (
          <div className="label-type-c-container">
            {flattenedProducts.map((product, index) => {
              const price = product.SalePrice || product.price || 0;
              const name = product.Name || product.name || '—';
              const barcodeOnly = product.barcode || product.Barcode || '';
              const shamelOnly = product['Shamel No'] || product.shamel_no || product.ShamelNo || '';
              const barcodeDisplayValue = barcodeOnly || shamelOnly;
              // QR Code value based on user preference
              const qrCodeValue = getQrCodeValue(product);

              return (
                <div key={`${product.ProductID || product.id || index}-${index}`} className="label-type-c">
                  <div>
                    <div className="product-name">{name}</div>
                    {shamelOnly && <div className="shamel-under-name">{shamelOnly}</div>}
                  </div>
                  <div className="bottom-row">
                    <div className="product-price">{price.toLocaleString('en-US')} ₪</div>
                    {qrCodeValue && (
                      <div className="barcode-container">
                        <QRCode
                          value={qrCodeValue}
                          size={80}
                          margin={0}
                          color="#000000"
                          backgroundColor="#ffffff"
                        />
                        <div className="barcode-value">{barcodeDisplayValue}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {labelType === 'D' && (
          <div className="label-type-d-container">
            {products.map((product, index) => {
              const price = product.SalePrice || product.price || 0;
              const name = product.Name || product.name || '—';
              const size = product.size || product.Size || '';
              const dimention = product.dimention || product.Dimention || '';
              const warranty = product.warranty || product.Warranty || '';
              const origin = product.origin || product.Origin || '';
              const imageUrl = getDirectImageUrl(product.Image || product.image || '');
              const productUrl = getProductUrl(product);

              return (
                <div key={`${product.ProductID || product.id || index}-${index}`} className="label-type-d">
                  <div className="catalog-header">
                    <img
                      src="/logo.png"
                      alt="Logo"
                      className="catalog-logo"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="catalog-body">
                    <div className="catalog-image-wrap">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/logo.png';
                          }}
                        />
                      ) : (
                        <img src="/logo.png" alt="" />
                      )}
                    </div>
                    <div className="catalog-info">
                      <h2 className="catalog-name">{name}</h2>
                      <ul className="catalog-specs">
                        {dimention && (
                          <li><strong>الأبعاد:</strong> {dimention}</li>
                        )}
                        {size && (
                          <li><strong>الحجم:</strong> {size}</li>
                        )}
                        {warranty && (
                          <li><strong>مدة الكفالة:</strong> {warranty}</li>
                        )}
                        {origin && (
                          <li><strong>بلد المنشأ:</strong> {origin}</li>
                        )}
                      </ul>
                      <div className="catalog-price-wrap">
                        <div className="catalog-price">{price.toLocaleString('en-US')} ₪</div>
                        {showQrInCatalog && productUrl ? (
                          <div className="catalog-qr-wrap">
                            <QRCode
                              value={productUrl}
                              size={60}
                              margin={1}
                              color="#2c3e50"
                              backgroundColor="#ffffff"
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default function LabelsPrintPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Cairo, sans-serif', direction: 'rtl' }}>
        <p>جاري التحميل...</p>
      </div>
    }>
      <LabelsPrintContent />
    </Suspense>
  );
}
