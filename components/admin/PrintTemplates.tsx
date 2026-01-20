'use client';

import { useMemo, useEffect } from 'react';
import { Product } from '@/types';
import { getDirectImageUrl } from '@/lib/utils';

interface PrintTemplatesProps {
  products: Product[];
  labelType: 'A' | 'B' | 'C';
}

export default function PrintTemplates({ products, labelType }: PrintTemplatesProps) {
  // For Type C, flatten products based on count/quantity
  const flattenedProducts = useMemo(() => {
    if (labelType !== 'C') {
      return products;
    }

    const flattened: Product[] = [];
    products.forEach((product) => {
      const rawCount =
        typeof (product as any)?.count === 'number'
          ? (product as any).count
          : (product.CS_Shop ?? 0);
      // If count is 0 or negative, still print at least 1 label
      const count = Math.max(1, Math.floor(Number(rawCount) || 0));
      for (let i = 0; i < count; i++) {
        flattened.push(product);
      }
    });
    return flattened;
  }, [products, labelType]);

  useEffect(() => {
    // Inject print styles
    const styleId = 'print-labels-styles';
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @media screen {
        .print-labels-container {
          display: none !important;
        }
      }

      @media print {
        @page {
          size: A4;
          margin: 0;
        }

        /* Type C Thermal Roll: 50mm x 25mm per label */
        @page thermal-c {
          size: 50mm 25mm;
          margin: 0;
        }

        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: auto !important;
          overflow: visible !important;
        }

        /* Hide all non-print elements */
        body > *:not(.print-labels-container),
        .no-print,
        nav,
        aside,
        header,
        footer,
        button,
        .sidebar,
        .navbar,
        [class*="AdminLayout"],
        [class*="admin-layout"] {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          width: 0 !important;
          overflow: hidden !important;
        }

        /* Show only print labels container */
        .print-labels-container {
          display: block !important;
          visibility: visible !important;
          font-family: 'Cairo', sans-serif;
          direction: rtl;
          width: 100% !important;
          height: auto !important;
          min-height: 100% !important;
          background: white !important;
          position: static !important;
          left: auto !important;
          top: auto !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        .print-labels-container > * {
          display: block !important;
          visibility: visible !important;
        }

        /* Type A: A6 Single Label */
        .label-type-a {
          width: 105mm !important;
          height: 148mm !important;
          page-break-after: always !important;
          page-break-inside: avoid !important;
          border: 2mm solid #000 !important;
          padding: 5mm !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
          background: white !important;
          margin: 0 !important;
          visibility: visible !important;
          opacity: 1 !important;
        }

        .label-type-a .logo {
          width: 100% !important;
          max-height: 20mm !important;
          object-fit: contain !important;
          margin-bottom: 3mm !important;
          display: block !important;
          visibility: visible !important;
        }

        .label-type-a .product-name {
          font-size: 14pt !important;
          font-weight: bold !important;
          margin-bottom: 2mm !important;
          text-align: right !important;
          color: #000 !important;
          display: block !important;
          visibility: visible !important;
        }

        .label-type-a .product-price {
          font-size: 32pt !important;
          font-weight: bold !important;
          color: #000 !important;
          text-align: center !important;
          margin: 5mm 0 !important;
          border: 1mm solid #000 !important;
          padding: 3mm !important;
          display: block !important;
          visibility: visible !important;
        }

        .label-type-a .product-specs {
          list-style: none !important;
          font-size: 10pt !important;
          line-height: 1.6 !important;
          text-align: right !important;
          color: #000 !important;
          display: block !important;
          visibility: visible !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        .label-type-a .product-specs li {
          margin-bottom: 1mm !important;
          padding-right: 2mm !important;
          display: list-item !important;
          visibility: visible !important;
        }

        .label-type-a .product-specs li strong {
          font-weight: bold !important;
        }

        /* Type B: A6 Quad (2x2 Grid) */
        .label-type-b-container {
          width: 105mm;
          height: 148mm;
          page-break-after: always;
          page-break-inside: avoid;
          display: grid !important;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 0;
          border: 1mm solid #000;
          margin: 0;
        }

        .label-type-b {
          width: 100%;
          height: 100%;
          border: 1mm dashed #666;
          padding: 3mm;
          display: flex !important;
          flex-direction: column;
          justify-content: space-between;
          background: white;
        }

        .label-type-b .product-name {
          font-size: 10pt;
          font-weight: bold;
          text-align: right;
          margin-bottom: 1mm;
          color: #000;
        }

        .label-type-b .product-origin {
          font-size: 8pt;
          text-align: right;
          color: #666;
          margin-bottom: 2mm;
        }

        .label-type-b .product-price {
          font-size: 16pt;
          font-weight: bold;
          text-align: center;
          color: #000;
          border-top: 0.5mm solid #000;
          padding-top: 1mm;
          margin-top: auto;
        }

        /* Type C (Thermal): Single-column, one label per page */
        .label-type-c-container {
          width: 50mm !important;
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          display: block !important;
        }

        .label-type-c {
          page: thermal-c;
          width: 50mm !important;
          height: 25mm !important;
          margin: 0 !important;
          padding: 1.5mm 2mm !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
          align-items: center !important;
          text-align: center !important;
          background: white !important;
          overflow: hidden !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          page-break-after: always !important;
          break-after: page !important;
        }

        .label-type-c .product-name {
          width: 100% !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          color: #000 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          line-height: 1.2 !important;
        }

        .label-type-c .barcode-text {
          width: 100% !important;
          font-size: 9px !important;
          color: #111 !important;
          direction: ltr !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          line-height: 1.1 !important;
        }

        .label-type-c .shop-name {
          width: 100% !important;
          font-size: 9px !important;
          color: #111 !important;
          line-height: 1.1 !important;
        }

        .label-type-c .product-price {
          width: 100% !important;
          font-size: 18px !important;
          font-weight: 800 !important;
          color: #000 !important;
          line-height: 1.1 !important;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  // Debug logging
  useEffect(() => {
    console.log('[PrintTemplates] Render:', {
      productsCount: products.length,
      labelType,
      products: products.slice(0, 2).map(p => ({
        ProductID: p.ProductID,
        id: p.id,
        Name: p.Name || p.name,
        SalePrice: p.SalePrice || p.price,
      })),
    });
  }, [products, labelType]);

  if (products.length === 0) {
    console.log('[PrintTemplates] No products to print');
    return null;
  }

  return (
    <div className="print-labels-container" style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
      {labelType === 'A' && (
        <>
          {products.map((product, index) => {
            const price = product.SalePrice || product.price || 0;
            const name = product.Name || product.name || '—';
            const size = product.Size || '—';
            const dimention = product.Dimention || '—';
            const warranty = product.Warranty || '—';
            const origin = product.Origin || '—';

            return (
              <div key={`${product.ProductID || product.id || index}-${index}`} className="label-type-a">
                <img
                  src="/logo.png"
                  alt="Logo"
                  className="logo"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="product-name">{name}</div>
                <div className="product-price">{price.toLocaleString('en-US')} ₪</div>
                <ul className="product-specs">
                  {size !== '—' && (
                    <li>
                      <strong>الحجم:</strong> {size}
                    </li>
                  )}
                  {dimention !== '—' && (
                    <li>
                      <strong>الأبعاد:</strong> {dimention}
                    </li>
                  )}
                  {warranty !== '—' && (
                    <li>
                      <strong>الضمان:</strong> {warranty}
                    </li>
                  )}
                  {origin !== '—' && (
                    <li>
                      <strong>المنشأ:</strong> {origin}
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </>
      )}

      {labelType === 'B' && (
        <>
          {Array.from({ length: Math.ceil(products.length / 4) }).map((_, pageIndex) => {
            const pageProducts = products.slice(pageIndex * 4, (pageIndex + 1) * 4);
            // Fill empty slots if needed
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
                  const origin = product.Origin || '—';

                  return (
                    <div key={`${product.ProductID || product.id || cellIndex}-${cellIndex}`} className="label-type-b">
                      <div className="product-name">{name}</div>
                      {origin !== '—' && <div className="product-origin">{origin}</div>}
                      <div className="product-price">{price.toLocaleString('en-US')} ₪</div>
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
            const barcodeValue =
              (product as any).barcode ||
              (product as any).Barcode ||
              (product as any).shamel_no ||
              (product as any)['Shamel No'] ||
              (product as any).ShamelNo ||
              '';

            return (
              <div key={`${product.ProductID || product.id || index}-${index}`} className="label-type-c">
                <div className="product-name">{name}</div>
                {barcodeValue ? (
                  <div className="barcode-text">{barcodeValue}</div>
                ) : (
                  <div className="shop-name">MyShop</div>
                )}
                <div className="product-price">{price.toLocaleString('en-US')} ₪</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
