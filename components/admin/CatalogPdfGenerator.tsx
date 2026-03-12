'use client';

import { useState, useRef, useCallback } from 'react';
import { Product } from '@/types';
import { getDirectImageUrl } from '@/lib/utils';

interface CatalogPdfGeneratorProps {
  products: Product[];
  showQrInCatalog?: boolean;
  showPriceInCatalog?: boolean;
  hideCatalogHeader?: boolean;
  onComplete?: () => void;
  onError?: (err: string) => void;
}

// 1mm = 96/25.4 px  (at 96 dpi — browser default)
const MM = 96 / 25.4;

const PAGE_W_MM = 180;
const PAGE_H_MM = 110;
const PAGE_W_PX = Math.round(PAGE_W_MM * MM);
const PAGE_H_PX = Math.round(PAGE_H_MM * MM);

// Padding: 8mm top/bottom, 10mm left/right
const PAD_V = Math.round(8 * MM);
const PAD_H = Math.round(10 * MM);

// Derived content dimensions
const CONTENT_W_PX = PAGE_W_PX - PAD_H * 2;  // 160mm worth
const CONTENT_H_PX = PAGE_H_PX - PAD_V * 2;  // 94mm worth

// Header height ≈ 22mm (logo row + separator gap)
const HEADER_H_PX = Math.round(22 * MM);
// Name+price row ≈ 18mm
const NAME_ROW_H_PX = Math.round(18 * MM);
// Gap between sections: 3mm
const GAP_PX = Math.round(3 * MM);
// Images take the remaining height
const IMG_H_PX = CONTENT_H_PX - HEADER_H_PX - NAME_ROW_H_PX - GAP_PX * 2;
// Each image width: content width ÷ 3 minus two small gaps between them
const IMG_SLOT_W_PX = Math.floor((CONTENT_W_PX - Math.round(3 * MM) * 2) / 3);

