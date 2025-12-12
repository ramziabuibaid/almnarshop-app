/**
 * Convert Google Drive preview/view URLs to direct image URLs
 * Handles various Google Drive URL formats and converts them to direct image links
 */
export function getDirectImageUrl(url: string | null | undefined): string {
  if (!url || url.trim() === '') {
    return '';
  }

  const trimmedUrl = url.trim();

  // If it's already a direct lh3.googleusercontent.com link, return as is
  if (trimmedUrl.includes('lh3.googleusercontent.com') || trimmedUrl.includes('drive.googleusercontent.com')) {
    return trimmedUrl;
  }

  // If it's already a normal URL (not Google Drive), return as is
  // This includes Supabase Storage URLs and other direct image URLs
  if ((trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) && 
      !trimmedUrl.includes('drive.google.com')) {
    // Supabase Storage URLs or any other direct image URLs
    return trimmedUrl;
  }

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

  // If we found a file ID, convert to direct viewable link
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  // If it's already a full URL but we couldn't extract ID, try to use as-is
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    return trimmedUrl;
  }

  // If all else fails, return empty (component will show placeholder)
  return '';
}

