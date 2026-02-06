import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSiteUrl } from '@/lib/siteUrl';

const RSS_TITLE = 'Almnar Shop Catalog';
const GOOGLE_NS = 'http://base.google.com/ns/1.0';

/** Escape string for safe use inside XML text content and attributes */
function escapeXml(text: string): string {
  if (text == null || text === '') return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toAbsoluteImageUrl(imageUrl: string | null | undefined, baseUrl: string): string {
  const url = (imageUrl || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
}

export async function GET() {
  try {
    const baseUrl = getSiteUrl();

    const { data: products, error } = await supabase
      .from('products')
      .select('product_id, name, sale_price, image_url, brand, cs_shop, cs_war, type, is_visible')
      .or('is_visible.eq.true,is_visible.is.null')
      .order('created_at', { ascending: false })
      .range(0, 4999);

    if (error) {
      console.error('[Facebook Feed] Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch products', details: error.message },
        { status: 500 }
      );
    }

    const raw = products ?? null;
    if (raw === null) {
      console.warn('[Facebook Feed] Products data is null, returning empty feed.');
    }

    const items = (raw || []).filter(
      (p) =>
        p?.product_id != null &&
        (p?.name ?? '').trim() !== '' &&
        p?.is_visible !== false
    );

    const channelItems = items.map((p) => {
      const productId = String(p.product_id ?? '');
      const name = (p.name ?? '').trim();
      const brand = (p.brand ?? '').trim() || 'Generic';
      const type = (p.type ?? '').trim();
      const salePrice = Number(p.sale_price);
      const priceFormatted = Number.isFinite(salePrice) ? salePrice.toFixed(2) : '0.00';
      const csShop = Number(p.cs_shop) || 0;
      const csWar = Number(p.cs_war) || 0;
      const availability = csShop + csWar > 0 ? 'in stock' : 'out of stock';
      const productLink = `${baseUrl}/product/${encodeURIComponent(productId)}`;
      const imageLink = toAbsoluteImageUrl(p.image_url, baseUrl);
      const descText = `${name} - Brand: ${brand} - Type: ${type}`;

      return [
        `  <item>`,
        `    <g:id>${escapeXml(productId)}</g:id>`,
        `    <g:title>${escapeXml(name)}</g:title>`,
        `    <g:description>${escapeXml(descText)}</g:description>`,
        `    <g:link>${escapeXml(productLink)}</g:link>`,
        imageLink ? `    <g:image_link>${escapeXml(imageLink)}</g:image_link>` : '',
        `    <g:brand>${escapeXml(brand)}</g:brand>`,
        `    <g:condition>new</g:condition>`,
        `    <g:availability>${availability}</g:availability>`,
        `    <g:price>${escapeXml(priceFormatted)} ILS</g:price>`,
        type ? `    <g:custom_label_0>${escapeXml(type)}</g:custom_label_0>` : '',
        `  </item>`,
      ]
        .filter(Boolean)
        .join('\n');
    });

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<rss version="2.0" xmlns:g="${GOOGLE_NS}">`,
      '  <channel>',
      `    <title>${escapeXml(RSS_TITLE)}</title>`,
      `    <link>${escapeXml(baseUrl)}</link>`,
      `    <description>${escapeXml(RSS_TITLE)} - Product catalog for Meta Commerce Manager</description>`,
      channelItems.join('\n'),
      '  </channel>',
      '</rss>',
    ].join('\n');

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=3600',
      },
    });
  } catch (err: unknown) {
    console.error('[Facebook Feed] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
