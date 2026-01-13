'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth, AdminPermissions, AdminUser } from '@/context/AdminAuthContext';
import { Shield, Save, Plus, RefreshCw, Trash2, Key, X } from 'lucide-react';

const permissionLabels: { key: keyof AdminPermissions; label: string }[] = [
  { key: 'viewBalances', label: 'View customer balances' },
  { key: 'viewTasks', label: 'View tasks & daily jobs' },
  { key: 'viewCost', label: 'View item cost' },
  { key: 'viewCashInvoices', label: 'View cash invoices' },
  { key: 'createPOS', label: 'Create POS invoice' },
  { key: 'accessReceipts', label: 'Access receipts page' },
  { key: 'accessPayPage', label: 'Access payments page' },
  { key: 'accessShopInvoices', label: 'Access shop invoices' },
  { key: 'accessWarehouseInvoices', label: 'Access warehouse invoices' },
  { key: 'accessChecks', label: 'Access checks page' },
  { key: 'accessQuotations', label: 'Access quotations page' },
  { key: 'accessShopCashBox', label: 'Access shop cash box page' },
  { key: 'accessWarehouseCashBox', label: 'Access warehouse cash box page' },
  { key: 'viewCashBoxBalance', label: 'View cash box balance (shop & warehouse)' },
  { key: 'accountant', label: 'Accountant (post invoices & change status)' },
  { key: 'viewNotifications', label: 'View notifications' },
];

const emptyPermissions: AdminPermissions = {
  viewBalances: false,
  viewTasks: false,
  viewCost: false,
  viewCashInvoices: false,
  createPOS: false,
  accessReceipts: false,
  accessPayPage: false,
  accessShopInvoices: false,
  accessWarehouseInvoices: false,
  accessChecks: false,
  accessQuotations: false,
  accessShopCashBox: false,
  accessWarehouseCashBox: false,
  viewCashBoxBalance: false,
  accountant: false,
  viewNotifications: false,
};

