/**
 * Serial Numbers API Functions
 * Professional approach: Dedicated table for serial number tracking
 */

import { supabase } from './supabase';

/**
 * Save serial numbers to dedicated table
 * Called after invoice details are saved
 */
export async function saveSerialNumbers(
  serialNos: string[],
  productId: string,
  invoiceType: 'cash' | 'shop_sales' | 'warehouse_sales' | 'quotation',
  invoiceId: string,
  detailId: string,
  customerId?: string,
  saleDate?: string
): Promise<void> {
  try {
    if (!serialNos || serialNos.length === 0) return;

    // Filter out empty serial numbers
    const validSerials = serialNos.filter(s => s && s.trim());

    if (validSerials.length === 0) return;

    const serialsToInsert = validSerials.map(serialNo => {
      const serial: any = {
        serial_no: serialNo.trim(),
        product_id: productId,
        invoice_type: invoiceType,
        invoice_id: invoiceId,
        sale_date: saleDate || new Date().toISOString().split('T')[0],
        status: 'sold',
      };

      // Set the appropriate detail_id based on invoice type
      if (invoiceType === 'cash') {
        serial.cash_invoice_detail_id = detailId;
      } else if (invoiceType === 'shop_sales') {
        serial.shop_sales_detail_id = detailId;
      } else if (invoiceType === 'warehouse_sales') {
        serial.warehouse_sales_detail_id = detailId;
      } else if (invoiceType === 'quotation') {
        serial.quotation_detail_id = detailId;
      }

      if (customerId) {
        serial.customer_id = customerId;
      }

      return serial;
    });

    const { error } = await supabase
      .from('serial_numbers')
      .insert(serialsToInsert);

    if (error) {
      console.error('[API] Error saving serial numbers:', error);
      throw new Error(`Failed to save serial numbers: ${error.message}`);
    }

    console.log(`[API] Saved ${serialsToInsert.length} serial numbers`);
  } catch (error: any) {
    console.error('[API] saveSerialNumbers error:', error);
    throw error;
  }
}

/**
 * Search for serial number
 */
export async function searchSerialNumber(searchQuery: string): Promise<any[]> {
  try {
    console.log('[API] Searching for serial number:', searchQuery);

    // First, get serial numbers - use distinct to avoid duplicates
    // Group by serial_no, invoice_id, invoice_type to get unique combinations
    const { data: serials, error: serialsError } = await supabase
      .from('serial_numbers')
      .select(`
        serial_id,
        serial_no,
        product_id,
        invoice_type,
        invoice_id,
        customer_id,
        sale_date,
        status,
        notes,
        created_at
      `)
      .ilike('serial_no', `%${searchQuery}%`)
      .order('created_at', { ascending: false });
    
    if (serialsError) {
      console.error('[API] Error searching serial numbers:', serialsError);
      throw new Error(`Failed to search serial numbers: ${serialsError.message}`);
    }

    if (!serials || serials.length === 0) {
      console.log('[API] No serial numbers found');
      return [];
    }

    // Remove duplicates: same serial_no, invoice_id, and invoice_type should appear only once
    // Keep the most recent entry (by created_at)
    const uniqueSerialsMap = new Map<string, any>();
    serials.forEach((serial: any) => {
      const key = `${serial.serial_no}_${serial.invoice_id}_${serial.invoice_type}`;
      const existing = uniqueSerialsMap.get(key);
      if (!existing || new Date(serial.created_at) > new Date(existing.created_at)) {
        uniqueSerialsMap.set(key, serial);
      }
    });
    
    const uniqueSerials = Array.from(uniqueSerialsMap.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);

    // Get unique product IDs and customer IDs
    const productIds = [...new Set(uniqueSerials.map(s => s.product_id).filter(Boolean))];
    const customerIds = [...new Set(uniqueSerials.map(s => s.customer_id).filter(Boolean))];

    // Fetch products
    let productsMap = new Map();
    if (productIds.length > 0) {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('product_id, name')
        .in('product_id', productIds);

      if (!productsError && products) {
        products.forEach((p: any) => {
          productsMap.set(p.product_id, p.name);
        });
      }
    }

    // Fetch customers
    let customersMap = new Map();
    if (customerIds.length > 0) {
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('customer_id, name')
        .in('customer_id', customerIds);

      if (!customersError && customers) {
        customers.forEach((c: any) => {
          customersMap.set(c.customer_id, c.name);
        });
      }
    }

    // Map results
    const results = uniqueSerials.map((item: any) => ({
      serial_id: item.serial_id,
      serial_no: item.serial_no,
      product_id: item.product_id,
      product_name: productsMap.get(item.product_id) || null,
      invoice_type: item.invoice_type,
      invoice_id: item.invoice_id,
      customer_id: item.customer_id || null,
      customer_name: customersMap.get(item.customer_id) || null,
      sale_date: item.sale_date,
      status: item.status,
      notes: item.notes,
      created_at: item.created_at,
    }));

    console.log(`[API] Found ${results.length} serial numbers`);
    return results;
  } catch (error: any) {
    console.error('[API] searchSerialNumber error:', error);
    throw error;
  }
}

/**
 * Get serial number details
 */