export default function CatalogPdfGenerator({
  products,
  showPriceInCatalog = true,
  hideCatalogHeader = false,
  onComplete,
  onError,
}: CatalogPdfGeneratorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const generate = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setProgress(0);

    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [PAGE_W_MM, PAGE_H_MM],
        compress: true,
      });

      const container = containerRef.current;
      if (!container) throw new Error('Container not found');

      const pages = Array.from(container.querySelectorAll('.catalog-pdf-page')) as HTMLElement[];

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        setProgress(Math.round(((i + 0.5) / pages.length) * 100));

        // Wait for all images to fully load
        const imgs = Array.from(page.querySelectorAll('img'));
        await Promise.all(imgs.map(img =>
          img.complete ? Promise.resolve() : new Promise(res => {
            img.onload = res;
            img.onerror = res;
          })
        ));

        const canvas = await html2canvas(page, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#faf9f7',
          logging: false,
          width: PAGE_W_PX,
          height: PAGE_H_PX,
          windowWidth: PAGE_W_PX,
          windowHeight: PAGE_H_PX,
          onclone: async (cloneDoc: Document) => {
            // Strip Tailwind global CSS (contains lab() colors unsupported by html2canvas)
            cloneDoc.querySelectorAll('link[rel="stylesheet"]').forEach(n => n.remove());
            cloneDoc.querySelectorAll('style').forEach(n => n.remove());
            cloneDoc.body.style.cssText = 'margin:0;padding:0;background:#faf9f7;';

            // Inject Cairo font for Arabic text rendering
            const fontLink = cloneDoc.createElement('link');
            fontLink.rel = 'stylesheet';
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap';
            cloneDoc.head.appendChild(fontLink);

            await new Promise<void>(resolve => {
              fontLink.onload = () => resolve();
              fontLink.onerror = () => resolve();
              setTimeout(resolve, 2500);
            });
            try { await cloneDoc.fonts.ready; } catch (_) {}
          },
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.97);
        if (i > 0) pdf.addPage([PAGE_W_MM, PAGE_H_MM], 'landscape');
        pdf.addImage(imgData, 'JPEG', 0, 0, PAGE_W_MM, PAGE_H_MM);
        setProgress(Math.round(((i + 1) / pages.length) * 100));
      }

      // Unique filename: Catalog-YYYY-MM-DD_HH-mm.pdf
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
      const timeStr = now.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Jerusalem',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).replace(':', '-');
      pdf.save(`Catalog-${dateStr}_${timeStr}.pdf`);

      setIsGenerating(false);
      setProgress(0);
      onComplete?.();
    } catch (err: any) {
      console.error('[CatalogPdfGenerator]', err);
      setIsGenerating(false);
      setProgress(0);
      onError?.(err?.message || 'PDF generation failed');
    }
  }, [isGenerating, onComplete, onError]);

  // Expose generate() so the parent page can trigger it
  if (typeof window !== 'undefined') {
    (window as any).__catalogPdfGenerate = generate;
  }

  return (
    <>
      {/* ─── Hidden off-screen render ─── */}
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: `${PAGE_W_PX}px`,
          zIndex: -1,
          pointerEvents: 'none',
        }}
      >
        {products.map((product, index) => {
          const p = product as any;
          const price = p.SalePrice || p.price || 0;
          const name  = p.Name || p.name || '—';
          const size      = p.size      || p.Size      || '';
          const dimention = p.dimention || p.Dimention || '';
          const warranty  = p.warranty  || p.Warranty  || '';
          const origin    = p.origin    || p.Origin    || '';
          const color     = p.color     || p.Color     || '';
          const img1 = getDirectImageUrl(p.Image       || p.image       || '');
          const img2 = getDirectImageUrl(p['Image 2']  || p.image2      || '');
          const img3 = getDirectImageUrl(p['image 3']  || p.image3      || '');
          // Up to 3 images — pad with empty strings if fewer
          const images = [img1, img2, img3];

          const specs = [
            size      ? `الحجم: ${size}`        : null,
            color     ? `اللون: ${color}`        : null,
            warranty  ? `الكفالة: ${warranty}`  : null,
            dimention ? `الأبعاد: ${dimention}` : null,
            origin    ? `المنشأ: ${origin}`      : null,
          ].filter(Boolean) as string[];

          return (
            <div
              key={`${p.ProductID || p.id || index}-${index}`}
              className="catalog-pdf-page"
              style={{
                width:      `${PAGE_W_PX}px`,
                height:     `${PAGE_H_PX}px`,
                padding:    `${PAD_V}px ${PAD_H}px`,
                background: 'linear-gradient(180deg, #faf9f7 0%, #f5f3f0 100%)',
                boxSizing:  'border-box',
                display:    'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                overflow:   'hidden',
                fontFamily: "'Cairo', 'Noto Sans Arabic', Arial, sans-serif",
                direction:  'rtl',
              }}
            >
              {/* ── 1. Header ── */}
              {!hideCatalogHeader && (
                <div style={{
                  display:        'flex',
                  flexDirection:  'row',
                  justifyContent: 'space-between',
                  alignItems:     'center',
                  paddingBottom:  `${Math.round(4 * MM)}px`,
                  marginBottom:   `${Math.round(4 * MM)}px`,
                  borderBottom:   '2px solid #2c3e50',
                  flexShrink:     0,
                  direction:      'rtl',
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo.png"
                    alt="Logo"
                    crossOrigin="anonymous"
                    style={{ maxWidth: '90px', maxHeight: '28px', width: 'auto', height: 'auto', display: 'block' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', direction: 'rtl' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#2c3e50', direction: 'rtl' }}>شركة المنار للأجهزة الكهربائية</div>
                    <div style={{ fontSize: '11px', color: '#4a5568', marginTop: '2px', direction: 'ltr' }}>04-2438815</div>
                  </div>
                </div>
              )}

              {/* ── 2. Name (right) + Price (left) on same row ── */}
              <div style={{
                display:        'flex',
                flexDirection:  'row',
                alignItems:     'center',
                justifyContent: 'space-between',
                marginBottom:   `${GAP_PX}px`,
                flexShrink:     0,
                direction:      'rtl',
                gap:            `${Math.round(4 * MM)}px`,
              }}>
                {/* Product name — right side */}
                <div style={{
                  fontSize:   '16px',
                  fontWeight: 700,
                  color:      '#2c3e50',
                  lineHeight: 1.35,
                  textAlign:  'right',
                  direction:  'rtl',
                  flex:       1,
                  minWidth:   0,
                  wordBreak:  'break-word',
                }}>
                  {name}
                  {/* Specs as subtitle if any exist */}
                  {specs.length > 0 && (
                    <div style={{
                      fontSize:   '11px',
                      fontWeight: 500,
                      color:      '#718096',
                      marginTop:  '4px',
                      lineHeight: 1.6,
                      direction:  'rtl',
                    }}>
                      {specs.join('  ·  ')}
                    </div>
                  )}
                </div>

                {/* Price — left side */}
                {showPriceInCatalog && (
                  <div style={{
                    flexShrink:  0,
                    color:       '#2c3e50',
                    fontSize:    '24px',
                    fontWeight:  800,
                    whiteSpace:  'nowrap',
                    direction:   'ltr',
                  }}>
                    {Number(price).toLocaleString('en-US')} ₪
                  </div>
                )}
              </div>

              {/* ── 3. Images row — 3 equal slots ── */}
              <div style={{
                display:        'flex',
                flexDirection:  'row',
                gap:            `${Math.round(3 * MM)}px`,
                flex:           1,
                alignItems:     'stretch',
                minHeight:      0,
              }}>
                {images.map((url, i) => (
                  <div
                    key={i}
                    style={{
                      flex:           1,
                      background:     '#ffffff',
                      borderRadius:   '6px',
                      border:         '1px solid #e2e0dd',
                      overflow:       'hidden',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      minWidth:       0,
                    }}
                  >
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={`${name} ${i + 1}`}
                        crossOrigin="anonymous"
                        style={{
                          maxWidth:  '100%',
                          maxHeight: '100%',
                          width:     'auto',
                          height:    'auto',
                          display:   'block',
                        }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      /* Empty slot — light placeholder */
                      <div style={{ width: '100%', height: '100%', background: '#f5f3f0' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Progress overlay ─── */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-5 min-w-[280px]">
            <div className="w-14 h-14 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <div className="text-lg font-bold text-gray-800 dark:text-gray-100">جاري توليد ملف PDF</div>
            <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">{progress}% مكتمل</div>
          </div>
        </div>
      )}
    </>
  );
}
