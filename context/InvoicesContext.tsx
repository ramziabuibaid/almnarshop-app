'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getCashInvoices, getCashInvoice } from '@/lib/api';

interface CashInvoice {
  InvoiceID: string;
  DateTime: string;
  Status: string;
  Notes?: string;
  discount?: number;
  totalAmount?: number;
}

interface InvoiceDetail {
  invoice: CashInvoice;
  details: any[];
}

interface InvoicesContextType {
  invoices: CashInvoice[];
  invoiceDetails: Map<string, InvoiceDetail>;
  loading: boolean;
  loadInvoices: () => Promise<void>;
  getInvoice: (invoiceID: string) => Promise<InvoiceDetail | null>;
  refreshInvoice: (invoiceID: string) => Promise<void>;
  clearCache: () => void;
}

const InvoicesContext = createContext<InvoicesContextType | undefined>(undefined);

export function InvoicesProvider({ children }: { children: ReactNode }) {
  const [invoices, setInvoices] = useState<CashInvoice[]>([]);
  const [invoiceDetails, setInvoiceDetails] = useState<Map<string, InvoiceDetail>>(new Map());
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load invoices from cache on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !isMounted) return;

    const cachedInvoices = localStorage.getItem('cash_invoices_cache');
    const cachedDetails = localStorage.getItem('cash_invoice_details_cache');
    const cacheTimestamp = localStorage.getItem('cash_invoices_cache_timestamp');

    if (cachedInvoices) {
      try {
        const parsed = JSON.parse(cachedInvoices);
        setInvoices(parsed);
        console.log('[InvoicesContext] Loaded invoices from cache:', parsed.length);
      } catch (e) {
        console.error('[InvoicesContext] Failed to parse cached invoices:', e);
      }
    }

    if (cachedDetails) {
      try {
        const parsed = JSON.parse(cachedDetails);
        const detailsMap = new Map<string, InvoiceDetail>();
        Object.entries(parsed).forEach(([key, value]) => {
          detailsMap.set(key, value as InvoiceDetail);
        });
        setInvoiceDetails(detailsMap);
        console.log('[InvoicesContext] Loaded invoice details from cache:', detailsMap.size);
      } catch (e) {
        console.error('[InvoicesContext] Failed to parse cached details:', e);
      }
    }

    // Auto-refresh if cache is older than 5 minutes
    if (cacheTimestamp) {
      const cacheAge = Date.now() - parseInt(cacheTimestamp);
      const fiveMinutes = 5 * 60 * 1000;
      if (cacheAge > fiveMinutes) {
        console.log('[InvoicesContext] Cache expired, refreshing...');
        loadInvoices();
      }
    } else {
      // No cache, load immediately
      loadInvoices();
    }
  }, [isMounted]);

  // Save invoices to cache
  useEffect(() => {
    if (typeof window === 'undefined' || !isMounted) return;
    if (invoices.length > 0) {
      localStorage.setItem('cash_invoices_cache', JSON.stringify(invoices));
      localStorage.setItem('cash_invoices_cache_timestamp', Date.now().toString());
    }
  }, [invoices, isMounted]);

  // Save invoice details to cache
  useEffect(() => {
    if (typeof window === 'undefined' || !isMounted) return;
    if (invoiceDetails.size > 0) {
      const detailsObj: Record<string, InvoiceDetail> = {};
      invoiceDetails.forEach((value, key) => {
        detailsObj[key] = value;
      });
      localStorage.setItem('cash_invoice_details_cache', JSON.stringify(detailsObj));
    }
  }, [invoiceDetails, isMounted]);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      console.log('[InvoicesContext] Loading invoices...');
      const data = await getCashInvoices();
      
      // Handle different response formats
      let invoicesList: CashInvoice[] = [];
      if (Array.isArray(data)) {
        invoicesList = data;
      } else if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as any).data)) {
        invoicesList = (data as any).data;
      } else if (data && typeof data === 'object' && 'invoices' in data && Array.isArray((data as any).invoices)) {
        invoicesList = (data as any).invoices;
      }
      
      // Sort by date (newest first)
      const sorted = invoicesList.sort((a, b) => {
        const dateA = new Date(a.DateTime || 0).getTime();
        const dateB = new Date(b.DateTime || 0).getTime();
        return dateB - dateA;
      });
      
      console.log('[InvoicesContext] Loaded invoices:', sorted.length);
      setInvoices(sorted);
    } catch (error: any) {
      console.error('[InvoicesContext] Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getInvoice = useCallback(async (invoiceID: string): Promise<InvoiceDetail | null> => {
    if (!invoiceID) {
      console.error('[InvoicesContext] No invoiceID provided');
      return null;
    }

    // Check cache first
    if (invoiceDetails.has(invoiceID)) {
      const cached = invoiceDetails.get(invoiceID);
      console.log('[InvoicesContext] Invoice found in cache:', invoiceID, cached);
      return cached || null;
    }

    // Check localStorage cache
    if (typeof window !== 'undefined') {
      try {
        const cachedDetails = localStorage.getItem('cash_invoice_details_cache');
        if (cachedDetails) {
          const parsed = JSON.parse(cachedDetails);
          if (parsed[invoiceID]) {
            console.log('[InvoicesContext] Invoice found in localStorage cache:', invoiceID);
            const cachedDetail = parsed[invoiceID];
            // Update in-memory cache
            setInvoiceDetails(prev => {
              const newMap = new Map(prev);
              newMap.set(invoiceID, cachedDetail);
              return newMap;
            });
            return cachedDetail;
          }
        }
      } catch (e) {
        console.error('[InvoicesContext] Error reading localStorage cache:', e);
      }
    }

    // Load from API
    setLoading(true);
    try {
      console.log('[InvoicesContext] Loading invoice from API:', invoiceID);
      const data = await getCashInvoice(invoiceID);
      console.log('[InvoicesContext] Raw invoice data:', data);
      
      // Handle different response formats
      let invoiceData: CashInvoice;
      let detailsData: any[] = [];
      
      if (data && typeof data === 'object') {
        // Check if data has invoice and details properties
        if (data.invoice) {
          invoiceData = data.invoice;
          detailsData = data.details || [];
        } else if (data.InvoiceID) {
          // Data is the invoice itself
          invoiceData = data as CashInvoice;
          detailsData = data.details || [];
        } else {
          // Try to extract invoice from nested structure
          invoiceData = data as CashInvoice;
          detailsData = [];
        }
      } else {
        throw new Error('Invalid invoice data format');
      }
      
      console.log('[InvoicesContext] Processed invoice data:', invoiceData);
      console.log('[InvoicesContext] Processed details:', detailsData.length);
      
      const invoiceDetail: InvoiceDetail = {
        invoice: invoiceData,
        details: detailsData,
      };

      // Update cache
      setInvoiceDetails(prev => {
        const newMap = new Map(prev);
        newMap.set(invoiceID, invoiceDetail);
        return newMap;
      });

      return invoiceDetail;
    } catch (error: any) {
      console.error('[InvoicesContext] Error loading invoice:', error);
      console.error('[InvoicesContext] Error details:', error?.message, error?.stack);
      return null;
    } finally {
      setLoading(false);
    }
  }, [invoiceDetails]);

  const refreshInvoice = useCallback(async (invoiceID: string) => {
    setLoading(true);
    try {
      console.log('[InvoicesContext] Refreshing invoice:', invoiceID);
      const data = await getCashInvoice(invoiceID);
      console.log('[InvoicesContext] Raw invoice data (refresh):', data);
      
      // Handle different response formats
      let invoiceData: CashInvoice;
      let detailsData: any[] = [];
      
      if (data && typeof data === 'object') {
        // Check if data has invoice and details properties
        if (data.invoice) {
          invoiceData = data.invoice;
          detailsData = data.details || [];
        } else if (data.InvoiceID) {
          // Data is the invoice itself
          invoiceData = data as CashInvoice;
          detailsData = data.details || [];
        } else {
          // Try to extract invoice from nested structure
          invoiceData = data as CashInvoice;
          detailsData = [];
        }
      } else {
        throw new Error('Invalid invoice data format');
      }
      
      const invoiceDetail: InvoiceDetail = {
        invoice: invoiceData,
        details: detailsData,
      };

      // Update cache
      setInvoiceDetails(prev => {
        const newMap = new Map(prev);
        newMap.set(invoiceID, invoiceDetail);
        return newMap;
      });

      // Also refresh invoices list
      await loadInvoices();
    } catch (error: any) {
      console.error('[InvoicesContext] Error refreshing invoice:', error);
    } finally {
      setLoading(false);
    }
  }, [loadInvoices]);

  const clearCache = useCallback(() => {
    localStorage.removeItem('cash_invoices_cache');
    localStorage.removeItem('cash_invoice_details_cache');
    localStorage.removeItem('cash_invoices_cache_timestamp');
    setInvoices([]);
    setInvoiceDetails(new Map());
    console.log('[InvoicesContext] Cache cleared');
  }, []);

  return (
    <InvoicesContext.Provider
      value={{
        invoices,
        invoiceDetails,
        loading,
        loadInvoices,
        getInvoice,
        refreshInvoice,
        clearCache,
      }}
    >
      {children}
    </InvoicesContext.Provider>
  );
}

export function useInvoices() {
  const context = useContext(InvoicesContext);
  if (context === undefined) {
    throw new Error('useInvoices must be used within an InvoicesProvider');
  }
  return context;
}

