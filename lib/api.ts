// Import Supabase client
import { supabase } from './supabase';

/**
 * Converts Google Drive image links to direct viewable links
 * Handles multiple formats: full URLs, open?id=, file/d/ID, and plain IDs
 */
export function convertDriveImageUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl || imageUrl.trim() === '') {
    return ''; // Return empty string, component will handle fallback
  }

  const trimmedUrl = imageUrl.trim();

  // If it's already a direct Googleusercontent link, return as is
  if (trimmedUrl.includes('lh3.googleusercontent.com') || trimmedUrl.includes('drive.googleusercontent.com')) {
    return trimmedUrl;
  }

  // Extract file ID from various Google Drive URL formats
  let fileId: string | null = null;

  // Format 1: https://drive.google.com/file/d/FILE_ID/view or /edit
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
    // Use uc?export=view format - more reliable for Google Drive images
    // This format works better when folder is set to "Anyone with the link can view"
    const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
    return directUrl;
  }

  // If it's already a full URL but we couldn't extract ID, try to use as-is
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    return trimmedUrl;
  }

  // If all else fails, return empty (component will show placeholder)
  return '';
}

/**
 * Login with username and password
 * Uses Supabase and bcrypt for password verification
 */
export async function login(username: string, password: string): Promise<any> {
  const trimmedUsername = username.trim();
  if (!trimmedUsername) {
    throw new Error('اسم المستخدم مطلوب');
  }

  if (!password) {
    throw new Error('كلمة المرور مطلوبة');
  }

  console.log('[API] Login attempt with username:', trimmedUsername);

  try {
    // Search for customer by username (case-sensitive)
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('username', trimmedUsername)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
      }
      console.error('[API] Login error:', error);
      throw new Error(`فشل تسجيل الدخول: ${error.message}`);
    }

    if (!customer) {
      throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    // Check if customer has login credentials set
    if (!customer.username || !customer.password_hash) {
      throw new Error('لم يتم تحديد بيانات الدخول لهذا العميل. يرجى التواصل مع المسؤول.');
    }

    // Verify password using bcrypt
    const bcrypt = (await import('bcryptjs')).default;
    const passwordMatch = await bcrypt.compare(password, customer.password_hash);

    if (!passwordMatch) {
      throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    // Normalize and map fields
    const normalizedUser = {
      id: customer.customer_id || '',
      email: (customer.email || '').toLowerCase().trim(),
      name: customer.name || '',
      balance: parseFloat(String(customer.balance || 0)) || 0,
      Role: 'Customer' as const,
      phone: customer.phone || '',
      address: customer.address || '',
      type: customer.type || 'Customer',
      username: customer.username,
      ...customer, // Keep all original fields
    };

    console.log('[API] Login success - Normalized user data:', normalizedUser);
    return normalizedUser;
  } catch (error: any) {
    console.error('[API] Login error:', error);
    
    // If error already has a message, use it
    if (error?.message) {
      throw error;
    }
    
    // Generic error
    throw new Error('فشل تسجيل الدخول. يرجى المحاولة مرة أخرى.');
  }
}

/**
 * Get image cache from Supabase (cached in memory for performance)
 */
let imageCacheMap: Map<string, string> | null = null;
let imageCachePromise: Promise<Map<string, string>> | null = null;

/**
 * Clear image cache (useful for debugging or after updating image_cache table)
 */
export function clearImageCache() {
  imageCacheMap = null;
  imageCachePromise = null;
  console.log('[API] Image cache cleared');
}

async function getImageCache(): Promise<Map<string, string>> {
  // Return cached map if available
  if (imageCacheMap) {
    return imageCacheMap;
  }

  // If already fetching, return the existing promise
  if (imageCachePromise) {
    return imageCachePromise;
  }

  // Fetch from Supabase using pagination to get all records
  imageCachePromise = (async () => {
    try {
      console.log('[API] Fetching image cache from Supabase...');
      
      // Fetch all image_cache entries using pagination
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000; // Supabase default limit
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('image_cache')
          .select('file_name, file_id')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) {
          console.error('[API] Error fetching image cache:', error);
          return new Map<string, string>();
        }
        
        if (!data || !Array.isArray(data)) {
          console.warn('[API] No data received from image_cache table or data is not an array');
          hasMore = false;
        } else if (data.length === 0) {
          hasMore = false;
        } else {
          allData = allData.concat(data);
          // If we got less than pageSize, we've reached the end
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        }
      }

      const map = new Map<string, string>();
      if (allData && Array.isArray(allData)) {
        console.log(`[API] Received ${allData.length} rows from image_cache table (across ${page + 1} pages)`);
        let validCount = 0;
        let invalidCount = 0;
        
        allData.forEach((row: any, index: number) => {
          if (row.file_name && row.file_id) {
            // Trim file_name to remove any extra spaces
            const cleanFileName = String(row.file_name).trim();
            const cleanFileId = String(row.file_id).trim();
            
            if (cleanFileName && cleanFileId) {
              map.set(cleanFileName, cleanFileId);
              validCount++;
              
              // Log first few entries for verification
              if (index < 3) {
                console.log(`[API] Cache entry ${index + 1}: "${cleanFileName}" -> ${cleanFileId}`);
              }
            } else {
              invalidCount++;
              if (index < 5) {
                console.warn(`[API] Skipping row ${index + 1} - empty after trim:`, row);
              }
            }
          } else {
            invalidCount++;
            if (index < 5) { // Only log first 5 invalid rows to avoid spam
              console.warn(`[API] Skipping invalid image_cache row ${index + 1}:`, row);
            }
          }
        });
        
        console.log(`[API] Image cache: ${validCount} valid entries, ${invalidCount} invalid entries`);
      } else {
        console.warn('[API] No data received from image_cache table or data is not an array');
      }

      console.log(`[API] Image cache loaded: ${map.size} entries total`);
      // Log sample entries for debugging
      if (map.size > 0) {
        const sampleEntries = Array.from(map.entries()).slice(0, 5);
        console.log('[API] Sample image cache entries:', sampleEntries);
      } else {
        console.error('[API] ⚠️ WARNING: Image cache is empty! Check your image_cache table in Supabase.');
      }
      imageCacheMap = map;
      return map;
    } catch (err: any) {
      console.error('[API] Error loading image cache:', err);
      return new Map<string, string>();
    } finally {
      imageCachePromise = null;
    }
  })();

  return imageCachePromise;
}

/**
 * Convert image path (e.g., "Products_Images/Prd_123456.jpg") to direct Google Drive URL
 * Uses image_cache table to map file names to file IDs
 */
async function convertImagePathToUrl(imagePath: string | null | undefined): Promise<string> {
  if (!imagePath || imagePath.trim() === '') {
    return '';
  }

  const trimmedPath = imagePath.trim();

  // If it's already a direct URL or Google Drive ID, use convertDriveImageUrl
  if (trimmedPath.startsWith('http://') || trimmedPath.startsWith('https://') || 
      trimmedPath.includes('drive.google.com') || trimmedPath.includes('googleusercontent.com')) {
    return convertDriveImageUrl(trimmedPath);
  }

  // Extract file name from path (e.g., "Products_Images/PRD-0017.Image.081721.png" -> "PRD-0017.Image.081721.png")
  const fileName = trimmedPath.split('/').pop() || trimmedPath;
  const cleanFileName = fileName.trim(); // Remove any extra spaces
  
  console.log(`[API] Converting image path: "${trimmedPath}" -> fileName: "${cleanFileName}"`);

  try {
    const imageCache = await getImageCache();
    
    if (imageCache.size === 0) {
      console.warn('[API] Image cache is empty! Check if image_cache table has data.');
      return convertDriveImageUrl(trimmedPath);
    }
    
    // Try exact match first
    let fileId = imageCache.get(cleanFileName);
    
    // If not found, try case-insensitive search
    if (!fileId) {
      console.log(`[API] Exact match not found for "${cleanFileName}", trying case-insensitive search...`);
      for (const [key, value] of imageCache.entries()) {
        if (key.toLowerCase() === cleanFileName.toLowerCase()) {
          fileId = value;
          console.log(`[API] Found image cache match (case-insensitive): "${key}" -> ${fileId}`);
          break;
        }
      }
    }
    
    // Log for debugging
    if (!fileId) {
      console.warn(`[API] Image not found in cache. Looking for: "${cleanFileName}"`);
      console.log(`[API] Cache size: ${imageCache.size}`);
      // Check if similar file names exist
      const similarNames = Array.from(imageCache.keys()).filter(key => 
        key.toLowerCase().includes(cleanFileName.toLowerCase().substring(0, 10)) ||
        cleanFileName.toLowerCase().includes(key.toLowerCase().substring(0, 10))
      );
      if (similarNames.length > 0) {
        console.log(`[API] Similar file names found in cache:`, similarNames.slice(0, 5));
      }
      // Log first few entries for debugging
      const sampleEntries = Array.from(imageCache.entries()).slice(0, 5);
      console.log(`[API] Sample cache entries:`, sampleEntries);
    } else {
      console.log(`[API] ✓ Found image in cache: "${cleanFileName}" -> ${fileId}`);
    }

    if (fileId) {
      // Convert to direct Google Drive image URL (not preview link)
      // Format: https://lh3.googleusercontent.com/d/FILE_ID
      const directUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
      console.log(`[API] Generated image URL: ${directUrl}`);
      return directUrl;
    }

    // If not found in cache, try to use convertDriveImageUrl as fallback
    console.warn(`[API] Image not in cache, using fallback conversion for: ${trimmedPath}`);
    return convertDriveImageUrl(trimmedPath);
  } catch (err) {
    console.error('[API] Error converting image path:', err);
    return convertDriveImageUrl(trimmedPath);
  }
}

/**
 * Map Supabase product (snake_case) to app format (PascalCase)
 * Now uses image_url, image_url_2, image_url_3 from Supabase Storage directly
 */
function mapProductFromSupabase(product: any): any {
  console.log(`[API] Mapping product: ${product.product_id || product.id}`);
  
  // Get image URLs directly from Supabase Storage fields
  // No conversion needed - these are already full URLs from Supabase Storage
  const imageUrl = product.image_url ? product.image_url.trim() : '';
  const image2Url = product.image_url_2 ? product.image_url_2.trim() : '';
  const image3Url = product.image_url_3 ? product.image_url_3.trim() : '';
  
  console.log(`[API] Product ${product.product_id || product.id} - Image URL: "${imageUrl ? imageUrl.substring(0, 80) + '...' : 'No image'}"`);

  return {
    // Keep all original fields first
    ...product,
    
    // Identifiers (override with mapped values)
    ProductID: product.product_id || '',
    'Shamel No': product.shamel_no || '',
    Barcode: product.barcode || '',
    
    // Basic Info (override with mapped values)
    Name: product.name || '',
    Type: product.type || '',
    Brand: product.brand || '',
    Origin: product.origin || '',
    Warranty: product.warranty || '',
    
    // Specs (override with mapped values)
    Size: product.size || '',
    Color: product.color || '',
    Dimention: product.dimention || '',
    
    // Stock (override with mapped values)
    CS_War: parseFloat(String(product.cs_war || 0)) || 0,
    CS_Shop: parseFloat(String(product.cs_shop || 0)) || 0,
    
    // Pricing (override with mapped values)
    CostPrice: parseFloat(String(product.cost_price || 0)) || 0,
    SalePrice: parseFloat(String(product.sale_price || 0)) || 0,
    T1Price: parseFloat(String(product.t1_price || 0)) || 0,
    T2Price: parseFloat(String(product.t2_price || 0)) || 0,
    
    // Images - Use Supabase Storage URLs directly (MUST be after ...product to override)
    Image: imageUrl,
    'Image 2': image2Url,
    'image 3': image3Url,
    image: imageUrl, // Legacy field
    image2: image2Url, // Legacy field
    image3: image3Url, // Legacy field
    
    // Legacy fields (for backward compatibility)
    id: product.product_id || '',
    name: product.name || '',
    price: parseFloat(String(product.sale_price || 0)) || 0,
    type: product.type || '',
    brand: product.brand || '',
    size: product.size || '',
    color: product.color || '',
    description: product.description || '',
  };
}

/**
 * Map Supabase customer (snake_case) to app format (PascalCase)
 */
function mapCustomerFromSupabase(customer: any): any {
  // Format dates from DATE to DD-MM-YYYY if needed
  const formatDateToDDMMYYYY = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return String(dateString || '');
    }
  };

  return {
    // Identifier
    CustomerID: customer.customer_id || '',
    
    // Basic Info
    Name: customer.name || '',
    Email: customer.email || '',
    Phone: customer.phone || '',
    Type: customer.type || '',
    Balance: parseFloat(String(customer.balance || 0)) || 0,
    Address: customer.address || '',
    Photo: customer.photo || '',
    'Shamel No': customer.shamel_no || '',
    ShamelNo: customer.shamel_no || '',
    PostalCode: customer.postal_code || '',
    LastPaymentDate: formatDateToDDMMYYYY(customer.last_pay_date),
    'Last Payment Date': formatDateToDDMMYYYY(customer.last_pay_date),
    LastInvoiceDate: formatDateToDDMMYYYY(customer.last_inv_date),
    'Last Invoice Date': formatDateToDDMMYYYY(customer.last_inv_date),
    
    // Legacy fields (for backward compatibility)
    id: customer.customer_id || '',
    name: customer.name || '',
    email: customer.email || '',
    phone: customer.phone || '',
    type: customer.type || '',
    balance: parseFloat(String(customer.balance || 0)) || 0,
    address: customer.address || '',
    photo: customer.photo || '',
    shamelNo: customer.shamel_no || '',
    postalCode: customer.postal_code || '',
    lastPaymentDate: formatDateToDDMMYYYY(customer.last_pay_date),
    lastInvoiceDate: formatDateToDDMMYYYY(customer.last_inv_date),
    
    // Keep all original fields
    ...customer,
  };
}

/**
 * Get all products from Supabase
 * Maps Supabase snake_case columns to app PascalCase format
 */
export async function getProducts(): Promise<any[]> {
  try {
    console.log('[API] Fetching products from Supabase...');
    const startTime = Date.now();
    
    // Fetch all products from Supabase using pagination to get all records
    let allProducts: any[] = [];
    let page = 0;
    const pageSize = 1000; // Supabase default limit
    let hasMore = true;
    
    while (hasMore) {
      // Fetch products ordered by created_at descending (newest first)
      const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) {
        console.error('[API] Supabase error:', error);
        throw new Error(`Failed to fetch products: ${error.message}`);
      }
      
      if (!products || !Array.isArray(products)) {
        console.error('[API] Invalid products data:', products);
        throw new Error('Invalid response format: No products array found');
      }
      
      if (products.length === 0) {
        hasMore = false;
      } else {
        allProducts = allProducts.concat(products);
        // If we got less than pageSize, we've reached the end
        if (products.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }
    
    // Map snake_case to PascalCase
    const filteredProducts = allProducts.filter((product: any) => {
      // Filter out products without required fields
      const hasId = !!(product.product_id);
      const hasName = !!(product.name);
      return hasId && hasName;
    });
    
    // Map products (synchronous mapping - no longer async)
    const mappedProducts = filteredProducts.map((product: any) => mapProductFromSupabase(product));
    
    const totalTime = Date.now() - startTime;
    console.log(`[API] Products loaded from Supabase: ${mappedProducts.length} in ${totalTime}ms`);
    
    // Log sample products for debugging
    if (mappedProducts.length > 0) {
      const sampleProducts = mappedProducts.slice(0, 3);
      sampleProducts.forEach((p, idx) => {
        console.log(`[API] Sample product ${idx + 1} (${p.id}):`, {
          name: p.name,
          imageUrl: p.image ? p.image.substring(0, 80) : 'No image'
        });
      });
    }
    
    return mappedProducts;
  } catch (error: any) {
    console.error('[API] GetProducts error:', error?.message || error);
    throw error;
  }
}

/**
 * Get customer history (invoices and receipts)
 * Now uses Supabase instead of Google Sheets
 */
export async function getCustomerHistory(customerId: string): Promise<any> {
  try {
    console.log('[API] GetCustomerHistory request from Supabase:', { customerId });

    // Fetch invoices and receipts from Supabase
    // Note: Assuming invoices table has customer_id field
    // If not, we may need to check the schema
    
    // For now, return empty structure as invoices might not have customer_id
    // This depends on your schema design
    const result = {
      invoices: [],
      receipts: [],
      interactions: [],
    };

    console.log('[API] GetCustomerHistory success');
    return result;
  } catch (error: any) {
    console.error('[API] GetCustomerHistory error:', error);
    throw error;
  }
}

/**
 * Submit an order
 * Tries multiple approaches to handle different API response formats
 */
/**
 * Submit an order
 * DEPRECATED: Use submitOnlineOrder instead (which uses Supabase)
 * This function is kept for backward compatibility but throws an error
 */
export async function submitOrder(order: any): Promise<any> {
  console.warn('[API] submitOrder is deprecated. Use submitOnlineOrder instead.');
  throw new Error('submitOrder is deprecated. Please use submitOnlineOrder which uses Supabase.');
}

/**
 * Save or update a product
 * Now uses Supabase directly - images are stored as full URLs from Supabase Storage
 */
export async function saveProduct(productData: any): Promise<any> {
  try {
    console.log('[API] SaveProduct - Preparing Supabase request...');
    console.log('[API] Product data:', JSON.stringify(productData, null, 2));
    
    // Convert PascalCase to snake_case for Supabase
    const supabaseData: any = {
      product_id: productData.ProductID || productData.product_id || null,
      // Explicitly handle empty strings for shamel_no - convert to null to allow clearing
      shamel_no: productData['Shamel No'] !== undefined 
        ? (productData['Shamel No'] === '' ? null : productData['Shamel No'])
        : (productData.shamel_no !== undefined 
          ? (productData.shamel_no === '' ? null : productData.shamel_no)
          : null),
      barcode: productData.Barcode || productData.barcode || null,
      name: productData.Name || productData.name || null,
      type: productData.Type || productData.type || null,
      brand: productData.Brand || productData.brand || null,
      origin: productData.Origin || productData.origin || null,
      warranty: productData.Warranty || productData.warranty || null,
      size: productData.Size || productData.size || null,
      color: productData.Color || productData.color || null,
      dimention: productData.Dimention || productData.dimention || null,
      cs_war: productData.CS_War !== undefined ? productData.CS_War : null,
      cs_shop: productData.CS_Shop !== undefined ? productData.CS_Shop : null,
      cost_price: productData.CostPrice !== undefined ? productData.CostPrice : null,
      sale_price: productData.SalePrice !== undefined ? productData.SalePrice : null,
      t1_price: productData.T1Price !== undefined ? productData.T1Price : null,
      t2_price: productData.T2Price !== undefined ? productData.T2Price : null,
      // Images - store full URLs from Supabase Storage using new fields
      // Use image_url, image_url_2, image_url_3 (new Supabase Storage fields)
      image_url: productData.Image !== undefined ? (productData.Image || null) : (productData.image !== undefined ? (productData.image || null) : (productData.image_url !== undefined ? (productData.image_url || null) : null)),
      image_url_2: productData['Image 2'] !== undefined ? (productData['Image 2'] || null) : (productData.image2 !== undefined ? (productData.image2 || null) : (productData.image_url_2 !== undefined ? (productData.image_url_2 || null) : null)),
      image_url_3: productData['image 3'] !== undefined ? (productData['image 3'] || null) : (productData.image3 !== undefined ? (productData.image3 || null) : (productData.image_url_3 !== undefined ? (productData.image_url_3 || null) : null)),
    };

    // Remove null/undefined/empty string values, but keep null for image fields and shamel_no to allow deletion
    Object.keys(supabaseData).forEach((key) => {
      const isImageField = key === 'image_url' || key === 'image_url_2' || key === 'image_url_3';
      const isShamelNo = key === 'shamel_no';
      // For image fields and shamel_no, keep null/empty values to allow clearing
      // For other fields, remove null/undefined/empty values
      if (!isImageField && !isShamelNo && (supabaseData[key] === null || supabaseData[key] === undefined || supabaseData[key] === '')) {
        delete supabaseData[key];
      } else if (supabaseData[key] === undefined) {
        delete supabaseData[key];
      }
    });

    console.log('[API] Supabase data (snake_case):', JSON.stringify(supabaseData, null, 2));
    console.log('[API] Image fields in supabaseData:', {
      image_url: supabaseData.image_url,
      image_url_2: supabaseData.image_url_2,
      image_url_3: supabaseData.image_url_3,
    });

    // Check if product exists (by product_id)
    const productId = supabaseData.product_id;
    let existingProduct = null;

    if (productId) {
      const { data, error } = await supabase
        .from('products')
        .select('product_id')
        .eq('product_id', productId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('[API] Error checking existing product:', error);
        throw new Error(`Failed to check existing product: ${error.message}`);
      }

      if (data) {
        existingProduct = data;
      }
    }

    let result;
    if (existingProduct) {
      // Update existing product
      console.log('[API] Updating existing product:', productId);
      const { data, error } = await supabase
        .from('products')
        .update(supabaseData)
        .eq('product_id', productId)
        .select()
        .single();

      if (error) {
        console.error('[API] Error updating product:', error);
        throw new Error(`Failed to update product: ${error.message}`);
      }

      result = data;
      console.log('[API] Product updated successfully:', result);
            } else {
      // Insert new product
      console.log('[API] Inserting new product');
      
      // Ensure product_id is set for new products
      if (!supabaseData.product_id) {
        throw new Error('ProductID is required for new products');
      }

      const { data, error } = await supabase
        .from('products')
        .insert(supabaseData)
        .select()
        .single();

      if (error) {
        console.error('[API] Error inserting product:', error);
        throw new Error(`Failed to create product: ${error.message}`);
      }

      result = data;
      console.log('[API] Product created successfully:', result);
    }

    return {
      status: 'success',
      message: existingProduct ? 'Product updated successfully' : 'Product created successfully',
      product: result,
    };
  } catch (error: any) {
    console.error('[API] SaveProduct error:', error);
    console.error('[API] Error name:', error?.name);
    console.error('[API] Error message:', error?.message);
    
    // If error already has a message, use it
    if (error?.message) {
      throw error;
    }
    
    // Generic error
    throw new Error(`Failed to save product: ${error?.message || 'Unknown error'}. Please check the browser console for more details.`);
  }
}

/**
 * Check where a product is used across invoices/orders/quotations
 */
export async function getProductUsage(productId: string): Promise<{
  cashInvoices: string[];
  onlineOrders: string[];
  shopInvoices: string[];
  warehouseInvoices: string[];
  quotations: string[];
}> {
  const usage = {
    cashInvoices: [] as string[],
    onlineOrders: [] as string[],
    shopInvoices: [] as string[],
    warehouseInvoices: [] as string[],
    quotations: [] as string[],
  };

  const queries = [
    {
      key: 'cashInvoices' as const,
      table: 'cash_invoice_details',
      column: 'invoice_id',
    },
    {
      key: 'onlineOrders' as const,
      table: 'online_order_details',
      column: 'order_id',
    },
    {
      key: 'shopInvoices' as const,
      table: 'shop_sales_details',
      column: 'invoice_id',
    },
    {
      key: 'warehouseInvoices' as const,
      table: 'warehouse_sales_details',
      column: 'invoice_id',
    },
    {
      key: 'quotations' as const,
      table: 'quotation_details',
      column: 'quotation_id',
    },
  ];

  for (const q of queries) {
    const { data, error } = await supabase
      .from(q.table)
      .select(`${q.column}`, { count: 'exact', head: false })
      .eq('product_id', productId)
      .limit(50);

    if (error) {
      console.error(`[API] Failed to check product usage in ${q.table}:`, error);
      throw new Error(`Failed to check product usage (${q.table}): ${error.message}`);
    }

    if (data && Array.isArray(data)) {
      const uniqueIds = Array.from(
        new Set(
          data
            .map((row: any) => row[q.column])
            .filter((v: any) => typeof v === 'string' && v.trim() !== '')
        )
      );
      usage[q.key] = uniqueIds;
    }
  }

  return usage;
}

/**
 * Delete a product if it is not referenced elsewhere.
 * If referenced, returns status=blocked and reference ids.
 */
export async function deleteProduct(productId: string): Promise<{
  status: 'deleted' | 'blocked';
  references?: Awaited<ReturnType<typeof getProductUsage>>;
}> {
  if (!productId) {
    throw new Error('ProductID is required for deletion');
  }

  // Check usage before deletion
  const references = await getProductUsage(productId);
  const hasRefs = Object.values(references).some((list) => list.length > 0);

  if (hasRefs) {
    return { status: 'blocked', references };
  }

  const { error } = await supabase.from('products').delete().eq('product_id', productId);
  if (error) {
    console.error('[API] Error deleting product:', error);
    throw new Error(`Failed to delete product: ${error.message}`);
  }

  return { status: 'deleted' };
}

/**
 * Upload an image to Google Drive via Google Apps Script
 * NOTE: This function still uses Google Sheets API for image uploads
 * TODO: Migrate to Supabase Storage
 * @param imageData - Object containing base64 data, filename, and MIME type
 * @returns Promise with the uploaded file name
 */
export async function uploadImage(imageData: {
  data: string; // Base64 string WITHOUT the data URL prefix
  name: string; // Original filename
  type: string; // MIME type (e.g., "image/jpeg")
}): Promise<{ fileName: string }> {
  // TODO: Implement Supabase Storage version
  // For now, this still uses Google Sheets for image uploads
  const API_URL = 'https://script.google.com/macros/s/AKfycbybgr2ZAxRJESgZ1Eeuw2U9oqPm5zLnrVeOO6qr29R3I6fU1hs0xLWGjSNDuISYjiHLag/exec';
  
  try {
    const requestUrl = `${API_URL}?action=uploadImage`;
    console.log('[API] Uploading image:', imageData.name);

    const payload = {
      action: 'uploadImage',
      image: {
        data: imageData.data,
        name: imageData.name,
        type: imageData.type,
      },
    };

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] UploadImage failed:', response.status, errorText.substring(0, 200));
      throw new Error(`Failed to upload image: ${response.status} ${response.statusText}`);
    }

    const rawData = await response.text();
    let data;
    try {
      data = JSON.parse(rawData);
    } catch (parseError) {
      console.error('[API] Invalid JSON response for uploadImage');
      throw new Error('Invalid response format from server');
    }

    if (data.status === 'success' && data.fileName) {
      console.log('[API] UploadImage success:', data.fileName);
      return { fileName: data.fileName };
    } else if (data.error || data.message) {
      const errorMsg = data.error || data.message || 'Failed to upload image';
      console.error('[API] UploadImage error from server:', errorMsg);
      throw new Error(errorMsg);
    } else {
      throw new Error('Invalid response: No fileName returned');
    }
  } catch (error: any) {
    console.error('[API] UploadImage error:', error);
    
    // Handle network errors
    if (error?.name === 'TypeError' && (error?.message?.includes('fetch') || error?.message?.includes('Failed to fetch'))) {
      throw new Error(`Network error: Failed to connect to server. Please check your internet connection.`);
    }
    
    // Handle CORS errors
    if (error?.message && (error.message.includes('CORS') || error.message.includes('cors'))) {
      throw new Error('CORS error. Please check API configuration.');
    }
    
    // If error already has a message, use it
    if (error?.message && error.message !== 'Failed to fetch') {
      throw error;
    }
    
    // Generic error
    throw new Error(`Failed to upload image: ${error?.message || 'Unknown error'}. Please check the browser console for more details.`);
  }
}

