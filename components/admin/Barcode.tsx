'use client';

import { useEffect, useRef } from 'react';

interface BarcodeProps {
  value: string;
  format?: 'CODE128' | 'EAN13' | 'EAN8' | 'CODE39' | 'ITF14' | 'MSI' | 'pharmacode' | 'codabar';
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
}

export default function Barcode({
  value,
  format = 'CODE128',
  width = 2,
  height = 50,
  displayValue = true,
  fontSize = 12,
}: BarcodeProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!value || !barcodeRef.current) return;

    // Load JsBarcode if not already loaded
    const loadJsBarcode = () => {
      if ((window as any).JsBarcode) {
        try {
          (window as any).JsBarcode(barcodeRef.current, value, {
            format: format,
            width: width,
            height: height,
            displayValue: displayValue,
            fontSize: fontSize,
            margin: 0,
            background: '#ffffff',
            lineColor: '#000000',
          });
        } catch (error) {
          console.error('[Barcode] Failed to generate barcode:', error);
        }
      } else {
        // Load JsBarcode from CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js';
        script.onload = () => {
          try {
            (window as any).JsBarcode(barcodeRef.current, value, {
              format: format,
              width: width,
              height: height,
              displayValue: displayValue,
              fontSize: fontSize,
              margin: 0,
              background: '#ffffff',
              lineColor: '#000000',
            });
          } catch (error) {
            console.error('[Barcode] Failed to generate barcode:', error);
          }
        };
        script.onerror = () => {
          console.error('[Barcode] Failed to load JsBarcode library');
        };
        document.head.appendChild(script);
      }
    };

    loadJsBarcode();
  }, [value, format, width, height, displayValue, fontSize]);

  if (!value) {
    return null;
  }

  return <svg ref={barcodeRef} style={{ maxWidth: '100%', height: 'auto' }} />;
}
