/**
 * Validation functions for invoices
 * Currently disabled - will be enabled when ready
 */

const VALIDATION_ENABLED = false; // Set to true when ready to enforce validation

/**
 * Validate that serialized products have serial numbers
 * @param items - Array of invoice items
 * @returns Error message if validation fails, null if valid
 */
export function validateSerialNumbers(items: Array<{
  productID: string;
  quantity: number;
  serialNos?: string[];
  isSerialized?: boolean;
}>): string | null {
  if (!VALIDATION_ENABLED) {
    return null; // Validation disabled
  }

  for (const item of items) {
    if (item.isSerialized) {
      const serialNos = item.serialNos || [];
      const filledSerials = serialNos.filter(s => s && s.trim());
      
      if (filledSerials.length < item.quantity) {
        return `المنتج ${item.productID} يتطلب ${item.quantity} رقم تسلسلي (تم إدخال ${filledSerials.length})`;
      }
    }
  }

  return null;
}

/**
 * Check if validation is enabled
 */
export function isValidationEnabled(): boolean {
  return VALIDATION_ENABLED;
}
