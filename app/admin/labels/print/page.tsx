'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Product } from '@/types';
import QRCode from '@/components/admin/QRCode';

type LabelType = 'A' | 'B' | 'C';

function LabelsPrintContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [labelType, setLabelType] = useState<LabelType>('A');
  const [useQuantity, setUseQuantity] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          
          if (printData.labelType && ['A', 'B', 'C'].includes(printData.labelType)) {
            setLabelType(printData.labelType);
          }
          
          // Set useQuantity option (default to true if not provided for backward compatibility)
          if (typeof printData.useQuantity === 'boolean') {
            setUseQuantity(printData.useQuantity);
          } else {
            setUseQuantity(true); // Default behavior
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

          if (typeParam && ['A', 'B', 'C'].includes(typeParam)) {
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
  const flattenedProducts = labelType === 'C'
    ? (useQuantity
        ? products.flatMap((product) => {
            const quantity = product.cs_shop || product.CS_Shop || 0;
            const count = Math.max(1, Math.floor(quantity));
            return Array(count).fill(product);
          })
        : products) // One label per product regardless of quantity
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

        /* Default page size - A6 for Type A and B, A4 for Type C */
        @page {
          size: A6 portrait;
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
            height: 100% !important;
            font-family: 'Cairo', sans-serif;
            direction: rtl;
          }

          /* Type A: A6 Single Label - Dynamic sizing */
          .label-type-a {
            width: 100%;
            height: 100vh;
            min-height: 100%;
            page-break-after: always;
            page-break-inside: avoid;
            page-break-before: auto;
            border: 2mm solid #000;
            padding: 5mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: white;
            margin: 0;
            box-sizing: border-box;
            overflow: hidden;
            position: relative;
          }

          /* Fix first page issue */
          .label-type-a:first-of-type {
            page-break-before: auto;
          }

          /* For Type C, use A4 page size */
          .label-type-c-container {
            page-size: A4;
          }

          .label-type-a .logo-container {
            display: flex;
            justify-content: flex-end;
            align-items: flex-start;
            margin-bottom: 3mm;
            width: 100%;
          }

          .label-type-a .logo {
            max-width: 50mm;
            max-height: 20mm;
            object-fit: contain;
            display: block;
          }

          .label-type-a .product-name {
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 4mm;
            text-align: right;
            color: #000;
            width: 100%;
          }

          .label-type-a .bottom-section {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            margin-top: auto;
            gap: 5mm;
            width: 100%;
          }

          .label-type-a .product-price {
            font-size: 36pt;
            font-weight: bold;
            color: #000;
            text-align: right;
            border: 1mm solid #000;
            padding: 4mm;
            flex: 1;
            min-height: 20mm;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .label-type-a .product-specs {
            list-style: none;
            font-size: 11pt;
            line-height: 2;
            text-align: right;
            color: #000;
            margin: 0;
            padding: 0;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }

          .label-type-a .product-specs li {
            margin-bottom: 2mm;
            padding-right: 2mm;
          }

          .label-type-a .product-specs li strong {
            font-weight: bold;
          }

          .label-type-a .barcode-container {
            display: flex;
            justify-content: center;
            align-items: center;
            flex: 1;
            min-height: 20mm;
            max-width: 20mm;
          }

          .label-type-a .barcode-container img {
            width: 20mm;
            height: 20mm;
            object-fit: contain;
            display: block;
          }

          /* Type B: A6 Quad (4 Vertical Sections) - Dynamic sizing */
          .label-type-b-container {
            width: 100%;
            height: 100vh;
            min-height: 100%;
            page-break-after: always;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            gap: 0;
            border: 1mm solid #000;
            margin: 0;
          }

          .label-type-b {
            width: 100%;
            height: 25%;
            flex: 1;
            border-bottom: 1mm dashed #666;
            padding: 3mm;
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: flex-start;
            gap: 2mm;
            background: white;
          }

          .label-type-b:last-child {
            border-bottom: none;
          }

          .label-type-b .text-section {
            display: flex;
            flex-direction: column;
            flex: 1;
            align-items: flex-end;
            justify-content: flex-start;
            text-align: right;
            width: 100%;
          }

          .label-type-b .product-name {
            font-size: 11pt;
            font-weight: bold;
            text-align: right;
            margin-bottom: 1mm;
            color: #000;
            width: 100%;
          }

          .label-type-b .product-origin {
            font-size: 8pt;
            text-align: right;
            color: #666;
            margin-bottom: 1mm;
            width: 100%;
          }

          .label-type-b .barcode-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            flex-shrink: 0;
          }

          .label-type-b .barcode-container img {
            max-width: 100%;
            height: auto;
            max-height: 12mm;
            max-width: 12mm;
          }

          .label-type-b .barcode-value {
            font-size: 7pt;
            text-align: center;
            color: #666;
            margin-top: 0.5mm;
            direction: ltr;
          }

          .label-type-b .product-price {
            font-size: 16pt;
            font-weight: bold;
            text-align: right;
            color: #000;
            margin-top: 0;
            width: 100%;
          }

          /* Type C: A4 Sheet with 70mm x 29.7mm labels */
          @page type-c {
            size: A4;
            margin: 0;
          }

          .label-type-c-container {
            width: 100%;
            min-height: 100vh;
            page-break-after: always;
            display: flex;
            flex-wrap: wrap;
            gap: 0;
            padding: 0;
            margin: 0;
            background: white;
            page: type-c;
          }

          .label-type-c {
            width: 70mm;
            height: 29.7mm;
            border: 0.5mm solid #000;
            padding: 2mm;
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: flex-start;
            gap: 2mm;
            background: white;
            page-break-inside: avoid;
          }

          .label-type-c .text-section {
            display: flex;
            flex-direction: column;
            flex: 1;
            align-items: flex-end;
            justify-content: space-between;
            text-align: right;
            min-width: 0;
            min-height: 100%;
          }

          .label-type-c .product-name {
            font-size: 9pt;
            font-weight: bold;
            text-align: right;
            color: #000;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            line-height: 1.3;
            margin-bottom: auto;
            width: 100%;
            word-wrap: break-word;
          }

          .label-type-c .product-price {
            font-size: 16pt;
            font-weight: bold;
            text-align: right;
            color: #000;
            margin-top: auto;
            width: 100%;
          }

          .label-type-c .barcode-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            flex-shrink: 0;
            flex-grow: 0;
            width: auto;
            min-width: 12mm;
          }

          .label-type-c .barcode-container img {
            max-width: 100%;
            height: auto;
            max-height: 10mm;
            max-width: 10mm;
          }

          .label-type-c .barcode-value {
            font-size: 6pt;
            text-align: center;
            color: #666;
            margin-top: 0.5mm;
            direction: ltr;
          }
        }
      `}</style>

      <div style={{ padding: 0, margin: 0, fontFamily: 'Cairo, sans-serif', direction: 'rtl' }}>
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
              // Barcode: use barcode or shamel_no as fallback
              const barcodeValue = product.barcode || product.Barcode || product.shamel_no || product['Shamel No'] || product.ShamelNo || '';

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
                  <div className="product-name">{name}</div>
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
                        <strong>الكفالة:</strong> {warranty}
                      </li>
                    )}
                    {origin && (
                      <li>
                        <strong>بلد المنشأ:</strong> {origin}
                      </li>
                    )}
                  </ul>
                  <div className="bottom-section">
                    {barcodeValue && (
                      <div className="barcode-container">
                        <QRCode
                          value={barcodeValue}
                          size={200}
                          margin={1}
                          color="#000000"
                          backgroundColor="#ffffff"
                        />
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
          <>
            {Array.from({ length: Math.ceil(products.length / 4) }).map((_, pageIndex) => {
              const pageProducts = products.slice(pageIndex * 4, (pageIndex + 1) * 4);
              const filledProducts = [...pageProducts];
              while (filledProducts.length < 4) {
                filledProducts.push(null as any);
              }

              return (
                <div key={`page-${pageIndex}`} className="label-type-b-container">
                  {filledProducts.map((product, cellIndex) => {
                    if (!product) {
                      return <div key={`empty-${cellIndex}`} className="label-type-b" />;
                    }

                    const price = product.SalePrice || product.price || 0;
                    const name = product.Name || product.name || '—';
                    const origin = product.origin || product.Origin || '';
                    // Barcode: use barcode or shamel_no as fallback
                    const barcodeValue = product.barcode || product.Barcode || product.shamel_no || product['Shamel No'] || product.ShamelNo || '';

                    return (
                      <div key={`${product.ProductID || product.id || cellIndex}-${cellIndex}`} className="label-type-b">
                        <div className="text-section">
                          <div className="product-name">{name}</div>
                          {origin && (
                            <div className="product-origin">
                              بلد المنشأ: {origin}
                            </div>
                          )}
                          <div className="product-price">{price.toLocaleString('en-US')} ₪</div>
                        </div>
                          {barcodeValue && (
                            <div className="barcode-container">
                              <QRCode
                                value={barcodeValue}
                                size={120}
                                margin={1}
                                color="#000000"
                                backgroundColor="#ffffff"
                              />
                              <div className="barcode-value">{barcodeValue}</div>
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </>
        )}

        {labelType === 'C' && (
          <div className="label-type-c-container">
            {flattenedProducts.map((product, index) => {
              const price = product.SalePrice || product.price || 0;
              const name = product.Name || product.name || '—';
              // Barcode: use barcode or shamel_no as fallback
              const barcodeValue = product.barcode || product.Barcode || product.shamel_no || product['Shamel No'] || product.ShamelNo || '';

              return (
                <div key={`${product.ProductID || product.id || index}-${index}`} className="label-type-c">
                  <div className="text-section">
                    <div className="product-name">{name}</div>
                    <div className="product-price">{price.toLocaleString('en-US')} ₪</div>
                  </div>
                  {barcodeValue && (
                    <div className="barcode-container">
                      <QRCode
                        value={barcodeValue}
                        size={100}
                        margin={1}
                        color="#000000"
                        backgroundColor="#ffffff"
                      />
                      <div className="barcode-value">{barcodeValue}</div>
                    </div>
                  )}
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