/**
 * Get all customers from Supabase
 * Maps Supabase snake_case columns to app PascalCase format
 */
export async function getAllCustomers(): Promise<any[]> {
  try {
    console.log('[API] Fetching all customers from Supabase...');
    const startTime = Date.now();
    
    // Fetch all customers from Supabase using pagination to get all records
    let allCustomers: any[] = [];
    let page = 0;
    const pageSize = 1000; // Supabase default limit
    let hasMore = true;
    
    while (hasMore) {
      // Fetch customers without ordering to avoid column errors
      const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) {
        console.error('[API] Supabase error:', error);
        throw new Error(`Failed to fetch customers: ${error.message}`);
      }
      
      if (!customers || !Array.isArray(customers)) {
        console.error('[API] Invalid customers data:', customers);
        throw new Error('Invalid response format: No customers array found');
      }
      
      if (customers.length === 0) {
        hasMore = false;
      } else {
        allCustomers = allCustomers.concat(customers);
        // If we got less than pageSize, we've reached the end
        if (customers.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }
    
    // Map snake_case to PascalCase
    const mappedCustomers = allCustomers.map((customer: any) => mapCustomerFromSupabase(customer));
    
    const totalTime = Date.now() - startTime;
    console.log(`[API] Customers loaded from Supabase: ${mappedCustomers.length} in ${totalTime}ms`);
    
    // Debug: Log sample customer to see structure
    if (mappedCustomers.length > 0) {
      console.log('[API] Sample customer from Supabase:', mappedCustomers[0]);
      console.log('[API] Sample customer keys:', Object.keys(mappedCustomers[0]));
    }
    
    return mappedCustomers;
  } catch (error: any) {
    console.error('[API] getAllCustomers error:', error?.message || error);
    throw error;
  }
}

/**
 * Save a CRM interaction (call log, visit, note)
 * DEPRECATED: Use logActivity instead (which uses Supabase)
 * This function is kept for backward compatibility
 */
export async function saveInteraction(interactionData: {
  CustomerID: string;
  Channel: string;
  Notes: string;
  PromiseAmount?: number;
  NextFollowUpDate?: string;
  Status: string;
}): Promise<any> {
  // Map to logActivity format and use Supabase
  const actionTypeMapping: Record<string, string> = {
    'Phone': 'Call',
    'WhatsApp': 'WhatsApp',
    'Visit': 'Visit',
    'In Shop': 'Visit',
    'Email': 'Email',
  };
  
  const outcomeMapping: Record<string, string> = {
    'تم اعطاء وقت': 'Promised',
    'لا يوجد رد': 'No Answer',
    'تم الدفع': 'Resolved',
    'Promised to Pay': 'Promised',
    'No Answer': 'No Answer',
    'Resolved': 'Resolved',
  };

  return logActivityToSupabase({
    CustomerID: interactionData.CustomerID,
    ActionType: actionTypeMapping[interactionData.Channel] || interactionData.Channel,
    Outcome: outcomeMapping[interactionData.Status] || interactionData.Status,
    Notes: interactionData.Notes,
    PromiseDate: interactionData.NextFollowUpDate,
    PromiseAmount: interactionData.PromiseAmount,
  });
}


/**
 * Update customer login credentials (username and password)
 * Only accessible by users with accountant permission
 */
export async function updateCustomerLoginCredentials(
  customerId: string,
  username: string,
  password: string
): Promise<void> {
  try {
    console.log('[API] Updating customer login credentials for:', customerId);

    if (!username || username.trim() === '') {
      throw new Error('اسم المستخدم مطلوب');
    }

    if (!password || password.trim() === '') {
      throw new Error('كلمة المرور مطلوبة');
    }

    // Hash password using bcrypt
    const bcrypt = (await import('bcryptjs')).default;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Check if username is already taken by another customer
    const { data: existingCustomer, error: checkError } = await supabase
      .from('customers')
      .select('customer_id, username')
      .eq('username', username.trim())
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is what we want
      throw new Error(`فشل التحقق من اسم المستخدم: ${checkError.message}`);
    }

    if (existingCustomer && existingCustomer.customer_id !== customerId) {
      throw new Error('اسم المستخدم مستخدم بالفعل من قبل عميل آخر');
    }

    // Update customer
    const { error } = await supabase
      .from('customers')
      .update({
        username: username.trim(),
        password_hash: passwordHash,
      })
      .eq('customer_id', customerId);

    if (error) {
      throw new Error(`فشل تحديث بيانات الدخول: ${error.message}`);
    }

    console.log('[API] Customer login credentials updated successfully');
  } catch (error: any) {
    console.error('[API] updateCustomerLoginCredentials error:', error);
    throw error;
  }
}

/**
 * Save or update a customer
 * Now uses Supabase instead of Google Sheets
 */
export async function saveCustomer(customerData: {
  CustomerID?: string;
  Name: string;
  ShamelNo?: string;
  'Shamel No'?: string; // Support both formats
  ShamelNO?: string; // Support ShamelNO (all caps) format
  Phone?: string;
  Email?: string;
  Address?: string;
  Type?: string;
  Notes?: string;
  Balance?: number; // Balance can be edited
  Photo?: string; // Preserve photo
  PostalCode?: string;
  [key: string]: any; // Allow other fields
}): Promise<any> {
  try {
    console.log('[API] Saving customer to Supabase:', customerData);

    // Generate customer ID if not provided
    let customerId = customerData.CustomerID;
    if (!customerId) {
      // Use the generateCustomerID function to ensure consistency
      customerId = await generateCustomerID();
    }

    // Get ShamelNo from various possible field names
    const shamelNo = customerData.ShamelNo || customerData['Shamel No'] || customerData.ShamelNO || '';

    // Prepare data for Supabase (snake_case)
    const customerPayload: any = {
      customer_id: customerId,
      name: customerData.Name || '',
      email: customerData.Email || customerData.email || null,
      phone: customerData.Phone || customerData.phone || null,
      type: customerData.Type || customerData.type || 'Customer',
      balance: customerData.Balance !== undefined ? parseFloat(String(customerData.Balance)) : 0,
      address: customerData.Address || customerData.address || null,
      photo: customerData.Photo || customerData.photo || null,
      shamel_no: shamelNo || null,
      postal_code: customerData.PostalCode || customerData.postalCode || null,
    };

    // Check if customer exists
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('customer_id')
      .eq('customer_id', customerId)
      .single();

    let result;
    if (existingCustomer) {
      // Update existing customer
      // Remove customer_id from payload when updating (don't update primary key)
      const { customer_id, ...updatePayload } = customerPayload;
      
      const { data, error } = await supabase
        .from('customers')
        .update(updatePayload)
        .eq('customer_id', customerId)
        .select()
        .single();

      if (error) {
        console.error('[API] Failed to update customer:', error);
        throw new Error(`Failed to update customer: ${error.message}`);
      }

      result = data;
      console.log('[API] Customer updated successfully');
    } else {
      // Insert new customer
      const { data, error } = await supabase
        .from('customers')
        .insert(customerPayload)
        .select()
        .single();

      if (error) {
        console.error('[API] Failed to insert customer:', error);
        throw new Error(`Failed to save customer: ${error.message}`);
      }

      result = data;
      console.log('[API] Customer created successfully');
    }

    return { status: 'success', data: result };
  } catch (error: any) {
    console.error('[API] saveCustomer error:', error);
    throw error;
  }
}

/**
 * Generate a new customer ID
 * Uses the same approach as invoice IDs: count + 1
 */
export async function generateCustomerID(): Promise<string> {
  try {
    // Get count of existing customers (same approach as invoices)
    const { count, error: countError } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('[API] Failed to get customer count:', countError);
      throw new Error(`Failed to get customer count: ${countError.message}`);
    }
    
    const customerCount = count || 0;
    console.log('[API] Current customer count:', customerCount);
    
    // Generate new customer ID: CUS-XXXX-YYY
    // Format: CUS-XXXX-YYY where XXXX is (count + 1) padded to 4 digits
    const nextRowNumber = customerCount + 1;
    const paddedCount = String(nextRowNumber).padStart(4, '0');
    const randomNumber = Math.floor(Math.random() * (999 - 10 + 1)) + 10; // Random between 10 and 999
    const customerId = `CUS-${paddedCount}-${randomNumber}`;
    
    console.log('[API] Generated customer ID:', customerId, '(next row number:', nextRowNumber, ')');
    return customerId;
  } catch (error: any) {
    console.error('[API] generateCustomerID error:', error);
    throw error;
  }
}

/**
 * Get customer usage across all related tables
 * Returns lists of IDs where the customer is referenced
 */
export async function getCustomerUsage(customerId: string): Promise<{
  shopReceipts: string[];
  shopPayments: string[];
  shopInvoices: string[];
  warehouseInvoices: string[];
  quotations: string[];
  maintenance: string[];
  checks: string[];
}> {
  const usage = {
    shopReceipts: [] as string[],
    shopPayments: [] as string[],
    shopInvoices: [] as string[],
    warehouseInvoices: [] as string[],
    quotations: [] as string[],
    maintenance: [] as string[],
    checks: [] as string[],
  };

  const queries = [
    {
      key: 'shopReceipts' as const,
      table: 'shop_receipts',
      column: 'receipt_id',
    },
    {
      key: 'shopPayments' as const,
      table: 'shop_payments',
      column: 'pay_id',
    },
    {
      key: 'shopInvoices' as const,
      table: 'shop_sales_invoices',
      column: 'invoice_id',
    },
    {
      key: 'warehouseInvoices' as const,
      table: 'warehouse_sales_invoices',
      column: 'invoice_id',
    },
    {
      key: 'quotations' as const,
      table: 'quotations',
      column: 'quotation_id',
    },
    {
      key: 'maintenance' as const,
      table: 'maintenance',
      column: 'maint_no',
    },
    {
      key: 'checks' as const,
      table: 'checks',
      column: 'check_id',
    },
  ];

  for (const q of queries) {
    const { data, error } = await supabase
      .from(q.table)
      .select(`${q.column}`, { count: 'exact', head: false })
      .eq('customer_id', customerId)
      .limit(50);

    if (error) {
      console.error(`[API] Failed to check customer usage in ${q.table}:`, error);
      throw new Error(`Failed to check customer usage (${q.table}): ${error.message}`);
    }

    if (data && Array.isArray(data)) {
      const uniqueIds = Array.from(
        new Set(
          data
            .map((row: any) => row[q.column])
            .filter((v: any) => typeof v === 'string' && v.trim() !== '')
        )
      );
      usage[q.key] = uniqueIds;
    }
  }

  return usage;
}

/**
 * Delete a customer from Supabase
 * Checks for usage in related tables before deletion
 */
export async function deleteCustomer(customerID: string): Promise<{
  status: 'deleted' | 'blocked';
  references?: Awaited<ReturnType<typeof getCustomerUsage>>;
}> {
  if (!customerID) {
    throw new Error('CustomerID is required for deletion');
  }

  // Check usage before deletion
  const references = await getCustomerUsage(customerID);
  const hasRefs = Object.values(references).some((list) => list.length > 0);

  if (hasRefs) {
    return { status: 'blocked', references };
  }

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('customer_id', customerID);

  if (error) {
    console.error('[API] Error deleting customer:', error);
    throw new Error(`Failed to delete customer: ${error.message}`);
  }

  console.log('[API] Customer deleted successfully');
  return { status: 'deleted' };
}

// ==========================================
// CHECKS (Returned Cheques)
// ==========================================

export const CHECK_STATUS_VALUES = [
  'مع الشركة',
  'في البنك',
  'في المحل',
  'سلم للزبون ولد يدفع',
  'سلم للزبون وتم تسديد القيمة',
] as const;

export type CheckStatus = typeof CHECK_STATUS_VALUES[number];

function generateCheckID(existingCount: number): string {
  const padded = String(existingCount + 1).padStart(4, '0');
  const rand = Math.floor(Math.random() * (999 - 10 + 1)) + 10; // 10-999
  return `Chec-${padded}-${rand}`;
}

export async function saveCheck(payload: {
  customerID: string;
  amount: number;
  imageFront?: string | null;
  imageBack?: string | null;
  returnDate?: string | null; // YYYY-MM-DD
  status: CheckStatus;
  notes?: string | null;
}): Promise<any> {
  try {
    if (!payload.customerID) throw new Error('CustomerID is required');
    if (!CHECK_STATUS_VALUES.includes(payload.status)) {
      throw new Error('Invalid status value');
    }

    // Get count to generate ID
    const { count, error: countError } = await supabase
      .from('checks')
      .select('*', { count: 'exact', head: true });
    if (countError) {
      console.error('[API] saveCheck count error:', countError);
      throw new Error('Failed to generate CheckID');
    }
    const checkID = generateCheckID(count || 0);

    const { data, error } = await supabase
      .from('checks')
      .insert([
        {
          check_id: checkID,
          customer_id: payload.customerID,
          amount: payload.amount ?? 0,
          image_front: payload.imageFront || null,
          image_back: payload.imageBack || null,
          return_date: payload.returnDate || null,
          status: payload.status,
          notes: payload.notes || null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('[API] saveCheck insert error:', error);
      throw new Error(`Failed to save check: ${error.message}`);
    }

    return data;
  } catch (error: any) {
    console.error('[API] saveCheck error:', error);
    throw error;
  }
}

export async function getCustomerChecks(customerId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('checks')
      .select('*, customers(name, phone, balance)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API] getCustomerChecks error:', error);
      throw new Error(`Failed to load checks: ${error.message}`);
    }

    return data || [];
  } catch (error: any) {
    console.error('[API] getCustomerChecks catch error:', error);
    throw error;
  }
}