export async function getSerialNumberDetails(serialId: string): Promise<any> {
  try {
    console.log('[API] Getting serial number details:', serialId);

    const { data: serial, error } = await supabase
      .from('serial_numbers')
      .select('*')
      .eq('serial_id', serialId)
      .single();

    if (error) {
      console.error('[API] Error getting serial number details:', error);
      throw new Error(`Failed to get serial number details: ${error.message}`);
    }

    if (!serial) {
      throw new Error('Serial number not found');
    }

    // Fetch product details
    let productName = null;
    let productBrand = null;
    let productType = null;
    if (serial.product_id) {
      const { data: product } = await supabase
        .from('products')
        .select('name, brand, type')
        .eq('product_id', serial.product_id)
        .single();
      
      if (product) {
        productName = product.name;
        productBrand = product.brand;
        productType = product.type;
      }
    }

    // Fetch customer details
    let customerName = null;
    let customerPhone = null;
    let customerEmail = null;
    if (serial.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('name, phone, email')
        .eq('customer_id', serial.customer_id)
        .single();
      
      if (customer) {
        customerName = customer.name;
        customerPhone = customer.phone;
        customerEmail = customer.email;
      }
    }

    return {
      ...serial,
      product_name: productName,
      product_brand: productBrand,
      product_type: productType,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
    };
  } catch (error: any) {
    console.error('[API] getSerialNumberDetails error:', error);
    throw error;
  }
}

/**
 * Get all serial numbers for a product
 */
export async function getProductSerialNumbers(productId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('serial_numbers')
      .select(`
        *,
        customers:customer_id (
          name
        )
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API] Error getting product serial numbers:', error);
      throw new Error(`Failed to get product serial numbers: ${error.message}`);
    }

    return data || [];
  } catch (error: any) {
    console.error('[API] getProductSerialNumbers error:', error);
    throw error;
  }
}

/**
 * Get serial numbers by detail ID (for invoice details)
 */
export async function getSerialNumbersByDetailId(
  detailId: string,
  invoiceType: 'cash' | 'shop_sales' | 'warehouse_sales' | 'quotation'
): Promise<string[]> {
  try {
    console.log('[API] getSerialNumbersByDetailId called:', { detailId, invoiceType });
    
    let query = supabase
      .from('serial_numbers')
      .select('serial_no')
      .order('created_at', { ascending: true });

    if (invoiceType === 'cash') {
      query = query.eq('cash_invoice_detail_id', detailId);
    } else if (invoiceType === 'shop_sales') {
      query = query.eq('shop_sales_detail_id', detailId);
    } else if (invoiceType === 'warehouse_sales') {
      query = query.eq('warehouse_sales_detail_id', detailId);
    } else if (invoiceType === 'quotation') {
      query = query.eq('quotation_detail_id', detailId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[API] Error getting serial numbers by detail ID:', error);
      throw new Error(`Failed to get serial numbers: ${error.message}`);
    }

    const serials = (data || []).map((item: any) => item.serial_no).filter(Boolean);
    console.log('[API] getSerialNumbersByDetailId result:', { detailId, invoiceType, count: serials.length, serials });
    
    return serials;
  } catch (error: any) {
    console.error('[API] getSerialNumbersByDetailId error:', error);
    throw error;
  }
}

/**
 * Delete serial numbers by detail ID (when invoice detail is deleted or updated)
 */
export async function deleteSerialNumbersByDetailId(
  detailId: string,
  invoiceType: 'cash' | 'shop_sales' | 'warehouse_sales' | 'quotation'
): Promise<void> {
  try {
    let query = supabase
      .from('serial_numbers')
      .delete();

    if (invoiceType === 'cash') {
      query = query.eq('cash_invoice_detail_id', detailId);
    } else if (invoiceType === 'shop_sales') {
      query = query.eq('shop_sales_detail_id', detailId);
    } else if (invoiceType === 'warehouse_sales') {
      query = query.eq('warehouse_sales_detail_id', detailId);
    } else if (invoiceType === 'quotation') {
      query = query.eq('quotation_detail_id', detailId);
    }

    const { error } = await query;

    if (error) {
      console.error('[API] Error deleting serial numbers by detail ID:', error);
      throw new Error(`Failed to delete serial numbers: ${error.message}`);
    }
  } catch (error: any) {
    console.error('[API] deleteSerialNumbersByDetailId error:', error);
    throw error;
  }
}

/**
 * Delete serial numbers by invoice ID (when invoice is updated and details are replaced)
 */
export async function deleteSerialNumbersByInvoiceId(
  invoiceId: string,
  invoiceType: 'cash' | 'shop_sales' | 'warehouse_sales' | 'quotation'
): Promise<void> {
  try {
    let query = supabase
      .from('serial_numbers')
      .delete()
      .eq('invoice_id', invoiceId)
      .eq('invoice_type', invoiceType);

    const { error } = await query;

    if (error) {
      console.error('[API] Error deleting serial numbers by invoice ID:', error);
      throw new Error(`Failed to delete serial numbers: ${error.message}`);
    }

    console.log(`[API] Deleted serial numbers for ${invoiceType} invoice: ${invoiceId}`);
  } catch (error: any) {
    console.error('[API] deleteSerialNumbersByInvoiceId error:', error);
    throw error;
  }
}
