'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { pageview } from '@/lib/fpixel';

const PIXEL_ID = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;
const FB_SCRIPT = 'https://connect.facebook.net/en_US/fbevents.js';

export default function FacebookPixel() {
  const pathname = usePathname();
  const initialized = useRef(false);

  // Initialize pixel when script loads and fire first pageview
  const handleScriptLoad = () => {
    if (!PIXEL_ID || typeof window === 'undefined' || !window.fbq) return;
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
    initialized.current = true;
  };

  // Fire pageview on every route change (client-side navigation)
  useEffect(() => {
    if (!PIXEL_ID || !initialized.current) return;
    pageview();
  }, [pathname]);

  if (!PIXEL_ID) return null;

  return (
    <>
      <Script
        src={FB_SCRIPT}
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