export async function getChecks(params?: {
  status?: CheckStatus | '';
  search?: string;
}): Promise<any[]> {
  try {
    let query = supabase
      .from('checks')
      .select('*, customers(name, phone, balance)')
      .order('created_at', { ascending: false });

    if (params?.status) {
      query = query.eq('status', params.status);
    }

    if (params?.search?.trim()) {
      const q = params.search.trim();
      query = query.or(`check_id.ilike.%${q}%,notes.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[API] getChecks error:', error);
      throw new Error(`Failed to load checks: ${error.message}`);
    }

    return data || [];
  } catch (error: any) {
    console.error('[API] getChecks catch error:', error);
    throw error;
  }
}

export async function updateCheckStatus(checkId: string, status: CheckStatus): Promise<void> {
  try {
    if (!CHECK_STATUS_VALUES.includes(status)) {
      throw new Error('Invalid status value');
    }

    const { error } = await supabase
      .from('checks')
      .update({ status })
      .eq('check_id', checkId);

    if (error) {
      console.error('[API] updateCheckStatus error:', error);
      throw new Error(`Failed to update check status: ${error.message}`);
    }
  } catch (error: any) {
    console.error('[API] updateCheckStatus catch error:', error);
    throw error;
  }
}

export async function updateCheck(checkId: string, payload: {
  customerID?: string;
  amount?: number;
  imageFront?: string | null;
  imageBack?: string | null;
  returnDate?: string | null;
  status?: CheckStatus;
  notes?: string | null;
}): Promise<void> {
  try {
    const updates: any = {};
    if (payload.customerID !== undefined) updates.customer_id = payload.customerID;
    if (payload.amount !== undefined) updates.amount = payload.amount;
    if (payload.imageFront !== undefined) updates.image_front = payload.imageFront;
    if (payload.imageBack !== undefined) updates.image_back = payload.imageBack;
    if (payload.returnDate !== undefined) updates.return_date = payload.returnDate;
    if (payload.status !== undefined) {
      if (!CHECK_STATUS_VALUES.includes(payload.status)) {
        throw new Error('Invalid status value');
      }
      updates.status = payload.status;
    }
    if (payload.notes !== undefined) updates.notes = payload.notes;

    const { error } = await supabase
      .from('checks')
      .update(updates)
      .eq('check_id', checkId);

    if (error) {
      console.error('[API] updateCheck error:', error);
      throw new Error(`Failed to update check: ${error.message}`);
    }
  } catch (error: any) {
    console.error('[API] updateCheck catch error:', error);
    throw error;
  }
}

export async function deleteCheck(checkId: string): Promise<void> {
  try {
    const { error } = await supabase.from('checks').delete().eq('check_id', checkId);
    if (error) {
      console.error('[API] deleteCheck error:', error);
      throw new Error(`Failed to delete check: ${error.message}`);
    }
  } catch (error: any) {
    console.error('[API] deleteCheck catch error:', error);
    throw error;
  }
}

function safeUUID(): string {
  const g = globalThis as any;
  if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
  if (g?.crypto?.getRandomValues) {
    const buf = new Uint8Array(16);
    g.crypto.getRandomValues(buf);
    // Set version and variant bits (RFC 4122 v4)
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    const b = Array.from(buf, toHex).join('');
    return `${b.substr(0, 8)}-${b.substr(8, 4)}-${b.substr(12, 4)}-${b.substr(16, 4)}-${b.substr(20)}`;
  }
  // Fallback (non-crypto)
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

export async function uploadCheckImage(file: File): Promise<string> {
  try {
    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `checks/${safeUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('checks').upload(filePath, file, {
      upsert: false,
      cacheControl: '3600',
    });
    if (uploadError) {
      console.error('[API] uploadCheckImage error:', uploadError);
      throw new Error(`فشل رفع الصورة: ${uploadError.message}`);
    }
    const { data } = supabase.storage.from('checks').getPublicUrl(filePath);
    if (!data?.publicUrl) {
      throw new Error('تعذر الحصول على رابط الصورة بعد الرفع');
    }
    return data.publicUrl;
  } catch (error: any) {
    console.error('[API] uploadCheckImage catch error:', error);
    throw error;
  }
}

/**
 * Get dashboard data (follow-ups)
 * Now uses Supabase instead of Google Sheets
 * Returns: { overdue: [], today: [], upcoming: [] }
 */
export async function getDashboardData(): Promise<any> {
  try {
    console.log('[API] Fetching dashboard data from Supabase...');
    const startTime = Date.now();

    // Get CRM data from Supabase
    const crmData = await getCRMDataFromSupabase();
    const promises = crmData.promises || [];

    // Categorize promises by date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const overdue: any[] = promises
      .filter((p: any) => {
        if (!p.PromiseDate) return false;
        const promiseDate = new Date(p.PromiseDate);
        promiseDate.setHours(0, 0, 0, 0);
        return promiseDate < today;
      })
      .map((p: any) => ({
        ...p,
        Type: 'Overdue' as const,
        NextDate: p.PromiseDate || '',
      }));

    const todayTasks: any[] = promises
      .filter((p: any) => {
        if (!p.PromiseDate) return false;
        const promiseDate = new Date(p.PromiseDate);
        promiseDate.setHours(0, 0, 0, 0);
        return promiseDate.getTime() === today.getTime();
      })
      .map((p: any) => ({
        ...p,
        Type: 'Today' as const,
        NextDate: p.PromiseDate || '',
      }));

    const upcoming: any[] = promises
      .filter((p: any) => {
        if (!p.PromiseDate) return false;
        const promiseDate = new Date(p.PromiseDate);
        promiseDate.setHours(0, 0, 0, 0);
        return promiseDate >= tomorrow;
      })
      .map((p: any) => ({
        ...p,
        Type: 'Upcoming' as const,
        NextDate: p.PromiseDate || '',
      }));

    const fetchTime = Date.now() - startTime;
    console.log(`[API] Dashboard data loaded from Supabase: ${fetchTime}ms`);
    console.log('[API] Data structure:', {
      overdueCount: overdue.length,
      todayCount: todayTasks.length,
      upcomingCount: upcoming.length,
    });

    return {
      overdue,
      today: todayTasks,
      upcoming,
    };
  } catch (error: any) {
    console.error('[API] getDashboardData error:', error);
    throw error;
  }
}

/**
 * Get customer data (invoices, receipts, interactions)
 * Action: getCustomerData
 * Returns: { invoices: [], receipts: [], interactions: [] }
 */
export async function getCustomerData(customerId: string | number): Promise<any> {
  try {
    // Convert ID to string explicitly to handle number vs string issues
    const idString = String(customerId || '').trim();
    
    if (!idString || idString === '') {
      throw new Error('Customer ID is required');
    }
    
    console.log('[API] Fetching customer data for ID:', idString);
    console.log('[API] ID type:', typeof customerId, 'converted to:', typeof idString);
    const startTime = Date.now();
    
    console.log('[API] Fetching customer data from Supabase for ID:', idString);

    // Fetch customer CRM activities (interactions)
    const { data: activities, error: activitiesError } = await supabase
      .from('crm_activities')
      .select('*')
      .eq('customer_id', idString)
      .order('created_at', { ascending: false });

    if (activitiesError) {
      console.error('[API] Failed to fetch activities:', activitiesError);
    }

    // Map activities to interactions format
    const interactions = (activities || []).map((activity: any) => ({
      InteractionID: activity.activity_id,
      CustomerID: activity.customer_id,
      Channel: activity.action_type || 'Call',
      Notes: activity.notes || '',
      Status: activity.outcome || '',
      PromiseAmount: parseFloat(String(activity.promise_amount || 0)) || 0,
      NextFollowUpDate: activity.promise_date || '',
      PromiseDate: activity.promise_date || '',
      PTPStatus: activity.ptp_status || '',
      ptpStatus: activity.ptp_status || '',
      CreatedAt: activity.created_at || '',
      ...activity, // Include all original fields
    }));

    // Fetch shop sales invoices for this customer
    const { data: shopInvoices, error: invoicesError } = await supabase
      .from('shop_sales_invoices')
      .select('*, shop_sales_details(*)')
      .eq('customer_id', idString)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (invoicesError) {
      console.error('[API] Failed to fetch shop invoices:', invoicesError);
    }

    // Collect all product IDs from shop and warehouse invoice details
    const allProductIds = new Set<string>();
    (shopInvoices || []).forEach((invoice: any) => {
      (invoice.shop_sales_details || []).forEach((detail: any) => {
        if (detail.product_id) {
          allProductIds.add(detail.product_id);
        }
      });
    });

    // Fetch warehouse sales invoices for this customer
    const { data: warehouseInvoices, error: warehouseInvoicesError } = await supabase
      .from('warehouse_sales_invoices')
      .select('*, warehouse_sales_details(*)')
      .eq('customer_id', idString)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (warehouseInvoicesError) {
      console.error('[API] Failed to fetch warehouse invoices:', warehouseInvoicesError);
    }

    // Collect product IDs from warehouse invoices
    (warehouseInvoices || []).forEach((invoice: any) => {
      (invoice.warehouse_sales_details || []).forEach((detail: any) => {
        if (detail.product_id) {
          allProductIds.add(detail.product_id);
        }
      });
    });

    // Fetch product information for all product IDs
    let productsMap = new Map<string, any>();
    if (allProductIds.size > 0) {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('product_id, name, barcode, shamel_no')
        .in('product_id', Array.from(allProductIds));

      if (productsError) {
        console.error('[API] Failed to fetch products:', productsError);
      } else if (products) {
        products.forEach((product: any) => {
          productsMap.set(product.product_id, product);
        });
      }
    }

    // Map shop invoices with product names
    const mappedInvoices = (shopInvoices || []).map((invoice: any) => {
      // Calculate total from details
      const subtotal = (invoice.shop_sales_details || []).reduce((sum: number, detail: any) => {
        return sum + (parseFloat(String(detail.quantity || 0)) * parseFloat(String(detail.unit_price || 0)));
      }, 0);
      const discount = parseFloat(String(invoice.discount || 0));
      const total = subtotal - discount;

      // Map invoice details with product names
      const mappedItems = (invoice.shop_sales_details || []).map((detail: any) => {
        const product = productsMap.get(detail.product_id);
        return {
          ...detail,
          product_id: detail.product_id,
          product_name: product?.name || '',
          Name: product?.name || '',
          name: product?.name || '',
          quantity: detail.quantity,
          Quantity: detail.quantity,
          unit_price: detail.unit_price,
          Price: detail.unit_price,
          price: detail.unit_price,
        };
      });

      return {
        InvoiceID: invoice.invoice_id,
        CustomerID: invoice.customer_id,
        Date: invoice.date,
        InvoiceDate: invoice.date,
        InvoiceNumber: invoice.invoice_id,
        Total: total,
        Amount: total,
        Type: 'shop_invoice',
        Source: 'Shop',
        Status: invoice.status,
        AccountantSign: invoice.accountant_sign,
        Notes: invoice.notes || '',
        Items: mappedItems,
        CreatedAt: invoice.created_at,
      };
    });

    // Map warehouse invoices with product names
    const mappedWarehouseInvoices = (warehouseInvoices || []).map((invoice: any) => {
      // Calculate total from details
      const subtotal = (invoice.warehouse_sales_details || []).reduce((sum: number, detail: any) => {
        return sum + (parseFloat(String(detail.quantity || 0)) * parseFloat(String(detail.unit_price || 0)));
      }, 0);
      const discount = parseFloat(String(invoice.discount || 0));
      const total = subtotal - discount;

      // Map invoice details with product names
      const mappedItems = (invoice.warehouse_sales_details || []).map((detail: any) => {
        const product = productsMap.get(detail.product_id);
        return {
          ...detail,
          product_id: detail.product_id,
          product_name: product?.name || '',
          Name: product?.name || '',
          name: product?.name || '',
          quantity: detail.quantity,
          Quantity: detail.quantity,
          unit_price: detail.unit_price,
          Price: detail.unit_price,
          price: detail.unit_price,
        };
      });

      return {
        InvoiceID: invoice.invoice_id,
        CustomerID: invoice.customer_id,
        Date: invoice.date,
        InvoiceDate: invoice.date,
        InvoiceNumber: invoice.invoice_id,
        Total: total,
        Amount: total,
        Type: 'warehouse_invoice',
        Source: 'Warehouse',
        Status: invoice.status,
        AccountantSign: invoice.accountant_sign,
        Notes: invoice.notes || '',
        Items: mappedItems,
        CreatedAt: invoice.created_at,
      };
    });

    // Fetch shop receipts for this customer
    const { data: shopReceipts, error: receiptsError } = await supabase
      .from('shop_receipts')
      .select('*')
      .eq('customer_id', idString)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (receiptsError) {
      console.error('[API] Failed to fetch shop receipts:', receiptsError);
    }

    // Map shop receipts
    const mappedReceipts = (shopReceipts || []).map((receipt: any) => {
      const cashAmount = parseFloat(String(receipt.cash_amount || 0));
      const chequeAmount = parseFloat(String(receipt.cheque_amount || 0));
      const total = cashAmount + chequeAmount;

      return {
        ReceiptID: receipt.receipt_id,
        CustomerID: receipt.customer_id,
        Date: receipt.date,
        ReceiptDate: receipt.date,
        ReceiptNumber: receipt.receipt_id,
        Amount: total,
        Total: total,
        Type: 'shop_receipt',
        Source: 'Shop',
        CashAmount: cashAmount,
        ChequeAmount: chequeAmount,
        Notes: receipt.notes || '',
        CreatedAt: receipt.created_at,
      };
    });

    // Fetch shop payments for this customer
    const { data: shopPayments, error: paymentsError } = await supabase
      .from('shop_payments')
      .select('*')
      .eq('customer_id', idString)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (paymentsError) {
      console.error('[API] Failed to fetch shop payments:', paymentsError);
    }

    // Map shop payments
    const mappedPayments = (shopPayments || []).map((payment: any) => {
      const cashAmount = parseFloat(String(payment.cash_amount || 0));
      const chequeAmount = parseFloat(String(payment.cheque_amount || 0));
      const total = cashAmount + chequeAmount;

      return {
        PaymentID: payment.pay_id,
        CustomerID: payment.customer_id,
        Date: payment.date,
        PaymentDate: payment.date,
        PaymentNumber: payment.pay_id,
        Amount: total,
        Total: total,
        Type: 'shop_payment',
        Source: 'Shop',
        CashAmount: cashAmount,
        ChequeAmount: chequeAmount,
        Notes: payment.notes || '',
        CreatedAt: payment.created_at,
      };
    });

    // Fetch warehouse receipts for this customer
    const { data: warehouseReceipts, error: warehouseReceiptsError } = await supabase
      .from('warehouse_receipts')
      .select('*')
      .eq('customer_id', idString)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (warehouseReceiptsError) {
      console.error('[API] Failed to fetch warehouse receipts:', warehouseReceiptsError);
    }

    // Map warehouse receipts
    const mappedWarehouseReceipts = (warehouseReceipts || []).map((receipt: any) => {
      const cashAmount = parseFloat(String(receipt.cash_amount || 0));
      const chequeAmount = parseFloat(String(receipt.check_amount || 0));
      const total = cashAmount + chequeAmount;

      return {
        ReceiptID: receipt.receipt_id,
        CustomerID: receipt.customer_id,
        Date: receipt.date,
        ReceiptDate: receipt.date,
        ReceiptNumber: receipt.receipt_id,
        Amount: total,
        Total: total,
        Type: 'warehouse_receipt',
        Source: 'Warehouse',
        CashAmount: cashAmount,
        ChequeAmount: chequeAmount,
        Notes: receipt.notes || '',
        CreatedAt: receipt.created_at,
      };
    });

    // Fetch warehouse payments for this customer
    const { data: warehousePayments, error: warehousePaymentsError } = await supabase
      .from('warehouse_payments')
      .select('*')
      .eq('customer_id', idString)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (warehousePaymentsError) {
      console.error('[API] Failed to fetch warehouse payments:', warehousePaymentsError);
    }

    // Map warehouse payments
    const mappedWarehousePayments = (warehousePayments || []).map((payment: any) => {
      const cashAmount = parseFloat(String(payment.cash_amount || 0));
      const chequeAmount = parseFloat(String(payment.check_amount || 0));
      const total = cashAmount + chequeAmount;

      return {
        PaymentID: payment.payment_id,
        CustomerID: payment.customer_id,
        Date: payment.date,
        PaymentDate: payment.date,
        PaymentNumber: payment.payment_id,
        Amount: total,
        Total: total,
        Type: 'warehouse_payment',
        Source: 'Warehouse',
        CashAmount: cashAmount,
        ChequeAmount: chequeAmount,
        Notes: payment.notes || '',
        CreatedAt: payment.created_at,
      };
    });

    // Fetch quotations for this customer
    const { data: quotations, error: quotationsError } = await supabase
      .from('quotations')
      .select('*, quotation_details(*)')
      .eq('customer_id', idString)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (quotationsError) {
      console.error('[API] Failed to fetch quotations:', quotationsError);
    }

    // Collect product IDs from quotations
    (quotations || []).forEach((quotation: any) => {
      (quotation.quotation_details || []).forEach((detail: any) => {
        if (detail.product_id) {
          allProductIds.add(detail.product_id);
        }
      });
    });

    // Fetch product information for quotation products if not already fetched
    if (quotations && quotations.length > 0 && allProductIds.size > 0) {
      const { data: quotationProducts, error: quotationProductsError } = await supabase
        .from('products')
        .select('product_id, name, barcode, shamel_no')
        .in('product_id', Array.from(allProductIds));

      if (!quotationProductsError && quotationProducts) {
        quotationProducts.forEach((product: any) => {
          if (!productsMap.has(product.product_id)) {
            productsMap.set(product.product_id, product);
          }
        });
      }
    }

    // Map quotations with product names
    const mappedQuotations = (quotations || []).map((quotation: any) => {
      const subtotal = (quotation.quotation_details || []).reduce((sum: number, detail: any) => {
        return sum + (parseFloat(String(detail.quantity || 0)) * parseFloat(String(detail.unit_price || 0)));
      }, 0);
      const specialDiscount = parseFloat(String(quotation.special_discount_amount || 0));
      const giftDiscount = parseFloat(String(quotation.gift_discount_amount || 0));
      const total = subtotal - specialDiscount - giftDiscount;

      const mappedItems = (quotation.quotation_details || []).map((detail: any) => {
        const product = productsMap.get(detail.product_id);
        return {
          ...detail,
          product_id: detail.product_id,
          product_name: product?.name || '',
          Name: product?.name || '',
          name: product?.name || '',
          quantity: detail.quantity,
          Quantity: detail.quantity,
          unit_price: detail.unit_price,
          Price: detail.unit_price,
          price: detail.unit_price,
        };
      });

      return {
        QuotationID: quotation.quotation_id,
        CustomerID: quotation.customer_id,
        Date: quotation.date,
        QuotationDate: quotation.date,
        QuotationNumber: quotation.quotation_id,
        Total: total,
        Amount: total,
        Status: quotation.status,
        SpecialDiscount: specialDiscount,
        GiftDiscount: giftDiscount,
        Notes: quotation.notes || '',
        Items: mappedItems,
        CreatedAt: quotation.created_at,
      };
    });

    // Combine all financial transactions (shop and warehouse invoices)
    const allInvoices = [...mappedInvoices, ...mappedWarehouseInvoices];
    const allReceipts = [...mappedReceipts, ...mappedPayments, ...mappedWarehouseReceipts, ...mappedWarehousePayments];

    const result = {
      invoices: allInvoices,
      receipts: allReceipts,
      interactions: interactions || [],
      quotations: mappedQuotations || [],
    };

    console.log('[API] getCustomerData success');
    return result;
  } catch (error: any) {
    console.error('[API] getCustomerData error:', error);
    throw error;
  }
}

/**
 * Update an interaction (follow-up task)
 * DEPRECATED: Use updatePTPStatus instead (which uses Supabase)
 * This function is kept for backward compatibility
 */
export async function updateInteraction(payload: {
  interactionId: string;
  status?: string;
  note?: string;
  nextDate?: string;
}): Promise<any> {
  // Map to updatePTPStatus format and use Supabase
  // Note: This is a simplified mapping - you may need to adjust based on your needs
  if (payload.status) {
    return updatePTPStatusInSupabase(payload.interactionId, payload.status);
  }
  
  // If only note or nextDate is being updated, we'd need a different function
  // For now, just update the PTP status if provided
  return { status: 'success', message: 'Interaction update not fully implemented in Supabase yet' };
}

/**
 * Get CRM data for debt collection dashboard
 * Now uses Supabase instead of Google Sheets
 * Returns: { customers, promises, statistics }
 */
export async function getCRMData(): Promise<any> {
  // Use Supabase implementation
  return getCRMDataFromSupabase();
}

/**
 * Log a collection activity (promise, call, etc.) to CRM_Activity table
 * Now uses Supabase instead of Google Sheets
 */
export async function logActivity(payload: {
  CustomerID: string;
  ActionType: string; // 'Call', 'Visit', 'WhatsApp', 'Email', etc.
  Outcome: string; // 'No Answer', 'Promised', 'Busy', 'Resolved', etc.
  Notes: string;
  PromiseDate?: string; // ISO Date string (YYYY-MM-DD or ISO format)
  PromiseAmount?: number;
}): Promise<any> {
  // Use Supabase implementation
  return logActivityToSupabase(payload);
}

/**
 * Update PTP (Promise to Pay) status in CRM_Activity table
 * Now uses Supabase instead of Google Sheets
 */
export async function updatePTPStatus(activityId: string, newStatus: string): Promise<any> {
  // Use Supabase implementation
  return updatePTPStatusInSupabase(activityId, newStatus);
}

/**
 * ==========================================
 * CRM ACTIVITIES - SUPABASE IMPLEMENTATION
 * ==========================================
 */

/**
 * Generate activity ID in format: ACT-XXXX-YYY
 * Where XXXX is padded count and YYY is random between 10-999
 */
function generateActivityID(count: number): string {
  const paddedCount = String(count + 1).padStart(4, '0');
  const random = Math.floor(Math.random() * (999 - 10 + 1)) + 10;
  return `ACT-${paddedCount}-${random}`;
}

/**
 * Log a collection activity (promise, call, etc.) to crm_activities table in Supabase
 * Replaces the Google Sheets version
 */
export async function logActivityToSupabase(payload: {
  CustomerID: string;
  ActionType: string; // 'Call', 'Visit', 'WhatsApp', 'Email', etc.
  Outcome: string; // 'No Answer', 'Promised', 'Busy', 'Resolved', etc.
  Notes: string;
  PromiseDate?: string; // ISO Date string (YYYY-MM-DD)
  PromiseAmount?: number;
}): Promise<any> {
  try {
    console.log('[API] Logging activity to Supabase crm_activities:', payload);

    // Get current count for ID generation
    const { count } = await supabase
      .from('crm_activities')
      .select('*', { count: 'exact', head: true });

    const activityId = generateActivityID(count || 0);

    // Prepare data for Supabase (snake_case)
    const activityData: any = {
      activity_id: activityId,
      customer_id: payload.CustomerID,
      action_type: payload.ActionType || 'Call',
      outcome: payload.Outcome || null,
      notes: payload.Notes || null,
      promise_date: payload.PromiseDate || null,
      promise_amount: payload.PromiseAmount !== undefined && payload.PromiseAmount !== null 
        ? parseFloat(String(payload.PromiseAmount)) 
        : 0,
      ptp_status: payload.PromiseDate ? 'Active' : 'Closed', // Set to Active if there's a promise date
      created_by: 'Admin',
    };

    const { data, error } = await supabase
      .from('crm_activities')
      .insert(activityData)
      .select()
      .single();

    if (error) {
      console.error('[API] Failed to log activity to Supabase:', error);
      throw new Error(`Failed to log activity: ${error.message}`);
    }

    console.log('[API] Activity logged successfully:', data);
    return { status: 'success', data };
  } catch (error: any) {
    console.error('[API] logActivityToSupabase error:', error);
    throw error;
  }
}

/**
 * Update PTP (Promise to Pay) status in crm_activities table in Supabase
 * Replaces the Google Sheets version
 */
export async function updatePTPStatusInSupabase(activityId: string, newStatus: string): Promise<any> {
  try {
    console.log('[API] Updating PTP status in Supabase:', { activityId, newStatus });

    // Map status values (Fulfilled/Archived -> Closed, Active -> Active)
    const ptpStatus = newStatus === 'Fulfilled' || newStatus === 'Archived' ? 'Closed' : 'Active';

    const { data, error } = await supabase
      .from('crm_activities')
      .update({ 
        ptp_status: ptpStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('activity_id', activityId)
      .select()
      .single();

    if (error) {
      console.error('[API] Failed to update PTP status in Supabase:', error);
      throw new Error(`Failed to update PTP status: ${error.message}`);
    }

    console.log('[API] PTP status updated successfully:', data);
    return { status: 'success', data };
  } catch (error: any) {
    console.error('[API] updatePTPStatusInSupabase error:', error);
    throw error;
  }
}

/**
 * Update a CRM activity (interaction) in Supabase
 * Allows updating all fields: action_type, outcome, notes, promise_date, promise_amount
 */
export async function updateActivityInSupabase(activityId: string, payload: {
  ActionType?: string;
  Outcome?: string;
  Notes?: string;
  PromiseDate?: string; // ISO Date string (YYYY-MM-DD)
  PromiseAmount?: number;
}): Promise<any> {
  try {
    console.log('[API] Updating activity in Supabase:', { activityId, payload });

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (payload.ActionType !== undefined) {
      updateData.action_type = payload.ActionType;
    }
    if (payload.Outcome !== undefined) {
      updateData.outcome = payload.Outcome;
    }
    if (payload.Notes !== undefined) {
      updateData.notes = payload.Notes;
    }
    if (payload.PromiseDate !== undefined) {
      updateData.promise_date = payload.PromiseDate || null;
    }
    if (payload.PromiseAmount !== undefined) {
      updateData.promise_amount = payload.PromiseAmount || 0;
    }

    const { data, error } = await supabase
      .from('crm_activities')
      .update(updateData)
      .eq('activity_id', activityId)
      .select()
      .single();

    if (error) {
      console.error('[API] Failed to update activity in Supabase:', error);
      throw new Error(`Failed to update activity: ${error.message}`);
    }

    console.log('[API] Activity updated successfully:', data);
    return { status: 'success', data };
  } catch (error: any) {
    console.error('[API] updateActivityInSupabase error:', error);
    throw error;
  }
}

/**
 * Get CRM data for debt collection dashboard from Supabase
 * Replaces the Google Sheets version
 * Returns: { customers, promises, statistics }
 */
export async function getCRMDataFromSupabase(): Promise<any> {
  try {
    console.log('[API] Fetching CRM data from Supabase...');
    const startTime = Date.now();

    // Fetch all customers with their balance
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('customer_id, name, email, phone, balance')
      .order('name');

    if (customersError) {
      console.error('[API] Failed to fetch customers:', customersError);
      throw new Error(`Failed to fetch customers: ${customersError.message}`);
    }

    // Fetch all active promises (PTP) with customer info
    const { data: activities, error: activitiesError } = await supabase
      .from('crm_activities')
      .select(`
        activity_id,
        customer_id,
        action_type,
        outcome,
        notes,
        promise_date,
        promise_amount,
        ptp_status,
        created_at,
        customers:customer_id(customer_id, name, email, phone, balance)
      `)
      .eq('ptp_status', 'Active')
      .order('promise_date', { ascending: true });

    if (activitiesError) {
      console.error('[API] Failed to fetch activities:', activitiesError);
      throw new Error(`Failed to fetch activities: ${activitiesError.message}`);
    }

    // Fetch customer data separately and map
    const customerIds = [...new Set((activities || []).map((a: any) => a.customer_id))];
    const { data: customerData } = await supabase
      .from('customers')
      .select('customer_id, name, email, phone, balance')
      .in('customer_id', customerIds);

    const customerMap = new Map((customerData || []).map((c: any) => [c.customer_id, c]));

    // Map activities to promises format
    const promises = (activities || []).map((activity: any) => {
      const customer = customerMap.get(activity.customer_id) || {};
      return {
        ActivityID: activity.activity_id,
        InteractionID: activity.activity_id, // For compatibility
        CustomerID: activity.customer_id,
        CustomerName: customer.name || '',
        CustomerEmail: customer.email || '',
        CustomerPhone: customer.phone || '',
        Balance: parseFloat(String(customer.balance || 0)) || 0,
        PromiseDate: activity.promise_date || '',
        PromiseAmount: parseFloat(String(activity.promise_amount || 0)) || 0,
        Notes: activity.notes || '',
        ActionType: activity.action_type || 'Call',
        Outcome: activity.outcome || '',
        PTPStatus: activity.ptp_status || 'Active',
        CreatedAt: activity.created_at || '',
      };
    });

    // Calculate statistics
    const totalCustomers = customers?.length || 0;
    const totalDebt = customers?.reduce((sum: number, c: any) => sum + (parseFloat(String(c.balance || 0)) || 0), 0) || 0;
    const activePromises = promises.length;
    const totalPromisedAmount = promises.reduce((sum: number, p: any) => sum + (p.PromiseAmount || 0), 0);

    // Categorize promises by date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const overduePromises = promises.filter((p: any) => {
      if (!p.PromiseDate) return false;
      const promiseDate = new Date(p.PromiseDate);
      promiseDate.setHours(0, 0, 0, 0);
      return promiseDate < today;
    });

    const todayPromises = promises.filter((p: any) => {
      if (!p.PromiseDate) return false;
      const promiseDate = new Date(p.PromiseDate);
      promiseDate.setHours(0, 0, 0, 0);
      return promiseDate.getTime() === today.getTime();
    });

    const upcomingPromises = promises.filter((p: any) => {
      if (!p.PromiseDate) return false;
      const promiseDate = new Date(p.PromiseDate);
      promiseDate.setHours(0, 0, 0, 0);
      return promiseDate >= tomorrow;
    });

    const statistics = {
      totalCustomers,
      totalDebt,
      activePromises,
      totalPromisedAmount,
      overdueCount: overduePromises.length,
      todayCount: todayPromises.length,
      upcomingCount: upcomingPromises.length,
    };

    const result = {
      customers: customers || [],
      promises: promises,
      statistics,
    };

    const totalTime = Date.now() - startTime;
    console.log(`[API] CRM data loaded from Supabase: ${totalTime}ms`);
    console.log(`[API] Statistics:`, statistics);

    return result;
  } catch (error: any) {
    console.error('[API] getCRMDataFromSupabase error:', error);
    throw error;
  }
}

/**
 * Save Cash Invoice (نظام نقطة البيع النقدية)
 * Saves invoice to CashInvoices and CashDetails sheets
 */
/**
 * Generate invoice ID in format: Cash-XXXX-YYY
 * Where XXXX is padded count and YYY is random between 10-999
 */
function generateInvoiceID(count: number): string {
  const paddedCount = String(count + 1).padStart(4, '0');
  const random = Math.floor(Math.random() * (999 - 10 + 1)) + 10;
  return `Cash-${paddedCount}-${random}`;
}

/**
 * Generate shop sales invoice ID in format: Shop-XXXX-YYY
 * Where XXXX is padded count and YYY is random 3-digit number (100-999)
 */
/**
 * Generate shop sales invoice ID in format: Shop-XXXX-YYY
 * Where XXXX is padded count and YYY is random number (10-999)
 */
function generateShopInvoiceID(count: number): string {
  const paddedCount = String(count + 1).padStart(4, '0');
  const random = Math.floor(Math.random() * (999 - 10 + 1)) + 10;
  return `Shop-${paddedCount}-${random}`;
}

/**
 * Generate warehouse sales invoice ID in format: WHRINV-XXXX-YYY
 * Where XXXX is padded count and YYY is random number (10-999)
 */
function generateWarehouseInvoiceID(count: number): string {
  const paddedCount = String(count + 1).padStart(4, '0');
  const random = Math.floor(Math.random() * (999 - 10 + 1)) + 10;
  return `WHRINV-${paddedCount}-${random}`;
}

/**
 * Generate online order ID in format: Online-XXXX-YYY
 * Where XXXX is padded count and YYY is random 3-digit number (100-999)
 */
function generateOnlineOrderID(count: number): string {
  const paddedCount = String(count + 1).padStart(4, '0');
  const random = Math.floor(Math.random() * (999 - 100 + 1)) + 100;
  return `Online-${paddedCount}-${random}`;
}

/**
 * Generate detail ID in format: DET-XXXXX
 * Where XXXXX is a random string
 * Note: If detail_id column is UUID type in Supabase, this will need to be changed
 * to use UUID format or the schema should be updated to TEXT
 */
function generateDetailID(): string {
  const random = Math.floor(Math.random() * 100000);
  return `DET-${String(random).padStart(5, '0')}`;
}

/**
 * Save cash invoice directly to Supabase
 * This replaces the Google Apps Script API call for speed
 */
export async function saveCashInvoice(payload: {
  items: Array<{
    productID: string;
    mode: 'Pick' | 'Scan';
    scannedBarcode?: string;
    filterType?: string;
    filterBrand?: string;
    filterSize?: string;
    filterColor?: string;
    quantity: number;
    unitPrice: number;
  }>;
  notes?: string;
  discount?: number;
  created_by?: string; // Admin user ID (UUID)
}): Promise<any> {
  try {
    console.log('[API] Saving cash invoice to Supabase:', payload);

    // Step 1: Get count of existing invoices
    const { count, error: countError } = await supabase
      .from('cash_invoices')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('[API] Failed to get invoice count:', countError);
      throw new Error(`Failed to get invoice count: ${countError.message}`);
    }

    const invoiceCount = count || 0;
    console.log('[API] Current invoice count:', invoiceCount);

    // Step 2: Generate invoice ID
    const invoiceID = generateInvoiceID(invoiceCount);
    console.log('[API] Generated invoice ID:', invoiceID);

    // Step 3: Insert invoice header
    const invoiceHeader: any = {
      invoice_id: invoiceID,
      date_time: new Date().toISOString(),
      status: 'Finalized',
      notes: payload.notes || null,
      discount: payload.discount || 0,
      created_by: payload.created_by || null, // Admin user ID
    };
    
    // Add is_synced if column exists in schema
    // Note: If this column doesn't exist, you may need to add it:
    // ALTER TABLE cash_invoices ADD COLUMN is_synced BOOLEAN DEFAULT false;
    invoiceHeader.is_synced = false; // Important: Mark as not synced for reverse sync script

    const { error: headerError } = await supabase
      .from('cash_invoices')
      .insert([invoiceHeader]);

    if (headerError) {
      console.error('[API] Failed to insert invoice header:', headerError);
      throw new Error(`Failed to save invoice header: ${headerError.message}`);
    }

    console.log('[API] Invoice header inserted successfully');

    // Step 4: Insert invoice details
    if (!payload.items || payload.items.length === 0) {
      throw new Error('Cannot save invoice without items');
    }

    const invoiceDetails = payload.items.map((item) => ({
      detail_id: generateDetailID(), // String format: DET-XXXXX
      invoice_id: invoiceID,
      product_id: item.productID,
      mode: item.mode || 'Pick',
      scanned_barcode: item.scannedBarcode || null,
      filter_type: item.filterType || null,
      filter_brand: item.filterBrand || null,
      filter_size: item.filterSize || null,
      filter_color: item.filterColor || null,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    }));

    const { error: detailsError } = await supabase
      .from('cash_invoice_details')
      .insert(invoiceDetails);

    if (detailsError) {
      console.error('[API] Failed to insert invoice details:', detailsError);
      // Try to delete the header if details insert fails
      await supabase
        .from('cash_invoices')
        .delete()
        .eq('invoice_id', invoiceID);
      throw new Error(`Failed to save invoice details: ${detailsError.message}`);
    }

    console.log('[API] Invoice details inserted successfully:', invoiceDetails.length, 'items');

    // Step 5: Return success
    const result = {
      status: 'success',
      invoiceID: invoiceID,
    };

    console.log('[API] saveCashInvoice success:', result);
    return result;
  } catch (error: any) {
    console.error('[API] saveCashInvoice error:', error);
    
    // Re-throw if it's already a formatted error
    if (error?.message && error.message.startsWith('Failed to')) {
      throw error;
    }
    
    // Format generic errors
    throw new Error(`Failed to save cash invoice: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Get all Cash Invoices
 * DEPRECATED: Use getCashInvoicesFromSupabase instead
 * This function is kept for backward compatibility but now uses Supabase
 */
export async function getCashInvoices(): Promise<any[]> {
  // Use Supabase implementation
  return getCashInvoicesFromSupabase(1000);
}

/**
 * Get single Cash Invoice with details
 * DEPRECATED: Use getCashInvoicesFromSupabase and filter, or create a new function
 * This function is kept for backward compatibility but now uses Supabase
 */
export async function getCashInvoice(invoiceID: string): Promise<any> {
  try {
    console.log('[API] Fetching cash invoice from Supabase:', invoiceID);
    
    // Fetch invoice header
    const { data: invoiceHeader, error: headerError } = await supabase
      .from('cash_invoices')
      .select('*')
      .eq('invoice_id', invoiceID)
      .single();

    if (headerError || !invoiceHeader) {
      throw new Error(`Failed to fetch invoice: ${headerError?.message || 'Invoice not found'}`);
    }

    // Fetch invoice details with product name from products table
    const { data: invoiceDetails, error: detailsError } = await supabase
      .from('cash_invoice_details')
      .select('*, products(name)')
      .eq('invoice_id', invoiceID);

    if (detailsError) {
      console.error('[API] Failed to fetch invoice details:', detailsError);
    }

    // Debug: Log invoice details to see product data
    console.log('[API] Invoice details with products:', JSON.stringify(invoiceDetails, null, 2));

    // Calculate total amount from details
    const totalFromDetails = (invoiceDetails || []).reduce((sum: number, d: any) => {
      const qty = parseFloat(String(d.quantity || 0)) || 0;
      const price = parseFloat(String(d.unit_price || 0)) || 0;
      return sum + qty * price;
    }, 0);

    // Map to app format (pass total)
    const mappedInvoice = mapCashInvoiceFromSupabase(invoiceHeader, totalFromDetails);
    const mappedDetails = (invoiceDetails || []).map((detail: any) => 
      mapCashInvoiceDetailFromSupabase(detail, detail.products)
    );

    return {
      ...mappedInvoice,
      details: mappedDetails,
    };
  } catch (error: any) {
    console.error('[API] getCashInvoice error:', error);
    throw error;
  }
}


/**
 * Map Supabase cash invoice (snake_case) to app format (PascalCase)
 */
function mapCashInvoiceFromSupabase(invoice: any, totalAmount?: number): any {
  return {
    InvoiceID: invoice.invoice_id || '',
    DateTime: invoice.date_time || '',
    Status: invoice.status || 'Finalized',
    Notes: invoice.notes || '',
    Discount: parseFloat(String(invoice.discount || 0)) || 0,
    totalAmount: totalAmount || 0, // Will be calculated from details
    isSettled: invoice.is_settled === true || invoice.is_settled === 'true' || invoice.isSettled === true,
    // Keep original fields
    ...invoice,
  };
}

/**
 * Map Supabase cash invoice detail (snake_case) to app format (PascalCase)
 */
function mapCashInvoiceDetailFromSupabase(detail: any, product?: any): any {
  // Extract product name from various possible sources
  const productName = 
    product?.name || 
    product?.Name || 
    (typeof product === 'object' && product !== null && 'name' in product ? product.name : null) ||
    detail.product_name || 
    '';
  
  console.log('[API] Mapping detail:', {
    detail_id: detail.detail_id,
    product_id: detail.product_id,
    product: product,
    productName: productName,
  });

  return {
    // Keep original fields first
    ...detail,
    // Then override with mapped fields (ensures defaults are applied correctly)
    detailID: detail.detail_id || '',
    invoiceID: detail.invoice_id || '',
    productID: detail.product_id || '',
    productName: productName,
    ProductName: productName,
    Name: productName,
    mode: detail.mode || 'Pick', // Preserve mode from database, default to 'Pick' if missing
    scannedBarcode: detail.scanned_barcode || '',
    filterType: detail.filter_type || '',
    filterBrand: detail.filter_brand || '',
    filterSize: detail.filter_size || '',
    filterColor: detail.filter_color || '',
    quantity: parseFloat(String(detail.quantity || 0)) || 0,
    unitPrice: parseFloat(String(detail.unit_price || 0)) || 0,
    barcode: product?.barcode || product?.Barcode || '',
    shamelNo: product?.shamel_no || product?.['Shamel No'] || product?.ShamelNo || product?.ShamelNO || '',
  };
}

/**
 * Get cash invoices from Supabase (for Invoices History page)
 * Fetches invoices with calculated total amounts
 */
export async function getCashInvoicesFromSupabase(limit: number = 50): Promise<any[]> {
  try {
    console.log('[API] Fetching cash invoices from Supabase...');
    const startTime = Date.now();
    
    // Fetch invoices ordered by date_time descending
    const { data: invoices, error } = await supabase
      .from('cash_invoices')
      .select('*')
      .order('date_time', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[API] Supabase error:', error);
      throw new Error(`Failed to fetch cash invoices: ${error.message}`);
    }
    
    if (!invoices || !Array.isArray(invoices)) {
      console.error('[API] Invalid invoices data:', invoices);
      return [];
    }
    
    // Fetch details for all invoices to calculate totals
    const invoiceIds = invoices.map((inv: any) => inv.invoice_id);
    
    const { data: allDetails, error: detailsError } = await supabase
      .from('cash_invoice_details')
      .select('invoice_id, quantity, unit_price')
      .in('invoice_id', invoiceIds);
    
    if (detailsError) {
      console.error('[API] Error fetching invoice details:', detailsError);
      // Continue without totals if details fetch fails
    }
    
    // Calculate total for each invoice
    const totalsMap = new Map<string, number>();
    if (allDetails && Array.isArray(allDetails)) {
      allDetails.forEach((detail: any) => {
        const invoiceId = detail.invoice_id;
        const itemTotal = parseFloat(String(detail.quantity || 0)) * parseFloat(String(detail.unit_price || 0));
        const currentTotal = totalsMap.get(invoiceId) || 0;
        totalsMap.set(invoiceId, currentTotal + itemTotal);
      });
    }
    
    // Map invoices with totals
    const mappedInvoices = invoices.map((invoice: any) => {
      const subtotal = totalsMap.get(invoice.invoice_id) || 0;
      const discount = parseFloat(String(invoice.discount || 0)) || 0;
      const totalAmount = subtotal - discount;
      return mapCashInvoiceFromSupabase(invoice, totalAmount);
    });
    
    const totalTime = Date.now() - startTime;
    console.log(`[API] Cash invoices loaded from Supabase: ${mappedInvoices.length} in ${totalTime}ms`);
    
    return mappedInvoices;
  } catch (error: any) {
    console.error('[API] getCashInvoicesFromSupabase error:', error?.message || error);
    throw error;
  }
}

/**
 * Get cash invoice details from Supabase
 * Fetches details with product information
 */
/**
 * Update cash invoice in Supabase
 */
export async function updateCashInvoice(
  invoiceId: string,
  payload: {
    items: Array<{
      detailID?: string; // If exists, update; if not, insert new
      productID: string;
      mode?: 'Pick' | 'Scan';
      scannedBarcode?: string;
      filterType?: string;
      filterBrand?: string;
      filterSize?: string;
      filterColor?: string;
      quantity: number;
      unitPrice: number;
    }>;
    notes?: string;
    discount?: number;
  }
): Promise<any> {
  try {
    console.log('[API] Updating cash invoice in Supabase:', invoiceId, payload);

    // Step 1: Update invoice header
    const headerUpdate: any = {
      notes: payload.notes !== undefined ? payload.notes : null,
      discount: payload.discount || 0,
      is_synced: false, // Mark as not synced after update
    };

    const { error: headerError } = await supabase
      .from('cash_invoices')
      .update(headerUpdate)
      .eq('invoice_id', invoiceId);

    if (headerError) {
      console.error('[API] Failed to update invoice header:', headerError);
      throw new Error(`Failed to update invoice header: ${headerError.message}`);
    }

    console.log('[API] Invoice header updated successfully');

    // Step 2: Get existing details
    const { data: existingDetails, error: fetchError } = await supabase
      .from('cash_invoice_details')
      .select('detail_id')
      .eq('invoice_id', invoiceId);

    if (fetchError) {
      console.error('[API] Failed to fetch existing details:', fetchError);
      throw new Error(`Failed to fetch existing details: ${fetchError.message}`);
    }

    const existingDetailIds = new Set((existingDetails || []).map((d: any) => d.detail_id));

    // Step 3: Separate items into updates and inserts
    const itemsToUpdate: any[] = [];
    const itemsToInsert: any[] = [];
    const itemsToKeep = new Set<string>();

    payload.items.forEach((item) => {
      if (item.detailID && existingDetailIds.has(item.detailID)) {
        // Update existing detail
        itemsToUpdate.push({
          detail_id: item.detailID,
          product_id: item.productID,
          mode: item.mode || 'Pick',
          scanned_barcode: item.scannedBarcode || null,
          filter_type: item.filterType || null,
          filter_brand: item.filterBrand || null,
          filter_size: item.filterSize || null,
          filter_color: item.filterColor || null,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        });
        itemsToKeep.add(item.detailID);
      } else {
        // Insert new detail
        itemsToInsert.push({
          invoice_id: invoiceId,
          product_id: item.productID,
          mode: item.mode || 'Pick',
          scanned_barcode: item.scannedBarcode || null,
          filter_type: item.filterType || null,
          filter_brand: item.filterBrand || null,
          filter_size: item.filterSize || null,
          filter_color: item.filterColor || null,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        });
      }
    });

    // Step 4: Delete details that are no longer in the payload
    const detailsToDelete = Array.from(existingDetailIds).filter((id) => !itemsToKeep.has(id));
    if (detailsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('cash_invoice_details')
        .delete()
        .in('detail_id', detailsToDelete);

      if (deleteError) {
        console.error('[API] Failed to delete removed details:', deleteError);
        throw new Error(`Failed to delete removed details: ${deleteError.message}`);
      }
      console.log('[API] Deleted', detailsToDelete.length, 'removed details');
    }

    // Step 5: Update existing details
    if (itemsToUpdate.length > 0) {
      for (const item of itemsToUpdate) {
        const { detail_id, ...updateData } = item;
        const { error: updateError } = await supabase
          .from('cash_invoice_details')
          .update(updateData)
          .eq('detail_id', detail_id);

        if (updateError) {
          console.error('[API] Failed to update detail:', updateError);
          throw new Error(`Failed to update detail: ${updateError.message}`);
        }
      }
      console.log('[API] Updated', itemsToUpdate.length, 'existing details');
    }

    // Step 6: Insert new details
    if (itemsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('cash_invoice_details')
        .insert(itemsToInsert);

      if (insertError) {
        console.error('[API] Failed to insert new details:', insertError);
        throw new Error(`Failed to insert new details: ${insertError.message}`);
      }
      console.log('[API] Inserted', itemsToInsert.length, 'new details');
    }

    const result = {
      status: 'success',
      invoiceID: invoiceId,
    };

    console.log('[API] updateCashInvoice success:', result);
    return result;
  } catch (error: any) {
    console.error('[API] updateCashInvoice error:', error);
    throw new Error(`Failed to update cash invoice: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Delete cash invoice from Supabase
 */
export async function deleteCashInvoice(invoiceId: string): Promise<any> {
  try {
    console.log('[API] Deleting cash invoice from Supabase:', invoiceId);

    // Delete invoice (details will be deleted automatically due to CASCADE)
    const { error } = await supabase
      .from('cash_invoices')
      .delete()
      .eq('invoice_id', invoiceId);

    if (error) {
      console.error('[API] Failed to delete invoice:', error);
      throw new Error(`Failed to delete invoice: ${error.message}`);
    }

    console.log('[API] Invoice deleted successfully');
    return { status: 'success', invoiceID: invoiceId };
  } catch (error: any) {
    console.error('[API] deleteCashInvoice error:', error);
    throw new Error(`Failed to delete cash invoice: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Update cash invoice settlement status
 */
export async function updateCashInvoiceSettlementStatus(
  invoiceId: string,
  isSettled: boolean
): Promise<any> {
  try {
    console.log('[API] Updating cash invoice settlement status:', invoiceId, isSettled);

    const { error } = await supabase
      .from('cash_invoices')
      .update({ is_settled: isSettled })
      .eq('invoice_id', invoiceId);

    if (error) {
      console.error('[API] Failed to update settlement status:', error);
      throw new Error(`Failed to update settlement status: ${error.message}`);
    }

    console.log('[API] Settlement status updated successfully');
    return { status: 'success', invoiceID: invoiceId, isSettled };
  } catch (error: any) {
    console.error('[API] updateCashInvoiceSettlementStatus error:', error);
    throw new Error(`Failed to update settlement status: ${error?.message || 'Unknown error'}`);
  }
}

export async function getCashInvoiceDetailsFromSupabase(invoiceId: string): Promise<any[]> {
  try {
    console.log('[API] Fetching cash invoice details from Supabase:', invoiceId);
    const startTime = Date.now();
    
    // Fetch invoice details
    const { data: details, error } = await supabase
      .from('cash_invoice_details')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('[API] Supabase error:', error);
      throw new Error(`Failed to fetch invoice details: ${error.message}`);
    }
    
    if (!details || !Array.isArray(details)) {
      console.error('[API] Invalid details data:', details);
      return [];
    }
    
    // Fetch product information for all product IDs
    const productIds = details.map((detail: any) => detail.product_id).filter(Boolean);
    
    let productsMap = new Map<string, any>();
    if (productIds.length > 0) {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('product_id, name, barcode, shamel_no')
        .in('product_id', productIds);
      
      if (!productsError && products && Array.isArray(products)) {
        products.forEach((product: any) => {
          productsMap.set(product.product_id, product);
        });
      }
    }
    
    // Map details with product information
    const mappedDetails = details.map((detail: any) => {
      const product = productsMap.get(detail.product_id);
      return mapCashInvoiceDetailFromSupabase(detail, product);
    });
    
    const totalTime = Date.now() - startTime;
    console.log(`[API] Invoice details loaded from Supabase: ${mappedDetails.length} in ${totalTime}ms`);
    
    return mappedDetails;
  } catch (error: any) {
    console.error('[API] getCashInvoiceDetailsFromSupabase error:', error?.message || error);
    throw error;
  }
}

/**
 * Submit an online order (guest checkout - no login required)
 * Creates order in online_orders and online_order_details tables
 */
export async function submitOnlineOrder(orderData: {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  notes?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
}): Promise<any> {
  try {
    console.log('[API] Submitting online order...', orderData);

    // Step 1: Get count of existing orders
    const { count, error: countError } = await supabase
      .from('online_orders')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('[API] Failed to get order count:', countError);
      throw new Error(`Failed to get order count: ${countError.message}`);
    }

    const orderCount = count || 0;
    console.log('[API] Current order count:', orderCount);

    // Step 2: Generate order ID in format: Online-XXXX-YYY
    const orderID = generateOnlineOrderID(orderCount);
    console.log('[API] Generated order ID:', orderID);

    // Step 3: Calculate total amount
    const totalAmount = orderData.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    // Step 4: Insert order with generated ID
    const { data: order, error: orderError } = await supabase
      .from('online_orders')
      .insert({
        order_id: orderID,
        customer_name: orderData.customerName,
        customer_phone: orderData.customerPhone,
        customer_email: orderData.customerEmail || null,
        notes: orderData.notes || null,
        total_amount: totalAmount,
        status: 'Pending',
      })
      .select()
      .single();

    if (orderError) {
      console.error('[API] Error creating online order:', orderError);
      throw new Error(`Failed to create order: ${orderError.message}`);
    }

    if (!order) {
      throw new Error('Failed to create order: No order returned');
    }

    console.log('[API] Online order created:', order.order_id);

    // Step 5: Insert order details
    const orderDetails = orderData.items.map((item) => ({
      order_id: orderID,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.quantity * item.unitPrice,
    }));

    console.log('[API] Order details to insert:', JSON.stringify(orderDetails, null, 2));
    console.log('[API] Order details count:', orderDetails.length);

    const { data: insertedDetails, error: detailsError } = await supabase
      .from('online_order_details')
      .insert(orderDetails)
      .select();

    if (detailsError) {
      console.error('[API] Error creating order details:', detailsError);
      console.error('[API] Error code:', detailsError.code);
      console.error('[API] Error message:', detailsError.message);
      console.error('[API] Error details:', detailsError.details);
      // Try to delete the order if details insertion fails
      await supabase.from('online_orders').delete().eq('order_id', orderID);
      throw new Error(`Failed to create order details: ${detailsError.message}`);
    }

    console.log('[API] Order details inserted successfully:', insertedDetails);
    console.log('[API] Inserted details count:', insertedDetails?.length || 0);
    console.log('[API] Online order submitted successfully:', orderID);

    return {
      success: true,
      orderId: orderID,
      order: order,
    };
  } catch (error: any) {
    console.error('[API] submitOnlineOrder error:', error?.message || error);
    throw error;
  }
}

/**
 * Get all online orders from Supabase
 */
export async function getOnlineOrdersFromSupabase(limit: number = 100): Promise<any[]> {
  try {
    console.log('[API] Fetching online orders from Supabase...');
    const startTime = Date.now();

    const { data: orders, error } = await supabase
      .from('online_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[API] Supabase error:', error);
      throw new Error(`Failed to fetch online orders: ${error.message}`);
    }

    if (!orders || !Array.isArray(orders)) {
      console.error('[API] Invalid orders data:', orders);
      return [];
    }

    const mappedOrders = orders.map((order: any) => ({
      OrderID: order.order_id,
      CustomerName: order.customer_name || '',
      CustomerPhone: order.customer_phone || '',
      CustomerEmail: order.customer_email || '',
      Status: order.status || 'Pending',
      Notes: order.notes || '',
      Discount: parseFloat(String(order.discount || 0)) || 0,
      TotalAmount: parseFloat(String(order.total_amount || 0)) || 0,
      CreatedAt: order.created_at || '',
      UpdatedAt: order.updated_at || '',
    }));

    const totalTime = Date.now() - startTime;
    console.log(`[API] Online orders loaded from Supabase: ${mappedOrders.length} in ${totalTime}ms`);

    return mappedOrders;
  } catch (error: any) {
    console.error('[API] getOnlineOrdersFromSupabase error:', error?.message || error);
    throw error;
  }
}

/**
 * Get customer data from Supabase by customer ID or email
 */
export async function getCustomerFromSupabase(customerIdOrEmail: string): Promise<any | null> {
  try {
    console.log('[API] Fetching customer from Supabase...', customerIdOrEmail);
    
    // Try to find by customer_id first
    let { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('customer_id', customerIdOrEmail)
      .single();
    
    // If not found by ID, try by email
    if (error || !customer) {
      const { data: customerByEmail, error: emailError } = await supabase
        .from('customers')
        .select('*')
        .eq('email', customerIdOrEmail)
        .single();
      
      if (!emailError && customerByEmail) {
        customer = customerByEmail;
        error = null;
      }
    }
    
    if (error || !customer) {
      console.log('[API] Customer not found in Supabase:', customerIdOrEmail);
      return null;
    }
    
    console.log('[API] Customer found in Supabase:', customer);
    return {
      customer_id: customer.customer_id,
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      type: customer.type || '',
      balance: parseFloat(String(customer.balance || 0)) || 0,
      address: customer.address || '',
    };
  } catch (error: any) {
    console.error('[API] getCustomerFromSupabase error:', error?.message || error);
    return null;
  }
}

/**
 * Get online order details from Supabase
 */
export async function getOnlineOrderDetailsFromSupabase(orderId: string): Promise<any[]> {
  try {
    console.log('[API] Fetching online order details from Supabase...', orderId);
    console.log('[API] Order ID type:', typeof orderId, 'value:', orderId);
    const startTime = Date.now();

    const { data: details, error } = await supabase
      .from('online_order_details')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[API] Supabase error fetching order details:', error);
      console.error('[API] Error code:', error.code);
      console.error('[API] Error message:', error.message);
      console.error('[API] Error details:', error.details);
      throw new Error(`Failed to fetch order details: ${error.message}`);
    }

    console.log('[API] Raw details from Supabase:', details);
    console.log('[API] Details count:', details?.length || 0);

    if (!details || !Array.isArray(details)) {
      console.error('[API] Invalid details data:', details);
      return [];
    }

    if (details.length === 0) {
      console.warn('[API] No order details found for order_id:', orderId);
      // Check if order exists
      const { data: orderCheck, error: orderError } = await supabase
        .from('online_orders')
        .select('order_id')
        .eq('order_id', orderId)
        .single();
      
      if (orderError) {
        console.error('[API] Order not found:', orderError);
      } else {
        console.log('[API] Order exists but has no details');
      }
    }

    const mappedDetails = details.map((detail: any) => {
      console.log('[API] Mapping detail:', detail);
      return {
        DetailID: detail.detail_id,
        OrderID: detail.order_id,
        ProductID: detail.product_id || '',
        ProductName: detail.product_name || '',
        Quantity: parseFloat(String(detail.quantity || 0)) || 0,
        UnitPrice: parseFloat(String(detail.unit_price || 0)) || 0,
        TotalPrice: parseFloat(String(detail.total_price || 0)) || 0,
        CreatedAt: detail.created_at || '',
      };
    });

    const totalTime = Date.now() - startTime;
    console.log(`[API] Order details loaded from Supabase: ${mappedDetails.length} in ${totalTime}ms`);
    console.log('[API] Mapped details:', mappedDetails);

    return mappedDetails;
  } catch (error: any) {
    console.error('[API] getOnlineOrderDetailsFromSupabase error:', error?.message || error);
    console.error('[API] Error stack:', error?.stack);
    throw error;
  }
}

/**
 * Update online order in Supabase
 * Updates order header (notes, status) and order details (items)
 */
export async function updateOnlineOrder(
  orderId: string,
  payload: {
    items: Array<{
      detailID?: string; // If exists, update; if not, insert new
      productID: string;
      productName: string;
      quantity: number;
      unitPrice: number;
    }>;
    notes?: string;
    status?: string;
    discount?: number;
  }
): Promise<any> {
  try {
    console.log('[API] Updating online order in Supabase:', orderId, payload);

    // Step 1: Calculate total amount from items
    const subtotal = payload.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const discount = payload.discount || 0;
    const totalAmount = subtotal - discount;

    // Step 2: Update order header
    const headerUpdate: any = {
      notes: payload.notes !== undefined ? payload.notes : null,
      status: payload.status || 'Pending',
      discount: discount || 0,
      total_amount: totalAmount,
    };

    const { error: headerError } = await supabase
      .from('online_orders')
      .update(headerUpdate)
      .eq('order_id', orderId);

    if (headerError) {
      console.error('[API] Failed to update order header:', headerError);
      throw new Error(`Failed to update order header: ${headerError.message}`);
    }

    console.log('[API] Order header updated successfully');

    // Step 3: Get existing details
    const { data: existingDetails, error: fetchError } = await supabase
      .from('online_order_details')
      .select('detail_id')
      .eq('order_id', orderId);

    if (fetchError) {
      console.error('[API] Failed to fetch existing details:', fetchError);
      throw new Error(`Failed to fetch existing details: ${fetchError.message}`);
    }

    const existingDetailIds = new Set((existingDetails || []).map((d: any) => d.detail_id));

    // Step 4: Separate items into updates and inserts
    const itemsToUpdate: any[] = [];
    const itemsToInsert: any[] = [];
    const itemsToKeep = new Set<string>();

    payload.items.forEach((item) => {
      if (item.detailID && existingDetailIds.has(item.detailID)) {
        // Update existing detail
        itemsToUpdate.push({
          detail_id: item.detailID,
          product_id: item.productID,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.quantity * item.unitPrice,
        });
        itemsToKeep.add(item.detailID);
      } else {
        // Insert new detail
        itemsToInsert.push({
          order_id: orderId,
          product_id: item.productID,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.quantity * item.unitPrice,
        });
      }
    });

    // Step 5: Delete details that are no longer in the payload
    const detailsToDelete = Array.from(existingDetailIds).filter((id) => !itemsToKeep.has(id));
    if (detailsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('online_order_details')
        .delete()
        .in('detail_id', detailsToDelete);

      if (deleteError) {
        console.error('[API] Failed to delete removed details:', deleteError);
        throw new Error(`Failed to delete removed details: ${deleteError.message}`);
      }
      console.log('[API] Deleted', detailsToDelete.length, 'removed details');
    }

    // Step 6: Update existing details
    if (itemsToUpdate.length > 0) {
      for (const item of itemsToUpdate) {
        const { detail_id, ...updateData } = item;
        const { error: updateError } = await supabase
          .from('online_order_details')
          .update(updateData)
          .eq('detail_id', detail_id);

        if (updateError) {
          console.error('[API] Failed to update detail:', updateError);
          throw new Error(`Failed to update detail: ${updateError.message}`);
        }
      }
      console.log('[API] Updated', itemsToUpdate.length, 'existing details');
    }

    // Step 7: Insert new details
    if (itemsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('online_order_details')
        .insert(itemsToInsert);

      if (insertError) {
        console.error('[API] Failed to insert new details:', insertError);
        throw new Error(`Failed to insert new details: ${insertError.message}`);
      }
      console.log('[API] Inserted', itemsToInsert.length, 'new details');
    }

    const result = {
      status: 'success',
      orderID: orderId,
    };

    console.log('[API] updateOnlineOrder success:', result);
    return result;
  } catch (error: any) {
    console.error('[API] updateOnlineOrder error:', error);
    throw new Error(`Failed to update online order: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Update online order status only (quick status change)
 */
export async function updateOnlineOrderStatus(
  orderId: string,
  status: 'Pending' | 'Processing' | 'Completed' | 'Cancelled'
): Promise<any> {
  try {
    console.log('[API] Updating online order status:', orderId, status);

    const { error } = await supabase
      .from('online_orders')
      .update({ status })
      .eq('order_id', orderId);

    if (error) {
      console.error('[API] Failed to update order status:', error);
      throw new Error(`Failed to update order status: ${error.message}`);
    }

    console.log('[API] Order status updated successfully');
    return { status: 'success', orderID: orderId, newStatus: status };
  } catch (error: any) {
    console.error('[API] updateOnlineOrderStatus error:', error);
    throw new Error(`Failed to update order status: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Generate receipt ID in format: REC-XXXX-YYY
 * Where XXXX is padded count and YYY is random 3-digit number (100-999)
 */
function generateReceiptID(count: number): string {
  const paddedCount = String(count + 1).padStart(4, '0');
  const random = Math.floor(Math.random() * (999 - 100 + 1)) + 100;
  return `REC-${paddedCount}-${random}`;
}

/**
 * Generate payment ID in format: PAY-XXXX-YYY
 * Where XXXX is padded count and YYY is random 3-digit number (100-999)
 */
function generatePaymentID(count: number): string {
  const paddedCount = String(count + 1).padStart(4, '0');
  const random = Math.floor(Math.random() * (999 - 100 + 1)) + 100;
  return `PAY-${paddedCount}-${random}`;
}

/**
 * Save Shop Receipt (سند قبض المحل)
 */
export async function saveShopReceipt(payload: {
  customerID: string;
  date: string; // Format: YYYY-MM-DD
  cashAmount?: number;
  chequeAmount?: number;
  notes?: string;
  created_by?: string; // Admin user ID
}): Promise<any> {
  try {
    console.log('[API] Saving shop receipt to Supabase:', payload);

    // Get count of existing receipts
    const { count, error: countError } = await supabase
      .from('shop_receipts')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('[API] Failed to get receipt count:', countError);
      throw new Error(`Failed to get receipt count: ${countError.message}`);
    }

    const receiptCount = count || 0;
    const receiptID = generateReceiptID(receiptCount);
    console.log('[API] Generated receipt ID:', receiptID);

    // Insert receipt
    const receiptData: any = {
      receipt_id: receiptID,
      customer_id: payload.customerID,
      date: payload.date,
      cash_amount: payload.cashAmount || 0,
      cheque_amount: payload.chequeAmount || 0,
      notes: payload.notes || null,
      created_by: payload.created_by || null, // Admin user ID
    };

    const { data, error } = await supabase
      .from('shop_receipts')
      .insert(receiptData)
      .select()
      .single();

    if (error) {
      console.error('[API] Failed to save receipt:', error);
      throw new Error(`Failed to save receipt: ${error.message}`);
    }

    console.log('[API] Receipt saved successfully');
    return { status: 'success', receiptID, data };
  } catch (error: any) {
    console.error('[API] saveShopReceipt error:', error);
    throw error;
  }
}

/**
 * Get all shop receipts from Supabase
 */
export async function getShopReceipts(page: number = 1, pageSize: number = 20): Promise<{ receipts: any[]; total: number }> {
  try {
    console.log('[API] Fetching shop receipts from Supabase...', { page, pageSize });

    // Calculate pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // First, get total count
    const { count, error: countError } = await supabase
      .from('shop_receipts')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('[API] Error getting receipt count:', countError);
      throw new Error(`Failed to get receipt count: ${countError.message}`);
    }

    const total = count || 0;

    // Fetch receipts with pagination
    const { data: receipts, error } = await supabase
      .from('shop_receipts')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[API] Supabase error:', error);
      throw new Error(`Failed to fetch receipts: ${error.message}`);
    }

    if (!receipts || !Array.isArray(receipts)) {
      console.error('[API] Invalid receipts data:', receipts);
      throw new Error('Invalid response format: No receipts array found');
    }

    // Get unique customer IDs
    const customerIds = [...new Set(receipts.map(r => r.customer_id).filter(Boolean))];
    
    // Fetch all customer names in one query
    let customerMap = new Map<string, string>();
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('customers')
        .select('customer_id, name')
        .in('customer_id', customerIds);
      
      if (customers) {
        customers.forEach((c: any) => {
          customerMap.set(c.customer_id, c.name || '');
        });
      }
    }

    // Map receipts with customer names
    const mappedReceipts = receipts.map((receipt: any) => {
      const customerName = customerMap.get(receipt.customer_id) || '';
      
      return {
        ReceiptID: receipt.receipt_id,
        CustomerID: receipt.customer_id,
        CustomerName: customerName,
        Date: receipt.date,
        CashAmount: parseFloat(String(receipt.cash_amount || 0)),
        ChequeAmount: parseFloat(String(receipt.cheque_amount || 0)),
        TotalAmount: parseFloat(String(receipt.cash_amount || 0)) + parseFloat(String(receipt.cheque_amount || 0)),
        Notes: receipt.notes || '',
        CreatedAt: receipt.created_at,
      };
    });

    console.log(`[API] Shop receipts loaded: ${mappedReceipts.length} of ${total}`);
    return { receipts: mappedReceipts, total };
  } catch (error: any) {
    console.error('[API] getShopReceipts error:', error?.message || error);
    throw error;
  }
}

/**
 * Get shop receipt by ID
 */
export async function getShopReceipt(receiptId: string): Promise<any> {
  try {
    const { data: receipt, error } = await supabase
      .from('shop_receipts')
      .select('*')
      .eq('receipt_id', receiptId)
      .single();

    if (error || !receipt) {
      throw new Error(`Receipt not found: ${error?.message || 'Unknown error'}`);
    }

    // Fetch customer info
    let customerName = '';
    let shamelNo = '';
    let customerBalance = 0;
    if (receipt.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('name, shamel_no, balance')
        .eq('customer_id', receipt.customer_id)
        .single();
      customerName = customer?.name || '';
      shamelNo = customer?.shamel_no || '';
      customerBalance = parseFloat(String(customer?.balance || 0));
    }

    const totalAmount = parseFloat(String(receipt.cash_amount || 0)) + parseFloat(String(receipt.cheque_amount || 0));

    // الرصيد قبل السند = الرصيد الحالي للزبون
    // الرصيد بعد السند = الرصيد الحالي - مبلغ السند
    const balanceBefore = customerBalance; // الرصيد الحالي (قبل السند)
    const balanceAfter = customerBalance - totalAmount; // الرصيد بعد السند (بعد خصم مبلغ السند)

    return {
      ReceiptID: receipt.receipt_id,
      CustomerID: receipt.customer_id,
      CustomerName: customerName,
      ShamelNo: shamelNo,
      Date: receipt.date,
      CashAmount: parseFloat(String(receipt.cash_amount || 0)),
      ChequeAmount: parseFloat(String(receipt.cheque_amount || 0)),
      TotalAmount: totalAmount,
      BalanceBefore: balanceBefore, // الرصيد قبل السند (قبل خصم مبلغ السند)
      BalanceAfter: balanceAfter, // الرصيد بعد السند (بعد خصم مبلغ السند)
      Notes: receipt.notes || '',
      CreatedAt: receipt.created_at,
    };
  } catch (error: any) {
    console.error('[API] getShopReceipt error:', error);
    throw error;
  }
}

/**
 * Update Shop Receipt (تحديث سند قبض المحل)
 */
export async function updateShopReceipt(receiptId: string, payload: {
  customerID: string;
  date: string; // Format: YYYY-MM-DD
  cashAmount?: number;
  chequeAmount?: number;
  notes?: string;
  created_by?: string; // Admin user ID
}): Promise<any> {
  try {
    console.log('[API] Updating shop receipt in Supabase:', receiptId, payload);

    const receiptData: any = {
      customer_id: payload.customerID,
      date: payload.date,
      cash_amount: payload.cashAmount || 0,
      cheque_amount: payload.chequeAmount || 0,
      notes: payload.notes || null,
    };
    
    // Only update created_by if provided (usually preserve original creator)
    if (payload.created_by !== undefined) {
      receiptData.created_by = payload.created_by;
    }

    const { data, error } = await supabase
      .from('shop_receipts')
      .update(receiptData)
      .eq('receipt_id', receiptId)
      .select()
      .single();

    if (error) {
      console.error('[API] Failed to update receipt:', error);
      throw new Error(`Failed to update receipt: ${error.message}`);
    }

    console.log('[API] Receipt updated successfully');
    return { status: 'success', receiptID: receiptId, data };
  } catch (error: any) {
    console.error('[API] updateShopReceipt error:', error);
    throw error;
  }
}

/**
 * Delete Shop Receipt (حذف سند قبض المحل)
 */
export async function deleteShopReceipt(receiptId: string): Promise<any> {
  try {
    console.log('[API] Deleting shop receipt from Supabase:', receiptId);

    const { error } = await supabase
      .from('shop_receipts')
      .delete()
      .eq('receipt_id', receiptId);

    if (error) {
      console.error('[API] Failed to delete receipt:', error);
      throw new Error(`Failed to delete receipt: ${error.message}`);
    }

    console.log('[API] Receipt deleted successfully');
    return { status: 'success' };
  } catch (error: any) {
    console.error('[API] deleteShopReceipt error:', error);
    throw error;
  }
}

/**
 * Save Shop Payment (سند دفع المحل)
 */
export async function saveShopPayment(payload: {
  customerID: string;
  date: string; // Format: YYYY-MM-DD
  cashAmount?: number;
  chequeAmount?: number;
  notes?: string;
  created_by?: string; // Admin user ID
}): Promise<any> {
  try {
    console.log('[API] Saving shop payment to Supabase:', payload);

    // Get count of existing payments
    const { count, error: countError } = await supabase
      .from('shop_payments')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('[API] Failed to get payment count:', countError);
      throw new Error(`Failed to get payment count: ${countError.message}`);
    }

    const paymentCount = count || 0;
    const payID = generatePaymentID(paymentCount);
    console.log('[API] Generated payment ID:', payID);

    // Insert payment
    const paymentData: any = {
      pay_id: payID,
      customer_id: payload.customerID,
      date: payload.date,
      cash_amount: payload.cashAmount || 0,
      cheque_amount: payload.chequeAmount || 0,
      notes: payload.notes || null,
      created_by: payload.created_by || null, // Admin user ID
    };

    const { data, error } = await supabase
      .from('shop_payments')
      .insert(paymentData)
      .select()
      .single();

    if (error) {
      console.error('[API] Failed to save payment:', error);
      throw new Error(`Failed to save payment: ${error.message}`);
    }

    console.log('[API] Payment saved successfully');
    return { status: 'success', payID, data };
  } catch (error: any) {
    console.error('[API] saveShopPayment error:', error);
    throw error;
  }
}

/**
 * Get all shop payments from Supabase
 */
export async function getShopPayments(page: number = 1, pageSize: number = 20): Promise<{ payments: any[]; total: number }> {
  try {
    console.log('[API] Fetching shop payments from Supabase...', { page, pageSize });

    // Calculate pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // First, get total count
    const { count, error: countError } = await supabase
      .from('shop_payments')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('[API] Error getting payment count:', countError);
      throw new Error(`Failed to get payment count: ${countError.message}`);
    }

    const total = count || 0;

    // Fetch payments with pagination
    const { data: payments, error } = await supabase
      .from('shop_payments')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[API] Supabase error:', error);
      throw new Error(`Failed to fetch payments: ${error.message}`);
    }

    if (!payments || !Array.isArray(payments)) {
      console.error('[API] Invalid payments data:', payments);
      throw new Error('Invalid response format: No payments array found');
    }

    // Get unique customer IDs
    const customerIds = [...new Set(payments.map(p => p.customer_id).filter(Boolean))];
    
    // Fetch all customer names in one query
    let customerMap = new Map<string, string>();
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('customers')
        .select('customer_id, name')
        .in('customer_id', customerIds);
      
      if (customers) {
        customers.forEach((c: any) => {
          customerMap.set(c.customer_id, c.name || '');
        });
      }
    }

    // Map payments with customer names
    const mappedPayments = payments.map((payment: any) => {
      const customerName = customerMap.get(payment.customer_id) || '';
      
      return {
        PayID: payment.pay_id,
        CustomerID: payment.customer_id,
        CustomerName: customerName,
        Date: payment.date,
        CashAmount: parseFloat(String(payment.cash_amount || 0)),
        ChequeAmount: parseFloat(String(payment.cheque_amount || 0)),
        TotalAmount: parseFloat(String(payment.cash_amount || 0)) + parseFloat(String(payment.cheque_amount || 0)),
        Notes: payment.notes || '',
        CreatedAt: payment.created_at,
      };
    });

    console.log(`[API] Shop payments loaded: ${mappedPayments.length} of ${total}`);
    return { payments: mappedPayments, total };
  } catch (error: any) {
    console.error('[API] getShopPayments error:', error?.message || error);
    throw error;
  }
}

/**
 * Get shop payment by ID
 */
export async function getShopPayment(payId: string): Promise<any> {
  try {
    const { data: payment, error } = await supabase
      .from('shop_payments')
      .select('*')
      .eq('pay_id', payId)
      .single();

    if (error || !payment) {
      throw new Error(`Payment not found: ${error?.message || 'Unknown error'}`);
    }

    // Fetch customer info
    let customerName = '';
    let shamelNo = '';
    if (payment.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('name, shamel_no')
        .eq('customer_id', payment.customer_id)
        .single();
      customerName = customer?.name || '';
      shamelNo = customer?.shamel_no || '';
    }

    return {
      PayID: payment.pay_id,
      CustomerID: payment.customer_id,
      CustomerName: customerName,
      ShamelNo: shamelNo,
      Date: payment.date,
      CashAmount: parseFloat(String(payment.cash_amount || 0)),
      ChequeAmount: parseFloat(String(payment.cheque_amount || 0)),
      TotalAmount: parseFloat(String(payment.cash_amount || 0)) + parseFloat(String(payment.cheque_amount || 0)),
      Notes: payment.notes || '',
      CreatedAt: payment.created_at,
    };
  } catch (error: any) {
    console.error('[API] getShopPayment error:', error);
    throw error;
  }
}

/**
 * Update Shop Payment (تحديث سند دفع المحل)
 */
export async function updateShopPayment(payId: string, payload: {
  customerID: string;
  date: string; // Format: YYYY-MM-DD
  cashAmount?: number;
  chequeAmount?: number;
  notes?: string;
  created_by?: string; // Admin user ID
}): Promise<any> {
  try {
    console.log('[API] Updating shop payment in Supabase:', payId, payload);

    const paymentData: any = {
      customer_id: payload.customerID,
      date: payload.date,
      cash_amount: payload.cashAmount || 0,
      cheque_amount: payload.chequeAmount || 0,
      notes: payload.notes || null,
    };
    
    // Only update created_by if provided (usually preserve original creator)
    if (payload.created_by !== undefined) {
      paymentData.created_by = payload.created_by;
    }

    const { data, error } = await supabase
      .from('shop_payments')
      .update(paymentData)
      .eq('pay_id', payId)
      .select()
      .single();

    if (error) {
      console.error('[API] Failed to update payment:', error);
      throw new Error(`Failed to update payment: ${error.message}`);
    }

    console.log('[API] Payment updated successfully');
    return { status: 'success', payID: payId, data };
  } catch (error: any) {
    console.error('[API] updateShopPayment error:', error);
    throw error;
  }
}

/**
 * Delete Shop Payment (حذف سند دفع المحل)
 */
export async function deleteShopPayment(payId: string): Promise<any> {
  try {
    console.log('[API] Deleting shop payment from Supabase:', payId);

    const { error } = await supabase
      .from('shop_payments')
      .delete()
      .eq('pay_id', payId);

    if (error) {
      console.error('[API] Failed to delete payment:', error);
      throw new Error(`Failed to delete payment: ${error.message}`);
    }

    console.log('[API] Payment deleted successfully');
    return { status: 'success' };
  } catch (error: any) {
    console.error('[API] deleteShopPayment error:', error);
    throw error;
  }
}

// ==========================================
// SHOP SALES INVOICES (فواتير مبيعات المحل)
// ==========================================

/**
 * Save Shop Sales Invoice (حفظ فاتورة مبيعات المحل)
 */
export async function saveShopSalesInvoice(payload: {
  customerID: string;
  date: string; // Format: YYYY-MM-DD
  items: Array<{
    productID: string;
    quantity: number;
    unitPrice: number;
  }>;
  notes?: string;
  discount?: number;
  status?: 'غير مدفوع' | 'تقسيط شهري' | 'دفعت بالكامل' | 'مدفوع جزئي';
  created_by?: string; // Admin user ID (UUID)
}): Promise<any> {
  try {
    console.log('[API] Saving shop sales invoice to Supabase:', payload);

    // Get count of existing invoices
    const { count, error: countError } = await supabase
      .from('shop_sales_invoices')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('[API] Failed to get invoice count:', countError);
      throw new Error(`Failed to get invoice count: ${countError.message}`);
    }

    const invoiceCount = count || 0;
    const invoiceID = generateShopInvoiceID(invoiceCount);
    console.log('[API] Generated invoice ID:', invoiceID);

    // Insert invoice header
    const invoiceHeader: any = {
      invoice_id: invoiceID,
      date: payload.date,
      customer_id: payload.customerID,
      accountant_sign: 'غير مرحلة',
      notes: payload.notes || null,
      discount: payload.discount || 0,
      status: payload.status || 'غير مدفوع',
      created_by: payload.created_by || null, // Admin user ID
    };

    const { error: headerError } = await supabase
      .from('shop_sales_invoices')
      .insert([invoiceHeader]);

    if (headerError) {
      console.error('[API] Failed to insert invoice header:', headerError);
      throw new Error(`Failed to save invoice header: ${headerError.message}`);
    }

    console.log('[API] Invoice header inserted successfully');

    // Insert invoice details
    if (!payload.items || payload.items.length === 0) {
      throw new Error('Cannot save invoice without items');
    }

    const invoiceDetails = payload.items.map((item) => {
      const detail: any = {
        invoice_id: invoiceID,
        product_id: item.productID,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      };
      // Generate UUID for details_id if crypto.randomUUID is available
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        detail.details_id = crypto.randomUUID();
      }
      return detail;
    });

    const { error: detailsError } = await supabase
      .from('shop_sales_details')
      .insert(invoiceDetails);

    if (detailsError) {
      console.error('[API] Failed to insert invoice details:', detailsError);
      // Try to delete the header if details insertion fails
      await supabase.from('shop_sales_invoices').delete().eq('invoice_id', invoiceID);
      throw new Error(`Failed to save invoice details: ${detailsError.message}`);
    }

    console.log('[API] Shop sales invoice saved successfully');
    return { status: 'success', invoiceID, data: { invoiceID, ...invoiceHeader } };
  } catch (error: any) {
    console.error('[API] saveShopSalesInvoice error:', error);
    throw error;
  }
}

/**
 * Get shop sales invoices from Supabase with pagination
 */
export async function getShopSalesInvoices(page: number = 1, pageSize: number = 20, searchQuery?: string): Promise<{ invoices: any[]; total: number }> {
  try {
    console.log('[API] Fetching shop sales invoices from Supabase...', { page, pageSize, searchQuery });

    // Calculate pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // If search query provided, find matching customer IDs first
    let customerIdsToSearch: string[] = [];
    if (searchQuery && searchQuery.trim()) {
      const search = searchQuery.trim();
      const { data: matchingCustomers } = await supabase
        .from('customers')
        .select('customer_id')
        .or(`name.ilike.%${search}%,customer_id.ilike.%${search}%`);
      
      if (matchingCustomers) {
        customerIdsToSearch = matchingCustomers.map(c => c.customer_id);
      }
    }

    // Build base queries
    let countQuery = supabase
      .from('shop_sales_invoices')
      .select('*', { count: 'exact', head: true });

    let dataQuery = supabase
      .from('shop_sales_invoices')
      .select('*');

    // Apply search filters
    if (searchQuery && searchQuery.trim()) {
      const search = searchQuery.trim();
      
      if (customerIdsToSearch.length > 0) {
        // Search in invoice_id OR customer_id (direct match) OR customer_id in matching list
        // We'll fetch both sets and combine them
        // First, get invoices matching invoice_id or customer_id directly
        const { data: directMatches } = await supabase
          .from('shop_sales_invoices')
          .select('invoice_id')
          .or(`invoice_id.ilike.%${search}%,customer_id.ilike.%${search}%`);
        
        const directMatchIds = directMatches?.map(i => i.invoice_id) || [];
        
        // Then get invoices matching customer IDs
        const { data: customerMatches } = await supabase
          .from('shop_sales_invoices')
          .select('invoice_id')
          .in('customer_id', customerIdsToSearch);
        
        const customerMatchIds = customerMatches?.map(i => i.invoice_id) || [];
        
        // Combine and get unique IDs
        const allMatchIds = [...new Set([...directMatchIds, ...customerMatchIds])];
        
        if (allMatchIds.length > 0) {
          countQuery = countQuery.in('invoice_id', allMatchIds);
          dataQuery = dataQuery.in('invoice_id', allMatchIds);
        } else {
          // No matches found
          countQuery = countQuery.eq('invoice_id', 'NO_MATCHES');
          dataQuery = dataQuery.eq('invoice_id', 'NO_MATCHES');
        }
      } else {
        // Only search in invoice_id and customer_id if no matching customers found
        countQuery = countQuery.or(`invoice_id.ilike.%${search}%,customer_id.ilike.%${search}%`);
        dataQuery = dataQuery.or(`invoice_id.ilike.%${search}%,customer_id.ilike.%${search}%`);
      }
    }

    // Get total count
    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('[API] Error getting invoice count:', countError);
      throw new Error(`Failed to get invoice count: ${countError.message}`);
    }

    const total = count || 0;

    // Fetch invoices with pagination - newest first
    const { data: invoices, error } = await dataQuery
      .order('created_at', { ascending: false })
      .order('date', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[API] Supabase error:', error);
      throw new Error(`Failed to fetch invoices: ${error.message}`);
    }

    if (!invoices || !Array.isArray(invoices)) {
      console.error('[API] Invalid invoices data:', invoices);
      throw new Error('Invalid response format: No invoices array found');
    }

    // Get unique customer IDs
    const customerIds = [...new Set(invoices.map(i => i.customer_id).filter(Boolean))];
    
    // Fetch all customer names and shamel_no in one query
    let customerMap = new Map<string, { name: string; shamelNo: string }>();
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('customers')
        .select('customer_id, name, shamel_no')
        .in('customer_id', customerIds);
      
      if (customers) {
        customers.forEach((c: any) => {
          customerMap.set(c.customer_id, {
            name: c.name || '',
            shamelNo: c.shamel_no || ''
          });
        });
      }
    }

    // Fetch details for each invoice individually (same method as quotations - more reliable)
    const mappedInvoices = await Promise.all(invoices.map(async (invoice: any) => {
      const invoiceId = invoice.invoice_id;
      
      // Fetch details for this invoice
      const { data: details, error: detailsError } = await supabase
        .from('shop_sales_details')
        .select('quantity, unit_price')
        .eq('invoice_id', invoiceId);
      
      if (detailsError) {
        console.error(`[API] Error fetching details for invoice ${invoiceId}:`, detailsError);
      }
      
      // Calculate subtotal from details
      const subtotal = (details || []).reduce((sum: number, detail: any) => {
        const quantity = parseFloat(String(detail.quantity || 0));
        const unitPrice = parseFloat(String(detail.unit_price || 0));
        return sum + (quantity * unitPrice);
      }, 0);
      
      const discount = parseFloat(String(invoice.discount || 0));
      const total = Math.max(0, subtotal - discount);
      
      const customer = customerMap.get(invoice.customer_id) || { name: '', shamelNo: '' };

      return {
        InvoiceID: invoice.invoice_id,
        CustomerID: invoice.customer_id,
        CustomerName: customer.name,
        CustomerShamelNo: customer.shamelNo,
        Date: invoice.date,
        AccountantSign: invoice.accountant_sign,
        Notes: invoice.notes || '',
        Discount: discount,
        Status: invoice.status,
        TotalAmount: total,
        CreatedAt: invoice.created_at,
        created_by: invoice.created_by || null,
        createdBy: invoice.created_by || null,
        user_id: invoice.created_by || null,
      };
    }));

    console.log(`[API] Shop sales invoices loaded: ${mappedInvoices.length} of ${total}`);
    return { invoices: mappedInvoices, total };
  } catch (error: any) {
    console.error('[API] getShopSalesInvoices error:', error?.message || error);
    throw error;
  }
}

/**
 * Get shop sales invoice by ID
 */
export async function getShopSalesInvoice(invoiceId: string): Promise<any> {
  try {
    const { data: invoice, error } = await supabase
      .from('shop_sales_invoices')
      .select('*')
      .eq('invoice_id', invoiceId)
      .single();

    if (error || !invoice) {
      throw new Error(`Invoice not found: ${error?.message || 'Unknown error'}`);
    }

    // Fetch customer info
    let customerName = '';
    let customerShamelNo = '';
    let customerPhone = '';
    let customerAddress = '';
    if (invoice.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('name, phone, email, address, shamel_no')
        .eq('customer_id', invoice.customer_id)
        .single();
      customerName = customer?.name || '';
      customerShamelNo = customer?.shamel_no || '';
      customerPhone = customer?.phone || '';
      customerAddress = customer?.address || '';
    }

    // Fetch invoice details
    const { data: details, error: detailsError } = await supabase
      .from('shop_sales_details')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: true });

    if (detailsError) {
      console.error('[API] Failed to fetch invoice details:', detailsError);
    }

    // Fetch product information for details
    const productIds = (details || []).map((d: any) => d.product_id).filter(Boolean);
    let productsMap = new Map<string, any>();
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('product_id, name, barcode, shamel_no')
        .in('product_id', productIds);
      
      if (products) {
        products.forEach((p: any) => {
          productsMap.set(p.product_id, p);
        });
      }
    }

    const mappedDetails = (details || []).map((detail: any) => {
      const product = productsMap.get(detail.product_id);
      return {
        DetailsID: detail.details_id,
        InvoiceID: detail.invoice_id,
        ProductID: detail.product_id,
        ProductName: product?.name || '',
        ShamelNo: product?.shamel_no || '',
        Quantity: parseFloat(String(detail.quantity || 0)),
        UnitPrice: parseFloat(String(detail.unit_price || 0)),
        TotalPrice: parseFloat(String(detail.quantity || 0)) * parseFloat(String(detail.unit_price || 0)),
      };
    });

    const subtotal = mappedDetails.reduce((sum, d) => sum + d.TotalPrice, 0);
    const discount = parseFloat(String(invoice.discount || 0));
    const total = subtotal - discount;

    return {
      InvoiceID: invoice.invoice_id,
      CustomerID: invoice.customer_id,
      CustomerName: customerName,
      CustomerShamelNo: customerShamelNo,
      CustomerPhone: customerPhone,
      CustomerAddress: customerAddress,
      Date: invoice.date,
      AccountantSign: invoice.accountant_sign,
      Notes: invoice.notes || '',
      Discount: discount,
      Status: invoice.status,
      Subtotal: subtotal,
      TotalAmount: total,
      Items: mappedDetails,
      CreatedAt: invoice.created_at,
    };
  } catch (error: any) {
    console.error('[API] getShopSalesInvoice error:', error);
    throw error;
  }
}

/**
 * Update shop sales invoice accountant sign
 */
export async function updateShopSalesInvoiceSign(invoiceId: string, accountantSign: 'مرحلة' | 'غير مرحلة'): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('shop_sales_invoices')
      .update({ accountant_sign: accountantSign })
      .eq('invoice_id', invoiceId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update invoice sign: ${error.message}`);
    }

    return { status: 'success', data };
  } catch (error: any) {
    console.error('[API] updateShopSalesInvoiceSign error:', error);
    throw error;
  }
}

/**
 * Update shop sales invoice status
 */
export async function updateShopSalesInvoiceStatus(
  invoiceId: string,
  status: 'غير مدفوع' | 'تقسيط شهري' | 'دفعت بالكامل' | 'مدفوع جزئي'
): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('shop_sales_invoices')
      .update({ status })
      .eq('invoice_id', invoiceId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update invoice status: ${error.message}`);
    }

    return { status: 'success', data };
  } catch (error: any) {
    console.error('[API] updateShopSalesInvoiceStatus error:', error);
    throw error;
  }
}

/**
 * Update shop sales invoice (header and items)
 */
export async function updateShopSalesInvoice(
  invoiceId: string,
  payload: {
    customerID?: string;
    date?: string;
    notes?: string;
    discount?: number;
    status?: 'غير مدفوع' | 'تقسيط شهري' | 'دفعت بالكامل' | 'مدفوع جزئي';
    itemsToUpdate?: Array<{
      detailID: string;
      productID: string;
      quantity: number;
      unitPrice: number;
    }>;
    itemsToAdd?: Array<{
      productID: string;
      quantity: number;
      unitPrice: number;
    }>;
    itemIDsToDelete?: string[];
  }
): Promise<any> {
  try {
    console.log('[API] Updating shop sales invoice:', invoiceId, payload);

    // Update invoice header if any header fields are provided
    const headerUpdates: any = {};
    if (payload.customerID !== undefined) headerUpdates.customer_id = payload.customerID;
    if (payload.date !== undefined) headerUpdates.date = payload.date;
    if (payload.notes !== undefined) headerUpdates.notes = payload.notes || null;
    if (payload.discount !== undefined) headerUpdates.discount = payload.discount || 0;
    if (payload.status !== undefined) headerUpdates.status = payload.status;

    if (Object.keys(headerUpdates).length > 0) {
      const { error: headerError } = await supabase
        .from('shop_sales_invoices')
        .update(headerUpdates)
        .eq('invoice_id', invoiceId);

      if (headerError) {
        throw new Error(`Failed to update invoice header: ${headerError.message}`);
      }
    }

    // Delete items if specified
    if (payload.itemIDsToDelete && payload.itemIDsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('shop_sales_details')
        .delete()
        .in('details_id', payload.itemIDsToDelete);

      if (deleteError) {
        throw new Error(`Failed to delete invoice items: ${deleteError.message}`);
      }
    }

    // Update existing items if specified
    if (payload.itemsToUpdate && payload.itemsToUpdate.length > 0) {
      for (const item of payload.itemsToUpdate) {
        const { error: updateError } = await supabase
          .from('shop_sales_details')
          .update({
            product_id: item.productID,
            quantity: item.quantity,
            unit_price: item.unitPrice,
          })
          .eq('details_id', item.detailID);

        if (updateError) {
          throw new Error(`Failed to update invoice item: ${updateError.message}`);
        }
      }
    }

    // Add new items if specified
    if (payload.itemsToAdd && payload.itemsToAdd.length > 0) {
      const newItems = payload.itemsToAdd.map((item) => ({
        invoice_id: invoiceId,
        product_id: item.productID,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      }));

      const { error: insertError } = await supabase
        .from('shop_sales_details')
        .insert(newItems);

      if (insertError) {
        throw new Error(`Failed to add invoice items: ${insertError.message}`);
      }
    }

    console.log('[API] Shop sales invoice updated successfully');
    return { status: 'success', invoiceID: invoiceId };
  } catch (error: any) {
    console.error('[API] updateShopSalesInvoice error:', error);
    throw error;
  }
}

/**
 * Delete shop sales invoice
 */
export async function deleteShopSalesInvoice(invoiceId: string): Promise<any> {
  try {
    console.log('[API] Deleting shop sales invoice:', invoiceId);

    // Delete details first (CASCADE should handle this, but being explicit)
    const { error: detailsError } = await supabase
      .from('shop_sales_details')
      .delete()
      .eq('invoice_id', invoiceId);

    if (detailsError) {
      console.warn('[API] Error deleting invoice details (may be handled by CASCADE):', detailsError);
    }

    // Delete invoice header
    const { error: headerError } = await supabase
      .from('shop_sales_invoices')
      .delete()
      .eq('invoice_id', invoiceId);

    if (headerError) {
      throw new Error(`Failed to delete invoice: ${headerError.message}`);
    }

    console.log('[API] Shop sales invoice deleted successfully');
    return { status: 'success' };
  } catch (error: any) {
    console.error('[API] deleteShopSalesInvoice error:', error);
    throw error;
  }
}

// ==========================================
// WAREHOUSE SALES INVOICES (فواتير مبيعات المخزن)
// ==========================================

/**
 * Save Warehouse Sales Invoice (حفظ فاتورة مبيعات المخزن)
 */
export async function saveWarehouseSalesInvoice(payload: {
  customerID: string;
  date: string; // Format: YYYY-MM-DD
  items: Array<{
    productID: string;
    quantity: number;
    unitPrice: number;
  }>;
  notes?: string;
  discount?: number;
  status?: 'غير مدفوع' | 'تقسيط شهري' | 'دفعت بالكامل' | 'مدفوع جزئي';
  created_by?: string; // Admin user ID (UUID)
}): Promise<any> {
  try {
    console.log('[API] Saving warehouse sales invoice to Supabase:', payload);

    // Get count of existing invoices
    const { count, error: countError } = await supabase
      .from('warehouse_sales_invoices')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('[API] Failed to get invoice count:', countError);
      throw new Error(`Failed to get invoice count: ${countError.message}`);
    }

    const invoiceCount = count || 0;
    const invoiceID = generateWarehouseInvoiceID(invoiceCount);
    console.log('[API] Generated invoice ID:', invoiceID);

    // Insert invoice header
    const invoiceHeader: any = {
      invoice_id: invoiceID,
      date: payload.date,
      customer_id: payload.customerID,
      accountant_sign: 'غير مرحلة',
      notes: payload.notes || null,
      discount: payload.discount || 0,
      status: payload.status || 'غير مدفوع',
      created_by: payload.created_by || null, // Admin user ID
    };

    const { error: headerError } = await supabase
      .from('warehouse_sales_invoices')
      .insert([invoiceHeader]);

    if (headerError) {
      console.error('[API] Failed to insert invoice header:', headerError);
      throw new Error(`Failed to save invoice header: ${headerError.message}`);
    }

    console.log('[API] Invoice header inserted successfully');

    // Insert invoice details
    if (!payload.items || payload.items.length === 0) {
      throw new Error('Cannot save invoice without items');
    }

    const invoiceDetails = payload.items.map((item) => {
      const detail: any = {
        invoice_id: invoiceID,
        product_id: item.productID,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      };
      // Generate UUID for details_id if crypto.randomUUID is available
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        detail.details_id = crypto.randomUUID();
      }
      return detail;
    });

    const { error: detailsError } = await supabase
      .from('warehouse_sales_details')
      .insert(invoiceDetails);

    if (detailsError) {
      console.error('[API] Failed to insert invoice details:', detailsError);
      // Try to delete the header if details insertion fails
      await supabase.from('warehouse_sales_invoices').delete().eq('invoice_id', invoiceID);
      throw new Error(`Failed to save invoice details: ${detailsError.message}`);
    }

    console.log('[API] Warehouse sales invoice saved successfully');
    return { status: 'success', invoiceID, data: { invoiceID, ...invoiceHeader } };
  } catch (error: any) {
    console.error('[API] saveWarehouseSalesInvoice error:', error);
    throw error;
  }
}

/**
 * Get warehouse sales invoices from Supabase with pagination
 */
export async function getWarehouseSalesInvoices(page: number = 1, pageSize: number = 20, searchQuery?: string): Promise<{ invoices: any[]; total: number }> {
  try {
    console.log('[API] Fetching warehouse sales invoices from Supabase...', { page, pageSize, searchQuery });

    // Calculate pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // If search query provided, find matching customer IDs first
    let customerIdsToSearch: string[] = [];
    if (searchQuery && searchQuery.trim()) {
      const search = searchQuery.trim();
      const { data: matchingCustomers } = await supabase
        .from('customers')
        .select('customer_id')
        .or(`name.ilike.%${search}%,customer_id.ilike.%${search}%`);
      
      if (matchingCustomers) {
        customerIdsToSearch = matchingCustomers.map(c => c.customer_id);
      }
    }

    // Build base queries
    let countQuery = supabase
      .from('warehouse_sales_invoices')
      .select('*', { count: 'exact', head: true });

    let dataQuery = supabase
      .from('warehouse_sales_invoices')
      .select('*');

    // Apply search filters
    if (searchQuery && searchQuery.trim()) {
      const search = searchQuery.trim();
      
      if (customerIdsToSearch.length > 0) {
        // Search in invoice_id OR customer_id (direct match) OR customer_id in matching list
        // First, get invoices matching invoice_id or customer_id directly
        const { data: directMatches } = await supabase
          .from('warehouse_sales_invoices')
          .select('invoice_id')
          .or(`invoice_id.ilike.%${search}%,customer_id.ilike.%${search}%`);
        
        const directMatchIds = directMatches?.map(i => i.invoice_id) || [];
        
        // Then get invoices matching customer IDs
        const { data: customerMatches } = await supabase
          .from('warehouse_sales_invoices')
          .select('invoice_id')
          .in('customer_id', customerIdsToSearch);
        
        const customerMatchIds = customerMatches?.map(i => i.invoice_id) || [];
        
        // Combine and get unique IDs
        const allMatchIds = [...new Set([...directMatchIds, ...customerMatchIds])];
        
        if (allMatchIds.length > 0) {
          countQuery = countQuery.in('invoice_id', allMatchIds);
          dataQuery = dataQuery.in('invoice_id', allMatchIds);
        } else {
          // No matches found
          countQuery = countQuery.eq('invoice_id', 'NO_MATCHES');
          dataQuery = dataQuery.eq('invoice_id', 'NO_MATCHES');
        }
      } else {
        // Only search in invoice_id and customer_id if no matching customers found
        countQuery = countQuery.or(`invoice_id.ilike.%${search}%,customer_id.ilike.%${search}%`);
        dataQuery = dataQuery.or(`invoice_id.ilike.%${search}%,customer_id.ilike.%${search}%`);
      }
    }

    // Get total count
    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('[API] Error getting invoice count:', countError);
      throw new Error(`Failed to get invoice count: ${countError.message}`);
    }

    const total = count || 0;

    // Fetch invoices with pagination - newest first
    const { data: invoices, error } = await dataQuery
      .order('created_at', { ascending: false })
      .order('date', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[API] Supabase error:', error);
      throw new Error(`Failed to fetch invoices: ${error.message}`);
    }

    if (!invoices || !Array.isArray(invoices)) {
      console.error('[API] Invalid invoices data:', invoices);
      throw new Error('Invalid response format: No invoices array found');
    }

    // Get unique customer IDs
    const customerIds = [...new Set(invoices.map(i => i.customer_id).filter(Boolean))];
    
    // Fetch all customer names and shamel_no in one query
    let customerMap = new Map<string, { name: string; shamelNo: string }>();
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('customers')
        .select('customer_id, name, shamel_no')
        .in('customer_id', customerIds);
      
      if (customers) {
        customers.forEach((c: any) => {
          customerMap.set(c.customer_id, {
            name: c.name || '',
            shamelNo: c.shamel_no || ''
          });
        });
      }
    }

    // Fetch details for each invoice individually (same method as quotations - more reliable)
    const mappedInvoices = await Promise.all(invoices.map(async (invoice: any) => {
      const invoiceId = invoice.invoice_id;
      
      // Fetch details for this invoice
      const { data: details, error: detailsError } = await supabase
        .from('warehouse_sales_details')
        .select('quantity, unit_price')
        .eq('invoice_id', invoiceId);
      
      if (detailsError) {
        console.error(`[API] Error fetching details for invoice ${invoiceId}:`, detailsError);
      }
      
      // Calculate subtotal from details
      const subtotal = (details || []).reduce((sum: number, detail: any) => {
        const quantity = parseFloat(String(detail.quantity || 0));
        const unitPrice = parseFloat(String(detail.unit_price || 0));
        return sum + (quantity * unitPrice);
      }, 0);
      
      const discount = parseFloat(String(invoice.discount || 0));
      const total = Math.max(0, subtotal - discount);
      
      const customer = customerMap.get(invoice.customer_id) || { name: '', shamelNo: '' };

      return {
        InvoiceID: invoice.invoice_id,
        CustomerID: invoice.customer_id,
        CustomerName: customer.name,
        CustomerShamelNo: customer.shamelNo,
        Date: invoice.date,
        AccountantSign: invoice.accountant_sign,
        Notes: invoice.notes || '',
        Discount: discount,
        Status: invoice.status,
        TotalAmount: total,
        CreatedAt: invoice.created_at,
        created_by: invoice.created_by || null,
        createdBy: invoice.created_by || null,
        user_id: invoice.created_by || null,
      };
    }));

    console.log(`[API] Warehouse sales invoices loaded: ${mappedInvoices.length} of ${total}`);
    return { invoices: mappedInvoices, total };
  } catch (error: any) {
    console.error('[API] getWarehouseSalesInvoices error:', error?.message || error);
    throw error;
  }
}

/**
 * Get warehouse sales invoice by ID
 */
export async function getWarehouseSalesInvoice(invoiceId: string): Promise<any> {
  try {
    const { data: invoice, error } = await supabase
      .from('warehouse_sales_invoices')
      .select('*')
      .eq('invoice_id', invoiceId)
      .single();

    if (error || !invoice) {
      throw new Error(`Invoice not found: ${error?.message || 'Unknown error'}`);
    }

    // Fetch customer info
    let customerName = '';
    let customerShamelNo = '';
    let customerPhone = '';
    let customerAddress = '';
    if (invoice.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('name, phone, email, address, shamel_no')
        .eq('customer_id', invoice.customer_id)
        .single();
      customerName = customer?.name || '';
      customerShamelNo = customer?.shamel_no || '';
      customerPhone = customer?.phone || '';
      customerAddress = customer?.address || '';
    }

    // Fetch invoice details
    const { data: details, error: detailsError } = await supabase
      .from('warehouse_sales_details')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: true });

    if (detailsError) {
      console.error('[API] Failed to fetch invoice details:', detailsError);
    }

    // Fetch product information for details
    const productIds = (details || []).map((d: any) => d.product_id).filter(Boolean);
    let productsMap = new Map<string, any>();
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('product_id, name, barcode, shamel_no')
        .in('product_id', productIds);
      
      if (products) {
        products.forEach((p: any) => {
          productsMap.set(p.product_id, p);
        });
      }
    }

    const mappedDetails = (details || []).map((detail: any) => {
      const product = productsMap.get(detail.product_id);
      return {
        DetailsID: detail.details_id,
        InvoiceID: detail.invoice_id,
        ProductID: detail.product_id,
        ProductName: product?.name || '',
        ShamelNo: product?.shamel_no || '',
        Quantity: parseFloat(String(detail.quantity || 0)),
        UnitPrice: parseFloat(String(detail.unit_price || 0)),
        TotalPrice: parseFloat(String(detail.quantity || 0)) * parseFloat(String(detail.unit_price || 0)),
      };
    });

    const subtotal = mappedDetails.reduce((sum, d) => sum + d.TotalPrice, 0);
    const discount = parseFloat(String(invoice.discount || 0));
    const total = subtotal - discount;

    return {
      InvoiceID: invoice.invoice_id,
      CustomerID: invoice.customer_id,
      CustomerName: customerName,
      CustomerShamelNo: customerShamelNo,
      CustomerPhone: customerPhone,
      CustomerAddress: customerAddress,
      Date: invoice.date,
      AccountantSign: invoice.accountant_sign,
      Notes: invoice.notes || '',
      Discount: discount,
      Status: invoice.status,
      Subtotal: subtotal,
      TotalAmount: total,
      Items: mappedDetails,
      CreatedAt: invoice.created_at,
    };
  } catch (error: any) {
    console.error('[API] getWarehouseSalesInvoice error:', error);
    throw error;
  }
}

/**
 * Update warehouse sales invoice accountant sign
 */
export async function updateWarehouseSalesInvoiceSign(invoiceId: string, accountantSign: 'مرحلة' | 'غير مرحلة'): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('warehouse_sales_invoices')
      .update({ accountant_sign: accountantSign })
      .eq('invoice_id', invoiceId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update invoice sign: ${error.message}`);
    }

    return { status: 'success', data };
  } catch (error: any) {
    console.error('[API] updateWarehouseSalesInvoiceSign error:', error);
    throw error;
  }
}

/**
 * Update warehouse sales invoice status
 */
export async function updateWarehouseSalesInvoiceStatus(
  invoiceId: string,
  status: 'غير مدفوع' | 'تقسيط شهري' | 'دفعت بالكامل' | 'مدفوع جزئي'
): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('warehouse_sales_invoices')
      .update({ status })
      .eq('invoice_id', invoiceId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update invoice status: ${error.message}`);
    }

    return { status: 'success', data };
  } catch (error: any) {
    console.error('[API] updateWarehouseSalesInvoiceStatus error:', error);
    throw error;
  }
}

/**
 * Update warehouse sales invoice
 */
export async function updateWarehouseSalesInvoice(
  invoiceId: string,
  payload: {
    customerID?: string;
    date?: string;
    notes?: string;
    discount?: number;
    status?: 'غير مدفوع' | 'تقسيط شهري' | 'دفعت بالكامل' | 'مدفوع جزئي';
    itemsToUpdate?: Array<{
      detailID: string;
      productID: string;
      quantity: number;
      unitPrice: number;
    }>;
    itemsToAdd?: Array<{
      productID: string;
      quantity: number;
      unitPrice: number;
    }>;
    itemIDsToDelete?: string[];
  }
): Promise<any> {
  try {
    console.log('[API] Updating warehouse sales invoice:', invoiceId, payload);

    // Update invoice header if any header fields are provided
    const headerUpdates: any = {};
    if (payload.customerID !== undefined) headerUpdates.customer_id = payload.customerID;
    if (payload.date !== undefined) headerUpdates.date = payload.date;
    if (payload.notes !== undefined) headerUpdates.notes = payload.notes || null;
    if (payload.discount !== undefined) headerUpdates.discount = payload.discount || 0;
    if (payload.status !== undefined) headerUpdates.status = payload.status;

    if (Object.keys(headerUpdates).length > 0) {
      const { error: headerError } = await supabase
        .from('warehouse_sales_invoices')
        .update(headerUpdates)
        .eq('invoice_id', invoiceId);

      if (headerError) {
        throw new Error(`Failed to update invoice header: ${headerError.message}`);
      }
    }

    // Delete items if specified
    if (payload.itemIDsToDelete && payload.itemIDsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('warehouse_sales_details')
        .delete()
        .in('details_id', payload.itemIDsToDelete);

      if (deleteError) {
        throw new Error(`Failed to delete invoice items: ${deleteError.message}`);
      }
    }

    // Update existing items if specified
    if (payload.itemsToUpdate && payload.itemsToUpdate.length > 0) {
      for (const item of payload.itemsToUpdate) {
        const { error: updateError } = await supabase
          .from('warehouse_sales_details')
          .update({
            product_id: item.productID,
            quantity: item.quantity,
            unit_price: item.unitPrice,
          })
          .eq('details_id', item.detailID);

        if (updateError) {
          throw new Error(`Failed to update invoice item: ${updateError.message}`);
        }
      }
    }

    // Add new items if specified
    if (payload.itemsToAdd && payload.itemsToAdd.length > 0) {
      const newItems = payload.itemsToAdd.map((item) => ({
        invoice_id: invoiceId,
        product_id: item.productID,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      }));

      const { error: insertError } = await supabase
        .from('warehouse_sales_details')
        .insert(newItems);

      if (insertError) {
        throw new Error(`Failed to add invoice items: ${insertError.message}`);
      }
    }

    console.log('[API] Warehouse sales invoice updated successfully');
    return { status: 'success', invoiceID: invoiceId };
  } catch (error: any) {
    console.error('[API] updateWarehouseSalesInvoice error:', error);
    throw error;
  }
}

/**
 * Delete warehouse sales invoice
 */
export async function deleteWarehouseSalesInvoice(invoiceId: string): Promise<any> {
  try {
    console.log('[API] Deleting warehouse sales invoice:', invoiceId);

    // Delete details first (CASCADE should handle this, but being explicit)
    const { error: detailsError } = await supabase
      .from('warehouse_sales_details')
      .delete()
      .eq('invoice_id', invoiceId);

    if (detailsError) {
      console.warn('[API] Error deleting invoice details (may be handled by CASCADE):', detailsError);
    }

    // Delete invoice header
    const { error: headerError } = await supabase
      .from('warehouse_sales_invoices')
      .delete()
      .eq('invoice_id', invoiceId);

    if (headerError) {
      throw new Error(`Failed to delete invoice: ${headerError.message}`);
    }

    console.log('[API] Warehouse sales invoice deleted successfully');
    return { status: 'success' };
  } catch (error: any) {
    console.error('[API] deleteWarehouseSalesInvoice error:', error);
    throw error;
  }
}

/**
 * Generate maintenance number in format: MNT-XXXX-YYY
 * Where XXXX is padded count and YYY is random 3-digit number (100-999)
 */
function generateMaintenanceNo(count: number): string {
  const paddedCount = String(count + 1).padStart(4, '0');
  const random = Math.floor(Math.random() * (999 - 100 + 1)) + 100;
  return `MNT-${paddedCount}-${random}`;
}

/**
 * Save new maintenance record
 */
export async function saveMaintenance(payload: {
  customerID: string;
  itemName: string;
  location: 'المحل' | 'المخزن';
  company?: string;
  dateOfPurchase?: string; // Format: YYYY-MM-DD
  dateOfReceive: string; // Format: YYYY-MM-DD
  problem?: string;
  imageOfItem?: string;
  imageOfProblem?: string;
  imageOfWarranty?: string;
  status?: 'موجودة في المحل وجاهزة للتسليم' | 'موجودة في المخزن وجاهزة للتسليم' | 'موجودة في الشركة' | 'جاهزة للتسليم للزبون من المحل' | 'جاهزة للتسليم للزبون من المخزن' | 'سلمت للزبون' | 'تم ارجاعها للشركة وخصمها للزبون';
  serialNo?: string;
  underWarranty?: 'YES' | 'NO';
  created_by?: string; // Admin user ID (UUID)
}): Promise<any> {
  try {
    console.log('[API] Saving maintenance record:', payload);

    // Get current count
    const { count } = await supabase
      .from('maintenance')
      .select('*', { count: 'exact', head: true });

    const maintNo = generateMaintenanceNo(count || 0);
    console.log('[API] Generated maintenance number:', maintNo);

    // Insert maintenance record
    const maintenanceRecord: any = {
      maint_no: maintNo,
      customer_id: payload.customerID,
      item_name: payload.itemName,
      location: payload.location,
      company: payload.company || null,
      date_of_purchase: payload.dateOfPurchase || null,
      date_of_receive: payload.dateOfReceive,
      problem: payload.problem || null,
      image_of_item: payload.imageOfItem || null,
      image_of_problem: payload.imageOfProblem || null,
      image_of_warranty: payload.imageOfWarranty || null,
      status: payload.status || 'موجودة في المحل وجاهزة للتسليم',
      serial_no: payload.serialNo || null,
      under_warranty: payload.underWarranty || 'NO',
      created_by: payload.created_by || null, // Admin user ID
    };

    const { data, error } = await supabase
      .from('maintenance')
      .insert(maintenanceRecord)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save maintenance record: ${error.message}`);
    }

    console.log('[API] Maintenance record saved successfully');
    return data;
  } catch (error: any) {
    console.error('[API] saveMaintenance error:', error);
    throw error;
  }
}

/**
 * Get all maintenance records
 */
export async function getAllMaintenance(limit: number = 1000): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('maintenance')
      .select(`
        *,
        customers:customer_id (
          customer_id,
          name,
          phone,
          email,
          address,
          shamel_no
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch maintenance records: ${error.message}`);
    }

    // Transform data to match frontend interface
    return (data || []).map((record: any) => {
      const customer = record.customers || {};
      return {
        MaintNo: record.maint_no,
        CustomerID: record.customer_id,
        CustomerName: customer.name || '',
        ItemName: record.item_name,
        Location: record.location,
        Company: record.company || '',
        DateOfPurchase: record.date_of_purchase || '',
        DateOfReceive: record.date_of_receive,
        Problem: record.problem || '',
        ImageOfItem: record.image_of_item || '',
        ImageOfProblem: record.image_of_problem || '',
        ImageOfWarranty: record.image_of_warranty || '',
        Status: record.status,
        SerialNo: record.serial_no || '',
        UnderWarranty: record.under_warranty,
        CreatedAt: record.created_at,
        UpdatedAt: record.updated_at,
        created_by: record.created_by || null,
        createdBy: record.created_by || null,
        user_id: record.created_by || null,
        CostAmount: record.cost_amount || null,
        CostReason: record.cost_reason || null,
        IsPaid: record.is_paid || false,
      };
    });
  } catch (error: any) {
    console.error('[API] getAllMaintenance error:', error);
    throw error;
  }
}

