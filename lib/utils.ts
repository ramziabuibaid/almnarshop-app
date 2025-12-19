/**
 * Get direct image URL from Supabase Storage or any other source
 * Now primarily handles Supabase Storage URLs (full URLs)
 * Legacy support for Google Drive URLs is kept for backward compatibility
 */
export function getDirectImageUrl(url: string | null | undefined): string {
  if (!url || url.trim() === '') {
    return '';
  }

  const trimmedUrl = url.trim();

  // If it's already a full URL (Supabase Storage or any HTTP/HTTPS URL), return as is
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    // Supabase Storage URLs or any other direct image URLs
    return trimmedUrl;
  }

  // Legacy support: Handle Google Drive URLs (for backward compatibility)
  // Extract File ID from Google Drive URLs
  let fileId: string | null = null;

  // Format 1: https://drive.google.com/file/d/FILE_ID/view or /preview or /edit
  const fileViewMatch = trimmedUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileViewMatch && fileViewMatch[1]) {
    fileId = fileViewMatch[1];
  }
  
  // Format 2: https://drive.google.com/open?id=FILE_ID
  if (!fileId) {
    const openIdMatch = trimmedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (openIdMatch && openIdMatch[1]) {
      fileId = openIdMatch[1];
    }
  }

  // Format 3: https://drive.google.com/uc?id=FILE_ID or /uc?export=view&id=FILE_ID
  if (!fileId) {
    const ucMatch = trimmedUrl.match(/\/uc[?&].*[&?]id=([a-zA-Z0-9_-]+)/);
    if (ucMatch && ucMatch[1]) {
      fileId = ucMatch[1];
    }
  }

  // Format 4: Just a file ID (alphanumeric, dashes, underscores, typically 25+ chars)
  if (!fileId) {
    const idMatch = trimmedUrl.match(/^([a-zA-Z0-9_-]{25,})$/);
    if (idMatch && idMatch[1]) {
      fileId = idMatch[1];
    }
  }

  // If we found a file ID, convert to direct viewable link (legacy support)
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  // If all else fails, return empty (component will show placeholder)
  return '';
}

/**
 * Fix phone number by adding leading zero if missing
 * Excel often removes leading zeros from phone numbers
 * Palestinian phone numbers should start with 0 and be 10 digits (0XXXXXXXXX)
 */
export function fixPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  
  const cleaned = String(phone).trim().replace(/\s+/g, '').replace(/-/g, '');
  
  // If empty after cleaning, return empty
  if (!cleaned) return '';
  
  // If phone starts with country code (970 or 972), remove it and add 0
  if (cleaned.startsWith('970') && cleaned.length >= 12) {
    const local = cleaned.substring(3);
    // If local number doesn't start with 0, add it
    if (!local.startsWith('0') && local.length === 9) {
      return `0${local}`;
    }
    return local.startsWith('0') ? local : `0${local}`;
  }
  if (cleaned.startsWith('972') && cleaned.length >= 12) {
    const local = cleaned.substring(3);
    // If local number doesn't start with 0, add it
    if (!local.startsWith('0') && local.length === 9) {
      return `0${local}`;
    }
    return local.startsWith('0') ? local : `0${local}`;
  }
  
  // If phone doesn't start with 0 and is 9 digits (Excel removed the 0), add 0
  if (!cleaned.startsWith('0') && cleaned.length === 9 && /^\d+$/.test(cleaned)) {
    return `0${cleaned}`;
  }
  
  // If phone already starts with 0 and is 10 digits, return as is
  if (cleaned.startsWith('0') && cleaned.length === 10 && /^\d+$/.test(cleaned)) {
    return cleaned;
  }
  
  // Return cleaned number as is (might be in other format)
  return cleaned;
}