export default function AdminUsersPage() {
  const { admin, loading: authLoading } = useAdminAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordModal, setPasswordModal] = useState<{
    isOpen: boolean;
    userId: string | null;
    username: string;
  }>({
    isOpen: false,
    userId: null,
    username: '',
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    is_super_admin: false,
    is_active: true,
    work_location: 'المحل' as 'المحل' | 'المخزن',
    permissions: { ...emptyPermissions },
  });

  const canManage = useMemo(() => !!admin?.is_super_admin, [admin]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load users');
      }
      const data = await res.json();
      // Ensure all permissions are defined (boolean) for each user
      const usersWithPermissions = (data.users || []).map((user: AdminUser) => ({
        ...user,
        permissions: {
          ...emptyPermissions,
          ...user.permissions,
        },
      }));
      setUsers(usersWithPermissions);
    } catch (err: any) {
      setError(err?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'مستخدمو الإدارة - Admin Users';
  }, []);

  useEffect(() => {
    if (canManage) fetchUsers();
  }, [canManage]);

  const updateUser = async (id: string, changes: Partial<AdminUser> & { password?: string }) => {
    if (!id) {
      setError('Missing user id');
      return;
    }
    
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to update user');
      }
      const data = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === id ? data.user : u)));
    } catch (err: any) {
      setError(err?.message || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (id: string) => {
    if (!id) {
      setError('Missing user id');
      return;
    }

    // Prevent deleting own account
    if (admin?.id === id) {
      setError('Cannot delete your own account');
      return;
    }

    if (!confirm('Are you sure you want to delete this admin user? This action cannot be undone.')) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to delete user');
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err: any) {
      setError(err?.message || 'Failed to delete user');
    } finally {
      setSaving(false);
    }
  };

  const createUser = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to create user');
      }
      const data = await res.json();
      setUsers((prev) => [...prev, data.user]);
      setNewUser({
        username: '',
        password: '',
        is_super_admin: false,
        is_active: true,
        work_location: 'المحل' as 'المحل' | 'المخزن',
        permissions: { ...emptyPermissions },
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const openPasswordModal = (userId: string, username: string) => {
    setPasswordModal({
      isOpen: true,
      userId,
      username,
    });
    setNewPassword('');
    setConfirmPassword('');
  };

  const closePasswordModal = () => {
    setPasswordModal({
      isOpen: false,
      userId: null,
      username: '',
    });
    setNewPassword('');
    setConfirmPassword('');
  };

  const changePassword = async () => {
    if (!passwordModal.userId) return;

    if (!newPassword || newPassword.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('كلمة المرور وتأكيد كلمة المرور غير متطابقين');
      return;
    }

    setChangingPassword(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${passwordModal.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to change password');
      }
      closePasswordModal();
      alert('تم تغيير كلمة المرور بنجاح');
    } catch (err: any) {
      setError(err?.message || 'فشل تغيير كلمة المرور');
    } finally {
      setChangingPassword(false);
    }
  };

  if (authLoading) {
    return (
      <AdminLayout>
        <div className="p-6 text-gray-700">Checking admin session...</div>
      </AdminLayout>
    );
  }

  if (!canManage) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-800">
            You must be a super admin to manage admin users.
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="text-gray-900" size={22} />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Admin users & permissions</h1>
              <p className="text-sm text-gray-500">Control who can access sensitive areas</p>
            </div>
          </div>
          <button
            onClick={fetchUsers}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {error && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

        {/* Create user */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Plus size={18} className="text-gray-800" />
            <h2 className="text-lg font-semibold text-gray-900">Add admin user</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Username"
              value={newUser.username}
              onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
            />
            <input
              className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Password"
              type="password"
              value={newUser.password}
              onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={newUser.is_super_admin}
                onChange={(e) => setNewUser((p) => ({ ...p, is_super_admin: e.target.checked }))}
              />
              Super admin (full access)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={newUser.is_active}
                onChange={(e) => setNewUser((p) => ({ ...p, is_active: e.target.checked }))}
              />
              Active
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                مكان العمل <span className="text-red-500">*</span>
              </label>
              <select
                value={newUser.work_location}
                onChange={(e) => setNewUser((p) => ({ ...p, work_location: e.target.value as 'المحل' | 'المخزن' }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="المحل">المحل</option>
                <option value="المخزن">المخزن</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
            {permissionLabels.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={newUser.permissions[key] === true}
                  onChange={(e) =>
                    setNewUser((p) => ({
                      ...p,
                      permissions: { ...p.permissions, [key]: e.target.checked },
                    }))
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={createUser}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Create user'}
            </button>
          </div>
        </div>

        {/* Existing users */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={18} className="text-gray-800" />
            <h2 className="text-lg font-semibold text-gray-900">Existing admins</h2>
          </div>
          {loading ? (
            <div className="text-gray-600">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-gray-600">No admin users found.</div>
          ) : (
            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="rounded-lg border border-gray-200 p-3 shadow-sm"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <div className="font-semibold text-gray-900">{user.username}</div>
                      <div className="text-sm text-gray-500">
                        {user.is_super_admin ? 'Super admin' : 'Standard admin'} •{' '}
                        {user.is_active ? 'Active' : 'Disabled'} •{' '}
                        مكان العمل: {user.work_location || 'المحل'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-700 flex-wrap">
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={user.is_active}
                          onChange={(e) => updateUser(user.id, { is_active: e.target.checked })}
                        />
                        Active
                      </label>
                      {!user.is_super_admin && (
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={user.is_super_admin}
                            onChange={(e) => updateUser(user.id, { is_super_admin: e.target.checked })}
                          />
                          Super
                        </label>
                      )}
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">مكان العمل:</label>
                        <select
                          value={user.work_location || 'المحل'}
                          onChange={(e) => updateUser(user.id, { work_location: e.target.value as 'المحل' | 'المخزن' })}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                        >
                          <option value="المحل">المحل</option>
                          <option value="المخزن">المخزن</option>
                        </select>
                      </div>
                      <button
                        onClick={() => openPasswordModal(user.id, user.username)}
                        disabled={saving}
                        className="flex items-center gap-1 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
                        title="Change password"
                      >
                        <Key size={16} />
                        تغيير كلمة المرور
                      </button>
                      {admin?.id !== user.id && (
                        <button
                          onClick={() => deleteUser(user.id)}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
                          title="Delete user"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                    {permissionLabels.map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={user.permissions[key] === true}
                          onChange={(e) => {
                            if (!user.id) {
                              setError('User ID is missing. Please refresh the page.');
                              return;
                            }
                            updateUser(user.id, {
                              permissions: { ...user.permissions, [key]: e.target.checked },
                            });
                          }}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Change Password Modal */}
        {passwordModal.isOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={closePasswordModal}
          >
            <div
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Key size={20} className="text-gray-700" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    تغيير كلمة المرور
                  </h3>
                </div>
                <button
                  onClick={closePasswordModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={changingPassword}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">
                  المستخدم: <span className="font-medium text-gray-900">{passwordModal.username}</span>
                </p>
              </div>

              {error && (
                <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    كلمة المرور الجديدة <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setError(null);
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="أدخل كلمة المرور الجديدة (6 أحرف على الأقل)"
                    disabled={changingPassword}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    تأكيد كلمة المرور <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError(null);
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="أعد إدخال كلمة المرور الجديدة"
                    disabled={changingPassword}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={closePasswordModal}
                  disabled={changingPassword}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  onClick={changePassword}
                  disabled={changingPassword || !newPassword || !confirmPassword}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {changingPassword ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      جاري التغيير...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      تغيير كلمة المرور
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}