/**
 * Get single maintenance record by ID
 */
export async function getMaintenance(maintNo: string): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('maintenance')
      .select(`
        *,
        customers:customer_id (
          customer_id,
          name,
          phone,
          email,
          address,
          shamel_no
        )
      `)
      .eq('maint_no', maintNo)
      .single();

    if (error) {
      throw new Error(`Failed to fetch maintenance record: ${error.message}`);
    }

    if (!data) {
      throw new Error('Maintenance record not found');
    }

    const customer = data.customers || {};
    return {
      MaintNo: data.maint_no,
      CustomerID: data.customer_id,
      CustomerName: customer.name || '',
      CustomerPhone: customer.phone || '',
      ItemName: data.item_name,
      Location: data.location,
      Company: data.company || '',
      DateOfPurchase: data.date_of_purchase || '',
      DateOfReceive: data.date_of_receive,
      Problem: data.problem || '',
      ImageOfItem: data.image_of_item || '',
      ImageOfProblem: data.image_of_problem || '',
      ImageOfWarranty: data.image_of_warranty || '',
      Status: data.status,
      SerialNo: data.serial_no || '',
      UnderWarranty: data.under_warranty,
      CreatedAt: data.created_at,
      created_by: data.created_by || null,
      createdBy: data.created_by || null,
      user_id: data.created_by || null,
      UpdatedAt: data.updated_at,
      CostAmount: data.cost_amount || null,
      CostReason: data.cost_reason || null,
      IsPaid: data.is_paid || false,
    };
  } catch (error: any) {
    console.error('[API] getMaintenance error:', error);
    throw error;
  }
}

