'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type PermissionKey =
  | 'viewBalances'
  | 'viewTasks'
  | 'viewCost'
  | 'viewCashInvoices'
  | 'createPOS'
  | 'accessReceipts'
  | 'accessShopInvoices'
  | 'accessWarehouseInvoices'
  | 'accessChecks'
  | 'accessQuotations'
  | 'accessPayPage'
  | 'accessShopCashBox'
  | 'accessWarehouseCashBox'
  | 'viewCashBoxBalance'
  | 'accountant'
  | 'dashboardAndNotifications'
  | 'viewNotifications';

export type AdminPermissions = Record<PermissionKey, boolean>;

export interface AdminUser {
  id: string;
  username: string;
  is_super_admin: boolean;
  is_active: boolean;
  work_location?: 'المحل' | 'المخزن';
  permissions: AdminPermissions;
}

interface AdminAuthContextType {
  admin: AdminUser | null;
  loading: boolean;
  error: string | null;
  loginAdmin: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logoutAdmin: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMe = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/me', { cache: 'no-store' });
      if (!res.ok) throw new Error('Not authenticated');
      const data = await res.json();
      setAdmin(data.admin);
      setError(null);
    } catch (err: any) {
      setAdmin(null);
      setError(err?.message || 'Not authenticated');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const loginAdmin = async (username: string, password: string, rememberMe: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, rememberMe }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Login failed');
      }
      const data = await res.json();
      setAdmin(data.admin);
    } catch (err: any) {
      setAdmin(null);
      setError(err?.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logoutAdmin = async () => {
    setLoading(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } finally {
      setAdmin(null);
      setLoading(false);
    }
  };

  const value: AdminAuthContextType = {
    admin,
    loading,
    error,
    loginAdmin,
    logoutAdmin,
    refresh: fetchMe,
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}


