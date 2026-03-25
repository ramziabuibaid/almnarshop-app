export default function supabaseLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  const isSupabase = src.includes('supabase.co');
  const isGoogle = src.includes('googleusercontent.com') || src.includes('drive.google.com');

  // For non-supabase and non-google images (e.g. local static images or data URIs), 
  // we just return the original src.
  if (!isSupabase && !isGoogle) {
    return src;
  }

  // Use wsrv.nl as an image optimization caching proxy.
  // This bypasses Vercel's Image Optimization entirely (saving 5k limits),
  // and caches the image globally on Cloudflare (saving Supabase Egress).
  return `https://wsrv.nl/?url=${encodeURIComponent(src)}&w=${width}&q=${quality || 75}&output=webp`;
}