/**
 * Maintenance History interface
 */
export interface MaintenanceHistory {
  history_id: string;
  maintenance_id: string;
  status_from: string;
  status_to: string;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

/**
 * Get maintenance history for a specific maintenance record
 */
export async function getMaintenanceHistory(maintNo: string): Promise<MaintenanceHistory[]> {
  try {
    console.log('[API] Fetching maintenance history for:', maintNo);

    // Verify maintenance record exists
    const { data: maintRecord, error: maintError } = await supabase
      .from('maintenance')
      .select('maint_no')
      .eq('maint_no', maintNo)
      .single();

    if (maintError || !maintRecord) {
      throw new Error(`Maintenance record not found: ${maintError?.message || 'Unknown error'}`);
    }

    // Fetch history records - maintenance_id stores the maint_no (TEXT)
    const { data, error } = await supabase
      .from('maintenance_history')
      .select('*')
      .eq('maintenance_id', maintNo)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch maintenance history: ${error.message}`);
    }

    console.log(`[API] Found ${data?.length || 0} history records`);
    return (data || []) as MaintenanceHistory[];
  } catch (error: any) {
    console.error('[API] getMaintenanceHistory error:', error);
    throw error;
  }
}

/**
 * Delete maintenance history entry
 */
export async function deleteMaintenanceHistory(historyId: string): Promise<void> {
  try {
    console.log('[API] Deleting maintenance history entry:', historyId);

    const { error } = await supabase
      .from('maintenance_history')
      .delete()
      .eq('history_id', historyId);

    if (error) {
      throw new Error(`Failed to delete maintenance history entry: ${error.message}`);
    }

    console.log('[API] Maintenance history entry deleted successfully');
  } catch (error: any) {
    console.error('[API] deleteMaintenanceHistory error:', error);
    throw error;
  }
}

/**
 * Update maintenance record
 * Now supports history logging when status changes
 */
export async function updateMaintenance(
  maintNo: string,
  payload: {
    customerID?: string;
    itemName?: string;
    location?: 'المحل' | 'المخزن';
    company?: string;
    dateOfPurchase?: string;
    dateOfReceive?: string;
    problem?: string;
    imageOfItem?: string;
    imageOfProblem?: string;
    imageOfWarranty?: string;
    status?: 'موجودة في المحل وجاهزة للتسليم' | 'موجودة في المخزن وجاهزة للتسليم' | 'موجودة في الشركة' | 'جاهزة للتسليم للزبون من المحل' | 'جاهزة للتسليم للزبون من المخزن' | 'سلمت للزبون' | 'تم ارجاعها للشركة وخصمها للزبون';
    serialNo?: string;
    underWarranty?: 'YES' | 'NO';
    costAmount?: number;
    costReason?: string;
    isPaid?: boolean;
    historyNote?: string; // Optional note to add to history when status changes
    changedBy?: string; // User ID who made the change
  }
): Promise<any> {
  try {
    console.log('[API] Updating maintenance record:', maintNo, payload);

    // First, get the current maintenance record to check if status is changing
    const { data: currentRecord, error: fetchError } = await supabase
      .from('maintenance')
      .select('maint_no, status')
      .eq('maint_no', maintNo)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch current maintenance record: ${fetchError.message}`);
    }

