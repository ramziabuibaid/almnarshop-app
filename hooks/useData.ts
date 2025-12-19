'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProducts,
  getAllCustomers,
  getCashInvoices,
  getCRMData,
  saveCashInvoice,
  updatePTPStatusInSupabase,
} from '@/lib/api';

/**
 * Query key factory for consistent key management
 */
export const queryKeys = {
  products: ['products'] as const,
  customers: ['customers'] as const,
  invoices: ['invoices'] as const,
  crmData: ['crmData'] as const,
  invoice: (id: string) => ['invoices', id] as const,
};

/**
 * Hook to fetch all products
 * Returns cached data instantly on navigation if available
 */
export function useProducts() {
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: async () => {
      console.log('[useProducts] Fetching products...');
      const products = await getProducts();
      console.log('[useProducts] Products loaded:', products.length);
      return products;
    },
  });
}

/**
 * Hook to fetch all customers
 * Returns cached data instantly on navigation if available
 */
export function useCustomers() {
  return useQuery({
    queryKey: queryKeys.customers,
    queryFn: async () => {
      console.log('[useCustomers] Fetching customers...');
      const customers = await getAllCustomers();
      console.log('[useCustomers] Customers loaded:', customers.length);
      return customers;
    },
  });
}

/**
 * Hook to fetch all cash invoices
 * Returns cached data instantly on navigation if available
 */
export function useInvoices() {
  return useQuery({
    queryKey: queryKeys.invoices,
    queryFn: async () => {
      console.log('[useInvoices] Fetching invoices...');
      const invoices = await getCashInvoices();
      console.log('[useInvoices] Invoices loaded:', invoices.length);
      return invoices;
    },
  });
}

/**
 * Hook to fetch CRM data (tasks, interactions, etc.)
 * Returns cached data instantly on navigation if available
 */
export function useCRMData() {
  return useQuery({
    queryKey: queryKeys.crmData,
    queryFn: async () => {
      console.log('[useCRMData] Fetching CRM data...');
      const data = await getCRMData();
      console.log('[useCRMData] CRM data loaded');
      return data;
    },
  });
}

/**
 * Hook to save a cash invoice with optimistic updates
 * Immediately shows success in UI, then refetches in background
 */
export function useSaveCashInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
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
    }) => {
      console.log('[useSaveCashInvoice] Saving invoice...');
      const result = await saveCashInvoice(payload);
      console.log('[useSaveCashInvoice] Invoice saved:', result.invoiceID);
      return result;
    },
    onMutate: async (newInvoice) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: queryKeys.invoices });

      // Snapshot the previous value
      const previousInvoices = queryClient.getQueryData(queryKeys.invoices);

      // Optimistically update the invoices list
      // We'll add a temporary invoice entry (will be replaced by real data on success)
      queryClient.setQueryData(queryKeys.invoices, (old: any[] = []) => {
        const optimisticInvoice = {
          InvoiceID: `temp-${Date.now()}`,
          DateTime: new Date().toISOString(),
          Status: 'Pending',
          Notes: newInvoice.notes,
          discount: newInvoice.discount || 0,
          totalAmount: newInvoice.items.reduce(
            (sum, item) => sum + item.quantity * item.unitPrice,
            0
          ) - (newInvoice.discount || 0),
        };
        return [optimisticInvoice, ...old];
      });

      // Return a context object with the snapshotted value
      return { previousInvoices };
    },
    onError: (err, newInvoice, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousInvoices) {
        queryClient.setQueryData(queryKeys.invoices, context.previousInvoices);
      }
      console.error('[useSaveCashInvoice] Error saving invoice:', err);
    },
    onSuccess: (data) => {
      // Invalidate and refetch invoices to get the real data from server
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      console.log('[useSaveCashInvoice] Invoice saved successfully, refetching...');
    },
  });
}

/**
 * Hook to resolve a CRM task/interaction with optimistic updates
 * Immediately removes the item from UI, then updates server in background
 */
export function useResolveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { activityId: string; status: string }) => {
      console.log('[useResolveTask] Resolving task...', params);
      const result = await updatePTPStatusInSupabase(params.activityId, params.status);
      console.log('[useResolveTask] Task resolved');
      return result;
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.crmData });

      // Snapshot the previous value
      const previousCRMData = queryClient.getQueryData(queryKeys.crmData);

      // Optimistically remove the task from the UI
      queryClient.setQueryData(queryKeys.crmData, (old: any) => {
        if (!old) return old;

        // Remove from overdue, today, and upcoming arrays
        const updated = { ...old };
        if (updated.overdue) {
          updated.overdue = updated.overdue.filter(
            (item: any) =>
              item.InteractionID !== variables.activityId &&
              item.ActivityID !== variables.activityId
          );
        }
        if (updated.today) {
          updated.today = updated.today.filter(
            (item: any) =>
              item.InteractionID !== variables.activityId &&
              item.ActivityID !== variables.activityId
          );
        }
        if (updated.upcoming) {
          updated.upcoming = updated.upcoming.filter(
            (item: any) =>
              item.InteractionID !== variables.activityId &&
              item.ActivityID !== variables.activityId
          );
        }

        return updated;
      });

      // Return context for rollback
      return { previousCRMData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousCRMData) {
        queryClient.setQueryData(queryKeys.crmData, context.previousCRMData);
      }
      console.error('[useResolveTask] Error resolving task:', err);
    },
    onSuccess: () => {
      // Refetch CRM data in background to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.crmData });
      console.log('[useResolveTask] Task resolved successfully, refetching...');
    },
  });
}

