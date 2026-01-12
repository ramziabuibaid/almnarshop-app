'use client';

import { useEffect, useRef, useState } from 'react';

interface QRCodeProps {
  value: string;
  size?: number;
  margin?: number;
  color?: string;
  backgroundColor?: string;
}

export default function QRCode({
  value,
  size = 200,
  margin = 1,
  color = '#000000',
  backgroundColor = '#ffffff',
}: QRCodeProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!value) {
      setQrCodeUrl(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);

    // Try to load QRCode library from CDN first
    const loadQRCodeLibrary = () => {
      return new Promise<boolean>((resolve) => {
        if ((window as any).QRCode) {
          resolve(true);
          return;
        }

        // Check if script is already being loaded
        const existingScript = document.querySelector('script[data-qrcode-lib]');
        if (existingScript) {
          existingScript.addEventListener('load', () => resolve(true));
          existingScript.addEventListener('error', () => resolve(false));
          return;
        }

        // Try jsdelivr CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
        script.async = true;
        script.setAttribute('data-qrcode-lib', 'true');
        
        script.onload = () => resolve(true);
        script.onerror = () => {
          // Try unpkg as fallback
          const altScript = document.createElement('script');
          altScript.src = 'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js';
          altScript.async = true;
          altScript.setAttribute('data-qrcode-lib', 'true');
          altScript.onload = () => resolve(true);
          altScript.onerror = () => resolve(false);
          document.head.appendChild(altScript);
        };
        
        document.head.appendChild(script);
      });
    };

    // Try to generate QR code using library
    loadQRCodeLibrary().then((libraryAvailable) => {
      if (libraryAvailable && (window as any).QRCode) {
        try {
          // Generate QR code using library
          const canvas = document.createElement('canvas');
          (window as any).QRCode.toCanvas(canvas, value, {
            width: size,
            margin: margin,
            color: {
              dark: color,
              light: backgroundColor,
            },
            errorCorrectionLevel: 'M',
          }, (error: any) => {
            if (error) {
              console.error('[QRCode] Failed to generate QR code:', error);
              generateQRCodeViaAPI();
            } else {
              setQrCodeUrl(canvas.toDataURL());
              setLoading(false);
            }
          });
        } catch (error) {
          console.error('[QRCode] Error generating QR code:', error);
          generateQRCodeViaAPI();
        }
      } else {
        // Fallback to API
        generateQRCodeViaAPI();
      }
    });

    // Fallback: Use external API to generate QR code
    const generateQRCodeViaAPI = () => {
      try {
        // Use QR Server API (free, no API key needed)
        const encodedValue = encodeURIComponent(value);
        const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedValue}&color=${color.replace('#', '')}&bgcolor=${backgroundColor.replace('#', '')}&margin=${margin}`;
        setQrCodeUrl(apiUrl);
        setLoading(false);
      } catch (error) {
        console.error('[QRCode] Failed to generate QR code via API:', error);
        setError(true);
        setLoading(false);
      }
    };
  }, [value, size, margin, color, backgroundColor]);

  if (!value) {
    return null;
  }

  if (error) {
    return (
      <div style={{ 
        display: 'inline-block', 
        width: size, 
        height: size, 
        border: '1px solid #ccc',
        textAlign: 'center',
        fontSize: '10px',
        padding: '5px',
        backgroundColor: '#f5f5f5'
      }}>
        QR Code<br />Error
      </div>
    );
  }

  if (loading || !qrCodeUrl) {
    return (
      <div style={{ 
        display: 'inline-block', 
        width: size, 
        height: size, 
        border: '1px solid #ccc',
        textAlign: 'center',
        fontSize: '10px',
        padding: '5px',
        backgroundColor: '#f5f5f5'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <img
      src={qrCodeUrl}
      alt="QR Code"
      style={{
        width: size,
        height: size,
        display: 'block',
      }}
      onError={() => {
        setError(true);
        setLoading(false);
      }}
    />
  );
}