    const oldStatus = currentRecord?.status || '';
    const newStatus = payload.status;
    const statusChanged = newStatus !== undefined && newStatus !== oldStatus;

    const updates: any = {};
    if (payload.customerID !== undefined) updates.customer_id = payload.customerID;
    if (payload.itemName !== undefined) updates.item_name = payload.itemName;
    if (payload.location !== undefined) updates.location = payload.location;
    if (payload.company !== undefined) updates.company = payload.company || null;
    if (payload.dateOfPurchase !== undefined) updates.date_of_purchase = payload.dateOfPurchase || null;
    if (payload.dateOfReceive !== undefined) updates.date_of_receive = payload.dateOfReceive;
    if (payload.problem !== undefined) updates.problem = payload.problem || null;
    if (payload.imageOfItem !== undefined) updates.image_of_item = payload.imageOfItem || null;
    if (payload.imageOfProblem !== undefined) updates.image_of_problem = payload.imageOfProblem || null;
    if (payload.imageOfWarranty !== undefined) updates.image_of_warranty = payload.imageOfWarranty || null;
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.serialNo !== undefined) updates.serial_no = payload.serialNo || null;
    if (payload.underWarranty !== undefined) updates.under_warranty = payload.underWarranty;
    if (payload.costAmount !== undefined) {
      // Allow 0 as a valid value, only set to null if explicitly null/undefined
      updates.cost_amount = payload.costAmount ?? null;
    }
    if (payload.costReason !== undefined) {
      // Allow empty string to be saved as null
      updates.cost_reason = payload.costReason === '' || payload.costReason === null ? null : payload.costReason;
    }
    if (payload.isPaid !== undefined) updates.is_paid = payload.isPaid || false;

    // Update maintenance record
    const { data, error } = await supabase
      .from('maintenance')
      .update(updates)
      .eq('maint_no', maintNo)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update maintenance record: ${error.message}`);
    }

    // If status changed, create history entry
    if (statusChanged && currentRecord?.maint_no) {
      try {
        const historyEntry: any = {
          maintenance_id: maintNo, // maintenance_id stores the maint_no (TEXT)
          status_from: oldStatus,
          status_to: newStatus,
          changed_by: payload.changedBy || null,
          notes: payload.historyNote || null,
        };

        const { error: historyError } = await supabase
          .from('maintenance_history')
          .insert(historyEntry);

        if (historyError) {
          console.error('[API] Failed to create history entry:', historyError);
          // Don't throw - the main update succeeded, history is secondary
        } else {
          console.log('[API] Maintenance history entry created successfully');
        }
      } catch (historyErr: any) {
        console.error('[API] Error creating history entry:', historyErr);
        // Don't throw - the main update succeeded
      }
    }

    console.log('[API] Maintenance record updated successfully');
    return data;
  } catch (error: any) {
    console.error('[API] updateMaintenance error:', error);
    throw error;
  }
}

/**
 * Delete maintenance record
 */
export async function deleteMaintenance(maintNo: string): Promise<any> {
  try {
    console.log('[API] Deleting maintenance record:', maintNo);

    const { error } = await supabase
      .from('maintenance')
      .delete()
      .eq('maint_no', maintNo);

    if (error) {
      throw new Error(`Failed to delete maintenance record: ${error.message}`);
    }

    console.log('[API] Maintenance record deleted successfully');
    return { status: 'success' };
  } catch (error: any) {
    console.error('[API] deleteMaintenance error:', error);
    throw error;
  }
}

// ==========================================
// CASH SESSIONS API FUNCTIONS
// ==========================================

/**
 * Generate unique cash session ID
 */
export async function generateCashSessionId(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('cash_sessions')
      .select('cash_session_id')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    let nextNum = 1;
    if (data && data.length > 0) {
      const lastId = data[0].cash_session_id;
      const match = lastId.match(/Cash-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }

    return `Cash-${String(nextNum).padStart(4, '0')}`;
  } catch (error: any) {
    console.error('[API] generateCashSessionId error:', error);
    throw new Error(`Failed to generate cash session ID: ${error.message}`);
  }
}

/**
 * Save cash session
 */
export async function saveCashSession(payload: {
  CashSessionID?: string;
  Date: string;
  OpeningFloat: number;
  ClosingFloatTarget: number;
  Notes?: string;
}): Promise<any> {
  try {
    console.log('[API] Saving cash session:', payload);

    const sessionId = payload.CashSessionID || await generateCashSessionId();

    const { data, error } = await supabase
      .from('cash_sessions')
      .insert({
        cash_session_id: sessionId,
        date: payload.Date,
        opening_float: payload.OpeningFloat || 0,
        closing_float_target: payload.ClosingFloatTarget || 0,
        notes: payload.Notes || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save cash session: ${error.message}`);
    }

    return {
      CashSessionID: data.cash_session_id,
      Date: data.date,
      OpeningFloat: data.opening_float,
      ClosingFloatTarget: data.closing_float_target,
      Notes: data.notes || '',
    };
  } catch (error: any) {
    console.error('[API] saveCashSession error:', error);
    throw error;
  }
}

/**
 * Get all cash sessions
 */
export async function getAllCashSessions(limit: number = 1000): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('cash_sessions')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch cash sessions: ${error.message}`);
    }

    return (data || []).map((session: any) => ({
      CashSessionID: session.cash_session_id,
      Date: session.date,
      OpeningFloat: session.opening_float || 0,
      ClosingFloatTarget: session.closing_float_target || 0,
      Notes: session.notes || '',
      CreatedAt: session.created_at,
      UpdatedAt: session.updated_at,
    }));
  } catch (error: any) {
    console.error('[API] getAllCashSessions error:', error);
    throw error;
  }
}

/**
 * Get single cash session by ID
 */
export async function getCashSession(sessionId: string): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('cash_session_id', sessionId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch cash session: ${error.message}`);
    }

    if (!data) {
      throw new Error('Cash session not found');
    }

    return {
      CashSessionID: data.cash_session_id,
      Date: data.date,
      OpeningFloat: data.opening_float || 0,
      ClosingFloatTarget: data.closing_float_target || 0,
      Notes: data.notes || '',
      CreatedAt: data.created_at,
      UpdatedAt: data.updated_at,
    };
  } catch (error: any) {
    console.error('[API] getCashSession error:', error);
    throw error;
  }
}

/**
 * Update cash session
 */
export async function updateCashSession(
  sessionId: string,
  payload: {
    Date?: string;
    OpeningFloat?: number;
    ClosingFloatTarget?: number;
    Notes?: string;
  }
): Promise<any> {
  try {
    console.log('[API] Updating cash session:', sessionId, payload);

    const updates: any = {};
    if (payload.Date !== undefined) updates.date = payload.Date;
    if (payload.OpeningFloat !== undefined) updates.opening_float = payload.OpeningFloat;
    if (payload.ClosingFloatTarget !== undefined) updates.closing_float_target = payload.ClosingFloatTarget;
    if (payload.Notes !== undefined) updates.notes = payload.Notes || null;

    const { data, error } = await supabase
      .from('cash_sessions')
      .update(updates)
      .eq('cash_session_id', sessionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update cash session: ${error.message}`);
    }

    return {
      CashSessionID: data.cash_session_id,
      Date: data.date,
      OpeningFloat: data.opening_float || 0,
      ClosingFloatTarget: data.closing_float_target || 0,
      Notes: data.notes || '',
    };
  } catch (error: any) {
    console.error('[API] updateCashSession error:', error);
    throw error;
  }
}

/**
 * Delete cash session
 */
export async function deleteCashSession(sessionId: string): Promise<any> {
  try {
    console.log('[API] Deleting cash session:', sessionId);

    const { error } = await supabase
      .from('cash_sessions')
      .delete()
      .eq('cash_session_id', sessionId);

    if (error) {
      throw new Error(`Failed to delete cash session: ${error.message}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error('[API] deleteCashSession error:', error);
    throw error;
  }
}

// ==========================================
// CASH DENOMINATIONS API FUNCTIONS
// ==========================================

/**
 * Generate unique denomination ID
 */
export async function generateDenomId(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('cash_denominations')
      .select('denom_id')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    let nextNum = 1;
    if (data && data.length > 0) {
      const lastId = data[0].denom_id;
      const match = lastId.match(/DEN-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }

    return `DEN-${String(nextNum).padStart(6, '0')}`;
  } catch (error: any) {
    console.error('[API] generateDenomId error:', error);
    throw new Error(`Failed to generate denomination ID: ${error.message}`);
  }
}

/**
 * Save cash denomination
 */
export async function saveCashDenomination(payload: {
  DenomID?: string;
  CashSessionID: string;
  Currency: 'شيكل' | 'دينار أردني' | 'دولار' | 'يورو';
  Denomination: number;
  Qty: number;
}): Promise<any> {
  try {
    console.log('[API] Saving cash denomination:', payload);

    const denomId = payload.DenomID || await generateDenomId();

    const { data, error } = await supabase
      .from('cash_denominations')
      .insert({
        denom_id: denomId,
        cash_session_id: payload.CashSessionID,
        currency: payload.Currency,
        denomination: payload.Denomination,
        qty: payload.Qty || 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save cash denomination: ${error.message}`);
    }

    return {
      DenomID: data.denom_id,
      CashSessionID: data.cash_session_id,
      Currency: data.currency,
      Denomination: data.denomination,
      Qty: data.qty,
    };
  } catch (error: any) {
    console.error('[API] saveCashDenomination error:', error);
    throw error;
  }
}

/**
 * Get all cash denominations for a session
 */
export async function getCashDenominationsBySession(sessionId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('cash_denominations')
      .select('*')
      .eq('cash_session_id', sessionId)
      .order('currency', { ascending: true })
      .order('denomination', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch cash denominations: ${error.message}`);
    }

    return (data || []).map((denom: any) => ({
      DenomID: denom.denom_id,
      CashSessionID: denom.cash_session_id,
      Currency: denom.currency,
      Denomination: denom.denomination,
      Qty: denom.qty,
      CreatedAt: denom.created_at,
      UpdatedAt: denom.updated_at,
    }));
  } catch (error: any) {
    console.error('[API] getCashDenominationsBySession error:', error);
    throw error;
  }
}

/**
 * Update cash denomination
 */
export async function updateCashDenomination(
  denomId: string,
  payload: {
    Currency?: 'شيكل' | 'دينار أردني' | 'دولار' | 'يورو';
    Denomination?: number;
    Qty?: number;
  }
): Promise<any> {
  try {
    console.log('[API] Updating cash denomination:', denomId, payload);

    const updates: any = {};
    if (payload.Currency !== undefined) updates.currency = payload.Currency;
    if (payload.Denomination !== undefined) updates.denomination = payload.Denomination;
    if (payload.Qty !== undefined) updates.qty = payload.Qty;

    const { data, error } = await supabase
      .from('cash_denominations')
      .update(updates)
      .eq('denom_id', denomId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update cash denomination: ${error.message}`);
    }

    return {
      DenomID: data.denom_id,
      CashSessionID: data.cash_session_id,
      Currency: data.currency,
      Denomination: data.denomination,
      Qty: data.qty,
    };
  } catch (error: any) {
    console.error('[API] updateCashDenomination error:', error);
    throw error;
  }
}

/**
 * Delete cash denomination
 */
export async function deleteCashDenomination(denomId: string): Promise<any> {
  try {
    console.log('[API] Deleting cash denomination:', denomId);

    const { error } = await supabase
      .from('cash_denominations')
      .delete()
      .eq('denom_id', denomId);

    if (error) {
      throw new Error(`Failed to delete cash denomination: ${error.message}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error('[API] deleteCashDenomination error:', error);
    throw error;
  }
}

/**
 * Get cash session report data (calculations)
 */
export async function getCashSessionReport(sessionId: string): Promise<any> {
  try {
    // Get session
    const session = await getCashSession(sessionId);
    const sessionDate = session.Date;
    
    // Normalize date to YYYY-MM-DD format for comparison
    // Important: Use local date, not UTC, to avoid timezone issues
    let normalizedDate = sessionDate;
    if (sessionDate) {
      // If it's a Date object, convert to local date string
      if (sessionDate instanceof Date) {
        const year = sessionDate.getFullYear();
        const month = String(sessionDate.getMonth() + 1).padStart(2, '0');
        const day = String(sessionDate.getDate()).padStart(2, '0');
        normalizedDate = `${year}-${month}-${day}`;
      } else if (typeof sessionDate === 'string') {
        // If it's already a string, extract YYYY-MM-DD part
        // Handle formats like "2024-01-15" or "2024-01-15T00:00:00.000Z"
        const dateMatch = sessionDate.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          normalizedDate = dateMatch[1];
        } else {
          // Try parsing as date
          const dateObj = new Date(sessionDate);
          if (!isNaN(dateObj.getTime())) {
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            normalizedDate = `${year}-${month}-${day}`;
          }
        }
      }
    }

    console.log('[API] Cash session report - Session Date:', sessionDate, 'Normalized:', normalizedDate);
    
    // Calculate date range for filtering (start and end of day in UTC)
    // This ensures we get all records for the date regardless of timezone
    const dateStart = new Date(normalizedDate + 'T00:00:00.000Z');
    const dateEnd = new Date(normalizedDate + 'T23:59:59.999Z');

    // Get denominations
    const denominations = await getCashDenominationsBySession(sessionId);
    const denomRows = denominations.map((d: any) => ({
      currency: d.Currency,
      denomination: d.Denomination,
      qty: d.Qty,
      amount: d.Denomination * d.Qty,
    }));
    const CountedCash = denomRows.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

    // Get receipts for date
    // Fetch receipts and filter by date in JavaScript to ensure accuracy
    console.log('[API] Fetching receipts for date:', normalizedDate);
    const { data: allReceipts, error: receiptsError } = await supabase
      .from('shop_receipts')
      .select(`
        receipt_id,
        customer_id,
        date,
        cash_amount,
        cheque_amount,
        customers:customer_id (
          name
        )
      `)
      .order('date', { ascending: false })
      .limit(1000); // Get recent receipts (adjust if needed)
    
    if (receiptsError) {
      console.error('[API] Error fetching receipts:', receiptsError);
    }
    
    // Filter receipts by date in JavaScript
    const receipts = (allReceipts || []).filter((r: any) => {
      if (!r.date) return false;
      
      // Normalize receipt date to YYYY-MM-DD
      let receiptDateStr = '';
      if (r.date instanceof Date) {
        const year = r.date.getFullYear();
        const month = String(r.date.getMonth() + 1).padStart(2, '0');
        const day = String(r.date.getDate()).padStart(2, '0');
        receiptDateStr = `${year}-${month}-${day}`;
      } else if (typeof r.date === 'string') {
        // Extract YYYY-MM-DD from string
        const dateMatch = r.date.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          receiptDateStr = dateMatch[1];
        } else {
          // Try parsing
          const dateObj = new Date(r.date);
          if (!isNaN(dateObj.getTime())) {
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            receiptDateStr = `${year}-${month}-${day}`;
          }
        }
      }
      
      return receiptDateStr === normalizedDate;
    });
    
    console.log('[API] Receipts found:', receipts.length, 'out of', allReceipts?.length || 0, 'total');
    if (receipts.length > 0) {
      console.log('[API] Sample receipt dates:', receipts.slice(0, 3).map((r: any) => ({
        id: r.receipt_id,
        date: r.date,
        dateString: String(r.date)
      })));
    }

    if (receiptsError) {
      console.error('[API] Error fetching receipts:', receiptsError);
    }

    const receiptsForDate = (receipts || []).map((r: any) => ({
      id: r.receipt_id,
      customerId: r.customer_id,
      customerName: (r.customers && r.customers.name) || '',
      cash: Number(r.cash_amount || 0),
      cheque: Number(r.cheque_amount || 0),
    }));

    const ReceiptsCashTotal = receiptsForDate.reduce((sum: number, r: any) => sum + r.cash, 0);
    const ReceiptsChequeTotal = receiptsForDate.reduce((sum: number, r: any) => sum + r.cheque, 0);

    // Get payments for date
    // Fetch payments and filter by date in JavaScript to ensure accuracy
    console.log('[API] Fetching payments for date:', normalizedDate);
    const { data: allPayments, error: paymentsError } = await supabase
      .from('shop_payments')
      .select(`
        pay_id,
        customer_id,
        date,
        cash_amount,
        notes,
        customers:customer_id (
          name
        )
      `)
      .order('date', { ascending: false })
      .limit(1000); // Get recent payments (adjust if needed)
    
    if (paymentsError) {
      console.error('[API] Error fetching payments:', paymentsError);
    }
    
    // Filter payments by date in JavaScript
    const payments = (allPayments || []).filter((p: any) => {
      if (!p.date) return false;
      
      // Normalize payment date to YYYY-MM-DD
      let paymentDateStr = '';
      if (p.date instanceof Date) {
        const year = p.date.getFullYear();
        const month = String(p.date.getMonth() + 1).padStart(2, '0');
        const day = String(p.date.getDate()).padStart(2, '0');
        paymentDateStr = `${year}-${month}-${day}`;
      } else if (typeof p.date === 'string') {
        // Extract YYYY-MM-DD from string
        const dateMatch = p.date.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          paymentDateStr = dateMatch[1];
        } else {
          // Try parsing
          const dateObj = new Date(p.date);
          if (!isNaN(dateObj.getTime())) {
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            paymentDateStr = `${year}-${month}-${day}`;
          }
        }
      }
      
      return paymentDateStr === normalizedDate;
    });
    
    console.log('[API] Payments found:', payments.length, 'out of', allPayments?.length || 0, 'total');
    if (payments.length > 0) {
      console.log('[API] Sample payment dates:', payments.slice(0, 3).map((p: any) => ({
        id: p.pay_id,
        date: p.date,
        dateString: String(p.date)
      })));
    } // Direct string comparison should work if date is stored as DATE type

    if (paymentsError) {
      console.error('[API] Error fetching payments:', paymentsError);
    }

    const paymentsForDate = (payments || []).map((p: any) => ({
      id: p.pay_id,
      customerId: p.customer_id,
      customerName: (p.customers && p.customers.name) || '',
      notes: p.notes || '',
      cash: Number(p.cash_amount || 0),
    }));

    const PaymentsCashTotal = paymentsForDate.reduce((sum: number, p: any) => sum + p.cash, 0);

    // Get cash invoices from cash_invoices table for the date
    // Use date range filter for date_time (timestamp) field
    console.log('[API] Fetching cash invoices for date range:', {
      normalizedDate,
      dateStart: dateStart.toISOString(),
      dateEnd: dateEnd.toISOString()
    });
    const { data: cashInvoices, error: invoicesError } = await supabase
      .from('cash_invoices')
      .select('invoice_id, date_time, discount, status')
      .gte('date_time', dateStart.toISOString())
      .lte('date_time', dateEnd.toISOString());
    
    console.log('[API] Cash invoices found:', cashInvoices?.length || 0);

    if (invoicesError) {
      console.error('[API] Error fetching cash invoices:', invoicesError);
    }

    const cashInvoicesList = cashInvoices || [];
    console.log('[API] Found cash invoices for date', normalizedDate + ':', cashInvoicesList.length);
    if (cashInvoicesList.length > 0) {
      console.log('[API] Cash invoice IDs:', cashInvoicesList.map((ci: any) => ({
        id: ci.invoice_id,
        date: ci.date_time,
        discount: ci.discount,
      })));
    }

    // Get invoice details from cash_invoice_details
    const invoiceIds = cashInvoicesList.map((ci: any) => ci.invoice_id);
    let invoiceDetails: any[] = [];
    if (invoiceIds.length > 0) {
      const { data: details, error: detailsError } = await supabase
        .from('cash_invoice_details')
        .select('invoice_id, unit_price, quantity')
        .in('invoice_id', invoiceIds);

      if (detailsError) {
        console.error('[API] Error fetching invoice details:', detailsError);
      } else {
        invoiceDetails = details || [];
      }
    }

    // Calculate invoice values
    const detailsByInvoice: { [key: string]: any[] } = {};
    invoiceDetails.forEach((d: any) => {
      const invId = String(d.invoice_id);
      if (!detailsByInvoice[invId]) {
        detailsByInvoice[invId] = [];
      }
      detailsByInvoice[invId].push(d);
    });

    const cashInvoicesWithValue = cashInvoicesList.map((ci: any) => {
      const rows = detailsByInvoice[String(ci.invoice_id)] || [];
      const sumItems = rows.reduce(
        (sum: number, r: any) => sum + (Number(r.unit_price || 0) * Number(r.quantity || 0)),
        0
      );
      const disc = Number(ci.discount || 0);
      const calcValue = sumItems - disc;
      return {
        id: ci.invoice_id,
        calcValue,
      };
    });

    const CashInvoicesTotal = cashInvoicesWithValue.reduce((sum: number, x: any) => sum + (x.calcValue || 0), 0);

    // Calculate virtual columns
    const ExpectedCash = ReceiptsCashTotal - PaymentsCashTotal + CashInvoicesTotal;
    const ExpectedCheques = ReceiptsChequeTotal;
    const OpeningFloat = Number(session.OpeningFloat || 0);
    const OverShort = CountedCash - ExpectedCash - OpeningFloat;
    const ClosingFloatTarget = Number(session.ClosingFloatTarget || 0);
    const AmountToDeliverCash = CountedCash - ClosingFloatTarget;
    const differentSaed = ReceiptsCashTotal + CashInvoicesTotal - PaymentsCashTotal - AmountToDeliverCash;

    return {
      session,
      sessionDateStr: normalizedDate,
      denomRows,
      CountedCash,
      receiptsForDate,
      paymentsForDate,
      ReceiptsToday: receiptsForDate.map((r: any) => r.id),
      PaymentsToday: paymentsForDate.map((p: any) => p.id),
      ReceiptsCashTotal,
      ReceiptsChequeTotal,
      PaymentsCashTotal,
      cashInvoicesWithValue,
      CashInvoicesTotal,
      ExpectedCash,
      ExpectedCheques,
      OverShort,
      AmountToDeliverCash,
      differentSaed,
      missingDetails: cashInvoicesWithValue
        .filter((x: any) => Math.abs(x.calcValue) < 0.0001)
        .map((x: any) => x.id),
    };
  } catch (error: any) {
    console.error('[API] getCashSessionReport error:', error);
    throw error;
  }
}

/**
 * Map Supabase quotation to app format
 */
function mapQuotationFromSupabase(quotation: any, totalAmount: number = 0): any {
  const customer = (quotation as any)?.customers;
  return {
    ...quotation,
    QuotationID: quotation.quotation_id || '',
    Date: quotation.date || '',
    CustomerID: quotation.customer_id || '',
    Notes: quotation.notes || '',
    Status: quotation.status || 'مسودة',
    SpecialDiscountAmount: parseFloat(String(quotation.special_discount_amount || 0)) || 0,
    GiftDiscountAmount: parseFloat(String(quotation.gift_discount_amount || 0)) || 0,
    totalAmount: totalAmount,
    CreatedAt: quotation.created_at || '',
    CreatedBy: quotation.created_by || quotation.user_id || '',
    created_by: quotation.created_by || null,
    createdBy: quotation.created_by || null,
    user_id: quotation.created_by || null,
    customer: customer
      ? {
          name: customer.name || '',
          phone: customer.phone || '',
          address: customer.address || '',
          shamelNo: customer.shamel_no || '',
        }
      : undefined,
  };
}

/**
 * Get all quotations from Supabase
 */
export async function getQuotationsFromSupabase(page: number = 1, pageSize: number = 20, searchQuery?: string): Promise<{ quotations: any[]; total: number }> {
  try {
    console.log('[API] Fetching quotations from Supabase...', { page, pageSize, searchQuery });
    const startTime = Date.now();
    
    // Calculate pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // If search query provided, find matching customer IDs first
    let customerIdsToSearch: string[] = [];
    if (searchQuery && searchQuery.trim()) {
      const search = searchQuery.trim();
      const { data: matchingCustomers } = await supabase
        .from('customers')
        .select('customer_id')
        .or(`name.ilike.%${search}%,customer_id.ilike.%${search}%`);
      
      if (matchingCustomers) {
        customerIdsToSearch = matchingCustomers.map(c => c.customer_id);
      }
    }

    // Build base queries
    let countQuery = supabase
      .from('quotations')
      .select('*', { count: 'exact', head: true });

    let dataQuery = supabase
      .from('quotations')
      .select('*, customers:customer_id(name, phone, address, shamel_no)');

    // Apply search filters
    if (searchQuery && searchQuery.trim()) {
      const search = searchQuery.trim();
      
      if (customerIdsToSearch.length > 0) {
        // Search in quotation_id OR notes OR customer_id (direct match) OR customer_id in matching list
        // First, get quotations matching quotation_id, notes, or customer_id directly
        const { data: directMatches } = await supabase
          .from('quotations')
          .select('quotation_id')
          .or(`quotation_id.ilike.%${search}%,customer_id.ilike.%${search}%,notes.ilike.%${search}%`);
        
        const directMatchIds = directMatches?.map(q => q.quotation_id) || [];
        
        // Then get quotations matching customer IDs
        const { data: customerMatches } = await supabase
          .from('quotations')
          .select('quotation_id')
          .in('customer_id', customerIdsToSearch);
        
        const customerMatchIds = customerMatches?.map(q => q.quotation_id) || [];
        
        // Combine and get unique IDs
        const allMatchIds = [...new Set([...directMatchIds, ...customerMatchIds])];
        
        if (allMatchIds.length > 0) {
          countQuery = countQuery.in('quotation_id', allMatchIds);
          dataQuery = dataQuery.in('quotation_id', allMatchIds);
        } else {
          // No matches found
          countQuery = countQuery.eq('quotation_id', 'NO_MATCHES');
          dataQuery = dataQuery.eq('quotation_id', 'NO_MATCHES');
        }
      } else {
        // Only search in quotation_id, customer_id, and notes if no matching customers found
        countQuery = countQuery.or(`quotation_id.ilike.%${search}%,customer_id.ilike.%${search}%,notes.ilike.%${search}%`);
        dataQuery = dataQuery.or(`quotation_id.ilike.%${search}%,customer_id.ilike.%${search}%,notes.ilike.%${search}%`);
      }
    }

    // Get total count
    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('[API] Error getting quotation count:', countError);
      throw new Error(`Failed to get quotation count: ${countError.message}`);
    }

    const total = count || 0;
    
    // Fetch quotations ordered by created_at descending (newest first), then by date
    const { data: quotations, error } = await dataQuery
      .order('created_at', { ascending: false })
      .order('date', { ascending: false })
      .range(from, to);
    
    if (error) {
      console.error('[API] Supabase error:', error);
      throw new Error(`Failed to fetch quotations: ${error.message}`);
    }
    
    if (!quotations || !Array.isArray(quotations)) {
      console.error('[API] Invalid quotations data:', quotations);
      throw new Error('Invalid response format: No quotations array found');
    }
    
    // Fetch details for each quotation individually (old method - more reliable)
    // This ensures we get the correct totals even if it's a bit slower
    const mappedQuotations = await Promise.all(quotations.map(async (quotation: any) => {
      const quotationId = quotation.quotation_id;
      
      // Fetch details for this quotation
      const { data: details, error: detailsError } = await supabase
        .from('quotation_details')
        .select('quantity, unit_price')
        .eq('quotation_id', quotationId);
      
      if (detailsError) {
        console.error(`[API] Error fetching details for quotation ${quotationId}:`, detailsError);
      }
      
      // Calculate subtotal from details
      const subtotal = (details || []).reduce((sum: number, detail: any) => {
        const quantity = parseFloat(String(detail.quantity || 0));
        const unitPrice = parseFloat(String(detail.unit_price || 0));
        return sum + (quantity * unitPrice);
      }, 0);
      
      const specialDiscount = parseFloat(String(quotation.special_discount_amount || 0)) || 0;
      const giftDiscount = parseFloat(String(quotation.gift_discount_amount || 0)) || 0;
      
      // Calculate total from details
      const totalAmount = Math.max(0, subtotal - specialDiscount - giftDiscount);
      
      return mapQuotationFromSupabase(quotation, totalAmount);
    }));
    
    const totalTime = Date.now() - startTime;
    console.log(`[API] Quotations loaded from Supabase: ${mappedQuotations.length} of ${total} in ${totalTime}ms`);
    
    // Debug: Check final mapped quotations
    if (mappedQuotations.length > 0) {
      const sampleMapped = mappedQuotations.slice(0, 3).map(q => ({
        quotationId: q.QuotationID,
        totalAmount: q.totalAmount
      }));
      console.log('[API] Sample final mapped quotations:', sampleMapped);
    }
    
    return { quotations: mappedQuotations, total };
  } catch (error: any) {
    console.error('[API] getQuotationsFromSupabase error:', error);
    throw error;
  }
}

/**
 * Get quotation details from Supabase
 */
export async function getQuotationDetailsFromSupabase(quotationId: string): Promise<any[]> {
  try {
    console.log('[API] Fetching quotation details from Supabase:', quotationId);
    
    const { data: details, error } = await supabase
      .from('quotation_details')
      .select(`
        *,
        products:product_id (
          product_id,
          name,
          barcode,
          shamel_no,
          sale_price,
          cost_price
        )
      `)
      .eq('quotation_id', quotationId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('[API] Supabase error:', error);
      throw new Error(`Failed to fetch quotation details: ${error.message}`);
    }
    
    if (!details || !Array.isArray(details)) {
      return [];
    }
    
    // Map details with product info
    return details.map((detail: any) => {
      const product = detail.products || {};
      return {
        QuotationDetailID: detail.quotation_detail_id || '',
        QuotationID: detail.quotation_id || '',
        ProductID: detail.product_id || '',
        Quantity: parseFloat(String(detail.quantity || 0)) || 0,
        UnitPrice: parseFloat(String(detail.unit_price || 0)) || 0,
        product: {
          product_id: product.product_id || '',
          name: product.name || '',
          barcode: product.barcode || '',
          shamelNo: product.shamel_no || '',
          costPrice: parseFloat(String(product.cost_price || 0)) || 0,
          sale_price: parseFloat(String(product.sale_price || 0)) || 0,
        },
      };
    });
  } catch (error: any) {
    console.error('[API] getQuotationDetailsFromSupabase error:', error);
    throw error;
  }
}

/**
 * Get single quotation with details from Supabase
 */
export async function getQuotationFromSupabase(quotationId: string): Promise<any> {
  try {
    console.log('[API] Fetching quotation from Supabase:', quotationId);
    
    const { data: quotation, error } = await supabase
      .from('quotations')
      .select('*, customers:customer_id(name, phone, address, shamel_no)')
      .eq('quotation_id', quotationId)
      .single();
    
    if (error) {
      console.error('[API] Supabase error:', error);
      throw new Error(`Failed to fetch quotation: ${error.message}`);
    }
    
    if (!quotation) {
      throw new Error('Quotation not found');
    }
    
    // Get details
    const details = await getQuotationDetailsFromSupabase(quotationId);
    
    // Calculate total
    const subtotal = details.reduce((sum: number, detail: any) => {
      return sum + (detail.Quantity * detail.UnitPrice);
    }, 0);
    const specialDiscount = parseFloat(String(quotation.special_discount_amount || 0)) || 0;
    const giftDiscount = parseFloat(String(quotation.gift_discount_amount || 0)) || 0;
    const totalAmount = subtotal - specialDiscount - giftDiscount;
    
    return {
      ...mapQuotationFromSupabase(quotation, totalAmount),
      details: details,
    };
  } catch (error: any) {
    console.error('[API] getQuotationFromSupabase error:', error);
    throw error;
  }
}

/**
 * Create or update quotation in Supabase
 */
export async function saveQuotation(
  quotationId: string | null,
  payload: {
    date: string;
    customerId: string | null;
    notes?: string;
    status: string;
    specialDiscountAmount?: number;
    giftDiscountAmount?: number;
    created_by?: string; // Admin user ID (UUID)
    items: Array<{
      detailID?: string;
      productID: string;
      quantity: number;
      unitPrice: number;
    }>;
  }
): Promise<any> {
  try {
    console.log('[API] Saving quotation in Supabase:', quotationId, payload);
    
    const isNew = !quotationId;
    
    if (isNew) {
      // Generate new quotation ID in format: Qut-0001-XYZ
      quotationId = await generateQuotationId();
    }
    
    // Step 1: Save quotation header
    const quotationData: any = {
      quotation_id: quotationId,
      date: payload.date,
      customer_id: payload.customerId || null,
      notes: payload.notes || null,
      status: payload.status || 'مسودة',
      special_discount_amount: payload.specialDiscountAmount || 0,
      gift_discount_amount: payload.giftDiscountAmount || 0,
      created_by: payload.created_by || null, // Admin user ID
    };
    
    const { error: quotationError } = await supabase
      .from('quotations')
      .upsert(quotationData, { onConflict: 'quotation_id' });
    
    if (quotationError) {
      console.error('[API] Error saving quotation:', quotationError);
      throw new Error(`Failed to save quotation: ${quotationError.message}`);
    }
    
    // Step 2: Delete existing details if updating
    if (!isNew) {
      const { error: deleteError } = await supabase
        .from('quotation_details')
        .delete()
        .eq('quotation_id', quotationId);
      
      if (deleteError) {
        console.error('[API] Error deleting old details:', deleteError);
        throw new Error(`Failed to update quotation details: ${deleteError.message}`);
      }
    }
    
    // Step 3: Insert new details
    if (payload.items && payload.items.length > 0) {
      const detailsToInsert = payload.items.map((item) => ({
        quotation_detail_id: item.detailID || `QD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        quotation_id: quotationId,
        product_id: item.productID,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      }));
      
      const { error: detailsError } = await supabase
        .from('quotation_details')
        .insert(detailsToInsert);
      
      if (detailsError) {
        console.error('[API] Error saving quotation details:', detailsError);
        throw new Error(`Failed to save quotation details: ${detailsError.message}`);
      }
    }
    
    // Step 4: Fetch and return the complete quotation
    return await getQuotationFromSupabase(quotationId!);
  } catch (error: any) {
    console.error('[API] saveQuotation error:', error);
    throw error;
  }
}

async function generateQuotationId(): Promise<string> {
  // Get exact count for incremental numbering
  const { count, error } = await supabase
    .from('quotations')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('[API] Error generating quotation id:', error);
    // fallback
    const fallback = `Qut-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 900 + 100)}`;
    return fallback;
  }

  const nextNumber = (count || 0) + 1;
  const padded = String(nextNumber).padStart(4, '0');
  const random = Math.floor(Math.random() * (999 - 10 + 1)) + 10; // 10..999
  return `Qut-${padded}-${random}`;
}

/**
 * Update quotation status in Supabase
 */
export async function updateQuotationStatus(quotationId: string, status: string): Promise<void> {
  try {
    console.log('[API] Updating quotation status in Supabase:', quotationId, status);
    
    const { error } = await supabase
      .from('quotations')
      .update({ status })
      .eq('quotation_id', quotationId);
    
    if (error) {
      console.error('[API] Error updating quotation status:', error);
      throw new Error(`Failed to update quotation status: ${error.message}`);
    }
    
    console.log('[API] Quotation status updated successfully');
  } catch (error: any) {
    console.error('[API] updateQuotationStatus error:', error);
    throw error;
  }
}

/**
 * Delete quotation from Supabase
 */
export async function deleteQuotation(quotationId: string): Promise<void> {
  try {
    console.log('[API] Deleting quotation from Supabase:', quotationId);
    
    // Details will be deleted automatically due to CASCADE
    const { error } = await supabase
      .from('quotations')
      .delete()
      .eq('quotation_id', quotationId);
    
    if (error) {
      console.error('[API] Error deleting quotation:', error);
      throw new Error(`Failed to delete quotation: ${error.message}`);
    }
  } catch (error: any) {
    console.error('[API] deleteQuotation error:', error);
    throw error;
  }
}

/**
 * Get the last price a customer paid for a specific product
 * Searches in shop sales and warehouse sales invoices (not quotations)
 * Returns the last unit_price found, or null if not found
 */
export async function getCustomerLastPriceForProduct(customerId: string, productId: string): Promise<number | null> {
  try {
    if (!customerId || !productId) {
      console.log('[API] getCustomerLastPriceForProduct: Missing customerId or productId', { customerId, productId });
      return null;
    }

    console.log('[API] getCustomerLastPriceForProduct: Searching for last price', { customerId, productId });

    let lastPrice: number | null = null;
    let lastDate: Date | null = null;

    // Search in shop sales invoices
    const { data: shopInvoices, error: shopInvoicesError } = await supabase
      .from('shop_sales_invoices')
      .select('invoice_id, date')
      .eq('customer_id', customerId)
      .order('date', { ascending: false })
      .limit(200);

    if (shopInvoicesError) {
      console.error('[API] getCustomerLastPriceForProduct: Shop invoices error', shopInvoicesError);
    } else if (shopInvoices && shopInvoices.length > 0) {
      const invoiceIds = shopInvoices.map((inv: any) => inv.invoice_id);
      console.log('[API] getCustomerLastPriceForProduct: Found shop invoices', shopInvoices.length, 'invoiceIds:', invoiceIds.slice(0, 5));
      
      const { data: shopDetails, error: shopDetailsError } = await supabase
        .from('shop_sales_details')
        .select('invoice_id, unit_price, created_at')
        .eq('product_id', productId)
        .in('invoice_id', invoiceIds)
        .order('created_at', { ascending: false });

      if (shopDetailsError) {
        console.error('[API] getCustomerLastPriceForProduct: Shop details error', shopDetailsError);
      } else if (shopDetails && shopDetails.length > 0) {
        console.log('[API] getCustomerLastPriceForProduct: Found shop details', shopDetails.length);
        // Create a map for quick invoice lookup
        const invoiceMap = new Map(shopInvoices.map((inv: any) => [inv.invoice_id, inv]));
        
        for (const detail of shopDetails) {
          const invoice = invoiceMap.get(detail.invoice_id);
          if (invoice && invoice.date) {
            const invoiceDate = new Date(invoice.date);
            if (!lastDate || invoiceDate > lastDate) {
              lastDate = invoiceDate;
              lastPrice = parseFloat(String(detail.unit_price || 0));
              console.log('[API] getCustomerLastPriceForProduct: Updated from shop sales', { date: invoice.date, price: lastPrice });
            }
          }
        }
      }
    }

    // Search in warehouse sales invoices
    const { data: warehouseInvoices, error: warehouseInvoicesError } = await supabase
      .from('warehouse_sales_invoices')
      .select('invoice_id, date')
      .eq('customer_id', customerId)
      .order('date', { ascending: false })
      .limit(200);

    if (warehouseInvoicesError) {
      console.error('[API] getCustomerLastPriceForProduct: Warehouse invoices error', warehouseInvoicesError);
    } else if (warehouseInvoices && warehouseInvoices.length > 0) {
      const invoiceIds = warehouseInvoices.map((inv: any) => inv.invoice_id);
      console.log('[API] getCustomerLastPriceForProduct: Found warehouse invoices', warehouseInvoices.length);
      
      const { data: warehouseDetails, error: warehouseDetailsError } = await supabase
        .from('warehouse_sales_details')
        .select('invoice_id, unit_price, created_at')
        .eq('product_id', productId)
        .in('invoice_id', invoiceIds)
        .order('created_at', { ascending: false });

      if (warehouseDetailsError) {
        console.error('[API] getCustomerLastPriceForProduct: Warehouse details error', warehouseDetailsError);
      } else if (warehouseDetails && warehouseDetails.length > 0) {
        console.log('[API] getCustomerLastPriceForProduct: Found warehouse details', warehouseDetails.length);
        const invoiceMap = new Map(warehouseInvoices.map((inv: any) => [inv.invoice_id, inv]));
        
        for (const detail of warehouseDetails) {
          const invoice = invoiceMap.get(detail.invoice_id);
          if (invoice && invoice.date) {
            const invoiceDate = new Date(invoice.date);
            if (!lastDate || invoiceDate > lastDate) {
              lastDate = invoiceDate;
              lastPrice = parseFloat(String(detail.unit_price || 0));
              console.log('[API] getCustomerLastPriceForProduct: Updated from warehouse sales', { date: invoice.date, price: lastPrice });
            }
          }
        }
      }
    }

    // Note: We don't search in quotations because quotations are not finalized invoices
    // Only search in actual invoices (shop sales and warehouse sales)

    console.log('[API] getCustomerLastPriceForProduct: Final result', { lastPrice, lastDate });
    return lastPrice && lastPrice > 0 ? lastPrice : null;
  } catch (error: any) {
    console.error('[API] getCustomerLastPriceForProduct error:', error);
    return null;
  }
}

/**
 * Get warehouse cash flow from warehouse_cash_flow view
 * Returns all transactions sorted by date ascending for balance calculation
 * If view doesn't have receipt_id/payment_id, fetch from individual tables
 */
export async function getWarehouseCashFlow(): Promise<any[]> {
  try {
    console.log('[API] Fetching warehouse cash flow from Supabase...');

    // First try to get from view
    const { data: viewData, error: viewError } = await supabase
      .from('warehouse_cash_flow')
      .select('*')
      .order('created_at', { ascending: true })
      .order('date', { ascending: true });

    // If view works and has receipt_id/payment_id, use it
    if (!viewError && viewData && viewData.length > 0) {
      const hasIds = viewData.some((item: any) => item.receipt_id || item.payment_id || item.receiptId || item.paymentId);
      if (hasIds) {
        console.log(`[API] Warehouse cash flow loaded from view: ${viewData.length} transactions`);
        return viewData;
      }
    }

    // If view doesn't work or doesn't have IDs, fetch from individual tables
    console.log('[API] View missing IDs, fetching from individual tables...');
    
    const [receiptsResult, paymentsResult] = await Promise.all([
      supabase
        .from('warehouse_receipts')
        .select('*, receipt_id')
        .order('created_at', { ascending: true })
        .order('date', { ascending: true }),
      supabase
        .from('warehouse_payments')
        .select('*, payment_id')
        .order('created_at', { ascending: true })
        .order('date', { ascending: true })
    ]);

    const receipts = receiptsResult.data || [];
    const payments = paymentsResult.data || [];

    // Transform receipts
    const receiptTransactions = receipts.map((r: any) => ({
      receipt_id: r.receipt_id,
      date: r.date,
      created_at: r.created_at,
      direction: 'in',
      cash_amount: r.cash_amount || 0,
      check_amount: r.check_amount || 0,
      amount: (r.cash_amount || 0) + (r.check_amount || 0), // Total for backward compatibility
      customer_id: r.customer_id,
      related_party: r.customer_id,
      notes: r.notes,
      created_by: r.created_by || r.user_id,
      user_id: r.created_by || r.user_id,
    }));

    // Transform payments
    const paymentTransactions = payments.map((p: any) => ({
      payment_id: p.payment_id,
      date: p.date,
      created_at: p.created_at,
      direction: 'out',
      cash_amount: p.cash_amount || 0,
      check_amount: p.check_amount || 0,
      amount: (p.cash_amount || 0) + (p.check_amount || 0), // Total for backward compatibility
      customer_id: p.customer_id || p.related_party,
      related_party: p.customer_id || p.related_party,
      notes: p.notes,
      created_by: p.created_by || p.user_id,
      user_id: p.created_by || p.user_id,
    }));

    // Combine and sort
    const allTransactions = [...receiptTransactions, ...paymentTransactions].sort((a, b) => {
      const timeA = new Date(a.created_at || a.date).getTime();
      const timeB = new Date(b.created_at || b.date).getTime();
      return timeA - timeB;
    });

    console.log(`[API] Warehouse cash flow loaded from tables: ${allTransactions.length} transactions`);
    return allTransactions;
  } catch (error: any) {
    console.error('[API] getWarehouseCashFlow error:', error?.message || error);
    throw error;
  }
}

/**
 * Get shop cash flow from shop_receipts and shop_payments tables
 * Ordered by date ASC, created_at ASC (critical for running balance calculation)
 */
export async function getShopCashFlow(): Promise<any[]> {
  try {
    console.log('[API] Fetching shop cash flow from tables...');

    // Try to fetch from view first (if it exists)
    try {
      const { data: viewData, error: viewError } = await supabase
        .from('shop_cash_flow')
        .select('*')
        .order('date', { ascending: true })
        .order('created_at', { ascending: true });

      if (!viewError && viewData && Array.isArray(viewData) && viewData.length > 0) {
        console.log('[API] Shop cash flow loaded from view');
        // Transform view data
        const transformed = viewData.map((item: any) => {
          const receiptId = item.receipt_id || '';
          const paymentId = item.payment_id || item.pay_id || '';
          const isReceipt = !!receiptId;
          const isPayment = !!paymentId;
          
          let direction: 'in' | 'out' = 'in';
          if (item.direction) {
            direction = item.direction.toLowerCase() === 'out' ? 'out' : 'in';
          } else {
            direction = isReceipt ? 'in' : 'out';
          }

          const cashAmount = parseFloat(item.cash_amount || 0);
          const chequeAmount = parseFloat(item.cheque_amount || 0);
          const totalAmount = cashAmount + chequeAmount;
          const relatedParty = item.related_party || item.customer_id || '';
          const customerId = item.customer_id || item.related_party || '';
          const userId = item.created_by || item.user_id || item.created_by_user_id || '';

          return {
            id: item.id || receiptId || paymentId || `transaction-${Date.now()}`,
            date: item.date || '',
            created_at: item.created_at || item.createdAt || '',
            type: isReceipt ? 'receipt' as const : 'payment' as const,
            direction,
            related_party: relatedParty,
            customer_id: customerId,
            cash_amount: cashAmount,
            check_amount: chequeAmount,
            amount: totalAmount,
            notes: item.notes || '',
            receipt_id: receiptId,
            payment_id: paymentId,
            created_by: userId,
            user_id: userId,
          };
        });
        return transformed;
      }
    } catch (viewErr: any) {
      console.log('[API] View not available or empty, fetching from tables...', viewErr?.message);
    }

    // If view doesn't work or doesn't have data, fetch from individual tables
    console.log('[API] Fetching from individual tables...');
    
    const [receiptsResult, paymentsResult] = await Promise.all([
      supabase
        .from('shop_receipts')
        .select('*, receipt_id')
        .order('created_at', { ascending: true })
        .order('date', { ascending: true }),
      supabase
        .from('shop_payments')
        .select('*, pay_id')
        .order('created_at', { ascending: true })
        .order('date', { ascending: true })
    ]);

    const receipts = receiptsResult.data || [];
    const payments = paymentsResult.data || [];

    // Transform receipts
    const receiptTransactions = receipts.map((r: any) => ({
      receipt_id: r.receipt_id,
      date: r.date,
      created_at: r.created_at,
      direction: 'in',
      cash_amount: r.cash_amount || 0,
      cheque_amount: r.cheque_amount || 0,
      check_amount: r.cheque_amount || 0, // Also include check_amount for consistency
      amount: (r.cash_amount || 0) + (r.cheque_amount || 0),
      customer_id: r.customer_id,
      related_party: r.customer_id,
      notes: r.notes,
      created_by: r.created_by || r.user_id,
      user_id: r.created_by || r.user_id,
    }));

    // Transform payments
    const paymentTransactions = payments.map((p: any) => ({
      payment_id: p.pay_id,
      date: p.date,
      created_at: p.created_at,
      direction: 'out',
      cash_amount: p.cash_amount || 0,
      cheque_amount: p.cheque_amount || 0,
      check_amount: p.cheque_amount || 0, // Also include check_amount for consistency
      amount: (p.cash_amount || 0) + (p.cheque_amount || 0),
      customer_id: p.customer_id,
      related_party: p.customer_id,
      notes: p.notes,
      created_by: p.created_by || p.user_id,
      user_id: p.created_by || p.user_id,
    }));

    // Combine and sort chronologically (for balance calculation)
    const allTransactions = [...receiptTransactions, ...paymentTransactions].sort((a, b) => {
      const timeA = new Date(a.created_at || a.date).getTime();
      const timeB = new Date(b.created_at || b.date).getTime();
      if (timeA !== timeB) return timeA - timeB;
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      const idA = (a as any).receipt_id || (a as any).payment_id || '';
      const idB = (b as any).receipt_id || (b as any).payment_id || '';
      return idA < idB ? -1 : 1;
    });

    console.log(`[API] Shop cash flow loaded from tables: ${allTransactions.length} transactions (${receipts.length} receipts, ${payments.length} payments)`);
    return allTransactions;
  } catch (error: any) {
    console.error('[API] getShopCashFlow error:', error?.message || error);
    throw error;
  }
}


/**
 * Generate warehouse receipt ID in format: warecXXXX-YYY
 * Where XXXX is padded count and YYY is random 3-digit number (100-999)
 */
function generateWarehouseReceiptID(count: number): string {
  const paddedCount = String(count + 1).padStart(4, '0');
  const random = Math.floor(Math.random() * (999 - 100 + 1)) + 100;
  return `warec${paddedCount}-${random}`;
}

/**
 * Generate warehouse payment ID in format: wapayXXXX-YYY
 * Where XXXX is padded count and YYY is random 3-digit number (100-999)
 */
function generateWarehousePaymentID(count: number): string {
  const paddedCount = String(count + 1).padStart(4, '0');
  const random = Math.floor(Math.random() * (999 - 100 + 1)) + 100;
  return `wapay${paddedCount}-${random}`;
}

/**
 * Create warehouse receipt
 * ID format: warecXXXX-YYY
 */
export async function createWarehouseReceipt(data: {
  date: string; // Format: YYYY-MM-DD
  cash_amount: number;
  check_amount: number;
  related_party?: string; // Customer ID or name
  notes?: string;
  created_by?: string; // Admin user ID
}): Promise<any> {
  try {
    console.log('[API] Creating warehouse receipt:', data);

    // Get count of existing receipts
    const { count, error: countError } = await supabase
      .from('warehouse_receipts')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('[API] Failed to get receipt count:', countError);
      throw new Error(`Failed to get receipt count: ${countError.message}`);
    }

    const receiptCount = count || 0;
    const receiptId = generateWarehouseReceiptID(receiptCount);
    console.log('[API] Generated warehouse receipt ID:', receiptId);

    const receiptData: any = {
      receipt_id: receiptId,
      date: data.date,
      cash_amount: data.cash_amount || 0,
      check_amount: data.check_amount || 0,
      customer_id: data.related_party || null, // Use customer_id column
      notes: data.notes || null,
      created_by: data.created_by || null, // Admin user ID
    };

    const { data: result, error } = await supabase
      .from('warehouse_receipts')
      .insert(receiptData)
      .select()
      .single();

    if (error) {
      console.error('[API] Failed to create warehouse receipt:', error);
      throw new Error(`Failed to create warehouse receipt: ${error.message}`);
    }

    console.log('[API] Warehouse receipt created successfully:', receiptId);
    return { status: 'success', receiptId, data: result };
  } catch (error: any) {
    console.error('[API] createWarehouseReceipt error:', error);
    throw error;
  }
}

/**
 * Create warehouse payment
 * ID format: wapayXXXX-YYY
 */
export async function createWarehousePayment(data: {
  date: string; // Format: YYYY-MM-DD
  cash_amount: number;
  check_amount: number;
  customer_id?: string; // Customer ID (linked to customers table)
  related_party?: string; // Legacy field for backward compatibility
  notes?: string;
  created_by?: string; // Admin user ID
}): Promise<any> {
  try {
    console.log('[API] Creating warehouse payment:', data);

    // Get count of existing payments
    const { count, error: countError } = await supabase
      .from('warehouse_payments')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('[API] Failed to get payment count:', countError);
      throw new Error(`Failed to get payment count: ${countError.message}`);
    }

    const paymentCount = count || 0;
    const paymentId = generateWarehousePaymentID(paymentCount);
    console.log('[API] Generated warehouse payment ID:', paymentId);

    // Prepare payment data with customer_id (linked to customers table)
    const paymentData: any = {
      payment_id: paymentId,
      date: data.date,
      cash_amount: data.cash_amount || 0,
      check_amount: data.check_amount || 0,
      notes: data.notes || null,
      created_by: data.created_by || null,
    };

    // Add customer_id if provided (preferred field)
    if (data.customer_id) {
      paymentData.customer_id = data.customer_id;
    } else if (data.related_party) {
      // Fallback to related_party for backward compatibility
      paymentData.customer_id = data.related_party;
    }

    console.log('[API] Attempting to insert payment with data:', paymentData);

    const { data: result, error } = await supabase
      .from('warehouse_payments')
      .insert(paymentData)
      .select()
      .single();

    if (error) {
      console.error('[API] Failed to create warehouse payment:', error);
      console.error('[API] Payment data attempted:', paymentData);
      throw new Error(`Failed to create warehouse payment: ${error.message}`);
    }

    // Verify that customer_id was saved
    if ((data.customer_id || data.related_party) && result) {
      const savedCustomerId = result.customer_id;
      console.log('[API] Payment created successfully. Saved customer info:', {
        paymentId,
        attemptedValue: data.customer_id || data.related_party,
        savedCustomerId,
        fullResult: result
      });
      
      if (!savedCustomerId) {
        console.warn('[API] Warning: customer_id was not saved in payment. Result:', result);
      }
    }

    console.log('[API] Warehouse payment created successfully:', paymentId);
    return { status: 'success', paymentId, data: result };
  } catch (error: any) {
    console.error('[API] createWarehousePayment error:', error);
    throw error;
  }
}

/**
 * Get warehouse receipt by ID
 */
export async function getWarehouseReceipt(receiptId: string): Promise<any> {
  try {
    const { data: receipt, error } = await supabase
      .from('warehouse_receipts')
      .select('*')
      .eq('receipt_id', receiptId)
      .single();

    if (error || !receipt) {
      throw new Error(`Receipt not found: ${error?.message || 'Unknown error'}`);
    }

    return receipt;
  } catch (error: any) {
    console.error('[API] getWarehouseReceipt error:', error);
    throw error;
  }
}

/**
 * Update warehouse receipt
 */
export async function updateWarehouseReceipt(receiptId: string, data: {
  date: string;
  cash_amount: number;
  check_amount: number;
  related_party?: string;
  notes?: string;
}): Promise<any> {
  try {
    const updateData: any = {
      date: data.date,
      cash_amount: data.cash_amount || 0,
      check_amount: data.check_amount || 0,
      notes: data.notes || null,
    };

    // Try customer_id first
    if (data.related_party) {
      updateData.customer_id = data.related_party;
    }

    const { data: result, error } = await supabase
      .from('warehouse_receipts')
      .update(updateData)
      .eq('receipt_id', receiptId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update receipt: ${error.message}`);
    }

    return { status: 'success', data: result };
  } catch (error: any) {
    console.error('[API] updateWarehouseReceipt error:', error);
    throw error;
  }
}

/**
 * Delete warehouse receipt
 */
export async function deleteWarehouseReceipt(receiptId: string): Promise<any> {
  try {
    const { error } = await supabase
      .from('warehouse_receipts')
      .delete()
      .eq('receipt_id', receiptId);

    if (error) {
      throw new Error(`Failed to delete receipt: ${error.message}`);
    }

    return { status: 'success' };
  } catch (error: any) {
    console.error('[API] deleteWarehouseReceipt error:', error);
    throw error;
  }
}

/**
 * Get warehouse payment by ID
 */
export async function getWarehousePayment(paymentId: string): Promise<any> {
  try {
    const { data: payment, error } = await supabase
      .from('warehouse_payments')
      .select('*')
      .eq('payment_id', paymentId)
      .single();

    if (error || !payment) {
      throw new Error(`Payment not found: ${error?.message || 'Unknown error'}`);
    }

    return payment;
  } catch (error: any) {
    console.error('[API] getWarehousePayment error:', error);
    throw error;
  }
}

/**
 * Update warehouse payment
 */
export async function updateWarehousePayment(paymentId: string, data: {
  date: string;
  cash_amount: number;
  check_amount: number;
  customer_id?: string; // Customer ID (linked to customers table)
  related_party?: string; // Legacy field for backward compatibility
  notes?: string;
}): Promise<any> {
  try {
    const updateData: any = {
      date: data.date,
      cash_amount: data.cash_amount || 0,
      check_amount: data.check_amount || 0,
      notes: data.notes || null,
    };

    // Add customer_id if provided (preferred field)
    if (data.customer_id) {
      updateData.customer_id = data.customer_id;
    } else if (data.related_party) {
      // Fallback to related_party for backward compatibility
      updateData.customer_id = data.related_party;
    }

    const { data: result, error } = await supabase
      .from('warehouse_payments')
      .update(updateData)
      .eq('payment_id', paymentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update payment: ${error.message}`);
    }

    return { status: 'success', data: result };
  } catch (error: any) {
    console.error('[API] updateWarehousePayment error:', error);
    throw error;
  }
}

/**
 * Delete warehouse payment
 */
export async function deleteWarehousePayment(paymentId: string): Promise<any> {
  try {
    const { error } = await supabase
      .from('warehouse_payments')
      .delete()
      .eq('payment_id', paymentId);

    if (error) {
      throw new Error(`Failed to delete payment: ${error.message}`);
    }

    return { status: 'success' };
  } catch (error: any) {
    console.error('[API] deleteWarehousePayment error:', error);
    throw error;
  }
}

